import express, { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { BeeApiClient } from './client.js';
import { ConsentLedger } from './consent-ledger.js';
import { DEFAULT_LEDGER } from './fixtures.js';
import { Redactor } from './redactor.js';
import { RefusalEngine } from './refusal.js';
import { createBystanderMcpServer, PROTOCOL_FLOOR } from './mcp-server.js';
import { BystanderDatabase, DEFAULT_DB_PATH } from './db.js';
import type { PipelineResult } from './types.js';

export interface ServerContext {
  app: express.Express;
  client: BeeApiClient;
  ledger: ConsentLedger;
  db: BystanderDatabase;
}

interface McpSession {
  sessionId: string;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
}

export function createServer(dbPath: string = DEFAULT_DB_PATH): ServerContext {
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  const db = new BystanderDatabase(dbPath, DEFAULT_LEDGER);
  const client = new BeeApiClient();
  const ledger = new ConsentLedger(DEFAULT_LEDGER, db.getParticipantRepository());

  // In-memory MCP sessions
  const sessions = new Map<string, McpSession>();

  // REST API Routes
  app.get('/api/status', async (_req: Request, res: Response) => {
    const status = client.getStatus();
    res.json({
      service: 'Bystander Service',
      version: '0.1.0',
      protocolFloor: PROTOCOL_FLOOR,
      beeApi: status,
      participants: ledger.list()
    });
  });

  app.get('/api/conversations', async (_req: Request, res: Response) => {
    const list = await client.listConversations();
    res.json(list);
  });

  app.get('/api/ledger', (_req: Request, res: Response) => {
    res.json({ ledger: ledger.list() });
  });

  app.get('/api/events', (_req: Request, res: Response) => {
    res.json({ events: db.listEvents(100) });
  });

  // D2: Real enrolment flow
  const VALID_ROLES = ['WEARER', 'PARTICIPANT', 'BYSTANDER'] as const;
  const VALID_STATUSES = ['CONSENTED', 'REVOKED', 'UNKNOWN'] as const;

  app.post('/api/consent/enrol', (req: Request, res: Response) => {
    const { clusterId, name, role, status, notes } = req.body || {};

    if (typeof clusterId !== 'string' || !clusterId.trim()) {
      return res.status(400).json({
        error: 'clusterId must be a non-empty string',
        code: 'INVALID_CLUSTER_ID'
      });
    }

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'name must be a non-empty string',
        code: 'INVALID_NAME'
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role "${role}": must be WEARER, PARTICIPANT, or BYSTANDER`,
        code: 'INVALID_ROLE'
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status "${status}": must be CONSENTED, REVOKED, or UNKNOWN`,
        code: 'INVALID_STATUS'
      });
    }

    const cleanClusterId = clusterId.trim();
    const cleanName = name.trim();

    ledger.setConsent(cleanClusterId, cleanName, role, status, notes);
    db.logEvent('CONSENT_ENROL', {
      clusterId: cleanClusterId,
      detail: `Enrolled participant "${cleanName}" (${cleanClusterId}) as ${role} with status ${status}`
    });

    return res.status(201).json({
      ok: true,
      participant: ledger.getParticipant(cleanClusterId)
    });
  });

  app.patch('/api/consent/:clusterId', (req: Request, res: Response) => {
    const rawClusterId = req.params.clusterId;
    const clusterId = Array.isArray(rawClusterId) ? rawClusterId[0] : rawClusterId;

    if (!clusterId || !clusterId.trim()) {
      return res.status(400).json({
        error: 'clusterId must be a non-empty string',
        code: 'INVALID_CLUSTER_ID'
      });
    }

    const existing = ledger.getParticipant(clusterId);
    if (!existing) {
      return res.status(404).json({
        error: `Participant with clusterId "${clusterId}" not found`,
        code: 'PARTICIPANT_NOT_FOUND'
      });
    }

    const { status, role, name, notes } = req.body || {};

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status "${status}": must be CONSENTED, REVOKED, or UNKNOWN`,
        code: 'INVALID_STATUS'
      });
    }

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role "${role}": must be WEARER, PARTICIPANT, or BYSTANDER`,
        code: 'INVALID_ROLE'
      });
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({
        error: 'name must be a non-empty string',
        code: 'INVALID_NAME'
      });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedRole = role !== undefined ? role : existing.role;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedNotes = notes !== undefined ? notes : existing.notes;

    ledger.setConsent(clusterId, updatedName, updatedRole, updatedStatus, updatedNotes);
    db.logEvent('CONSENT_UPDATE', {
      clusterId,
      detail: `Updated participant "${clusterId}": status=${updatedStatus}, role=${updatedRole}`
    });

    return res.json({
      ok: true,
      participant: ledger.getParticipant(clusterId)
    });
  });

  app.delete('/api/consent/:clusterId', (req: Request, res: Response) => {
    const rawClusterId = req.params.clusterId;
    const clusterId = Array.isArray(rawClusterId) ? rawClusterId[0] : rawClusterId;

    if (!clusterId || !clusterId.trim()) {
      return res.status(400).json({
        error: 'clusterId must be a non-empty string',
        code: 'INVALID_CLUSTER_ID'
      });
    }

    const existing = ledger.getParticipant(clusterId);
    ledger.unenrol(clusterId);
    db.logEvent('CONSENT_UNENROL', {
      clusterId,
      detail: `Un-enrolled participant "${existing?.name ?? clusterId}"; cluster reverted to UNKNOWN (refusal)`
    });

    return res.json({
      ok: true,
      clusterId,
      status: 'UNKNOWN',
      effect: 'Un-enrolled: cluster reverted to UNKNOWN (strict refusal)'
    });
  });

  // Backwards compatibility endpoint
  app.post('/api/consent', (req: Request, res: Response) => {
    const { clusterId, name, role, status, notes } = req.body || {};
    if (!clusterId || !status) {
      return res.status(400).json({ error: 'clusterId and status required' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status "${status}": must be CONSENTED, REVOKED, or UNKNOWN`,
        code: 'INVALID_STATUS'
      });
    }
    ledger.setConsent(clusterId, name || clusterId, role || 'PARTICIPANT', status, notes);
    db.logEvent('CONSENT_UPDATE', {
      clusterId,
      detail: `Updated consent for ${clusterId}: ${status}`
    });
    return res.json({ ok: true, participant: ledger.getParticipant(clusterId) });
  });

  app.get('/api/pipeline/:id', async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const id = parseInt(Array.isArray(rawId) ? rawId[0] : (rawId as string), 10);
    const convResult = await client.getConversation(id);
    if (!convResult.conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conv = convResult.conversation;
    const { redactedUtterances, audit, redactedText, rawText } = Redactor.redactConversation(
      conv,
      ledger
    );
    const refusal = RefusalEngine.evaluate(conv, ledger, audit);

    const rawUtteranceCount = conv.transcriptions.reduce(
      (sum, t) => sum + t.utterances.length,
      0
    );

    const pipelineResult: PipelineResult = {
      conversationId: conv.id,
      title: conv.title || `Conversation ${conv.id}`,
      rawUtteranceCount,
      redactedUtteranceCount: redactedUtterances.length,
      rawCharCount: rawText.length,
      redactedCharCount: redactedText.length,
      ledger: ledger.list(),
      audit,
      refusal,
      redactedUtterances,
      redactedText,
      summary: refusal.refused ? null : conv.summary,
      mode: convResult.mode,
      apiStatus: convResult.apiStatus
    };

    if (audit.removals.length > 0) {
      db.saveAuditRecords(conv.id, audit.removals);
    }

    res.json(pipelineResult);
  });

  // Streamable HTTP MCP Transport (RFC compliant with Protocol Floor 2025-11-25)
  app.post('/mcp', async (req: Request, res: Response) => {
    const body = req.body;
    const isInit =
      body &&
      (body.method === 'initialize' ||
        (Array.isArray(body) && body.some((m: any) => m.method === 'initialize')));

    const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;

    if (isInit) {
      // Hold the declared protocol floor.
      const raiseToFloor = (msg: any) => {
        const asked = msg?.params?.protocolVersion;
        if (
          msg?.method === 'initialize' &&
          typeof asked === 'string' &&
          asked < PROTOCOL_FLOOR
        ) {
          msg.params.protocolVersion = PROTOCOL_FLOOR;
        }
      };
      if (Array.isArray(body)) {
        body.forEach(raiseToFloor);
      } else {
        raiseToFloor(body);
      }

      // Create new stateful session
      const newSessionId = randomUUID();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        enableJsonResponse: true
      });

      const server = createBystanderMcpServer(client, ledger);
      await server.connect(transport);

      const session: McpSession = {
        sessionId: newSessionId,
        transport,
        createdAt: Date.now()
      };
      sessions.set(newSessionId, session);

      res.setHeader('mcp-session-id', newSessionId);
      return transport.handleRequest(req, res, req.body);
    }

    // Non-initialization request
    if (!sessionIdHeader) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Bad Request: Missing MCP-Session-Id header'
        },
        id: null
      });
    }

    const session = sessions.get(sessionIdHeader);
    if (!session) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: `Session not found: ${sessionIdHeader}`
        },
        id: null
      });
    }

    return session.transport.handleRequest(req, res, req.body);
  });

  // MCP Streamable HTTP endpoint: GET (SSE stream)
  app.get('/mcp', async (req: Request, res: Response) => {
    const acceptHeader = req.headers.accept || '';
    if (!acceptHeader.includes('text/event-stream')) {
      return res.status(406).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Not Acceptable: Client must accept text/event-stream'
        },
        id: null
      });
    }

    const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionIdHeader) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Bad Request: Missing MCP-Session-Id header'
        },
        id: null
      });
    }

    const session = sessions.get(sessionIdHeader);
    if (!session) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: `Session not found: ${sessionIdHeader}`
        },
        id: null
      });
    }

    return session.transport.handleRequest(req, res);
  });

  // MCP Streamable HTTP endpoint: DELETE (terminate session)
  app.delete('/mcp', async (req: Request, res: Response) => {
    const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionIdHeader) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Bad Request: Missing MCP-Session-Id header'
        },
        id: null
      });
    }

    const session = sessions.get(sessionIdHeader);
    if (!session) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: `Session not found: ${sessionIdHeader}`
        },
        id: null
      });
    }

    sessions.delete(sessionIdHeader);
    return session.transport.handleRequest(req, res);
  });

  return { app, client, ledger, db };
}

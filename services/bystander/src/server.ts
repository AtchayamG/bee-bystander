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

  app.post('/api/consent', (req: Request, res: Response) => {
    const { clusterId, name, role, status, notes } = req.body;
    if (!clusterId || !status) {
      res.status(400).json({ error: 'clusterId and status required' });
      return;
    }
    ledger.setConsent(clusterId, name || clusterId, role || 'PARTICIPANT', status, notes);
    res.json({ ok: true, participant: ledger.getParticipant(clusterId) });
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

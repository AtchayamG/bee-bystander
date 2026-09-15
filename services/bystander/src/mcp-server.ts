import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BeeApiClient } from './client.js';
import { ConsentLedger } from './consent-ledger.js';
import { Redactor } from './redactor.js';
import { RefusalEngine } from './refusal.js';

export const PROTOCOL_FLOOR = '2025-11-25';

/**
 * The tool names, in one place, because the settings view prints them.
 *
 * It used to print "Exposes 4 verified tools: bystander_get_transcript, ..."
 * as a literal sentence in the HTML. That is a claim about the running server
 * typed into the client, and it would have kept saying 4 after a fifth tool
 * was registered or a name changed. The registrations below and
 * GET /api/status both read this array, so the screen can only ever say what
 * the server actually registered.
 */
export const BYSTANDER_TOOL_NAMES = [
  'bystander_get_transcript',
  'bystander_list_conversations',
  'bystander_get_consent_ledger',
  'bystander_verify_redactions'
] as const;

export function createBystanderMcpServer(
  client: BeeApiClient,
  sharedLedger: ConsentLedger
): McpServer {
  const server = new McpServer({
    name: 'bystander-consent-layer',
    version: '0.1.0'
  });

  // Tool 1: bystander_get_transcript
  server.tool(
    BYSTANDER_TOOL_NAMES[0],
    'Retrieve a conversation transcript with unconsented speech and third-party PII redacted, with consent gating and audit summary.',
    {
      id: z.number().describe('Conversation ID to fetch and redact')
    },
    async ({ id }) => {
      const res = await client.getConversation(id);
      if (!res.conversation) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Conversation not found' }) }]
        };
      }

      const { audit, redactedText } = Redactor.redactConversation(
        res.conversation,
        sharedLedger
      );

      const refusal = RefusalEngine.evaluate(res.conversation, sharedLedger, audit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                conversationId: res.conversation.id,
                title: res.conversation.title,
                refused: refusal.refused,
                refusalCode: refusal.code ?? null,
                refusalReason: refusal.reason ?? null,
                details: refusal.details ?? null,
                redactedTranscript: redactedText,
                summary: refusal.refused ? null : (res.conversation.summary || res.conversation.short_summary || null),
                audit: {
                  totalRemovals: audit.removals.length,
                  totalRedactedChars: audit.totalRedactedChars,
                  totalRedactedWords: audit.totalRedactedWords,
                  unconsentedSpeakerBlocks: audit.unconsentedSpeakerCount,
                  piiCount: audit.piiCount,
                  removals: audit.removals
                }
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // Tool 2: bystander_list_conversations
  server.tool(
    BYSTANDER_TOOL_NAMES[1],
    'List conversations available in Bee, indicating speaker counts and storage state.',
    {},
    async () => {
      const result = await client.listConversations();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  // Tool 3: bystander_get_consent_ledger
  server.tool(
    BYSTANDER_TOOL_NAMES[2],
    'Fetch the active speaker consent ledger showing enrolled clusters, roles, and status.',
    {},
    async () => {
      const participants = sharedLedger.list();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalEnrolled: participants.length,
                participants
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // Tool 4: bystander_verify_redactions
  server.tool(
    BYSTANDER_TOOL_NAMES[3],
    'Fetch computed audit records showing what was removed, why, and which character spans were redacted for a conversation.',
    {
      id: z.number().describe('Conversation ID')
    },
    async ({ id }) => {
      const res = await client.getConversation(id);
      if (!res.conversation) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Conversation not found' }) }]
        };
      }

      const { audit } = Redactor.redactConversation(res.conversation, sharedLedger);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(audit, null, 2)
          }
        ]
      };
    }
  );

  return server;
}

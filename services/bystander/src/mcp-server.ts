import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BeeApiClient } from './client.js';
import { ConsentLedger } from './consent-ledger.js';
import { DEFAULT_LEDGER } from './fixtures.js';
import { Redactor } from './redactor.js';
import { RefusalEngine } from './refusal.js';
import type { PipelineResult } from './types.js';

export const PROTOCOL_FLOOR = '2025-11-25';

export function createBystanderMcpServer(
  client: BeeApiClient,
  sharedLedger: ConsentLedger
): McpServer {
  const server = new McpServer({
    name: 'bystander-consent-layer',
    version: '0.1.0'
  });

  // Tool 1: bystander_status
  server.tool(
    'bystander_status',
    'Check connectivity with Bee API, active consent ledger size, and current operating mode.',
    {},
    async () => {
      const status = client.getStatus();
      const participants = sharedLedger.list();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                service: 'Bystander Consent-Aware Capture Layer for Bee',
                version: '0.1.0',
                protocolFloor: PROTOCOL_FLOOR,
                beeApi: {
                  code: status.code,
                  message: status.message,
                  mode: status.mode,
                  hasToken: status.hasToken
                },
                ledger: {
                  totalEnrolled: participants.length,
                  consented: participants.filter((p) => p.status === 'CONSENTED').length,
                  revoked: participants.filter((p) => p.status === 'REVOKED').length,
                  unknown: participants.filter((p) => p.status === 'UNKNOWN').length
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
    'bystander_list_conversations',
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

  // Tool 3: bystander_get_conversation
  server.tool(
    'bystander_get_conversation',
    'Retrieve a conversation transcript with unconsented speech and third-party PII redacted, accompanied by an audit trail.',
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

      const { redactedUtterances, audit, redactedText, rawText } = Redactor.redactConversation(
        res.conversation,
        sharedLedger
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                conversationId: res.conversation.id,
                title: res.conversation.title,
                mode: res.mode,
                apiStatus: res.apiStatus,
                redactedTranscript: redactedText,
                audit: {
                  totalRemovals: audit.removals.length,
                  totalRedactedChars: audit.totalRedactedChars,
                  totalRedactedWords: audit.totalRedactedWords,
                  unconsentedSpeakerBlocks: audit.unconsentedSpeakerCount,
                  piiRedactions: audit.piiCount,
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

  // Tool 4: bystander_summarize
  server.tool(
    'bystander_summarize',
    'Generate an AI summary of a conversation ONLY IF all active speakers have consented. Loudly refuses if unconsented speech is present.',
    {
      id: z.number().describe('Conversation ID to summarize')
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
      if (refusal.refused) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'REFUSED',
                  refusalCode: refusal.code,
                  reason: refusal.reason,
                  details: refusal.details,
                  audit: {
                    totalRemovals: audit.removals.length,
                    unconsentedSpeakerBlocks: audit.unconsentedSpeakerCount
                  }
                },
                null,
                2
              )
            }
          ]
        };
      }

      // Consented path: return sanitized summary
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'APPROVED',
                conversationId: res.conversation.id,
                title: res.conversation.title,
                cleanSummary: res.conversation.summary || res.conversation.short_summary,
                redactedTranscriptSnippet: redactedText.slice(0, 300),
                audit: {
                  totalRemovals: audit.removals.length,
                  piiRedactions: audit.piiCount
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

  // Tool 5: bystander_manage_consent
  server.tool(
    'bystander_manage_consent',
    'Enroll a speaker cluster or update their consent status in the ledger (CONSENTED, REVOKED, UNKNOWN).',
    {
      clusterId: z.string().describe('Speaker cluster label, e.g. SPEAKER_0, SPEAKER_1'),
      name: z.string().describe('Human name of participant'),
      role: z.enum(['WEARER', 'PARTICIPANT', 'BYSTANDER']).describe('Participant role'),
      status: z.enum(['CONSENTED', 'REVOKED', 'UNKNOWN']).describe('Consent status')
    },
    async ({ clusterId, name, role, status }) => {
      sharedLedger.setConsent(clusterId, name, role, status);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                message: `Updated consent for cluster "${clusterId}" to "${status}".`,
                participant: sharedLedger.getParticipant(clusterId)
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  // Tool 6: bystander_audit
  server.tool(
    'bystander_audit',
    'Fetch computed audit records showing what was removed, why, and which spans were redacted for a conversation.',
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

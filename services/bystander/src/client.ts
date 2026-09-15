import https from 'node:https';
import { PROD_ROOT_CA } from './certs.js';
import type { ConversationDetail, ConversationSummary, Fact } from './types.js';
import { FIXTURE_CONVERSATIONS } from './fixtures.js';

export interface BeeClientOptions {
  apiBase?: string;
  token?: string;
}

export class BeeApiClient {
  private apiBase: string;
  private token: string | null;
  private httpsAgent: https.Agent;
  private lastStatus: { code: number; message: string };

  constructor(options: BeeClientOptions = {}) {
    this.apiBase = options.apiBase || process.env.BEE_API_BASE || 'https://app-api-developer.ce.bee.amazon.dev';
    this.token = options.token || process.env.BEE_TOKEN || null;
    this.httpsAgent = new https.Agent({
      ca: PROD_ROOT_CA,
      rejectUnauthorized: true
    });
    this.lastStatus = {
      code: this.token ? 200 : 401,
      message: this.token ? 'Ready' : 'Unauthorized (No token configured)'
    };
  }

  public getStatus(): {
    code: number;
    message: string;
    mode: 'live' | 'fixture';
    hasToken: boolean;
    endpoint: string;
  } {
    return {
      code: this.lastStatus.code,
      message: this.lastStatus.message,
      mode: this.token ? 'live' : 'fixture',
      // The host, never the credential. The settings view showed "Configured
      // Endpoint: not reported" because this field did not exist, which is the
      // honest fallback working but a gap on a panel whose whole job is
      // telling the wearer where their audio is going.
      endpoint: this.apiBase,
      hasToken: Boolean(this.token)
    };
  }

  public async fetchMe(): Promise<{ ok: boolean; data?: any; error?: string; status: number }> {
    return this.request('/v1/me');
  }

  public async listConversations(): Promise<{
    conversations: ConversationSummary[];
    mode: 'live' | 'fixture';
    apiStatus: { code: number; message: string };
  }> {
    const res = await this.request('/v1/conversations');
    if (res.ok && res.data?.conversations) {
      return {
        conversations: res.data.conversations,
        mode: 'live',
        apiStatus: { code: 200, message: 'OK' }
      };
    }

    // Honest fallback: record the 401 response and serve verified fixture summaries
    this.lastStatus = { code: res.status, message: res.error || 'Unauthorized' };
    const fixtures: ConversationSummary[] = FIXTURE_CONVERSATIONS.map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      short_summary: c.short_summary,
      state: c.state,
      created_at: c.created_at,
      updated_at: c.updated_at,
      utterances_count: c.transcriptions.reduce(
        (sum, t) => sum + t.utterances.length,
        0
      )
    }));

    return {
      conversations: fixtures,
      mode: 'fixture',
      apiStatus: {
        code: res.status,
        message: res.status === 401 ? '401 Unauthorized (Running in offline fixture mode)' : `HTTP ${res.status}`
      }
    };
  }

  public async getConversation(id: number): Promise<{
    conversation: ConversationDetail | null;
    mode: 'live' | 'fixture';
    apiStatus: { code: number; message: string };
  }> {
    const res = await this.request(`/v1/conversations/${id}`);
    if (res.ok && res.data) {
      return {
        conversation: res.data,
        mode: 'live',
        apiStatus: { code: 200, message: 'OK' }
      };
    }

    this.lastStatus = { code: res.status, message: res.error || 'Unauthorized' };
    const fixture = FIXTURE_CONVERSATIONS.find((c) => c.id === id) || FIXTURE_CONVERSATIONS[0];
    return {
      conversation: fixture,
      mode: 'fixture',
      apiStatus: {
        code: res.status,
        message: res.status === 401 ? '401 Unauthorized (Running in offline fixture mode)' : `HTTP ${res.status}`
      }
    };
  }

  private async request(path: string, options: https.RequestOptions = {}): Promise<{
    ok: boolean;
    data?: any;
    error?: string;
    status: number;
  }> {
    return new Promise((resolve) => {
      try {
        const url = new URL(path, this.apiBase);
        const headers: Record<string, string> = {
          Accept: 'application/json',
          ...(options.headers as Record<string, string> || {})
        };
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const req = https.request(
          {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            agent: this.httpsAgent,
            headers,
            timeout: 5000
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              const status = res.statusCode || 500;
              try {
                const parsed = JSON.parse(body);
                if (status >= 200 && status < 300) {
                  resolve({ ok: true, data: parsed, status });
                } else {
                  resolve({
                    ok: false,
                    error: parsed.error || `HTTP ${status}`,
                    data: parsed,
                    status
                  });
                }
              } catch {
                resolve({
                  ok: status >= 200 && status < 300,
                  data: body,
                  error: `Non-JSON body (HTTP ${status})`,
                  status
                });
              }
            });
          }
        );

        req.on('error', (err) => {
          resolve({ ok: false, error: err.message, status: 0 });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ ok: false, error: 'Request timed out', status: 408 });
        });

        req.end();
      } catch (err: any) {
        resolve({ ok: false, error: err.message, status: 0 });
      }
    });
  }
}

import http from 'node:http';
import https from 'node:https';
import { PROD_ROOT_CA } from './certs.js';
import type { ConversationDetail, ConversationSummary } from './types.js';
import { FIXTURE_CONVERSATIONS } from './fixtures.js';

export interface BeeClientOptions {
  apiBase?: string;
  token?: string;
}

type BeeResponse = { ok: boolean; data?: any; error?: string; status: number };

function parseApiBase(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('BEE_API_BASE must not contain credentials, query, or fragment');
  }
  if (url.protocol === 'http:') {
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
      throw new Error('Plain HTTP is allowed only for loopback Bee proxy endpoints');
    }
  } else if (url.protocol !== 'https:') {
    throw new Error('BEE_API_BASE must use HTTPS or the local Bee proxy over HTTP');
  }
  return url;
}

export class BeeApiClient {
  private apiBase: string;
  private token: string | null;
  private httpsAgent: https.Agent;
  private lastStatus: { code: number; message: string };
  private proxyAuthenticated = false;
  public readonly usesLocalProxy: boolean;

  constructor(options: BeeClientOptions = {}) {
    const configuredBase = options.apiBase || process.env.BEE_API_BASE || 'https://app-api-developer.ce.bee.amazon.dev';
    const url = parseApiBase(configuredBase);
    this.apiBase = url.origin;
    this.usesLocalProxy = url.protocol === 'http:';
    // The proxy owns authentication. Never forward a direct API token to it.
    this.token = this.usesLocalProxy ? null : options.token || process.env.BEE_TOKEN || null;
    this.httpsAgent = new https.Agent({ ca: PROD_ROOT_CA, rejectUnauthorized: true });
    this.lastStatus = {
      code: 401,
      message: this.usesLocalProxy ? 'Bee proxy authentication not yet verified' : 'Unauthorized (No token configured)'
    };
  }

  public getStatus(): {
    code: number;
    message: string;
    mode: 'live' | 'fixture';
    hasToken: boolean;
    endpoint: string;
    viaProxy: boolean;
  } {
    const mode = this.usesLocalProxy ? (this.proxyAuthenticated ? 'live' : 'fixture') : this.token ? 'live' : 'fixture';
    return {
      code: this.lastStatus.code,
      message: this.lastStatus.message,
      mode,
      endpoint: this.apiBase,
      hasToken: Boolean(this.token),
      viaProxy: this.usesLocalProxy && this.proxyAuthenticated
    };
  }

  public async fetchMe(): Promise<BeeResponse> {
    const res = await this.request('/v1/me');
    if (this.usesLocalProxy) {
      this.proxyAuthenticated = res.ok;
      this.lastStatus = {
        code: res.status,
        message: res.ok ? 'Authenticated through local bee proxy' : res.error || `HTTP ${res.status}`
      };
    }
    return res;
  }

  public async listConversations(): Promise<{
    conversations: ConversationSummary[];
    mode: 'live' | 'fixture';
    viaProxy: boolean;
    apiStatus: { code: number; message: string };
  }> {
    if (this.usesLocalProxy) {
      const me = await this.fetchMe();
      if (!me.ok) return this.fixtureList(me.status, me.error || `HTTP ${me.status}`);
    }

    const res = await this.request('/v1/conversations');
    if (res.ok) {
      const data = res.data;
      const conversations = Array.isArray(data)
        ? data
        : Array.isArray(data?.conversations)
          ? data.conversations
          : Array.isArray(data?.data)
            ? data.data
            : [];
      this.lastStatus = { code: res.status, message: 'OK' };
      return {
        conversations,
        mode: 'live',
        viaProxy: this.usesLocalProxy,
        apiStatus: { code: res.status, message: 'OK' }
      };
    }

    this.lastStatus = { code: res.status, message: res.error || `HTTP ${res.status}` };
    return this.fixtureList(res.status, res.error || `HTTP ${res.status}`);
  }

  public async getConversation(id: number): Promise<{
    conversation: ConversationDetail | null;
    mode: 'live' | 'fixture';
    apiStatus: { code: number; message: string };
  }> {
    if (this.usesLocalProxy) {
      const me = await this.fetchMe();
      if (!me.ok) return this.fixtureConversation(id, me.status, me.error || `HTTP ${me.status}`);
    }

    const res = await this.request(`/v1/conversations/${id}`);
    if (res.ok && res.data) {
      this.lastStatus = { code: res.status, message: 'OK' };
      return { conversation: res.data, mode: 'live', apiStatus: { code: res.status, message: 'OK' } };
    }
    if (res.status === 404) {
      this.lastStatus = { code: res.status, message: 'Conversation not found in live Bee data' };
      return { conversation: null, mode: 'live', apiStatus: { code: res.status, message: this.lastStatus.message } };
    }
    this.lastStatus = { code: res.status, message: res.error || `HTTP ${res.status}` };
    return this.fixtureConversation(id, res.status, res.error || `HTTP ${res.status}`);
  }

  private fixtureList(status: number, message: string) {
    const fixtures: ConversationSummary[] = FIXTURE_CONVERSATIONS.map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      short_summary: c.short_summary,
      state: c.state,
      created_at: c.created_at,
      updated_at: c.updated_at,
      utterances_count: c.transcriptions.reduce((sum, t) => sum + t.utterances.length, 0)
    }));
    return {
      conversations: fixtures,
      mode: 'fixture' as const,
      viaProxy: false,
      apiStatus: {
        code: status,
        message: status === 401 ? '401 Unauthorized (Running in offline fixture mode)' : message
      }
    };
  }

  private fixtureConversation(id: number, status: number, message: string) {
    const fixture = FIXTURE_CONVERSATIONS.find((c) => c.id === id) || FIXTURE_CONVERSATIONS[0];
    return {
      conversation: fixture,
      mode: 'fixture' as const,
      apiStatus: {
        code: status,
        message: status === 401 ? '401 Unauthorized (Running in offline fixture mode)' : message
      }
    };
  }

  private async request(path: string, options: http.RequestOptions = {}): Promise<BeeResponse> {
    return new Promise((resolve) => {
      try {
        const url = new URL(path, this.apiBase);
        const headers: http.OutgoingHttpHeaders = {
          Accept: 'application/json',
          ...(options.headers as http.OutgoingHttpHeaders || {})
        };
        if (this.token && !this.usesLocalProxy) headers.Authorization = `Bearer ${this.token}`;

        const handleResponse = (res: http.IncomingMessage) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => (body += chunk));
          res.on('end', () => {
            const status = res.statusCode || 500;
            try {
              const parsed = JSON.parse(body);
              if (status >= 200 && status < 300) resolve({ ok: true, data: parsed, status });
              else resolve({ ok: false, error: `HTTP ${status}`, data: parsed, status });
            } catch {
              resolve({
                ok: status >= 200 && status < 300,
                data: body,
                error: `Non-JSON body (HTTP ${status})`,
                status
              });
            }
          });
        };
        const requestOptions = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'http:' ? 80 : 443),
          path: url.pathname + url.search,
          method: options.method || 'GET',
          headers,
          timeout: 5000
        };
        const req = url.protocol === 'http:'
          ? http.request(requestOptions, handleResponse)
          : https.request({ ...requestOptions, agent: this.httpsAgent }, handleResponse);

        req.on('error', () => resolve({ ok: false, error: 'Bee API request failed', status: 0 }));
        req.on('timeout', () => {
          req.destroy();
          resolve({ ok: false, error: 'Request timed out', status: 408 });
        });
        req.end();
      } catch {
        resolve({ ok: false, error: 'Invalid Bee API request configuration', status: 0 });
      }
    });
  }
}

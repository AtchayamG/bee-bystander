const configuredBase = process.env.BEE_API_BASE || 'http://127.0.0.1:8787';
const base = new URL(configuredBase);
const hostname = base.hostname.toLowerCase().replace(/^\[|\]$/g, '');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
  throw new Error('Probe only permits the local Bee proxy over loopback HTTP.');
}

async function request(path) {
  try {
    const response = await fetch(new URL(path, base));
    const contentType = response.headers.get('content-type') || '(none)';
    let body;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, contentType, body };
  } catch {
    return { status: 'NETWORK_ERROR', contentType: '(none)', body: undefined };
  }
}

function fieldNames(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).join(',') || '(none)'
    : Array.isArray(value)
      ? '(array item)'
      : '(none)';
}

const me = await request('/v1/me');
console.log(`/v1/me HTTP: ${me.status}; content-type: ${me.contentType}; top-level fields: ${fieldNames(me.body)}`);

const conversations = await request('/v1/conversations');
const list = Array.isArray(conversations.body)
  ? conversations.body
  : Array.isArray(conversations.body?.conversations)
    ? conversations.body.conversations
    : Array.isArray(conversations.body?.data)
      ? conversations.body.data
      : [];
console.log(`/v1/conversations HTTP: ${conversations.status}; content-type: ${conversations.contentType}; count: ${list.length}; first-item fields: ${fieldNames(list[0])}`);

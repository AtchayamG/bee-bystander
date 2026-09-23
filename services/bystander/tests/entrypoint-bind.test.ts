import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The service entrypoint must bind loopback by default.
 *
 * `app.listen(PORT, cb)` with no host binds 0.0.0.0 - every interface - and the
 * entrypoint did exactly that for weeks while its own log line said 127.0.0.1.
 * `netstat` showed 0.0.0.0:3002. The origin guard stops hostile web pages, but
 * a non-browser caller on the same network can send any Host header it likes,
 * so network exposure has to be closed at the socket.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = fs.readFileSync(path.join(here, '..', 'src', 'index.ts'), 'utf8');

describe('Service entrypoint binding', () => {
  it('passes an explicit host to listen()', () => {
    assert.match(entry, /\.listen\(\s*PORT\s*,\s*HOST\s*,/, 'listen() must be given HOST, not just a port');
  });

  it('defaults that host to loopback', () => {
    assert.match(entry, /const HOST = process\.env\.HOST \|\| '127\.0\.0\.1'/);
  });

  it('never binds all interfaces by default', () => {
    assert.doesNotMatch(entry, /\.listen\(\s*PORT\s*,\s*\(\)/, 'a bare listen(PORT, cb) binds 0.0.0.0');
    assert.doesNotMatch(entry, /'0\.0\.0\.0'/);
  });
});

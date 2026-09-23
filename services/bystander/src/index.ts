import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3002', 10);
// Loopback only. This used to call app.listen(PORT) with no host, which binds
// every interface (0.0.0.0) while the log line below claimed 127.0.0.1 - so on
// cafe Wi-Fi, the setting this project is about, anyone on the network could
// reach the consent ledger. Set HOST explicitly to expose it on purpose.
const HOST = process.env.HOST || '127.0.0.1';
const { app } = createServer();

app.listen(PORT, HOST, () => {
  console.log(`[Bystander Service] Listening on http://${HOST}:${PORT}`);
  console.log(`[Bystander Service] MCP Streamable HTTP endpoint: http://${HOST}:${PORT}/mcp`);
});

import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3002', 10);
const { app } = createServer();

app.listen(PORT, () => {
  console.log(`[Bystander Service] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[Bystander Service] MCP Streamable HTTP endpoint: http://127.0.0.1:${PORT}/mcp`);
});

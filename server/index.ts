import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Target Claude Code CLI endpoint to proxy to
const CLI_TARGET = process.env.CLAUDE_CLI_URL || 'http://localhost:1337';
const PORT = Number(process.env.PORT || 3005);

const app = express();
app.use(cors());

// HTTP proxy to the local Claude Code CLI
app.use('/proxy', createProxyMiddleware({
  target: CLI_TARGET,
  changeOrigin: true,
  ws: true,
}));

const httpServer = createServer(app);

// Socket.io server used by the mobile client
const io = new Server(httpServer, {
  path: '/v1/updates',
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  // Minimal RPC implementation that proxies payloads to the CLI
  socket.on('rpc-call', async (payload, callback) => {
    try {
      const res = await fetch(`${CLI_TARGET}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      callback({ ok: true, result: data });
    } catch (err: any) {
      console.error('RPC proxy failed', err);
      callback({ ok: false, error: err.message });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}, forwarding to ${CLI_TARGET}`);
});

// Simple WebSocket server for live dashboard updates
// Run: npm install ws

const http = require('http');
const WebSocket = require('ws');
const port = Number(process.env.WS_PORT || 8081);
const server = http.createServer();
const wss = new WebSocket.Server({ server });
const MAX_LIVE_MESSAGE_BYTES = Number(process.env.WS_MAX_MESSAGE_BYTES || 512_000);
const MAX_CLIENT_BUFFERED_BYTES = Number(process.env.WS_MAX_CLIENT_BUFFERED_BYTES || 1_000_000);
let messageCount = 0;

server.on('error', err => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`WebSocket server could not start: port ${port} is already in use.`);
    console.error(`Stop the existing process on ${port} or rerun with WS_PORT set to another port.`);
    process.exit(1);
  }

  console.error('WebSocket server failed:', err);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`WebSocket server running on ws://localhost:${port}`);
});

// Broadcast helper
function broadcastRaw(msg) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < MAX_CLIENT_BUFFERED_BYTES) {
      client.send(msg);
    }
  });
}


// Optionally, allow clients to send messages
wss.on('connection', ws => {
  ws.on('message', message => {
    const bytes = Buffer.isBuffer(message)
      ? message.length
      : Array.isArray(message)
        ? message.reduce((sum, part) => sum + part.length, 0)
        : message instanceof ArrayBuffer
          ? message.byteLength
          : ArrayBuffer.isView(message)
            ? message.byteLength
            : Buffer.byteLength(String(message));
    messageCount += 1;
    if (bytes > MAX_LIVE_MESSAGE_BYTES) {
      console.warn(`Dropped oversized WebSocket telemetry message: ${bytes} bytes > ${MAX_LIVE_MESSAGE_BYTES}`);
      return;
    }
    if (messageCount % 25 === 0) {
      console.log(`WebSocket telemetry messages relayed: ${messageCount} latest=${bytes} bytes clients=${wss.clients.size}`);
    }
    // Broadcast any message received from a client to all clients (dashboard, others)
    try {
      JSON.parse(message);
      broadcastRaw(message.toString());
    } catch (e) {
      // If not JSON, just forward as string
      broadcastRaw(JSON.stringify({ type: 'raw', data: message.toString() }));
    }
  });
});

// Export broadcast for use in your game code
module.exports = { broadcast: (data) => broadcastRaw(JSON.stringify(data)) };

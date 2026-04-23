// Simple WebSocket server for live dashboard updates
// Run: npm install ws

const http = require('http');
const WebSocket = require('ws');
const port = Number(process.env.WS_PORT || 8081);
const server = http.createServer();
const wss = new WebSocket.Server({ server });

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
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}


// Optionally, allow clients to send messages
wss.on('connection', ws => {
  ws.on('message', message => {
    console.log('Received from client:', message);
    // Broadcast any message received from a client to all clients (dashboard, others)
    try {
      const parsed = JSON.parse(message);
      broadcast(parsed);
    } catch (e) {
      // If not JSON, just forward as string
      broadcast({ type: 'raw', data: message.toString() });
    }
  });
});

// Export broadcast for use in your game code
module.exports = { broadcast };

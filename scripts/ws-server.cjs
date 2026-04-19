// Simple WebSocket server for live dashboard updates
// Run: npm install ws

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

console.log('WebSocket server running on ws://localhost:8081');

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
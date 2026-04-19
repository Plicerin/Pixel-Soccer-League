#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Start Vite dev server
console.log('Starting Vite dev server on port 3001...');
const vite = spawn('vite', ['--port=3001', '--host=0.0.0.0'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

// Start WebSocket server
console.log('Starting WebSocket server on port 8081...');
const ws = spawn('node', [path.join(__dirname, 'ws-server.cjs')], {
  cwd: rootDir,
  stdio: 'inherit'
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  vite.kill();
  ws.kill();
  process.exit(0);
});

vite.on('error', (err) => console.error('Vite error:', err));
ws.on('error', (err) => console.error('WebSocket server error:', err));

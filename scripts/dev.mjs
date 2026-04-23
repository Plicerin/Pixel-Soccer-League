#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const nodeExec = process.execPath;
const viteCli = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

function spawnManaged(label, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', (err) => {
    console.error(`${label} error:`, err);
  });

  child.on('exit', (code, signal) => {
    if (code === 0 || signal === 'SIGTERM' || signal === 'SIGINT') return;
    console.error(`${label} exited unexpectedly${code != null ? ` with code ${code}` : ''}${signal ? ` (${signal})` : ''}.`);
  });

  return child;
}

console.log('Starting Vite dev server on port 3001...');
const vite = spawnManaged('Vite', nodeExec, [viteCli, '--port=3001', '--host=0.0.0.0']);

console.log('Starting WebSocket server on port 8081...');
const ws = spawnManaged('WebSocket server', nodeExec, [path.join(__dirname, 'ws-server.cjs')]);

const shutdown = () => {
  console.log('\nShutting down servers...');
  vite.kill('SIGTERM');
  ws.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

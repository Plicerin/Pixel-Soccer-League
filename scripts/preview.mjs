#!/usr/bin/env node

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const nodeExec = process.execPath;
const wsPort = Number(process.env.WS_PORT || 8081);
const children = new Set();
let shuttingDown = false;

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down servers...');
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 50);
}

function spawnManaged(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.add(child);

  child.on('error', (err) => {
    console.error(`${label} error:`, err);
    if (options.critical) shutdown(1);
  });

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (shuttingDown || code === 0 || signal === 'SIGTERM' || signal === 'SIGINT') return;
    console.error(`${label} exited unexpectedly${code != null ? ` with code ${code}` : ''}${signal ? ` (${signal})` : ''}.`);
    if (options.critical) shutdown(1);
  });

  return child;
}

console.log('Starting static preview server on port 3001...');
spawnManaged('Static preview', nodeExec, [path.join(__dirname, 'static-preview.mjs')], { critical: true });

if (await isPortListening(wsPort)) {
  console.log(`WebSocket server already running on port ${wsPort}; reusing it.`);
} else {
  console.log(`Starting WebSocket server on port ${wsPort}...`);
  spawnManaged('WebSocket server', nodeExec, [path.join(__dirname, 'ws-server.cjs')]);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

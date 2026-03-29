import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/** Dev-only Vite plugin: tiny POST endpoint that mirrors match results to a local JSON file. */
function telemetryMirrorPlugin(): Plugin {
  const filePath = path.resolve(__dirname, 'match-results.json');
  return {
    name: 'telemetry-mirror',
    configureServer(server) {
      server.middlewares.use('/__telemetry/mirror', (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405).end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            let existing: unknown[] = [];
            if (fs.existsSync(filePath)) {
              try { existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { existing = []; }
              if (!Array.isArray(existing)) existing = [existing];
            }
            existing.push(body);
            fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(400).end(String(err));
          }
        });
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), telemetryMirrorPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

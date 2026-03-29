import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/** Dev-only Vite plugin: tiny POST endpoint that mirrors match results to a local JSON file. */
function telemetryMirrorPlugin(): Plugin {
  const filePath = path.resolve(__dirname, 'match-results.json');
  const snapshotFilePath = path.resolve(__dirname, 'telemetry-snapshots.json');
  const batchFilePath = path.resolve(__dirname, 'telemetry-batches.ndjson');

  const readJsonArrayFile = (targetFilePath: string) => {
    if (!fs.existsSync(targetFilePath)) return [] as unknown[];
    try {
      const parsed = JSON.parse(fs.readFileSync(targetFilePath, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [] as unknown[];
    }
  };

  const readNdjsonFile = (targetFilePath: string) => {
    if (!fs.existsSync(targetFilePath)) return [] as unknown[];
    try {
      return fs
        .readFileSync(targetFilePath, 'utf-8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      return [] as unknown[];
    }
  };

  const handleGetJson = (req: any, res: any, readValue: () => unknown) => {
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    try {
      const body = readValue();
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  };

  const appendJsonArrayFile = (targetFilePath: string, body: unknown) => {
    const existing = readJsonArrayFile(targetFilePath);
    existing.push(body);
    fs.writeFileSync(targetFilePath, JSON.stringify(existing, null, 2), 'utf-8');
  };

  const handlePostJsonArray = (req: any, res: any, targetFilePath: string) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        appendJsonArrayFile(targetFilePath, body);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400).end(String(err));
      }
    });
  };

  const handleAppendJsonLine = (req: any, res: any, targetFilePath: string) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        fs.appendFileSync(targetFilePath, `${JSON.stringify(body)}\n`, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400).end(String(err));
      }
    });
  };

  return {
    name: 'telemetry-mirror',
    configureServer(server) {
      server.middlewares.use('/__telemetry/mirror', (req, res) => {
        handlePostJsonArray(req, res, filePath);
      });

      server.middlewares.use('/__telemetry/mirror-snapshot', (req, res) => {
        handlePostJsonArray(req, res, snapshotFilePath);
      });

      server.middlewares.use('/__telemetry/mirror-batch', (req, res) => {
        handleAppendJsonLine(req, res, batchFilePath);
      });

      server.middlewares.use('/__telemetry/mirror-status', (req, res) => {
        handleGetJson(req, res, () => {
          const summaries = readJsonArrayFile(filePath) as Array<Record<string, any>>;
          const snapshots = readJsonArrayFile(snapshotFilePath) as Array<Record<string, any>>;
          const batches = readNdjsonFile(batchFilePath) as Array<Record<string, any>>;
          const latestSummary = summaries.at(-1) || null;
          const latestSnapshot = snapshots.at(-1) || null;
          const latestBatch = batches.at(-1) || null;
          const batchStats = fs.existsSync(batchFilePath) ? fs.statSync(batchFilePath) : null;
          const snapshotStats = fs.existsSync(snapshotFilePath) ? fs.statSync(snapshotFilePath) : null;
          const summaryStats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

          return {
            ok: true,
            summaryCount: summaries.length,
            snapshotCount: snapshots.length,
            batchCount: batches.length,
            latestSessionId: latestBatch?.sessionId || latestSnapshot?.sessionId || latestSummary?.sessionId || null,
            latestBatchAt: latestBatch?.timestamp || (batchStats ? batchStats.mtimeMs : null),
            latestSnapshotAt: latestSnapshot?.timestamp || (snapshotStats ? snapshotStats.mtimeMs : null),
            latestSummaryAt: latestSummary?.timestamp || (summaryStats ? summaryStats.mtimeMs : null),
            latestSnapshotEventType: latestSnapshot?.eventType || null,
            latestPhase: latestBatch?.matchSnapshot?.phase || latestSnapshot?.match?.phase || latestSummary?.phase || null,
            latestScore: latestBatch?.matchSnapshot
              ? { scoreA: latestBatch.matchSnapshot.scoreA ?? 0, scoreB: latestBatch.matchSnapshot.scoreB ?? 0 }
              : latestSnapshot?.match
                ? { scoreA: latestSnapshot.match.scoreA ?? 0, scoreB: latestSnapshot.match.scoreB ?? 0 }
                : latestSummary
                  ? { scoreA: latestSummary.finalScoreA ?? 0, scoreB: latestSummary.finalScoreB ?? 0 }
                  : null,
          };
        });
      });

      server.middlewares.use('/__telemetry/recover-latest', (req, res) => {
        handleGetJson(req, res, () => {
          const summaries = readJsonArrayFile(filePath) as Array<Record<string, any>>;
          const snapshots = readJsonArrayFile(snapshotFilePath) as Array<Record<string, any>>;
          const batches = readNdjsonFile(batchFilePath) as Array<Record<string, any>>;
          const latestSummary = summaries.at(-1) || null;
          const latestSnapshot = snapshots.at(-1) || null;
          const latestBatch = batches.at(-1) || null;
          const sessionId = latestBatch?.sessionId || latestSnapshot?.sessionId || latestSummary?.sessionId || null;

          return {
            ok: !!sessionId,
            sessionId,
            summaryCount: summaries.length,
            snapshotCount: snapshots.length,
            batchCount: batches.length,
            latestSummary,
            latestSnapshot,
            latestBatch: latestBatch
              ? {
                  sessionId: latestBatch.sessionId,
                  timestamp: latestBatch.timestamp,
                  matchSnapshot: latestBatch.matchSnapshot || null,
                  performanceSample: latestBatch.performanceSample || null,
                  telemetryEventTypes: Array.isArray(latestBatch.telemetryEvents)
                    ? latestBatch.telemetryEvents.map((event: Record<string, any>) => event.eventType).filter(Boolean)
                    : [],
                  playerSnapshotCount: Array.isArray(latestBatch.playerSnapshots) ? latestBatch.playerSnapshots.length : 0,
                  samplePlayerNames: Array.isArray(latestBatch.playerSnapshots)
                    ? latestBatch.playerSnapshots.slice(0, 6).map((player: Record<string, any>) => player.name).filter(Boolean)
                    : [],
                }
              : null,
          };
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
      watch: {
        ignored: ['**/match-results.json', '**/telemetry-snapshots.json', '**/telemetry-batches.ndjson'],
      },
    },
  };
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/** Dev-only Vite plugin: tiny POST endpoint that mirrors match results to a local JSON file. */
function telemetryMirrorPlugin(): Plugin {
  const filePath = path.resolve(__dirname, 'match-results.json');
  const snapshotFilePath = path.resolve(__dirname, 'telemetry-snapshots.json');
  const batchFilePath = path.resolve(__dirname, 'telemetry-batches.ndjson');
  const shotEventsFilePath = path.resolve(__dirname, 'shot-events.ndjson');
  const keeperExpFilePath = path.resolve(__dirname, 'keeper-experience.ndjson');

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

      // POST: append shot events (array of payloads) to NDJSON file
      server.middlewares.use('/__telemetry/shot-events', (req, res) => {
        if (req.method === 'GET') {
          handleGetJson(req, res, () => {
            const events = readNdjsonFile(shotEventsFilePath) as Array<Record<string, any>>;
            const distances = events.map(e => e.distToGoal).filter((d): d is number => typeof d === 'number');
            const avg = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
            const byTeam: Record<string, number[]> = {};
            for (const e of events) {
              const t = e.team || 'unknown';
              (byTeam[t] ??= []).push(e.distToGoal ?? 0);
            }
            const teamAvg: Record<string, { avg: number; count: number }> = {};
            for (const [t, ds] of Object.entries(byTeam)) {
              teamAvg[t] = { avg: ds.reduce((a, b) => a + b, 0) / ds.length, count: ds.length };
            }
            return { ok: true, totalShots: events.length, avgDistance: +avg.toFixed(2), byTeam: teamAvg, events };
          });
          return;
        }
        // POST: bulk append
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            const events = Array.isArray(body) ? body : [body];
            const lines = events.map((e: unknown) => JSON.stringify(e)).join('\n') + '\n';
            fs.appendFileSync(shotEventsFilePath, lines, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, appended: events.length }));
          } catch (err) {
            res.writeHead(400).end(String(err));
          }
        });
      });

      // POST: append keeper experiences to NDJSON file
      // GET: return count + stats
      server.middlewares.use('/__telemetry/keeper-experience', (req, res) => {
        if (req.method === 'GET') {
          handleGetJson(req, res, () => {
            const exps = readNdjsonFile(keeperExpFilePath) as Array<Record<string, any>>;
            let pos = 0, neg = 0, neutral = 0;
            for (const e of exps) {
              if (e.reward > 0) pos++;
              else if (e.reward < 0) neg++;
              else neutral++;
            }
            return { ok: true, total: exps.length, positive: pos, negative: neg, neutral };
          });
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            const exps = Array.isArray(body) ? body : [body];
            const lines = exps.map((e: unknown) => JSON.stringify(e)).join('\n') + '\n';
            fs.appendFileSync(keeperExpFilePath, lines, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, appended: exps.length }));
          } catch (err) {
            res.writeHead(400).end(String(err));
          }
        });
      });

      // POST: trigger training run on accumulated experience, returns new weights
      server.middlewares.use('/__telemetry/keeper-train', (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        const exps = readNdjsonFile(keeperExpFilePath) as unknown[];
        if (exps.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, reason: 'no experience data' }));
          return;
        }
        // Write a temp JSON file for the training script
        const tmpFile = path.resolve(__dirname, '.keeper-train-input.json');
        fs.writeFileSync(tmpFile, JSON.stringify(exps), 'utf-8');
        try {
          const result = execFileSync(
            process.execPath,                    // node
            [
              '--import', 'tsx',                 // tsx loader
              path.resolve(__dirname, 'src/ai/trainKeeper.ts'),
              tmpFile,
              '--epochs', '100',
              '--lr', '0.003',
            ],
            { timeout: 60_000, encoding: 'utf-8', env: { ...process.env, NODE_NO_WARNINGS: '1' } },
          );
          console.log('[keeper-train]', result);
          // Read the freshly-written weights
          const weightsPath = path.resolve(__dirname, 'public/assets/keeper-model/weights.json');
          const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, experiences: exps.length, weights }));
        } catch (err: any) {
          console.error('[keeper-train] Training failed:', err.stderr || err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: String(err.stderr || err.message) }));
        } finally {
          try { fs.unlinkSync(tmpFile); } catch {}
        }
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

/** SQLite-backed tuning relay + match history. Works across any browser/port/webview. */
function tuningRelayPlugin(): Plugin {
  let db: typeof import('./src/server/psl-db') | null = null;
  const getDbModule = async () => {
    if (!db) db = await import('./src/server/psl-db');
    return db;
  };

  const readBody = (req: any): Promise<string> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });

  return {
    name: 'tuning-relay',
    configureServer(server) {
      // Game POSTs live tuning payload
      server.middlewares.use('/__tuning/push', async (req: any, res: any) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body);
          const mod = await getDbModule();
          mod.upsertLiveTuning(parsed.ts || Date.now(), body);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        } catch (err) {
          res.writeHead(400).end(String(err));
        }
      });

      // Dashboard GETs latest tuning payload
      server.middlewares.use('/__tuning/pull', async (req: any, res: any) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return; }
        try {
          const mod = await getDbModule();
          const row = mod.getLiveTuning();
          if (!row) { res.writeHead(204).end(); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(row.payload_json);
        } catch (err) {
          res.writeHead(500).end(String(err));
        }
      });

      // Game POSTs completed match result
      server.middlewares.use('/__db/match-result', async (req: any, res: any) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        try {
          const body = JSON.parse(await readBody(req));
          const mod = await getDbModule();
          mod.insertMatchResult(body);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        } catch (err) {
          res.writeHead(400).end(String(err));
        }
      });

      // Dashboard / MatchHistory GETs recent matches
      server.middlewares.use('/__db/matches', async (req: any, res: any) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return; }
        try {
          const mod = await getDbModule();
          const url = new URL(req.url || '/', 'http://localhost');
          const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
          const rows = mod.getRecentMatches(limit);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rows));
        } catch (err) {
          res.writeHead(500).end(String(err));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), telemetryMirrorPlugin(), tuningRelayPlugin()],
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
      hmr: process.env.DISABLE_HMR !== 'true',      allowedHosts: ['gakeen'],      watch: {
        ignored: ['**/match-results.json', '**/telemetry-snapshots.json', '**/telemetry-batches.ndjson', '**/shot-events.ndjson', '**/keeper-experience.ndjson', '**/scripts/**', '**/psl.db', '**/psl.db-wal', '**/psl.db-shm', '**/keeper-model/**'],
      },
    },
  };
});

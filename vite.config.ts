import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import {defineConfig, type Plugin} from 'vite';

/** Dev-only Vite plugin: tiny POST endpoint that mirrors match results to a local JSON file. */
function telemetryMirrorPlugin(): Plugin {
  const filePath = path.resolve(__dirname, 'match-results.json');
  const snapshotFilePath = path.resolve(__dirname, 'telemetry-snapshots.json');
  const snapshotLineFilePath = path.resolve(__dirname, 'telemetry-snapshots.ndjson');
  const batchFilePath = path.resolve(__dirname, 'telemetry-batches.ndjson');
  const shotEventsFilePath = path.resolve(__dirname, 'shot-events.ndjson');
  const keeperExpFilePath = path.resolve(__dirname, 'keeper-experience.ndjson');
  const archiveDir = process.env.PSL_TELEMETRY_ARCHIVE_DIR
    ? path.resolve(process.env.PSL_TELEMETRY_ARCHIVE_DIR)
    : path.join(process.env.TEMP || process.env.TMP || __dirname, 'psl-telemetry-archive');
  const maxEagerReadBytes = 5 * 1024 * 1024;
  const maxActiveLogBytes = 25 * 1024 * 1024;
  const tailReadBytes = 256 * 1024;

  const fileStats = (targetFilePath: string) => {
    try {
      return fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath) : null;
    } catch {
      return null;
    }
  };

  const archiveOversizedFile = (targetFilePath: string) => {
    const stats = fileStats(targetFilePath);
    if (!stats || stats.size <= maxActiveLogBytes) return;
    fs.mkdirSync(archiveDir, { recursive: true });
    const parsed = path.parse(targetFilePath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(archiveDir, `${parsed.name}-${stamp}${parsed.ext}`);
    fs.renameSync(targetFilePath, archivePath);
  };

  const maybeRotateBeforeAppend = (targetFilePath: string) => {
    try {
      archiveOversizedFile(targetFilePath);
    } catch (err) {
      console.warn('[telemetry-mirror] rotate failed:', targetFilePath, err);
    }
  };

  const safeParseJsonLine = (line: string) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  };

  const readLatestNdjsonLine = (targetFilePath: string) => {
    const stats = fileStats(targetFilePath);
    if (!stats || stats.size <= 0) return { latest: null, count: 0, truncated: false, size: 0, mtimeMs: null };
    const bytesToRead = Math.min(stats.size, tailReadBytes);
    const fd = fs.openSync(targetFilePath, 'r');
    try {
      const buffer = Buffer.alloc(bytesToRead);
      fs.readSync(fd, buffer, 0, bytesToRead, stats.size - bytesToRead);
      const lines = buffer
        .toString('utf-8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const usableLines = stats.size > bytesToRead && lines.length > 1 ? lines.slice(1) : lines;
      for (let i = usableLines.length - 1; i >= 0; i--) {
        const parsed = safeParseJsonLine(usableLines[i]);
        if (parsed) {
          return {
            latest: parsed,
            count: stats.size > bytesToRead ? null : usableLines.length,
            truncated: stats.size > bytesToRead,
            size: stats.size,
            mtimeMs: stats.mtimeMs,
          };
        }
      }
      return { latest: null, count: stats.size > bytesToRead ? null : usableLines.length, truncated: stats.size > bytesToRead, size: stats.size, mtimeMs: stats.mtimeMs };
    } finally {
      fs.closeSync(fd);
    }
  };

  const readJsonArrayFileIfSmall = (targetFilePath: string) => {
    const stats = fileStats(targetFilePath);
    if (!stats) return { entries: [] as unknown[], skipped: false, size: 0, mtimeMs: null };
    if (stats.size > maxEagerReadBytes) return { entries: [] as unknown[], skipped: true, size: stats.size, mtimeMs: stats.mtimeMs };
    return { entries: readJsonArrayFile(targetFilePath), skipped: false, size: stats.size, mtimeMs: stats.mtimeMs };
  };

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
    maybeRotateBeforeAppend(targetFilePath);
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
        maybeRotateBeforeAppend(targetFilePath);
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
      server.middlewares.use('/__health', (req, res) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      });

      server.middlewares.use('/__telemetry/mirror', (req, res) => {
        handlePostJsonArray(req, res, filePath);
      });

      server.middlewares.use('/__telemetry/mirror-snapshot', (req, res) => {
        handleAppendJsonLine(req, res, snapshotLineFilePath);
      });

      server.middlewares.use('/__telemetry/mirror-batch', (req, res) => {
        handleAppendJsonLine(req, res, batchFilePath);
      });

      server.middlewares.use('/__telemetry/mirror-status', (req, res) => {
        handleGetJson(req, res, () => {
          const summaryRead = readJsonArrayFileIfSmall(filePath);
          const legacySnapshotRead = readJsonArrayFileIfSmall(snapshotFilePath);
          const summaries = summaryRead.entries as Array<Record<string, any>>;
          const latestSnapshotLine = readLatestNdjsonLine(snapshotLineFilePath);
          const latestBatchLine = readLatestNdjsonLine(batchFilePath);
          const latestSummary = summaries.at(-1) || null;
          const latestSnapshot = latestSnapshotLine.latest || (legacySnapshotRead.entries as Array<Record<string, any>>).at(-1) || null;
          const latestBatch = latestBatchLine.latest;
          const batchStats = fileStats(batchFilePath);
          const snapshotStats = fileStats(snapshotLineFilePath) || fileStats(snapshotFilePath);
          const summaryStats = fileStats(filePath);

          return {
            ok: true,
            summaryCount: summaryRead.skipped ? -1 : summaries.length,
            snapshotCount: latestSnapshotLine.count ?? (legacySnapshotRead.skipped ? -1 : legacySnapshotRead.entries.length),
            batchCount: latestBatchLine.count ?? -1,
            truncated: summaryRead.skipped || legacySnapshotRead.skipped || latestSnapshotLine.truncated || latestBatchLine.truncated,
            latestSessionId: latestBatch?.sessionId || latestSnapshot?.sessionId || latestSummary?.sessionId || null,
            latestBatchAt: latestBatch?.timestamp || (batchStats ? batchStats.mtimeMs : null),
            latestSnapshotAt: latestSnapshot?.timestamp || (snapshotStats ? snapshotStats.mtimeMs : null),
            latestSummaryAt: latestSummary?.timestamp || (summaryStats ? summaryStats.mtimeMs : null),
            latestSnapshotEventType: latestSnapshot?.eventType || null,
            latestPhase: latestBatch?.matchSnapshot?.phase || latestSnapshot?.match?.phase || latestSummary?.phase || null,
            latestScore: latestSummary
              ? { scoreA: latestSummary.finalScoreA ?? 0, scoreB: latestSummary.finalScoreB ?? 0 }
              : latestBatch?.matchSnapshot
                ? { scoreA: latestBatch.matchSnapshot.scoreA ?? 0, scoreB: latestBatch.matchSnapshot.scoreB ?? 0 }
                : latestSnapshot?.match
                  ? { scoreA: latestSnapshot.match.scoreA ?? 0, scoreB: latestSnapshot.match.scoreB ?? 0 }
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
          const summaryRead = readJsonArrayFileIfSmall(filePath);
          const legacySnapshotRead = readJsonArrayFileIfSmall(snapshotFilePath);
          const latestSnapshotLine = readLatestNdjsonLine(snapshotLineFilePath);
          const latestBatchLine = readLatestNdjsonLine(batchFilePath);
          const summaries = summaryRead.entries as Array<Record<string, any>>;
          const latestSummary = summaries.at(-1) || null;
          const latestSnapshot = latestSnapshotLine.latest || (legacySnapshotRead.entries as Array<Record<string, any>>).at(-1) || null;
          const latestBatch = latestBatchLine.latest;
          const sessionId = latestBatch?.sessionId || latestSnapshot?.sessionId || latestSummary?.sessionId || null;

          return {
            ok: !!sessionId,
            sessionId,
            summaryCount: summaryRead.skipped ? -1 : summaries.length,
            snapshotCount: latestSnapshotLine.count ?? (legacySnapshotRead.skipped ? -1 : legacySnapshotRead.entries.length),
            batchCount: latestBatchLine.count ?? -1,
            truncated: summaryRead.skipped || legacySnapshotRead.skipped || latestSnapshotLine.truncated || latestBatchLine.truncated,
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

  const isSplashGhostPayload = (parsed: any): boolean => {
    const bundle = parsed?.bundle || parsed;
    const snapshot = parsed?.snapshot || bundle?.snapshot || {};
    if (parsed?.sessionActive === false || bundle?.sessionActive === false || snapshot?.sessionActive === false) {
      return true;
    }
    const teamA = String(bundle?.teamA?.name || snapshot?.teamA?.name || '');
    const teamB = String(bundle?.teamB?.name || snapshot?.teamB?.name || '');
    const matchId = String(snapshot?.matchId || bundle?.matchId || bundle?.metadata?.matchId || '').trim();
    return teamA === 'Inter Miami' && teamB === 'LA Galaxy' && !matchId;
  };

  const installRoutes = (server: any) => {
      // Game POSTs live tuning payload
      server.middlewares.use('/__tuning/push', async (req: any, res: any) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body);
          const mod = await getDbModule();
          if (isSplashGhostPayload(parsed)) {
            mod.clearLiveTuning?.();
            console.warn('[psl-db] rejected ghost live tuning:', parsed?.bundle?.teamA?.name, 'vs', parsed?.bundle?.teamB?.name);
            res.writeHead(202, { 'Content-Type': 'application/json' }).end('{"ok":false,"reason":"ghost_live_tuning_rejected"}');
            return;
          }
          mod.upsertLiveTuning(parsed.ts || Date.now(), body);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        } catch (err) {
          res.writeHead(400).end(String(err));
        }
      });

      server.middlewares.use('/__tuning/clear', async (req: any, res: any) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        try {
          const mod = await getDbModule();
          mod.clearLiveTuning?.();
          res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        } catch (err) {
          res.writeHead(500).end(String(err));
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
          // Belt-and-suspenders ghost-match reject: the bundle itself carries
          // sessionActive=false when it came from a splash-scene demo (see
          // gameEngine.ts getMatchSnapshot). Stale browser tabs running
          // pre-fix code still POST these — reject at the server so they
          // never reach the DB.
          let bundle: any = null;
          try { bundle = body.bundle_json ? JSON.parse(body.bundle_json) : null; } catch {}
          if (isSplashGhostPayload(bundle)) {
            console.warn('[psl-db] rejected ghost match:', body.team_a_name, 'vs', body.team_b_name, 'session', body.session_id);
            res.writeHead(202, { 'Content-Type': 'application/json' }).end('{"ok":false,"reason":"ghost_match_rejected"}');
            return;
          }
          const mod = await getDbModule();
          const inserted = mod.insertMatchResult(body);
          if (!inserted) {
            console.warn('[psl-db] rejected invalid match row:', body.team_a_name, 'vs', body.team_b_name, 'session', body.session_id);
            res.writeHead(202, { 'Content-Type': 'application/json' }).end('{"ok":false,"reason":"invalid_match_rejected"}');
            return;
          }
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
      
      // Dashboard GETs raw telemetry events. Completed simple-model bundles
      // carry most events inside bundle_json; this route keeps the dashboard
      // fetch contract valid in dev and preview even when no event rows exist.
      server.middlewares.use('/__db/telemetry-events', async (req: any, res: any) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return; }
        try {
          const mod = await getDbModule();
          const url = new URL(req.url || '/', 'http://localhost');
          const sessionId = url.searchParams.get('session_id') || '';
          const limit = Math.min(10000, Math.max(1, parseInt(url.searchParams.get('limit') || '10000', 10)));
          const rows = mod.getTelemetryEvents?.(sessionId, limit) || [];
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rows));
        } catch (err) {
          res.writeHead(500).end(String(err));
        }
      });
  };

  return {
    name: 'tuning-relay',
    configureServer(server) {
      installRoutes(server);
    },
    configurePreviewServer(server) {
      installRoutes(server);
    },
  };
}

/**
 * Files under public/ are copied verbatim into dist/, which means the debug
 * dashboard and the infinite-game scratchpad would ship inside the Windows
 * installer. They are dev-server tools (SPEC I.dashboard serves them from
 * localhost:3001), so keep them in public/ for dev and drop them from the
 * production bundle.
 */
function stripDevOnlyPublicAssets(): Plugin {
  const devOnlyAssets = ['dashboard.html', 'ig.js', 'infinite-game.js'];
  let outDir = 'dist';

  return {
    name: 'psl-strip-dev-only-public-assets',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      for (const asset of devOnlyAssets) {
        const target = path.join(outDir, asset);
        try {
          if (fs.existsSync(target)) fs.rmSync(target);
        } catch (err) {
          this.warn(`could not strip dev-only asset ${asset}: ${err}`);
        }
      }
    },
  };
}

export default defineConfig(() => {
  const tauriHost = process.env.TAURI_DEV_HOST;
  // Stamped from package.json at build time so the number on screen is the
  // number that was built. There was no way to tell one installer from another
  // from inside the game, which made "am I running the latest build?" a
  // question nobody could answer.
  const appVersion = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
  ).version;
  const hmr =
    process.env.DISABLE_HMR === 'true'
      ? false
      : tauriHost
        ? {
            protocol: 'ws',
            host: tauriHost,
            port: 1421,
          }
        : true;
  return {
    define: { __APP_VERSION__: JSON.stringify(appVersion) },
    plugins: [
      react(),
      tailwindcss(),
      telemetryMirrorPlugin(),
      tuningRelayPlugin(),
      stripDevOnlyPublicAssets(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    server: {
      host: tauriHost || undefined,
      port: 3001,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr,
      allowedHosts: ['localhost', '127.0.0.1', 'gakeen'],
      watch: {
        ignored: [
          '**/src-tauri/**',
          '**/match-results.json',
          '**/telemetry-snapshots.json',
          '**/telemetry-snapshots.ndjson',
          '**/telemetry-batches.ndjson',
          '**/shot-events.ndjson',
          '**/keeper-experience.ndjson',
          '**/matches.json',
          '**/tmp_match.json',
          '**/final_sim_dump.txt',
          '**/last5matches.json',
          '**/atlanta_sanjose_match.json',
          '**/scripts/**',
          '**/psl.db',
          '**/psl.db-wal',
          '**/psl.db-shm',
          '**/keeper-model/**',
          '**/telemetry/**',
          '**/dist/**',
        ],
      },
    },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react',
        'react-dom/client',
        'react/jsx-runtime',
        'lucide-react',
        'three',
        'troika-three-text',
        'dexie',
      ],
    },
    build: {
      target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'es2020',
      minify: process.env.TAURI_ENV_DEBUG ? false : ('esbuild' as const),
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  };
});

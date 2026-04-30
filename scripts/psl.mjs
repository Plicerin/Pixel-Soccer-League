#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const VERSION = '0.1.0';
const ROOT = path.resolve(import.meta.dirname, '..');

function parse(argv) {
  const globals = { json: false };
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') globals.json = true;
    else if (arg === '--help' || arg === '-h') globals.help = true;
    else if (arg === '--version' || arg === '-v') globals.version = true;
    else args.push(arg);
  }
  return { globals, args };
}

function parseFlags(args) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (['refresh', 'all'].includes(key)) flags[key] = true;
    else flags[key] = args[++i];
  }
  return { flags, positionals };
}

function json(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function print(value, asJson) {
  if (asJson) {
    json(value);
    return;
  }
  if (value.ok === false) {
    process.stdout.write(`error: ${value.error.message}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value.data ?? value, null, 2)}\n`);
}

function fail(message, code = 'ERROR', extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.extra = extra;
  return error;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonOrNull(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function statMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (entry.isFile() && predicate(full, entry)) out.push(full);
  }
  return out;
}

function newestFile(paths) {
  return paths.sort((a, b) => statMtimeMs(b) - statMtimeMs(a))[0] || '';
}

function newestNightlyStatus() {
  return newestFile(walk(path.join(ROOT, 'telemetry'), (file) => path.basename(file) === 'overnight-status.json'));
}

function runNodeScript(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function help() {
  process.stdout.write(`psl ${VERSION}

Usage:
  psl [--json] doctor
  psl [--json] status nightly [--dir telemetry/nightly-...]
  psl [--json] telemetry latest
  psl [--json] telemetry analyze
  psl [--json] kpi scoreboard [--refresh] [--recipe name]
  psl [--json] matches recent [--limit n]
  psl [--json] tuning summarize

Notes:
  - This CLI is read-only by default.
  - It never starts simulations or browser smoke tests.
  - telemetry analyze and kpi scoreboard only run existing analyzer/report scripts.
`);
}

async function doctor(asJson) {
  const checks = [
    ['package.json', exists('package.json')],
    ['scripts/telemetry-analyze-latest.mjs', exists('scripts/telemetry-analyze-latest.mjs')],
    ['scripts/iterate-overnight.mjs', exists('scripts/iterate-overnight.mjs')],
    ['scripts/tuning-scoreboard.mjs', exists('scripts/tuning-scoreboard.mjs')],
    ['telemetry/latest-report.json', exists('telemetry/latest-report.json')],
    ['telemetry/tuning-scoreboard/latest-scoreboard.json', exists('telemetry/tuning-scoreboard/latest-scoreboard.json')],
  ].map(([name, ok]) => ({ name, ok }));
  const nightlyStatus = newestNightlyStatus();
  checks.push({ name: 'latest overnight-status.json', ok: Boolean(nightlyStatus), path: nightlyStatus || null });
  print({ ok: true, data: { version: VERSION, root: ROOT, checks } }, asJson);
}

async function status(args, asJson) {
  const [sub, ...rest] = args;
  if (sub !== 'nightly') throw fail('Usage: status nightly [--dir telemetry/nightly-...]', 'USAGE');
  const { flags } = parseFlags(rest);
  const statusPath = flags.dir
    ? path.resolve(ROOT, flags.dir, 'overnight-status.json')
    : newestNightlyStatus();
  if (!statusPath) throw fail('No overnight-status.json found under telemetry', 'NOT_FOUND');
  const statusJson = readJson(statusPath);
  const logPath = path.join(path.dirname(statusPath), 'runner.out.log');
  const logTail = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, 'utf8').split(/\r?\n/u).filter(Boolean).slice(-10)
    : [];
  print({
    ok: true,
    data: {
      statusPath,
      logPath: fs.existsSync(logPath) ? logPath : null,
      state: statusJson.state,
      completedCycles: statusJson.completedCycles,
      totalCycles: statusJson.totalCycles,
      currentCycle: statusJson.currentCycle,
      currentPhase: statusJson.currentPhase,
      currentFixtures: statusJson.currentFixtures || [],
      lastCompletedScore: statusJson.lastCompletedScore,
      failedCycles: statusJson.failedCycles || [],
      error: statusJson.error || null,
      updatedAt: statusJson.updatedAt,
      logTail,
    },
  }, asJson);
}

function summarizeReport(report, source) {
  const global = report.baselines?.global || {};
  return {
    source,
    match: report.match || null,
    kpis: {
      overall: report.kpis?.overall?.score ?? null,
      baselineFit: report.kpis?.baselineFit?.score ?? null,
      soccerStructure: report.kpis?.soccerStructure?.score ?? null,
      tuningEfficiency: report.kpis?.tuningEfficiency?.score ?? null,
    },
    baselineDrift: {
      goals: drift(global.totalGoals),
      shots: drift(global.totalShots),
      shotsOnTarget: drift(global.totalShotsOnTarget),
      corners: drift(global.totalCorners),
    },
    recommendations: report.recommendations || [],
  };
}

function drift(row) {
  if (!row) return null;
  return {
    simulated: row.simulated ?? null,
    baseline: row.baseline ?? null,
    drift: typeof row.simulated === 'number' && typeof row.baseline === 'number'
      ? Math.round((row.simulated - row.baseline) * 100) / 100
      : null,
  };
}

async function telemetry(args, asJson) {
  const [sub] = args;
  if (sub === 'latest') {
    const source = path.join(ROOT, 'telemetry', 'latest-report.json');
    const report = readJson(source);
    print({ ok: true, data: summarizeReport(report, source) }, asJson);
    return;
  }
  if (sub === 'analyze') {
    const result = await runNodeScript('scripts/telemetry-analyze-latest.mjs', ['--latest']);
    const source = path.join(ROOT, 'telemetry', 'latest-report.json');
    print({
      ok: result.code === 0,
      data: {
        code: result.code,
        report: fs.existsSync(source) ? summarizeReport(readJson(source), source) : null,
        stdoutTail: result.stdout.split(/\r?\n/u).filter(Boolean).slice(-20),
        stderrTail: result.stderr.split(/\r?\n/u).filter(Boolean).slice(-20),
      },
    }, asJson);
    if (result.code !== 0) process.exitCode = result.code;
    return;
  }
  throw fail('Usage: telemetry latest|analyze', 'USAGE');
}

async function kpi(args, asJson) {
  const [sub, ...rest] = args;
  if (sub !== 'scoreboard') throw fail('Usage: kpi scoreboard [--refresh] [--recipe name]', 'USAGE');
  const { flags } = parseFlags(rest);
  if (flags.refresh) {
    const scriptArgs = [];
    if (flags.recipe) scriptArgs.push('--recipe', flags.recipe);
    const result = await runNodeScript('scripts/tuning-scoreboard.mjs', scriptArgs);
    if (result.code !== 0) {
      print({
        ok: false,
        error: {
          code: 'SCOREBOARD_FAILED',
          message: 'tuning-scoreboard failed',
          stdoutTail: result.stdout.split(/\r?\n/u).filter(Boolean).slice(-20),
          stderrTail: result.stderr.split(/\r?\n/u).filter(Boolean).slice(-20),
        },
      }, asJson);
      process.exitCode = result.code;
      return;
    }
  }
  const source = path.join(ROOT, 'telemetry', 'tuning-scoreboard', 'latest-scoreboard.json');
  const scoreboard = readJson(source);
  const rows = Object.values(scoreboard.rows || {});
  print({
    ok: true,
    data: {
      source,
      generatedAt: scoreboard.generatedAt,
      decision: scoreboard.recipe?.decision || null,
      recipe: scoreboard.recipe || null,
      counts: countRows(rows),
      red: rows.filter((row) => row.status === 'red'),
      watch: rows.filter((row) => row.status === 'watch'),
      green: rows.filter((row) => row.status === 'green'),
      nextRecipes: scoreboard.nextRecipes || [],
    },
  }, asJson);
}

function countRows(rows) {
  return rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    acc[`${row.tier}:${row.status}`] = (acc[`${row.tier}:${row.status}`] || 0) + 1;
    return acc;
  }, {});
}

async function matches(args, asJson) {
  const [sub, ...rest] = args;
  if (sub !== 'recent') throw fail('Usage: matches recent [--limit n]', 'USAGE');
  const { flags } = parseFlags(rest);
  const limit = Math.max(1, Number(flags.limit || 10));
  const files = walk(path.join(ROOT, 'telemetry'), (file) => {
    const name = path.basename(file);
    return name === 'latest-report.json' || /cycle-\d+-analysis\.json$/u.test(name);
  });
  const reports = files
    .map((file) => ({ file, report: readJsonOrNull(file), mtimeMs: statMtimeMs(file) }))
    .filter((entry) => entry.report?.match)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit)
    .map(({ file, report, mtimeMs }) => ({
      file,
      modifiedAt: new Date(mtimeMs).toISOString(),
      match: report.match,
      kpis: {
        overall: report.kpis?.overall?.score ?? null,
        baselineFit: report.kpis?.baselineFit?.score ?? null,
        soccerStructure: report.kpis?.soccerStructure?.score ?? null,
        tuningEfficiency: report.kpis?.tuningEfficiency?.score ?? null,
      },
    }));
  print({ ok: true, data: { reports } }, asJson);
}

async function tuning(args, asJson) {
  const [sub] = args;
  if (sub !== 'summarize') throw fail('Usage: tuning summarize', 'USAGE');
  const source = path.join(ROOT, 'telemetry', 'tuning-scoreboard', 'latest-scoreboard.json');
  const scoreboard = readJson(source);
  const rows = Object.values(scoreboard.rows || {});
  const summary = {
    source,
    decision: scoreboard.recipe?.decision || null,
    improved: rows.filter((row) => row.movement === 'better').map(rowSummary),
    regressed: rows.filter((row) => row.movement === 'worse').map(rowSummary),
    flatProblems: rows.filter((row) => row.movement === 'flat' && row.status !== 'green').map(rowSummary),
    frozenWins: rows.filter((row) => row.frozen).map(rowSummary),
    nextRecipes: scoreboard.nextRecipes || [],
  };
  print({ ok: true, data: summary }, asJson);
}

function rowSummary(row) {
  return {
    key: row.key,
    tier: row.tier,
    value: row.value,
    status: row.status,
    movement: row.movement,
    target: row.target,
    frozen: row.frozen,
  };
}

async function main() {
  const { globals, args } = parse(process.argv.slice(2));
  if (globals.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (globals.help || args.length === 0) {
    help();
    return;
  }
  const [command, ...rest] = args;
  if (command === 'doctor') await doctor(globals.json);
  else if (command === 'status') await status(rest, globals.json);
  else if (command === 'telemetry') await telemetry(rest, globals.json);
  else if (command === 'kpi') await kpi(rest, globals.json);
  else if (command === 'matches') await matches(rest, globals.json);
  else if (command === 'tuning') await tuning(rest, globals.json);
  else throw fail(`Unknown command: ${command}`, 'USAGE');
}

main().catch((error) => {
  print({
    ok: false,
    error: {
      code: error.code || 'ERROR',
      message: error.message || String(error),
      ...error.extra,
    },
  }, process.argv.includes('--json'));
  process.exit(1);
});

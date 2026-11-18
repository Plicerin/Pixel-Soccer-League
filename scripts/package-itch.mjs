#!/usr/bin/env node
/**
 * Build the itch.io HTML5 package.
 *
 * itch serves an upload's index.html from a random CDN subpath
 * (html-classic.itch.zone/html/<id>/) inside an iframe, with no server routes.
 * So the bundle is built with a relative base ("./") and the web-build flag
 * that switches off the dev-server tooling (src/runtimeEnv.ts), then checked
 * against itch's limits and zipped with index.html at the root.
 *
 * Usage:
 *   npm run build:itch              # build dist-itch/ and releases/*-web.zip
 *   npm run build:itch -- --no-zip  # build and check only
 *
 * Upload with butler (https://itch.io/docs/butler/):
 *   butler push releases/pixel-soccer-league-<v>-web.zip <user>/<game>:html5 --userversion <v>
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-itch');
const RELEASES = path.join(ROOT, 'releases');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const zipPath = path.join(RELEASES, `pixel-soccer-league-${version}-web.zip`);
const makeZip = !process.argv.includes('--no-zip');

// itch.io HTML5 limits: https://itch.io/docs/creators/html5
const MAX_FILES = 1000;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const MAX_FILE_BYTES = 200 * 1024 * 1024;

// In public/ but never loaded by the client: source art, unused sound takes,
// the MLS crests (MLS_TEAM_LOGOS is empty) and weights read only by the
// offline trainers in src/ai/. They stay in the repo; they just don't ship.
// Search src/ for both spellings before adding a name here: the splash logo
// is requested as "Pixel%20Soccer%20League2.png", which a plain search misses.
const UNUSED_PUBLIC = [
  'applause.wav',
  'crowd goal.mp3',
  'goal.mp3',
  'post.mp3',
  'assets/menu.png',
  'assets/Pixel Soccer League.png',
  'assets/player-frame6-closeup.png',
  'assets/logos',
  'assets/keeper-model',
  'assets/outfield-model',
];

function fail(message) {
  console.error(`package-itch: ${message}`);
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// 1. Build.
console.log(`package-itch: building ${version} with base ./ and PSL_WEB_BUILD=1`);
execFileSync(
  process.execPath,
  [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', OUT, '--emptyOutDir'],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PSL_PAGES_BASE: './', PSL_WEB_BUILD: '1' } },
);

// 2. Drop what the client never loads, refusing anything the client source
// still names (plain or URL-encoded). src/ai/ is the offline trainers.
const clientSource = walk(path.join(ROOT, 'src'))
  .filter((file) => !file.includes(`${path.sep}ai${path.sep}`) && /\.(tsx?|jsx?|css)$/.test(file))
  .concat(path.join(ROOT, 'index.html'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
for (const rel of UNUSED_PUBLIC) {
  const name = rel.split('/').at(-1);
  const needles = path.extname(name) ? [name, encodeURI(name)] : [`${name}/`];
  const hit = needles.find((needle) => clientSource.includes(`/${needle}`));
  if (hit) fail(`${rel} is listed as unused but the client references "${hit}"`);
}
for (const rel of UNUSED_PUBLIC) {
  fs.rmSync(path.join(OUT, rel), { recursive: true, force: true });
}

// 3. Check the result is something itch can serve.
const indexHtml = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const rootAbsolute = [...indexHtml.matchAll(/\b(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
if (rootAbsolute.length) fail(`index.html still has root-absolute paths: ${rootAbsolute.join(', ')}`);

const bundle = fs.readdirSync(path.join(OUT, 'assets')).filter((f) => f.endsWith('.js'));
const devRoutesStamped = bundle.some((f) =>
  /__PSL_WEB_BUILD__/.test(fs.readFileSync(path.join(OUT, 'assets', f), 'utf8')),
);
if (devRoutesStamped) fail('__PSL_WEB_BUILD__ was not replaced at build time');

const files = walk(OUT);
let total = 0;
for (const file of files) {
  const size = fs.statSync(file).size;
  total += size;
  if (size > MAX_FILE_BYTES) fail(`${path.relative(OUT, file)} is over itch's 200 MB per-file limit`);
}
if (files.length > MAX_FILES) fail(`${files.length} files, over itch's ${MAX_FILES}-file limit`);
if (total > MAX_TOTAL_BYTES) fail(`${(total / 1048576).toFixed(1)} MB, over itch's 500 MB limit`);
console.log(`package-itch: ${files.length} files, ${(total / 1048576).toFixed(1)} MB in dist-itch/`);

if (!makeZip) process.exit(0);

// 4. Zip with index.html at the root. A small deflate writer instead of a
// shell tool: Compress-Archive on Windows PowerShell 5 writes backslash
// entry names, which itch's unzip does not treat as folders.
const entries = [];
const chunks = [];
let offset = 0;
const dosTime = (() => {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
})();

for (const file of files.sort()) {
  const name = Buffer.from(path.relative(OUT, file).split(path.sep).join('/'), 'utf8');
  const raw = fs.readFileSync(file);
  const deflated = zlib.deflateRawSync(raw, { level: 9 });
  const stored = deflated.length >= raw.length;
  const data = stored ? raw : deflated;
  const crc = zlib.crc32(raw);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(stored ? 0 : 8, 8);
  local.writeUInt16LE(dosTime.time, 10);
  local.writeUInt16LE(dosTime.date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, name, data);
  entries.push({ name, crc, method: stored ? 0 : 8, compressed: data.length, size: raw.length, offset });
  offset += local.length + name.length + data.length;
}

const central = [];
for (const e of entries) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(e.method, 10);
  header.writeUInt16LE(dosTime.time, 12);
  header.writeUInt16LE(dosTime.date, 14);
  header.writeUInt32LE(e.crc, 16);
  header.writeUInt32LE(e.compressed, 20);
  header.writeUInt32LE(e.size, 24);
  header.writeUInt16LE(e.name.length, 28);
  header.writeUInt32LE(e.offset, 42);
  central.push(header, e.name);
}
const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(RELEASES, { recursive: true });
fs.writeFileSync(zipPath, Buffer.concat([...chunks, ...central, end]));
console.log(`package-itch: wrote ${path.relative(ROOT, zipPath)} (${(fs.statSync(zipPath).size / 1048576).toFixed(1)} MB)`);

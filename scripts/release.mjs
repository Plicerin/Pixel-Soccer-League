#!/usr/bin/env node
/**
 * Version the desktop build.
 *
 * The NSIS artifact name embeds the version (`Pixel Soccer League_<v>_x64-setup.exe`),
 * so building twice at the same version silently overwrites the previous
 * installer and leaves no way to tell two builds apart. This bumps every
 * version source in lockstep, then builds.
 *
 * Usage:
 *   npm run release            # patch bump + build
 *   npm run release -- minor   # minor bump + build
 *   npm run release -- 1.2.3   # explicit version + build
 *   npm run release -- --no-build patch
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = path.join(ROOT, 'package.json');
const CONF = path.join(ROOT, 'src-tauri', 'tauri.conf.json');
const CARGO = path.join(ROOT, 'src-tauri', 'Cargo.toml');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function currentVersion() {
  const version = JSON.parse(readFileSync(PKG, 'utf8')).version;
  if (!SEMVER.test(version)) fail(`package.json version "${version}" is not x.y.z`);
  return version;
}

function nextVersion(current, spec) {
  if (SEMVER.test(spec)) return spec;
  const [major, minor, patch] = current.match(SEMVER).slice(1).map(Number);
  if (spec === 'major') return `${major + 1}.0.0`;
  if (spec === 'minor') return `${major}.${minor + 1}.0`;
  if (spec === 'patch') return `${major}.${minor}.${patch + 1}`;
  fail(`unknown bump "${spec}" (use major | minor | patch | x.y.z)`);
}

/** Replace the version in the [package] table only, never a dependency's. */
function writeCargoVersion(version) {
  const source = readFileSync(CARGO, 'utf8');
  const packageStart = source.indexOf('[package]');
  if (packageStart < 0) fail('Cargo.toml has no [package] table');
  const nextTable = source.indexOf('\n[', packageStart + 1);
  const end = nextTable < 0 ? source.length : nextTable;
  const head = source.slice(packageStart, end);
  const replaced = head.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
  if (replaced === head) fail('Cargo.toml [package] has no version key');
  writeFileSync(CARGO, source.slice(0, packageStart) + replaced + source.slice(end));
}

function writeJsonVersion(file, version) {
  const raw = readFileSync(file, 'utf8');
  const updated = raw.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`);
  if (updated === raw) fail(`${path.basename(file)} has no version field`);
  writeFileSync(file, updated);
}

const args = process.argv.slice(2);
const noBuild = args.includes('--no-build');
const buildCurrent = args.includes('--current');
const spec = args.find((arg) => !arg.startsWith('--')) || 'patch';

const current = currentVersion();
const next = buildCurrent ? current : nextVersion(current, spec);
if (!buildCurrent && next === current) fail(`version is already ${next}`);

const artifact = path.join(
  ROOT, 'src-tauri', 'target', 'release', 'bundle', 'nsis',
  `Pixel Soccer League_${next}_x64-setup.exe`,
);
if (!buildCurrent && existsSync(artifact)) fail(`${path.basename(artifact)} already exists; pick another version`);

if (buildCurrent) {
  console.log(`release: building at current version ${next} (no bump)`);
} else {
  writeJsonVersion(PKG, next);
  writeJsonVersion(CONF, next);
  writeCargoVersion(next);
  console.log(`release: ${current} -> ${next} (package.json, tauri.conf.json, Cargo.toml)`);
}

if (noBuild) process.exit(0);

// Run the CLI's JS entry with this same node binary. Going through the npx
// shim needs shell:true on Windows (DEP0190), and Node >=20 refuses to spawn a
// .cmd without it -- this sidesteps both.
const tauriCli = path.join(ROOT, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
if (!existsSync(tauriCli)) fail(`cannot find ${tauriCli}; run npm install`);
execFileSync(process.execPath, [tauriCli, 'build'], { cwd: ROOT, stdio: 'inherit' });

if (!existsSync(artifact)) fail(`build finished but ${path.basename(artifact)} is missing`);
console.log(`\nrelease: built ${artifact}`);

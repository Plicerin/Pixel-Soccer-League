const Database = require("better-sqlite3");
const db = new Database("psl.db", { readonly: true });
const row = db.prepare("SELECT id, ts, payload_json FROM live_tuning WHERE id = 1").get();
if (!row) { console.log("NO_ROW"); process.exit(0); }
let p = {};
try { p = JSON.parse(row.payload_json || "{}"); } catch {}
const s = p.snapshot || {};
const b = p.bundle || {};
console.log(JSON.stringify({ id: row.id, ts: row.ts, teamA: b?.teamA?.name || null, teamB: b?.teamB?.name || null, isLive: s?.isLive ?? null, phase: s?.phase ?? null, elapsedInHalf: s?.elapsedInHalf ?? null, scoreA: s?.scoreA ?? null, scoreB: s?.scoreB ?? null }, null, 2));

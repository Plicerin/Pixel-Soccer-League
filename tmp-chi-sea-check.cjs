const Database = require("better-sqlite3");
const db = new Database("psl.db", { readonly: true });
const rows = db.prepare("SELECT timestamp, team_a_name, team_b_name, score_a, score_b, bundle_json FROM match_results WHERE (lower(team_a_name) LIKE '%chicago%' AND lower(team_b_name) LIKE '%seattle%') OR (lower(team_a_name) LIKE '%seattle%' AND lower(team_b_name) LIKE '%chicago%') ORDER BY timestamp DESC LIMIT 3").all();
const out = rows.map(r => {
  let bundle = {};
  try { bundle = JSON.parse(r.bundle_json || '{}'); } catch {}
  const alerts = Array.isArray(bundle.ballJumpAlerts) ? bundle.ballJumpAlerts : [];
  const suspicious = alerts.filter(a => a && (a.suspiciousJump || a.suspiciousCenterSnap || a.suspiciousDeadballJump));
  const maxJump = alerts.reduce((m, a) => Math.max(m, Number(a?.jumpXZ)||0), 0);
  return {
    timestamp: r.timestamp,
    teams: `${r.team_a_name} vs ${r.team_b_name}`,
    score: `${r.score_a}-${r.score_b}`,
    alertCount: alerts.length,
    suspiciousCount: suspicious.length,
    maxJumpXZ: maxJump,
    lastAlerts: alerts.slice(-5),
  };
});
console.log(JSON.stringify(out,null,2));

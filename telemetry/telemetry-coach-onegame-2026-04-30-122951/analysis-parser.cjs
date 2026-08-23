const fs = require('fs');
const reportPath = process.argv[1];
const outPath = process.argv[2];
const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const games = r.results || [];
const events = games.flatMap((g, i) => ((g.tuning && g.tuning.events) || []).map(e => ({...e, game: i + 1})));
const count = (type, field) => { const m = {}; for (const e of events.filter(e => e.type === type)) { const v = String(field ? ((e.detail || {})[field] ?? 'null') : e.type); m[v] = (m[v] || 0) + 1; } return Object.fromEntries(Object.entries(m).sort((a,b)=>b[1]-a[1])); };
const sum = (fn) => games.reduce((a,g)=>a+fn(g),0);
const out = {
  status: r.status, gamesCompleted: r.gamesCompleted,
  totals: { games: games.length, goals: sum(g=>g.scoreA+g.scoreB), shots: sum(g=>g.shotsA+g.shotsB), sog: sum(g=>g.sogA+g.sogB), corners: sum(g=>g.cornersA+g.cornersB) },
  fixtures: games.map((g,i)=>({ game: i+1, teamA: g.teamA, teamB: g.teamB, score: ${g.scoreA}-, shots: ${g.shotsA}-, sog: ${g.sogA}-, corners: ${g.cornersA}- })),
  telemetryCoach: {
    gamePlan: count('TELEMETRY_COACH_GAME_PLAN'), fullControl: events.filter(e=>e.type==='TELEMETRY_COACH_FULL_CONTROL').length,
    deliverySuppressed: count('TELEMETRY_COACH_DELIVERY_SUPPRESSED', 'reason'), shotSuppressed: count('TELEMETRY_COACH_SHOT_SUPPRESSED', 'reason')
  },
  deliveries: { roles: count('PATTERN_DELIVERY_EXECUTED', 'targetRole'), styles: count('PATTERN_DELIVERY_EXECUTED', 'style') },
  shots: { blocked: events.filter(e=>e.type==='SHOT_BLOCKED').length, byRole: count('SHOT', null), blockedSecondary: count('SHOT_BLOCKED', 'secondaryOutcome') }
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

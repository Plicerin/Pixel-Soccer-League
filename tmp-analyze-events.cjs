const fs = require('fs');
const p = 'psl-tuning-Chicago Fire-vs-Seattle Sounders-1775861802309.json';
const d = JSON.parse(fs.readFileSync(p,'utf8'));
const events = Array.isArray(d.events)?d.events:[];
const byType = {};
const byTeamType = {};
const shots = [];
const passes = [];
for (const e of events) {
  const t = e.type || 'UNKNOWN';
  const tm = e.team || '';
  byType[t] = (byType[t]||0)+1;
  const k = `${tm}:${t}`;
  byTeamType[k] = (byTeamType[k]||0)+1;
  if (t === 'SHOT') {
    shots.push({ team: tm, distY: e.detail?.distToGoalYards, inBox: e.detail?.insidePenaltyArea, lane: e.detail?.inShootingLane, pressure: e.detail?.closePressure, style: e.detail?.style });
  }
  if (t === 'PASS') {
    passes.push({ team: tm, length: e.detail?.distance, prog: e.detail?.isProgressive, long: e.detail?.isLong, underPress: e.detail?.underPressure, completed: e.detail?.completed });
  }
}
function avg(arr, key){ const vals=arr.map(x=>Number(x[key])).filter(v=>Number.isFinite(v)); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null; }
const shotSummary = {
  total: shots.length,
  byTeam: shots.reduce((m,s)=>{m[s.team]=(m[s.team]||0)+1;return m;},{}),
  avgDistYardsByTeam: ['A','B'].reduce((m,t)=>{const a=shots.filter(s=>s.team===t); m[t]=avg(a,'distY'); return m;},{}),
  inBoxRateByTeam: ['A','B'].reduce((m,t)=>{const a=shots.filter(s=>s.team===t); const n=a.length||1; m[t]=a.filter(s=>s.inBox).length/n; return m;},{}),
  laneRateByTeam: ['A','B'].reduce((m,t)=>{const a=shots.filter(s=>s.team===t); const n=a.length||1; m[t]=a.filter(s=>s.lane).length/n; return m;},{}),
  avgPressureByTeam: ['A','B'].reduce((m,t)=>{const a=shots.filter(s=>s.team===t); m[t]=avg(a,'pressure'); return m;},{}),
};
const passSummary = {
  total: passes.length,
  byTeam: passes.reduce((m,s)=>{m[s.team]=(m[s.team]||0)+1;return m;},{}),
  avgLenByTeam: ['A','B'].reduce((m,t)=>{const a=passes.filter(s=>s.team===t); m[t]=avg(a,'length'); return m;},{}),
  progressiveRateByTeam: ['A','B'].reduce((m,t)=>{const a=passes.filter(s=>s.team===t); const n=a.length||1; m[t]=a.filter(s=>s.prog).length/n; return m;},{}),
  longRateByTeam: ['A','B'].reduce((m,t)=>{const a=passes.filter(s=>s.team===t); const n=a.length||1; m[t]=a.filter(s=>s.long).length/n; return m;},{}),
  underPressureRateByTeam: ['A','B'].reduce((m,t)=>{const a=passes.filter(s=>s.team===t); const n=a.length||1; m[t]=a.filter(s=>s.underPress).length/n; return m;},{}),
  completionFromEventsByTeam: ['A','B'].reduce((m,t)=>{const a=passes.filter(s=>s.team===t); const n=a.length||1; m[t]=a.filter(s=>s.completed).length/n; return m;},{}),
};
console.log(JSON.stringify({byType, byTeamType, shotSummary, passSummary, transitions: d.transitions||[]},null,2));

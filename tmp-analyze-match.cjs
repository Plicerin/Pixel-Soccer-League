const fs = require('fs');
const p = 'psl-tuning-Chicago Fire-vs-Seattle Sounders-1775861802309.json';
const d = JSON.parse(fs.readFileSync(p,'utf8'));
const out = {
  topKeys: Object.keys(d),
  teamA: { name: d.teamA?.name, score: d.teamA?.score, formation: d.teamA?.formation, shots: d.teamA?.shots, shotsOnTarget: d.teamA?.shotsOnTarget, passes: d.teamA?.passes, passesCompleted: d.teamA?.passesCompleted, tackles: d.teamA?.tackles, clearances: d.teamA?.clearances, fouls: d.teamA?.fouls, corners: d.teamA?.corners, throwIns: d.teamA?.throwIns, possession: d.teamA?.possession, saves: d.teamA?.saves },
  teamB: { name: d.teamB?.name, score: d.teamB?.score, formation: d.teamB?.formation, shots: d.teamB?.shots, shotsOnTarget: d.teamB?.shotsOnTarget, passes: d.teamB?.passes, passesCompleted: d.teamB?.passesCompleted, tackles: d.teamB?.tackles, clearances: d.teamB?.clearances, fouls: d.teamB?.fouls, corners: d.teamB?.corners, throwIns: d.teamB?.throwIns, possession: d.teamB?.possession, saves: d.teamB?.saves },
  counts: {
    events: Array.isArray(d.events)?d.events.length:0,
    transitions: Array.isArray(d.transitions)?d.transitions.length:0,
    shapeA: Array.isArray(d.shapeA)?d.shapeA.length:0,
    shapeB: Array.isArray(d.shapeB)?d.shapeB.length:0,
    goalLog: Array.isArray(d.goalLog)?d.goalLog.length:0,
    ballJumpAlerts: Array.isArray(d.ballJumpAlerts)?d.ballJumpAlerts.length:0,
    ballTrackTail: Array.isArray(d.ballTrackTail)?d.ballTrackTail.length:0,
  },
  metadata: d.metadata || null,
};
console.log(JSON.stringify(out,null,2));

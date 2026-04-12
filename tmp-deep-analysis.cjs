const fs = require('fs');
const d = JSON.parse(fs.readFileSync('psl-tuning-Chicago Fire-vs-Seattle Sounders-1775861802309.json','utf8'));
const events = d.events || [];

// Possession proxy
const passA = events.filter(e=>e.type==='PASS'&&e.team==='A').length;
const passB = events.filter(e=>e.type==='PASS'&&e.team==='B').length;
const totalPasses = passA+passB;
console.log('Possession proxy: A='+(100*passA/totalPasses).toFixed(1)+'% B='+(100*passB/totalPasses).toFixed(1)+'%');

// Pass direction
const passes = events.filter(e=>e.type==='PASS');
const fwdA = passes.filter(e=>e.team==='A'&&(e.detail&&e.detail.progress>0)).length;
const bwdA = passes.filter(e=>e.team==='A'&&(e.detail&&e.detail.progress<0)).length;
const fwdB = passes.filter(e=>e.team==='B'&&(e.detail&&e.detail.progress>0)).length;
const bwdB = passes.filter(e=>e.team==='B'&&(e.detail&&e.detail.progress<0)).length;
console.log('A passes: fwd='+fwdA+' bwd='+bwdA+' ('+Math.round(100*fwdA/passA)+'% fwd)');
console.log('B passes: fwd='+fwdB+' bwd='+bwdB+' ('+Math.round(100*fwdB/passB)+'% fwd)');

// Pass schema
console.log('\nPass sample schema:');
console.log(JSON.stringify(passes[0]&&passes[0].detail));

// Shot timing
const halfDur = (d.metadata&&d.metadata.halfDuration)||300;
console.log('\nShot timing:');
events.filter(e=>e.type==='SHOT').forEach(function(s) {
  var min = s.half===1 ? (s.t/halfDur*45).toFixed(0) : (45+(s.t/halfDur*45)).toFixed(0);
  console.log('H'+s.half+' ~'+min+"' "+s.team+' '+s.role+' dist='+s.detail.distToGoal+' style='+s.detail.style+' onTarget='+(s.detail.onTarget||false));
});

// Interceptions by role
const ints = events.filter(e=>e.type==='INTERCEPTION');
const intRoles = {};
ints.forEach(function(i){ intRoles[i.role]=(intRoles[i.role]||0)+1; });
console.log('\nInterceptions by role:', JSON.stringify(intRoles));

// Clearances by role
const clears = events.filter(e=>e.type==='CLEARANCE');
const clearRoles = {};
clears.forEach(function(c){ clearRoles[c.role]=(clearRoles[c.role]||0)+1; });
console.log('Clearances by role:', JSON.stringify(clearRoles));

// Transitions
console.log('\nRaw transitions:');
var transitions = d.transitions||[];
transitions.forEach(function(t,i){ console.log(i, JSON.stringify(t)); });

// Shape sample
var shapeA = d.shapeA||[];
var shapeB = d.shapeB||[];
console.log('\nshapeA[0]:', JSON.stringify(shapeA[0]));
console.log('shapeB[0]:', JSON.stringify(shapeB[0]));
console.log('shapeA count:', shapeA.length, 'shapeB count:', shapeB.length);

// Ball jump alerts
var alerts = d.ballJumpAlerts||[];
console.log('\nBall jump alerts:', alerts.length, 'suspicious:', alerts.filter(function(a){return a.suspicious;}).length);
alerts.forEach(function(a){ console.log(JSON.stringify(a)); });

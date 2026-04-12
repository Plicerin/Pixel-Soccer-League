const fs = require('fs');
const d = JSON.parse(fs.readFileSync('psl-tuning-Chicago Fire-vs-Seattle Sounders-1775861802309.json','utf8'));
const shapeA = d.shapeA || [];
const shapeB = d.shapeB || [];

// Average shape stats across match
function avg(arr) { return arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0; }

const aAvgX     = avg(shapeA.map(s=>s.avgX));
const aWidth    = avg(shapeA.map(s=>s.width));
const aDepth    = avg(shapeA.map(s=>s.depth));
const aCompact  = avg(shapeA.map(s=>s.compactness));
const aHighLine = avg(shapeA.map(s=>s.highLine));
const aLowLine  = avg(shapeA.map(s=>s.lowLine));

const bAvgX     = avg(shapeB.map(s=>s.avgX));
const bWidth    = avg(shapeB.map(s=>s.width));
const bDepth    = avg(shapeB.map(s=>s.depth));
const bCompact  = avg(shapeB.map(s=>s.compactness));
const bHighLine = avg(shapeB.map(s=>s.highLine));
const bLowLine  = avg(shapeB.map(s=>s.lowLine));

console.log('=== TEAM SHAPE AVERAGES ===');
console.log('         avgX   width  depth  compact  highLine  lowLine');
console.log('A:  ',aAvgX.toFixed(1),aWidth.toFixed(1),aDepth.toFixed(1),aCompact.toFixed(1),aHighLine.toFixed(1),aLowLine.toFixed(1));
console.log('B:  ',bAvgX.toFixed(1),bWidth.toFixed(1),bDepth.toFixed(1),bCompact.toFixed(1),bHighLine.toFixed(1),bLowLine.toFixed(1));

// Shape over time - 10-sample buckets
console.log('\n=== TEAM A avgX OVER TIME (10-snapshot buckets) ===');
for (let i = 0; i < shapeA.length; i += 12) {
  const bucket = shapeA.slice(i, i+12);
  const meanX = avg(bucket.map(s=>s.avgX));
  const t = bucket[0].t;
  console.log('t='+t.toFixed(0)+'s avgX='+meanX.toFixed(1));
}

console.log('\n=== TEAM B avgX OVER TIME ===');
for (let i = 0; i < shapeB.length; i += 12) {
  const bucket = shapeB.slice(i, i+12);
  const meanX = avg(bucket.map(s=>s.avgX));
  const t = bucket[0].t;
  console.log('t='+t.toFixed(0)+'s avgX='+meanX.toFixed(1));
}

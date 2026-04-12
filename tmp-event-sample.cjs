const fs = require('fs');
const d = JSON.parse(fs.readFileSync('psl-tuning-Chicago Fire-vs-Seattle Sounders-1775861802309.json','utf8'));
const events = Array.isArray(d.events)?d.events:[];
const pass = events.find(e=>e.type==='PASS');
const shot = events.find(e=>e.type==='SHOT');
console.log(JSON.stringify({pass,shot},null,2));

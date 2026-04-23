import json
from pathlib import Path

path = Path('match-results.json')
with path.open('r', encoding='utf-8') as f:
    data = json.load(f)

matches = [m for m in data if (m.get('teamAName')=='Seattle Sounders' and m.get('teamBName')=='LAFC') or (m.get('teamAName')=='LAFC' and m.get('teamBName')=='Seattle Sounders')]
print('matches in match-results:', len(matches))
for m in matches[:10]:
    print('session', m.get('session_id') or m.get('sessionId'), 'phase', m.get('phase'), 'half', m.get('half'), 'score', m.get('scoreA'), '-', m.get('scoreB'))

path2 = Path('telemetry-snapshots.json')
with path2.open('r', encoding='utf-8') as f:
    data2 = json.load(f)

matches2 = [e for e in data2 if e.get('match') and ((e['match'].get('teamAName')=='Seattle Sounders' and e['match'].get('teamBName')=='LAFC') or (e['match'].get('teamAName')=='LAFC' and e['match'].get('teamBName')=='Seattle Sounders'))]
print('snapshots matches:', len(matches2))
for e in matches2[:10]:
    print('eventType', e.get('eventType'), 'session', e.get('sessionId'), 'phase', e['match'].get('phase'), 'half', e['match'].get('half'), 'elapsed', e['match'].get('elapsedInHalf'))

import json
from pathlib import Path
path = Path('telemetry-snapshots.json')
with path.open('r', encoding='utf-8') as f:
    data = json.load(f)

matches = []
for entry in data:
    match = entry.get('match')
    if not match:
        continue
    if match.get('teamAName') == 'Toronto FC' and match.get('teamBName') == 'LAFC' or match.get('teamAName') == 'LAFC' and match.get('teamBName') == 'Toronto FC':
        matches.append(entry)
        if len(matches) >= 20:
            break

print('matches found', len(matches))
for i, entry in enumerate(matches[:20], 1):
    match = entry.get('match', {})
    print(i, 'session', entry.get('sessionId'), 'eventType', entry.get('eventType'), 'phase', match.get('phase'), 'half', match.get('half'), 'score', f"{match.get('scoreA')} - {match.get('scoreB')}", 'elapsed', match.get('elapsedInHalf'))
    if 'events' in entry:
        print('  has events', len(entry.get('events') or []))


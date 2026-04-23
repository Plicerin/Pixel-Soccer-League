import json
from pathlib import Path
path = Path('telemetry-batches.ndjson')
for i, line in enumerate(path.open('r', encoding='utf-8'), 1):
    if i in (2152, 2153):
        data = json.loads(line)
        print('line', i, 'session', data.get('sessionId'))
        print('keys', list(data.keys()))
        print('matchSnapshot teamA/teamB', data.get('matchSnapshot', {}).get('teamAName'), data.get('matchSnapshot', {}).get('teamBName'))
        print('telemetryEvents count', len(data.get('telemetryEvents') or []))
        print('telemetryEvents sample', data.get('telemetryEvents'))
        print('---')

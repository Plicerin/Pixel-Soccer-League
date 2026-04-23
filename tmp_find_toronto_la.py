import json
from collections import OrderedDict
path = 'telemetry-batches.ndjson'
count = 0
ids = OrderedDict()
with open(path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, start=1):
        if '"teamAName":"Toronto FC"' in line and '"teamBName":"LAFC"' in line:
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            mid = data.get('id')
            if mid not in ids:
                ids[mid] = {
                    'first_line': i,
                    'phase': data.get('phase'),
                    'half': data.get('half'),
                    'elapsed': data.get('elapsedInHalf'),
                    'offensiveTeam': data.get('offensiveTeam'),
                    'isLive': data.get('isLive'),
                    'sessionId': data.get('playerSnapshots', [{}])[0].get('sessionId') if data.get('playerSnapshots') else None
                }
            count += 1
            if count >= 5 and len(ids) >= 3:
                break
print('matches_found', len(ids), 'records', count)
for mid, info in ids.items():
    print(mid, info)

import json
from pathlib import Path
path = Path('telemetry-snapshots.json')
ids = set()
ct = 0
with path.open('r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'Toronto FC' in line and 'LAFC' in line:
            try:
                data = json.loads(line)
            except Exception:
                continue
            sid = data.get('sessionId') or data.get('id') or 'NOID'
            ids.add(sid)
            print('line', i, 'session', sid, 'keys', list(data.keys())[:10])
            if 'events' in data:
                print(' has events len', len(data.get('events') or []))
            ct += 1
            if ct >= 10:
                break
print('found', len(ids), 'unique session ids')

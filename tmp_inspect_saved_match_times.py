import json
from pathlib import Path
from collections import Counter
path = Path('psl-tuning-LAFC-vs-San Diego FC-1776564575941.json')
data = json.loads(path.read_text(encoding='utf-8'))
metadata = data.get('metadata', {})
half_duration = metadata.get('halfDuration', 2700)
print('halfDuration', half_duration)
events = data.get('events', [])
print('events total', len(events))
print('t min', min(e.get('t', float('inf')) for e in events), 'max', max(e.get('t', float('-inf')) for e in events))
print('half counts', Counter(e.get('half') for e in events))
print('minute min', min(e.get('minute', float('inf')) for e in events), 'max', max(e.get('minute', float('-inf')) for e in events))
print('type counts', Counter(e.get('type') for e in events))
print('samples half=2 first 5')
for e in events:
    if e.get('half') == 2:
        print(e)
        break

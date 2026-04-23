import json
from pathlib import Path
from statistics import mean
path = Path('psl-tuning-LAFC-vs-San Diego FC-1776564575941.json')
data = json.loads(path.read_text(encoding='utf-8'))
halfDur = data.get('metadata', {}).get('halfDuration', 2700)
for half in [1,2]:
    ts = [e['t'] for e in data['events'] if e.get('half')==half and isinstance(e.get('t'), (int,float))]
    if not ts:
        continue
    print('half', half, 'count', len(ts), 'min', min(ts), 'max', max(ts), 'mean', mean(ts))
    print('  ratio min', min(ts)/halfDur, 'ratio max', max(ts)/halfDur)

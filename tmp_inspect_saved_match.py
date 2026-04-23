import json
from pathlib import Path
path = Path('psl-tuning-LAFC-vs-San Diego FC-1776564575941.json')
data = json.loads(path.read_text(encoding='utf-8'))
print('metadata keys', list(data.get('metadata', {}).keys()))
print('metadata', data.get('metadata'))
print('events count', len(data.get('events', [])))
for e in data.get('events', [])[:10]:
    print(e)
print('--- last 5 events ---')
for e in data.get('events', [])[-5:]:
    print(e)

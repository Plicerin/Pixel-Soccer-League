import json
from pathlib import Path
root = Path('.')
count = 0
for p in root.glob('**/*.json'):
    if p.name.startswith('tmp_'):
        continue
    try:
        text = p.read_text(encoding='utf-8')
    except Exception:
        continue
    if 'Seattle Sounders' in text and 'LAFC' in text:
        print('FOUND', p)
        count += 1
        if count >= 50:
            break
print('TOTAL', count)

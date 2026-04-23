from pathlib import Path
root = Path('telemetry')
found = []
for p in root.rglob('*.json'):
    if 'Seattle Sounders' in p.name and 'LAFC' in p.name:
        found.append(p)
print('files', len(found))
for p in found:
    print(p)

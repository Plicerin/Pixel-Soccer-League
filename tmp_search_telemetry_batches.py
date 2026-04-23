import json
from pathlib import Path
path = Path('telemetry-batches.ndjson')
count = 0
sessions = {}
with path.open('r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'Toronto FC' in line and 'LAFC' in line:
            try:
                data = json.loads(line)
            except Exception:
                continue
            ms = data.get('matchSnapshot')
            if ms and ((ms.get('teamAName') == 'Toronto FC' and ms.get('teamBName') == 'LAFC') or (ms.get('teamAName') == 'LAFC' and ms.get('teamBName') == 'Toronto FC')):
                sid = data.get('sessionId')
                if sid not in sessions:
                    sessions[sid] = {
                        'first_line': i,
                        'matchSnapshot': ms,
                        'telemetryEvents_count': len(data.get('telemetryEvents') or []),
                        'eventTypes': {},
                        'payload_keys': list(data.keys()),
                    }
                for ev in data.get('telemetryEvents', []):
                    t = ev.get('eventType')
                    sessions[sid]['eventTypes'][t] = sessions[sid]['eventTypes'].get(t, 0) + 1
                count += 1
                if count >= 40:
                    break

print('records scanned', count)
for sid, info in sessions.items():
    print('session', sid, 'line', info['first_line'], 'events', info['telemetryEvents_count'], 'types', info['eventTypes'])
    ms = info['matchSnapshot']
    print('  phase', ms.get('phase'), 'half', ms.get('half'), 'score', ms.get('scoreA'), '-', ms.get('scoreB'), 'shots', ms.get('shotsA'), '-', ms.get('shotsB'))

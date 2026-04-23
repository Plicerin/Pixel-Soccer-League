import json
from collections import OrderedDict
path = 'telemetry-batches.ndjson'
match_snapshots = OrderedDict()
shot_events = []
pass_events = []
team_a = 'Toronto FC'
team_b = 'LAFC'

with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        if team_a in line and team_b in line:
            if '"matchSnapshot"' in line:
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ms = data.get('matchSnapshot')
                if not ms:
                    continue
                mid = ms.get('id')
                if mid not in match_snapshots:
                    match_snapshots[mid] = {
                        'timestamp': ms.get('timestamp'),
                        'elapsed': ms.get('elapsedInHalf'),
                        'half': ms.get('half'),
                        'phase': ms.get('phase'),
                        'score': (ms.get('scoreA'), ms.get('scoreB')),
                        'shots': (ms.get('shotsA'), ms.get('shotsB')),
                        'shotsOnTarget': (ms.get('shotsOnTargetA'), ms.get('shotsOnTargetB')),
                        'passes': (ms.get('passesA'), ms.get('passesB')),
                        'passesCompleted': (ms.get('passesCompletedA'), ms.get('passesCompletedB')),
                        'offs': ms.get('offensiveTeam'),
                        'possession': (ms.get('possessionA'), ms.get('possessionB')),
                        'isLive': ms.get('isLive')
                    }
            if '"eventType":"shot_stats_changed"' in line:
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                shot_events.append(data)
            if 'pass' in line.lower() and 'eventType' in line:
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                pass_events.append(data)

print('match_snapshot_count', len(match_snapshots))
print('shot_event_count', len(shot_events))
print('pass_event_count', len(pass_events))
print('\nFirst 12 match snapshots:')
for i, (mid, info) in enumerate(match_snapshots.items(), 1):
    if i > 12:
        break
    print(f"{i}. id={mid}, elapsed={info['elapsed']}, score={info['score']}, shots={info['shots']}, shotsOnTarget={info['shotsOnTarget']}, passesCompleted={info['passesCompleted']}, possession={info['possession']}, offensive={info['offs']}, live={info['isLive']}")

# find earliest and latest snapshot ids
if match_snapshots:
    first_mid = next(iter(match_snapshots))
    last_mid = next(reversed(match_snapshots))
    print(f"\nfirst id={first_mid}, last id={last_mid}")
    first = match_snapshots[first_mid]
    last = match_snapshots[last_mid]
    print('first snapshot', first)
    print('last snapshot', last)

# If no pass events, try scanning for passes in matchSnapshot lines only.

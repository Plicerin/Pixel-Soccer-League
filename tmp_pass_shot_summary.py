import json
from collections import defaultdict
path = 'telemetry-batches.ndjson'
team_a = 'Toronto FC'
team_b = 'LAFC'

# We'll aggregate by half using the latest snapshot for each half id.
latest_by_half = {}

with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        if team_a in line and team_b in line and '"matchSnapshot"' in line:
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            ms = data['matchSnapshot']
            half = ms.get('half')
            elapsed = ms.get('elapsedInHalf')
            # Keep the latest snapshot within each half (highest elapsed)
            if half not in latest_by_half or elapsed >= latest_by_half[half]['elapsedInHalf']:
                latest_by_half[half] = ms

for half in sorted(latest_by_half):
    ms = latest_by_half[half]
    print(f"Half {half} final elapsed={ms['elapsedInHalf']} score={ms['scoreA']}-{ms['scoreB']} shots={ms['shotsA']}-{ms['shotsB']} shotsOnTarget={ms['shotsOnTargetA']}-{ms['shotsOnTargetB']} passesCompleted={ms['passesCompletedA']}-{ms['passesCompletedB']} passes={ms['passesA']}-{ms['passesB']} possession={ms['possessionA']}-{ms['possessionB']}")

# If we want averages by time, compute shot and pass rate per 100 seconds for each team.
# Use first/last snapshot values to compute totals.
first = None
last = None
with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        if team_a in line and team_b in line and '"matchSnapshot"' in line:
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            ms = data['matchSnapshot']
            if first is None:
                first = ms
            last = ms

print('\nOverall match totals from first to last snapshot:')
print('elapsed start', first['elapsedInHalf'], 'elapsed end', last['elapsedInHalf'])
print('teamA (Toronto) passes', last['passesA'], 'completed', last['passesCompletedA'], 'shots', last['shotsA'], 'onTarget', last['shotsOnTargetA'])
print('teamB (LAFC) passes', last['passesB'], 'completed', last['passesCompletedB'], 'shots', last['shotsB'], 'onTarget', last['shotsOnTargetB'])
print('pass completion %A', round(last['passesCompletedA']/last['passesA']*100,1) if last['passesA'] else 0,
      'B', round(last['passesCompletedB']/last['passesB']*100,1) if last['passesB'] else 0)
print('SHOT rate/sec A', round(last['shotsA']/(last['elapsedInHalf'] or 1),3), 'B', round(last['shotsB']/(last['elapsedInHalf'] or 1),3))

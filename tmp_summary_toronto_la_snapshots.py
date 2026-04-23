import json
path = 'telemetry-batches.ndjson'
seen = set()
count = 0
with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        if '"teamAName":"Toronto FC"' in line and '"teamBName":"LAFC"' in line and '"matchSnapshot"' in line:
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            ms = data.get('matchSnapshot')
            if not ms:
                continue
            mid = ms.get('id')
            if mid in seen:
                continue
            seen.add(mid)
            print('id', mid,
                  'elapsed', ms.get('elapsedInHalf'),
                  'half', ms.get('half'),
                  'phase', ms.get('phase'),
                  'score', f"{ms.get('scoreA')} - {ms.get('scoreB')}",
                  'shots', f"{ms.get('shotsA')} - {ms.get('shotsB')}",
                  'passes', f"{ms.get('passesCompletedA')} - {ms.get('passesCompletedB')}",
                  'offensive', ms.get('offensiveTeam'),
                  'isLive', ms.get('isLive'))
            count += 1
            if count >= 10:
                break
print('printed', count, 'unique snap ids')

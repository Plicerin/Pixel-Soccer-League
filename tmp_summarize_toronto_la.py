import json
path = 'telemetry-batches.ndjson'
ids = []
sessions = set()
with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        if '"teamAName":"Toronto FC"' in line and '"teamBName":"LAFC"' in line and '"matchSnapshot"' in line:
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            ms = data.get('matchSnapshot')
            if ms:
                mid = ms.get('id')
                sid = ms.get('sessionId')
                if mid not in ids:
                    ids.append(mid)
                if sid:
                    sessions.add(sid)
            if len(ids) >= 20:
                break
print('unique matchSnapshot ids count', len(ids), 'sessionIds', len(sessions))
print(ids[:20])

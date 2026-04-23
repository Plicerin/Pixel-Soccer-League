import json
import re
s=open('atlanta_sanjose_match.json','r',encoding='utf-8').read()
prefix='"bundle_json":"'
start=s.index(prefix)+len(prefix)
end=start
escaped=False
while end < len(s):
    ch=s[end]
    if escaped:
        escaped=False
    elif ch=='\\':
        escaped=True
    elif ch=='"':
        break
    end+=1
raw=s[start:end]
print('raw length', len(raw))
print('first 80', repr(raw[:80]))
print('last 80', repr(raw[-80:]))
fixed = raw.replace('\r','\\r').replace('\n','\\n')
# ensure backslashes at end are not lost
inner = json.loads('"' + fixed + '"')
bundle = json.loads(inner)
print('bundle teamA passes', bundle['teamA'].get('passes'))
print('bundle teamA passesCompleted', bundle['teamA'].get('passesCompleted'))
print('bundle teamB passes', bundle['teamB'].get('passes'))
print('bundle teamB passesCompleted', bundle['teamB'].get('passesCompleted'))
print('teamA keys', list(bundle['teamA'].keys())[:10])
print('teamB keys', list(bundle['teamB'].keys())[:10])

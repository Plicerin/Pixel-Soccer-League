import json
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
print('raw len', len(raw))
inner=json.loads('"'+raw+'"')
obj=json.loads(inner)
print('teamA passes', obj['teamA']['passes'], 'completed', obj['teamA']['passesCompleted'])
print('teamB passes', obj['teamB']['passes'], 'completed', obj['teamB']['passesCompleted'])

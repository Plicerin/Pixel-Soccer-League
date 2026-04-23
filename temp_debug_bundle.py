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
fixed = raw.replace('\r','\\r').replace('\n','\\n')
print('fixed len', len(fixed))
for i in range(240, 275):
    c=fixed[i]
    print(i, repr(c), ord(c))
print('segment', repr(fixed[240:275]))

import re
s=open('atlanta_sanjose_match.json','r',encoding='utf-8').read()
start=s.find('"bundle_json":"')
print('start', start)
print(s[start:start+500])

import re
s=open('atlanta_sanjose_match.json','r',encoding='utf-8').read()
for m in re.finditer(r'\\"teamA\\"', s):
    i=m.start()
    print(s[i-100:i+200])
    break

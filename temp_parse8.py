import re
s=open('atlanta_sanjose_match.json','r',encoding='utf-8').read()
for m in re.finditer(r'\\"passes\\"\s*:\s*([0-9]+)', s):
    print('passes', m.group(1), 'at', m.start())
for m in re.finditer(r'\\"passesCompleted\\"\s*:\s*([0-9]+)', s):
    print('passesCompleted', m.group(1), 'at', m.start())

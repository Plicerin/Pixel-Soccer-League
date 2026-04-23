import re
s=open('atlanta_sanjose_match.json','r',encoding='utf-8').read()
for m in re.finditer(r'\\"passes\\"\s*:\s*([0-9]+)|\\"passesCompleted\\"\s*:\s*([0-9]+)', s):
    print(m.group(0))

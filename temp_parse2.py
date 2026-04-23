import re
s=open('atlanta_sanjose_match.json','r',encoding='utf-8').read()
mA=re.search(r'\\"teamA\\"\s*:\s*\\\{.*?\\"passes\\"\s*:\s*(\d+).*?\\"passesCompleted\\"\s*:\s*(\d+)', s, re.S)
mB=re.search(r'\\"teamB\\"\s*:\s*\\\{.*?\\"passes\\"\s*:\s*(\d+).*?\\"passesCompleted\\"\s*:\s*(\d+)', s, re.S)
print('teamA passes/completed', mA.groups() if mA else None)
print('teamB passes/completed', mB.groups() if mB else None)

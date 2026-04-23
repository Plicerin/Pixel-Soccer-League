import re
s=open('atlanta_sanjose_match.json','r',encoding='utf-8').read()
def find(k):
    m=re.search(r'"'+k+'"\s*:\s*(?:([0-9]+)|"(.*?)")', s)
    if not m: return None
    return m.group(2) if m.group(2) is not None else int(m.group(1))
keys=['team_a_name','team_b_name','score_a','score_b','shots_a','shots_b','shots_on_target_a','shots_on_target_b','saves_a','saves_b','possession_a','phase','half','elapsed_in_half']
for k in keys:
    print(k, find(k))

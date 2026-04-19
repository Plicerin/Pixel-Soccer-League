import sqlite3, json
from collections import Counter
from statistics import mean, median

conn = sqlite3.connect('psl.db')
cur = conn.cursor()
cur.execute('SELECT session_id, team_a_name, team_b_name, bundle_json FROM match_results ORDER BY timestamp DESC LIMIT 4')

shots, passes, other = [], [], Counter()
team_match_stats = []

for sid, ta, tb, bj in cur.fetchall():
    b = json.loads(bj)
    for e in b['events']:
        t = e.get('type')
        d = e.get('detail') or {}
        if t == 'SHOT':
            shots.append({
                'team': e.get('team'), 'role': e.get('role'),
                'dist_yd': d.get('distYards'),
                'pressure': d.get('nearbyOppPressure'),
                'angle': d.get('angleToGoal'),
                'style': d.get('style'),
            })
        elif t == 'PASS':
            passes.append({
                'team': e.get('team'), 'role': e.get('role'),
                'style': d.get('style'),
                'direction': d.get('passDirection'),
                'progress_units': d.get('progress'),
                'outcome': d.get('outcome'),
                'lane_pressure': d.get('lanePressure'),
                'dist': d.get('dist'),
                'passer_role': e.get('role'),
                'receiver_role': d.get('toRole'),
                'passer_to_goal': d.get('passerDistToGoal'),
                'receiver_danger': d.get('receiverDanger'),
            })
        else:
            other[t] += 1
    for k, tname in [('teamA', ta), ('teamB', tb)]:
        ts = b.get(k) or {}
        team_match_stats.append({
            'name': tname, 'shots': ts.get('shots'), 'sot': ts.get('shotsOnTarget'),
            'saves': ts.get('saves'), 'passes': ts.get('passes'),
            'passes_comp': ts.get('passesCompleted'),
            'tackles': ts.get('tackles'), 'clear': ts.get('clearances'),
            'fouls': ts.get('fouls'), 'offside': ts.get('offsides'),
            'corners': ts.get('corners'), 'throwIns': ts.get('throwIns'),
            'possession': ts.get('possession'),
        })

n_matches = 4
n_teams = 8

print('='*68)
print('SHOT ANALYSIS -- {} shots across {} matches ({:.1f} per team)'.format(
    len(shots), n_matches, len(shots)/n_teams))
print('='*68)
dists = [s['dist_yd'] for s in shots if s['dist_yd'] is not None]
print('Mean shot distance: {:.1f} yd  Median: {:.1f} yd'.format(mean(dists), median(dists)))
bins = Counter()
for d in dists:
    if d < 6: bins['<6 yd (tap-in)'] += 1
    elif d < 12: bins['6-12 yd (box)'] += 1
    elif d < 18: bins['12-18 yd (PA-edge)'] += 1
    elif d < 25: bins['18-25 yd'] += 1
    elif d < 35: bins['25-35 yd'] += 1
    else: bins['35+ yd'] += 1
for k in ['<6 yd (tap-in)', '6-12 yd (box)', '12-18 yd (PA-edge)', '18-25 yd', '25-35 yd', '35+ yd']:
    n = bins.get(k, 0)
    pct = n*100/len(dists) if dists else 0
    print('  {:26s}: {:3d}  ({:4.1f}%)'.format(k, n, pct))

styles = Counter(s['style'] for s in shots if s['style'])
print('Shot styles:')
for s, n in styles.most_common():
    print('  {:14s}: {:3d}  ({:4.1f}%)'.format(s, n, n*100/len(shots)))

hdr = sum(1 for s in shots if s.get('style') == 'HEADER')
print('Headers: {} ({:.1f}%)'.format(hdr, hdr*100/len(shots)))

pressures = [s['pressure'] for s in shots if s['pressure'] is not None]
print('Mean opp pressure at shot: {:.2f}'.format(mean(pressures)))
bp = Counter()
for p in pressures:
    if p == 0: bp['p=0'] += 1
    elif p == 1: bp['p=1'] += 1
    elif p == 2: bp['p=2'] += 1
    else: bp['p>=3'] += 1
for k in ['p=0','p=1','p=2','p>=3']:
    n = bp.get(k,0)
    pct = n*100/len(pressures) if pressures else 0
    print('  {}: {} ({:.1f}%)'.format(k, n, pct))

roles = Counter(s['role'] for s in shots)
print('Shots by role:')
for r,n in roles.most_common():
    print('  {:4s}: {:3d}  ({:4.1f}%)'.format(r, n, n*100/len(shots)))

print()
print('='*68)
print('PASS ANALYSIS -- {} passes ({:.0f} per team)'.format(len(passes), len(passes)/n_teams))
print('='*68)
dir_counter = Counter(p['direction'] for p in passes if p['direction'])
total_dir = sum(dir_counter.values())
for k in ['forward','backward','sideways']:
    n = dir_counter.get(k, 0)
    print('  {:10s}: {:3d}  ({:4.1f}%)'.format(k, n, n*100/total_dir if total_dir else 0))

styles_p = Counter(p['style'] for p in passes if p['style'])
print('Pass styles:')
for s,n in styles_p.most_common():
    print('  {:14s}: {:3d}  ({:4.1f}%)'.format(s, n, n*100/len(passes)))

out_counter = Counter(p['outcome'] for p in passes if p['outcome'])
print('Pass outcomes:')
for o,n in out_counter.most_common():
    print('  {:14s}: {:3d}  ({:4.1f}%)'.format(o, n, n*100/len(passes)))

fwd = [p for p in passes if p.get('direction') == 'forward']
fwd_success = sum(1 for p in fwd if p.get('outcome') == 'SUCCESS')
print('Forward-pass success rate: {}/{} = {:.1f}%'.format(
    fwd_success, len(fwd), fwd_success*100/max(1,len(fwd))))

ft_passes = [p for p in passes if p.get('passer_to_goal') is not None and p['passer_to_goal'] <= 16]
print('Passes from final third (passer <=16 units from goal ~ <=29yd): {}'.format(len(ft_passes)))
if ft_passes:
    st_passes_ft = [p for p in ft_passes if p.get('passer_role') == 'ST']
    print('  by ST: {} ({:.1f}%)'.format(len(st_passes_ft), len(st_passes_ft)*100/len(ft_passes)))
    ft_fwd = [p for p in ft_passes if p.get('direction') == 'forward']
    print('  forward direction: {} ({:.1f}%)'.format(len(ft_fwd), len(ft_fwd)*100/len(ft_passes)))

st_passes_all = [p for p in passes if p.get('passer_role') == 'ST']
st_back = [p for p in st_passes_all if p.get('direction') == 'backward']
print('ST passes total: {}  backward: {} ({:.1f}%)'.format(
    len(st_passes_all), len(st_back), len(st_back)*100/max(1,len(st_passes_all))))

print()
print('='*68)
print('TEAM-LEVEL AVERAGES (per team, per match)')
print('='*68)
def avg(k): return mean([t[k] for t in team_match_stats if t[k] is not None])
print('  Shots:   {:.1f}'.format(avg('shots')))
print('  SoT:     {:.1f}   ({:.1f}% of shots)'.format(avg('sot'), avg('sot')*100/avg('shots')))
print('  Saves:   {:.1f}'.format(avg('saves')))
print('  Passes:  {:.1f}  completed: {:.1f}  ({:.1f}%)'.format(
    avg('passes'), avg('passes_comp'), avg('passes_comp')*100/avg('passes')))
print('  Tackles: {:.1f}  Clearances: {:.1f}  Fouls: {:.1f}'.format(
    avg('tackles'), avg('clear'), avg('fouls')))
print('  Offsides: {:.1f}  Corners: {:.1f}'.format(avg('offside'), avg('corners')))
print()
print('Non-pass/shot events across 4 matches:')
for t, n in other.most_common():
    print('  {:14s}: {}/match'.format(t, n/n_matches))

conn.close()

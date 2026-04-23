import pathlib, re
path = pathlib.Path('src/mlsTeamStats2025.ts')
text = path.read_text(encoding='utf-8')
pattern = re.compile(r'const MLS_2025_TEAM_STATS: Record<string, MLS2025TeamStats> = \{(.+)\};', re.S)
m = pattern.search(text)
if not m:
    raise SystemExit('no match')
block = m.group(1)
stats = {}
for line in block.splitlines():
    line=line.strip()
    if not line or line.startswith('//'): continue
    match = re.match(r'"?([^"\']+)"?: \{ points: (\d+), gamesPlayed: (\d+), goalsFor: (\d+), goalsAgainst: (\d+), pointsPerGame: ([0-9.]+) \},?', line)
    if match:
        name = match.group(1)
        stats[name] = {
            'points': int(match.group(2)),
            'gamesPlayed': int(match.group(3)),
            'goalsFor': int(match.group(4)),
            'goalsAgainst': int(match.group(5)),
            'pointsPerGame': float(match.group(6)),
        }
for team in ['Atlanta United','San Jose Earthquakes']:
    s = stats[team]
    print(team, 'PPG', s['pointsPerGame'], 'GF/G', round(s['goalsFor']/s['gamesPlayed'], 3), 'GA/G', round(s['goalsAgainst']/s['gamesPlayed'],3))

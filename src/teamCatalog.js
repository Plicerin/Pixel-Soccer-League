export const DEFAULT_HOME_TEAM = 'United States';
export const DEFAULT_AWAY_TEAM = 'Mexico';

export const WORLD_CUP_2026_TEAMS = [
  { name: 'Canada', confederation: 'CONCACAF', group: 'Co-Host', home: { shirt: 0xd80621, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0xd80621 } },
  { name: 'Mexico', confederation: 'CONCACAF', group: 'Co-Host', home: { shirt: 0x006847, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0xce1126 } },
  { name: 'United States', confederation: 'CONCACAF', group: 'Co-Host', home: { shirt: 0xffffff, pants: 0x002868 }, away: { shirt: 0xb31942, pants: 0x002868 } },

  { name: 'Austria', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xed2939, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0xed2939 } },
  { name: 'Belgium', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xef3340, pants: 0x000000 }, away: { shirt: 0xfdda24, pants: 0xef3340 } },
  { name: 'Bosnia and Herzegovina', confederation: 'UEFA', group: 'Europe', home: { shirt: 0x002395, pants: 0xfecb00 }, away: { shirt: 0xffffff, pants: 0x002395 } },
  { name: 'Croatia', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xff0000, pants: 0xffffff }, away: { shirt: 0x171796, pants: 0xffffff } },
  { name: 'Czechia', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xd7141a, pants: 0x11457e }, away: { shirt: 0xffffff, pants: 0xd7141a } },
  { name: 'England', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xffffff, pants: 0x1b315f }, away: { shirt: 0xc8102e, pants: 0xffffff } },
  { name: 'France', confederation: 'UEFA', group: 'Europe', home: { shirt: 0x0055a4, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0xef4135 } },
  { name: 'Germany', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xffffff, pants: 0x000000 }, away: { shirt: 0x000000, pants: 0xdd0000 } },
  { name: 'Netherlands', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xff7f00, pants: 0x1f3c88 }, away: { shirt: 0xffffff, pants: 0xff7f00 } },
  { name: 'Norway', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xba0c2f, pants: 0x00205b }, away: { shirt: 0xffffff, pants: 0xba0c2f } },
  { name: 'Portugal', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xff0000, pants: 0x006600 }, away: { shirt: 0xffffff, pants: 0xff0000 } },
  { name: 'Scotland', confederation: 'UEFA', group: 'Europe', home: { shirt: 0x005eb8, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x005eb8 } },
  { name: 'Spain', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xaa151b, pants: 0xf1bf00 }, away: { shirt: 0xffffff, pants: 0xaa151b } },
  { name: 'Sweden', confederation: 'UEFA', group: 'Europe', home: { shirt: 0x006aa7, pants: 0xfecc02 }, away: { shirt: 0xfecc02, pants: 0x006aa7 } },
  { name: 'Switzerland', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xff0000, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0xff0000 } },
  { name: 'Türkiye', confederation: 'UEFA', group: 'Europe', home: { shirt: 0xe30a17, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0xe30a17 } },

  { name: 'Argentina', confederation: 'CONMEBOL', group: 'South America', home: { shirt: 0x75aadb, pants: 0xffffff }, away: { shirt: 0x1c1f4a, pants: 0x75aadb } },
  { name: 'Brazil', confederation: 'CONMEBOL', group: 'South America', home: { shirt: 0xffdf00, pants: 0x009c3b }, away: { shirt: 0x002776, pants: 0xffdf00 } },
  { name: 'Colombia', confederation: 'CONMEBOL', group: 'South America', home: { shirt: 0xfcd116, pants: 0x003893 }, away: { shirt: 0xce1126, pants: 0xfcd116 } },
  { name: 'Ecuador', confederation: 'CONMEBOL', group: 'South America', home: { shirt: 0xffdd00, pants: 0x034ea2 }, away: { shirt: 0xffffff, pants: 0xffdd00 } },
  { name: 'Paraguay', confederation: 'CONMEBOL', group: 'South America', home: { shirt: 0xd52b1e, pants: 0xffffff }, away: { shirt: 0x0038a8, pants: 0xffffff } },
  { name: 'Uruguay', confederation: 'CONMEBOL', group: 'South America', home: { shirt: 0x5bc2e7, pants: 0x000000 }, away: { shirt: 0xffffff, pants: 0x5bc2e7 } },

  { name: 'Algeria', confederation: 'CAF', group: 'Africa', home: { shirt: 0xffffff, pants: 0x006233 }, away: { shirt: 0x006233, pants: 0xffffff } },
  { name: 'Cabo Verde', confederation: 'CAF', group: 'Africa', home: { shirt: 0x003893, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x003893 } },
  { name: "Côte d'Ivoire", confederation: 'CAF', group: 'Africa', home: { shirt: 0xf77f00, pants: 0x009e60 }, away: { shirt: 0xffffff, pants: 0xf77f00 } },
  { name: 'DR Congo', confederation: 'CAF', group: 'Africa', home: { shirt: 0x007fff, pants: 0xce1021 }, away: { shirt: 0xffffff, pants: 0x007fff } },
  { name: 'Egypt', confederation: 'CAF', group: 'Africa', home: { shirt: 0xce1126, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x000000 } },
  { name: 'Ghana', confederation: 'CAF', group: 'Africa', home: { shirt: 0xfcd116, pants: 0x006b3f }, away: { shirt: 0xffffff, pants: 0xce1126 } },
  { name: 'Morocco', confederation: 'CAF', group: 'Africa', home: { shirt: 0xc1272d, pants: 0x006233 }, away: { shirt: 0xffffff, pants: 0xc1272d } },
  { name: 'Senegal', confederation: 'CAF', group: 'Africa', home: { shirt: 0x00853f, pants: 0xfdef42 }, away: { shirt: 0xffffff, pants: 0x00853f } },
  { name: 'South Africa', confederation: 'CAF', group: 'Africa', home: { shirt: 0x007a4d, pants: 0xffb612 }, away: { shirt: 0xffffff, pants: 0x007a4d } },
  { name: 'Tunisia', confederation: 'CAF', group: 'Africa', home: { shirt: 0xe70013, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0xe70013 } },

  { name: 'Australia', confederation: 'AFC', group: 'Asia', home: { shirt: 0xffcd00, pants: 0x00843d }, away: { shirt: 0x00205b, pants: 0xffcd00 } },
  { name: 'Iran', confederation: 'AFC', group: 'Asia', home: { shirt: 0xffffff, pants: 0x239f40 }, away: { shirt: 0xda0000, pants: 0xffffff } },
  { name: 'Iraq', confederation: 'AFC', group: 'Asia', home: { shirt: 0xce1126, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x000000 } },
  { name: 'Japan', confederation: 'AFC', group: 'Asia', home: { shirt: 0x003f8e, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x003f8e } },
  { name: 'Jordan', confederation: 'AFC', group: 'Asia', home: { shirt: 0xce1126, pants: 0x000000 }, away: { shirt: 0xffffff, pants: 0x007a3d } },
  { name: 'Qatar', confederation: 'AFC', group: 'Asia', home: { shirt: 0x8a1538, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x8a1538 } },
  { name: 'Saudi Arabia', confederation: 'AFC', group: 'Asia', home: { shirt: 0x006c35, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x006c35 } },
  { name: 'South Korea', confederation: 'AFC', group: 'Asia', home: { shirt: 0xc60c30, pants: 0x003478 }, away: { shirt: 0xffffff, pants: 0xc60c30 } },
  { name: 'Uzbekistan', confederation: 'AFC', group: 'Asia', home: { shirt: 0x1eb5e5, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x1eb5e5 } },

  { name: 'Curaçao', confederation: 'CONCACAF', group: 'North, Central America & Caribbean', home: { shirt: 0x002b7f, pants: 0xf9e814 }, away: { shirt: 0xffffff, pants: 0x002b7f } },
  { name: 'Haiti', confederation: 'CONCACAF', group: 'North, Central America & Caribbean', home: { shirt: 0x00209f, pants: 0xd21034 }, away: { shirt: 0xffffff, pants: 0x00209f } },
  { name: 'Panama', confederation: 'CONCACAF', group: 'North, Central America & Caribbean', home: { shirt: 0xd21034, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x005293 } },

  { name: 'New Zealand', confederation: 'OFC', group: 'Oceania', home: { shirt: 0xffffff, pants: 0x000000 }, away: { shirt: 0x000000, pants: 0xffffff } },
];

export const EASTER_EGG_WORLD_TEAMS = [
  { name: 'Italy 1982', confederation: 'Historic', group: '1982 World Cup Final', home: { shirt: 0x0057b8, pants: 0xffffff }, away: { shirt: 0xffffff, pants: 0x0057b8 } },
  { name: 'West Germany 1982', confederation: 'Historic', group: '1982 World Cup Final', home: { shirt: 0xffffff, pants: 0x000000 }, away: { shirt: 0x087a3b, pants: 0xffffff } },
];

export const WORLD_CUP_2026_TEAM_NAMES = WORLD_CUP_2026_TEAMS.map((team) => team.name);
export const WORLD_CUP_2026_TEAM_GROUPS = [...new Set(WORLD_CUP_2026_TEAMS.map((team) => team.group))];

export const WORLD_CUP_2026_TEAM_KITS = Object.fromEntries(
  WORLD_CUP_2026_TEAMS.map((team) => [team.name, { home: team.home, away: team.away }]),
);

export const PLAYABLE_WORLD_TEAMS = [...WORLD_CUP_2026_TEAMS, ...EASTER_EGG_WORLD_TEAMS];
export const PLAYABLE_WORLD_TEAM_NAMES = PLAYABLE_WORLD_TEAMS.map((team) => team.name);
export const PLAYABLE_WORLD_TEAM_KITS = Object.fromEntries(
  PLAYABLE_WORLD_TEAMS.map((team) => [team.name, { home: team.home, away: team.away }]),
);

function colorDistance(a, b) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

export function resolvePlayableTeamKits(homeTeam, awayTeam, preferredHome = 'home', preferredAway = 'away') {
  const fallback = PLAYABLE_WORLD_TEAM_KITS[DEFAULT_HOME_TEAM] || Object.values(PLAYABLE_WORLD_TEAM_KITS)[0];
  const homeKits = PLAYABLE_WORLD_TEAM_KITS[homeTeam] || fallback;
  const awayKits = PLAYABLE_WORLD_TEAM_KITS[awayTeam] || fallback;
  const homeKey = preferredHome === 'away' ? 'away' : 'home';
  let awayKey = preferredAway === 'home' ? 'home' : 'away';
  const homeKit = homeKits[homeKey] || homeKits.home || fallback.home;
  let awayKit = awayKits[awayKey] || awayKits.away || fallback.away;

  if (colorDistance(homeKit.shirt, awayKit.shirt) < 88) {
    const alternateAwayKey = awayKey === 'home' ? 'away' : 'home';
    const alternateAwayKit = awayKits[alternateAwayKey] || awayKit;
    if (colorDistance(homeKit.shirt, alternateAwayKit.shirt) > colorDistance(homeKit.shirt, awayKit.shirt)) {
      awayKey = alternateAwayKey;
      awayKit = alternateAwayKit;
    }
  }

  return {
    homeKey,
    awayKey,
    home: homeKit,
    away: awayKit,
  };
}

export const WORLD_CUP_2026_TEAM_ALIASES = {
  usa: 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  america: 'United States',
  turkey: 'Türkiye',
  turkiye: 'Türkiye',
  'cote d’ivoire': "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  'côte d’ivoire': "Côte d'Ivoire",
  'ivory coast': "Côte d'Ivoire",
  curacao: 'Curaçao',
  'cape verde': 'Cabo Verde',
  drc: 'DR Congo',
  'd.r. congo': 'DR Congo',
  'democratic republic of congo': 'DR Congo',
  'korea republic': 'South Korea',
  korea: 'South Korea',
  italy: 'Italy 1982',
  'italy 82': 'Italy 1982',
  'italy 1982': 'Italy 1982',
  '1982 italy': 'Italy 1982',
  'west germany': 'West Germany 1982',
  'west germany 82': 'West Germany 1982',
  'west germany 1982': 'West Germany 1982',
  'germany fr': 'West Germany 1982',
  'germany fr 1982': 'West Germany 1982',
  'germany 1982': 'West Germany 1982',
};

export const WORLD_CUP_2026_TEAM_FLAG_CODES = {
  Canada: 'CA',
  Mexico: 'MX',
  'United States': 'US',
  Austria: 'AT',
  Belgium: 'BE',
  'Bosnia and Herzegovina': 'BA',
  Croatia: 'HR',
  Czechia: 'CZ',
  England: 'GB-ENG',
  France: 'FR',
  Germany: 'DE',
  Netherlands: 'NL',
  Norway: 'NO',
  Portugal: 'PT',
  Scotland: 'GB-SCT',
  Spain: 'ES',
  Sweden: 'SE',
  Switzerland: 'CH',
  Türkiye: 'TR',
  Argentina: 'AR',
  Brazil: 'BR',
  Colombia: 'CO',
  Ecuador: 'EC',
  Paraguay: 'PY',
  Uruguay: 'UY',
  Algeria: 'DZ',
  'Cabo Verde': 'CV',
  "Côte d'Ivoire": 'CI',
  'DR Congo': 'CD',
  Egypt: 'EG',
  Ghana: 'GH',
  Morocco: 'MA',
  Senegal: 'SN',
  'South Africa': 'ZA',
  Tunisia: 'TN',
  Australia: 'AU',
  Iran: 'IR',
  Iraq: 'IQ',
  Japan: 'JP',
  Jordan: 'JO',
  Qatar: 'QA',
  'Saudi Arabia': 'SA',
  'South Korea': 'KR',
  Uzbekistan: 'UZ',
  Curaçao: 'CW',
  Haiti: 'HT',
  Panama: 'PA',
  'New Zealand': 'NZ',
  'Italy 1982': 'IT',
  'West Germany 1982': 'DE',
};

function regionalFlagEmoji(code) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function subdivisionFlagEmoji(tag) {
  const tagPoints = tag
    .toLowerCase()
    .split('')
    .map((char) => 0xe0000 + char.charCodeAt(0));
  return String.fromCodePoint(0x1f3f4, ...tagPoints, 0xe007f);
}

export function getWorldCupTeamFlag(teamName) {
  const canonical = resolveWorldCupTeamName(teamName) || teamName;
  const code = WORLD_CUP_2026_TEAM_FLAG_CODES[canonical];
  if (code === 'GB-ENG') return subdivisionFlagEmoji('gbeng');
  if (code === 'GB-SCT') return subdivisionFlagEmoji('gbsct');
  if (!code) return '';
  return regionalFlagEmoji(code);
}

export function getWorldCupTeamFlagAsset(teamName) {
  const canonical = resolveWorldCupTeamName(teamName) || teamName;
  const code = WORLD_CUP_2026_TEAM_FLAG_CODES[canonical];
  if (!code) return '';
  return `https://flagcdn.com/w80/${code.toLocaleLowerCase()}.png`;
}

export function resolveWorldCupTeamName(input) {
  const normalized = String(input || '').trim().toLocaleLowerCase();
  if (WORLD_CUP_2026_TEAM_ALIASES[normalized]) return WORLD_CUP_2026_TEAM_ALIASES[normalized];
  return PLAYABLE_WORLD_TEAM_NAMES.find((team) => team.toLocaleLowerCase() === normalized) || '';
}

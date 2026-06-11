export const FIFA_MEN_RANKING_SNAPSHOT_DATE = '2026-04-01';
export const FIFA_MEN_RANKING_NEXT_UPDATE_DATE = '2026-06-11';
export const FIFA_MEN_RANKING_SOURCE_URL = 'https://inside.fifa.com/en/fifa-world-ranking/men?dateId=id37';

export type FifaMenRankingRow = {
  team: string;
  fifaCode: string;
  rank: number;
  points: number;
};

export const FIFA_MEN_RANKINGS_2026_04_01: FifaMenRankingRow[] = [
  { team: 'France', fifaCode: 'FRA', rank: 1, points: 1877.32 },
  { team: 'Spain', fifaCode: 'ESP', rank: 2, points: 1876.4 },
  { team: 'Argentina', fifaCode: 'ARG', rank: 3, points: 1874.81 },
  { team: 'England', fifaCode: 'ENG', rank: 4, points: 1825.97 },
  { team: 'Portugal', fifaCode: 'POR', rank: 5, points: 1763.83 },
  { team: 'Brazil', fifaCode: 'BRA', rank: 6, points: 1761.16 },
  { team: 'Netherlands', fifaCode: 'NED', rank: 7, points: 1757.87 },
  { team: 'Morocco', fifaCode: 'MAR', rank: 8, points: 1755.87 },
  { team: 'Belgium', fifaCode: 'BEL', rank: 9, points: 1734.71 },
  { team: 'Germany', fifaCode: 'GER', rank: 10, points: 1730.37 },
  { team: 'Croatia', fifaCode: 'CRO', rank: 11, points: 1717.07 },
  { team: 'Colombia', fifaCode: 'COL', rank: 13, points: 1693.09 },
  { team: 'Senegal', fifaCode: 'SEN', rank: 14, points: 1688.99 },
  { team: 'Mexico', fifaCode: 'MEX', rank: 15, points: 1681.03 },
  { team: 'United States', fifaCode: 'USA', rank: 16, points: 1673.13 },
  { team: 'Uruguay', fifaCode: 'URU', rank: 17, points: 1673.07 },
  { team: 'Japan', fifaCode: 'JPN', rank: 18, points: 1660.43 },
  { team: 'Switzerland', fifaCode: 'SUI', rank: 19, points: 1649.4 },
  { team: 'Iran', fifaCode: 'IRN', rank: 21, points: 1615.3 },
  { team: 'Türkiye', fifaCode: 'TUR', rank: 22, points: 1599.04 },
  { team: 'Ecuador', fifaCode: 'ECU', rank: 23, points: 1594.78 },
  { team: 'Austria', fifaCode: 'AUT', rank: 24, points: 1593.45 },
  { team: 'South Korea', fifaCode: 'KOR', rank: 25, points: 1588.66 },
  { team: 'Australia', fifaCode: 'AUS', rank: 27, points: 1580.67 },
  { team: 'Algeria', fifaCode: 'ALG', rank: 28, points: 1564.26 },
  { team: 'Egypt', fifaCode: 'EGY', rank: 29, points: 1563.24 },
  { team: 'Canada', fifaCode: 'CAN', rank: 30, points: 1556.48 },
  { team: 'Norway', fifaCode: 'NOR', rank: 31, points: 1550.94 },
  { team: 'Panama', fifaCode: 'PAN', rank: 33, points: 1540.64 },
  { team: "Côte d'Ivoire", fifaCode: 'CIV', rank: 34, points: 1532.98 },
  { team: 'Sweden', fifaCode: 'SWE', rank: 38, points: 1514.77 },
  { team: 'Paraguay', fifaCode: 'PAR', rank: 40, points: 1503.5 },
  { team: 'Czechia', fifaCode: 'CZE', rank: 41, points: 1501.38 },
  { team: 'Scotland', fifaCode: 'SCO', rank: 43, points: 1498.35 },
  { team: 'Tunisia', fifaCode: 'TUN', rank: 44, points: 1483.05 },
  { team: 'DR Congo', fifaCode: 'COD', rank: 46, points: 1478.35 },
  { team: 'Uzbekistan', fifaCode: 'UZB', rank: 50, points: 1465.34 },
  { team: 'Qatar', fifaCode: 'QAT', rank: 55, points: 1454.96 },
  { team: 'Iraq', fifaCode: 'IRQ', rank: 57, points: 1447.14 },
  { team: 'South Africa', fifaCode: 'RSA', rank: 60, points: 1429.73 },
  { team: 'Saudi Arabia', fifaCode: 'KSA', rank: 61, points: 1421.43 },
  { team: 'Jordan', fifaCode: 'JOR', rank: 63, points: 1391.45 },
  { team: 'Bosnia and Herzegovina', fifaCode: 'BIH', rank: 65, points: 1385.84 },
  { team: 'Cabo Verde', fifaCode: 'CPV', rank: 69, points: 1366.13 },
  { team: 'Ghana', fifaCode: 'GHA', rank: 74, points: 1346.31 },
  { team: 'Curaçao', fifaCode: 'CUW', rank: 82, points: 1294.65 },
  { team: 'Haiti', fifaCode: 'HAI', rank: 83, points: 1291.71 },
  { team: 'New Zealand', fifaCode: 'NZL', rank: 85, points: 1281.57 },
];

export const FIFA_MEN_RANKINGS_2026_04_01_BY_TEAM = new Map(
  FIFA_MEN_RANKINGS_2026_04_01.map((row) => [row.team, row]),
);


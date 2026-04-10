import React, { useEffect, useState, useCallback } from 'react';

interface MatchRow {
  session_id: string;
  timestamp: number;
  team_a_name: string;
  team_b_name: string;
  team_a_formation: string;
  team_b_formation: string;
  score_a: number;
  score_b: number;
  shots_a: number;
  shots_b: number;
  shots_on_target_a: number;
  shots_on_target_b: number;
  saves_a: number;
  saves_b: number;
  possession_a: number;
}

const MatchHistoryDashboard: React.FC = () => {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/__db/matches?limit=50');
      if (res.ok) {
        const rows: MatchRow[] = await res.json();
        setMatches(rows);
      }
    } catch (e) { console.warn('[MatchHistory] fetch error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Aggregate stats
  const totalGames = matches.length;
  const totalGoals = matches.reduce((s, m) => s + m.score_a + m.score_b, 0);
  const avgGoals = totalGames > 0 ? (totalGoals / totalGames).toFixed(1) : '–';
  const totalShots = matches.reduce((s, m) => s + m.shots_a + m.shots_b, 0);
  const totalSOG = matches.reduce((s, m) => s + m.shots_on_target_a + m.shots_on_target_b, 0);
  const totalSaves = matches.reduce((s, m) => s + m.saves_a + m.saves_b, 0);
  const avgShots = totalGames > 0 ? (totalShots / totalGames).toFixed(1) : '–';
  const shotAccPct = totalShots > 0 ? ((totalSOG / totalShots) * 100).toFixed(1) : '–';
  const draws = matches.filter(m => m.score_a === m.score_b).length;
  const drawPct = totalGames > 0 ? ((draws / totalGames) * 100).toFixed(0) : '–';
  const maxGoals = totalGames > 0 ? Math.max(...matches.map(m => m.score_a + m.score_b)) : 0;
  const minGoals = totalGames > 0 ? Math.min(...matches.map(m => m.score_a + m.score_b)) : 0;
  const cleanSheets = matches.filter(m => m.score_a === 0 || m.score_b === 0).length;

  // Goal distribution
  const goalBuckets: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
  matches.forEach(m => {
    const g = m.score_a + m.score_b;
    if (g >= 5) goalBuckets['5+']++;
    else goalBuckets[String(g)]++;
  });

  // Score distribution for each team's goals
  const homeGoalDist: number[] = [];
  const awayGoalDist: number[] = [];
  matches.forEach(m => { homeGoalDist.push(m.score_a); awayGoalDist.push(m.score_b); });

  const statBox = (label: string, value: string | number, sub?: string) => (
    <div className="bg-black/30 rounded-lg p-3 border border-white/5">
      <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-[10px] text-white/30 mt-1">{sub}</div>}
    </div>
  );

  const barWidth = (count: number) => {
    const max = Math.max(...Object.values(goalBuckets), 1);
    return `${Math.max(4, (count / max) * 100)}%`;
  };

  return (
    <div className="flex flex-col gap-4 text-white">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Match History</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase text-white/60 hover:text-white transition-all border border-white/5"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {totalGames === 0 ? (
        <div className="text-white/40 text-xs text-center py-8">
          No completed matches found. Run some CPU vs CPU games to collect data.
          <br /><br />
          <span className="text-white/20 font-mono text-[10px]">Console: window.pslSmokeTest.run(10)</span>
        </div>
      ) : (
        <>
          {/* Aggregate Stats */}
          <div className="grid grid-cols-3 gap-2">
            {statBox('Games', totalGames)}
            {statBox('Avg Goals', avgGoals, `${minGoals}–${maxGoals} range`)}
            {statBox('Avg Shots', avgShots, `${shotAccPct}% on target`)}
            {statBox('Clean Sheets', cleanSheets, `${totalGames > 0 ? ((cleanSheets / totalGames) * 100).toFixed(0) : 0}% of games`)}
            {statBox('Draws', draws, `${drawPct}%`)}
            {statBox('Total Saves', totalSaves, `${totalGames > 0 ? (totalSaves / totalGames).toFixed(1) : 0} per game`)}
          </div>

          {/* Goals Per Game Distribution */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3">Goals Per Game Distribution</div>
            <div className="flex flex-col gap-1">
              {Object.entries(goalBuckets).map(([bucket, count]) => (
                <div key={bucket} className="flex items-center gap-2 text-[11px]">
                  <span className="w-6 text-right text-white/50 font-mono">{bucket}</span>
                  <div className="flex-1 h-4 bg-black/30 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/60 rounded transition-all"
                      style={{ width: barWidth(count) }}
                    />
                  </div>
                  <span className="w-6 text-white/40 font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Match Results Table */}
          <div className="bg-black/20 rounded-lg border border-white/5 overflow-hidden">
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold p-3 pb-2">Match Results</div>
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-zinc-800/90 backdrop-blur-sm">
                  <tr className="text-white/40 uppercase text-[9px] tracking-wider">
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-right px-2 py-2">Home</th>
                    <th className="text-center px-2 py-2">Score</th>
                    <th className="text-left px-2 py-2">Away</th>
                    <th className="text-center px-2 py-2">Shots</th>
                    <th className="text-center px-2 py-2">SOG</th>
                    <th className="text-center px-2 py-2">Saves</th>
                    <th className="text-center px-2 py-2">Form.</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => {
                    const isDraw = m.score_a === m.score_b;
                    const homeWin = m.score_a > m.score_b;
                    return (
                      <tr key={m.session_id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2 text-white/30 font-mono">{i + 1}</td>
                        <td className={`text-right px-2 py-2 ${homeWin ? 'text-emerald-400 font-bold' : isDraw ? 'text-yellow-300' : 'text-white/60'}`}>
                          {m.team_a_name || 'Team A'}
                        </td>
                        <td className="text-center px-2 py-2 font-mono font-bold">
                          {m.score_a} – {m.score_b}
                        </td>
                        <td className={`text-left px-2 py-2 ${!homeWin && !isDraw ? 'text-emerald-400 font-bold' : isDraw ? 'text-yellow-300' : 'text-white/60'}`}>
                          {m.team_b_name || 'Team B'}
                        </td>
                        <td className="text-center px-2 py-2 text-white/50 font-mono">
                          {m.shots_a}–{m.shots_b}
                        </td>
                        <td className="text-center px-2 py-2 text-white/50 font-mono">
                          {m.shots_on_target_a}–{m.shots_on_target_b}
                        </td>
                        <td className="text-center px-2 py-2 text-white/50 font-mono">
                          {m.saves_a}–{m.saves_b}
                        </td>
                        <td className="text-center px-2 py-2 text-white/30 font-mono text-[9px]">
                          {m.team_a_formation || '—'} / {m.team_b_formation || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MatchHistoryDashboard;

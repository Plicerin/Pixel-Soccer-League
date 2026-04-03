import React, { useEffect, useState, useCallback } from 'react';
import { findRecentCompletedMatches, type TelemetrySessionSummary } from '../telemetry';

const MatchHistoryDashboard: React.FC = () => {
  const [matches, setMatches] = useState<TelemetrySessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await findRecentCompletedMatches({ limit: 50 });
    setMatches(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Aggregate stats
  const totalGames = matches.length;
  const totalGoals = matches.reduce((s, m) => s + m.finalScoreA + m.finalScoreB, 0);
  const avgGoals = totalGames > 0 ? (totalGoals / totalGames).toFixed(1) : '–';
  const totalShots = matches.reduce((s, m) => s + m.shotsA + m.shotsB, 0);
  const totalSOG = matches.reduce((s, m) => s + m.shotsOnTargetA + m.shotsOnTargetB, 0);
  const totalSaves = matches.reduce((s, m) => s + m.savesA + m.savesB, 0);
  const avgShots = totalGames > 0 ? (totalShots / totalGames).toFixed(1) : '–';
  const shotAccPct = totalShots > 0 ? ((totalSOG / totalShots) * 100).toFixed(1) : '–';
  const draws = matches.filter(m => m.finalScoreA === m.finalScoreB).length;
  const drawPct = totalGames > 0 ? ((draws / totalGames) * 100).toFixed(0) : '–';
  const maxGoals = totalGames > 0 ? Math.max(...matches.map(m => m.finalScoreA + m.finalScoreB)) : 0;
  const minGoals = totalGames > 0 ? Math.min(...matches.map(m => m.finalScoreA + m.finalScoreB)) : 0;
  const cleanSheets = matches.filter(m => m.finalScoreA === 0 || m.finalScoreB === 0).length;

  // Goal distribution
  const goalBuckets: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
  matches.forEach(m => {
    const g = m.finalScoreA + m.finalScoreB;
    if (g >= 5) goalBuckets['5+']++;
    else goalBuckets[String(g)]++;
  });

  // Score distribution for each team's goals
  const homeGoalDist: number[] = [];
  const awayGoalDist: number[] = [];
  matches.forEach(m => { homeGoalDist.push(m.finalScoreA); awayGoalDist.push(m.finalScoreB); });

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
                    const isDraw = m.finalScoreA === m.finalScoreB;
                    const homeWin = m.finalScoreA > m.finalScoreB;
                    return (
                      <tr key={m.sessionId} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2 text-white/30 font-mono">{i + 1}</td>
                        <td className={`text-right px-2 py-2 ${homeWin ? 'text-emerald-400 font-bold' : isDraw ? 'text-yellow-300' : 'text-white/60'}`}>
                          {m.teamAName || 'Team A'}
                        </td>
                        <td className="text-center px-2 py-2 font-mono font-bold">
                          {m.finalScoreA} – {m.finalScoreB}
                        </td>
                        <td className={`text-left px-2 py-2 ${!homeWin && !isDraw ? 'text-emerald-400 font-bold' : isDraw ? 'text-yellow-300' : 'text-white/60'}`}>
                          {m.teamBName || 'Team B'}
                        </td>
                        <td className="text-center px-2 py-2 text-white/50 font-mono">
                          {m.shotsA}–{m.shotsB}
                        </td>
                        <td className="text-center px-2 py-2 text-white/50 font-mono">
                          {m.shotsOnTargetA}–{m.shotsOnTargetB}
                        </td>
                        <td className="text-center px-2 py-2 text-white/50 font-mono">
                          {m.savesA}–{m.savesB}
                        </td>
                        <td className="text-center px-2 py-2 text-white/30 font-mono text-[9px]">
                          {m.teamAFormation || '—'} / {m.teamBFormation || '—'}
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

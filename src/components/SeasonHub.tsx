import { useState } from 'react';
import type { SeasonRecord, TeamStanding, SeasonFixture } from '../seasonManager';
import {
  ALL_WORLD_TEAMS,
  WORLD_TEAM_GROUPS,
  getTeamGroup,
  createSeasonRecord,
  saveSeason,
  deleteSeason,
  loadSeason,
  getMatchdayFixtures,
  getPlayerFixture,
  simMatchday,
  simulateMatch,
  updateStandings,
  recordPlayerResult,
  advanceMatchday,
  getSortedStandings,
} from '../seasonManager';
import { DEFAULT_HOME_TEAM } from '../teamCatalog.js';

interface SeasonHubProps {
  /** Start the player's match in the game engine. */
  onPlayMatch: (home: string, away: string) => void;
  /** Callback when user exits season mode. */
  onExit: () => void;
  /** If the player just finished a match, these are the results. */
  lastMatchResult: { scoreA: number; scoreB: number } | null;
  /** Clear the last match result after it's consumed. */
  clearLastMatchResult: () => void;
}

type HubView = 'team_select' | 'matchday' | 'standings' | 'schedule';

export default function SeasonHub({ onPlayMatch, onExit, lastMatchResult, clearLastMatchResult }: SeasonHubProps) {
  const [season, setSeason] = useState<SeasonRecord | null>(() => loadSeason());
  const [view, setView] = useState<HubView>(season ? 'matchday' : 'team_select');
  const [selectedTeam, setSelectedTeam] = useState(DEFAULT_HOME_TEAM);
  const [matchdaySimmed, setMatchdaySimmed] = useState(false);
  const [viewStandingsConf, setViewStandingsConf] = useState<string>('All');
  const [scheduleViewMatchday, setScheduleViewMatchday] = useState<number | null>(null);

  // ── Consume match result from engine ──────────────────────────
  if (lastMatchResult && season && !matchdaySimmed) {
    const pf = getPlayerFixture(season, season.currentMatchday);
    if (pf && !pf.played) {
      // Determine ordering: player fixture stores home/away, engine always uses A=home, B=away
      recordPlayerResult(season, season.currentMatchday, lastMatchResult.scoreA, lastMatchResult.scoreB);
      // Sim the rest of the matchday
      simMatchday(season, season.currentMatchday);
      saveSeason(season);
      setSeason({ ...season });
      setMatchdaySimmed(true);
      clearLastMatchResult();
    }
  }

  // ── Handlers ──────────────────────────────────────────────────
  const handleStartSeason = () => {
    const newSeason = createSeasonRecord(selectedTeam);
    saveSeason(newSeason);
    setSeason(newSeason);
    setView('matchday');
    setMatchdaySimmed(false);
  };

  const handleDeleteSeason = () => {
    deleteSeason();
    setSeason(null);
    setView('team_select');
    setMatchdaySimmed(false);
  };

  const handlePlayMatch = () => {
    if (!season) return;
    const pf = getPlayerFixture(season, season.currentMatchday);
    if (!pf) return;
    onPlayMatch(pf.home, pf.away);
  };

  const handleSimPlayerMatch = () => {
    if (!season) return;
    // Sim all fixtures for current matchday (including player's)
    const fixtures = getMatchdayFixtures(season, season.currentMatchday);
    for (const f of fixtures) {
      if (!f.played) {
        f.result = simulateMatch(f.home, f.away);
        f.played = true;
      }
    }
    updateStandings(season);
    saveSeason(season);
    setSeason({ ...season });
    setMatchdaySimmed(true);
  };

  const handleNextMatchday = () => {
    if (!season) return;
    const more = advanceMatchday(season);
    saveSeason(season);
    setSeason({ ...season });
    setMatchdaySimmed(false);
    if (!more) {
      setView('standings');
    }
  };

  // ── Render helpers ────────────────────────────────────────────
  const matchdayComplete = (s: SeasonRecord): boolean => {
    return getMatchdayFixtures(s, s.currentMatchday).every(f => f.played);
  };

  // ── Team Select ───────────────────────────────────────────────
  if (view === 'team_select' || !season) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6 w-full max-w-md px-6">
          <img src="/assets/Pixel%20Soccer%20League2.png" alt="Pixel Soccer League" className="w-[36rem] max-w-[92vw] drop-shadow-lg" />
          <div className="text-amber-400 text-xl font-extrabold tracking-widest uppercase">Season Mode</div>

          {season && (
            <div className="w-full bg-zinc-800/60 border border-white/10 rounded-lg p-4 flex flex-col gap-3">
              <div className="text-white/60 text-[10px] uppercase tracking-widest">Existing Season Found</div>
              <div className="text-white text-sm">{season.playerTeam} — Matchday {season.currentMatchday}/{season.totalMatchdays}</div>
              <div className="flex gap-2">
                <button onClick={() => setView('matchday')} className="flex-1 py-2 border border-white/20 text-white text-xs uppercase tracking-widest rounded hover:bg-white hover:text-black transition-colors">
                  Continue
                </button>
                <button onClick={handleDeleteSeason} className="py-2 px-4 border border-red-500/30 text-red-400 text-xs uppercase tracking-widest rounded hover:bg-red-500/20 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="w-full flex flex-col gap-3">
            <div className="text-white/40 text-[10px] uppercase tracking-widest text-center">Select Your Team</div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-h-[320px] overflow-y-auto pr-1">
              {WORLD_TEAM_GROUPS.map((group) => (
                <div key={group}>
                  <div className="text-amber-400/70 text-[9px] uppercase tracking-widest mb-1 sticky top-0 bg-black/80 py-0.5">{group}</div>
                  {ALL_WORLD_TEAMS.filter(t => getTeamGroup(t) === group).map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTeam(t)}
                      className={`w-full text-left text-[11px] py-1 px-2 rounded transition-colors ${
                        selectedTeam === t
                          ? 'bg-amber-400/20 text-amber-300 font-bold'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={handleStartSeason}
              className="w-full py-3 bg-amber-500 text-black text-sm font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
            >
              Start Season as {selectedTeam}
            </button>
          </div>

          <button onClick={onExit} className="text-white/30 text-[10px] uppercase tracking-widest hover:text-white/60 transition-colors">
            Back to Exhibition
          </button>
        </div>
      </div>
    );
  }

  // ── Matchday View ────────────────────────────────────────────
  if (view === 'matchday') {
    const fixtures = getMatchdayFixtures(season, season.currentMatchday);
    const playerFix = getPlayerFixture(season, season.currentMatchday);
    const allDone = matchdayComplete(season);
    const isSeasonOver = season.phase === 'completed';

    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 w-full max-w-lg px-6 max-h-[calc(100vh-40px)] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1">
              <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase">
                {isSeasonOver ? 'Season Complete' : `Matchday ${season.currentMatchday}`}
              </div>
              <div className="text-white/40 text-[10px]">{season.playerTeam} — {season.currentMatchday}/{season.totalMatchdays}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setView('standings')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
                Standings
              </button>
              <button onClick={() => { setScheduleViewMatchday(season.currentMatchday); setView('schedule'); }} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
                Schedule
              </button>
            </div>
          </div>

          {/* Player's match highlight */}
          {playerFix && (
            <div className={`w-full rounded-lg border p-4 ${
              playerFix.played
                ? 'bg-zinc-800/40 border-white/10'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="text-[9px] uppercase tracking-widest text-amber-400/70 mb-2">Your Match</div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <span className={`text-sm font-bold ${playerFix.home === season.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>
                    {playerFix.home}
                  </span>
                  <span className="text-white/30 text-[9px] uppercase">Home</span>
                </div>
                {playerFix.played && playerFix.result ? (
                  <div className="text-white text-3xl font-black tabular-nums">
                    {playerFix.result.homeGoals} - {playerFix.result.awayGoals}
                  </div>
                ) : (
                  <div className="text-white/30 text-xl">vs</div>
                )}
                <div className="flex flex-col items-center gap-1 flex-1">
                  <span className={`text-sm font-bold ${playerFix.away === season.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>
                    {playerFix.away}
                  </span>
                  <span className="text-white/30 text-[9px] uppercase">Away</span>
                </div>
              </div>
              {!playerFix.played && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handlePlayMatch}
                    className="flex-1 py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
                  >
                    Play Match
                  </button>
                  <button
                    onClick={handleSimPlayerMatch}
                    className="py-2.5 px-4 border border-white/20 text-white/50 text-xs uppercase tracking-widest rounded hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Sim
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Other results */}
          <div className="w-full flex flex-col gap-1">
            <div className="text-white/30 text-[9px] uppercase tracking-widest mb-1">Other Matches</div>
            {fixtures.filter(f => !f.isPlayerGame).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] py-1 border-b border-white/5">
                <span className="flex-1 text-right text-white/60 truncate">{f.home}</span>
                {f.played && f.result ? (
                  <span className="text-white font-bold tabular-nums w-16 text-center shrink-0">{f.result.homeGoals} - {f.result.awayGoals}</span>
                ) : (
                  <span className="text-white/20 w-16 text-center shrink-0">-</span>
                )}
                <span className="flex-1 text-white/60 truncate">{f.away}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            {allDone && !isSeasonOver && (
              <button
                onClick={handleNextMatchday}
                className="flex-1 py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
              >
                Next Matchday
              </button>
            )}
            {isSeasonOver && (
              <button
                onClick={() => setView('standings')}
                className="flex-1 py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
              >
                Final Standings
              </button>
            )}
            <button
              onClick={onExit}
              className="py-2.5 px-4 border border-white/20 text-white/40 text-xs uppercase tracking-widest rounded hover:text-white hover:border-white/40 transition-colors"
            >
              Exit Season
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Standings View ────────────────────────────────────────────
  if (view === 'standings') {
    const standings = viewStandingsConf === 'All'
      ? getSortedStandings(season)
      : getSortedStandings(season, viewStandingsConf);

    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 w-full max-w-xl px-6 max-h-[calc(100vh-40px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Standings</div>
            <button onClick={() => setView('matchday')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors">
              Back
            </button>
          </div>

          {/* Team-group filter */}
          <div className="flex gap-2 w-full">
            {(['All', ...WORLD_TEAM_GROUPS] as const).map(conf => (
              <button
                key={conf}
                onClick={() => setViewStandingsConf(conf)}
                className={`py-1 px-3 text-[10px] uppercase tracking-widest rounded border transition-colors ${
                  viewStandingsConf === conf
                    ? 'border-amber-500/50 text-amber-300 bg-amber-500/10'
                    : 'border-white/10 text-white/40 hover:text-white/60'
                }`}
              >
                {conf}
              </button>
            ))}
          </div>

          {/* Table */}
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-white/30 uppercase text-[9px] tracking-widest">
                <th className="text-left py-1 w-6">#</th>
                <th className="text-left py-1">Team</th>
                <th className="py-1 w-6">GP</th>
                <th className="py-1 w-6">W</th>
                <th className="py-1 w-6">D</th>
                <th className="py-1 w-6">L</th>
                <th className="py-1 w-8">GF</th>
                <th className="py-1 w-8">GA</th>
                <th className="py-1 w-8">GD</th>
                <th className="py-1 w-8 text-amber-400/70">PTS</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.team}
                  className={`border-t border-white/5 ${s.team === season.playerTeam ? 'bg-amber-500/10' : ''}`}
                >
                  <td className="py-1 text-white/30">{i + 1}</td>
                  <td className={`py-1 font-medium truncate max-w-[160px] ${s.team === season.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>
                    {s.team}
                  </td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{s.gp}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{s.w}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{s.d}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{s.l}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{s.gf}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{s.ga}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="py-1 text-center font-bold text-amber-400 tabular-nums">{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {season.phase === 'completed' && (
            <div className="w-full flex flex-col gap-2 items-center pt-2">
              <div className="text-amber-400 text-sm font-bold uppercase tracking-widest">
                Champion: {getSortedStandings(season)[0]?.team}
              </div>
              <button
                onClick={handleDeleteSeason}
                className="py-2 px-6 border border-white/20 text-white/50 text-xs uppercase tracking-widest rounded hover:bg-white/10 hover:text-white transition-colors"
              >
                New Season
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Schedule View ─────────────────────────────────────────────
  if (view === 'schedule') {
    const viewMd = scheduleViewMatchday ?? season.currentMatchday;
    const fixtures = getMatchdayFixtures(season, viewMd);

    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 w-full max-w-lg px-6 max-h-[calc(100vh-40px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Schedule</div>
            <button onClick={() => setView('matchday')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors">
              Back
            </button>
          </div>

          {/* Matchday selector */}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => setScheduleViewMatchday(Math.max(1, viewMd - 1))}
              disabled={viewMd <= 1}
              className="py-1 px-3 border border-white/20 text-white/60 text-xs rounded hover:text-white disabled:opacity-20 transition-colors"
            >
              {'<'}
            </button>
            <div className="flex-1 text-center text-white text-sm font-bold">Matchday {viewMd}</div>
            <button
              onClick={() => setScheduleViewMatchday(Math.min(season.totalMatchdays, viewMd + 1))}
              disabled={viewMd >= season.totalMatchdays}
              className="py-1 px-3 border border-white/20 text-white/60 text-xs rounded hover:text-white disabled:opacity-20 transition-colors"
            >
              {'>'}
            </button>
          </div>

          {/* Fixtures list */}
          <div className="w-full flex flex-col gap-1">
            {fixtures.map((f, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-[11px] py-1.5 border-b border-white/5 ${
                  f.isPlayerGame ? 'bg-amber-500/10 rounded px-2' : ''
                }`}
              >
                <span className={`flex-1 text-right truncate ${f.home === season.playerTeam ? 'text-amber-300 font-bold' : 'text-white/60'}`}>
                  {f.home}
                </span>
                {f.played && f.result ? (
                  <span className="text-white font-bold tabular-nums w-16 text-center shrink-0">{f.result.homeGoals} - {f.result.awayGoals}</span>
                ) : (
                  <span className="text-white/20 w-16 text-center shrink-0">-</span>
                )}
                <span className={`flex-1 truncate ${f.away === season.playerTeam ? 'text-amber-300 font-bold' : 'text-white/60'}`}>
                  {f.away}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

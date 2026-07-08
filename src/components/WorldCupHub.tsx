import { useEffect, useState } from 'react';
import { DEFAULT_HOME_TEAM } from '../teamCatalog.js';
import {
  deleteWorldCup,
  createWorldCupRecord,
  loadWorldCup,
  saveWorldCup,
  getCurrentRoundFixtures,
  getPlayerFixture,
  simCurrentRound,
  recordPlayerResult,
  advanceWorldCup,
  getAllGroupStandings,
  getGroupStandings,
  getQualifiedTeams,
  getKnockoutFixtures,
  availableKnockoutStages,
  stageLabel,
  fixtureScoreLabel,
  type WorldCupRecord,
  type WorldCupFixture,
} from '../worldCupManager';
import { WORLD_CUP_2026_TEAM_NAMES } from '../teamCatalog.js';
import { FIFA_WORLD_CUP_2026_GROUPS } from '../worldCup2026Schedule.js';

interface WorldCupHubProps {
  onPlayMatch: (home: string, away: string) => void;
  onExit: () => void;
  lastMatchResult: { scoreA: number; scoreB: number } | null;
  clearLastMatchResult: () => void;
}

type HubView = 'team_select' | 'stage' | 'groups' | 'schedule' | 'bracket';

function playerGroup(team: string) {
  return Object.entries(FIFA_WORLD_CUP_2026_GROUPS).find(([, teams]) => teams.includes(team))?.[0] || 'A';
}

function roundComplete(worldCup: WorldCupRecord) {
  return getCurrentRoundFixtures(worldCup).every((fixture) => fixture.played);
}

function fixtureRow(fixture: WorldCupFixture, playerTeam: string) {
  return (
    <div
      key={fixture.id}
      className={`flex items-center gap-2 text-[11px] py-1.5 border-b border-white/5 ${
        fixture.home === playerTeam || fixture.away === playerTeam ? 'bg-amber-500/10 rounded px-2' : ''
      }`}
    >
      <span className={`flex-1 text-right truncate ${fixture.home === playerTeam ? 'text-amber-300 font-bold' : 'text-white/60'}`}>
        {fixture.home}
      </span>
      <span className="text-white font-bold tabular-nums w-20 text-center shrink-0">
        {fixtureScoreLabel(fixture)}
      </span>
      <span className={`flex-1 truncate ${fixture.away === playerTeam ? 'text-amber-300 font-bold' : 'text-white/60'}`}>
        {fixture.away}
      </span>
    </div>
  );
}

export default function WorldCupHub({
  onPlayMatch,
  onExit,
  lastMatchResult,
  clearLastMatchResult,
}: WorldCupHubProps) {
  const [worldCup, setWorldCup] = useState<WorldCupRecord | null>(() => loadWorldCup());
  const [view, setView] = useState<HubView>(worldCup ? 'stage' : 'team_select');
  const [selectedTeam, setSelectedTeam] = useState(DEFAULT_HOME_TEAM);
  const [consumedResult, setConsumedResult] = useState(false);
  const [viewGroup, setViewGroup] = useState<string>(() => playerGroup(DEFAULT_HOME_TEAM));

  useEffect(() => {
    if (!lastMatchResult || !worldCup || consumedResult) return;
    const fixture = getPlayerFixture(worldCup);
    if (!fixture || fixture.played) return;
    const next = structuredClone(worldCup) as WorldCupRecord;
    recordPlayerResult(next, lastMatchResult.scoreA, lastMatchResult.scoreB);
    simCurrentRound(next);
    saveWorldCup(next);
    setWorldCup(next);
    setConsumedResult(true);
    clearLastMatchResult();
  }, [lastMatchResult, worldCup, consumedResult, clearLastMatchResult]);

  useEffect(() => {
    if (!lastMatchResult) {
      setConsumedResult(false);
    }
  }, [lastMatchResult]);

  const handleStartWorldCup = () => {
    const next = createWorldCupRecord(selectedTeam);
    saveWorldCup(next);
    setWorldCup(next);
    setView('stage');
    setViewGroup(playerGroup(selectedTeam));
  };

  const handleDeleteWorldCup = () => {
    deleteWorldCup();
    setWorldCup(null);
    setView('team_select');
  };

  const handlePlayMatch = () => {
    if (!worldCup) return;
    const fixture = getPlayerFixture(worldCup);
    if (!fixture || fixture.played) return;
    onPlayMatch(fixture.home, fixture.away);
  };

  const handleSimRound = () => {
    if (!worldCup) return;
    const next = structuredClone(worldCup) as WorldCupRecord;
    simCurrentRound(next);
    saveWorldCup(next);
    setWorldCup(next);
  };

  const handleAdvance = () => {
    if (!worldCup) return;
    const next = structuredClone(worldCup) as WorldCupRecord;
    advanceWorldCup(next);
    saveWorldCup(next);
    setWorldCup(next);
  };

  if (view === 'team_select' || !worldCup) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6 w-full max-w-md px-6">
          <img src="/assets/Pixel%20Soccer%20League2.png" alt="Pixel Soccer League" className="w-[36rem] max-w-[92vw] drop-shadow-lg" />
          <div className="text-amber-400 text-xl font-extrabold tracking-widest uppercase">World Cup Mode</div>

          {worldCup && (
            <div className="w-full bg-zinc-800/60 border border-white/10 rounded-lg p-4 flex flex-col gap-3">
              <div className="text-white/60 text-[10px] uppercase tracking-widest">Existing Tournament Found</div>
              <div className="text-white text-sm">{worldCup.playerTeam} — {stageLabel(worldCup.currentStage, worldCup.currentRound)}</div>
              <div className="flex gap-2">
                <button onClick={() => setView('stage')} className="flex-1 py-2 border border-white/20 text-white text-xs uppercase tracking-widest rounded hover:bg-white hover:text-black transition-colors">
                  Continue
                </button>
                <button onClick={handleDeleteWorldCup} className="py-2 px-4 border border-red-500/30 text-red-400 text-xs uppercase tracking-widest rounded hover:bg-red-500/20 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="w-full flex flex-col gap-3">
            <div className="text-white/40 text-[10px] uppercase tracking-widest text-center">Select Your Team</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-h-[320px] overflow-y-auto pr-1">
              {Object.entries(FIFA_WORLD_CUP_2026_GROUPS).map(([group, teams]) => (
                <div key={group}>
                  <div className="text-amber-400/70 text-[9px] uppercase tracking-widest mb-1 sticky top-0 bg-black/80 py-0.5">Group {group}</div>
                  {teams.map((team) => (
                    <button
                      key={team}
                      onClick={() => setSelectedTeam(team)}
                      className={`w-full text-left text-[11px] py-1 px-2 rounded transition-colors ${
                        selectedTeam === team
                          ? 'bg-amber-400/20 text-amber-300 font-bold'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button
              onClick={handleStartWorldCup}
              className="w-full py-3 bg-amber-500 text-black text-sm font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
            >
              Start World Cup as {selectedTeam}
            </button>
          </div>

          <button onClick={onExit} className="text-white/30 text-[10px] uppercase tracking-widest hover:text-white/60 transition-colors">
            Back to Exhibition
          </button>
        </div>
      </div>
    );
  }

  if (view === 'groups') {
    const groups = getAllGroupStandings(worldCup);
    const qualified = getQualifiedTeams(worldCup);
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 w-full max-w-4xl px-6 max-h-[calc(100vh-40px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Group Tables</div>
            <button onClick={() => setView('stage')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors">
              Back
            </button>
          </div>
          <div className="flex gap-2 w-full flex-wrap">
            {Object.keys(FIFA_WORLD_CUP_2026_GROUPS).map((group) => (
              <button
                key={group}
                onClick={() => setViewGroup(group)}
                className={`py-1 px-3 text-[10px] uppercase tracking-widest rounded border transition-colors ${
                  viewGroup === group ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-white/10 text-white/40 hover:text-white/60'
                }`}
              >
                Group {group}
              </button>
            ))}
          </div>
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
              {getGroupStandings(worldCup, viewGroup).map((row, index) => (
                <tr key={row.team} className={`border-t border-white/5 ${row.team === worldCup.playerTeam ? 'bg-amber-500/10' : ''}`}>
                  <td className="py-1 text-white/30">{index + 1}</td>
                  <td className={`py-1 font-medium truncate max-w-[160px] ${row.team === worldCup.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>{row.team}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{row.gp}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{row.w}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{row.d}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{row.l}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{row.gf}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{row.ga}</td>
                  <td className="py-1 text-center text-white/50 tabular-nums">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                  <td className="py-1 text-center font-bold text-amber-400 tabular-nums">{row.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="w-full text-[10px] uppercase tracking-widest text-white/40">
            Current best third-place qualifiers: {qualified.filter((row) => row.finish === 3).map((row) => row.team).join(', ')}
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
            {groups.map(({ group, standings }) => (
              <div key={group} className="rounded border border-white/10 bg-zinc-900/70 p-3">
                <div className="text-amber-400/80 text-[10px] uppercase tracking-widest mb-2">Group {group}</div>
                {standings.map((row, index) => (
                  <div key={row.team} className={`flex items-center justify-between text-[11px] py-1 ${row.team === worldCup.playerTeam ? 'text-amber-300' : 'text-white/60'}`}>
                    <span>{index + 1}. {row.team}</span>
                    <span className="tabular-nums">{row.pts} pts</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'schedule') {
    const fixtures = getCurrentRoundFixtures(worldCup);
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 w-full max-w-lg px-6 max-h-[calc(100vh-40px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Current Round</div>
            <button onClick={() => setView('stage')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors">
              Back
            </button>
          </div>
          <div className="w-full text-center text-white/50 text-[10px] uppercase tracking-widest">{stageLabel(worldCup.currentStage, worldCup.currentRound)}</div>
          <div className="w-full flex flex-col gap-1">
            {fixtures.map((fixture) => fixtureRow(fixture, worldCup.playerTeam))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'bracket') {
    const stages = availableKnockoutStages(worldCup);
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 w-full max-w-3xl px-6 max-h-[calc(100vh-40px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Knockout Bracket</div>
            <button onClick={() => setView('stage')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors">
              Back
            </button>
          </div>
          {stages.length === 0 && (
            <div className="text-white/40 text-sm">Knockout bracket unlocks after the group stage.</div>
          )}
          {stages.map((stage) => (
            <div key={stage} className="w-full rounded border border-white/10 bg-zinc-900/70 p-4">
              <div className="text-amber-400/80 text-[10px] uppercase tracking-widest mb-2">{stageLabel(stage, 1)}</div>
              <div className="w-full flex flex-col gap-1">
                {getKnockoutFixtures(worldCup, stage).map((fixture) => fixtureRow(fixture, worldCup.playerTeam))}
              </div>
            </div>
          ))}
          {worldCup.champion && (
            <div className="text-amber-400 text-lg font-bold uppercase tracking-widest">Champion: {worldCup.champion}</div>
          )}
        </div>
      </div>
    );
  }

  const fixtures = getCurrentRoundFixtures(worldCup);
  const playerFixture = getPlayerFixture(worldCup);
  const allDone = roundComplete(worldCup);
  const canPlay = !!playerFixture && !playerFixture.played;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 w-full max-w-lg px-6 max-h-[calc(100vh-40px)] overflow-y-auto">
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase">
              {stageLabel(worldCup.currentStage, worldCup.currentRound)}
            </div>
            <div className="text-white/40 text-[10px]">{worldCup.playerTeam}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('groups')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
              Groups
            </button>
            <button onClick={() => setView('schedule')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
              Schedule
            </button>
            <button onClick={() => setView('bracket')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
              Bracket
            </button>
          </div>
        </div>

        {playerFixture ? (
          <div className={`w-full rounded-lg border p-4 ${playerFixture.played ? 'bg-zinc-800/40 border-white/10' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <div className="text-[9px] uppercase tracking-widest text-amber-400/70 mb-2">Your Match</div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1 flex-1">
                <span className={`text-sm font-bold ${playerFixture.home === worldCup.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>{playerFixture.home}</span>
                <span className="text-white/30 text-[9px] uppercase">Home</span>
              </div>
              {playerFixture.played && playerFixture.result ? (
                <div className="text-white text-3xl font-black tabular-nums">{fixtureScoreLabel(playerFixture)}</div>
              ) : (
                <div className="text-white/30 text-xl">vs</div>
              )}
              <div className="flex flex-col items-center gap-1 flex-1">
                <span className={`text-sm font-bold ${playerFixture.away === worldCup.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>{playerFixture.away}</span>
                <span className="text-white/30 text-[9px] uppercase">Away</span>
              </div>
            </div>
            {canPlay && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handlePlayMatch}
                  className="flex-1 py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
                >
                  Play Match
                </button>
                <button
                  onClick={handleSimRound}
                  className="py-2.5 px-4 border border-white/20 text-white/50 text-xs uppercase tracking-widest rounded hover:bg-white/10 hover:text-white transition-colors"
                >
                  Sim Round
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full rounded-lg border border-white/10 bg-zinc-800/40 p-4 text-center">
            <div className="text-[9px] uppercase tracking-widest text-white/40 mb-2">Current Status</div>
            <div className="text-white/70 text-sm">
              {worldCup.currentStage === 'completed'
                ? `Champion: ${worldCup.champion ?? 'TBD'}`
                : 'Your team is not playing in this round.'}
            </div>
          </div>
        )}

        <div className="w-full flex flex-col gap-1">
          <div className="text-white/30 text-[9px] uppercase tracking-widest mb-1">Round Fixtures</div>
          {fixtures.map((fixture) => fixtureRow(fixture, worldCup.playerTeam))}
        </div>

        <div className="flex gap-2 w-full">
          {!allDone && !canPlay && worldCup.currentStage !== 'completed' && (
            <button
              onClick={handleSimRound}
              className="flex-1 py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
            >
              Sim Round
            </button>
          )}
          {allDone && worldCup.currentStage !== 'completed' && (
            <button
              onClick={handleAdvance}
              className="flex-1 py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
            >
              {worldCup.currentStage === 'group' && worldCup.currentRound < 3 ? 'Next Round' : 'Advance Stage'}
            </button>
          )}
          {worldCup.currentStage === 'completed' && (
            <button
              onClick={handleDeleteWorldCup}
              className="flex-1 py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-amber-400 transition-colors"
            >
              New World Cup
            </button>
          )}
          <button
            onClick={onExit}
            className="py-2.5 px-4 border border-white/20 text-white/40 text-xs uppercase tracking-widest rounded hover:text-white hover:border-white/40 transition-colors"
          >
            Exit World Cup
          </button>
        </div>
      </div>
    </div>
  );
}

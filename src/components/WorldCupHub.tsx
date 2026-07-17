import { useEffect, useRef, useState } from 'react';
import { DEFAULT_HOME_TEAM, getWorldCupTeamFlag } from '../teamCatalog.js';
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
  getPlayerGroup,
  getQualifiedTeams,
  getKnockoutFixtures,
  availableKnockoutStages,
  stageLabel,
  fixtureScoreLabel,
  type WorldCupRecord,
  type WorldCupFixture,
} from '../worldCupManager';
import { FIFA_WORLD_CUP_2026_GROUPS } from '../worldCup2026Schedule.js';
import { exportElementAsPng, renderElementToPngDataUrl, sanitizeFilePart } from '../utils/exportElementAsPng';

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

function qualificationTone(index: number, qualifiedThirds: Set<string>, team: string) {
  if (index < 2) return 'text-emerald-300';
  if (qualifiedThirds.has(team)) return 'text-cyan-300';
  return 'text-white/70';
}

function fixtureMetaLabel(fixture: WorldCupFixture) {
  if (fixture.stage === 'group') {
    return `Group ${fixture.group} · Match ${fixture.matchNumber ?? '-'}`;
  }
  return fixture.result?.decidedBy === 'tiebreak' ? 'Advanced on tiebreak' : 'Knockout';
}

function fixtureRow(fixture: WorldCupFixture, playerTeam: string) {
  return (
    <div
      key={fixture.id}
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[12px] py-2 border-b border-white/5 ${
        fixture.home === playerTeam || fixture.away === playerTeam ? 'bg-amber-500/10 rounded px-3' : ''
      }`}
    >
      <span className={`min-w-0 text-right break-words leading-tight ${fixture.home === playerTeam ? 'text-amber-300 font-bold' : 'text-white/60'}`}>
        {fixture.home}
      </span>
      <span className="text-white font-bold tabular-nums min-w-[5.75rem] text-center shrink-0">
        {fixtureScoreLabel(fixture)}
      </span>
      <span className={`min-w-0 break-words leading-tight ${fixture.away === playerTeam ? 'text-amber-300 font-bold' : 'text-white/60'}`}>
        {fixture.away}
      </span>
      <span className="col-span-3 text-right text-[10px] uppercase tracking-[0.2em] text-white/25 md:col-span-1 md:w-36">
        {fixtureMetaLabel(fixture)}
      </span>
    </div>
  );
}

function summarizeTeamRecord(worldCup: WorldCupRecord, team: string) {
  const fixtures = [...worldCup.groupFixtures, ...worldCup.knockoutFixtures].filter((fixture) => fixture.played && fixture.result && (fixture.home === team || fixture.away === team));
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;

  for (const fixture of fixtures) {
    if (!fixture.result) continue;
    const isHome = fixture.home === team;
    const scored = isHome ? fixture.result.homeGoals : fixture.result.awayGoals;
    const conceded = isHome ? fixture.result.awayGoals : fixture.result.homeGoals;
    gf += scored;
    ga += conceded;
    const winner = fixture.result.winner;
    if (!winner) {
      draws += 1;
    } else if (winner === team) {
      wins += 1;
    } else {
      losses += 1;
    }
  }

  return {
    matches: fixtures.length,
    wins,
    draws,
    losses,
    gf,
    ga,
    gd: gf - ga,
  };
}

function topScorers(worldCup: WorldCupRecord, limit = 3) {
  const counts = new Map<string, { name: string; team: string; goals: number }>();
  const fixtures = [...worldCup.groupFixtures, ...worldCup.knockoutFixtures];
  for (const fixture of fixtures) {
    if (!fixture.result) continue;
    for (const scorer of fixture.result.homeScorers || []) {
      const current = counts.get(scorer) || { name: scorer, team: fixture.home, goals: 0 };
      current.goals += 1;
      counts.set(scorer, current);
    }
    for (const scorer of fixture.result.awayScorers || []) {
      const current = counts.get(scorer) || { name: scorer, team: fixture.away, goals: 0 };
      current.goals += 1;
      counts.set(scorer, current);
    }
  }
  return [...counts.values()]
    .sort((a, b) => (b.goals - a.goals) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function scorersLabel(fixture: WorldCupFixture) {
  if (!fixture.result) return '';
  const home = fixture.result.homeScorers?.length ? fixture.result.homeScorers.join(', ') : 'No scorers';
  const away = fixture.result.awayScorers?.length ? fixture.result.awayScorers.join(', ') : 'No scorers';
  return `${home} · ${away}`;
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
  const [exportState, setExportState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const exportRootRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    (window as any).__pslWorldCupTest = {
      snapshot: () => (worldCup ? structuredClone(worldCup) : null),
      startAs: (team: string) => {
        const next = createWorldCupRecord(team);
        saveWorldCup(next);
        setWorldCup(next);
        setView('stage');
        setViewGroup(playerGroup(team));
      },
      simRound: () => {
        if (!worldCup) return null;
        const next = structuredClone(worldCup) as WorldCupRecord;
        simCurrentRound(next);
        saveWorldCup(next);
        setWorldCup(next);
        return structuredClone(next);
      },
      advance: () => {
        if (!worldCup) return null;
        const next = structuredClone(worldCup) as WorldCupRecord;
        advanceWorldCup(next);
        saveWorldCup(next);
        setWorldCup(next);
        return structuredClone(next);
      },
      clear: () => {
        deleteWorldCup();
        setWorldCup(null);
        setView('team_select');
      },
      setView: (nextView: HubView, nextGroup?: string) => {
        setView(nextView);
        if (nextGroup) {
          setViewGroup(nextGroup);
        }
      },
      exportCurrentView: async (fileStem?: string) => {
        if (!exportRootRef.current) return null;
        const stem = sanitizeFilePart(fileStem || `worldcup-${view}-${worldCup?.playerTeam || selectedTeam}`);
        const dataUrl = await renderElementToPngDataUrl(exportRootRef.current);
        return { fileStem: stem, dataUrl };
      },
    };
    return () => {
      delete (window as any).__pslWorldCupTest;
    };
  }, [selectedTeam, view, viewGroup, worldCup]);

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

  const handleExportScreenshot = async (fileStem: string) => {
    if (!exportRootRef.current || exportState === 'saving') return;
    setExportState('saving');
    try {
      await exportElementAsPng(exportRootRef.current, fileStem);
      setExportState('done');
      window.setTimeout(() => setExportState('idle'), 1500);
    } catch (error) {
      console.error('World Cup screenshot export failed', error);
      setExportState('error');
      window.setTimeout(() => setExportState('idle'), 2000);
    }
  };

  const exportButtonLabel =
    exportState === 'saving'
      ? 'Saving...'
      : exportState === 'done'
        ? 'Saved PNG'
        : exportState === 'error'
          ? 'Export Failed'
          : 'Save PNG';

  if (view === 'team_select' || !worldCup) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div data-testid="worldcup-capture-root" ref={exportRootRef} className="flex flex-col items-center gap-6 w-full max-w-5xl px-6 py-8">
          <img src="/assets/Pixel%20Soccer%20League2.png" alt="Pixel Soccer League" className="w-[38rem] max-w-[92vw] drop-shadow-lg" />
          <div className="flex w-full items-center gap-4">
            <div className="text-amber-400 text-xl font-extrabold tracking-widest uppercase flex-1">World Cup Mode</div>
            <button
              data-export-ignore="true"
              onClick={() => handleExportScreenshot(`worldcup-team-select-${selectedTeam}`)}
              className="py-2 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors"
            >
              {exportButtonLabel}
            </button>
          </div>

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

          <div className="w-full flex flex-col gap-4">
            <div className="text-white/40 text-[11px] uppercase tracking-widest text-center">Select Your Team</div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 max-h-[62vh] overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(FIFA_WORLD_CUP_2026_GROUPS).map(([group, teams]) => (
                <div key={group}>
                  <div className="text-amber-400/70 text-[10px] uppercase tracking-widest mb-2 sticky top-0 bg-black/90 py-1">Group {group}</div>
                  {teams.map((team) => (
                    <button
                      key={team}
                      onClick={() => setSelectedTeam(team)}
                      className={`w-full text-left text-[12px] py-1.5 px-3 rounded transition-colors ${
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

  const activePlayerGroup = getPlayerGroup(worldCup) || playerGroup(worldCup.playerTeam);
  const playerGroupTable = getGroupStandings(worldCup, activePlayerGroup);
  const qualifiedThirds = new Set(getQualifiedTeams(worldCup).filter((row) => row.finish === 3).map((row) => row.team));
  const playerStanding = playerGroupTable.find((row) => row.team === worldCup.playerTeam) || null;
  const championRecord = worldCup.champion ? summarizeTeamRecord(worldCup, worldCup.champion) : null;
  const playerRecord = summarizeTeamRecord(worldCup, worldCup.playerTeam);
  const goldenBoot = topScorers(worldCup, 3);
  const finalFixture = worldCup.knockoutFixtures.find((fixture) => fixture.stage === 'final') || null;
  const thirdPlaceFixture = worldCup.knockoutFixtures.find((fixture) => fixture.stage === 'third_place') || null;

  if (view === 'groups') {
    const groups = getAllGroupStandings(worldCup);
    const qualified = getQualifiedTeams(worldCup);
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div data-testid="worldcup-capture-root" ref={exportRootRef} className="flex flex-col items-center gap-5 w-full max-w-6xl px-6 py-6 max-h-[calc(100vh-24px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Group Tables</div>
            <button
              data-export-ignore="true"
              onClick={() => handleExportScreenshot(`worldcup-groups-${viewGroup}-${worldCup.playerTeam}`)}
              className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors"
            >
              {exportButtonLabel}
            </button>
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
          <table className="w-full min-w-[760px] text-[12px]">
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
                  <td className={`py-1 font-medium break-words ${row.team === worldCup.playerTeam ? 'text-amber-300' : qualificationTone(index, qualifiedThirds, row.team)}`}>{row.team}</td>
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
            Top two qualify automatically. Best third-place qualifiers: {qualified.filter((row) => row.finish === 3).map((row) => row.team).join(', ')}
          </div>
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <div data-testid="worldcup-capture-root" ref={exportRootRef} className="flex flex-col items-center gap-5 w-full max-w-4xl px-6 py-6 max-h-[calc(100vh-24px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Current Round</div>
            <button
              data-export-ignore="true"
              onClick={() => handleExportScreenshot(`worldcup-schedule-${worldCup.playerTeam}-${worldCup.currentStage}-${worldCup.currentRound}`)}
              className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors"
            >
              {exportButtonLabel}
            </button>
            <button onClick={() => setView('stage')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors">
              Back
            </button>
          </div>
          <div className="w-full text-center text-white/50 text-[10px] uppercase tracking-widest">{stageLabel(worldCup.currentStage, worldCup.currentRound)}</div>
          <div className="w-full flex flex-col gap-1.5">
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
        <div data-testid="worldcup-capture-root" ref={exportRootRef} className="flex flex-col items-center gap-5 w-full max-w-6xl px-6 py-6 max-h-[calc(100vh-24px)] overflow-y-auto">
          <div className="flex items-center gap-4 w-full">
            <div className="text-amber-400 text-lg font-extrabold tracking-widest uppercase flex-1">Knockout Bracket</div>
            <button
              data-export-ignore="true"
              onClick={() => handleExportScreenshot(`worldcup-bracket-${worldCup.playerTeam}-${worldCup.currentStage}`)}
              className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors"
            >
              {exportButtonLabel}
            </button>
            <button onClick={() => setView('stage')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white transition-colors">
              Back
            </button>
          </div>
          {stages.length === 0 && (
            <div className="text-white/40 text-sm">Knockout bracket unlocks after the group stage.</div>
          )}
          {stages.map((stage) => (
            <div key={stage} className="w-full rounded border border-white/10 bg-zinc-900/70 p-5">
              <div className="text-amber-400/80 text-[10px] uppercase tracking-widest mb-2">{stageLabel(stage, 1)}</div>
              <div className="w-full flex flex-col gap-1.5">
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
  const isComplete = worldCup.currentStage === 'completed';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div data-testid="worldcup-capture-root" ref={exportRootRef} className="flex flex-col items-center gap-5 w-full max-w-6xl px-4 py-6 sm:px-6 max-h-[calc(100vh-24px)] overflow-y-auto overflow-x-hidden">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-amber-400 text-xl font-extrabold tracking-widest uppercase">
              {stageLabel(worldCup.currentStage, worldCup.currentRound)}
            </div>
            <div className="text-white/40 text-[12px]">{worldCup.playerTeam}</div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <button onClick={() => setView('groups')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
              Groups
            </button>
            <button onClick={() => setView('schedule')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
              Schedule
            </button>
            <button onClick={() => setView('bracket')} className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors">
              Bracket
            </button>
            <button
              data-export-ignore="true"
              onClick={() => handleExportScreenshot(`worldcup-stage-${worldCup.playerTeam}-${worldCup.currentStage}-${worldCup.currentRound}`)}
              className="py-1 px-3 border border-white/20 text-white/60 text-[10px] uppercase rounded hover:text-white hover:border-white/40 transition-colors"
            >
              {exportButtonLabel}
            </button>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded border border-white/10 bg-zinc-900/70 p-4">
            <div className="text-[9px] uppercase tracking-widest text-white/35 mb-1">Team</div>
            <div className="flex items-center gap-2 text-amber-300 text-sm font-bold">
              <span className="text-xl leading-none">{getWorldCupTeamFlag(worldCup.playerTeam)}</span>
              <span>{worldCup.playerTeam}</span>
            </div>
            <div className="text-white/35 text-[10px] uppercase tracking-widest mt-1">Group {activePlayerGroup}</div>
          </div>
          <div className="rounded border border-white/10 bg-zinc-900/70 p-4">
            <div className="text-[9px] uppercase tracking-widest text-white/35 mb-1">Stage</div>
            <div className="text-white text-sm font-bold">{stageLabel(worldCup.currentStage, worldCup.currentRound)}</div>
            <div className="text-white/35 text-[10px] uppercase tracking-widest mt-1">
              {fixtures.filter((fixture) => fixture.played).length}/{fixtures.length} played this round
            </div>
          </div>
          <div className="rounded border border-white/10 bg-zinc-900/70 p-4">
            <div className="text-[9px] uppercase tracking-widest text-white/35 mb-1">Group Position</div>
            {playerStanding ? (
              <>
                <div className="text-white text-sm font-bold">{playerGroupTable.findIndex((row) => row.team === worldCup.playerTeam) + 1} / 4</div>
              <div className="text-white/35 text-[10px] uppercase tracking-widest mt-1">
                {playerStanding.pts} pts · GD {playerStanding.gd > 0 ? `+${playerStanding.gd}` : playerStanding.gd}
              </div>
              </>
            ) : (
              <div className="text-white/50 text-sm">Knockout stage active</div>
            )}
          </div>
        </div>

        {isComplete && (
          <div className="w-full rounded-2xl border border-amber-400/30 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),rgba(24,24,27,0.96)_55%)] p-6 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/70">World Champions</div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="text-6xl leading-none">{getWorldCupTeamFlag(worldCup.champion || '')}</div>
                  <div>
                    <div className="text-3xl font-black uppercase tracking-[0.08em] text-amber-300">
                      {worldCup.champion || 'TBD'}
                    </div>
                    {championRecord && (
                      <div className="mt-2 text-sm text-white/70">
                        Record {championRecord.wins}-{championRecord.draws}-{championRecord.losses} · Goals {championRecord.gf}:{championRecord.ga} · GD {championRecord.gd > 0 ? `+${championRecord.gd}` : championRecord.gd}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Your Tournament</div>
                  <div className="mt-3 flex items-center gap-2 text-lg font-bold text-white">
                    <span className="text-2xl leading-none">{getWorldCupTeamFlag(worldCup.playerTeam)}</span>
                    <span>{worldCup.playerTeam}</span>
                  </div>
                  <div className="mt-2 text-sm text-white/65">
                    Record {playerRecord.wins}-{playerRecord.draws}-{playerRecord.losses} · Goals {playerRecord.gf}:{playerRecord.ga} · GD {playerRecord.gd > 0 ? `+${playerRecord.gd}` : playerRecord.gd}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Golden Boot</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {goldenBoot.length > 0 ? goldenBoot.map((entry, index) => (
                      <div key={`${entry.name}-${entry.team}`} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-white">
                            {index + 1}. {entry.name}
                          </div>
                          <div className="truncate text-white/45">
                            {getWorldCupTeamFlag(entry.team)} {entry.team}
                          </div>
                        </div>
                        <div className="shrink-0 text-amber-300 font-black tabular-nums">{entry.goals}</div>
                      </div>
                    )) : (
                      <div className="text-sm text-white/45">No scorers recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {finalFixture?.result && (
                <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300/70">Big Final</div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 text-center">
                      <div className="text-3xl leading-none">{getWorldCupTeamFlag(finalFixture.home)}</div>
                      <div className="mt-2 break-words text-lg font-bold text-white">{finalFixture.home}</div>
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="text-3xl font-black tabular-nums text-amber-300">{fixtureScoreLabel(finalFixture)}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/35">
                        {finalFixture.result.decidedBy === 'tiebreak' ? 'Won on tiebreak' : 'Full time'}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 text-center">
                      <div className="text-3xl leading-none">{getWorldCupTeamFlag(finalFixture.away)}</div>
                      <div className="mt-2 break-words text-lg font-bold text-white">{finalFixture.away}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-white/55">{scorersLabel(finalFixture)}</div>
                </div>
              )}
              {thirdPlaceFixture?.result && (
                <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">Third Place Playoff</div>
                  <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0 flex-1 text-center">
                      <div className="text-2xl leading-none">{getWorldCupTeamFlag(thirdPlaceFixture.home)}</div>
                      <div className="mt-2 break-words font-bold text-white">{thirdPlaceFixture.home}</div>
                    </div>
                    <div className="shrink-0 text-xl font-black tabular-nums text-white">{fixtureScoreLabel(thirdPlaceFixture)}</div>
                    <div className="min-w-0 flex-1 text-center">
                      <div className="text-2xl leading-none">{getWorldCupTeamFlag(thirdPlaceFixture.away)}</div>
                      <div className="mt-2 break-words font-bold text-white">{thirdPlaceFixture.away}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-white/45">{scorersLabel(thirdPlaceFixture)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {worldCup.currentStage === 'group' && playerStanding && (
          <div className="w-full rounded border border-white/10 bg-zinc-900/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-amber-400/80 text-[10px] uppercase tracking-widest">Group {activePlayerGroup} Snapshot</div>
              <div className="text-white/30 text-[9px] uppercase tracking-widest">Green = auto qualify · Cyan = best third race</div>
            </div>
            <div className="w-full flex flex-col gap-1">
              {playerGroupTable.map((row, index) => (
                <div
                  key={row.team}
                  className={`flex items-center justify-between gap-4 rounded px-3 py-1.5 text-[12px] ${
                    row.team === worldCup.playerTeam ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <span className={`min-w-0 break-words ${row.team === worldCup.playerTeam ? 'text-amber-300 font-bold' : qualificationTone(index, qualifiedThirds, row.team)}`}>
                    {index + 1}. {row.team}
                  </span>
                  <span className="shrink-0 text-white/55 tabular-nums">
                    {row.pts} pts · {row.gf}:{row.ga} · {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {playerFixture ? (
          <div className={`w-full rounded-lg border p-4 ${playerFixture.played ? 'bg-zinc-800/40 border-white/10' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <div className="text-[9px] uppercase tracking-widest text-amber-400/70 mb-2">Your Match</div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1 flex-1">
                <span className={`text-base font-bold text-center break-words ${playerFixture.home === worldCup.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>{playerFixture.home}</span>
                <span className="text-white/30 text-[9px] uppercase">Home</span>
              </div>
              {playerFixture.played && playerFixture.result ? (
                <div className="text-white text-3xl font-black tabular-nums">{fixtureScoreLabel(playerFixture)}</div>
              ) : (
                <div className="text-white/30 text-xl">vs</div>
              )}
              <div className="flex flex-col items-center gap-1 flex-1">
                <span className={`text-base font-bold text-center break-words ${playerFixture.away === worldCup.playerTeam ? 'text-amber-300' : 'text-white/70'}`}>{playerFixture.away}</span>
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

        {!isComplete && (
          <div className="w-full flex flex-col gap-1.5">
            <div className="text-white/30 text-[9px] uppercase tracking-widest mb-1">Round Fixtures</div>
            {fixtures.map((fixture) => fixtureRow(fixture, worldCup.playerTeam))}
          </div>
        )}

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

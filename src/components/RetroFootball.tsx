import React, { useEffect, useRef, useState } from 'react';
import { initGame } from '../gameEngine';
import FrameViewer from './FrameViewer';
import { buildDriftDashboard, clearTelemetryDatabase, exportTelemetryBundle, generateDriftRecommendations, getTelemetryCounts, installTelemetryDebugApi, mirrorMatchSummary, TelemetryRecorder } from '../telemetry';

const MLS_TEAM_OPTIONS = [
  'Atlanta United',  // keep list unchanged – just adding color map below it
  'Austin FC',
  'Charlotte FC',
  'Chicago Fire',
  'FC Cincinnati',
  'Colorado Rapids',
  'Columbus Crew',
  'DC United',
  'FC Dallas',
  'Houston Dynamo',
  'Inter Miami',
  'LA Galaxy',
  'LAFC',
  'Minnesota United',
  'CF Montreal',
  'Nashville SC',
  'New England Revolution',
  'New York City FC',
  'New York Red Bulls',
  'Orlando City',
  'Philadelphia Union',
  'Portland Timbers',
  'Real Salt Lake',
  'San Diego FC',
  'San Jose Earthquakes',
  'Seattle Sounders',
  'Sporting Kansas City',
  'St. Louis City SC',
  'Toronto FC',
  'Vancouver Whitecaps',
];

const SOCCER_FORMATION_OPTIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3'];

const CPU_SHOT_TUNING_PRESETS = {
  BALANCED: { aimErrorRad: 0.14, pressureError: 0.08 },
  AGGRESSIVE: { aimErrorRad: 0.18, pressureError: 0.1 },
  POSSESSION: { aimErrorRad: 0.11, pressureError: 0.06 },
} as const;

// Official MLS primary (shirt) and secondary (pants) brand colors
const MLS_TEAM_COLORS: Record<string, { primary: number; secondary: number }> = {
  'Atlanta United':          { primary: 0xC41230, secondary: 0x231F20 },
  'Austin FC':               { primary: 0x00B140, secondary: 0x000000 },
  'Charlotte FC':            { primary: 0x1A85C8, secondary: 0xCCCCCC },
  'Chicago Fire':            { primary: 0xC50505, secondary: 0x003087 },
  'FC Cincinnati':           { primary: 0xF4811F, secondary: 0x263C7E },
  'Colorado Rapids':         { primary: 0x94092E, secondary: 0x0086C8 },
  'Columbus Crew':           { primary: 0xFEDD00, secondary: 0x000000 },
  'DC United':               { primary: 0xEF3E42, secondary: 0x231F20 },
  'FC Dallas':               { primary: 0xBF0D3E, secondary: 0x002F65 },
  'Houston Dynamo':          { primary: 0xF4851A, secondary: 0x0A2240 },
  'Inter Miami':             { primary: 0xF52B8F, secondary: 0x231F20 },
  'LA Galaxy':               { primary: 0x00245D, secondary: 0xFAD141 },
  'LAFC':                    { primary: 0x000000, secondary: 0xC39E6D },
  'Minnesota United':        { primary: 0x231F20, secondary: 0x8FCFED },
  'CF Montreal':             { primary: 0x0B2A6B, secondary: 0x0A9FDB },
  'Nashville SC':            { primary: 0xECE83A, secondary: 0x1A2F5D },
  'New England Revolution':  { primary: 0x003087, secondary: 0xCE0E2D },
  'New York City FC':        { primary: 0x6CADDF, secondary: 0x003087 },
  'New York Red Bulls':      { primary: 0xED1C24, secondary: 0x23235B },
  'Orlando City':            { primary: 0x633492, secondary: 0xFFC224 },
  'Philadelphia Union':      { primary: 0x072B61, secondary: 0xB19F72 },
  'Portland Timbers':        { primary: 0x004812, secondary: 0xFBEC51 },
  'Real Salt Lake':          { primary: 0xB22222, secondary: 0x013A81 },
  'San Diego FC':            { primary: 0x003087, secondary: 0xC8A951 },
  'San Jose Earthquakes':    { primary: 0x0D4DA1, secondary: 0x000000 },
  'Seattle Sounders':        { primary: 0x5D9732, secondary: 0x003087 },
  'Sporting Kansas City':    { primary: 0x002B5C, secondary: 0x99D9E0 },
  'St. Louis City SC':       { primary: 0xC8102E, secondary: 0x003087 },
  'Toronto FC':              { primary: 0xB81137, secondary: 0x313233 },
  'Vancouver Whitecaps':     { primary: 0x0B63A0, secondary: 0xFFFFFF },
};

const MLS_TEAM_LOGOS: Record<string, string> = {
  'Atlanta United':          '/assets/logos/atlanta-united.png',
  'Austin FC':               '/assets/logos/austin-fc.png',
  'Charlotte FC':            '/assets/logos/charlotte-fc.png',
  'Chicago Fire':            '/assets/logos/chicago-fire.png',
  'FC Cincinnati':           '/assets/logos/fc-cincinnati.png',
  'Colorado Rapids':         '/assets/logos/colorado-rapids.png',
  'Columbus Crew':           '/assets/logos/columbus-crew.png',
  'DC United':               '/assets/logos/dc-united.png',
  'FC Dallas':               '/assets/logos/fc-dallas.png',
  'Houston Dynamo':          '/assets/logos/houston-dynamo.png',
  'Inter Miami':             '/assets/logos/inter-miami.png',
  'LA Galaxy':               '/assets/logos/la-galaxy.png',
  'LAFC':                    '/assets/logos/lafc.png',
  'Minnesota United':        '/assets/logos/minnesota-united.png',
  'CF Montreal':             '/assets/logos/cf-montreal.png',
  'Nashville SC':            '/assets/logos/nashville-sc.png',
  'New England Revolution':  '/assets/logos/new-england-revolution.png',
  'New York City FC':        '/assets/logos/new-york-city-fc.png',
  'New York Red Bulls':      '/assets/logos/new-york-red-bulls.png',
  'Orlando City':            '/assets/logos/orlando-city.png',
  'Philadelphia Union':      '/assets/logos/philadelphia-union.png',
  'Portland Timbers':        '/assets/logos/portland-timbers.png',
  'Real Salt Lake':          '/assets/logos/real-salt-lake.png',
  'San Diego FC':            '/assets/logos/san-diego-fc.png',
  'San Jose Earthquakes':    '/assets/logos/san-jose-earthquakes.png',
  'Seattle Sounders':        '/assets/logos/seattle-sounders.png',
  'Sporting Kansas City':    '/assets/logos/sporting-kc.png',
  'St. Louis City SC':       '/assets/logos/st-louis-city.png',
  'Toronto FC':              '/assets/logos/toronto-fc.png',
  'Vancouver Whitecaps':     '/assets/logos/vancouver-whitecaps.png',
};

const RetroFootball: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const telemetryRecorderRef = useRef<TelemetryRecorder | null>(null);
  const [lighting, setLighting] = useState('NOON');
  const [weather, setWeather] = useState<'SUNNY' | 'RAINY' | 'SNOW' | 'WINDY'>('SUNNY');
  const [aiStyle, setAIStyle] = useState<'BALANCED' | 'AGGRESSIVE' | 'POSSESSION'>('BALANCED');
  const [cpuShotAimErrorRad, setCPUShotAimErrorRad] = useState<number>(CPU_SHOT_TUNING_PRESETS.BALANCED.aimErrorRad);
  const [cpuShotPressureError, setCPUShotPressureError] = useState<number>(CPU_SHOT_TUNING_PRESETS.BALANCED.pressureError);
  const [cameraMode, setCameraMode] = useState<'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE'>('BROADCAST');
  const [teamAUniform, setTeamAUniform] = useState(0);
  const [teamBUniform, setTeamBUniform] = useState(0);
  const [teamAName, setTeamAName] = useState('Inter Miami');
  const [teamBName, setTeamBName] = useState('LA Galaxy');
  const [teamAFormation, setTeamAFormation] = useState('4-2-3-1');
  const [teamBFormation, setTeamBFormation] = useState('4-3-3');
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'OPTIONS' | 'STATS' | 'FRAME_VIEWER'>('OPTIONS');
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [selectedDefensePlayer, setSelectedDefensePlayer] = useState<any>(null);
  const [driftRows, setDriftRows] = useState<any[]>([]);
  const [driftSessionId, setDriftSessionId] = useState<string | null>(null);
  const [driftThresholdPct, setDriftThresholdPct] = useState(10);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftMessage, setDriftMessage] = useState('');
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [telemCounts, setTelemCounts] = useState<Record<string, number> | null>(null);
  const [telemExporting, setTelemExporting] = useState(false);
  const [telemClearing, setTelemClearing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isGroundVisible, setIsGroundVisible] = useState(true);
  const [isFieldVisible, setIsFieldVisible] = useState(true);
  const [isGrassVisible, setIsGrassVisible] = useState(true);
  const [showAIStateOverlay, setShowAIStateOverlay] = useState(false);
  const [hotSeatMode, setHotSeatMode] = useState(false);
  const [testingMode, setTestingMode] = useState(false);
  const [gameMode, setGameMode] = useState<'1p' | '2p' | 'cpu' | 'test' | null>(null);
  const prevIsLive = useRef(false);
  const prevMatchSnapshotRef = useRef<any | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameRef.current) {
        const currentIsLive = gameRef.current.getIsLive();
        const snapshot = gameRef.current.getMatchSnapshot?.() || null;

        if (snapshot && prevMatchSnapshotRef.current) {
          const prev = prevMatchSnapshotRef.current;
          if (snapshot.scoreA !== prev.scoreA || snapshot.scoreB !== prev.scoreB) {
            telemetryRecorderRef.current?.recordEvent('score_changed', {
              from: { scoreA: prev.scoreA, scoreB: prev.scoreB },
              to: { scoreA: snapshot.scoreA, scoreB: snapshot.scoreB },
            });
          }
          if (snapshot.phase !== prev.phase || snapshot.half !== prev.half) {
            telemetryRecorderRef.current?.recordEvent('phase_changed', {
              from: { phase: prev.phase, half: prev.half },
              to: { phase: snapshot.phase, half: snapshot.half },
            });
            // Mirror final result to local JSON when match ends
            if (snapshot.phase === 'FULL_TIME') {
              mirrorMatchSummary();
            }
          }
          const prevShotSeq = prev.lastShotTelemetry?.seq ?? 0;
          const nextShotSeq = snapshot.lastShotTelemetry?.seq ?? 0;
          if (nextShotSeq > prevShotSeq && snapshot.lastShotTelemetry) {
            telemetryRecorderRef.current?.recordEvent('shot_style_taken', snapshot.lastShotTelemetry);
          }
        }

        if (prevIsLive.current && !currentIsLive) {
          // Play just ended
          setSelectedPlayer(gameRef.current.getSelectedPlayerStats());
          telemetryRecorderRef.current?.recordEvent('play_stopped', {
            phase: snapshot?.phase,
            elapsedInHalf: snapshot?.elapsedInHalf,
          });
          
          gameRef.current.selectRandomDefensePlayer();
          setSelectedDefensePlayer(gameRef.current.getSelectedDefensePlayerStats());
        }
        if (!prevIsLive.current && currentIsLive) {
          telemetryRecorderRef.current?.recordEvent('play_started', {
            phase: snapshot?.phase,
            elapsedInHalf: snapshot?.elapsedInHalf,
          });
        }
        prevIsLive.current = currentIsLive;
        if (snapshot) prevMatchSnapshotRef.current = snapshot;
        
        // Only update stats if live, otherwise keep the selected player
        if (currentIsLive) {
          setSelectedPlayer(gameRef.current.getSelectedPlayerStats());
          setSelectedDefensePlayer(gameRef.current.getSelectedDefensePlayerStats());
        } else {
          // Always try to update
          setSelectedPlayer(gameRef.current.getSelectedPlayerStats());
          setSelectedDefensePlayer(gameRef.current.getSelectedDefensePlayerStats());
        }
        setIsLive(currentIsLive);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = initGame(containerRef.current);
      const colorsA = MLS_TEAM_COLORS[teamAName] ?? { primary: 0x008e97, secondary: 0xffffff };
      const colorsB = MLS_TEAM_COLORS[teamBName] ?? { primary: 0xaa0000, secondary: 0xc7a74b };
      gameRef.current?.setTeamColors?.('A', colorsA.primary, colorsA.secondary);
      gameRef.current?.setTeamColors?.('B', colorsB.primary, colorsB.secondary);
      gameRef.current?.setTeamFormations?.(teamAFormation, teamBFormation);
      gameRef.current?.setTeamNames?.(teamAName, teamBName);
      gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[teamAName] ?? '', MLS_TEAM_LOGOS[teamBName] ?? '');
      gameRef.current?.setWeather?.(weather);
      gameRef.current?.setAIStyle?.(aiStyle);
      gameRef.current?.setCPUShotTuning?.(cpuShotAimErrorRad, cpuShotPressureError);
      gameRef.current?.setMenuVisible?.(gameMode === null);
      gameRef.current?.setShowAIStateOverlay?.(showAIStateOverlay);
      gameRef.current?.setTestingMode?.(false);
      gameRef.current?.setHotSeatMode?.(false);
      gameRef.current?.setCpuVsCpu?.(false);

      if (!telemetryRecorderRef.current) {
        const recorder = new TelemetryRecorder();
        recorder.setContext({
          teamAName,
          teamBName,
          teamAFormation,
          teamBFormation,
          notes: 'Telemetry capture armed; gameplay starts only after mode selection',
        });
        recorder.start(() => gameRef.current, 500);
        telemetryRecorderRef.current = recorder;
      }

      gameRef.current?.setOnReset?.(() => {
        const rec = telemetryRecorderRef.current;
        if (!rec) return;
        rec.recordEvent('game_reset', {
          triggeredBy: 'R_key',
          timestamp: Date.now(),
        }).then(() => {
          rec.stop().then(() => {
            const nextRec = new TelemetryRecorder();
            nextRec.setContext({
              teamAName,
              teamBName,
              teamAFormation,
              teamBFormation,
              notes: 'Session restarted via R key',
            });
            nextRec.start(() => gameRef.current, 500);
            telemetryRecorderRef.current = nextRec;
          });
        });
      });

      installTelemetryDebugApi();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOptionsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const colorsA = MLS_TEAM_COLORS[teamAName] ?? { primary: 0x008e97, secondary: 0xffffff };
    const colorsB = MLS_TEAM_COLORS[teamBName] ?? { primary: 0xaa0000, secondary: 0xc7a74b };
    gameRef.current?.setTeamColors?.('A', colorsA.primary, colorsA.secondary);
    gameRef.current?.setTeamColors?.('B', colorsB.primary, colorsB.secondary);
    gameRef.current?.setTeamFormations?.(teamAFormation, teamBFormation);
    gameRef.current?.setTeamNames?.(teamAName, teamBName);
    gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[teamAName] ?? '', MLS_TEAM_LOGOS[teamBName] ?? '');
    telemetryRecorderRef.current?.setContext({
      teamAName,
      teamBName,
      teamAFormation,
      teamBFormation,
    });
  }, [teamAName, teamBName, teamAFormation, teamBFormation]);

  useEffect(() => {
    return () => {
      telemetryRecorderRef.current?.stop();
      telemetryRecorderRef.current = null;
    };
  }, []);

  const handleLightingChange = (preset: string) => {
    setLighting(preset);
    gameRef.current?.setLighting(preset);
  };

  const handleWeatherChange = (nextWeather: 'SUNNY' | 'RAINY' | 'SNOW' | 'WINDY') => {
    setWeather(nextWeather);
    gameRef.current?.setWeather?.(nextWeather);
  };

  const handleAIStyleChange = (style: 'BALANCED' | 'AGGRESSIVE' | 'POSSESSION') => {
    setAIStyle(style);
    gameRef.current?.setAIStyle?.(style);
    const preset = CPU_SHOT_TUNING_PRESETS[style];
    setCPUShotAimErrorRad(preset.aimErrorRad);
    setCPUShotPressureError(preset.pressureError);
    gameRef.current?.setCPUShotTuning?.(preset.aimErrorRad, preset.pressureError);
  };

  const handleCPUShotTuningChange = (key: 'aimErrorRad' | 'pressureError', value: number) => {
    if (key === 'aimErrorRad') {
      setCPUShotAimErrorRad(value);
      gameRef.current?.setCPUShotTuning?.(value, cpuShotPressureError);
      return;
    }
    setCPUShotPressureError(value);
    gameRef.current?.setCPUShotTuning?.(cpuShotAimErrorRad, value);
  };

  const handleCameraChange = (mode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE') => {
    setCameraMode(mode);
    gameRef.current?.setCameraMode(mode);
  };

  const handleUniformChange = (team: 'A' | 'B', index: number) => {
    if (team === 'A') setTeamAUniform(index);
    else setTeamBUniform(index);
    gameRef.current?.setUniform(team, index);
  };

  const handleKickOff = (mode: '1p' | '2p' | 'cpu' | 'test') => {
    const isHotSeat = mode === '2p';
    const isCpu = mode === 'cpu';
    const isTesting = mode === 'test';
    const nextTeamAName = teamAName;
    const nextTeamBName = teamBName;

    const colorsA = MLS_TEAM_COLORS[nextTeamAName] ?? { primary: 0x008e97, secondary: 0xffffff };
    const colorsB = MLS_TEAM_COLORS[nextTeamBName] ?? { primary: 0xaa0000, secondary: 0xc7a74b };
    gameRef.current?.setTeamColors?.('A', colorsA.primary, colorsA.secondary);
    gameRef.current?.setTeamColors?.('B', colorsB.primary, colorsB.secondary);
    gameRef.current?.setTeamNames?.(nextTeamAName, nextTeamBName);
    gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[nextTeamAName] ?? '', MLS_TEAM_LOGOS[nextTeamBName] ?? '');

    const shouldShowAIOverlay = isCpu || isTesting;
    setGameMode(mode);
    setHotSeatMode(isHotSeat || isTesting);
    setTestingMode(isTesting);
    telemetryRecorderRef.current?.setContext({
      teamAName: nextTeamAName,
      teamBName: nextTeamBName,
      teamAFormation,
      teamBFormation,
    });
    telemetryRecorderRef.current?.recordEvent('mode_selected', {
      mode,
      cpuVsCpu: isCpu,
      testingMode: isTesting,
      hotSeatMode: isHotSeat || isTesting,
      teamAName: nextTeamAName,
      teamBName: nextTeamBName,
    });
    telemetryRecorderRef.current?.recordEvent('selected_teams_locked', {
      mode,
      teamAName: nextTeamAName,
      teamBName: nextTeamBName,
    });
    if (shouldShowAIOverlay) {
      setShowAIStateOverlay(true);
      gameRef.current?.setShowAIStateOverlay?.(true);
    }
    gameRef.current?.setHotSeatMode?.(isHotSeat || isTesting);
    gameRef.current?.setTestingMode?.(isTesting);
    gameRef.current?.setCpuVsCpu?.(isCpu);
    gameRef.current?.setMenuVisible?.(false);
    gameRef.current?.startKickoffPresentation?.(true);
    telemetryRecorderRef.current?.recordEvent('kickoff_presentation_started', {
      autoKick: true,
      mode,
    });
  };

  useEffect(() => {
    gameRef.current?.setMenuVisible?.(gameMode === null);
  }, [gameMode]);

  const formatPctDelta = (mult?: number) => {
    if (typeof mult !== 'number') return 'n/a';
    const delta = (mult - 1) * 100;
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
  };

  const getTeamDisplayName = (team?: 'A' | 'B' | string) => {
    if (team === 'A') return teamAName;
    if (team === 'B') return teamBName;
    return team || 'Unknown Team';
  };

  const renderSelectedPlayerPanel = (title: string, p: any) => {
    if (!p) {
      return (
        <div className="bg-zinc-800 p-3 rounded border border-white/10">
          <div className="text-white text-[10px] font-bold uppercase mb-2">{title}</div>
          <div className="text-[10px] text-white/50">No player selected.</div>
        </div>
      );
    }

    return (
      <div className="bg-zinc-800 p-3 rounded border border-white/10">
        <div className="flex justify-between text-white text-[10px] font-bold uppercase mb-2">
          <span>{title}</span>
          <span className="text-white/60">{getTeamDisplayName(p.team)} {p.team ? `(${p.team})` : ''}</span>
        </div>
        <div className="text-white text-[11px] font-semibold mb-1">{p.name} ({p.role})</div>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70 mb-2">
          <div>SPD: {p.stats.speed.toFixed(2)}</div>
          <div>STR: {p.stats.strength.toFixed(2)}</div>
          <div>CAT: {p.stats.catching.toFixed(2)}</div>
          <div>TAK: {p.stats.tackle.toFixed(2)}</div>
        </div>
        <div className="border-t border-white/10 pt-2 text-[10px]">
          <div className="text-white/50 uppercase tracking-wide mb-1">MLS 2025 Team Modifier</div>
          {p.mls2025 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-white/75">
              <div>Quality PPG: {(p.mls2025.quality.ppg * 100).toFixed(0)}%</div>
              <div>Attack Axis: {(p.mls2025.quality.attack * 100).toFixed(0)}%</div>
              <div>Defense Axis: {(p.mls2025.quality.defense * 100).toFixed(0)}%</div>
              <div>Role Applied: {formatPctDelta(p.mls2025.multipliers.appliedRole)}</div>
              <div>Overall Stat Shift: {formatPctDelta(p.mls2025.multipliers.overall)}</div>
              <div>Defense Stat Shift: {formatPctDelta(p.mls2025.multipliers.defense)}</div>
            </div>
          ) : (
            <div className="text-white/50">No 2025 team data for this club name.</div>
          )}
        </div>
      </div>
    );
  };

  const refreshDriftDashboard = async () => {
    setDriftLoading(true);
    setDriftMessage('');
    try {
      const result = await buildDriftDashboard({ thresholdPct: driftThresholdPct });
      setDriftRows(result.rows);
      setDriftSessionId(result.sessionId);
      if (!result.sessionId) {
        setDriftMessage('No telemetry session found yet. Start a match to collect data.');
      }
    } catch (error) {
      setDriftMessage(`Failed to build drift dashboard: ${String(error)}`);
    } finally {
      setDriftLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setDriftLoading(true);
    setDriftMessage('');
    try {
      const result = await generateDriftRecommendations({ thresholdPct: driftThresholdPct });
      if (!result.sessionId) {
        setDriftMessage('No telemetry session found yet. Start a match first.');
      } else {
        setDriftMessage(`Created ${result.created.length} recommendation(s), skipped ${result.skippedCount}.`);
      }
      const updated = await buildDriftDashboard({ thresholdPct: driftThresholdPct });
      setDriftRows(updated.rows);
      setDriftSessionId(updated.sessionId);
    } catch (error) {
      setDriftMessage(`Failed to generate recommendations: ${String(error)}`);
    } finally {
      setDriftLoading(false);
    }
  };

  useEffect(() => {
    if (!isOptionsOpen || activeTab !== 'STATS') return;
    refreshDriftDashboard();
  }, [isOptionsOpen, activeTab, driftThresholdPct]);

  // Poll telemetry counts while the floating window is open
  useEffect(() => {
    if (!showTelemetry) return;
    const refresh = () => getTelemetryCounts().then(setTelemCounts).catch(() => {});
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => window.clearInterval(id);
  }, [showTelemetry]);

  const handleTelemetryExport = async () => {
    setTelemExporting(true);
    try {
      const bundle = await exportTelemetryBundle();
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `psl-telemetry-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Telemetry export failed', e);
    } finally {
      setTelemExporting(false);
    }
  };

  const handleTelemetryClear = async () => {
    if (!window.confirm('Clear ALL telemetry data from the database? This cannot be undone.')) return;
    setTelemClearing(true);
    try {
      await clearTelemetryDatabase();
      setTelemCounts(null);
      setDriftRows([]);
      setDriftSessionId(null);
      getTelemetryCounts().then(setTelemCounts).catch(() => {});
    } catch (e) {
      console.error('Telemetry clear failed', e);
    } finally {
      setTelemClearing(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-mono">
      <div ref={containerRef} className="w-full h-full" />

      {/* Mode Select Screen */}
      {gameMode === null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
            {/* Title */}
            <div className="text-center">
              <p className="text-white/30 text-[9px] uppercase tracking-[0.4em] mb-1">Welcome to</p>
              <h1 className="text-white text-2xl font-bold uppercase tracking-widest">Pixel Soccer</h1>
              <h2 className="text-white/60 text-xs uppercase tracking-[0.3em]">League</h2>
            </div>

            {/* Team selectors */}
            <div className="w-full flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-[10px] uppercase w-16 shrink-0">Team A</span>
                <select
                  value={teamAName}
                  onChange={(e) => setTeamAName(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/20 text-white text-[10px] rounded px-2 py-1.5 focus:outline-none focus:border-white/50"
                >
                  {MLS_TEAM_OPTIONS.map((team) => (
                    <option key={`ms-a-${team}`} value={team}>{team}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-[10px] uppercase w-16 shrink-0">Team B</span>
                <select
                  value={teamBName}
                  onChange={(e) => setTeamBName(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/20 text-white text-[10px] rounded px-2 py-1.5 focus:outline-none focus:border-white/50"
                >
                  {MLS_TEAM_OPTIONS.map((team) => (
                    <option key={`ms-b-${team}`} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mode buttons */}
            <div className="w-full flex flex-col gap-3">
              <p className="text-white/30 text-[9px] uppercase tracking-widest text-center">Select Mode</p>
              <button
                onClick={() => handleKickOff('1p')}
                className="w-full py-3 border border-white/20 text-white text-xs uppercase tracking-widest rounded hover:bg-white hover:text-black transition-colors"
              >
                1 Player vs CPU
              </button>
              <button
                onClick={() => handleKickOff('2p')}
                className="w-full py-3 border border-white/20 text-white text-xs uppercase tracking-widest rounded hover:bg-white hover:text-black transition-colors"
              >
                2 Players — Hot Seat
              </button>
              <button
                onClick={() => handleKickOff('cpu')}
                className="w-full py-3 border border-white/20 text-white/50 text-xs uppercase tracking-widest rounded hover:bg-white/10 hover:text-white transition-colors"
              >
                CPU vs CPU
              </button>
            </div>

            <p className="text-white/20 text-[9px] uppercase tracking-widest">Press [ESC] in-game for options</p>
          </div>
        </div>
      )}
      
      {/* Options Menu Overlay */}
      {isOptionsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3">
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-white/10 shadow-2xl w-[min(1100px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-y-auto flex flex-col gap-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex gap-4">
                <button onClick={() => setActiveTab('OPTIONS')} className={`text-white text-sm ${activeTab === 'OPTIONS' ? 'font-bold' : 'text-white/40'}`}>OPTIONS</button>
                <button onClick={() => setActiveTab('STATS')} className={`text-white text-sm ${activeTab === 'STATS' ? 'font-bold' : 'text-white/40'}`}>STATS</button>
                <button onClick={() => setActiveTab('FRAME_VIEWER')} className={`text-white text-sm ${activeTab === 'FRAME_VIEWER' ? 'font-bold' : 'text-white/40'}`}>ANIMATIONS</button>
              </div>
              <button 
                onClick={() => setIsOptionsOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                [ESC] CLOSE
              </button>
            </div>

            {activeTab === 'OPTIONS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Lighting</h3>
                    <div className="flex flex-wrap gap-2">
                      {['NOON', 'LATE', 'NIGHT'].map((p) => (
                        <button
                          key={p}
                          onClick={() => handleLightingChange(p)}
                          className={`px-3 py-1.5 text-[10px] border rounded ${
                            lighting === p ? 'bg-white text-black border-white' : 'text-white border-white/20 hover:border-white'
                          } transition-colors`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Camera</h3>
                    <div className="flex flex-wrap gap-2">
                      {(['FOLLOW_BEHIND', 'BROADCAST', 'SIDELINE', 'FIXED_ENDZONE'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => handleCameraChange(m)}
                          className={`px-3 py-1.5 text-[10px] border rounded ${
                            cameraMode === m ? 'bg-white text-black border-white' : 'text-white border-white/40 hover:border-white'
                          } transition-colors`}
                        >
                          {m.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Weather</h3>
                    <div className="flex flex-wrap gap-2">
                      {(['SUNNY', 'RAINY', 'SNOW', 'WINDY'] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() => handleWeatherChange(w)}
                          className={`px-3 py-1.5 text-[10px] border rounded ${
                            weather === w ? 'bg-white text-black border-white' : 'text-white border-white/20 hover:border-white'
                          } transition-colors`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">CPU AI Style</h3>
                    <div className="flex flex-wrap gap-2">
                      {(['BALANCED', 'AGGRESSIVE', 'POSSESSION'] as const).map((style) => (
                        <button
                          key={style}
                          onClick={() => handleAIStyleChange(style)}
                          className={`px-3 py-1.5 text-[10px] border rounded ${
                            aiStyle === style ? 'bg-white text-black border-white' : 'text-white border-white/20 hover:border-white'
                          } transition-colors`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2 border border-white/10 rounded p-2 bg-zinc-950/40">
                      <div>
                        <div className="flex justify-between text-[9px] text-white/60 uppercase tracking-widest mb-1">
                          <span>CPU Shot Spread</span>
                          <span>{cpuShotAimErrorRad.toFixed(2)} rad</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.45}
                          step={0.01}
                          value={cpuShotAimErrorRad}
                          onChange={(e) => handleCPUShotTuningChange('aimErrorRad', Number(e.target.value))}
                          className="w-full accent-white"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[9px] text-white/60 uppercase tracking-widest mb-1">
                          <span>Pressure Penalty</span>
                          <span>{cpuShotPressureError.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.2}
                          step={0.01}
                          value={cpuShotPressureError}
                          onChange={(e) => handleCPUShotTuningChange('pressureError', Number(e.target.value))}
                          className="w-full accent-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Environment</h3>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-white text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isGroundVisible}
                          onChange={(e) => {
                            setIsGroundVisible(e.target.checked);
                            gameRef.current?.setGroundVisible(e.target.checked);
                          }}
                          className="accent-white"
                        />
                        Show Ground
                      </label>
                      <label className="flex items-center gap-2 text-white text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFieldVisible}
                          onChange={(e) => {
                            setIsFieldVisible(e.target.checked);
                            gameRef.current?.setFieldVisible(e.target.checked);
                          }}
                          className="accent-white"
                        />
                        Show Field Markings
                      </label>
                      <label className="flex items-center gap-2 text-white text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isGrassVisible}
                          onChange={(e) => {
                            setIsGrassVisible(e.target.checked);
                            gameRef.current?.setGrassVisible(e.target.checked);
                          }}
                          className="accent-white"
                        />
                        Show Grass
                      </label>
                      <label className="flex items-center gap-2 text-white text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAIStateOverlay}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setShowAIStateOverlay(enabled);
                            gameRef.current?.setShowAIStateOverlay?.(enabled);
                          }}
                          className="accent-white"
                        />
                        Show AI State Debug Overlay
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">MLS Teams</h3>
                    <div className="flex flex-col gap-2">
                      <label className="text-white/60 text-[9px] uppercase">Team A</label>
                      <select
                        value={teamAName}
                        onChange={(e) => setTeamAName(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {MLS_TEAM_OPTIONS.map((team) => (
                          <option key={`a-${team}`} value={team}>{team}</option>
                        ))}
                      </select>

                      <label className="text-white/60 text-[9px] uppercase mt-1">Team B</label>
                      <select
                        value={teamBName}
                        onChange={(e) => setTeamBName(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {MLS_TEAM_OPTIONS.map((team) => (
                          <option key={`b-${team}`} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Formations</h3>
                    <div className="flex flex-col gap-2">
                      <label className="text-white/60 text-[9px] uppercase">Team A</label>
                      <select
                        value={teamAFormation}
                        onChange={(e) => setTeamAFormation(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {SOCCER_FORMATION_OPTIONS.map((formation) => (
                          <option key={`fa-${formation}`} value={formation}>{formation}</option>
                        ))}
                      </select>

                      <label className="text-white/60 text-[9px] uppercase mt-1">Team B</label>
                      <select
                        value={teamBFormation}
                        onChange={(e) => setTeamBFormation(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {SOCCER_FORMATION_OPTIONS.map((formation) => (
                          <option key={`fb-${formation}`} value={formation}>{formation}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Uniforms</h3>
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-white/60 text-[9px] mb-1 uppercase">{teamAName}</p>
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <button
                              key={i}
                              onClick={() => handleUniformChange('A', i)}
                              className={`w-8 h-8 border rounded ${
                                teamAUniform === i ? 'border-white bg-white/10' : 'border-white/10'
                              } flex items-center justify-center text-[10px] text-white hover:border-white/40`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-white/60 text-[9px] mb-1 uppercase">{teamBName}</p>
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <button
                              key={i}
                              onClick={() => handleUniformChange('B', i)}
                              className={`w-8 h-8 border rounded ${
                                teamBUniform === i ? 'border-white bg-white/10' : 'border-white/10'
                              } flex items-center justify-center text-[10px] text-white hover:border-white/40`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'STATS' ? (
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                <div className="bg-zinc-800 p-3 rounded border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-white text-[10px] font-bold uppercase">Telemetry Drift Dashboard</div>
                      <div className="text-white/50 text-[9px]">Session: {driftSessionId || 'n/a'} • Threshold: {driftThresholdPct}%</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={driftThresholdPct}
                        onChange={(e) => setDriftThresholdPct(Number(e.target.value))}
                        className="bg-zinc-900 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {[5, 10, 15, 20].map((v) => <option key={v} value={v}>{v}%</option>)}
                      </select>
                      <button
                        onClick={refreshDriftDashboard}
                        disabled={driftLoading}
                        className="px-2 py-1 text-[10px] border rounded border-white/30 text-white hover:border-white disabled:opacity-40"
                      >
                        Refresh
                      </button>
                      <button
                        onClick={generateRecommendations}
                        disabled={driftLoading}
                        className="px-2 py-1 text-[10px] border rounded border-amber-300/50 text-amber-200 hover:border-amber-200 disabled:opacity-40"
                      >
                        Auto-Recommend
                      </button>
                    </div>
                  </div>
                  {driftMessage ? <div className="text-[10px] text-white/60 mb-2">{driftMessage}</div> : null}
                  <div className="space-y-1">
                    {driftRows.length === 0 ? (
                      <div className="text-[10px] text-white/50">No drift metrics available yet.</div>
                    ) : (
                      driftRows.map((row) => (
                        <div key={row.metricKey} className={`p-2 rounded border text-[10px] ${row.isAlert ? 'border-red-400/40 bg-red-900/10' : 'border-white/10 bg-zinc-900/50'}`}>
                          <div className="flex justify-between">
                            <span className="text-white/90">{row.label}</span>
                            <span className={row.isAlert ? 'text-red-300' : 'text-emerald-300'}>{row.driftPct === null ? 'n/a' : `${row.driftPct >= 0 ? '+' : ''}${row.driftPct.toFixed(1)}%`}</span>
                          </div>
                          <div className="text-white/50 mt-1">
                            Sim {row.simulatedValue.toFixed(2)}{row.unit ? ` ${row.unit}` : ''} • Base {row.baselineValue === null ? 'n/a' : row.baselineValue.toFixed(2)}{row.unit ? ` ${row.unit}` : ''}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {renderSelectedPlayerPanel('Selected Offense Player', selectedPlayer)}
                {renderSelectedPlayerPanel('Selected Defense Player', selectedDefensePlayer)}
                {players.map((p, i) => (
                  <div key={i} className="bg-zinc-800 p-3 rounded border border-white/10">
                    <div className="flex justify-between text-white text-[10px] font-bold uppercase mb-2">
                      <span>{p.name} ({p.role})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-white/60">
                      <div>SPD: {p.stats.speed.toFixed(2)}</div>
                      <div>STR: {p.stats.strength.toFixed(2)}</div>
                      <div>CAT: {p.stats.catching.toFixed(2)}</div>
                      <div>TAK: {p.stats.tackle.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <FrameViewer />
              </div>
            )}

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">Controls</h3>
              <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                <div className="text-white/60">WASD / ARROWS</div>
                <div className="text-white text-right">MOVE PLAYER</div>
                <div className="text-white/60">H</div>
                <div className="text-white text-right">KICK OFF / RESTART</div>
                <div className="text-white/60">SPACEBAR</div>
                <div className="text-white text-right">PASS / SELECT TARGET</div>
                <div className="text-white/60">Q / E</div>
                <div className="text-white text-right">SWITCH TEAM A PLAYER</div>
                <div className="text-white/60">[ / ]</div>
                <div className="text-white text-right">SWITCH TEAM B PLAYER</div>
                <div className="text-white/60">R</div>
                <div className="text-white text-right">RESET GAME</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Press ESC Hint */}
      {!isOptionsOpen && (
        <div className="absolute top-4 left-4 bg-black/40 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm pointer-events-none">
          <p className="text-white/40 text-[9px] uppercase tracking-widest">Press [ESC] for Options</p>
        </div>
      )}

      {/* Bottom-right toggle buttons */}
      {!isOptionsOpen && (
        <div className="absolute bottom-4 right-4 z-40 flex gap-2">
          <button
            onClick={() => {
              const next = !showAIStateOverlay;
              setShowAIStateOverlay(next);
              gameRef.current?.setShowAIStateOverlay?.(next);
            }}
            className="bg-black/60 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-[9px] uppercase tracking-widest px-3 py-1.5 rounded backdrop-blur-sm transition-colors"
          >
            {showAIStateOverlay ? 'Hide AI State' : '🧠 AI State'}
          </button>
          <button
            onClick={() => setShowTelemetry((v) => !v)}
            className="bg-black/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-[9px] uppercase tracking-widest px-3 py-1.5 rounded backdrop-blur-sm transition-colors"
          >
            {showTelemetry ? 'Hide Telemetry' : '⚡ Telemetry'}
          </button>
        </div>
      )}

      {/* Floating Telemetry Window */}
      {showTelemetry && !isOptionsOpen && (
        <div className="absolute bottom-12 right-4 z-40 w-72 bg-zinc-950/95 border border-emerald-500/30 rounded-xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-emerald-950/40">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 text-[10px] font-bold uppercase tracking-widest">Telemetry</span>
            </div>
            <button onClick={() => setShowTelemetry(false)} className="text-white/30 hover:text-white text-[10px]">✕</button>
          </div>

          <div className="p-3 flex flex-col gap-3">
            {/* Session info */}
            <div className="text-[9px] text-white/40 uppercase tracking-widest truncate">
              Session: {driftSessionId ? driftSessionId.slice(0, 24) + '…' : 'none'}
            </div>

            {/* Row counts */}
            <div>
              <div className="text-[9px] text-white/50 uppercase tracking-widest mb-1">DB Row Counts</div>
              {telemCounts ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  {Object.entries(telemCounts).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-white/50 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-emerald-300 tabular-nums">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[9px] text-white/30">Loading…</div>
              )}
            </div>

            {/* Drift summary */}
            <div>
              <div className="text-[9px] text-white/50 uppercase tracking-widest mb-1">
                Drift Alerts
                {driftLoading && <span className="ml-1 text-white/30">(loading…)</span>}
              </div>
              {driftRows.length === 0 ? (
                <div className="text-[9px] text-white/30">No baselines set — open STATS tab to configure.</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {driftRows.filter((r) => r.isAlert).length === 0 && (
                    <div className="text-[9px] text-emerald-400">All metrics within threshold ✓</div>
                  )}
                  {driftRows.filter((r) => r.isAlert).map((row) => (
                    <div key={row.metricKey} className="flex justify-between text-[9px]">
                      <span className="text-red-300 truncate">{row.label}</span>
                      <span className="text-red-400 ml-2 shrink-0">{row.driftPct !== null ? `${row.driftPct >= 0 ? '+' : ''}${row.driftPct.toFixed(1)}%` : 'n/a'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 border-t border-white/10">
              <button
                onClick={refreshDriftDashboard}
                disabled={driftLoading}
                className="flex-1 py-1 text-[9px] uppercase tracking-widest border border-white/20 text-white/70 rounded hover:border-white/50 hover:text-white disabled:opacity-30 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={handleTelemetryExport}
                disabled={telemExporting}
                className="flex-1 py-1 text-[9px] uppercase tracking-widest border border-emerald-500/40 text-emerald-300 rounded hover:border-emerald-300 disabled:opacity-30 transition-colors"
              >
                {telemExporting ? 'Exporting…' : 'Export JSON'}
              </button>
              <button
                onClick={handleTelemetryClear}
                disabled={telemClearing}
                className="py-1 px-2 text-[9px] uppercase tracking-widest border border-red-500/30 text-red-400 rounded hover:border-red-400 disabled:opacity-30 transition-colors"
              >
                {telemClearing ? '…' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default RetroFootball;

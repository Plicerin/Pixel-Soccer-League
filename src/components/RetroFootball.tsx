import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pause, Play } from 'lucide-react';
import WorldCupHub from './WorldCupHub';
import {
  buildDriftDashboard,
  clearTelemetryDatabase,
  exportTelemetryBundle,
  generateDriftRecommendations,
  getDiskMirrorStatus,
  getPositionSequence,
  getTelemetryCounts,
  installTelemetryDebugApi,
  mirrorMatchSummary,
  recoverLatestMirroredSession,
  TelemetryRecorder,
} from '../telemetry';
import { compactLiveDashboardPayload } from '../telemetry/liveDashboardPayload';
import { buildMatchResultPayload } from '../telemetry/matchPersistencePayload';
import { computeFixtureTimeoutMs, computeWatchedFixtureSpeedMul } from '../fixtureTiming';
import { installSmokeTestApi } from '../smokeTest';
import { hasDevServer } from '../runtimeEnv';
import { createGamepadLatch, pickStandardGamepad } from '../gamepadSelect';
import { PRACTICE_PLAYS, PRACTICE_AGGRESSIVENESS, type AggressivenessKey, getPlayRoutes } from '../practicePlays';
import { createWorldCupRecord, deleteWorldCup, saveWorldCup } from '../worldCupManager';
import {
  DEFAULT_AWAY_TEAM,
  DEFAULT_HOME_TEAM,
  getWorldCupTeamFlagAsset,
  getWorldCupTeamFlag,
  PLAYABLE_WORLD_TEAM_KITS,
  PLAYABLE_WORLD_TEAM_NAMES,
  resolvePlayableTeamKits,
  WORLD_CUP_2026_TEAM_NAMES,
} from '../teamCatalog.js';
import { getWorldTeamStartingLineup } from '../worldTeamRosters.js';
import { randomWorldCup2026GroupFixture } from '../worldCup2026Schedule.js';

const MatchHistoryDashboard = React.lazy(() => import('./MatchHistoryDashboard'));
const LiveTelemetry = React.lazy(() => import('./LiveTelemetry'));
const FrameViewer = React.lazy(() => import('./FrameViewer'));
const AnimationInspector = React.lazy(() => import('./AnimationInspector'));
const DIRECTION_GLYPH: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const PauseOverlay = React.lazy(() => import('./PauseOverlay'));
const ControlReference = React.lazy(() => import('./PauseOverlay').then((m) => ({ default: m.ControlReference })));
const ENGINE_RUNTIME_TOKEN = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * MATCHES reads the dev-server-only /__db route, and ANIMATIONS / TELEMETRY are
 * authoring instrumentation. Hide all three in the packaged desktop build so
 * players never land on a permanently empty tab.
 */
const DEV_ONLY_OPTIONS_TABS = ['MATCH_HISTORY', 'FRAME_VIEWER', 'LIVE_TELEMETRY'] as const;

/**
 * Push each side's coaching intent into the model. It shifts the team's rated
 * tuning rather than replacing it, so a stronger squad stays stronger at every
 * setting. Previously this called two engine stubs and did nothing at all.
 */
function applyGameAggressionSettings(
  game: any,
  teamAAggressiveness: AggressivenessKey,
  teamBAggressiveness: AggressivenessKey = teamAAggressiveness,
) {
  game?.setTeamAggression?.('A', teamAAggressiveness);
  game?.setTeamAggression?.('B', teamBAggressiveness);
}

// Helper: reset positions, draw routes, optionally activate play — called on every play/formation change
function applyPracticePlay(
  gameRef: React.MutableRefObject<any>,
  play: (typeof PRACTICE_PLAYS)[number],
  formation: string,
  aggressivenessKey: AggressivenessKey,
  shouldActivate = true,
) {
  // 1. Deactivate any running play (clears stale player refs before formation rebuild)
  gameRef.current?.deactivatePracticePlay?.();
  // 2. Rebuild formation → snaps all players to homePos
  gameRef.current?.setTeamFormations?.(formation, formation);
  // 3. Tune CPU shot accuracy
  const agg = PRACTICE_AGGRESSIVENESS[aggressivenessKey];
  gameRef.current?.setCPUShotTuning?.(agg.aimErrorRad, agg.pressureError);
  applyGameAggressionSettings(gameRef.current, aggressivenessKey);
  // 4. Compute routes from fresh player positions
  const allPlayers = gameRef.current?.getPlayers?.() ?? [];
  const attackSign = gameRef.current?.getTeamAAttackSign?.() ?? 1;
  const routes = getPlayRoutes(play, allPlayers, attackSign);
  // 5. Draw arrows + execute play
  gameRef.current?.drawPracticeRoutes?.(routes);
  if (shouldActivate) {
    gameRef.current?.activatePracticePlay?.(routes, play.template);
  }
}

const BASE_TEAM_OPTIONS = WORLD_CUP_2026_TEAM_NAMES;
const EASTER_EGG_TEAM_OPTIONS = ['Italy 1982', 'West Germany 1982'];

const SOCCER_FORMATION_OPTIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3'];

const MLS_TEAM_KITS = PLAYABLE_WORLD_TEAM_KITS as Record<string, { home: { shirt: number; pants: number }; away: { shirt: number; pants: number } }>;
const FALLBACK_TEAM_KIT = MLS_TEAM_KITS[DEFAULT_HOME_TEAM] ?? Object.values(MLS_TEAM_KITS)[0];
const MLS_TEAM_NAMES = PLAYABLE_WORLD_TEAM_NAMES;
type CpuMatchup = { a: string; b: string };
type WindowResolutionPreset = '1280x720' | '1366x768' | '1600x900' | '1920x1080';

const WINDOW_RESOLUTION_STORAGE_KEY = 'psl.windowResolution';
const DISPLAY_MODE_STORAGE_KEY = 'psl.displayMode';

/** Windowed uses the resolution presets; fullscreen hides the taskbar. */
type DisplayMode = 'WINDOWED' | 'FULLSCREEN';

function getStoredDisplayMode(): DisplayMode {
  try {
    return window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) === 'FULLSCREEN' ? 'FULLSCREEN' : 'WINDOWED';
  } catch {
    return 'WINDOWED';
  }
}

/**
 * Borderless fullscreen. Tauri's setFullscreen keeps the webview at the
 * monitor's resolution and removes the decorations, which is what the tester
 * wanted: no Windows taskbar over the pitch.
 */
async function applyDisplayMode(mode: DisplayMode) {
  if (!(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) return false;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().setFullscreen(mode === 'FULLSCREEN');
  return true;
}
const WINDOW_RESOLUTION_PRESETS: ReadonlyArray<{ key: WindowResolutionPreset; label: string; width: number; height: number }> = [
  { key: '1280x720', label: '1280 × 720', width: 1280, height: 720 },
  { key: '1366x768', label: '1366 × 768', width: 1366, height: 768 },
  { key: '1600x900', label: '1600 × 900', width: 1600, height: 900 },
  { key: '1920x1080', label: '1920 × 1080', width: 1920, height: 1080 },
];
const DEFAULT_WINDOW_RESOLUTION: WindowResolutionPreset = '1600x900';
const INTERACTIVE_PLAYER_MODES_ENABLED = true;

function isWindowResolutionPreset(value: string): value is WindowResolutionPreset {
  return WINDOW_RESOLUTION_PRESETS.some((preset) => preset.key === value);
}

function getStoredWindowResolution(): WindowResolutionPreset {
  try {
    const stored = window.localStorage.getItem(WINDOW_RESOLUTION_STORAGE_KEY);
    if (stored && isWindowResolutionPreset(stored)) return stored;
  } catch {}
  return DEFAULT_WINDOW_RESOLUTION;
}

async function applyWindowResolution(preset: WindowResolutionPreset) {
  const next = WINDOW_RESOLUTION_PRESETS.find((candidate) => candidate.key === preset) ?? WINDOW_RESOLUTION_PRESETS[2];
  // Resizing while fullscreen would silently fight the display mode.
  if (getStoredDisplayMode() === 'FULLSCREEN') return;
  if ((window as any).__TAURI_INTERNALS__) {
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
    const currentWindow = getCurrentWindow();
    await currentWindow.setSize(new LogicalSize(next.width, next.height));
    await currentWindow.center();
    return;
  }
  if (typeof window.resizeTo === 'function') {
    window.resizeTo(next.width, next.height);
  }
}

function randomCpuMatchup(): CpuMatchup {
  const fixture = randomWorldCup2026GroupFixture();
  if (fixture) {
    return {
      a: fixture.homeTeam,
      b: fixture.awayTeam,
    };
  }
  const homeIndex = Math.floor(Math.random() * MLS_TEAM_NAMES.length);
  let awayIndex = Math.floor(Math.random() * Math.max(1, MLS_TEAM_NAMES.length - 1));
  if (awayIndex >= homeIndex) awayIndex += 1;
  return {
    a: MLS_TEAM_NAMES[homeIndex],
    b: MLS_TEAM_NAMES[awayIndex % MLS_TEAM_NAMES.length],
  };
}

function getTeamColor(teamName: string): string {
  const kit = MLS_TEAM_KITS[teamName];
  if (!kit) return '#38bdf8'; // fallback sky-400
  const hex = kit.home.shirt;
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function getResolvedMatchKits(teamAName: string, teamBName: string, teamAKit: 'home' | 'away', teamBKit: 'home' | 'away') {
  return resolvePlayableTeamKits(teamAName, teamBName, teamAKit, teamBKit) as {
    homeKey: 'home' | 'away';
    awayKey: 'home' | 'away';
    home: { shirt: number; pants: number };
    away: { shirt: number; pants: number };
  };
}

const MLS_TEAM_LOGOS: Record<string, string> = {};

function ScoreboardFlag({ teamName }: { teamName: string }) {
  const flag = getWorldCupTeamFlag(teamName);
  const flagAsset = getWorldCupTeamFlagAsset(teamName);
  return (
    <div
      className="relative h-9 w-11 sm:h-10 sm:w-12 shrink-0 overflow-hidden rounded-[3px] border border-black/15 bg-white grid place-items-center text-[25px] sm:text-[28px] leading-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]"
      aria-label={`${teamName} flag`}
      title={`${teamName} flag`}
    >
      <span className="leading-none">{flag || shortTeamName(teamName).slice(0, 3)}</span>
      {flagAsset && (
        <img
          src={flagAsset}
          alt={`${teamName} flag`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

/** Pre-Match Setup Screen Component */
interface PreMatchSetupScreenProps {
  teamAName: string;
  teamBName: string;
  teamAFormation: string;
  teamBFormation: string;
  teamAAggressiveness: AggressivenessKey;
  teamBAggressiveness: AggressivenessKey;
  teamAHome: boolean;
  teamBHome: boolean;
  teamAPreMatchKit: number;
  teamBPreMatchKit: number;
  onTeamANameChange: (name: string) => void;
  onTeamBNameChange: (name: string) => void;
  onTeamAFormationChange: (formation: string) => void;
  onTeamBFormationChange: (formation: string) => void;
  onTeamAAggressivenessChange: (agg: AggressivenessKey) => void;
  onTeamBAggressivenessChange: (agg: AggressivenessKey) => void;
  onTeamAHomeChange: (isHome: boolean) => void;
  onTeamBHomeChange: (isHome: boolean) => void;
  onTeamAPreMatchKitChange: (kit: number) => void;
  onTeamBPreMatchKitChange: (kit: number) => void;
  halfLengthMinutes: number;
  onHalfLengthMinutesChange: (minutes: number) => void;
  onStartMatch: () => void;
  watchedFixtureMessage: string;
  teamOptions: string[];
  onClose: () => void;
}

const PRE_MATCH_SELECT_CLASSNAME = 'bg-zinc-800 border border-white/20 text-white text-[11px] rounded px-2 py-1.5 focus:outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 pointer-events-auto cursor-pointer relative';
const PRE_MATCH_HALF_LENGTH_OPTIONS = ['2', '5', '10', '15', '20', '30', '45'];
const PRE_MATCH_AGGRESSIVENESS_OPTIONS = Object.keys(PRACTICE_AGGRESSIVENESS) as AggressivenessKey[];
type MatchKitKey = 'home' | 'away';
type KickoffSetupOptions = {
  teamAKit?: MatchKitKey;
  teamBKit?: MatchKitKey;
  teamAFormation?: string;
  teamBFormation?: string;
  teamAAggressiveness?: AggressivenessKey;
  teamBAggressiveness?: AggressivenessKey;
};

function preMatchKitKey(index: number): MatchKitKey {
  return index === 1 ? 'away' : 'home';
}

interface TeamSetupSectionProps {
  team: 'A' | 'B';
  name: string;
  formation: string;
  aggressiveness: AggressivenessKey;
  isHome: boolean;
  kitIndex: number;
  teamOptions: string[];
  aggressivenessOptions: AggressivenessKey[];
  onNameChange: (name: string) => void;
  onFormationChange: (formation: string) => void;
  onAggressivenessChange: (agg: AggressivenessKey) => void;
  onKitChange: (kitIndex: number) => void;
  onHomeChange?: (isHome: boolean) => void;
}

const TeamSetupSection = React.memo(({
  team,
  name,
  formation,
  aggressiveness,
  isHome,
  kitIndex,
  teamOptions,
  aggressivenessOptions,
  onNameChange,
  onFormationChange,
  onAggressivenessChange,
  onKitChange,
  onHomeChange,
}: TeamSetupSectionProps) => {
  const [lineupOpen, setLineupOpen] = useState(false);
  const kit = MLS_TEAM_KITS[name] ?? FALLBACK_TEAM_KIT;
  const selectedKit = kitIndex === 0 ? kit.home : kit.away;
  const shirtColor = `#${selectedKit.shirt.toString(16).padStart(6, '0')}`;
  const pantsColor = `#${selectedKit.pants.toString(16).padStart(6, '0')}`;
  const lineup = useMemo(() => getWorldTeamStartingLineup(name, formation), [name, formation]);

  return (
    <div className="flex-1 bg-zinc-900/80 border border-white/10 rounded-lg p-4 flex flex-col gap-4 relative">
      {/* Team Name and Home/Away */}
      <div className="flex items-center gap-3 relative z-50">
        <CustomDropdown
          id={`prematch-team-${team}-select`}
          ariaLabel={`${team === 'A' ? 'Team A' : 'Team B'} country`}
          dataSelect={`prematch-team-${team}`}
          value={name}
          onChange={onNameChange}
          options={teamOptions}
          className="flex-1 pointer-events-auto z-[80]"
        />
        {onHomeChange && (
          <button
            type="button"
            onClick={() => onHomeChange(!isHome)}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded border transition-colors ${
              isHome
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
                : 'bg-blue-500/30 border-blue-400 text-blue-300'
            }`}
          >
            {isHome ? '🏠 HOME' : '✈️ AWAY'}
          </button>
        )}
      </div>

      {/* Uniform Kit Selection */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/40 text-[11px] uppercase tracking-widest">Kit</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onKitChange(0)}
            className={`flex-1 py-2 rounded border text-[11px] font-bold uppercase tracking-widest transition-colors ${
              kitIndex === 0
                ? 'bg-cyan-500/40 border-cyan-400 text-cyan-300'
                : 'bg-zinc-800 border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            HOME
          </button>
          <button
            type="button"
            onClick={() => onKitChange(1)}
            className={`flex-1 py-2 rounded border text-[11px] font-bold uppercase tracking-widest transition-colors ${
              kitIndex === 1
                ? 'bg-cyan-500/40 border-cyan-400 text-cyan-300'
                : 'bg-zinc-800 border-white/20 text-white/60 hover:border-white/40'
            }`}
          >
            AWAY
          </button>
        </div>
        <div
          className="w-full h-10 rounded border border-white/20"
          style={{
            background: `linear-gradient(90deg, ${shirtColor} 50%, ${pantsColor} 50%)`,
          }}
          title={`Shirt: ${selectedKit.shirt.toString(16)} | Pants: ${selectedKit.pants.toString(16)}`}
        />
      </div>

      {/* Formation */}
      <div className="flex flex-col gap-1.5 relative z-40">
        <label className="text-white/40 text-[11px] uppercase tracking-widest">Formation</label>
        <CustomDropdown
          id={`prematch-formation-${team}-select`}
          ariaLabel={`${team === 'A' ? 'Team A' : 'Team B'} formation`}
          dataSelect={`prematch-formation-${team}`}
          value={formation}
          onChange={onFormationChange}
          options={SOCCER_FORMATION_OPTIONS}
          className="pointer-events-auto z-[70]"
        />
      </div>

      {/* Aggressiveness */}
      <div className="flex flex-col gap-1.5 relative z-40">
        <label className="text-white/40 text-[11px] uppercase tracking-widest">Aggressiveness</label>
        <CustomDropdown
          id={`prematch-aggressiveness-${team}-select`}
          ariaLabel={`${team === 'A' ? 'Team A' : 'Team B'} aggressiveness`}
          dataSelect={`prematch-aggressiveness-${team}`}
          value={aggressiveness}
          onChange={(value) => onAggressivenessChange(value as AggressivenessKey)}
          options={aggressivenessOptions}
          className="pointer-events-auto z-[70]"
        />
      </div>

      {/* Lineup Preview */}
      <div className="flex flex-col gap-1.5 pointer-events-auto">
        <label className="text-white/40 text-[11px] uppercase tracking-widest">Starting XI</label>
        <button
          type="button"
          data-psl-lineup-toggle={team}
          aria-expanded={lineupOpen}
          aria-controls={`psl-lineup-panel-${team}`}
          onClick={() => setLineupOpen((open) => !open)}
          className="bg-zinc-800/50 border border-white/10 rounded p-2 text-white/70 text-[11px] hover:bg-zinc-800 hover:border-white/20 cursor-pointer transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span>{name} Starting XI</span>
            <span className="text-cyan-300">{lineupOpen ? 'HIDE' : 'VIEW'}</span>
          </div>
          <div className="mt-1 text-white/40 uppercase tracking-[0.16em]">{formation} shape</div>
        </button>
        {lineupOpen ? (
          <div id={`psl-lineup-panel-${team}`} data-psl-lineup-panel={team} className="grid grid-cols-1 gap-1 rounded border border-cyan-400/20 bg-black/35 p-2">
            {lineup.map((player: any) => (
              <div key={`${player.number}-${player.role}`} className="grid grid-cols-[2rem_3rem_1fr] items-center gap-2 text-[11px]">
                <span className="text-right font-bold text-cyan-200">{player.number}</span>
                <span className="font-bold text-white/60">{player.role}</span>
                <span className="truncate text-white">{player.name}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

const PreMatchSetupScreen: React.FC<PreMatchSetupScreenProps> = ({
  teamAName,
  teamBName,
  teamAFormation,
  teamBFormation,
  teamAAggressiveness,
  teamBAggressiveness,
  teamAHome,
  teamBHome,
  teamAPreMatchKit,
  teamBPreMatchKit,
  onTeamANameChange,
  onTeamBNameChange,
  onTeamAFormationChange,
  onTeamBFormationChange,
  onTeamAAggressivenessChange,
  onTeamBAggressivenessChange,
  onTeamAHomeChange,
  onTeamBHomeChange,
  onTeamAPreMatchKitChange,
  onTeamBPreMatchKitChange,
  halfLengthMinutes,
  onHalfLengthMinutesChange,
  onStartMatch,
  watchedFixtureMessage,
  teamOptions,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = [
      'button:not([disabled])',
      'select:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusFirst = () => {
      const first = dialog.querySelector<HTMLElement>(focusableSelector);
      (first || dialog).focus();
    };
    focusFirst();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 pointer-events-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prematch-title"
        tabIndex={-1}
        className="max-w-6xl w-full bg-zinc-950 border border-cyan-500/20 rounded-xl shadow-2xl p-6 flex flex-col gap-6 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 id="prematch-title" className="text-white text-[11px] font-bold uppercase tracking-widest mb-1 [text-wrap:balance]">Pre-Match Setup</h2>
          <p className="text-white/40 text-[11px] uppercase tracking-widest">Configure teams, formations, and difficulty</p>
        </div>

        {/* Team Setup Sections */}
        <div className="grid grid-cols-2 gap-4">
          <TeamSetupSection
            team="A"
            name={teamAName}
            formation={teamAFormation}
            aggressiveness={teamAAggressiveness}
            isHome={teamAHome}
            kitIndex={teamAPreMatchKit}
            teamOptions={teamOptions}
            aggressivenessOptions={PRE_MATCH_AGGRESSIVENESS_OPTIONS}
            onNameChange={onTeamANameChange}
            onFormationChange={onTeamAFormationChange}
            onAggressivenessChange={onTeamAAggressivenessChange}
            onKitChange={onTeamAPreMatchKitChange}
            onHomeChange={onTeamAHomeChange}
          />
          <TeamSetupSection
            team="B"
            name={teamBName}
            formation={teamBFormation}
            aggressiveness={teamBAggressiveness}
            isHome={teamBHome}
            kitIndex={teamBPreMatchKit}
            teamOptions={teamOptions}
            aggressivenessOptions={PRE_MATCH_AGGRESSIVENESS_OPTIONS}
            onNameChange={onTeamBNameChange}
            onFormationChange={onTeamBFormationChange}
            onAggressivenessChange={onTeamBAggressivenessChange}
            onKitChange={onTeamBPreMatchKitChange}
            onHomeChange={onTeamBHomeChange}
          />
        </div>

        {/* Match Length */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-white text-[11px] font-semibold uppercase tracking-[0.25em]">Half Length</div>
            </div>
            <div className="w-32">
              <CustomDropdown
                id="prematch-half-length-select"
                ariaLabel="Half length"
                dataSelect="prematch-half-length"
                value={`${halfLengthMinutes}`}
                onChange={(value) => onHalfLengthMinutesChange(Number(value))}
                options={PRE_MATCH_HALF_LENGTH_OPTIONS}
                className="w-full pointer-events-auto z-[70]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onStartMatch();
            }}
            className="flex-1 bg-cyan-500/40 border border-cyan-400 text-cyan-100 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[11px] hover:bg-cyan-500/60 transition-colors"
          >
            <span aria-hidden="true">⚽</span> Start Match
          </button>
        </div>
        {watchedFixtureMessage ? (
          <div className="text-center text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">
            {watchedFixtureMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Memoize to prevent dropdown from closing on parent re-renders
const MemoizedPreMatchSetupScreen = React.memo(PreMatchSetupScreen);
const PRACTICE_SELECT_CLASSNAME = 'bg-zinc-800 border border-white/15 text-white text-xs rounded px-1.5 py-1 focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

/** Module-stable modal dropdown using the old button/list interaction without delayed document races. */
const CustomDropdown = <T extends string>({
  id,
  ariaLabel,
  dataSelect,
  value,
  onChange,
  options,
  className = '',
}: {
  id: string;
  ariaLabel: string;
  dataSelect: string;
  value: T;
  onChange: (value: T) => void;
  options: T[];
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = `${id}-listbox`;

  useEffect(() => {
    const selectedIndex = Math.max(0, options.findIndex((option) => option === value));
    setActiveIndex(selectedIndex);
  }, [options, value]);

  useEffect(() => {
    if (!isOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside, true);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside, true);
    };
  }, [isOpen]);

  const selectOption = (option: T) => {
    onChange(option);
    setIsOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const moveActive = (delta: number) => {
    setActiveIndex((index) => {
      if (options.length === 0) return 0;
      return (index + delta + options.length) % options.length;
    });
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        data-psl-custom-dropdown="old-modal"
        data-psl-custom-dropdown-button={dataSelect}
        data-psl-select={dataSelect}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setIsOpen(false);
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(true);
            moveActive(1);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(true);
            moveActive(-1);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            if (isOpen) {
              selectOption(options[activeIndex] ?? value);
            } else {
              setIsOpen(true);
            }
          }
        }}
        className="flex w-full items-center justify-between gap-2 rounded border border-white/20 bg-zinc-800 px-2 py-1.5 text-left text-[11px] text-white transition-colors hover:border-white/40 focus:outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
      >
        <span className="truncate">{value}</span>
        <span aria-hidden="true" className="text-[8px] leading-none">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          data-psl-custom-dropdown-menu={dataSelect}
          aria-label={ariaLabel}
          aria-activedescendant={`${id}-option-${activeIndex}`}
          className="absolute left-0 right-0 top-full z-[10000] mt-1 max-h-56 overflow-y-auto rounded border border-white/20 bg-zinc-900 shadow-2xl"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
        >
          {options.map((option, index) => (
            <button
              id={`${id}-option-${index}`}
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              data-psl-custom-dropdown-option={dataSelect}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectOption(option);
              }}
              className={`block w-full px-3 py-2 text-left text-[11px] transition-colors ${
                value === option
                  ? 'bg-cyan-500/40 text-cyan-100'
                  : index === activeIndex
                    ? 'bg-white/10 text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

function MenuTeamSelect({
  label,
  value,
  focused,
  options,
  onChange,
}: {
  label: string;
  value: string;
  focused: boolean;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, options.indexOf(value)));
  const dropdownRef = useRef<HTMLDivElement>(null);
  const flag = getWorldCupTeamFlag(value);
  const flagAsset = getWorldCupTeamFlagAsset(value);
  const lowerLabel = label.toLowerCase();
  const buttonId = `main-menu-${lowerLabel}-team-select`;
  const listboxId = `${buttonId}-listbox`;

  useEffect(() => {
    setActiveIndex(Math.max(0, options.indexOf(value)));
  }, [options, value]);

  useEffect(() => {
    if (!isOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside, true);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside, true);
    };
  }, [isOpen]);

  const selectTeam = (team: string) => {
    onChange(team);
    setIsOpen(false);
  };

  const moveActive = (delta: number) => {
    setActiveIndex((index) => {
      if (options.length === 0) return 0;
      return (index + delta + options.length) % options.length;
    });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="text-center text-[13px] font-black uppercase leading-none text-white" style={{ textShadow: '0 3px 0 rgba(0,0,0,0.75)' }}>
        {label}
      </div>
      <div ref={dropdownRef} className={`relative h-14 rounded-md border bg-zinc-950/90 shadow-[0_0_0_2px_rgba(0,0,0,0.7),inset_0_0_22px_rgba(255,255,255,0.05)] ${focused ? 'border-white ring-2 ring-lime-300/70' : 'border-white/70'}`}>
        <div className="pointer-events-none absolute left-4 top-1/2 z-[2] grid h-7 w-10 -translate-y-1/2 place-items-center overflow-hidden rounded-[2px] border border-white/40 bg-white text-[22px] leading-none">
          <span>{flag || shortTeamName(value).slice(0, 2)}</span>
          {flagAsset && (
            <img
              src={flagAsset}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
        <button
          id={buttonId}
          type="button"
          data-psl-menu-team-select={lowerLabel}
          aria-label={`${label} team`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen((open) => !open);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setIsOpen(false);
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.stopPropagation();
              setIsOpen(true);
              moveActive(1);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              setIsOpen(true);
              moveActive(-1);
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              if (isOpen) {
                selectTeam(options[activeIndex] ?? value);
              } else {
                setIsOpen(true);
              }
            }
          }}
          className="relative z-[3] h-full w-full rounded-md bg-transparent pl-[72px] pr-12 text-left text-[18px] font-black uppercase leading-none text-white outline-none pointer-events-auto focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          style={{ textShadow: '0 2px 0 rgba(0,0,0,0.8)' }}
        >
          <span className="block truncate">{value}</span>
        </button>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-7 w-7 -translate-y-1/2 text-white" strokeWidth={3} />
        {isOpen ? (
          <div
            id={listboxId}
            role="listbox"
            data-psl-menu-team-menu={lowerLabel}
            aria-label={`${label} team`}
            aria-activedescendant={`${buttonId}-option-${activeIndex}`}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-[10000] max-h-72 overflow-y-auto rounded-md border border-white/70 bg-zinc-950 py-1 shadow-[0_10px_30px_rgba(0,0,0,0.65)]"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
          >
            {options.map((team, index) => (
              <button
                id={`${buttonId}-option-${index}`}
                key={`${label}-${team}`}
                type="button"
                role="option"
                aria-selected={value === team}
                data-psl-menu-team-option={lowerLabel}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectTeam(team);
                }}
                className={`block w-full px-4 py-2 text-left text-[13px] font-black uppercase tracking-[0.04em] ${
                  value === team
                    ? 'bg-lime-400 text-black'
                    : index === activeIndex
                      ? 'bg-white/15 text-white'
                      : 'text-white hover:bg-white/10'
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MenuModeButton({
  children,
  focused,
  tone = 'white',
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  focused: boolean;
  tone?: 'white' | 'muted' | 'amber' | 'green';
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClass =
    tone === 'amber'
      ? focused
        ? 'border-amber-300 bg-amber-500/25 text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.28)]'
        : 'border-amber-400 text-amber-300 hover:bg-amber-500/15'
      : tone === 'green'
        ? focused
          ? 'border-lime-300 bg-lime-500/20 text-lime-300 shadow-[0_0_24px_rgba(132,204,22,0.28)]'
          : 'border-lime-500 text-lime-400 hover:bg-lime-500/15'
        : tone === 'muted'
          ? focused
            ? 'border-slate-300 bg-slate-500/20 text-slate-200'
            : 'border-white/35 text-slate-400 hover:bg-white/10 hover:text-slate-200'
          : focused
            ? 'border-white bg-white/15 text-white shadow-[0_0_24px_rgba(255,255,255,0.22)]'
            : 'border-white/80 text-white hover:bg-white/10';
  const disabledClass = disabled
    ? 'cursor-not-allowed border-white/20 text-white/25 hover:bg-transparent opacity-70 shadow-none'
    : '';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`h-[58px] w-full rounded-md border-2 bg-zinc-950/86 text-[19px] font-black uppercase leading-none transition-colors shadow-[0_0_0_2px_rgba(0,0,0,0.75),inset_0_2px_0_rgba(255,255,255,0.14),inset_0_-10px_22px_rgba(255,255,255,0.04)] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${disabled ? disabledClass : toneClass}`}
      style={{ textShadow: '0 3px 0 rgba(0,0,0,0.85)' }}
    >
      {children}
    </button>
  );
}

function formatScoreboardClock(snapshot: any) {
  if (!snapshot) return '00:00';
  const elapsed = Math.max(0, Number(snapshot.elapsedInHalf) || 0);
  const halfDuration = Math.max(1, Number(snapshot.halfDuration) || 45 * 60);
  const halfOffset = snapshot.half === 2 ? halfDuration : 0;
  const totalSeconds = Math.floor(halfOffset + elapsed);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function scoreboardPhaseLabel(snapshot: any) {
  const phase = snapshot?.phase || 'PRE_MATCH';
  if (phase === 'FIRST_HALF') return '1H';
  if (phase === 'SECOND_HALF') return '2H';
  if (phase === 'HALFTIME') return 'HT';
  if (phase === 'FULL_TIME') return 'FT';
  if (phase === 'KICKOFF') return 'KO';
  return 'PRE';
}

function shortTeamName(name: string) {
  return String(name || 'TEAM')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 4)
    .toUpperCase() || 'TEAM';
}

function shallowEqualRecord(a: any, b: any) {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
}

function matchSnapshotRenderKey(snapshot: any | null) {
  if (!snapshot) return 'null';
  return [
    snapshot.phase,
    snapshot.half,
    Math.floor(Number(snapshot.elapsedInHalf ?? 0) * 10),
    snapshot.scoreA,
    snapshot.scoreB,
    snapshot.shotsA,
    snapshot.shotsB,
    snapshot.shotsOnTargetA,
    snapshot.shotsOnTargetB,
    snapshot.savesA,
    snapshot.savesB,
    snapshot.headersA,
    snapshot.headersB,
    snapshot.cornersA,
    snapshot.cornersB,
    snapshot.throwInsA,
    snapshot.throwInsB,
    snapshot.goalKicksA,
    snapshot.goalKicksB,
    snapshot.foulsA,
    snapshot.foulsB,
    snapshot.offsidesA,
    snapshot.offsidesB,
    snapshot.goalLog?.length ?? 0,
  ].join('|');
}

function pslDebugLog(...args: unknown[]) {
  try {
    if (localStorage.getItem('psl.debug') !== '1') return;
  } catch {
    return;
  }
  console.info(...args);
}

const RetroFootball: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const engineRuntimeTokenRef = useRef<string | null>(null);
  const telemetryRecorderRef = useRef<TelemetryRecorder | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const [cameraMode, setCameraMode] = useState<'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE' | 'GOAL_THREE_QUARTER' | 'STADIUM_CAM'>('BROADCAST');
  const [teamAUniform, setTeamAUniform] = useState(0);
  const [teamBUniform, setTeamBUniform] = useState(0);
  const [teamAName, setTeamAName] = useState(DEFAULT_HOME_TEAM);
  const [teamBName, setTeamBName] = useState(DEFAULT_AWAY_TEAM);
  const teamANameRef = useRef(DEFAULT_HOME_TEAM);
  const teamBNameRef = useRef(DEFAULT_AWAY_TEAM);
  const activeMatchTeamsRef = useRef<{ a: string; b: string } | null>(null);
  const [easterEggUnlocked, setEasterEggUnlocked] = useState(false);
  const [teamAFormation, setTeamAFormation] = useState('3-4-3');
  const [teamBFormation, setTeamBFormation] = useState('3-4-3');
  const [teamAAggressiveness, setTeamAAggressiveness] = useState<AggressivenessKey>('BALANCED');
  const [teamBAggressiveness, setTeamBAggressiveness] = useState<AggressivenessKey>('BALANCED');
  const [teamAHome, setTeamAHome] = useState(true);
  const [showPreMatchSetup, setShowPreMatchSetup] = useState(false);
  const showPreMatchSetupRef = useRef(false);
  const [watchedFixtureRunning, setWatchedFixtureRunning] = useState(false);
  const [watchedFixtureMessage, setWatchedFixtureMessage] = useState('');
  const [cpuVsCpuPending, setCpuVsCpuPending] = useState<{ a: string; b: string } | null>(null);
  const [teamAPreMatchKit, setTeamAPreMatchKit] = useState(0); // 0=home, 1=away
  const [teamBPreMatchKit, setTeamBPreMatchKit] = useState(1); // 0=home, 1=away
  const [halfLengthMinutes, setHalfLengthMinutes] = useState(5);
  const [foulsEnabled, setFoulsEnabled] = useState(true);
  const [cpuDifficulty, setCpuDifficulty] = useState<'RELAXED' | 'NORMAL' | 'COMPETITIVE' | 'RUTHLESS'>(() => {
    try {
      const stored = window.localStorage.getItem('psl.cpuDifficulty');
      return stored === 'RELAXED' || stored === 'COMPETITIVE' || stored === 'RUTHLESS' ? stored : 'NORMAL';
    } catch {
      return 'NORMAL';
    }
  });
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'OPTIONS' | 'CONTROLS' | 'STATS' | 'MATCH_HISTORY' | 'FRAME_VIEWER' | 'HOW_TO_PLAY' | 'LIVE_TELEMETRY'>('OPTIONS');
  const devToolsVisible = useMemo(() => hasDevServer(), []);
  // A tab persisted from a dev session must not strand a player on a hidden tab.
  useEffect(() => {
    if (!devToolsVisible && (DEV_ONLY_OPTIONS_TABS as readonly string[]).includes(activeTab)) {
      setActiveTab('OPTIONS');
    }
  }, [devToolsVisible, activeTab]);
  const [crowdVolume, setCrowdVolume] = useState(0.60);
  const [windowResolution, setWindowResolution] = useState<WindowResolutionPreset>(() => getStoredWindowResolution());
  const [windowResolutionMessage, setWindowResolutionMessage] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => getStoredDisplayMode());
  const [musicVolume, setMusicVolume] = useState(() => {
    try {
      // Number(null) is 0, which is finite and in range -- reading it directly
      // would start a first-run player in silence instead of at the default.
      const raw = window.localStorage.getItem('psl.musicVolume');
      if (raw === null) return 0.5;
      const stored = Number(raw);
      return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.5;
    } catch {
      return 0.5;
    }
  });
  const [autoSwitching, setAutoSwitching] = useState<'AUTOMATIC' | 'AIR_BALLS' | 'LOOSE_BALLS' | 'MANUAL'>('AUTOMATIC');
  const [players, setPlayers] = useState<any[]>([]);
  const [matchSnapshot, setMatchSnapshot] = useState<any | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [selectedDefensePlayer, setSelectedDefensePlayer] = useState<any>(null);
  const matchSnapshotRenderKeyRef = useRef('null');
  const selectedPlayerRef = useRef<any>(null);
  const selectedDefensePlayerRef = useRef<any>(null);
  const [driftRows, setDriftRows] = useState<any[]>([]);
  const [driftSessionId, setDriftSessionId] = useState<string | null>(null);
  const [driftThresholdPct, setDriftThresholdPct] = useState(10);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftMessage, setDriftMessage] = useState('');
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [telemCounts, setTelemCounts] = useState<Record<string, number> | null>(null);
  const [telemExporting, setTelemExporting] = useState(false);
  const [telemClearing, setTelemClearing] = useState(false);
  const [diskMirrorStatus, setDiskMirrorStatus] = useState<Awaited<ReturnType<typeof getDiskMirrorStatus>> | null>(null);
  const [diskMirrorMessage, setDiskMirrorMessage] = useState('');
  const [diskRecovering, setDiskRecovering] = useState(false);
  const [movementWindowSeconds, setMovementWindowSeconds] = useState<10 | 20>(20);
  const [movementAnchor, setMovementAnchor] = useState<'pause' | 'full_time' | 'latest'>('pause');
  const [autoScanOnPause, setAutoScanOnPause] = useState(true);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementMessage, setMovementMessage] = useState('');
  const [movementFrames, setMovementFrames] = useState(0);
  const [movementSessionId, setMovementSessionId] = useState<string | null>(null);
  const [movementLastAnchorUsed, setMovementLastAnchorUsed] = useState<'pause' | 'full_time' | 'latest' | null>(null);
  const [movementLastRunAt, setMovementLastRunAt] = useState<number | null>(null);
  const [movementTopRows, setMovementTopRows] = useState<Array<{
    name: string;
    team?: 'A' | 'B';
    role?: string;
    distanceMeters: number;
    avgSpeedMps: number;
    maxStepMps: number;
  }>>([]);
  const [movementTrailPaths, setMovementTrailPaths] = useState<Record<string, string>>({});
  const [isLive, setIsLive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isLiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const [isGroundVisible, setIsGroundVisible] = useState(true);
  const [isFieldVisible, setIsFieldVisible] = useState(true);
  const [isGrassVisible, setIsGrassVisible] = useState(true);
  const [shotBallTrailEnabled, setShotBallTrailEnabled] = useState(true);
  const [showAnimInspector, setShowAnimInspector] = useState(false);
  const [teamAKit, setTeamAKit] = useState<'home' | 'away'>('home');
  const [teamBKit, setTeamBKit] = useState<'home' | 'away'>('away');
  const [hotSeatMode, setHotSeatMode] = useState(false);
  const [testingMode, setTestingMode] = useState(false);
  const [gameMode, setGameMode] = useState<'1p' | '2p' | 'cpu' | 'test' | 'practice' | 'replay' | null>(null);
  const [hasActiveMatchSession, setHasActiveMatchSession] = useState(false);
  const gameModeRef = useRef<typeof gameMode>(null);
  const matchSnapshotRef = useRef<any | null>(null);
  const halftimeAwaitingRef = useRef(false);
  // Practice mode setup state
  const [showPracticeSetup, setShowPracticeSetup] = useState(false);
  const showPracticeSetupRef = useRef(false);
  const [practiceIsHuman, setPracticeIsHuman] = useState(true);
  const [selectedPracticePlay, setSelectedPracticePlay] = useState<string | null>(null);
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceFormation, setPracticeFormation] = useState<string>(PRACTICE_PLAYS[0].formation);
  const [practiceAggressiveness, setPracticeAggressiveness] = useState<AggressivenessKey>('AGGRESSIVE');
  const [showPracticeComplete, setShowPracticeComplete] = useState(false);
  const practiceCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const practiceStartPauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allowMainMenu, setAllowMainMenu] = useState(true);
  const [sessionMenuLock, setSessionMenuLock] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashAudioStarted, setSplashAudioStarted] = useState(false);
  const splashAdvancedRef = useRef(false);
  const splashAudioStartedRef = useRef(false);
  const splashSceneStartedRef = useRef(false);
  const [isFullTime, setIsFullTime] = useState(false);
  const isFullTimeRef = useRef(false);
  const [fullTimeScore, setFullTimeScore] = useState<{ scoreA: number; scoreB: number; teamA: string; teamB: string; colorA?: string; colorB?: string; shotsA?: number; shotsB?: number; sogA?: number; sogB?: number; savesA?: number; savesB?: number; headersA?: number; headersB?: number; breakawayGoalsA?: number; breakawayGoalsB?: number; goals?: { team: string; playerName: string; shirtNumber: number; matchMinute: number; attackersInBox?: number; defendersInBox?: number; outfieldBoxCrowd?: number; isBreakaway?: boolean }[] } | null>(null);
  const fullTimeReturnArmedRef = useRef(false);
  const fullTimeCapturedRef = useRef(false);
  const prevIsLive = useRef(false);

  // ── Season mode state ─────────────────────────────────────────
  const [seasonModeActive, setSeasonModeActive] = useState(false);
  const [seasonMatchResult, setSeasonMatchResult] = useState<{ scoreA: number; scoreB: number } | null>(null);
  const seasonReturnRef = useRef(false); // true when returning from a season match

  // ── Gamepad menu navigation ───────────────────────────────────
  const [menuFocusIndex, setMenuFocusIndex] = useState(INTERACTIVE_PLAYER_MODES_ENABLED ? 2 : 4);
  const menuFocusRef = useRef(INTERACTIVE_PLAYER_MODES_ENABLED ? 2 : 4);
  const menuGpPrev = useRef<boolean[]>(new Array(17).fill(false));
  const gameplayGpPrev = useRef<boolean[]>(new Array(17).fill(false));
  const uiGamepadLatch = useRef(createGamepadLatch());
  const menuGpStickCooldown = useRef(0);
  const easterEggSequenceRef = useRef('');
  const handleKickOffRef = useRef<(
    mode: '1p' | '2p' | 'cpu' | 'test' | 'practice',
    overrideTeams?: { a: string; b: string },
    setupOptions?: KickoffSetupOptions,
  ) => void>(() => {});
  const handleRealDataReplayStartRef = useRef<() => void>(() => {});
  const handlePreMatchSetupStartRef = useRef<() => void>(() => {});
  const handleTogglePauseRef = useRef<() => void>(() => {});
  const handleContinueHalftimeRef = useRef<(mode?: 'manual' | 'auto_cpu') => void>(() => {});
  const setSeasonModeActiveRef = useRef(setSeasonModeActive);

  // Keep ref in sync with state for use in gamepad polling
  useEffect(() => { menuFocusRef.current = menuFocusIndex; }, [menuFocusIndex]);

  const startMenuVisible = allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock && !seasonModeActive && !showPreMatchSetup && !showPracticeSetup;
  const teamOptions = useMemo(
    () => (easterEggUnlocked ? [...BASE_TEAM_OPTIONS, ...EASTER_EGG_TEAM_OPTIONS] : BASE_TEAM_OPTIONS),
    [easterEggUnlocked],
  );
  const MENU_ITEM_COUNT = 7; // 0=Home, 1=Away, 2=1P, 3=2P, 4=CPU, 5=World Cup, 6=Practice
  const showScoreboard = hasActiveMatchSession && !showSplash && !isFullTime && !!matchSnapshot && matchSnapshot.phase !== 'PRE_MATCH';
  const showHalftimeOverlay = showScoreboard && matchSnapshot?.phase === 'HALFTIME';
  const scoreboardTeamA = matchSnapshot?.teamAName || teamAName;
  const scoreboardTeamB = matchSnapshot?.teamBName || teamBName;
  const buildPreMatchAssignment = () => {
    const panelA = {
      name: teamAName,
      formation: teamAFormation,
      aggressiveness: teamAAggressiveness,
      kit: preMatchKitKey(teamAPreMatchKit),
    };
    const panelB = {
      name: teamBName,
      formation: teamBFormation,
      aggressiveness: teamBAggressiveness,
      kit: preMatchKitKey(teamBPreMatchKit),
    };
    return teamAHome ? { home: panelA, away: panelB } : { home: panelB, away: panelA };
  };

  const handleTogglePause = () => {
    const paused = gameRef.current?.togglePaused?.();
    setIsPausedIfChanged(!!paused);
  };

  /**
   * Abandon the current match and go back to the main menu. Testers could only
   * leave a game mode by closing the application, so this mirrors what the
   * full-time screen already did -- just reachable mid-match.
   */
  const handleQuitToMainMenu = () => {
    setIsOptionsOpen(false);
    setIsPausedIfChanged(false);
    setIsFullTime(false);
    setFullTimeScore(null);
    fullTimeCapturedRef.current = false;
    activeMatchTeamsRef.current = null;
    try {
      sessionStorage.removeItem('psl_fullTime');
      sessionStorage.removeItem('psl_fullTimeScore');
    } catch {}
    setShowPreMatchSetup(false);
    setShowPracticeSetup(false);
    setPracticeActive(false);
    setSeasonModeActive(false);
    setAllowMainMenu(true);
    setSessionMenuLock(false);
    gameRef.current?.setPaused?.(false);
    gameRef.current?.setPracticeMode?.(false);
    gameRef.current?.clearPracticeRoutes?.();
    gameRef.current?.resetMatch?.();
    setGameMode(null);
    setHasActiveMatchSession(false);
    gameRef.current?.setMenuVisible?.(true);
  };

  useEffect(() => {
    try {
      sessionStorage.removeItem('psl_fullTime');
      sessionStorage.removeItem('psl_fullTimeScore');
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apply = async () => {
      try {
        await applyWindowResolution(windowResolution);
        if (cancelled) return;
        try {
          window.localStorage.setItem(WINDOW_RESOLUTION_STORAGE_KEY, windowResolution);
        } catch {}
        setWindowResolutionMessage((window as any).__TAURI_INTERNALS__ ? 'Applied to desktop window.' : 'Applied where the browser allows resizing.');
      } catch (error) {
        if (cancelled) return;
        console.error('Window resolution change failed', error);
        setWindowResolutionMessage('Window resize failed.');
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [windowResolution]);

  useEffect(() => {
    gameRef.current?.setMusicVolume?.(musicVolume);
    try {
      window.localStorage.setItem('psl.musicVolume', String(musicVolume));
    } catch {}
  }, [musicVolume, gameReady]);

  useEffect(() => {
    let cancelled = false;
    const apply = async () => {
      try {
        const applied = await applyDisplayMode(displayMode);
        if (cancelled) return;
        try {
          window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode);
        } catch {}
        if (!applied) {
          setWindowResolutionMessage('Fullscreen is only available in the desktop build.');
        } else if (displayMode === 'FULLSCREEN') {
          setWindowResolutionMessage('Fullscreen on. Resolution presets are disabled.');
        } else {
          setWindowResolutionMessage('Windowed.');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Display mode change failed', error);
        setWindowResolutionMessage('Display mode change failed.');
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [displayMode]);

  useEffect(() => {
    if (!startMenuVisible || showSplash || easterEggUnlocked) return;
    const onKey = (event: KeyboardEvent) => {
      if (!/^[0-9]$/.test(event.key)) return;
      easterEggSequenceRef.current = `${easterEggSequenceRef.current}${event.key}`.slice(-4);
      if (easterEggSequenceRef.current === '1982') {
        setEasterEggUnlocked(true);
        setTeamAName('Italy 1982');
        setTeamBName('West Germany 1982');
        setTeamAKit('home');
        setTeamBKit('home');
        setMenuFocusIndex(5);
        easterEggSequenceRef.current = '';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startMenuVisible, showSplash, easterEggUnlocked]);

  useEffect(() => {
    teamANameRef.current = teamAName;
  }, [teamAName]);

  useEffect(() => {
    teamBNameRef.current = teamBName;
  }, [teamBName]);

  // ── Splash screen dismiss handler ──
  useEffect(() => {
    if (!showSplash) return;
    const dismiss = () => {
      if (!splashAudioStartedRef.current) {
        // First press starts audio and immediately advances to menu.
        splashAudioStartedRef.current = true;
        setSplashAudioStarted(true);
        gameRef.current?.splashMusicStart?.();
      }
      if (!splashAdvancedRef.current) {
        // Advance to menu (music continues until match starts).
        splashAdvancedRef.current = true;
        // Snapshot current gamepad state into menuGpPrev so the menu poll
        // (which may run later in this same rAF batch) won't see a false "justPressed".
        const gp0 = navigator.getGamepads()[0];
        if (gp0) menuGpPrev.current = Array.from(gp0.buttons).map(b => b.pressed);
        setShowSplash(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); dismiss(); };
    const onClick = () => dismiss();
    let rafId = 0;
    const pollPad = () => {
      const gp = navigator.getGamepads()[0];
      if (gp) {
        const anyBtn = Array.from(gp.buttons).some(b => b.pressed);
        if (anyBtn) { dismiss(); return; }
      }
      rafId = requestAnimationFrame(pollPad);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onClick);
    rafId = requestAnimationFrame(pollPad);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onClick);
      cancelAnimationFrame(rafId);
    };
  }, [showSplash]);

  useEffect(() => {
    if (!startMenuVisible) return;
    let rafId = 0;
    const poll = () => {
      // Don't process menu gamepad input while splash screen is still showing
      if (!splashAdvancedRef.current) {
        // Keep prev state fresh so no false "just pressed" triggers after splash dismisses
        const gp0 = navigator.getGamepads()[0];
        if (gp0) menuGpPrev.current = Array.from(gp0.buttons).map(b => b.pressed);
        rafId = requestAnimationFrame(poll);
        return;
      }
      const pads = navigator.getGamepads();
      const gp = pads[0];
      if (gp) {
        const btns = Array.from(gp.buttons).map(b => b.pressed);
        const prev = menuGpPrev.current;
        const justPressed = (i: number) => btns[i] && !prev[i];

        // Stick / D-pad vertical navigation
        const stickY = gp.axes[1] ?? 0;
        const dpadUp = btns[12];
        const dpadDown = btns[13];
        const dpadLeft = btns[14];
        const dpadRight = btns[15];
        const now = performance.now();

        if (now > menuGpStickCooldown.current) {
          if (stickY < -0.5 || dpadUp) {
            setMenuFocusIndex(i => (i - 1 + MENU_ITEM_COUNT) % MENU_ITEM_COUNT);
            menuGpStickCooldown.current = now + 200;
          } else if (stickY > 0.5 || dpadDown) {
            setMenuFocusIndex(i => (i + 1) % MENU_ITEM_COUNT);
            menuGpStickCooldown.current = now + 200;
          }
        }

        // Left/Right on dropdowns to cycle teams
        if (now > menuGpStickCooldown.current) {
          const stickX = gp.axes[0] ?? 0;
          const fi = menuFocusRef.current;
          if (stickX > 0.5 || dpadRight) {
            if (fi === 0) {
              setTeamAName(prev => {
                const idx = Math.max(0, teamOptions.indexOf(prev));
                return teamOptions[(idx + 1) % teamOptions.length];
              });
            } else if (fi === 1) {
              setTeamBName(prev => {
                const idx = Math.max(0, teamOptions.indexOf(prev));
                return teamOptions[(idx + 1) % teamOptions.length];
              });
            }
            menuGpStickCooldown.current = now + 180;
          } else if (stickX < -0.5 || dpadLeft) {
            if (fi === 0) {
              setTeamAName(prev => {
                const idx = Math.max(0, teamOptions.indexOf(prev));
                return teamOptions[(idx - 1 + teamOptions.length) % teamOptions.length];
              });
            } else if (fi === 1) {
              setTeamBName(prev => {
                const idx = Math.max(0, teamOptions.indexOf(prev));
                return teamOptions[(idx - 1 + teamOptions.length) % teamOptions.length];
              });
            }
            menuGpStickCooldown.current = now + 180;
          }
        }

        // A / Cross (0) → select current item
        if (justPressed(0)) {
          setMenuFocusIndex(fi => {
            if (fi === 2 && INTERACTIVE_PLAYER_MODES_ENABLED) handleKickOffRef.current('1p');
            else if (fi === 3 && INTERACTIVE_PLAYER_MODES_ENABLED) handleKickOffRef.current('2p');
            else if (fi === 4) {
              setShowPreMatchSetup(true);
            }
            else if (fi === 5) setSeasonModeActiveRef.current(true);
            else if (fi === 6) setShowPracticeSetup(true);
            return fi;
          });
        }

        // Start (9) → quick-start the first available real mode
        if (justPressed(9)) {
          if (INTERACTIVE_PLAYER_MODES_ENABLED) handleKickOffRef.current('1p');
          else setShowPreMatchSetup(true);
        }

        menuGpPrev.current = btns;
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [startMenuVisible, easterEggUnlocked]);

  const hasActiveMatchSessionRef = useRef(false);
  const showSplashRef = useRef(showSplash);
  const liveTuningClearedForSplashRef = useRef(false);
  const prevMatchSnapshotRef = useRef<any | null>(null);
  const autoScanOnPauseRef = useRef(true);
  const lastAutoScanAtRef = useRef(0);
  const smokeTestActiveRef = useRef(false);
  const runMovementScanRef = useRef<(forcedAnchor?: 'pause' | 'full_time' | 'latest', forcedSeconds?: 10 | 20) => Promise<void>>(async () => {});

  useEffect(() => {
    autoScanOnPauseRef.current = autoScanOnPause;
  }, [autoScanOnPause]);

  useEffect(() => {
    hasActiveMatchSessionRef.current = hasActiveMatchSession;
  }, [hasActiveMatchSession]);

  useEffect(() => {
    showPreMatchSetupRef.current = showPreMatchSetup;
  }, [showPreMatchSetup]);

  useEffect(() => {
    showPracticeSetupRef.current = showPracticeSetup;
  }, [showPracticeSetup]);

  useEffect(() => {
    isFullTimeRef.current = isFullTime;
  }, [isFullTime]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    showSplashRef.current = showSplash;
    if (!showSplash) {
      liveTuningClearedForSplashRef.current = false;
    }
  }, [showSplash]);

  const setMatchSnapshotIfChanged = (snapshot: any | null) => {
    const key = matchSnapshotRenderKey(snapshot);
    if (key === matchSnapshotRenderKeyRef.current) return;
    matchSnapshotRenderKeyRef.current = key;
    setMatchSnapshot(snapshot);
  };

  const setSelectedPlayerIfChanged = (next: any | null) => {
    if (shallowEqualRecord(selectedPlayerRef.current, next)) return;
    selectedPlayerRef.current = next;
    setSelectedPlayer(next);
  };

  const setSelectedDefensePlayerIfChanged = (next: any | null) => {
    if (shallowEqualRecord(selectedDefensePlayerRef.current, next)) return;
    selectedDefensePlayerRef.current = next;
    setSelectedDefensePlayer(next);
  };

  const setIsPausedIfChanged = (next: boolean) => {
    if (isPausedRef.current === next) return;
    isPausedRef.current = next;
    setIsPaused(next);
  };

  const setIsLiveIfChanged = (next: boolean) => {
    if (isLiveRef.current === next) return;
    isLiveRef.current = next;
    setIsLive(next);
  };

  const handleContinueHalftime = (mode: 'manual' | 'auto_cpu' = 'manual') => {
    const continued = gameRef.current?.continueFromHalftime?.(mode);
    if (!continued) return;
    setIsPausedIfChanged(false);
    const snapshot = gameRef.current?.getMatchSnapshot?.() || null;
    if (snapshot) {
      matchSnapshotRef.current = snapshot;
      halftimeAwaitingRef.current = snapshot.phase === 'HALFTIME';
      setMatchSnapshotIfChanged(snapshot);
    }
  };

  // The halftime card literally reads "Press any key to continue", but nothing
  // was listening for a key -- only the click handler and the gamepad poller.
  useEffect(() => {
    if (!showHalftimeOverlay || gameMode === 'cpu') return;
    const onKey = (event: KeyboardEvent) => {
      // Escape still belongs to the options menu, and bare modifiers are not
      // "a key" from the player's point of view.
      if (event.key === 'Escape' || event.key === 'Shift' || event.key === 'Control'
        || event.key === 'Alt' || event.key === 'Meta') return;
      event.preventDefault();
      handleContinueHalftimeRef.current('manual');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHalftimeOverlay, gameMode]);

  useEffect(() => {
    let rafId = 0;
    const pollGameplayGamepad = () => {
      // Same selector the engine uses: slot 0 is often an analog keyboard or a
      // virtual-pad bus, which is why halftime "press any key" never fired.
      const gp = pickStandardGamepad(uiGamepadLatch.current, () => {
        gameplayGpPrev.current = new Array(17).fill(false);
      });
      if (!gp) {
        gameplayGpPrev.current = new Array(17).fill(false);
        rafId = requestAnimationFrame(pollGameplayGamepad);
        return;
      }

      const btns = Array.from(gp.buttons).map((button) => button.pressed);
      const prev = gameplayGpPrev.current;
      const justPressed = (index: number) => !!btns[index] && !prev[index];

      const confirmPressed = justPressed(0);
      const backPressed = justPressed(1);
      const startPressed = justPressed(9);

      if (!showSplashRef.current) {
        if (showPreMatchSetupRef.current) {
          if (confirmPressed) handlePreMatchSetupStartRef.current();
          if (backPressed) setShowPreMatchSetup(false);
        } else if (showPracticeSetupRef.current) {
          if (backPressed) setShowPracticeSetup(false);
        } else if (hasActiveMatchSessionRef.current && !isFullTimeRef.current) {
          if (halftimeAwaitingRef.current && (confirmPressed || startPressed)) {
            handleContinueHalftimeRef.current('manual');
          } else if (startPressed) {
            handleTogglePauseRef.current();
          }
        }
      }

      gameplayGpPrev.current = btns;
      rafId = requestAnimationFrame(pollGameplayGamepad);
    };
    rafId = requestAnimationFrame(pollGameplayGamepad);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const recorder = telemetryRecorderRef.current;
    if (!recorder) return;
    if (smokeTestActiveRef.current) return;
    if (showSplash || !hasActiveMatchSession) {
      void recorder.stop().then(() => {
        if (telemetryRecorderRef.current === recorder) {
          telemetryRecorderRef.current = null;
        }
      });
    }
  }, [hasActiveMatchSession, showSplash]);

  useEffect(() => {
    const captureFullTime = (snapshot: any, runPostFullTimeWork = false) => {
      if (!snapshot || smokeTestActiveRef.current || fullTimeCapturedRef.current) return;
      fullTimeCapturedRef.current = true;
      setIsFullTime(true);
      setHasActiveMatchSession(true);
      setAllowMainMenu(false);
      setSessionMenuLock(true);
      const teamA = snapshot.teamAName || activeMatchTeamsRef.current?.a || teamANameRef.current;
      const teamB = snapshot.teamBName || activeMatchTeamsRef.current?.b || teamBNameRef.current;
      const tuningBundle = gameRef.current?.getTuningBundle?.();
      const visibleHeaderEvents = Array.isArray(tuningBundle?.headerAnimationEvents) ? tuningBundle.headerAnimationEvents : [];
      const visibleHeadersA = visibleHeaderEvents.filter((event: any) => event?.team === 'A').length;
      const visibleHeadersB = visibleHeaderEvents.filter((event: any) => event?.team === 'B').length;
      const ftScore = {
        scoreA: snapshot.scoreA,
        scoreB: snapshot.scoreB,
        teamA,
        teamB,
        shotsA: snapshot.shotsA,
        shotsB: snapshot.shotsB,
        sogA: snapshot.shotsOnTargetA,
        sogB: snapshot.shotsOnTargetB,
        savesA: snapshot.savesA,
        savesB: snapshot.savesB,
        headersA: visibleHeadersA,
        headersB: visibleHeadersB,
        goals: snapshot.goalLog || [],
        colorA: getTeamColor(teamA),
        colorB: getTeamColor(teamB),
      };
      setFullTimeScore(ftScore);
      try { sessionStorage.setItem('psl_fullTime', '1'); sessionStorage.setItem('psl_fullTimeScore', JSON.stringify(ftScore)); } catch {}
      gameRef.current?.setMenuVisible?.(false);
      gameRef.current?.setScoreBugVisible?.(false);
      if (runPostFullTimeWork) {
        mirrorMatchSummary();
        // AUTOMATION: Seed baselines and auto-apply recommendations
        import('../telemetry/mls2025-baselines').then(m =>
          m.seedMLS2025Baselines && m.seedMLS2025Baselines()
        ).then(() =>
          generateDriftRecommendations({ thresholdPct: 10 })
        );
      }
    };

    const interval = setInterval(() => {
      if (gameRef.current) {
        const currentIsLive = gameRef.current.getIsLive();
        const snapshot = gameRef.current.getMatchSnapshot?.() || null;
        setIsPausedIfChanged(!!gameRef.current.getPaused?.());
        if (snapshot) {
          matchSnapshotRef.current = snapshot;
          halftimeAwaitingRef.current = snapshot.phase === 'HALFTIME';
          setMatchSnapshotIfChanged(snapshot);
        }

        if (snapshot?.phase === 'FULL_TIME' && !smokeTestActiveRef.current && !fullTimeCapturedRef.current) {
          const phaseTransitionMissedOrCurrent = prevMatchSnapshotRef.current?.phase !== 'FULL_TIME';
          captureFullTime(snapshot, phaseTransitionMissedOrCurrent);
        }

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
            if (snapshot.phase === 'FULL_TIME' && !smokeTestActiveRef.current) {
              captureFullTime(snapshot, true);
            }
          }
          const prevShotSeq = prev.lastShotTelemetry?.seq ?? 0;
          const nextShotSeq = snapshot.lastShotTelemetry?.seq ?? 0;
          if (nextShotSeq > prevShotSeq && snapshot.lastShotTelemetry) {
            // Also mirror shot events to disk for offline analysis
            telemetryRecorderRef.current?.recordEvent('shot_style_taken', snapshot.lastShotTelemetry);
          }
          const prevKeeperKickSeq = prev.lastKeeperKickTelemetry?.seq ?? 0;
          const nextKeeperKickSeq = snapshot.lastKeeperKickTelemetry?.seq ?? 0;
          if (nextKeeperKickSeq > prevKeeperKickSeq && snapshot.lastKeeperKickTelemetry) {
            // Recorder loop handles DB insert; nothing extra needed here
          }
        }

        if (prevIsLive.current && !currentIsLive) {
          // Play just ended
          setSelectedPlayerIfChanged(gameRef.current.getSelectedPlayerStats());
          telemetryRecorderRef.current?.recordEvent('play_stopped', {
            phase: snapshot?.phase,
            elapsedInHalf: snapshot?.elapsedInHalf,
          });

          const nowMs = Date.now();
          if (autoScanOnPauseRef.current && nowMs - lastAutoScanAtRef.current >= 12000) {
            lastAutoScanAtRef.current = nowMs;
            void runMovementScanRef.current('pause', 10);
          }
          
          gameRef.current.selectRandomDefensePlayer();
          setSelectedDefensePlayerIfChanged(gameRef.current.getSelectedDefensePlayerStats());
        }
        if (!prevIsLive.current && currentIsLive) {
          // Only lock menu when a real active session is underway.
          if (hasActiveMatchSessionRef.current) {
            setSessionMenuLock(true);
          }
          telemetryRecorderRef.current?.recordEvent('play_started', {
            phase: snapshot?.phase,
            elapsedInHalf: snapshot?.elapsedInHalf,
          });
        }
        prevIsLive.current = currentIsLive;
        if (snapshot) prevMatchSnapshotRef.current = snapshot;
        
        setSelectedPlayerIfChanged(gameRef.current.getSelectedPlayerStats());
        setSelectedDefensePlayerIfChanged(gameRef.current.getSelectedDefensePlayerStats());
        setIsLiveIfChanged(currentIsLive);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // ── Dashboard telemetry bridge (separate effect, always mounts) ──
  // Everything below feeds dev tooling: the /__tuning and /__db routes live in
  // the Vite dev/preview middleware, and psl-tuning{,-history} in localStorage
  // is read only by public/dashboard.html. In the packaged desktop build none
  // of it exists, so the 2s serialize-and-post loop would burn frame budget
  // for nothing.
  useEffect(() => {
    if (!hasDevServer()) return;
    let dashChannel: BroadcastChannel | null = null;
    try { dashChannel = new BroadcastChannel('psl-telemetry'); } catch {}
    // Default to BroadcastChannel + fetch. The websocket relay is optional because
    // repeated reconnect loops can stall the live browser session if port 8081 is absent.
    const enableDashWs = (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('dashboardTransport') === 'ws' || localStorage.getItem('psl-dashboard-transport') === 'ws';
      } catch {
        return false;
      }
    })();
    let dashWs: WebSocket | null = null;
    let dashWsStopped = false;
    const dashWsUrl = `ws://${window.location.hostname || 'localhost'}:8081`;
    const connectDashboardWs = () => {
      if (!enableDashWs || dashWsStopped || typeof WebSocket === 'undefined') return;
      try {
        dashWs = new WebSocket(dashWsUrl);
        dashWs.onopen = () => pslDebugLog('[PSL-Bridge] WebSocket connected:', dashWsUrl);
        dashWs.onclose = () => {
          dashWs = null;
        };
        dashWs.onerror = () => {
          try { dashWs?.close(); } catch {}
        };
      } catch {}
    };
    const sendDashboardWs = (payload: unknown) => {
      if (!enableDashWs || dashWs?.readyState !== WebSocket.OPEN) return;
      try { dashWs.send(JSON.stringify(payload)); } catch {}
    };
    connectDashboardWs();
    pslDebugLog('[PSL] Dashboard bridge useEffect MOUNTED');
    let prevPhase = '';
    let _dashTick = 0;
    const dashInterval = setInterval(() => {
      _dashTick++;
      // Skip broadcasting during splash/menu — only track real matches
      if (showSplashRef.current) {
        if (!liveTuningClearedForSplashRef.current) {
          liveTuningClearedForSplashRef.current = true;
          try { fetch('/__tuning/clear', { method: 'POST', keepalive: true }).catch(() => {}); } catch {}
        }
        if (_dashTick % 10 === 0) pslDebugLog('[PSL-Bridge] skip: splash screen visible');
        return;
      }
      if (!hasActiveMatchSessionRef.current) {
        if (!liveTuningClearedForSplashRef.current) {
          liveTuningClearedForSplashRef.current = true;
          try { fetch('/__tuning/clear', { method: 'POST', keepalive: true }).catch(() => {}); } catch {}
        }
        if (_dashTick % 10 === 0) pslDebugLog('[PSL-Bridge] skip: no active match session');
        return;
      }
      liveTuningClearedForSplashRef.current = false;
      const g = (window as any).__gameRef;
      if (!g) {
        if (_dashTick % 10 === 0) pslDebugLog('[PSL-Bridge] skip: __gameRef not set');
        return;
      }

      const snap2 = g.getMatchSnapshot?.();
      // Engine-level guard: splash-scene demos have sessionActive=false. Skip them
      // even if React's hasActiveMatchSession ref is stale (e.g. after HMR remount).
      if (snap2?.sessionActive === false) {
        if (_dashTick % 10 === 0) pslDebugLog('[PSL-Bridge] skip: splash-scene demo (sessionActive=false)');
        return;
      }
      const phase = snap2?.phase || '';
      const isPhaseChange = phase !== prevPhase;

      const rawBundle = g.getTuningBundle?.();
      if (!rawBundle) {
        if (_dashTick % 10 === 0) pslDebugLog('[PSL-Bridge] skip: getTuningBundle returned null, phase=', phase);
        return;
      }
      const bundleMatchId = snap2?.matchId || (rawBundle as any).matchId || (rawBundle as any).metadata?.matchId || null;
      const defaultSplashGhostLive =
        rawBundle.teamA?.name === 'Inter Miami'
        && rawBundle.teamB?.name === 'LA Galaxy'
        && !bundleMatchId;
      if (defaultSplashGhostLive) {
        if (_dashTick % 10 === 0) pslDebugLog('[PSL-Bridge] skip: default splash ghost without match id');
        return;
      }
      const live2 = g.getLiveTelemetry?.();
      const payload = compactLiveDashboardPayload({ type: 'tuning', bundle: rawBundle, snapshot: snap2, live: live2, ts: Date.now(), sessionActive: snap2?.sessionActive !== false });
      const bundle = payload.bundle;

      // Live in-memory channels: send every tick (2s) so dashboard gets data quickly
      if (_dashTick % 5 === 0) {
        pslDebugLog('[PSL-Bridge] posting tick=' + _dashTick + ' phase=' + phase + ' isLive=' + snap2?.isLive + ' score=' + bundle.teamA?.score + '-' + bundle.teamB?.score);
      }
      try { dashChannel?.postMessage(payload); } catch (e) { console.warn('[PSL-Bridge] BroadcastChannel post failed:', e); }
      sendDashboardWs(payload);
      try { (window as any).sendDashboardUpdate?.('tuning', bundle, snap2); } catch (e) {}

      // Expensive disk/network ops: rate-limit to once every 20s or on phase change
      const shouldSync = _dashTick % 10 === 0 || isPhaseChange;
      if (!shouldSync) return;

      if (isPhaseChange) {
        pslDebugLog(`[Dashboard] Phase changed to: ${phase}, Score: ${bundle.teamA.score} - ${bundle.teamB.score}`);
      }
      try { localStorage.setItem('psl-tuning', JSON.stringify(payload)); } catch (e) {
        try { localStorage.removeItem('psl-tuning-history'); localStorage.setItem('psl-tuning', JSON.stringify(payload)); } catch {}
      }

      // Server relay: reduce frequency via fetch
      try { fetch('/__tuning/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {}); } catch {}
      
      // Auto-save when match reaches FULL_TIME
      // Skip splash-scene demos (sessionActive=false when splashSceneMode is on) — those are ghost matches.
      // Skip smoke-test runs — they save through the smoke-test runner directly,
      // and they produce malformed stats (e.g. 0 shots) that pollute the dashboard.
      if (phase === 'FULL_TIME' && prevPhase !== 'FULL_TIME' && snap2?.sessionActive !== false && !smokeTestActiveRef.current) {
        // Save to SQLite via server endpoint
        try {
          const fullBundle = rawBundle;
          const a = fullBundle.teamA, b = fullBundle.teamB;
          const matchId = snap2?.matchId || null;
          const defaultSplashGhost =
            a?.name === 'Inter Miami'
            && b?.name === 'LA Galaxy'
            && !matchId
            && !(fullBundle as any).matchId
            && !(fullBundle as any).metadata?.matchId;
          if (defaultSplashGhost) {
            console.warn('[PSL] skipped ghost full-time row: Inter Miami vs LA Galaxy without match id');
            prevPhase = phase;
            return;
          }
          if (matchId && !(fullBundle as any).matchId) (fullBundle as any).matchId = matchId;
          fetch('/__db/match-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildMatchResultPayload({
              bundle: fullBundle,
              snapshot: snap2,
              fallbackSessionId: `ft-${Date.now()}`,
            })),
          }).then(r => {
            if (r.ok) pslDebugLog(`[PSL] Match saved ${matchId || '(no id)'}: ${a?.name} ${a?.score}-${b?.score} ${b?.name}`);
            else console.warn('[PSL] SQLite save failed:', r.status);
          }).catch(e => console.warn('[PSL] SQLite save error:', e));
        } catch (e) { console.warn('[PSL] SQLite save error:', e); }
        // Legacy localStorage fallback
        try {
          const history: any[] = JSON.parse(localStorage.getItem('psl-tuning-history') || '[]');
          const entry = {
            id: Date.now(),
            teamA: bundle.teamA?.name,
            teamB: bundle.teamB?.name,
            scoreA: bundle.teamA?.score ?? 0,
            scoreB: bundle.teamB?.score ?? 0,
            bundle: rawBundle,
          };
          history.push(entry);
          while (history.length > 50) history.shift();
          localStorage.setItem('psl-tuning-history', JSON.stringify(history));
        } catch {}
      }
      prevPhase = phase;
    }, 2000);
    return () => {
      clearInterval(dashInterval);
      dashWsStopped = true;
      try { dashWs?.close(); } catch {}
      try { dashChannel?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootGame = async () => {
      if (!containerRef.current) return;
      if (gameRef.current && engineRuntimeTokenRef.current !== ENGINE_RUNTIME_TOKEN) {
        telemetryRecorderRef.current?.stop?.().catch?.(() => {});
        telemetryRecorderRef.current = null;
        try {
          gameRef.current.dispose?.();
        } catch {}
        gameRef.current = null;
        setGameReady(false);
      }
      if (gameRef.current) return;
      try {
        performance.mark('psl:game-engine-import:start');
      } catch {}
      const { initGame } = await import('../gameEngine');
      try {
        performance.mark('psl:game-engine-import:end');
        performance.measure('psl:game-engine-import', 'psl:game-engine-import:start', 'psl:game-engine-import:end');
      } catch {}
      if (cancelled || !containerRef.current || gameRef.current) return;
      gameRef.current = initGame(containerRef.current);
      gameRef.current?.setEngineRuntimeToken?.(ENGINE_RUNTIME_TOKEN);
      engineRuntimeTokenRef.current = ENGINE_RUNTIME_TOKEN;
      setGameReady(true);
      (window as any).pslGame = gameRef.current;
      const urlParams = new URLSearchParams(window.location.search);
      const useNewArchitecture = urlParams.has('newarch');
      gameRef.current?.setUseNewArchitecture?.(useNewArchitecture);
      if (useNewArchitecture) {
        gameRef.current?.setShowOrchTelemetry?.(true);
      }
      const resolvedKits = getResolvedMatchKits(teamAName, teamBName, teamAKit, teamBKit);
      const kitA = resolvedKits.home;
      const kitB = resolvedKits.away;
      gameRef.current?.setTeamFormations?.(teamAFormation, teamBFormation);
      gameRef.current?.setTeamNames?.(teamAName, teamBName);
      gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[teamAName] ?? '', MLS_TEAM_LOGOS[teamBName] ?? '');
      gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
      gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
      applyGameAggressionSettings(gameRef.current, teamAAggressiveness, teamBAggressiveness);
      gameRef.current?.setCameraMode?.(cameraMode);
      gameRef.current?.setShotBallTrailEnabled?.(shotBallTrailEnabled);
      gameRef.current?.setMenuVisible?.(gameMode === null);
      gameRef.current?.setTestingMode?.(false);
      gameRef.current?.setHotSeatMode?.(false);
      gameRef.current?.setTwoPlayerMode?.(false);
      gameRef.current?.setCpuVsCpu?.(false);
      gameRef.current?.setPracticePlayCompleteCallback?.(() => {
        if (practiceCompleteTimerRef.current) clearTimeout(practiceCompleteTimerRef.current);
        setShowPracticeComplete(true);
        setPracticeActive(false);
        practiceCompleteTimerRef.current = setTimeout(() => setShowPracticeComplete(false), 2200);
      });

      // Poll play activity state for UI badge - throttled to 250ms
      let lastPracticeCheck = 0;
      const updatePracticeState = (now: number) => {
        if (now - lastPracticeCheck > 250) {
          if (gameRef.current && gameMode === 'practice') {
            const isActive = gameRef.current.isPracticePlayActive?.() ?? false;
            setPracticeActive(p => (p !== isActive ? isActive : p));
          }
          lastPracticeCheck = now;
        }
        requestAnimationFrame(updatePracticeState);
      };
      requestAnimationFrame(updatePracticeState);

      // Expose game API on window for automation / telemetry scripts
      (window as any).__gameRef = gameRef.current;
      (window as any).game = gameRef.current;
      (window as any).__gameRef.setSmokeTestMode = (active: boolean) => {
        smokeTestActiveRef.current = active;
        // Pause/resume the React telemetry recorder to avoid double-recording
        // and excessive IDB writes during smoke tests
        if (active) {
          // Dismiss splash screen if it's still showing
          setShowSplash(false);
          splashAdvancedRef.current = true;
          setAllowMainMenu(false);
          setHasActiveMatchSession(true);
          gameRef.current?.setSplashSceneMode?.(false);
          gameRef.current?.setMenuVisible?.(false);
          gameRef.current?.setScoreBugVisible?.(true);
          telemetryRecorderRef.current?.stop();
        } else if (!telemetryRecorderRef.current?.isRecording()) {
          const rec = new TelemetryRecorder();
          rec.setContext({ teamAName, teamBName, teamAFormation, teamBFormation });
          rec.start(() => gameRef.current, 500);
          telemetryRecorderRef.current = rec;
        }
      };
      (window as any).__pslUiTest = {
        applySmokeFixtureSetup: async (fixture: { homeTeam: string; awayTeam: string; formationA: string; formationB: string }) => {
          teamANameRef.current = fixture.homeTeam;
          teamBNameRef.current = fixture.awayTeam;
          activeMatchTeamsRef.current = { a: fixture.homeTeam, b: fixture.awayTeam };
          fullTimeCapturedRef.current = false;
          setShowSplash(false);
          splashAdvancedRef.current = true;
          setShowPreMatchSetup(false);
          setShowPracticeSetup(false);
          setHasActiveMatchSession(true);
          setAllowMainMenu(false);
          setSessionMenuLock(true);
          setIsFullTime(false);
          setFullTimeScore(null);
          setTeamAName(fixture.homeTeam);
          setTeamBName(fixture.awayTeam);
          setTeamAFormation(fixture.formationA);
          setTeamBFormation(fixture.formationB);
          gameRef.current?.setSplashSceneMode?.(false);
          gameRef.current?.setMenuVisible?.(false);
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        },
        openWorldCupMode: (team?: string) => {
          if (team) {
            deleteWorldCup();
            saveWorldCup(createWorldCupRecord(team));
          }
          setShowSplash(false);
          splashAdvancedRef.current = true;
          setIsOptionsOpen(false);
          setShowPracticeSetup(false);
          setShowPreMatchSetup(false);
          setHasActiveMatchSession(false);
          setAllowMainMenu(true);
          setSessionMenuLock(false);
          setIsFullTime(false);
          setFullTimeScore(null);
          try {
            sessionStorage.removeItem('psl_fullTime');
            sessionStorage.removeItem('psl_fullTimeScore');
          } catch {}
          gameRef.current?.setSplashSceneMode?.(false);
          gameRef.current?.setMenuVisible?.(true);
          setSeasonModeActive(true);
        },
      };

      gameRef.current?.setOnReset?.(() => {
        // Always clear full-time overlay and UI latches
        setIsLiveIfChanged(false);
        setIsFullTime(false);
        fullTimeCapturedRef.current = false;
        activeMatchTeamsRef.current = null;
        try { sessionStorage.removeItem('psl_fullTime'); sessionStorage.removeItem('psl_fullTimeScore'); } catch {}
        setFullTimeScore(null);
        prevIsLive.current = false;
        prevMatchSnapshotRef.current = null;

        if (smokeTestActiveRef.current) {
          // During smoke tests: clear UI but don't disable CPU mode or touch recorders
          setAllowMainMenu(false);
          return;
        }

        // Normal reset: return to main menu
        setGameMode(null);
        setHasActiveMatchSession(false);
        setAllowMainMenu(true);
        setSessionMenuLock(false);
        setHotSeatMode(false);
        setTestingMode(false);
        gameRef.current?.setHotSeatMode?.(false);
        gameRef.current?.setTestingMode?.(false);
        gameRef.current?.setTwoPlayerMode?.(false);
        gameRef.current?.setCpuVsCpu?.(false);
        gameRef.current?.setPracticeMode?.(false);
        gameRef.current?.clearPracticeRoutes?.();
        gameRef.current?.setMenuVisible?.(true);

        const rec = telemetryRecorderRef.current;
        if (!rec) return;
        rec.recordEvent('game_reset', {
          triggeredBy: 'R_key',
          timestamp: Date.now(),
        }).then(() => {
          rec.stop().then(() => {
            telemetryRecorderRef.current = null;
          });
        });
      });

      installTelemetryDebugApi();
      installSmokeTestApi();
    };
    void bootGame();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        halftimeAwaitingRef.current
        && hasActiveMatchSessionRef.current
        && !showSplashRef.current
        && gameModeRef.current !== 'cpu'
        && !e.repeat
      ) {
        e.preventDefault();
        handleContinueHalftime('manual');
        return;
      }
      if (e.key === 'Escape') {
        setIsOptionsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelled = true;
      setGameReady(false);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [ENGINE_RUNTIME_TOKEN]);

  useEffect(() => {
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
    const resolvedKits = getResolvedMatchKits(teamAName, teamBName, teamAKit, teamBKit);
    const kitA = resolvedKits.home;
    const kitB = resolvedKits.away;
    gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
    gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
  }, [teamAName, teamBName, teamAKit, teamBKit]);

  useEffect(() => {
    return () => {
      telemetryRecorderRef.current?.stop();
      telemetryRecorderRef.current = null;
    };
  }, []);

  const handleCameraChange = (mode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE' | 'GOAL_THREE_QUARTER' | 'STADIUM_CAM') => {
    setCameraMode(mode);
    gameRef.current?.setCameraMode(mode);
  };

  const handleUniformChange = (team: 'A' | 'B', index: number) => {
    if (team === 'A') setTeamAUniform(index);
    else setTeamBUniform(index);
    gameRef.current?.setUniform(team, index);
  };

  const handleKickOff = (
    mode: '1p' | '2p' | 'cpu' | 'test' | 'practice',
    overrideTeams?: { a: string; b: string },
    setupOptions: KickoffSetupOptions = {},
  ) => {
    if (!gameRef.current) {
      setWatchedFixtureMessage('Game engine loading. Try again in a moment.');
      return;
    }
    gameRef.current?.unlockGameplayAudio?.();
    const isInteractivePlayerMode = mode === '1p' || mode === '2p';
    const isHotSeat = mode === '2p';
    const isCpu = mode === 'cpu';
    const isTesting = mode === 'test';
    const isPractice = mode === 'practice';
    const kickoffTeams = overrideTeams ?? { a: teamAName, b: teamBName };
    const nextTeamAName = kickoffTeams.a;
    const nextTeamBName = kickoffTeams.b;
    const nextTeamAKit = setupOptions.teamAKit ?? teamAKit;
    const nextTeamBKit = setupOptions.teamBKit ?? teamBKit;
    const nextTeamAFormation = setupOptions.teamAFormation ?? teamAFormation;
    const nextTeamBFormation = setupOptions.teamBFormation ?? teamBFormation;
    const nextTeamAAggressiveness = setupOptions.teamAAggressiveness ?? teamAAggressiveness;
    const nextTeamBAggressiveness = setupOptions.teamBAggressiveness ?? teamBAggressiveness;
    activeMatchTeamsRef.current = { a: nextTeamAName, b: nextTeamBName };
    fullTimeCapturedRef.current = false;
    if (overrideTeams || isCpu) {
      setTeamAName(nextTeamAName);
      setTeamBName(nextTeamBName);
    }
    if (setupOptions.teamAKit) setTeamAKit(nextTeamAKit);
    if (setupOptions.teamBKit) setTeamBKit(nextTeamBKit);
    if (setupOptions.teamAFormation) setTeamAFormation(nextTeamAFormation);
    if (setupOptions.teamBFormation) setTeamBFormation(nextTeamBFormation);
    if (setupOptions.teamAAggressiveness) setTeamAAggressiveness(nextTeamAAggressiveness);
    if (setupOptions.teamBAggressiveness) setTeamBAggressiveness(nextTeamBAggressiveness);

    const resolvedKits = getResolvedMatchKits(nextTeamAName, nextTeamBName, nextTeamAKit, nextTeamBKit);
    const kitA = resolvedKits.home;
    const kitB = resolvedKits.away;
    gameRef.current?.setTeamNames?.(nextTeamAName, nextTeamBName);
    gameRef.current?.setTeamFormations?.(nextTeamAFormation, nextTeamBFormation);
    gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[nextTeamAName] ?? '', MLS_TEAM_LOGOS[nextTeamBName] ?? '');
    gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
    gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
    applyGameAggressionSettings(gameRef.current, nextTeamAAggressiveness, nextTeamBAggressiveness);

    const shouldShowAIOverlay = isCpu || isTesting;
    setGameMode(mode);
    setHasActiveMatchSession(true);
    setAllowMainMenu(false);
    setSessionMenuLock(true);
    setHotSeatMode(isInteractivePlayerMode || isTesting);
    setTestingMode(isTesting);

    const kickoffTelemetry = async () => {
      const previousRecorder = telemetryRecorderRef.current;
      if (previousRecorder?.isRecording()) {
        await previousRecorder.stop();
      }

      const recorder = new TelemetryRecorder();
      recorder.setContext({
        teamAName: nextTeamAName,
        teamBName: nextTeamBName,
        teamAFormation: nextTeamAFormation,
        teamBFormation: nextTeamBFormation,
        notes: 'Fresh session at kickoff',
      });
      await recorder.start(() => gameRef.current, 500);
      telemetryRecorderRef.current = recorder;

      await recorder.recordEvent('mode_selected', {
        mode,
        cpuVsCpu: isCpu,
        testingMode: isTesting,
        hotSeatMode: isInteractivePlayerMode || isTesting,
        teamAName: nextTeamAName,
        teamBName: nextTeamBName,
      });
      await recorder.recordEvent('selected_teams_locked', {
        mode,
        teamAName: nextTeamAName,
        teamBName: nextTeamBName,
      });
      await recorder.recordEvent('kickoff_presentation_started', {
        autoKick: true,
        mode,
      });
    };
    void kickoffTelemetry();
    // AI state overlay is off by default; user can toggle it manually
    gameRef.current?.setHotSeatMode?.(isInteractivePlayerMode || isTesting);
    gameRef.current?.setTwoPlayerMode?.(isHotSeat);
    gameRef.current?.setTestingMode?.(isTesting);
    gameRef.current?.setCpuVsCpu?.(isCpu);
    gameRef.current?.setPracticeMode?.(isPractice);
    if (isPractice) {
      gameRef.current?.setTestingMode?.(true);
      gameRef.current?.setHotSeatMode?.(true);
      gameRef.current?.setTwoPlayerMode?.(false);
    }
    gameRef.current?.splashMusicStop?.();
    gameRef.current?.setSplashSceneMode?.(false);
    gameRef.current?.setMenuVisible?.(false);
    gameRef.current?.startKickoffPresentation?.(true);
    setIsPausedIfChanged(false);
    setIsFullTime(false);
    setFullTimeScore(null);
    try { sessionStorage.removeItem('psl_fullTime'); sessionStorage.removeItem('psl_fullTimeScore'); } catch {}
  };

  const handlePreMatchSetupStart = () => {
    if (!gameRef.current) {
      setWatchedFixtureMessage('Game engine loading. Try again in a moment.');
      return;
    }
    setShowPreMatchSetup(false);
    const assignment = buildPreMatchAssignment();
    const kickoffTeams = { a: assignment.home.name, b: assignment.away.name };
    setTeamAHome(true);
    // Apply aggressiveness presets to the CPU shot tuning
    const aggressASet = PRACTICE_AGGRESSIVENESS[assignment.home.aggressiveness];
    gameRef.current?.setCPUShotTuning?.(aggressASet.aimErrorRad, aggressASet.pressureError);
    gameRef.current?.setHalfDurationSeconds?.(halfLengthMinutes * 60);
    gameRef.current?.setFoulsEnabled?.(foulsEnabled);
    gameRef.current?.setCpuDifficulty?.(cpuDifficulty);
    // Start the match with CPU vs CPU mode
    handleKickOff('cpu', kickoffTeams, {
      teamAKit: assignment.home.kit,
      teamBKit: assignment.away.kit,
      teamAFormation: assignment.home.formation,
      teamBFormation: assignment.away.formation,
      teamAAggressiveness: assignment.home.aggressiveness,
      teamBAggressiveness: assignment.away.aggressiveness,
    });
  };

  const handleRealDataReplayStart = () => {
    if (!gameRef.current) {
      setWatchedFixtureMessage('Game engine loading. Try again in a moment.');
      return;
    }
    setGameMode('replay');
    setHasActiveMatchSession(true);
    setAllowMainMenu(false);
    setSessionMenuLock(true);
    setHotSeatMode(false);
    setTestingMode(false);
    gameRef.current?.setHotSeatMode?.(false);
    gameRef.current?.setTestingMode?.(false);
    gameRef.current?.setTwoPlayerMode?.(false);
    gameRef.current?.setCpuVsCpu?.(false);
    gameRef.current?.setPracticeMode?.(false);
    gameRef.current?.splashMusicStop?.();
    gameRef.current?.setSplashSceneMode?.(false);
    gameRef.current?.setMenuVisible?.(false);
    gameRef.current?.setRealDataReplayMode?.(true);
    setIsFullTime(false);
    setFullTimeScore(null);
    fullTimeCapturedRef.current = false;
    activeMatchTeamsRef.current = { a: teamANameRef.current, b: teamBNameRef.current };
  };

  const handleRunWatchedFixture = async () => {
    if (watchedFixtureRunning) return;
    if (!gameRef.current) {
      setWatchedFixtureMessage('Game engine loading. Try again in a moment.');
      return;
    }
    const runner = (window as any).pslSmokeTest?.runFixture;
    if (typeof runner !== 'function') {
      setWatchedFixtureMessage('Fixture runner unavailable. Reload the page.');
      return;
    }

    const assignment = buildPreMatchAssignment();
    const fixtureTeams = { a: assignment.home.name, b: assignment.away.name };
    setTeamAHome(true);
    activeMatchTeamsRef.current = { a: fixtureTeams.a, b: fixtureTeams.b };
    fullTimeCapturedRef.current = false;
    setShowPreMatchSetup(false);
    setWatchedFixtureRunning(true);
    setWatchedFixtureMessage(`Watching ${fixtureTeams.a} vs ${fixtureTeams.b}`);

    const aggressASet = PRACTICE_AGGRESSIVENESS[assignment.home.aggressiveness];
    const resolvedKits = getResolvedMatchKits(fixtureTeams.a, fixtureTeams.b, assignment.home.kit, assignment.away.kit);
    const kitA = resolvedKits.home;
    const kitB = resolvedKits.away;
    setTeamAName(fixtureTeams.a);
    setTeamBName(fixtureTeams.b);
    setTeamAFormation(assignment.home.formation);
    setTeamBFormation(assignment.away.formation);
    setTeamAAggressiveness(assignment.home.aggressiveness);
    setTeamBAggressiveness(assignment.away.aggressiveness);
    setTeamAKit(assignment.home.kit);
    setTeamBKit(assignment.away.kit);
    gameRef.current?.setTeamNames?.(fixtureTeams.a, fixtureTeams.b);
    gameRef.current?.setTeamFormations?.(assignment.home.formation, assignment.away.formation);
    gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[fixtureTeams.a] ?? '', MLS_TEAM_LOGOS[fixtureTeams.b] ?? '');
    gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
    gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
    gameRef.current?.setCPUShotTuning?.(aggressASet.aimErrorRad, aggressASet.pressureError);
    applyGameAggressionSettings(gameRef.current, assignment.home.aggressiveness, assignment.away.aggressiveness);
    gameRef.current?.setHalfDurationSeconds?.(halfLengthMinutes * 60);
    gameRef.current?.setFoulsEnabled?.(foulsEnabled);
    gameRef.current?.setCpuDifficulty?.(cpuDifficulty);
    setGameMode('cpu');
    setHasActiveMatchSession(true);
    setAllowMainMenu(false);
    setSessionMenuLock(true);
    setHotSeatMode(false);
    setTestingMode(false);
    gameRef.current?.setHotSeatMode?.(false);
    gameRef.current?.setTestingMode?.(false);
    gameRef.current?.setTwoPlayerMode?.(false);
    gameRef.current?.setCpuVsCpu?.(true);
    gameRef.current?.setPracticeMode?.(false);
    gameRef.current?.splashMusicStop?.();
    gameRef.current?.setMenuVisible?.(false);
    gameRef.current?.setPaused?.(false);
    setIsPausedIfChanged(false);
    setIsFullTime(false);
    setFullTimeScore(null);
    try {
      sessionStorage.removeItem('psl_fullTime');
      sessionStorage.removeItem('psl_fullTimeScore');
    } catch {}

    try {
      const fixtureHalfSeconds = halfLengthMinutes * 60;
      const fixtureSpeedMul = computeWatchedFixtureSpeedMul(fixtureHalfSeconds);
      const result = await runner({
        homeTeam: fixtureTeams.a,
        awayTeam: fixtureTeams.b,
        formationA: assignment.home.formation,
        formationB: assignment.away.formation,
        halfSeconds: fixtureHalfSeconds,
        speedMul: fixtureSpeedMul,
        timeoutMs: computeFixtureTimeoutMs({ halfSeconds: fixtureHalfSeconds, speedMul: fixtureSpeedMul }),
      });

      if (!result) {
        setWatchedFixtureMessage('Fixture run did not start.');
      } else if (result.timedOut) {
        const clock = `${result.phase} ${result.elapsedInHalf?.toFixed?.(1) ?? '0.0'}s`;
        if (result.timeoutReason === 'clock_too_slow' || result.timeoutReason === 'clock_stalled') {
          setWatchedFixtureMessage(`Clock stalled at ${clock}`);
        } else {
          setWatchedFixtureMessage(`Timed out at ${clock}`);
        }
      } else {
        try {
          const watchedSnapshot = gameRef.current?.getMatchSnapshot?.() || null;
          const watchedBundle = gameRef.current?.getTuningBundle?.() || null;
          // Not gated on hasDevServer(): this path only runs from the
          // pslSmokeTest fixture runner, which is dev-harness-only anyway.
          if (watchedSnapshot?.phase === 'FULL_TIME' && watchedBundle) {
            fetch('/__db/match-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(buildMatchResultPayload({
                bundle: watchedBundle,
                snapshot: watchedSnapshot,
                fallbackSessionId: `ft-${Date.now()}`,
              })),
            }).catch(e => console.warn('[PSL] watched fixture SQLite save error:', e));
          }
        } catch (e) {
          console.warn('[PSL] watched fixture SQLite save error:', e);
        }
        setWatchedFixtureMessage(`Final ${result.teamA} ${result.scoreA}-${result.scoreB} ${result.teamB}`);
      }
    } catch (error) {
      setWatchedFixtureMessage(`Fixture failed: ${String(error)}`);
    } finally {
      setWatchedFixtureRunning(false);
    }
  };

  // Keep gamepad menu refs in sync
  handleKickOffRef.current = handleKickOff;
  handleRealDataReplayStartRef.current = handleRealDataReplayStart;
  handlePreMatchSetupStartRef.current = handlePreMatchSetupStart;
  handleTogglePauseRef.current = handleTogglePause;
  handleContinueHalftimeRef.current = handleContinueHalftime;
  setSeasonModeActiveRef.current = setSeasonModeActive;

  useEffect(() => {
    gameRef.current?.setMenuVisible?.(allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock && !showSplash);
  }, [allowMainMenu, hasActiveMatchSession, isFullTime, sessionMenuLock, showSplash]);

  useEffect(() => {
    if (!gameRef.current) return;

    const nextTeamAName = teamAName;
    const nextTeamBName = teamBName;
    const resolvedKits = getResolvedMatchKits(nextTeamAName, nextTeamBName, teamAKit, teamBKit);
    const kitA = resolvedKits.home;
    const kitB = resolvedKits.away;

    if (showSplash) {
      gameRef.current?.setTeamNames?.(nextTeamAName, nextTeamBName);
      gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[nextTeamAName] ?? '', MLS_TEAM_LOGOS[nextTeamBName] ?? '');
      gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
      gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
      gameRef.current?.setTeamFormations?.(teamAFormation, teamBFormation);
      gameRef.current?.setHotSeatMode?.(false);
      gameRef.current?.setTestingMode?.(false);
      gameRef.current?.setTwoPlayerMode?.(false);
      gameRef.current?.setCpuVsCpu?.(true);
      gameRef.current?.setSplashSceneMode?.(true);
      gameRef.current?.setScoreBugVisible?.(false);
      gameRef.current?.setMenuVisible?.(false);

      if (!splashSceneStartedRef.current) {
        // Prevent ghost CPU-vs-CPU restarts from HMR remounts or duplicate tabs.
        // Guards:
        //  1. Match already active / at FULL_TIME → don't auto-start.
        //  2. sessionStorage flag for prior full-time: if user hit full-time on a
        //     manual match recently, splash overlay could be stale. HMR remount
        //     resets showSplash to true but we must not kick off a demo behind it.
        //  3. Session-scoped recent-auto-start flag (5 min cooldown).
        const snapshot = gameRef.current?.getMatchSnapshot?.() || null;
        const alreadyActive = snapshot?.phase === 'FIRST_HALF'
          || snapshot?.phase === 'HALFTIME'
          || snapshot?.phase === 'SECOND_HALF';
        const atFullTime = snapshot?.phase === 'FULL_TIME';
        let recentSplashRan = false;
        let priorFullTime = false;
        try {
          const last = Number(sessionStorage.getItem('psl_splashAutoStartAt') || 0);
          recentSplashRan = last > 0 && (Date.now() - last) < 5 * 60 * 1000;
          priorFullTime = sessionStorage.getItem('psl_fullTime') === '1';
        } catch {}
        // Splash auto-demo permanently disabled: the background CPU-vs-CPU
        // match was the source of "ghost" Miami-LA rows in the DB and made
        // the splash visually noisy. Splash is now a static screen — no
        // match runs behind it. Mark started so guards downstream still
        // know we visited this branch.
        void alreadyActive; void atFullTime; void recentSplashRan; void priorFullTime;
        splashSceneStartedRef.current = true;
      }
      return;
    }

    splashSceneStartedRef.current = false;
    gameRef.current?.setSplashSceneMode?.(false);
    if (allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock) {
      gameRef.current?.setCpuVsCpu?.(false);
      gameRef.current?.setScoreBugVisible?.(false);
      gameRef.current?.setMenuVisible?.(true);
    }
  }, [
    allowMainMenu,
    hasActiveMatchSession,
    isFullTime,
    sessionMenuLock,
    showSplash,
    teamAFormation,
    teamAName,
    teamAKit,
    teamBFormation,
    teamBName,
    teamBKit,
  ]);

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
          <div>SPD: {Number(p.stats?.speed ?? 0).toFixed(2)}</div>
          <div>STR: {Number(p.stats?.strength ?? 0).toFixed(2)}</div>
          <div>CAT: {Number(p.stats?.catching ?? 0).toFixed(2)}</div>
          <div>TAK: {Number(p.stats?.tackle ?? 0).toFixed(2)}</div>
        </div>
        <div className="border-t border-white/10 pt-2 text-[10px]">
          <div className="text-white/50 uppercase tracking-wide mb-1">Team Modifier</div>
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
    const refresh = () => {
      getTelemetryCounts().then(setTelemCounts).catch(() => {});
      getDiskMirrorStatus().then(setDiskMirrorStatus).catch(() => {});
    };
    refresh();
    const id = window.setInterval(refresh, 10000);
    return () => window.clearInterval(id);
  }, [showTelemetry]);

  const handleRecoverLatestMirror = async () => {
    setDiskRecovering(true);
    setDiskMirrorMessage('Recovering latest mirrored session...');
    try {
      const recovered = await recoverLatestMirroredSession();
      if (!recovered?.ok || !recovered.sessionId) {
        setDiskMirrorMessage('No mirrored session available yet.');
        return;
      }
      const timestamp = recovered.latestBatch?.timestamp || (recovered.latestSnapshot?.timestamp as number | undefined) || null;
      const timeLabel = timestamp ? new Date(timestamp).toLocaleTimeString() : 'unknown time';
      const phase = (recovered.latestBatch?.matchSnapshot?.phase as string | undefined)
        || (recovered.latestSnapshot?.match as { phase?: string } | undefined)?.phase
        || (recovered.latestSummary?.phase as string | undefined)
        || 'unknown phase';
      const sampleNames = recovered.latestBatch?.samplePlayerNames?.slice(0, 3).join(', ');
      setDiskMirrorMessage(
        `Recovered ${recovered.sessionId.slice(0, 10)}… from disk at ${timeLabel} (${phase}). ${recovered.batchCount} batches, ${recovered.snapshotCount} snapshots${sampleNames ? `, sample players: ${sampleNames}.` : '.'}`
      );
      getDiskMirrorStatus().then(setDiskMirrorStatus).catch(() => {});
    } catch (error) {
      setDiskMirrorMessage(`Mirror recovery failed: ${String(error)}`);
    } finally {
      setDiskRecovering(false);
    }
  };

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

  const toSparklinePath = (samples: Array<{ x: number; z: number }>) => {
    if (samples.length < 2) return '';
    const width = 66;
    const height = 20;
    const pitchXMin = -34;
    const pitchXMax = 34;
    const pitchZMin = -22;
    const pitchZMax = 22;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const toX = (x: number) => ((clamp(x, pitchXMin, pitchXMax) - pitchXMin) / (pitchXMax - pitchXMin)) * width;
    const toY = (z: number) => (1 - (clamp(z, pitchZMin, pitchZMax) - pitchZMin) / (pitchZMax - pitchZMin)) * height;

    return samples
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${toX(point.x).toFixed(1)} ${toY(point.z).toFixed(1)}`)
      .join(' ');
  };

  const runMovementScan = async (forcedAnchor?: 'pause' | 'full_time' | 'latest', forcedSeconds?: 10 | 20) => {
    if (movementLoading) return;
    setMovementLoading(true);
    setMovementMessage('Scanning movement data...');
    try {
      let anchorUsed: 'pause' | 'full_time' | 'latest' = forcedAnchor || movementAnchor;
      const secondsUsed: 10 | 20 = forcedSeconds || movementWindowSeconds;
      let sequence = await getPositionSequence({
        seconds: secondsUsed,
        anchor: anchorUsed,
      });

      if (!sequence && anchorUsed !== 'latest') {
        anchorUsed = 'latest';
        sequence = await getPositionSequence({
          seconds: secondsUsed,
          anchor: anchorUsed,
        });
      }

      if (!sequence || sequence.frames.length < 2) {
        setMovementTopRows([]);
        setMovementTrailPaths({});
        setMovementFrames(0);
        setMovementSessionId(null);
        setMovementLastAnchorUsed(null);
        setMovementMessage('Not enough position frames to analyze yet.');
        return;
      }

      const tracks = new Map<string, {
        name: string;
        team?: 'A' | 'B';
        role?: string;
        points: Array<{ t: number; x: number; y: number; z: number }>;
      }>();
      for (const frame of sequence.frames) {
        for (const player of frame.players) {
          const name = player.name || 'Unknown';
          const key = `${player.team || '?'}::${name}`;
          const item = tracks.get(key) || {
            name,
            team: player.team,
            role: player.role,
            points: [],
          };
          item.points.push({ t: frame.timestamp, x: player.x, y: player.y, z: player.z });
          tracks.set(key, item);
        }
      }

      const allRows: Array<{
        name: string;
        team?: 'A' | 'B';
        role?: string;
        distanceMeters: number;
        avgSpeedMps: number;
        maxStepMps: number;
      }> = [];

      for (const item of tracks.values()) {
        if (item.points.length < 2) continue;
        item.points.sort((a, b) => a.t - b.t);
        let distanceMeters = 0;
        let maxStepMps = 0;
        for (let i = 1; i < item.points.length; i++) {
          const prev = item.points[i - 1];
          const curr = item.points[i];
          const dt = Math.max(0.001, (curr.t - prev.t) / 1000);
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const dz = curr.z - prev.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const mps = dist / dt;
          distanceMeters += dist;
          if (mps > maxStepMps) maxStepMps = mps;
        }
        const totalSeconds = Math.max(0.001, (item.points[item.points.length - 1].t - item.points[0].t) / 1000);
        allRows.push({
          name: item.name,
          team: item.team,
          role: item.role,
          distanceMeters,
          avgSpeedMps: distanceMeters / totalSeconds,
          maxStepMps,
        });
      }

      allRows.sort((a, b) => b.distanceMeters - a.distanceMeters);
      if (allRows.length === 0) {
        setMovementTopRows([]);
        setMovementTrailPaths({});
        setMovementFrames(0);
        setMovementSessionId(null);
        setMovementLastAnchorUsed(null);
        setMovementMessage('No movement tracks available in the selected window.');
        return;
      }

      setMovementFrames(sequence.frameCount);
      setMovementSessionId(sequence.sessionId);
      setMovementLastAnchorUsed(anchorUsed);
      setMovementLastRunAt(Date.now());
      const topRows = allRows.slice(0, 6);
      setMovementTopRows(topRows);

      const nextTrailPaths: Record<string, string> = {};
      for (const row of topRows) {
        const key = `${row.team || '?'}::${row.name}`;
        const samples = tracks.get(key)?.points.map((p) => ({ x: p.x, z: p.z })) || [];
        nextTrailPaths[key] = toSparklinePath(samples);
      }
      setMovementTrailPaths(nextTrailPaths);
      const fallbackLabel = anchorUsed === movementAnchor ? '' : ` (fallback: ${anchorUsed})`;
      setMovementMessage(`Analyzed ${allRows.length} players across ${sequence.frameCount} frames (${secondsUsed}s)${fallbackLabel}.`);
    } catch (error) {
      setMovementMessage(`Movement analysis failed: ${String(error)}`);
    } finally {
      setMovementLoading(false);
    }
  };

  runMovementScanRef.current = runMovementScan;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-mono">
      <div ref={containerRef} className="w-full h-full" />

      {showScoreboard && (() => {
        const colorA = getTeamColor(scoreboardTeamA);
        const colorB = getTeamColor(scoreboardTeamB);
        const phase = scoreboardPhaseLabel(matchSnapshot);
        const oldPhaseLabel = phase === '1H' ? '1ST HALF' : phase === '2H' ? '2ND HALF' : phase;
        return (
          <div className="absolute top-5 left-1/2 z-[120] w-[min(92vw,720px)] -translate-x-1/2 pointer-events-none">
            <div
              data-psl-scoreboard="live"
              className="relative h-[68px] w-full min-w-0 sm:min-w-[560px] overflow-hidden rounded-md border border-white/10 bg-white shadow-[0_6px_28px_rgba(0,0,0,0.65)] flex items-stretch font-sans text-black"
            >
              <div
                className="absolute left-0 top-0 z-[2] h-[3px] w-full"
                style={{ background: `linear-gradient(90deg, ${colorA} 0 50%, ${colorB} 50% 100%)` }}
              />
              <div className="flex-1 min-w-0 flex items-center justify-end gap-2 sm:gap-3 px-2 sm:px-5">
                <div className="min-w-0 text-right">
                  <div className="text-[9px] sm:text-[10px] leading-none uppercase tracking-[0.12em] text-black/55">Home</div>
                  <div className="hidden sm:block truncate text-[15px] font-extrabold uppercase leading-tight text-black">{scoreboardTeamA}</div>
                  <div className="sm:hidden text-[13px] font-extrabold uppercase leading-tight text-black">{shortTeamName(scoreboardTeamA)}</div>
                </div>
                <ScoreboardFlag teamName={scoreboardTeamA} />
                <div className="min-w-[28px] text-center text-[32px] sm:text-[34px] leading-none font-black tabular-nums text-black">
                  {matchSnapshot?.scoreA ?? 0}
                </div>
              </div>
              <div className="w-[108px] sm:w-32 shrink-0 flex flex-col items-center justify-center gap-[3px] border-x border-black/10 bg-white px-2">
                <div className="text-[24px] sm:text-[26px] leading-none font-bold tabular-nums tracking-[0.04em] text-black" style={{ fontFamily: 'var(--font-score-clock)' }}>
                  {formatScoreboardClock(matchSnapshot)}
                </div>
                <div className="text-[9px] sm:text-[10px] leading-none font-semibold uppercase tracking-[0.12em] text-black/70">
                  {oldPhaseLabel}
                </div>
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-start gap-2 sm:gap-3 px-2 sm:px-5">
                <div className="min-w-[28px] text-center text-[32px] sm:text-[34px] leading-none font-black tabular-nums text-black">
                  {matchSnapshot?.scoreB ?? 0}
                </div>
                <ScoreboardFlag teamName={scoreboardTeamB} />
                <div className="min-w-0 text-left">
                  <div className="text-[9px] sm:text-[10px] leading-none uppercase tracking-[0.12em] text-black/55">Away</div>
                  <div className="hidden sm:block truncate text-[15px] font-extrabold uppercase leading-tight text-black">{scoreboardTeamB}</div>
                  <div className="sm:hidden text-[13px] font-extrabold uppercase leading-tight text-black">{shortTeamName(scoreboardTeamB)}</div>
                </div>
              </div>
            </div>
            {hasActiveMatchSession && matchSnapshot?.phase !== 'FULL_TIME' && matchSnapshot?.phase !== 'HALFTIME' && (
              <button
                type="button"
                data-psl-pause-button="match"
                onClick={handleTogglePause}
                className="pointer-events-auto absolute right-0 top-[76px] inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-black/80 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_4px_18px_rgba(0,0,0,0.45)] hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-pressed={isPaused}
              >
                {isPaused ? <Play size={15} strokeWidth={2.5} /> : <Pause size={15} strokeWidth={2.5} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
          </div>
        );
      })()}

      {matchSnapshot?.manualRestartPrompt && !showSplash && !isOptionsOpen && !isPaused && (
        <div
          data-psl-restart-prompt="true"
          className="pointer-events-none absolute inset-x-0 bottom-24 z-[120] flex justify-center px-4"
        >
          <div className="rounded-lg border border-amber-300/50 bg-black/85 px-5 py-3 text-center shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
              Your {matchSnapshot.manualRestartPrompt.label}
            </div>
            {matchSnapshot.restartPlanOptions && (
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {matchSnapshot.restartPlanOptions.routines.map((routine: any) => {
                  const active = matchSnapshot.restartPlanOptions.chosen
                    && matchSnapshot.restartPlanOptions.selected === routine.plan;
                  return (
                    <div
                      key={routine.plan}
                      className={`rounded border px-2 py-1 text-left ${
                        active ? 'border-amber-300 bg-amber-300/15' : 'border-white/15'
                      }`}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[10px] text-amber-300">
                          {routine.key}{' '}/{' '}{DIRECTION_GLYPH[routine.direction]}
                        </span>
                        <span className="text-[10px] font-bold text-white">{routine.label}</span>
                      </div>
                      <div className="text-[9px] leading-tight text-white/45">{routine.hint}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-1 text-[11px] text-white/80">
              Press <span className="font-bold text-white">SPACE</span> to play it
              {' '}&middot;{' '}auto in {Math.ceil(matchSnapshot.manualRestartPrompt.secondsRemaining)}s
            </div>
          </div>
        </div>
      )}

      {isPaused && hasActiveMatchSession && !showSplash && !isOptionsOpen && (
        <React.Suspense fallback={null}>
          <PauseOverlay onResume={handleTogglePause} onQuitToMenu={handleQuitToMainMenu} />
        </React.Suspense>
      )}

      {showHalftimeOverlay && (() => {
        const firstHalfGoals = (matchSnapshot.goalLog || []).filter((goal: any) => Number(goal?.matchMinute || 0) <= 45);
        return (
          <div
            data-psl-halftime-overlay="true"
            className="absolute inset-0 z-[150] flex items-center justify-center bg-black/45 px-4"
            onClick={() => gameMode !== 'cpu' && handleContinueHalftime('manual')}
          >
            <div className="w-[min(92vw,520px)] rounded-md border-[5px] border-black bg-white px-8 py-7 text-center font-mono text-slate-950 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
              <div className="text-[42px] leading-none font-black uppercase tracking-[0.16em] text-amber-400">Half Time</div>
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="min-w-0 text-right">
                  <div className="truncate text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500">{scoreboardTeamA}</div>
                  <div className="text-[52px] leading-none font-black tabular-nums">{matchSnapshot.scoreA ?? 0}</div>
                </div>
                <div className="text-[30px] font-black text-slate-300">-</div>
                <div className="min-w-0 text-left">
                  <div className="truncate text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500">{scoreboardTeamB}</div>
                  <div className="text-[52px] leading-none font-black tabular-nums">{matchSnapshot.scoreB ?? 0}</div>
                </div>
              </div>
              <div className="my-5 h-px bg-slate-200" />
              <div className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Goal Scorers</div>
              <div className="mt-3 min-h-[44px] space-y-1 text-[13px] font-bold text-slate-700">
                {firstHalfGoals.length > 0 ? firstHalfGoals.map((goal: any, index: number) => (
                  <div key={`${goal.playerName || goal.scorer || index}-${index}`}>
                    {goal.matchMinute}' {goal.playerName || goal.scorer || 'Goal'} <span className="text-slate-400">({goal.team === 'A' ? scoreboardTeamA : scoreboardTeamB})</span>
                  </div>
                )) : (
                  <div className="text-slate-400">No goals</div>
                )}
              </div>
              <button
                type="button"
                className="mt-6 w-full rounded border border-slate-300 bg-white px-4 py-3 text-[13px] font-black uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
                onClick={(event) => {
                  event.stopPropagation();
                  if (gameMode !== 'cpu') handleContinueHalftime('manual');
                }}
              >
                {gameMode === 'cpu' ? 'Second half starting...' : 'Press any key to continue'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Splash Screen ── */}
      {showSplash && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center cursor-pointer"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.75) 100%)' }}
        >
          <div className="flex flex-col items-center gap-6 px-8 py-10 relative"
            style={{ animation: 'splashRiseBounce 0.9s ease-out forwards' }}
          >
            {/* Logo */}
            <div style={{ animation: 'splashFadeIn 0.6s ease-out 0.5s both' }}>
              <img
                src="/assets/Pixel%20Soccer%20League2.png"
                alt="Pixel Soccer League"
                className="w-[40rem] max-w-[92vw] drop-shadow-[0_4px_14px_rgba(34,197,94,0.14)]"
              />
            </div>

            {/* Title */}
            <h1
              className="text-[22px] uppercase tracking-[0.3em] text-green-300/80 text-center"
              style={{ animation: 'splashFadeIn 0.5s ease-out 0.7s both' }}
            >
              Pixel Soccer League
            </h1>

            {/* Subtitle — shimmer gradient text */}
            <p
              className="text-[18px] uppercase tracking-[0.25em] text-center mt-2"
              style={{
                animation: 'splashFadeIn 0.5s ease-out 0.9s both, splashPulse 2s ease-in-out 1.4s infinite',
                background: 'linear-gradient(90deg, #4ade80, #facc15, #4ade80)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {splashAudioStarted ? 'Loading match menu...' : 'Press any button to start'}
            </p>

            {/* Hint */}
            <p
              className="text-[14px] text-white/20 uppercase tracking-widest mt-1"
              style={{ animation: 'splashFadeIn 0.4s ease-out 1.2s both' }}
            >
              Gamepad · Keyboard · Mouse
            </p>
          </div>
        </div>
      )}
      {/* Mode Select Screen */}
      {!showSplash && allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock && !showPracticeSetup && !showPreMatchSetup && (
        <div className="absolute inset-0 z-50 overflow-y-auto overflow-x-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(34,197,94,0.05),rgba(34,197,94,0.02)_18%,transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.72)_82%)]" />
          <div className="relative z-[2] flex min-h-full w-full items-center justify-center px-5 py-5">
            <div data-psl-main-menu="world-cup" className="flex w-full max-w-[760px] flex-col items-center gap-3">
              <img
                src="/assets/Pixel%20Soccer%20League2.png"
                alt="Pixel Soccer League"
                className="w-[36rem] max-w-[78vw] max-h-[18vh] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)]"
              />

              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                <MenuTeamSelect
                  label="Home"
                  value={teamAName}
                  focused={menuFocusIndex === 0}
                  options={teamOptions}
                  onChange={setTeamAName}
                />
                <MenuTeamSelect
                  label="Away"
                  value={teamBName}
                  focused={menuFocusIndex === 1}
                  options={teamOptions}
                  onChange={setTeamBName}
                />
              </div>

              {easterEggUnlocked && (
                <div className="rounded border border-amber-300/60 bg-amber-500/15 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.18)]">
                  1982 Final Unlocked
                </div>
              )}

              <div className="mt-2 text-center text-[16px] font-black uppercase leading-none text-white" style={{ textShadow: '0 3px 0 rgba(0,0,0,0.85)' }}>
                Select Mode
              </div>
              {!gameReady && (
                <div className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-lime-200/70">
                  Loading game engine...
                </div>
              )}
              <div className="flex w-full flex-col gap-3">
                <MenuModeButton focused={menuFocusIndex === 2} tone={INTERACTIVE_PLAYER_MODES_ENABLED ? 'white' : 'muted'} disabled={!INTERACTIVE_PLAYER_MODES_ENABLED} onClick={() => handleKickOff('1p')}>
                  1 Player vs CPU
                </MenuModeButton>
                <MenuModeButton focused={menuFocusIndex === 3} tone={INTERACTIVE_PLAYER_MODES_ENABLED ? 'white' : 'muted'} disabled={!INTERACTIVE_PLAYER_MODES_ENABLED} onClick={() => handleKickOff('2p')}>
                  2 Players - Hot Seat
                </MenuModeButton>
                <MenuModeButton
                  focused={menuFocusIndex === 4}
                  onClick={() => setShowPreMatchSetup(true)}
                >
                  CPU vs CPU
                </MenuModeButton>
                <MenuModeButton focused={menuFocusIndex === 5} tone="amber" onClick={() => setSeasonModeActive(true)}>
                  World Cup Mode
                </MenuModeButton>
                <MenuModeButton focused={menuFocusIndex === 6} tone="green" onClick={() => setShowPracticeSetup(true)}>
                  Practice
                </MenuModeButton>
              </div>

              <p className="mt-2 text-center text-[11px] font-black uppercase leading-none text-lime-300/70" style={{ textShadow: '0 3px 0 rgba(0,0,0,0.9)' }}>
                Press [ESC] in-game for options
              </p>
            </div>
          </div>
        </div>

      )}

      {/* World Cup Hub Overlay */}
      {seasonModeActive && !hasActiveMatchSession && !isFullTime && (
        <WorldCupHub
          onPlayMatch={(home, away) => {
            gameRef.current?.unlockGameplayAudio?.();
            // Set up teams for the World Cup match
            setTeamAName(home);
            setTeamBName(away);
            seasonReturnRef.current = true;
            // Brief timeout to let team name state propagate before kickoff
            setTimeout(() => {
              const resolvedKits = getResolvedMatchKits(home, away, teamAKit, teamBKit);
              const kitA = resolvedKits.home;
              const kitB = resolvedKits.away;
              gameRef.current?.setTeamNames?.(home, away);
              gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[home] ?? '', MLS_TEAM_LOGOS[away] ?? '');
              gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
              gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
              activeMatchTeamsRef.current = { a: home, b: away };
              fullTimeCapturedRef.current = false;
              setGameMode('1p');
              setHasActiveMatchSession(true);
              setAllowMainMenu(false);
              setSessionMenuLock(true);
              gameRef.current?.setHotSeatMode?.(false);
              gameRef.current?.setTestingMode?.(false);
              gameRef.current?.setTwoPlayerMode?.(false);
              gameRef.current?.setCpuVsCpu?.(false);
              gameRef.current?.splashMusicStop?.();
              gameRef.current?.setSplashSceneMode?.(false);
              gameRef.current?.setMenuVisible?.(false);
              gameRef.current?.startKickoffPresentation?.(true);
              setIsFullTime(false);
              setFullTimeScore(null);
            }, 50);
          }}
          onExit={() => {
            setSeasonModeActive(false);
            seasonReturnRef.current = false;
          }}
          lastMatchResult={seasonMatchResult}
          clearLastMatchResult={() => setSeasonMatchResult(null)}
        />
      )}

      {/* Practice Setup Overlay */}
      {showPracticeSetup && !hasActiveMatchSession && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/80">
          <div className="bg-zinc-900 border border-emerald-500/40 rounded-xl p-6 w-80 flex flex-col gap-5 text-white">
            <div className="text-center">
              <p className="text-emerald-400 text-[9px] uppercase tracking-widest mb-1">Practice Mode</p>
              <p className="text-white text-sm font-semibold">Set Up Session</p>
            </div>

            {/* Team selector */}
            <div className="flex flex-col gap-1">
              <label htmlFor="practice-setup-team-select" className="text-white/40 text-[9px] uppercase tracking-widest">Team</label>
              <select
                id="practice-setup-team-select"
                value={teamAName}
                onChange={(e) => setTeamAName(e.target.value)}
                className={`${PRACTICE_SELECT_CLASSNAME} text-xs px-2 py-2 border-white/20`}
              >
                {teamOptions.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>

            {/* Human / CPU toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-white/40 text-[9px] uppercase tracking-widest">Controlled By</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPracticeIsHuman(true)}
                  className={`flex-1 py-2 border text-xs rounded transition-colors ${practiceIsHuman ? 'bg-emerald-500/40 border-emerald-400 text-emerald-200' : 'border-white/20 text-white/50 hover:bg-white/10'}`}
                >
                  Human
                </button>
                <button
                  type="button"
                  onClick={() => setPracticeIsHuman(false)}
                  className={`flex-1 py-2 border text-xs rounded transition-colors ${!practiceIsHuman ? 'bg-emerald-500/40 border-emerald-400 text-emerald-200' : 'border-white/20 text-white/50 hover:bg-white/10'}`}
                >
                  CPU
                </button>
              </div>
            </div>

            {/* Begin / Cancel */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPracticeSetup(false)}
                className="flex-1 py-2 border border-white/20 text-white/50 text-xs rounded hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const isHumanPractice = practiceIsHuman;
                  setSelectedPracticePlay(null);
                  setPracticeActive(false);
                  setPracticeFormation('4-4-2'); // default practice start formation
                  setShowPracticeSetup(false);
                  handleKickOff('practice');
                  gameRef.current?.setCpuVsCpu?.(!isHumanPractice);
                  if (practiceStartPauseRef.current) clearTimeout(practiceStartPauseRef.current);
                  if (isHumanPractice) {
                    practiceStartPauseRef.current = setTimeout(() => {
                      gameRef.current?.setPaused?.(true);
                    }, 0);
                  }
                  // Do not automatically apply a play at startup (per user request).
                  // The practice should start in a standard kickoff formation at the center circle.
                  // play is only active once selected from the in-game play selector
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white text-xs font-semibold rounded transition-colors"
              >
                Begin Practice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Practice play-complete flash badge */}
      {showPracticeComplete && gameMode === 'practice' && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-8 py-3 bg-emerald-500 text-white text-sm font-bold rounded-full tracking-[0.2em] uppercase shadow-2xl border border-emerald-300/60 animate-pulse">
            Play Set
          </div>
        </div>
      )}

      {/* In-game Practice Panel */}
      {gameMode === 'practice' && hasActiveMatchSession && (() => {
        const currentPlay = PRACTICE_PLAYS.find(p => p.key === selectedPracticePlay);
        const categoryGroups = PRACTICE_PLAYS.reduce<Record<string, typeof PRACTICE_PLAYS>>((acc, play) => {
          if (!acc[play.category]) acc[play.category] = [];
          acc[play.category].push(play);
          return acc;
        }, {});
        return (
          <div className="absolute top-2 right-[calc(0.5rem+150px)] z-30 bg-black/70 border border-emerald-500/40 rounded-lg p-3 flex flex-col gap-2 w-52 text-white">
            <div className="flex justify-between items-center">
              <p className="text-emerald-400 text-[9px] uppercase tracking-widest">Practice</p>
              {practiceActive && (
                <span className="text-[8px] bg-red-500/80 px-1 rounded animate-pulse">ACTIVE</span>
              )}
            </div>

            {/* Play selector */}
            <div className="flex flex-col gap-0.5">
              <label htmlFor="practice-play-select" className="text-white/40 text-[8px] uppercase tracking-widest">Play</label>
              <select
                id="practice-play-select"
                value={selectedPracticePlay ?? 'none'}
                onChange={(e) => {
                  const key = e.target.value;
                  if (key === 'none') {
                    setSelectedPracticePlay(null);
                    setPracticeActive(false);
                    gameRef.current?.deactivatePracticePlay?.();
                    gameRef.current?.drawPracticeRoutes?.([]); // Clear routes
                    return;
                  }
                  const play = PRACTICE_PLAYS.find(p => p.key === key)!;
                  const shouldAutoStart = !practiceIsHuman;
                  setSelectedPracticePlay(key);
                  setPracticeActive(shouldAutoStart);
                  setPracticeFormation(play.formation);
                  if (practiceStartPauseRef.current) clearTimeout(practiceStartPauseRef.current);
                  if (practiceIsHuman) gameRef.current?.setPaused?.(true);
                  // Snap players + ball to starting positions, redraw routes from snapped positions, and auto-start only for CPU practice
                  gameRef.current?.resetAndStartPracticePlay?.(() => {
                    applyPracticePlay(gameRef, play, play.formation, practiceAggressiveness, shouldAutoStart);
                  });
                }}
                className={PRACTICE_SELECT_CLASSNAME}
              >
                <option value="none" className="text-white/50 italic">None Selected</option>
                {Object.entries(categoryGroups).map(([cat, plays]) => (
                  <optgroup key={cat} label={cat}>
                    {plays.map(play => (
                      <option key={play.key} value={play.key}>{play.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-white/30 text-[8px] italic leading-tight mt-0.5">
                {currentPlay ? currentPlay.description : "Select a play to begin routing"}
              </p>
            </div>

            {/* Formation selector */}
            <div className="flex flex-col gap-0.5">
              <label htmlFor="practice-formation-select" className="text-white/40 text-[8px] uppercase tracking-widest">Formation</label>
              <select
                id="practice-formation-select"
                value={practiceFormation}
                onChange={(e) => {
                  const f = e.target.value;
                  setPracticeFormation(f);
                  if (currentPlay) {
                    const shouldAutoStart = !practiceIsHuman;
                    setPracticeActive(shouldAutoStart);
                    if (practiceStartPauseRef.current) clearTimeout(practiceStartPauseRef.current);
                    if (practiceIsHuman) gameRef.current?.setPaused?.(true);
                    gameRef.current?.resetAndStartPracticePlay?.(() => {
                      applyPracticePlay(gameRef, currentPlay, f, practiceAggressiveness, shouldAutoStart);
                    });
                  } else {
                    gameRef.current?.setTeamFormations?.(f, f);
                  }
                }}
                className={PRACTICE_SELECT_CLASSNAME}
              >
                {['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Aggressiveness selector */}
            <div className="flex flex-col gap-0.5">
              <label htmlFor="practice-aggressiveness-select" className="text-white/40 text-[8px] uppercase tracking-widest">Aggressiveness</label>
              <select
                id="practice-aggressiveness-select"
                value={practiceAggressiveness}
                onChange={(e) => {
                  const key = e.target.value as AggressivenessKey;
                  setPracticeAggressiveness(key);
                  const agg = PRACTICE_AGGRESSIVENESS[key] as any;
                  gameRef.current?.setCPUShotTuning?.(agg.aimErrorRad, agg.pressureError);
                }}
                className={PRACTICE_SELECT_CLASSNAME}
              >
                {(Object.keys(PRACTICE_AGGRESSIVENESS) as AggressivenessKey[]).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
            </div>
            {practiceIsHuman && selectedPracticePlay && !practiceActive && (
              <button
                type="button"
                onClick={() => {
                  const currentPlay = PRACTICE_PLAYS.find(p => p.key === selectedPracticePlay);
                  if (!currentPlay) return;
                  if (practiceStartPauseRef.current) clearTimeout(practiceStartPauseRef.current);
                  setPracticeActive(true);
                  gameRef.current?.setPaused?.(false);
                  gameRef.current?.resetAndStartPracticePlay?.(() => {
                    applyPracticePlay(gameRef, currentPlay, practiceFormation, practiceAggressiveness, true);
                  });
                }}
                className="mt-1 py-2 border border-emerald-400/60 text-emerald-100 bg-emerald-500/20 text-xs rounded hover:bg-emerald-500/30 transition-colors"
              >
                Start Play
              </button>
            )}
          </div>
        );
      })()}

      {/* Full Time / Game Over Overlay */}
      {isFullTime && fullTimeScore && (() => {
        // Ensure team colors have enough contrast against white background
        const ensureContrast = (hex: string | undefined, fallback: string): string => {
          const c = hex || fallback;
          const num = parseInt(c.replace('#', ''), 16);
          const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
          // Relative luminance (sRGB)
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          if (lum > 0.65) {
            // Too light — darken by 40%
            const dr = Math.round(r * 0.6), dg = Math.round(g * 0.6), db = Math.round(b * 0.6);
            return `#${((dr << 16) | (dg << 8) | db).toString(16).padStart(6, '0')}`;
          }
          return c;
        };
        const safeColorA = ensureContrast(fullTimeScore.colorA, '#38bdf8');
        const safeColorB = ensureContrast(fullTimeScore.colorB, '#fb7185');
        // Bar colors: use originals but add outline for visibility
        const barColorA = fullTimeScore.colorA || '#38bdf8';
        const barColorB = fullTimeScore.colorB || '#fb7185';
        const resultLabel = fullTimeScore.scoreA > fullTimeScore.scoreB
          ? `${fullTimeScore.teamA} Wins`
          : fullTimeScore.scoreB > fullTimeScore.scoreA
            ? `${fullTimeScore.teamB} Wins`
            : 'Draw';
        return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/55 px-3 py-5 backdrop-blur-sm">
          <div
            className="flex w-[min(96vw,760px)] max-h-[calc(100vh-32px)] flex-col overflow-y-auto bg-white px-8 py-7 shadow-2xl rounded-xl"
            style={{ outline: '5px solid #000' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-time-title"
          >
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <div id="full-time-title" className="text-amber-500 text-3xl font-extrabold tracking-widest uppercase">Full Time</div>
                <div className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">{resultLabel}</div>
              </div>
              <div className="rounded border border-gray-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Final</div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-3">
                  <ScoreboardFlag teamName={fullTimeScore.teamA} />
                  <span className="min-w-0 break-words text-[12px] font-black uppercase leading-tight tracking-[0.12em] text-gray-500">{fullTimeScore.teamA}</span>
                </div>
                <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: barColorA }} />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-950 text-6xl font-black leading-none tabular-nums">{fullTimeScore.scoreA}</span>
                <span className="text-gray-300 text-3xl font-light">{'-'}</span>
                <span className="text-gray-950 text-6xl font-black leading-none tabular-nums">{fullTimeScore.scoreB}</span>
              </div>
              <div className="min-w-0 text-right">
                <div className="mb-2 flex items-center justify-end gap-3">
                  <span className="min-w-0 break-words text-[12px] font-black uppercase leading-tight tracking-[0.12em] text-gray-500">{fullTimeScore.teamB}</span>
                  <ScoreboardFlag teamName={fullTimeScore.teamB} />
                </div>
                <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: barColorB }} />
              </div>
            </div>
            {(fullTimeScore.shotsA != null || fullTimeScore.shotsB != null) && (
              <div className="mt-6 w-full border-t border-gray-200 pt-4 flex flex-col gap-2">
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest text-center mb-1">Match Stats</div>
                {[
                  ['Shots', fullTimeScore.shotsA, fullTimeScore.shotsB],
                  ['On Target', fullTimeScore.sogA, fullTimeScore.sogB],
                  ['Saves', fullTimeScore.savesA, fullTimeScore.savesB],
                  ['Headers', fullTimeScore.headersA, fullTimeScore.headersB],
                ] .filter(([, a, b]) => a != null || b != null)
                  .map(([label, valA, valB]) => {
                    const a = Number(valA) || 0;
                    const b = Number(valB) || 0;
                    const total = a + b || 1;
                    return (
                      <div key={String(label)} className="grid grid-cols-[2.5rem_1fr_5.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                        <span className="text-gray-800 text-right font-black tabular-nums">{a}</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                          <div className="ml-auto h-full rounded-full" style={{ width: `${(a / total) * 100}%`, backgroundColor: barColorA }} />
                        </div>
                        <span className="text-center text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full" style={{ width: `${(b / total) * 100}%`, backgroundColor: barColorB }} />
                        </div>
                        <span className="text-gray-800 font-black tabular-nums">{b}</span>
                      </div>
                    );
                  })}
              </div>
            )}
            {fullTimeScore.goals && fullTimeScore.goals.length > 0 && (
              <div className="mt-5 w-full border-t border-gray-200 pt-4">
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest text-center mb-3">Goal Scorers</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {fullTimeScore.goals.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px]">
                    <span className="text-gray-400 w-8 text-right font-black tabular-nums">{g.matchMinute}{"'"}</span>
                    <span className="truncate font-black" style={{ color: g.team === 'A' ? safeColorA : safeColorB }}>
                      {g.shirtNumber > 0 ? `#${g.shirtNumber} ` : ''}{g.playerName}
                    </span>
                  </div>
                ))}
                </div>
              </div>
            )}
            <button
              onPointerDown={() => {
                fullTimeReturnArmedRef.current = true;
              }}
              onClick={(e) => {
                const armedByPointer = fullTimeReturnArmedRef.current;
                fullTimeReturnArmedRef.current = false;
                // Ignore keyboard/programmatic activation; require explicit pointer click.
                if (!e.isTrusted || !armedByPointer) return;

                if (seasonModeActive && seasonReturnRef.current && fullTimeScore) {
                  // Season mode: save result and return to season hub
                  setSeasonMatchResult({ scoreA: fullTimeScore.scoreA, scoreB: fullTimeScore.scoreB });
                  seasonReturnRef.current = false;
                }

                setIsFullTime(false);
                setFullTimeScore(null);
                fullTimeCapturedRef.current = false;
                activeMatchTeamsRef.current = null;
                try { sessionStorage.removeItem('psl_fullTime'); sessionStorage.removeItem('psl_fullTimeScore'); } catch {}
                setAllowMainMenu(!seasonModeActive);
                setSessionMenuLock(false);
                gameRef.current?.resetMatch?.();
                setGameMode(null);
                setHasActiveMatchSession(false);
                if (!seasonModeActive) {
                  gameRef.current?.setMenuVisible?.(true);
                }
              }}
              className="mt-6 w-full rounded border border-gray-300 py-3 text-xs font-black uppercase tracking-widest text-gray-700 transition-colors hover:bg-gray-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            >
              {seasonModeActive ? 'Return to Season' : 'Return to Main Menu'}
            </button>
          </div>
        </div>
        ); })()}

      {/* Options Menu Overlay */}
      {showSplash && (
        <div className="pointer-events-none absolute bottom-3 right-4 z-[110] font-mono text-[10px] tracking-widest text-white/35">
          v{__APP_VERSION__}
        </div>
      )}

      {isOptionsOpen && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-3">
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-white/10 shadow-2xl w-[min(1100px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-y-auto flex flex-col gap-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex gap-4">
                <button onClick={() => setActiveTab('OPTIONS')} className={`text-white text-sm ${activeTab === 'OPTIONS' ? 'font-bold' : 'text-white/40'}`}>OPTIONS</button>
                <button onClick={() => setActiveTab('CONTROLS')} className={`text-white text-sm ${activeTab === 'CONTROLS' ? 'font-bold' : 'text-white/40'}`}>CONTROLS</button>
                <button onClick={() => setActiveTab('STATS')} className={`text-white text-sm ${activeTab === 'STATS' ? 'font-bold' : 'text-white/40'}`}>STATS</button>
                {devToolsVisible && (
                  <>
                    <button onClick={() => setActiveTab('MATCH_HISTORY')} className={`text-white text-sm ${activeTab === 'MATCH_HISTORY' ? 'font-bold' : 'text-white/40'}`}>MATCHES</button>
                    <button onClick={() => setActiveTab('FRAME_VIEWER')} className={`text-white text-sm ${activeTab === 'FRAME_VIEWER' ? 'font-bold' : 'text-white/40'}`}>ANIMATIONS</button>
                  </>
                )}
                <button onClick={() => setActiveTab('HOW_TO_PLAY')} className={`text-white text-sm ${activeTab === 'HOW_TO_PLAY' ? 'font-bold' : 'text-white/40'}`}>HOW TO PLAY</button>
                {devToolsVisible && (
                  <button onClick={() => setActiveTab('LIVE_TELEMETRY')} className={`text-white text-sm ${activeTab === 'LIVE_TELEMETRY' ? 'font-bold' : 'text-white/40'}`}>TELEMETRY</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-widest text-white/30">v{__APP_VERSION__}</span>
                {hasActiveMatchSession && (
                  <button
                    type="button"
                    data-psl-quit-to-menu="options"
                    onClick={handleQuitToMainMenu}
                    className="rounded border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 transition-colors hover:border-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-white/60"
                  >
                    Quit to Main Menu
                  </button>
                )}
              <button 
                onClick={() => setIsOptionsOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                [ESC] CLOSE
              </button>
              </div>
            </div>

            {activeTab === 'OPTIONS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Audio</h3>
                    <div>
                      <div className="flex justify-between text-[9px] text-white/60 uppercase tracking-widest mb-1">
                        <span>Crowd Volume</span>
                        <span>{Math.round(crowdVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={crowdVolume}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setCrowdVolume(v);
                          gameRef.current?.setCrowdVolume?.(v);
                        }}
                        className="w-full accent-white"
                      />
                    </div>
                    <div className="mt-3">
                      <div className="text-[9px] text-white/60 uppercase tracking-widest mb-1">Match</div>
                      <div className="mb-2">
                        <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1">CPU Difficulty</div>
                        <div className="flex flex-wrap gap-2">
                          {(['RELAXED', 'NORMAL', 'COMPETITIVE', 'RUTHLESS'] as const).map((level) => (
                            <button
                              key={level}
                              type="button"
                              data-psl-cpu-difficulty={level}
                              onClick={() => {
                                setCpuDifficulty(level);
                                gameRef.current?.setCpuDifficulty?.(level);
                                try { window.localStorage.setItem('psl.cpuDifficulty', level); } catch {}
                              }}
                              className={`px-3 py-1.5 text-[10px] border rounded transition-colors ${
                                cpuDifficulty === level ? 'bg-white text-black border-white' : 'text-white border-white/20 hover:border-white'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <div className="mt-1 text-white/25 text-[8px]">Changes how hard the CPU presses you, not how often it shoots.</div>
                      </div>
                      <button
                        type="button"
                        data-psl-fouls-toggle="true"
                        onClick={() => {
                          const next = !foulsEnabled;
                          setFoulsEnabled(next);
                          gameRef.current?.setFoulsEnabled?.(next);
                        }}
                        className="rounded border border-white/20 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white transition-colors hover:border-white"
                      >
                        Fouls {foulsEnabled ? 'On' : 'Off'}
                      </button>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-[9px] text-white/60 uppercase tracking-widest mb-1">
                        <span>Music Volume</span>
                        <span>{musicVolume === 0 ? 'Off' : `${Math.round(musicVolume * 100)}%`}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={musicVolume}
                        onChange={(e) => setMusicVolume(Number(e.target.value))}
                        className="w-full accent-white"
                        aria-label="Music volume"
                      />
                      <button
                        type="button"
                        data-psl-music-toggle="true"
                        onClick={() => setMusicVolume((v) => (v === 0 ? 0.5 : 0))}
                        className="mt-2 rounded border border-white/20 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white transition-colors hover:border-white"
                      >
                        Music {musicVolume === 0 ? 'Off' : 'On'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Display</h3>
                    <div className="flex flex-col gap-2">
                      <div className="text-white/30 text-[9px]">The desktop build uses a fixed window. Change size with presets instead of free resizing.</div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {(['WINDOWED', 'FULLSCREEN'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            data-psl-display-mode={mode}
                            onClick={() => setDisplayMode(mode)}
                            className={`px-3 py-1.5 text-[10px] border rounded transition-colors ${
                              displayMode === mode ? 'bg-white text-black border-white' : 'text-white border-white/20 hover:border-white'
                            }`}
                          >
                            {mode === 'FULLSCREEN' ? 'Fullscreen' : 'Windowed'}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {WINDOW_RESOLUTION_PRESETS.map((preset) => (
                          <button
                            disabled={displayMode === 'FULLSCREEN'}
                            key={preset.key}
                            onClick={() => setWindowResolution(preset.key)}
                            className={`px-3 py-1.5 text-[10px] border rounded ${
                              windowResolution === preset.key ? 'bg-white text-black border-white' : 'text-white border-white/20 hover:border-white'
                            } transition-colors`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="text-white/30 text-[9px] uppercase tracking-widest">
                        Current: {WINDOW_RESOLUTION_PRESETS.find((preset) => preset.key === windowResolution)?.label ?? windowResolution}
                      </div>
                      {windowResolutionMessage && (
                        <div className="text-emerald-300/70 text-[9px] uppercase tracking-widest">{windowResolutionMessage}</div>
                      )}
                    </div>
                  </div>

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
                          checked={shotBallTrailEnabled}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setShotBallTrailEnabled(enabled);
                            gameRef.current?.setShotBallTrailEnabled?.(enabled);
                          }}
                          className="accent-white"
                        />
                        Shot Ball Trail
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">World Teams</h3>
                    <div className="flex flex-col gap-2">
                      <label className="text-white/60 text-[9px] uppercase">Home</label>
                      <select
                        value={teamAName}
                        onChange={(e) => setTeamAName(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {teamOptions.map((team) => (
                          <option key={`a-${team}`} value={team}>{team}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {(['home', 'away'] as const).map((k) => (
                          <button
                            key={`ak-${k}`}
                            onClick={() => setTeamAKit(k)}
                            className={`flex-1 text-[9px] uppercase font-bold py-1 rounded transition-all ${teamAKit === k ? 'bg-white text-black' : 'bg-zinc-800 text-white/40 hover:text-white border border-white/10'}`}
                          >{k} Kit</button>
                        ))}
                      </div>

                      <label className="text-white/60 text-[9px] uppercase mt-1">Away</label>
                      <select
                        value={teamBName}
                        onChange={(e) => setTeamBName(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {teamOptions.map((team) => (
                          <option key={`b-${team}`} value={team}>{team}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {(['home', 'away'] as const).map((k) => (
                          <button
                            key={`bk-${k}`}
                            onClick={() => setTeamBKit(k)}
                            className={`flex-1 text-[9px] uppercase font-bold py-1 rounded transition-all ${teamBKit === k ? 'bg-white text-black' : 'bg-zinc-800 text-white/40 hover:text-white border border-white/10'}`}
                          >{k} Kit</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Formations</h3>
                    <div className="flex flex-col gap-2">
                      <label className="text-white/60 text-[9px] uppercase">Home</label>
                      <select
                        value={teamAFormation}
                        onChange={(e) => setTeamAFormation(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {SOCCER_FORMATION_OPTIONS.map((formation) => (
                          <option key={`fa-${formation}`} value={formation}>{formation}</option>
                        ))}
                      </select>

                      <label className="text-white/60 text-[9px] uppercase mt-1">Away</label>
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
            ) : activeTab === 'CONTROLS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Auto Switching</h3>
                    <p className="text-white/30 text-[9px] mb-2">Controls when the game automatically switches which player you control.</p>
                    <div className="flex flex-wrap gap-2">
                      {(['AUTOMATIC', 'AIR_BALLS', 'LOOSE_BALLS', 'MANUAL'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setAutoSwitching(mode);
                            gameRef.current?.setAutoSwitching?.(mode);
                          }}
                          className={`px-3 py-1.5 text-[10px] border rounded ${
                            autoSwitching === mode ? 'bg-white text-black border-white' : 'text-white border-white/20 hover:border-white'
                          } transition-colors`}
                        >
                          {mode.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-white/25 text-[8px] space-y-0.5">
                      <p><span className="text-white/40 font-bold">AUTOMATIC</span> — Always switches to the best defender near the ball</p>
                      <p><span className="text-white/40 font-bold">AIR BALLS</span> — Only switches on crosses and lofted balls</p>
                      <p><span className="text-white/40 font-bold">LOOSE BALLS</span> — Only switches on 50/50 and scramble situations</p>
                      <p><span className="text-white/40 font-bold">MANUAL</span> — Never auto-switches, use X / LB / RB to switch manually</p>
                    </div>
                  </div>

                </div>

                <div className="flex flex-col gap-4">
                  {/* Shared with the pause overlay. This tab used to keep its
                      own copy of the bindings and it drifted: Shift+G for the
                      lob and Space for switching were both wrong, and the
                      second player's lob was missing entirely. */}
                  <React.Suspense fallback={null}>
                    <ControlReference />
                  </React.Suspense>
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
                      <div>SPD: {Number(p.stats?.speed ?? 0).toFixed(2)}</div>
                      <div>STR: {Number(p.stats?.strength ?? 0).toFixed(2)}</div>
                      <div>CAT: {Number(p.stats?.catching ?? 0).toFixed(2)}</div>
                      <div>TAK: {Number(p.stats?.tackle ?? 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'MATCH_HISTORY' ? (
              <React.Suspense fallback={<div className="text-[10px] text-white/50">Loading match history...</div>}>
                <MatchHistoryDashboard />
              </React.Suspense>
            ) : activeTab === 'HOW_TO_PLAY' ? (
              <div className="max-w-lg mx-auto flex flex-col gap-6">
                <div>
                  <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">Player 1 — Home</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                    <div className="text-white/60">W A S D</div>
                    <div className="text-white text-right">MOVE PLAYER</div>
                    <div className="text-white/60">LEFT SHIFT (HOLD)</div>
                    <div className="text-white text-right">SPRINT</div>
                    <div className="text-white/60">SPACEBAR / G</div>
                    <div className="text-white text-right">PASS — HOLD TO CHARGE, AIM WITH MOVEMENT</div>
                    <div className="text-white/60">C</div>
                    <div className="text-white text-right">LOB / CHIP PASS</div>
                    <div className="text-white/60">F</div>
                    <div className="text-white text-right">SHOOT — HOLD TO CHARGE, AIM WITH MOVEMENT</div>
                    <div className="text-white/60">R</div>
                    <div className="text-white text-right">TACKLE (WHEN DEFENDING)</div>
                    <div className="text-white/60">Q / E</div>
                    <div className="text-white text-right">SWITCH HOME PLAYER</div>
                    <div className="text-white/60">V</div>
                    <div className="text-white text-right">SWITCH TO NEAREST</div>
                  </div>
                </div>
                <div>
                  <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">Player 2 — Away</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                    <div className="text-white/60">ARROW KEYS</div>
                    <div className="text-white text-right">MOVE PLAYER</div>
                    <div className="text-white/60">RIGHT SHIFT (HOLD)</div>
                    <div className="text-white text-right">SPRINT</div>
                    <div className="text-white/60">,</div>
                    <div className="text-white text-right">PASS — HOLD TO CHARGE, AIM WITH MOVEMENT</div>
                    <div className="text-white/60">;</div>
                    <div className="text-white text-right">LOB / CHIP PASS</div>
                    <div className="text-white/60">.</div>
                    <div className="text-white text-right">SHOOT — HOLD TO CHARGE, AIM WITH MOVEMENT</div>
                    <div className="text-white/60">/</div>
                    <div className="text-white text-right">TACKLE (WHEN DEFENDING)</div>
                    <div className="text-white/60">[ / ]</div>
                    <div className="text-white text-right">SWITCH AWAY PLAYER</div>
                    <div className="text-white/60">'</div>
                    <div className="text-white text-right">SWITCH TO NEAREST</div>
                  </div>
                </div>
                <div>
                  <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">General</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                    <div className="text-white/60">ESC</div>
                    <div className="text-white text-right">OPTIONS MENU</div>
                  </div>
                </div>
                <div>
                  <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">How to Play</h3>
                  <div className="text-white/70 text-[11px] leading-relaxed space-y-2">
                    <p>You control the <span className="text-white font-bold">highlighted player</span> on your team. Player 1 moves with <span className="text-white font-bold">WASD</span>; in two-player matches Player 2 moves with the <span className="text-white font-bold">arrow keys</span>.</p>
                    <p>When your team has the ball, use movement to aim, then press <span className="text-white font-bold">SPACEBAR</span> to pass or <span className="text-white font-bold">F</span> to shoot. When defending, press <span className="text-white font-bold">R</span> near the ball carrier to tackle.</p>
                    <p>Use <span className="text-white font-bold">Q / E</span> to cycle through your home-team players and <span className="text-white font-bold">[ / ]</span> to cycle away-team players.</p>
                    <p>Kick-offs, restarts and resetting the match are handled from the on-screen buttons and the <span className="text-white font-bold">OPTIONS</span> menu.</p>
                  </div>
                </div>
              </div>
            ) : activeTab === 'LIVE_TELEMETRY' ? (
              <React.Suspense fallback={<div className="text-[10px] text-white/50">Loading telemetry...</div>}>
                <LiveTelemetry gameRef={gameRef} />
              </React.Suspense>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                <React.Suspense fallback={<div className="text-[10px] text-white/50">Loading animation tools...</div>}>
                  <FrameViewer>
                    <div className="col-span-2">
                      <AnimationInspector embedded />
                    </div>
                  </FrameViewer>
                </React.Suspense>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom-right toggle buttons */}
      {!showSplash && !isOptionsOpen && (
        <div className="absolute bottom-4 right-4 z-40 flex gap-2">
          <button
            onClick={() => setShowTelemetry((v) => !v)}
            className="hidden bg-black/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-[9px] uppercase tracking-widest px-3 py-1.5 rounded backdrop-blur-sm transition-colors"
          >
            {showTelemetry ? 'Hide Telemetry' : '⚡ Telemetry'}
          </button>

        </div>
      )}

      {!showSplash && !hasActiveMatchSession && watchedFixtureMessage && (
        <div
          data-psl-watched-fixture-status="compact"
          className="absolute bottom-4 left-4 z-30 max-w-[min(360px,calc(100vw-32px))] px-4 py-2 bg-black/75 border border-emerald-400/40 rounded-lg backdrop-blur-sm pointer-events-none"
        >
          <div className="text-[9px] uppercase tracking-[0.24em] text-emerald-200">
            {watchedFixtureRunning ? 'Watched Fixture Running' : 'Watched Fixture'}
          </div>
          <div className="text-[10px] text-white/85 mt-1">{watchedFixtureMessage}</div>
        </div>
      )}



      {/* Floating Telemetry Window */}
      {showTelemetry && !showSplash && !isOptionsOpen && (
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
              Session: {(diskMirrorStatus?.latestSessionId || movementSessionId || driftSessionId) ? ((diskMirrorStatus?.latestSessionId || movementSessionId || driftSessionId)?.slice(0, 24) + '…') : 'none'}
            </div>

            <div className="border border-cyan-500/15 bg-cyan-950/20 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[9px] text-white/50 uppercase tracking-widest">Disk Mirror</div>
                <button
                  onClick={handleRecoverLatestMirror}
                  disabled={diskRecovering}
                  className="px-2 py-0.5 text-[8px] uppercase tracking-widest border border-cyan-500/35 text-cyan-300 rounded hover:border-cyan-300 disabled:opacity-30"
                >
                  {diskRecovering ? 'Recovering...' : 'Recover Latest'}
                </button>
              </div>
              {diskMirrorStatus ? (
                <div className="space-y-1 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-white/50">Live batches</span>
                    <span className="text-cyan-300 tabular-nums">{diskMirrorStatus.batchCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Snapshots</span>
                    <span className="text-cyan-300 tabular-nums">{diskMirrorStatus.snapshotCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Last batch write</span>
                    <span className="text-cyan-300">{diskMirrorStatus.latestBatchAt ? new Date(diskMirrorStatus.latestBatchAt).toLocaleTimeString() : 'n/a'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Last snapshot</span>
                    <span className="text-cyan-300">{diskMirrorStatus.latestSnapshotAt ? new Date(diskMirrorStatus.latestSnapshotAt).toLocaleTimeString() : 'n/a'}</span>
                  </div>
                  <div className="text-[8px] text-white/35">
                    {diskMirrorStatus.latestPhase ? `Phase: ${diskMirrorStatus.latestPhase}` : 'Waiting for mirrored gameplay...'}
                    {diskMirrorStatus.latestSnapshotEventType ? ` • Last snapshot: ${diskMirrorStatus.latestSnapshotEventType}` : ''}
                    {diskMirrorStatus.latestScore ? ` • Score ${diskMirrorStatus.latestScore.scoreA}-${diskMirrorStatus.latestScore.scoreB}` : ''}
                  </div>
                </div>
              ) : (
                <div className="text-[9px] text-white/30">Mirror status unavailable.</div>
              )}
              {diskMirrorMessage ? <div className="mt-1 text-[8px] text-white/45">{diskMirrorMessage}</div> : null}
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

            {/* Movement Applet */}
            <div className="border-t border-white/10 pt-2">
              <div className="text-[9px] text-white/50 uppercase tracking-widest mb-1">Movement Applet</div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                <select
                  value={movementAnchor}
                  onChange={(e) => setMovementAnchor(e.target.value as 'pause' | 'full_time' | 'latest')}
                  className="bg-zinc-900 border border-white/20 text-white/80 rounded px-1.5 py-1 text-[9px]"
                >
                  <option value="pause">Anchor: Pause</option>
                  <option value="full_time">Anchor: Full Time</option>
                  <option value="latest">Anchor: Latest</option>
                </select>
                <select
                  value={movementWindowSeconds}
                  onChange={(e) => setMovementWindowSeconds(Number(e.target.value) === 10 ? 10 : 20)}
                  className="bg-zinc-900 border border-white/20 text-white/80 rounded px-1.5 py-1 text-[9px]"
                >
                  <option value={10}>Window: 10s</option>
                  <option value={20}>Window: 20s</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 mb-2 text-[9px] text-white/65">
                <input
                  type="checkbox"
                  checked={autoScanOnPause}
                  onChange={(e) => setAutoScanOnPause(e.target.checked)}
                  className="accent-cyan-400"
                />
                Auto scan when play pauses (quick 10s)
              </label>

              <button
                onClick={() => {
                  void runMovementScan();
                }}
                disabled={movementLoading}
                className="w-full py-1.5 mb-2 text-[9px] uppercase tracking-widest border border-cyan-500/40 text-cyan-300 rounded hover:border-cyan-300 disabled:opacity-30 transition-colors"
              >
                {movementLoading ? 'Scanning...' : 'Run Movement Scan'}
              </button>

              <div className="text-[9px] text-white/40 mb-1">
                Frames: <span className="text-cyan-300">{movementFrames}</span>
                {movementSessionId ? ` • Session: ${movementSessionId.slice(0, 10)}…` : ''}
                {movementLastAnchorUsed ? ` • Anchor: ${movementLastAnchorUsed}` : ''}
              </div>
              {movementMessage ? <div className="text-[9px] text-white/55 mb-1">{movementMessage}</div> : null}
              {movementLastRunAt ? (
                <div className="text-[8px] text-white/35 mb-1">Last scan: {new Date(movementLastRunAt).toLocaleTimeString()}</div>
              ) : null}

              {movementTopRows.length > 0 && (
                <div className="flex flex-col gap-0.5 max-h-20 overflow-y-auto pr-1">
                  {movementTopRows.map((row) => (
                    <div key={`${row.team || '?'}-${row.name}`} className="flex items-center justify-between gap-2 text-[9px]">
                      <div className="min-w-0 flex-1">
                        <span className="text-white/75 truncate block">{row.name} {row.team ? `(${row.team})` : ''}</span>
                      </div>
                      <svg width="66" height="20" viewBox="0 0 66 20" className="shrink-0 rounded border border-white/10 bg-black/30">
                        <path
                          d={movementTrailPaths[`${row.team || '?'}::${row.name}`] || ''}
                          fill="none"
                          stroke={row.team === 'A' ? '#67e8f9' : '#c4b5fd'}
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-violet-300 shrink-0">{row.distanceMeters.toFixed(1)}m</span>
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

      {/* Pre-Match Setup Screen */}
      {showPreMatchSetup && (
        <MemoizedPreMatchSetupScreen
          teamAName={teamAName}
          teamBName={teamBName}
          teamAFormation={teamAFormation}
          teamBFormation={teamBFormation}
          teamAAggressiveness={teamAAggressiveness}
          teamBAggressiveness={teamBAggressiveness}
          teamAHome={teamAHome}
          teamBHome={!teamAHome}
          teamAPreMatchKit={teamAPreMatchKit}
          teamBPreMatchKit={teamBPreMatchKit}
          halfLengthMinutes={halfLengthMinutes}
          onHalfLengthMinutesChange={setHalfLengthMinutes}
          onTeamANameChange={setTeamAName}
          onTeamBNameChange={setTeamBName}
          onTeamAFormationChange={setTeamAFormation}
          onTeamBFormationChange={setTeamBFormation}
          onTeamAAggressivenessChange={setTeamAAggressiveness}
          onTeamBAggressivenessChange={setTeamBAggressiveness}
          onTeamAHomeChange={setTeamAHome}
          onTeamBHomeChange={(isHome) => setTeamAHome(!isHome)}
          onTeamAPreMatchKitChange={setTeamAPreMatchKit}
          onTeamBPreMatchKitChange={setTeamBPreMatchKit}
          onStartMatch={handlePreMatchSetupStart}
          watchedFixtureMessage={watchedFixtureMessage}
          teamOptions={teamOptions}
          onClose={() => setShowPreMatchSetup(false)}
        />
      )}

    </div>
  );
};

/** Pass Log Panel Component - displays recent pass telemetry */

export default RetroFootball;

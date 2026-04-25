import React, { useEffect, useRef, useState } from 'react';
import { initGame } from '../gameEngine';
import FrameViewer from './FrameViewer';
import AnimationInspector from './AnimationInspector';
import MatchHistoryDashboard from './MatchHistoryDashboard';
import LiveTelemetry from './LiveTelemetry';
import TuningLab from './TuningLab';
import SeasonHub from './SeasonHub';
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
import { installSmokeTestApi } from '../smokeTest';
import { PRACTICE_PLAYS, PRACTICE_AGGRESSIVENESS, type AggressivenessKey, getPlayRoutes } from '../practicePlays';

// Helper: reset positions, draw routes, activate play — called on every play/formation change
function applyPracticePlay(
  gameRef: React.MutableRefObject<any>,
  play: (typeof PRACTICE_PLAYS)[number],
  formation: string,
  aggressivenessKey: AggressivenessKey,
) {
  // 1. Deactivate any running play (clears stale player refs before formation rebuild)
  gameRef.current?.deactivatePracticePlay?.();
  // 2. Rebuild formation → snaps all players to homePos
  gameRef.current?.setTeamFormations?.(formation, formation);
  // 3. Tune CPU shot accuracy
  const agg = PRACTICE_AGGRESSIVENESS[aggressivenessKey];
  gameRef.current?.setCPUShotTuning?.(agg.aimErrorRad, agg.pressureError);
  // 4. Compute routes from fresh player positions
  const allPlayers = gameRef.current?.getPlayers?.() ?? [];
  const attackSign = gameRef.current?.getTeamAAttackSign?.() ?? 1;
  const routes = getPlayRoutes(play, allPlayers, attackSign);
  // 5. Draw arrows + execute play
  gameRef.current?.drawPracticeRoutes?.(routes);
  gameRef.current?.activatePracticePlay?.(routes, play.template);
}

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
const MLS_TEAM_KITS: Record<string, { home: { shirt: number; pants: number }; away: { shirt: number; pants: number } }> = {
  'Atlanta United':          { home: { shirt: 0xC41230, pants: 0x231F20 }, away: { shirt: 0xFFFFFF, pants: 0xC41230 } },
  'Austin FC':               { home: { shirt: 0x00B140, pants: 0x000000 }, away: { shirt: 0xFFFFFF, pants: 0x00B140 } },
  'Charlotte FC':            { home: { shirt: 0x1A85C8, pants: 0xCCCCCC }, away: { shirt: 0xFFFFFF, pants: 0x1A85C8 } },
  'Chicago Fire':            { home: { shirt: 0xC50505, pants: 0x003087 }, away: { shirt: 0xFFFFFF, pants: 0xC50505 } },
  'FC Cincinnati':           { home: { shirt: 0xF4811F, pants: 0x263C7E }, away: { shirt: 0xFFFFFF, pants: 0x263C7E } },
  'Colorado Rapids':         { home: { shirt: 0x94092E, pants: 0x0086C8 }, away: { shirt: 0xFFFFFF, pants: 0x94092E } },
  'Columbus Crew':           { home: { shirt: 0xFEDD00, pants: 0x000000 }, away: { shirt: 0x000000, pants: 0xFEDD00 } },
  'DC United':               { home: { shirt: 0xEF3E42, pants: 0x231F20 }, away: { shirt: 0xFFFFFF, pants: 0xEF3E42 } },
  'FC Dallas':               { home: { shirt: 0xBF0D3E, pants: 0x002F65 }, away: { shirt: 0xFFFFFF, pants: 0xBF0D3E } },
  'Houston Dynamo':          { home: { shirt: 0xF4851A, pants: 0x0A2240 }, away: { shirt: 0xFFFFFF, pants: 0xF4851A } },
  'Inter Miami':             { home: { shirt: 0xF52B8F, pants: 0x231F20 }, away: { shirt: 0xFFFFFF, pants: 0xF52B8F } },
  'LA Galaxy':               { home: { shirt: 0x00245D, pants: 0xFAD141 }, away: { shirt: 0xFFFFFF, pants: 0x00245D } },
  'LAFC':                    { home: { shirt: 0x000000, pants: 0xC39E6D }, away: { shirt: 0xFFFFFF, pants: 0x000000 } },
  'Minnesota United':        { home: { shirt: 0x231F20, pants: 0x8FCFED }, away: { shirt: 0xFFFFFF, pants: 0x231F20 } },
  'CF Montreal':             { home: { shirt: 0x0B2A6B, pants: 0x0A9FDB }, away: { shirt: 0xFFFFFF, pants: 0x0B2A6B } },
  'Nashville SC':            { home: { shirt: 0xECE83A, pants: 0x1A2F5D }, away: { shirt: 0x1A2F5D, pants: 0xECE83A } },
  'New England Revolution':  { home: { shirt: 0x003087, pants: 0xCE0E2D }, away: { shirt: 0xFFFFFF, pants: 0x003087 } },
  'New York City FC':        { home: { shirt: 0x6CADDF, pants: 0x003087 }, away: { shirt: 0xFFFFFF, pants: 0x6CADDF } },
  'New York Red Bulls':      { home: { shirt: 0xED1C24, pants: 0x23235B }, away: { shirt: 0xFFFFFF, pants: 0xED1C24 } },
  'Orlando City':            { home: { shirt: 0x633492, pants: 0xFFC224 }, away: { shirt: 0xFFFFFF, pants: 0x633492 } },
  'Philadelphia Union':      { home: { shirt: 0x072B61, pants: 0xB19F72 }, away: { shirt: 0xFFFFFF, pants: 0x072B61 } },
  'Portland Timbers':        { home: { shirt: 0x004812, pants: 0xFBEC51 }, away: { shirt: 0xFFFFFF, pants: 0x004812 } },
  'Real Salt Lake':          { home: { shirt: 0xB22222, pants: 0x013A81 }, away: { shirt: 0xFFFFFF, pants: 0xB22222 } },
  'San Diego FC':            { home: { shirt: 0x003087, pants: 0xC8A951 }, away: { shirt: 0xFFFFFF, pants: 0x003087 } },
  'San Jose Earthquakes':    { home: { shirt: 0x0D4DA1, pants: 0x000000 }, away: { shirt: 0xFFFFFF, pants: 0x0D4DA1 } },
  'Seattle Sounders':        { home: { shirt: 0x5D9732, pants: 0x003087 }, away: { shirt: 0xFFFFFF, pants: 0x5D9732 } },
  'Sporting Kansas City':    { home: { shirt: 0x002B5C, pants: 0x99D9E0 }, away: { shirt: 0xFFFFFF, pants: 0x002B5C } },
  'St. Louis City SC':       { home: { shirt: 0xC8102E, pants: 0x003087 }, away: { shirt: 0xFFFFFF, pants: 0xC8102E } },
  'Toronto FC':              { home: { shirt: 0xB81137, pants: 0x313233 }, away: { shirt: 0xFFFFFF, pants: 0xB81137 } },
  'Vancouver Whitecaps':     { home: { shirt: 0x0B63A0, pants: 0xFFFFFF }, away: { shirt: 0xFFFFFF, pants: 0x0B63A0 } },
};

const MLS_TEAM_NAMES = Object.keys(MLS_TEAM_KITS);

function getTeamColor(teamName: string): string {
  const kit = MLS_TEAM_KITS[teamName];
  if (!kit) return '#38bdf8'; // fallback sky-400
  const hex = kit.home.shirt;
  return `#${hex.toString(16).padStart(6, '0')}`;
}

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

/** Pre-Match Setup Screen Component */
interface PreMatchSetupScreenProps {
  teamAName: string;
  teamBName: string;
  teamAFormation: string;
  teamBFormation: string;
  teamAAggressiveness: AggressivenessKey;
  teamBAggressiveness: AggressivenessKey;
  teamAHome: boolean;
  teamAPreMatchKit: number;
  teamBPreMatchKit: number;
  onTeamANameChange: (name: string) => void;
  onTeamBNameChange: (name: string) => void;
  onTeamAFormationChange: (formation: string) => void;
  onTeamBFormationChange: (formation: string) => void;
  onTeamAAggressivenessChange: (agg: AggressivenessKey) => void;
  onTeamBAggressivenessChange: (agg: AggressivenessKey) => void;
  onTeamAHomeChange: (isHome: boolean) => void;
  onTeamAPreMatchKitChange: (kit: number) => void;
  onTeamBPreMatchKitChange: (kit: number) => void;
  halfLengthMinutes: number;
  onHalfLengthMinutesChange: (minutes: number) => void;
  onRandomize: () => void;
  onStartMatch: () => void;
  onRunWatchedFixture: () => void;
  watchedFixtureRunning: boolean;
  watchedFixtureMessage: string;
  onClose: () => void;
}

const PreMatchSetupScreen: React.FC<PreMatchSetupScreenProps> = ({
  teamAName,
  teamBName,
  teamAFormation,
  teamBFormation,
  teamAAggressiveness,
  teamBAggressiveness,
  teamAHome,
  teamAPreMatchKit,
  teamBPreMatchKit,
  onTeamANameChange,
  onTeamBNameChange,
  onTeamAFormationChange,
  onTeamBFormationChange,
  onTeamAAggressivenessChange,
  onTeamBAggressivenessChange,
  onTeamAHomeChange,
  onTeamAPreMatchKitChange,
  onTeamBPreMatchKitChange,
  halfLengthMinutes,
  onHalfLengthMinutesChange,
  onRandomize,
  onStartMatch,
  onRunWatchedFixture,
  watchedFixtureRunning,
  watchedFixtureMessage,
  onClose,
}) => {
  const aggressivenessOptions = Object.keys(PRACTICE_AGGRESSIVENESS) as AggressivenessKey[];

  const TeamSetupSection: React.FC<{
    team: 'A' | 'B';
    name: string;
    formation: string;
    aggressiveness: AggressivenessKey;
    isHome: boolean;
    kitIndex: number;
    onNameChange: (name: string) => void;
    onFormationChange: (formation: string) => void;
    onAggressivenessChange: (agg: AggressivenessKey) => void;
    onKitChange: (kitIndex: number) => void;
    onHomeChange?: (isHome: boolean) => void;
  }> = ({
    team,
    name,
    formation,
    aggressiveness,
    isHome,
    kitIndex,
    onNameChange,
    onFormationChange,
    onAggressivenessChange,
    onKitChange,
    onHomeChange,
  }) => {
    const teamColor = getTeamColor(name);
    const kit = MLS_TEAM_KITS[name] ?? MLS_TEAM_KITS['Inter Miami'];
    const selectedKit = kitIndex === 0 ? kit.home : kit.away;
    const shirtColor = `#${selectedKit.shirt.toString(16).padStart(6, '0')}`;
    const pantsColor = `#${selectedKit.pants.toString(16).padStart(6, '0')}`;

    return (
      <div className="flex-1 bg-zinc-900/80 border border-white/10 rounded-lg p-4 flex flex-col gap-4 relative">
        {/* Team Name and Home/Away */}
        <div className="flex items-center gap-3 relative z-50">
          <CustomDropdown
            value={name}
            onChange={onNameChange}
            options={MLS_TEAM_NAMES}
            className="flex-1"
          />
          {onHomeChange && (
            <button
              onClick={() => onHomeChange(!isHome)}
              className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded border transition-colors ${
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
          <label className="text-white/40 text-[9px] uppercase tracking-widest">Kit</label>
          <div className="flex gap-2">
            <button
              onClick={() => onKitChange(0)}
              className={`flex-1 py-2 rounded border text-[9px] font-bold uppercase tracking-widest transition-colors ${
                kitIndex === 0
                  ? 'bg-cyan-500/40 border-cyan-400 text-cyan-300'
                  : 'bg-zinc-800 border-white/20 text-white/60 hover:border-white/40'
              }`}
            >
              HOME
            </button>
            <button
              onClick={() => onKitChange(1)}
              className={`flex-1 py-2 rounded border text-[9px] font-bold uppercase tracking-widest transition-colors ${
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
          <label className="text-white/40 text-[9px] uppercase tracking-widest">Formation</label>
          <CustomDropdown
            value={formation}
            onChange={onFormationChange}
            options={SOCCER_FORMATION_OPTIONS}
          />
        </div>

        {/* Aggressiveness */}
        <div className="flex flex-col gap-1.5 relative z-40">
          <label className="text-white/40 text-[9px] uppercase tracking-widest">Aggressiveness</label>
          <CustomDropdown
            value={aggressiveness}
            onChange={(value) => onAggressivenessChange(value as AggressivenessKey)}
            options={aggressivenessOptions}
          />
        </div>

        {/* Lineup Preview (placeholder) */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <label className="text-white/40 text-[9px] uppercase tracking-widest">Starting XI</label>
          <div className="bg-zinc-800/50 border border-white/10 rounded p-2 text-white/50 text-[9px] hover:bg-zinc-800 hover:border-white/20 cursor-pointer transition-colors">
            <div className="text-center py-1">Team {team} Starting Lineup</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 pointer-events-none"
      onClick={(e) => {
        // Only close if clicking on the background itself, not the content
        if (e.target === e.currentTarget) {
          console.log('Closing modal from background click');
          onClose();
        }
      }}
    >
      <div
        className="max-w-6xl w-full bg-zinc-950 border border-cyan-500/20 rounded-xl shadow-2xl p-6 flex flex-col gap-6 pointer-events-auto"
      >
        <div className="text-center">
          <h2 className="text-white text-2xl font-bold uppercase tracking-widest mb-1">Pre-Match Setup</h2>
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
            isHome={false}
            kitIndex={teamBPreMatchKit}
            onNameChange={onTeamBNameChange}
            onFormationChange={onTeamBFormationChange}
            onAggressivenessChange={onTeamBAggressivenessChange}
            onKitChange={onTeamBPreMatchKitChange}
          />
        </div>

        {/* Match Length */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-white text-xs uppercase tracking-[0.25em] text-white/40">Half Length</div>
              <div className="text-white text-sm font-semibold">Match half duration</div>
            </div>
            <div className="w-32">
              <CustomDropdown
                value={`${halfLengthMinutes}`}
                onChange={(value) => onHalfLengthMinutesChange(Number(value))}
                options={['5', '10', '15', '20', '30', '45']}
              />
            </div>
          </div>
          <div className="text-white/50 text-[10px] uppercase tracking-[0.2em]">Applies to the CPU vs CPU match timer.</div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onRandomize}
            className="flex-1 bg-purple-500/30 border border-purple-400 text-purple-200 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[11px] hover:bg-purple-500/50 transition-colors"
          >
            🎲 Randomize All
          </button>
          <button
            onClick={onRunWatchedFixture}
            disabled={watchedFixtureRunning}
            className="flex-1 bg-emerald-500/30 border border-emerald-400 text-emerald-100 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[11px] hover:bg-emerald-500/50 disabled:opacity-50 disabled:hover:bg-emerald-500/30 transition-colors"
          >
            {watchedFixtureRunning ? '👀 Running Test…' : '👀 Run Watched CPU Test'}
          </button>
          <button
            onClick={onStartMatch}
            className="flex-1 bg-cyan-500/40 border border-cyan-400 text-cyan-100 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[11px] hover:bg-cyan-500/60 transition-colors"
          >
            ⚽ Start Match
          </button>
        </div>
        {watchedFixtureMessage ? (
          <div className="text-center text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
            {watchedFixtureMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Memoize to prevent dropdown from closing on parent re-renders
const MemoizedPreMatchSetupScreen = React.memo(PreMatchSetupScreen);

/** Custom Dropdown Component */
const CustomDropdown = <T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: T[];
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipNextClickRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      console.log('handleClickOutside fired, skipNextClickRef:', skipNextClickRef.current);
      console.log('e.target:', e.target, 'dropdownRef contains target:', dropdownRef.current?.contains(e.target as Node));

      if (skipNextClickRef.current) {
        skipNextClickRef.current = false;
        console.log('Skipping click outside (same event that opened dropdown)');
        return;
      }

      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        console.log('Dropdown click outside detected, closing');
        setIsOpen(false);
      }
    };

    if (isOpen) {
      console.log('Dropdown opened, adding document listener');
      // Delay to ensure we're past the opening event cycle
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);

      return () => {
        clearTimeout(timeoutId);
        console.log('Removing document listener');
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onMouseDown={(e) => {
          skipNextClickRef.current = true;
          console.log('Dropdown button mousedown, setting skip flag');
        }}
        onClick={(e) => {
          console.log('Dropdown button clicked, isOpen:', isOpen);
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="w-full bg-zinc-800 border border-white/20 text-white text-[11px] rounded px-2 py-1.5 focus:outline-none focus:border-cyan-400 pointer-events-auto cursor-pointer text-left flex justify-between items-center hover:border-white/40 transition-colors"
      >
        <span>{value}</span>
        <span className="text-[8px] ml-2">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/20 rounded z-[9999] max-h-48 overflow-y-auto shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((option) => (
            <button
              key={option}
              onClick={(e) => {
                e.stopPropagation();
                onChange(option);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                value === option
                  ? 'bg-cyan-500/40 text-cyan-200'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [cameraMode, setCameraMode] = useState<'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE' | 'GOAL_THREE_QUARTER' | 'STADIUM_CAM'>('BROADCAST');
  const [stadiumCamTiltShiftEnabled, setStadiumCamTiltShiftEnabled] = useState(true);
  const [teamAUniform, setTeamAUniform] = useState(0);
  const [teamBUniform, setTeamBUniform] = useState(0);
  const [teamAName, setTeamAName] = useState('Inter Miami');
  const [teamBName, setTeamBName] = useState('LA Galaxy');
  const [teamAFormation, setTeamAFormation] = useState('3-4-3');
  const [teamBFormation, setTeamBFormation] = useState('3-4-3');
  const [teamAAggressiveness, setTeamAAggressiveness] = useState<AggressivenessKey>('BALANCED');
  const [teamBAggressiveness, setTeamBAggressiveness] = useState<AggressivenessKey>('BALANCED');
  const [teamAHome, setTeamAHome] = useState(true);
  const [showPreMatchSetup, setShowPreMatchSetup] = useState(false);
  const [watchedFixtureRunning, setWatchedFixtureRunning] = useState(false);
  const [watchedFixtureMessage, setWatchedFixtureMessage] = useState('');
  const [cpuVsCpuPending, setCpuVsCpuPending] = useState<{ a: string; b: string } | null>(null);
  const [teamAPreMatchKit, setTeamAPreMatchKit] = useState(0); // 0=home, 1=away
  const [teamBPreMatchKit, setTeamBPreMatchKit] = useState(1); // 0=home, 1=away
  const [halfLengthMinutes, setHalfLengthMinutes] = useState(5);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'OPTIONS' | 'CONTROLS' | 'STATS' | 'MATCH_HISTORY' | 'FRAME_VIEWER' | 'HOW_TO_PLAY' | 'LIVE_TELEMETRY'>('OPTIONS');
  const [crowdVolume, setCrowdVolume] = useState(0.60);
  const [autoSwitching, setAutoSwitching] = useState<'AUTOMATIC' | 'AIR_BALLS' | 'LOOSE_BALLS' | 'MANUAL'>('AUTOMATIC');
  const [autoClearances, setAutoClearances] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [selectedDefensePlayer, setSelectedDefensePlayer] = useState<any>(null);
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
  const [isGroundVisible, setIsGroundVisible] = useState(true);
  const [isFieldVisible, setIsFieldVisible] = useState(true);
  const [isGrassVisible, setIsGrassVisible] = useState(true);
  const [showAIStateOverlay, setShowAIStateOverlay] = useState(false);
  const [showPositionLabels, setShowPositionLabels] = useState(false);
  const [showAIStateLabels, setShowAIStateLabels] = useState(false);
  const [showAnimInspector, setShowAnimInspector] = useState(false);
  const [teamAKit, setTeamAKit] = useState<'home' | 'away'>('home');
  const [teamBKit, setTeamBKit] = useState<'home' | 'away'>('away');
  const [hotSeatMode, setHotSeatMode] = useState(false);
  const [testingMode, setTestingMode] = useState(false);
  const [gameMode, setGameMode] = useState<'1p' | '2p' | 'cpu' | 'test' | 'practice' | null>(null);
  const [hasActiveMatchSession, setHasActiveMatchSession] = useState(false);
  // Practice mode setup state
  const [showPracticeSetup, setShowPracticeSetup] = useState(false);
  const [practiceIsHuman, setPracticeIsHuman] = useState(true);
  const [selectedPracticePlay, setSelectedPracticePlay] = useState<string | null>(null);
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceFormation, setPracticeFormation] = useState<string>(PRACTICE_PLAYS[0].formation);
  const [practiceAggressiveness, setPracticeAggressiveness] = useState<AggressivenessKey>('AGGRESSIVE');
  const [showPracticeComplete, setShowPracticeComplete] = useState(false);
  const practiceCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ifpEvents, setIfpEvents] = useState<any[]>([]);
  const [latestIfpFlash, setLatestIfpFlash] = useState<any>(null);
  const latestIfpFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ifpSeenCountRef = useRef(0);
  const [allowMainMenu, setAllowMainMenu] = useState(true);
  const [sessionMenuLock, setSessionMenuLock] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashAudioStarted, setSplashAudioStarted] = useState(false);
  const splashAdvancedRef = useRef(false);
  const splashAudioStartedRef = useRef(false);
  const splashSceneStartedRef = useRef(false);
  const [isFullTime, setIsFullTime] = useState(() => {
    try { return sessionStorage.getItem('psl_fullTime') === '1'; } catch { return false; }
  });
  const [fullTimeScore, setFullTimeScore] = useState<{ scoreA: number; scoreB: number; teamA: string; teamB: string; colorA?: string; colorB?: string; shotsA?: number; shotsB?: number; sogA?: number; sogB?: number; savesA?: number; savesB?: number; headersA?: number; headersB?: number; breakawayGoalsA?: number; breakawayGoalsB?: number; goals?: { team: string; playerName: string; shirtNumber: number; matchMinute: number; attackersInBox?: number; defendersInBox?: number; outfieldBoxCrowd?: number; isBreakaway?: boolean }[] } | null>(() => {
    try { const s = sessionStorage.getItem('psl_fullTimeScore'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const fullTimeReturnArmedRef = useRef(false);
  const prevIsLive = useRef(false);

  // ── Season mode state ─────────────────────────────────────────
  const [seasonModeActive, setSeasonModeActive] = useState(false);
  const [seasonMatchResult, setSeasonMatchResult] = useState<{ scoreA: number; scoreB: number } | null>(null);
  const seasonReturnRef = useRef(false); // true when returning from a season match

  // ── Gamepad menu navigation ───────────────────────────────────
  const [menuFocusIndex, setMenuFocusIndex] = useState(2); // default to "1 Player vs CPU"
  const menuFocusRef = useRef(2);
  const menuGpPrev = useRef<boolean[]>(new Array(17).fill(false));
  const menuGpStickCooldown = useRef(0);
  const handleKickOffRef = useRef<(mode: '1p' | '2p' | 'cpu' | 'test' | 'practice', overrideTeams?: { a: string; b: string }) => void>(() => {});
  const setSeasonModeActiveRef = useRef(setSeasonModeActive);

  // Keep ref in sync with state for use in gamepad polling
  useEffect(() => { menuFocusRef.current = menuFocusIndex; }, [menuFocusIndex]);

  const startMenuVisible = allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock && !seasonModeActive;
  const MENU_ITEM_COUNT = 7; // 0=Home, 1=Away, 2=1P, 3=2P, 4=CPU, 5=Season, 6=Practice

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
                const idx = MLS_TEAM_OPTIONS.indexOf(prev);
                return MLS_TEAM_OPTIONS[(idx + 1) % MLS_TEAM_OPTIONS.length];
              });
            } else if (fi === 1) {
              setTeamBName(prev => {
                const idx = MLS_TEAM_OPTIONS.indexOf(prev);
                return MLS_TEAM_OPTIONS[(idx + 1) % MLS_TEAM_OPTIONS.length];
              });
            }
            menuGpStickCooldown.current = now + 180;
          } else if (stickX < -0.5 || dpadLeft) {
            if (fi === 0) {
              setTeamAName(prev => {
                const idx = MLS_TEAM_OPTIONS.indexOf(prev);
                return MLS_TEAM_OPTIONS[(idx - 1 + MLS_TEAM_OPTIONS.length) % MLS_TEAM_OPTIONS.length];
              });
            } else if (fi === 1) {
              setTeamBName(prev => {
                const idx = MLS_TEAM_OPTIONS.indexOf(prev);
                return MLS_TEAM_OPTIONS[(idx - 1 + MLS_TEAM_OPTIONS.length) % MLS_TEAM_OPTIONS.length];
              });
            }
            menuGpStickCooldown.current = now + 180;
          }
        }

        // A / Cross (0) → select current item
        if (justPressed(0)) {
          setMenuFocusIndex(fi => {
            if (fi === 2) handleKickOffRef.current('1p');
            else if (fi === 3) handleKickOffRef.current('2p');
            else if (fi === 4) {
              const shuffled = MLS_TEAM_NAMES.slice().sort(() => Math.random() - 0.5);
              handleKickOffRef.current('cpu', { a: shuffled[0], b: shuffled[1] });
            }
            else if (fi === 5) setSeasonModeActiveRef.current(true);
            else if (fi === 6) setShowPracticeSetup(true);
            return fi;
          });
        }

        // Start (9) → quick-start 1P
        if (justPressed(9)) {
          handleKickOffRef.current('1p');
        }

        menuGpPrev.current = btns;
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [startMenuVisible]);

  const hasActiveMatchSessionRef = useRef(false);
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
    const interval = setInterval(() => {
      if (gameRef.current) {
        const currentIsLive = gameRef.current.getIsLive();
        const snapshot = gameRef.current.getMatchSnapshot?.() || null;

        if (snapshot?.phase === 'FULL_TIME' && !smokeTestActiveRef.current) {
          setIsFullTime(true);
          setHasActiveMatchSession(true);
          setAllowMainMenu(false);
          setSessionMenuLock(true);
          const ftScore = {
            scoreA: snapshot.scoreA,
            scoreB: snapshot.scoreB,
            teamA: snapshot.teamAName || teamAName,
            teamB: snapshot.teamBName || teamBName,
            shotsA: snapshot.shotsA,
            shotsB: snapshot.shotsB,
            sogA: snapshot.shotsOnTargetA,
            sogB: snapshot.shotsOnTargetB,
            savesA: snapshot.savesA,
            savesB: snapshot.savesB,
            headersA: snapshot.headersA,
            headersB: snapshot.headersB,
            goals: snapshot.goalLog || [],
            colorA: getTeamColor(snapshot.teamAName || teamAName),
            colorB: getTeamColor(snapshot.teamBName || teamBName),
          };
          setFullTimeScore(ftScore);
          try { sessionStorage.setItem('psl_fullTime', '1'); sessionStorage.setItem('psl_fullTimeScore', JSON.stringify(ftScore)); } catch {}
          gameRef.current?.setMenuVisible?.(false);
          gameRef.current?.setScoreBugVisible?.(false);
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
              setIsFullTime(true);
              const ftScore2 = {
                scoreA: snapshot.scoreA,
                scoreB: snapshot.scoreB,
                teamA: snapshot.teamAName || teamAName,
                teamB: snapshot.teamBName || teamBName,
                shotsA: snapshot.shotsA,
                shotsB: snapshot.shotsB,
                sogA: snapshot.shotsOnTargetA,
                sogB: snapshot.shotsOnTargetB,
                savesA: snapshot.savesA,
                savesB: snapshot.savesB,
                headersA: snapshot.headersA,
                headersB: snapshot.headersB,
                goals: snapshot.goalLog || [],
                colorA: getTeamColor(snapshot.teamAName || teamAName),
                colorB: getTeamColor(snapshot.teamBName || teamBName),
              };
              setFullTimeScore(ftScore2);
              try { sessionStorage.setItem('psl_fullTime', '1'); sessionStorage.setItem('psl_fullTimeScore', JSON.stringify(ftScore2)); } catch {}
              gameRef.current?.setMenuVisible?.(false);
              gameRef.current?.setScoreBugVisible?.(false);
              mirrorMatchSummary();
                // AUTOMATION: Seed baselines and auto-apply recommendations
                import('../telemetry/mls2025-baselines').then(m =>
                  m.seedMLS2025Baselines && m.seedMLS2025Baselines()
                ).then(() =>
                  generateDriftRecommendations({ thresholdPct: 10 })
                );
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
          setSelectedPlayer(gameRef.current.getSelectedPlayerStats());
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
          setSelectedDefensePlayer(gameRef.current.getSelectedDefensePlayerStats());
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

  // ── Dashboard telemetry bridge (separate effect, always mounts) ──
  useEffect(() => {
    let dashChannel: BroadcastChannel | null = null;
    try { dashChannel = new BroadcastChannel('psl-telemetry'); } catch {}
    console.log('[PSL] Dashboard bridge useEffect MOUNTED');
    let prevPhase = '';
    let _dashTick = 0;
    const dashInterval = setInterval(() => {
      _dashTick++;
      // Skip broadcasting during splash/menu — only track real matches
      if (!hasActiveMatchSessionRef.current) {
        if (_dashTick % 10 === 0) console.log('[PSL-Bridge] skip: no active match session');
        return;
      }
      const g = (window as any).__gameRef;
      if (!g) {
        if (_dashTick % 10 === 0) console.log('[PSL-Bridge] skip: __gameRef not set');
        return;
      }

      const snap2 = g.getMatchSnapshot?.();
      // Engine-level guard: splash-scene demos have sessionActive=false. Skip them
      // even if React's hasActiveMatchSession ref is stale (e.g. after HMR remount).
      if (snap2?.sessionActive === false) {
        if (_dashTick % 10 === 0) console.log('[PSL-Bridge] skip: splash-scene demo (sessionActive=false)');
        return;
      }
      const phase = snap2?.phase || '';
      const isPhaseChange = phase !== prevPhase;

      const bundle = g.getTuningBundle?.();
      if (!bundle) {
        if (_dashTick % 10 === 0) console.log('[PSL-Bridge] skip: getTuningBundle returned null, phase=', phase);
        return;
      }
      const live2 = g.getLiveTelemetry?.();
      const payload = { type: 'tuning', bundle, snapshot: snap2, live: live2, ts: Date.now(), sessionActive: true };

      // Live in-memory channels: send every tick (2s) so dashboard gets data quickly
      if (_dashTick % 5 === 0) {
        console.log('[PSL-Bridge] posting tick=' + _dashTick + ' phase=' + phase + ' isLive=' + snap2?.isLive + ' score=' + bundle.teamA?.score + '-' + bundle.teamB?.score);
      }
      try { dashChannel?.postMessage(payload); } catch (e) { console.warn('[PSL-Bridge] BroadcastChannel post failed:', e); }
      try { (window as any).sendDashboardUpdate?.('tuning', bundle, snap2); } catch (e) {}

      // Expensive disk/network ops: rate-limit to once every 20s or on phase change
      const shouldSync = _dashTick % 10 === 0 || isPhaseChange;
      if (!shouldSync) return;

      if (isPhaseChange) {
        console.log(`[Dashboard] Phase changed to: ${phase}, Score: ${bundle.teamA.score} - ${bundle.teamB.score}`);
        try { localStorage.setItem('psl-tuning', JSON.stringify(payload)); } catch (e) {
          try { localStorage.removeItem('psl-tuning-history'); localStorage.setItem('psl-tuning', JSON.stringify(payload)); } catch {}
        }
      }

      // Server relay: reduce frequency via fetch
      try { fetch('/__tuning/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {}); } catch {}
      
      // Auto-save when match reaches FULL_TIME
      // Skip splash-scene demos (sessionActive=false when splashSceneMode is on) — those are ghost matches.
      if (phase === 'FULL_TIME' && prevPhase !== 'FULL_TIME' && snap2?.sessionActive !== false) {
        // Save to SQLite via server endpoint
        try {
          const a = bundle.teamA, b = bundle.teamB;
          const matchId = snap2?.matchId || null;
          if (matchId && !(bundle as any).matchId) (bundle as any).matchId = matchId;
          fetch('/__db/match-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: snap2?.sessionId || `ft-${Date.now()}`,
              timestamp: Date.now(),
              team_a_name: a?.name || '',
              team_b_name: b?.name || '',
              team_a_formation: a?.formation || '',
              team_b_formation: b?.formation || '',
              score_a: a?.score ?? 0,
              score_b: b?.score ?? 0,
              shots_a: a?.shots ?? 0,
              shots_b: b?.shots ?? 0,
              shots_on_target_a: a?.shotsOnTarget ?? 0,
              shots_on_target_b: b?.shotsOnTarget ?? 0,
              saves_a: a?.saves ?? 0,
              saves_b: b?.saves ?? 0,
              headers_a: 0,
              headers_b: 0,
              possession_a: a?.possession ?? 50,
              phase: 'FULL_TIME',
              half: 2,
              elapsed_in_half: snap2?.elapsedInHalf ?? 300,
              bundle_json: JSON.stringify(bundle),
            }),
          }).then(r => {
            if (r.ok) console.log(`[PSL] Match saved ${matchId || '(no id)'}: ${a?.name} ${a?.score}-${b?.score} ${b?.name}`);
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
            bundle,
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
      try { dashChannel?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = initGame(containerRef.current);
      (window as any).pslGame = gameRef.current;
      const kitA = (MLS_TEAM_KITS[teamAName] ?? MLS_TEAM_KITS['Inter Miami'])[teamAKit];
      const kitB = (MLS_TEAM_KITS[teamBName] ?? MLS_TEAM_KITS['Inter Miami'])[teamBKit];
      gameRef.current?.setTeamFormations?.(teamAFormation, teamBFormation);
      gameRef.current?.setTeamNames?.(teamAName, teamBName);
      gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[teamAName] ?? '', MLS_TEAM_LOGOS[teamBName] ?? '');
      gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
      gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
      gameRef.current?.setWeather?.(weather);
      gameRef.current?.setAIStyle?.(aiStyle);
      gameRef.current?.setCPUShotTuning?.(cpuShotAimErrorRad, cpuShotPressureError);
      gameRef.current?.setCameraMode?.(cameraMode);
      gameRef.current?.setStadiumCamTiltShift?.(stadiumCamTiltShiftEnabled);
      gameRef.current?.setMenuVisible?.(gameMode === null);
      gameRef.current?.setShowAIStateOverlay?.(showAIStateOverlay);
      gameRef.current?.setShowPositionLabels?.(showPositionLabels);
      gameRef.current?.setTestingMode?.(false);
      gameRef.current?.setHotSeatMode?.(false);
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
          telemetryRecorderRef.current?.stop();
        } else if (!telemetryRecorderRef.current?.isRecording()) {
          const rec = new TelemetryRecorder();
          rec.setContext({ teamAName, teamBName, teamAFormation, teamBFormation });
          rec.start(() => gameRef.current, 500);
          telemetryRecorderRef.current = rec;
        }
      };

      gameRef.current?.setOnReset?.(() => {
        // Always clear full-time overlay and UI latches
        setIsLive(false);
        setIsFullTime(false);
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
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOptionsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    const kitA = (MLS_TEAM_KITS[teamAName] ?? MLS_TEAM_KITS['Inter Miami'])[teamAKit];
    const kitB = (MLS_TEAM_KITS[teamBName] ?? MLS_TEAM_KITS['Inter Miami'])[teamBKit];
    gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
    gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
  }, [teamAName, teamBName, teamAKit, teamBKit]);

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

  const handleCameraChange = (mode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE' | 'GOAL_THREE_QUARTER' | 'STADIUM_CAM') => {
    setCameraMode(mode);
    gameRef.current?.setCameraMode(mode);
  };

  const handleStadiumCamTiltShiftToggle = (enabled: boolean) => {
    setStadiumCamTiltShiftEnabled(enabled);
    gameRef.current?.setStadiumCamTiltShift?.(enabled);
  };

  const handleUniformChange = (team: 'A' | 'B', index: number) => {
    if (team === 'A') setTeamAUniform(index);
    else setTeamBUniform(index);
    gameRef.current?.setUniform(team, index);
  };

  const handleKickOff = (mode: '1p' | '2p' | 'cpu' | 'test' | 'practice', overrideTeams?: { a: string; b: string }) => {
    const isHotSeat = mode === '2p';
    const isCpu = mode === 'cpu';
    const isTesting = mode === 'test';
    const isPractice = mode === 'practice';
    const nextTeamAName = overrideTeams?.a ?? teamAName;
    const nextTeamBName = overrideTeams?.b ?? teamBName;
    if (overrideTeams) {
      setTeamAName(overrideTeams.a);
      setTeamBName(overrideTeams.b);
    }

    const kitA = (MLS_TEAM_KITS[nextTeamAName] ?? MLS_TEAM_KITS['Inter Miami'])[teamAKit];
    const kitB = (MLS_TEAM_KITS[nextTeamBName] ?? MLS_TEAM_KITS['Inter Miami'])[teamBKit];
    gameRef.current?.setTeamNames?.(nextTeamAName, nextTeamBName);
    gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[nextTeamAName] ?? '', MLS_TEAM_LOGOS[nextTeamBName] ?? '');
    gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
    gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);

    const shouldShowAIOverlay = isCpu || isTesting;
    setGameMode(mode);
    setHasActiveMatchSession(true);
    setAllowMainMenu(false);
    setSessionMenuLock(true);
    setHotSeatMode(isHotSeat || isTesting);
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
        teamAFormation,
        teamBFormation,
        notes: 'Fresh session at kickoff',
      });
      await recorder.start(() => gameRef.current, 500);
      telemetryRecorderRef.current = recorder;

      await recorder.recordEvent('mode_selected', {
        mode,
        cpuVsCpu: isCpu,
        testingMode: isTesting,
        hotSeatMode: isHotSeat || isTesting,
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
    gameRef.current?.setHotSeatMode?.(isHotSeat || isTesting);
    gameRef.current?.setTestingMode?.(isTesting);
    gameRef.current?.setCpuVsCpu?.(isCpu);
    gameRef.current?.setPracticeMode?.(isPractice);
    if (isPractice) {
      gameRef.current?.setTestingMode?.(true);
      gameRef.current?.setHotSeatMode?.(true);
    }
    gameRef.current?.splashMusicStop?.();
    gameRef.current?.setMenuVisible?.(false);
    gameRef.current?.startKickoffPresentation?.(true);
    setIsFullTime(false);
    setFullTimeScore(null);
    try { sessionStorage.removeItem('psl_fullTime'); sessionStorage.removeItem('psl_fullTimeScore'); } catch {}
  };

  const handlePreMatchSetupStart = () => {
    setShowPreMatchSetup(false);
    // Apply aggressiveness presets to the CPU shot tuning
    const aggressASet = PRACTICE_AGGRESSIVENESS[teamAAggressiveness];
    const aggressBSet = PRACTICE_AGGRESSIVENESS[teamBAggressiveness];
    gameRef.current?.setCPUShotTuning?.(aggressASet.aimErrorRad, aggressASet.pressureError);
    gameRef.current?.setHalfDurationSeconds?.(halfLengthMinutes * 60);
    // Start the match with CPU vs CPU mode
    handleKickOff('cpu', { a: teamAName, b: teamBName });
  };

  const handleRunWatchedFixture = async () => {
    if (watchedFixtureRunning) return;
    const runner = (window as any).pslSmokeTest?.runFixture;
    if (typeof runner !== 'function') {
      setWatchedFixtureMessage('Fixture runner unavailable. Reload the page.');
      return;
    }

    setShowPreMatchSetup(false);
    setWatchedFixtureRunning(true);
    setWatchedFixtureMessage(`Watching ${teamAName} vs ${teamBName}`);

    const aggressASet = PRACTICE_AGGRESSIVENESS[teamAAggressiveness];
    const aggressBSet = PRACTICE_AGGRESSIVENESS[teamBAggressiveness];
    gameRef.current?.setCPUShotTuning?.(aggressASet.aimErrorRad, aggressASet.pressureError);
    gameRef.current?.setHalfDurationSeconds?.(halfLengthMinutes * 60);
    setGameMode('cpu');
    setHasActiveMatchSession(true);
    setAllowMainMenu(false);
    setSessionMenuLock(true);
    setHotSeatMode(false);
    setTestingMode(false);
    gameRef.current?.setHotSeatMode?.(false);
    gameRef.current?.setTestingMode?.(false);
    gameRef.current?.setCpuVsCpu?.(true);
    gameRef.current?.setPracticeMode?.(false);
    gameRef.current?.splashMusicStop?.();
    gameRef.current?.setMenuVisible?.(false);
    setIsFullTime(false);
    setFullTimeScore(null);
    try {
      sessionStorage.removeItem('psl_fullTime');
      sessionStorage.removeItem('psl_fullTimeScore');
    } catch {}

    try {
      const result = await runner({
        homeTeam: teamAName,
        awayTeam: teamBName,
        formationA: teamAFormation,
        formationB: teamBFormation,
        halfSeconds: halfLengthMinutes * 60,
        speedMul: 1,
        timeoutMs: Math.max(420000, halfLengthMinutes * 120000),
      });

      if (!result) {
        setWatchedFixtureMessage('Fixture run did not start.');
      } else if (result.timedOut) {
        setWatchedFixtureMessage(`Timed out at ${result.phase} ${result.elapsedInHalf?.toFixed?.(1) ?? '0.0'}s`);
      } else {
        setWatchedFixtureMessage(`Final ${result.teamA} ${result.scoreA}-${result.scoreB} ${result.teamB}`);
      }
    } catch (error) {
      setWatchedFixtureMessage(`Fixture failed: ${String(error)}`);
    } finally {
      setWatchedFixtureRunning(false);
    }
  };

  const handlePreMatchSetupRandomize = () => {
    const shuffled = MLS_TEAM_NAMES.slice().sort(() => Math.random() - 0.5);
    setTeamAName(shuffled[0]);
    setTeamBName(shuffled[1]);
    setTeamAFormation(SOCCER_FORMATION_OPTIONS[Math.floor(Math.random() * SOCCER_FORMATION_OPTIONS.length)]);
    setTeamBFormation(SOCCER_FORMATION_OPTIONS[Math.floor(Math.random() * SOCCER_FORMATION_OPTIONS.length)]);
    setTeamAAggressiveness(Object.keys(PRACTICE_AGGRESSIVENESS)[Math.floor(Math.random() * 3)] as AggressivenessKey);
    setTeamBAggressiveness(Object.keys(PRACTICE_AGGRESSIVENESS)[Math.floor(Math.random() * 3)] as AggressivenessKey);
    setTeamAUniform(Math.floor(Math.random() * 2)); // 0=home, 1=away
  };

  // Keep gamepad menu refs in sync
  handleKickOffRef.current = handleKickOff;
  setSeasonModeActiveRef.current = setSeasonModeActive;

  useEffect(() => {
    gameRef.current?.setMenuVisible?.(allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock && !showSplash);
  }, [allowMainMenu, hasActiveMatchSession, isFullTime, sessionMenuLock, showSplash]);

  useEffect(() => {
    if (!gameRef.current) return;

    const nextTeamAName = teamAName;
    const nextTeamBName = teamBName;
    const kitA = (MLS_TEAM_KITS[nextTeamAName] ?? MLS_TEAM_KITS['Inter Miami'])[teamAKit];
    const kitB = (MLS_TEAM_KITS[nextTeamBName] ?? MLS_TEAM_KITS['Inter Miami'])[teamBKit];

    if (showSplash) {
      gameRef.current?.setTeamNames?.(nextTeamAName, nextTeamBName);
      gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[nextTeamAName] ?? '', MLS_TEAM_LOGOS[nextTeamBName] ?? '');
      gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
      gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
      gameRef.current?.setTeamFormations?.(teamAFormation, teamBFormation);
      gameRef.current?.setHotSeatMode?.(false);
      gameRef.current?.setTestingMode?.(false);
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

  // Poll ISOLATED_FORWARD_PASS events during CPU vs CPU
  useEffect(() => {
    if (gameMode !== 'cpu' || !hasActiveMatchSession) return;
    // Reset for this game session — clear both React state and window arrays
    (window as any).ISOLATED_FORWARD_PASS_EVENTS = [];
    (window as any).ISOLATED_FORWARD_PASS_RESOLVED_EVENTS = [];
    (window as any)._ISOLATED_FORWARD_PASS_TOTAL = 0;
    ifpSeenCountRef.current = 0;
    setIfpEvents([]);
    setLatestIfpFlash(null);
    const id = window.setInterval(() => {
      const resolved: any[] = (window as any).ISOLATED_FORWARD_PASS_RESOLVED_EVENTS ?? [];
      const pending: any[] = (window as any).ISOLATED_FORWARD_PASS_EVENTS ?? [];
      // Flash on newly resolved events
      if (resolved.length > ifpSeenCountRef.current) {
        const latest = resolved[resolved.length - 1];
        if (latest) {
          if (latestIfpFlashTimerRef.current) clearTimeout(latestIfpFlashTimerRef.current);
          setLatestIfpFlash({ ...latest });
          latestIfpFlashTimerRef.current = setTimeout(() => setLatestIfpFlash(null), 3500);
        }
        ifpSeenCountRef.current = resolved.length;
      }
      // Log shows resolved + any still-pending (newest first, max 8)
      const all = [
        ...resolved.map(e => ({ ...e })),
        ...pending.filter(e => e.outcome === 'PENDING').map(e => ({ ...e })),
      ];
      setIfpEvents(all.slice(-8).reverse());
    }, 300);
    return () => {
      window.clearInterval(id);
      if (latestIfpFlashTimerRef.current) clearTimeout(latestIfpFlashTimerRef.current);
    };
  }, [gameMode, hasActiveMatchSession]);

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
                src="/assets/pixel-soccer-league.webp"
                alt="Pixel Soccer League"
                className="w-80 drop-shadow-[0_4px_20px_rgba(34,197,94,0.3)]"
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
      {!showSplash && allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock && !showPracticeSetup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
            {/* Title */}
            <div className="flex flex-col items-center">
              <img
                src="/assets/pixel-soccer-league.webp"
                alt="Pixel Soccer League"
                className="w-72 drop-shadow-lg"
              />
            </div>

            {/* Team selectors */}
            <div className="w-full flex flex-col gap-3">
              <div className={`flex items-center gap-3 rounded px-1 py-0.5 transition-all ${menuFocusIndex === 0 ? 'ring-2 ring-white/60' : ''}`}>
                <span className="text-white/40 text-[10px] uppercase w-16 shrink-0">Home</span>
                <select
                  value={teamAName}
                  onChange={(e) => setTeamAName(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/20 text-white text-[10px] rounded px-2 py-1.5 focus:outline-none focus:border-white/50"
                >
                  {MLS_TEAM_OPTIONS.map((team) => (
                    <option key={`ms-a-${team}`} value={team}>{team}</option>
                  ))}
                </select>
                {menuFocusIndex === 0 && <span className="text-white/30 text-[8px]">◀ ▶</span>}
              </div>
              <div className={`flex items-center gap-3 rounded px-1 py-0.5 transition-all ${menuFocusIndex === 1 ? 'ring-2 ring-white/60' : ''}`}>
                <span className="text-white/40 text-[10px] uppercase w-16 shrink-0">Away</span>
                <select
                  value={teamBName}
                  onChange={(e) => setTeamBName(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/20 text-white text-[10px] rounded px-2 py-1.5 focus:outline-none focus:border-white/50"
                >
                  {MLS_TEAM_OPTIONS.map((team) => (
                    <option key={`ms-b-${team}`} value={team}>{team}</option>
                  ))}
                </select>
                {menuFocusIndex === 1 && <span className="text-white/30 text-[8px]">◀ ▶</span>}
              </div>
            </div>

            {/* Mode buttons */}
            <div className="w-full flex flex-col gap-3">
              <p className="text-white/30 text-[9px] uppercase tracking-widest text-center">Select Mode</p>
              <button
                onClick={() => handleKickOff('1p')}
                className={`w-full py-3 border text-xs uppercase tracking-widest rounded transition-colors ${
                  menuFocusIndex === 2 ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:bg-white hover:text-black'
                }`}
              >
                1 Player vs CPU
              </button>
              <button
                onClick={() => handleKickOff('2p')}
                className={`w-full py-3 border text-xs uppercase tracking-widest rounded transition-colors ${
                  menuFocusIndex === 3 ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:bg-white hover:text-black'
                }`}
              >
                2 Players — Hot Seat
              </button>
              <button
                onClick={() => {
                  const shuffled = MLS_TEAM_NAMES.slice().sort(() => Math.random() - 0.5);
                  setTeamAName(shuffled[0]);
                  setTeamBName(shuffled[1]);
                  setShowPreMatchSetup(true);
                }}
                className={`w-full py-3 border text-xs uppercase tracking-widest rounded transition-colors ${
                  menuFocusIndex === 4 ? 'bg-white/80 text-black border-white' : 'border-white/20 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                CPU vs CPU
              </button>
              <div className="border-t border-white/10 pt-3 flex flex-col gap-3">
                <button
                  onClick={() => setSeasonModeActive(true)}
                  className={`w-full py-3 border text-xs uppercase tracking-widest rounded transition-colors ${
                    menuFocusIndex === 5 ? 'bg-amber-500/40 text-amber-200 border-amber-400' : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300'
                  }`}
                >
                  Season Mode
                </button>
                <button
                  onClick={() => setShowPracticeSetup(true)}
                  className={`w-full py-3 border text-xs uppercase tracking-widest rounded transition-colors ${
                    menuFocusIndex === 6 ? 'bg-emerald-500/40 text-emerald-200 border-emerald-400' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300'
                  }`}
                >
                  Practice
                </button>
              </div>
            </div>

            <p className="text-white/20 text-[9px] uppercase tracking-widest">Press [ESC] in-game for options</p>
          </div>
        </div>

      )}

      {/* Season Hub Overlay */}
      {seasonModeActive && !hasActiveMatchSession && !isFullTime && (
        <SeasonHub
          onPlayMatch={(home, away) => {
            // Set up teams for the season match
            setTeamAName(home);
            setTeamBName(away);
            seasonReturnRef.current = true;
            // Brief timeout to let team name state propagate before kickoff
            setTimeout(() => {
              const kitA = (MLS_TEAM_KITS[home] ?? MLS_TEAM_KITS['Inter Miami'])[teamAKit];
              const kitB = (MLS_TEAM_KITS[away] ?? MLS_TEAM_KITS['Inter Miami'])[teamBKit];
              gameRef.current?.setTeamNames?.(home, away);
              gameRef.current?.setTeamLogos?.(MLS_TEAM_LOGOS[home] ?? '', MLS_TEAM_LOGOS[away] ?? '');
              gameRef.current?.setTeamColors?.('A', kitA.shirt, kitA.pants);
              gameRef.current?.setTeamColors?.('B', kitB.shirt, kitB.pants);
              setGameMode('1p');
              setHasActiveMatchSession(true);
              setAllowMainMenu(false);
              setSessionMenuLock(true);
              gameRef.current?.setHotSeatMode?.(false);
              gameRef.current?.setTestingMode?.(false);
              gameRef.current?.setCpuVsCpu?.(false);
              gameRef.current?.splashMusicStop?.();
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
              <label className="text-white/40 text-[9px] uppercase tracking-widest">Team</label>
              <select
                value={teamAName}
                onChange={(e) => setTeamAName(e.target.value)}
                className="bg-zinc-800 border border-white/20 text-white text-xs rounded px-2 py-2 focus:outline-none focus:border-emerald-400"
              >
                {MLS_TEAM_OPTIONS.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>

            {/* Human / CPU toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-white/40 text-[9px] uppercase tracking-widest">Controlled By</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPracticeIsHuman(true)}
                  className={`flex-1 py-2 border text-xs rounded transition-colors ${practiceIsHuman ? 'bg-emerald-500/40 border-emerald-400 text-emerald-200' : 'border-white/20 text-white/50 hover:bg-white/10'}`}
                >
                  Human
                </button>
                <button
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
                onClick={() => setShowPracticeSetup(false)}
                className="flex-1 py-2 border border-white/20 text-white/50 text-xs rounded hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSelectedPracticePlay(null);
                  setPracticeActive(false);
                  setPracticeFormation('4-4-2'); // default practice start formation
                  setShowPracticeSetup(false);
                  handleKickOff('practice');
                  // Do not automatically apply a play at startup (per user request).
                  // The practice should start in a standard kickoff formation at the center circle.
                  setTimeout(() => {
                    if (!practiceIsHuman) gameRef.current?.setCpuVsCpu?.(true);
                    setShowPositionLabels(true);
                    gameRef.current?.setShowPositionLabels?.(true);
                    // play is only active once selected from the in-game play selector
                  }, 600);
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

      {/* Isolated Forward Pass Overlay — CPU vs CPU only */}
      {gameMode === 'cpu' && hasActiveMatchSession && (
        <div className="absolute top-16 left-4 z-40 pointer-events-none flex flex-col gap-1.5 w-60">
          {/* Always-visible header */}
          <div className="bg-black/70 border border-orange-500/40 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-orange-300 text-[9px] font-bold uppercase tracking-widest">Isolated Fwd Pass</span>
              <span className="text-orange-200 text-[9px] tabular-nums">
                {(window as any)._ISOLATED_FORWARD_PASS_TOTAL ?? 0} total
              </span>
            </div>
            {ifpEvents.length === 0 && (
              <div className="text-white/30 text-[8px] mt-1">Listening for events…</div>
            )}
          </div>

          {/* Flash badge for latest resolved event */}
          {latestIfpFlash && (() => {
            const outcomeColor =
              latestIfpFlash.outcome === 'INTERCEPTED' ? 'bg-red-600/90 border-red-400'
              : latestIfpFlash.outcome === 'SELF_CAUGHT' ? 'bg-amber-500/90 border-amber-300'
              : 'bg-emerald-600/90 border-emerald-400';
            return (
              <div className={`px-3 py-2 ${outcomeColor} border text-white text-[10px] font-bold rounded-lg shadow-xl animate-pulse`}>
                <div>{latestIfpFlash.carrierName} ({latestIfpFlash.carrierRole})</div>
                <div className="opacity-80 text-[9px]">→ {latestIfpFlash.passTargetName}</div>
                <div className="mt-1 text-[9px] font-normal opacity-90">
                  {latestIfpFlash.outcome}
                  {latestIfpFlash.shotPossible ? ' · shot was on' : ' · no shot geom'}
                  {' · '}P={latestIfpFlash.closePressure}
                </div>
              </div>
            );
          })()}

          {/* Log of last 8 events */}
          {ifpEvents.length > 0 && (
            <div className="bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 flex flex-col gap-0.5">
              {ifpEvents.map((ev, i) => {
                const dot =
                  ev.outcome === 'INTERCEPTED' ? 'bg-red-400'
                  : ev.outcome === 'SELF_CAUGHT' ? 'bg-amber-400'
                  : ev.outcome === 'COMPLETED' ? 'bg-emerald-400'
                  : 'bg-white/20';
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[9px] text-white/70">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                    <span className="truncate">{ev.carrierName} ({ev.carrierRole})</span>
                    <span className="shrink-0 text-white/40">{ev.outcome ?? '…'}</span>
                  </div>
                );
              })}
            </div>
          )}
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
              <label className="text-white/40 text-[8px] uppercase tracking-widest">Play</label>
              <select
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
                  setSelectedPracticePlay(key);
                  setPracticeActive(true);
                  setPracticeFormation(play.formation);
                  setShowPositionLabels(true);
                  gameRef.current?.setShowPositionLabels?.(true);
                  // Ensure players are in their formation positions before calculating routes
                  gameRef.current?.setTeamFormations?.(play.formation, play.formation);
                  const players = gameRef.current?.getPlayers?.() || [];
                  const sortedPlayers = [...players].sort((a, b) => (a.id || 0) - (b.id || 0));
                  const atkSign = gameRef.current?.getTeamAAttackSign?.() ?? 1;
                  const routes = getPlayRoutes(play, sortedPlayers, atkSign);
                  gameRef.current?.drawPracticeRoutes?.(routes);
                  gameRef.current?.activatePracticePlay?.(routes, play.template);
                  // Snap players + ball to starting positions, redraw routes from snapped positions, and auto-start
                  gameRef.current?.resetAndStartPracticePlay?.(() => {
                    const freshPlayers = gameRef.current?.getPlayers?.() || [];
                    const sorted = [...freshPlayers].sort((a: any, b: any) => (a.id || 0) - (b.id || 0));
                    return getPlayRoutes(play, sorted, gameRef.current?.getTeamAAttackSign?.() ?? 1);
                  });
                }}
                className="bg-zinc-800 border border-white/15 text-white text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-emerald-400"
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
              <label className="text-white/40 text-[8px] uppercase tracking-widest">Formation</label>
              <select
                value={practiceFormation}
                onChange={(e) => {
                  const f = e.target.value;
                  setPracticeFormation(f);
                  if (currentPlay) {
                    applyPracticePlay(gameRef, currentPlay, f, practiceAggressiveness);
                  } else {
                    gameRef.current?.setTeamFormations?.(f, f);
                  }
                }}
                className="bg-zinc-800 border border-white/15 text-white text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-emerald-400"
              >
                {['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Aggressiveness selector */}
            <div className="flex flex-col gap-0.5">
              <label className="text-white/40 text-[8px] uppercase tracking-widest">Aggressiveness</label>
              <select
                value={practiceAggressiveness}
                onChange={(e) => {
                  const key = e.target.value as AggressivenessKey;
                  setPracticeAggressiveness(key);
                  const agg = PRACTICE_AGGRESSIVENESS[key] as any;
                  gameRef.current?.setCPUShotTuning?.(agg.aimErrorRad, agg.pressureError);
                }}
                className="bg-zinc-800 border border-white/15 text-white text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-emerald-400"
              >
                {(Object.keys(PRACTICE_AGGRESSIVENESS) as AggressivenessKey[]).map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
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
        return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 px-8 py-10 bg-white rounded-2xl shadow-2xl min-w-[320px]" style={{ border: '5px solid #000' }}>
            <div className="text-amber-500 text-3xl font-extrabold tracking-widest uppercase animate-pulse">Full Time</div>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <span className="text-gray-500 text-[10px] uppercase tracking-widest">{fullTimeScore.teamA}</span>
                <span className="text-gray-900 text-5xl font-black">{fullTimeScore.scoreA}</span>
              </div>
              <span className="text-gray-300 text-2xl font-light">{'-'}</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-gray-500 text-[10px] uppercase tracking-widest">{fullTimeScore.teamB}</span>
                <span className="text-gray-900 text-5xl font-black">{fullTimeScore.scoreB}</span>
              </div>
            </div>
            <div className="text-gray-500 text-xs">
              {fullTimeScore.scoreA > fullTimeScore.scoreB
                ? `${fullTimeScore.teamA} Wins!`
                : fullTimeScore.scoreB > fullTimeScore.scoreA
                ? `${fullTimeScore.teamB} Wins!`
                : 'Draw'}
            </div>
            {(fullTimeScore.shotsA != null || fullTimeScore.shotsB != null) && (
              <div className="w-full border-t border-gray-200 pt-4 flex flex-col gap-2">
                <div className="text-gray-400 text-[9px] uppercase tracking-widest text-center mb-1">Match Stats</div>
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
                      <div key={String(label)} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-700 w-8 text-right tabular-nums">{a}</span>
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden flex" style={{ outline: '1px solid #d1d5db' }}>
                          <div className="h-full rounded-l-full" style={{ width: `${(a / total) * 100}%`, backgroundColor: barColorA }} />
                          <div className="h-full rounded-r-full" style={{ width: `${(b / total) * 100}%`, backgroundColor: barColorB }} />
                        </div>
                        <span className="text-gray-700 w-8 tabular-nums">{b}</span>
                        <span className="text-gray-400 w-16 text-[10px]">{label}</span>
                      </div>
                    );
                  })}
              </div>
            )}
            {fullTimeScore.goals && fullTimeScore.goals.length > 0 && (
              <div className="w-full border-t border-gray-200 pt-4 flex flex-col gap-1">
                <div className="text-gray-400 text-[9px] uppercase tracking-widest text-center mb-2">Goal Scorers</div>
                {fullTimeScore.goals.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="text-gray-400 w-8 text-right tabular-nums">{g.matchMinute}{"'"}</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100" style={{ color: g.team === 'A' ? safeColorA : safeColorB }}>
                      {g.shirtNumber > 0 ? `#${g.shirtNumber} ` : ''}{g.playerName}
                    </span>
                  </div>
                ))}
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
              className="mt-2 w-full py-3 border border-gray-300 text-gray-700 text-xs uppercase tracking-widest rounded hover:bg-gray-900 hover:text-white transition-colors"
            >
              {seasonModeActive ? 'Return to Season' : 'Return to Main Menu'}
            </button>
          </div>
        </div>
        ); })()}

      {/* Options Menu Overlay */}
      {isOptionsOpen && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-3">
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-white/10 shadow-2xl w-[min(1100px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-y-auto flex flex-col gap-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex gap-4">
                <button onClick={() => setActiveTab('OPTIONS')} className={`text-white text-sm ${activeTab === 'OPTIONS' ? 'font-bold' : 'text-white/40'}`}>OPTIONS</button>
                <button onClick={() => setActiveTab('CONTROLS')} className={`text-white text-sm ${activeTab === 'CONTROLS' ? 'font-bold' : 'text-white/40'}`}>CONTROLS</button>
                <button onClick={() => setActiveTab('STATS')} className={`text-white text-sm ${activeTab === 'STATS' ? 'font-bold' : 'text-white/40'}`}>STATS</button>
                <button onClick={() => setActiveTab('MATCH_HISTORY')} className={`text-white text-sm ${activeTab === 'MATCH_HISTORY' ? 'font-bold' : 'text-white/40'}`}>MATCHES</button>
                <button onClick={() => setActiveTab('FRAME_VIEWER')} className={`text-white text-sm ${activeTab === 'FRAME_VIEWER' ? 'font-bold' : 'text-white/40'}`}>ANIMATIONS</button>
                <button onClick={() => setActiveTab('HOW_TO_PLAY')} className={`text-white text-sm ${activeTab === 'HOW_TO_PLAY' ? 'font-bold' : 'text-white/40'}`}>HOW TO PLAY</button>
                <button onClick={() => setActiveTab('LIVE_TELEMETRY')} className={`text-white text-sm ${activeTab === 'LIVE_TELEMETRY' ? 'font-bold' : 'text-white/40'}`}>TELEMETRY</button>
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
                      {(['FOLLOW_BEHIND', 'BROADCAST', 'SIDELINE', 'FIXED_ENDZONE', 'GOAL_THREE_QUARTER', 'STADIUM_CAM'] as const).map((m) => (
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
                    <label className="mt-3 inline-flex items-center gap-2 text-[10px] text-white/70 uppercase tracking-widest cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-white"
                        checked={stadiumCamTiltShiftEnabled}
                        onChange={(event) => handleStadiumCamTiltShiftToggle(event.target.checked)}
                      />
                      Tilt-Shift (Stadium Cam)
                    </label>
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
                  </div>

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
                      <label className="flex items-center gap-2 text-white text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPositionLabels}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setShowPositionLabels(enabled);
                            gameRef.current?.setShowPositionLabels?.(enabled);
                          }}
                          className="accent-white"
                        />
                        Show Position Labels
                      </label>
                      <label className="flex items-center gap-2 text-white text-[10px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAIStateLabels}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setShowAIStateLabels(enabled);
                            gameRef.current?.setShowAIStateLabels?.(enabled);
                          }}
                          className="accent-white"
                        />
                        Show AI State Labels
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">MLS Teams</h3>
                    <div className="flex flex-col gap-2">
                      <label className="text-white/60 text-[9px] uppercase">Home</label>
                      <select
                        value={teamAName}
                        onChange={(e) => setTeamAName(e.target.value)}
                        className="bg-zinc-800 border border-white/20 text-white text-[10px] rounded px-2 py-1"
                      >
                        {MLS_TEAM_OPTIONS.map((team) => (
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
                        {MLS_TEAM_OPTIONS.map((team) => (
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

                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Auto Clearances</h3>
                    <p className="text-white/30 text-[9px] mb-2">When ON, your defenders will automatically clear the ball when under heavy pressure in the defensive third.</p>
                    <label className="inline-flex items-center gap-2 text-[10px] text-white/70 uppercase tracking-widest cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-white"
                        checked={autoClearances}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setAutoClearances(enabled);
                          gameRef.current?.setAutoClearances?.(enabled);
                        }}
                      />
                      Auto Clearances {autoClearances ? 'ON' : 'OFF'}
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Gamepad</h3>
                    <div className="text-white/30 text-[9px] space-y-1 font-mono">
                      <p><span className="text-white/60">Left Stick</span> — Move player</p>
                      <p><span className="text-white/60">A / Cross</span> — Pass (hold to charge) / Switch player</p>
                      <p><span className="text-white/60">B / Circle</span> — Shoot (hold to charge)</p>
                      <p><span className="text-white/60">X / Square</span> — Switch to nearest player</p>
                      <p><span className="text-white/60">Y / Triangle</span> — Chip pass (hold to charge)</p>
                      <p><span className="text-white/60">LB / RB</span> — Cycle player left / right</p>
                      <p><span className="text-white/60">RT</span> — Sprint</p>
                      <p><span className="text-white/60">Start</span> — Pause</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Keyboard (Home)</h3>
                    <div className="text-white/30 text-[9px] space-y-1 font-mono">
                      <p><span className="text-white/60">WASD</span> — Move player</p>
                      <p><span className="text-white/60">Shift</span> — Sprint</p>
                      <p><span className="text-white/60">F</span> — Shoot (hold to charge)</p>
                      <p><span className="text-white/60">G</span> — Pass (hold to charge)</p>
                      <p><span className="text-white/60">Shift+G</span> — Chip pass</p>
                      <p><span className="text-white/60">Q / E</span> — Cycle player</p>
                      <p><span className="text-white/60">Space</span> — Switch to nearest / Confirm restart</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Keyboard (Away)</h3>
                    <div className="text-white/30 text-[9px] space-y-1 font-mono">
                      <p><span className="text-white/60">Arrows</span> — Move player</p>
                      <p><span className="text-white/60">.</span> — Shoot &nbsp; <span className="text-white/60">,</span> — Pass</p>
                      <p><span className="text-white/60">[ / ]</span> — Cycle player</p>
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
            ) : activeTab === 'MATCH_HISTORY' ? (
              <MatchHistoryDashboard />
            ) : activeTab === 'HOW_TO_PLAY' ? (
              <div className="max-w-lg mx-auto flex flex-col gap-6">
                <div>
                  <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">Controls</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                    <div className="text-white/60">WASD / ARROWS</div>
                    <div className="text-white text-right">MOVE PLAYER</div>
                    <div className="text-white/60">H</div>
                    <div className="text-white text-right">KICK OFF / RESTART</div>
                    <div className="text-white/60">SPACEBAR</div>
                    <div className="text-white text-right">PASS / SELECT TARGET</div>
                    <div className="text-white/60">Q / E</div>
                    <div className="text-white text-right">SWITCH HOME PLAYER</div>
                    <div className="text-white/60">[ / ]</div>
                    <div className="text-white text-right">SWITCH AWAY PLAYER</div>
                    <div className="text-white/60">R</div>
                    <div className="text-white text-right">RESET GAME</div>
                    <div className="text-white/60">ESC</div>
                    <div className="text-white text-right">OPTIONS MENU</div>
                  </div>
                </div>
                <div>
                  <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">How to Play</h3>
                  <div className="text-white/70 text-[11px] leading-relaxed space-y-2">
                    <p>You control the <span className="text-white font-bold">highlighted player</span> on your team. Use WASD or arrow keys to move around the pitch.</p>
                    <p>When your team has the ball, press <span className="text-white font-bold">SPACEBAR</span> to pass to a nearby teammate. Run toward the opponent{'\u2019'}s goal and your player will shoot automatically when in range.</p>
                    <p>Use <span className="text-white font-bold">Q / E</span> to cycle through your home-team players and <span className="text-white font-bold">[ / ]</span> to cycle away-team players.</p>
                    <p>Press <span className="text-white font-bold">H</span> to kick off at the start of each half or after a goal.</p>
                    <p>Press <span className="text-white font-bold">R</span> to reset the match at any time.</p>
                  </div>
                </div>
              </div>
            ) : activeTab === 'LIVE_TELEMETRY' ? (
              <LiveTelemetry gameRef={gameRef} />
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                <FrameViewer>
                  <div className="col-span-2">
                    <AnimationInspector embedded />
                  </div>
                </FrameViewer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Press ESC Hint */}
      {!isOptionsOpen && (
        <div className="absolute top-4 left-4 flex flex-col gap-4 pointer-events-none">
          <div className="bg-black/40 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm ml-[0px]">
            <p className="text-white/40 text-[9px] uppercase tracking-widest">Press [ESC] for Options</p>
          </div>
          
          <div className="pointer-events-auto ml-[0px]">
            <TuningLab gameRef={gameRef} />
          </div>
        </div>
      )}

      {/* Bottom-right toggle buttons */}
      {!showSplash && !isOptionsOpen && (
        <div className="absolute bottom-4 right-4 z-40 flex gap-2">
          <button
            onClick={() => {
              const next = !showAIStateOverlay;
              setShowAIStateOverlay(next);
              gameRef.current?.setShowAIStateOverlay?.(next);
            }}
            className="hidden bg-black/60 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-[9px] uppercase tracking-widest px-3 py-1.5 rounded backdrop-blur-sm transition-colors"
          >
            {showAIStateOverlay ? 'Hide AI State' : '🧠 AI State'}
          </button>
          <button
            onClick={() => setShowTelemetry((v) => !v)}
            className="hidden bg-black/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-[9px] uppercase tracking-widest px-3 py-1.5 rounded backdrop-blur-sm transition-colors"
          >
            {showTelemetry ? 'Hide Telemetry' : '⚡ Telemetry'}
          </button>

        </div>
      )}

      {!showSplash && watchedFixtureMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-black/75 border border-emerald-400/40 rounded-lg backdrop-blur-sm">
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
          onTeamAPreMatchKitChange={setTeamAPreMatchKit}
          onTeamBPreMatchKitChange={setTeamBPreMatchKit}
          onRandomize={handlePreMatchSetupRandomize}
          onStartMatch={handlePreMatchSetupStart}
          onRunWatchedFixture={handleRunWatchedFixture}
          watchedFixtureRunning={watchedFixtureRunning}
          watchedFixtureMessage={watchedFixtureMessage}
          onClose={() => setShowPreMatchSetup(false)}
        />
      )}

    </div>
  );
};

/** Pass Log Panel Component - displays recent pass telemetry */

export default RetroFootball;

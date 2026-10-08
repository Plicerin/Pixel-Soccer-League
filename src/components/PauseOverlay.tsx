import React from 'react';

/**
 * Pause screen: the controller reference that used to live in the options
 * panel (lost in the clean-slate rewrite), redrawn as an actual pad diagram
 * and kept in step with the real bindings in gameEngine.updateManualInput /
 * handleGameplayKeyDown. If you change a binding there, change it here.
 */

type PadLabel = { key: string; action: string };

export const FACE_BUTTONS: PadLabel[] = [
  { key: 'A', action: 'Pass (hold to charge)' },
  { key: 'B', action: 'Shoot (hold to charge)' },
  { key: 'X', action: 'Tackle / switch to nearest' },
  { key: 'Y', action: 'Lob / chip (hold to charge)' },
];

export const SHOULDER_BUTTONS: PadLabel[] = [
  { key: 'LB / RB', action: 'Cycle player' },
  { key: 'LT / RT', action: 'Sprint (hold)' },
  { key: 'D-pad', action: 'Call a set-piece routine' },
];

export const KEYBOARD_P1: PadLabel[] = [
  { key: 'W A S D', action: 'Move' },
  { key: 'Left Shift', action: 'Sprint (hold)' },
  { key: 'Space / G', action: 'Pass (hold to charge)' },
  { key: 'C', action: 'Lob / chip (hold to charge)' },
  { key: 'F', action: 'Shoot (hold to charge)' },
  { key: 'R', action: 'Tackle' },
  { key: 'Q / E', action: 'Cycle player' },
  { key: 'V', action: 'Switch to nearest' },
  { key: '1 - 4', action: 'Call a set-piece routine' },
];

export const KEYBOARD_P2: PadLabel[] = [
  { key: 'Arrow keys', action: 'Move' },
  { key: 'Right Shift', action: 'Sprint (hold)' },
  { key: ',', action: 'Pass (hold to charge)' },
  { key: ';', action: 'Lob / chip (hold to charge)' },
  { key: '.', action: 'Shoot (hold to charge)' },
  { key: '/', action: 'Tackle' },
  { key: '[ / ]', action: 'Cycle player' },
  { key: "'", action: 'Switch to nearest' },
  { key: 'Numpad 1 - 4', action: 'Call a set-piece routine' },
];

/** Xbox-style face button colours, used for both the pad and its legend. */
const FACE_COLORS: Record<string, string> = {
  A: '#6ee787',
  B: '#ff7b72',
  X: '#79c0ff',
  Y: '#f2cc60',
};

export const ControllerDiagram: React.FC = () => (
  <svg
    viewBox="0 0 320 200"
    role="img"
    aria-label="Controller button assignments"
    className="w-full max-w-[320px]"
  >
    {/* Shoulder buttons */}
    <rect x="52" y="26" width="52" height="14" rx="7" fill="#2f3540" stroke="#5b6472" />
    <rect x="216" y="26" width="52" height="14" rx="7" fill="#2f3540" stroke="#5b6472" />
    <text x="78" y="36" textAnchor="middle" className="fill-white/70" fontSize="9" fontWeight="700">LB/LT</text>
    <text x="242" y="36" textAnchor="middle" className="fill-white/70" fontSize="9" fontWeight="700">RB/RT</text>

    {/* Body with grips */}
    <path
      d="M96 44 h128 a44 44 0 0 1 40 26 l26 68 a26 26 0 0 1 -44 26 l-32 -30 h-108 l-32 30 a26 26 0 0 1 -44 -26 l26 -68 a44 44 0 0 1 40 -26 z"
      fill="#232830"
      stroke="#5b6472"
      strokeWidth="2"
    />

    {/* Left stick */}
    <circle cx="96" cy="92" r="20" fill="#171b21" stroke="#5b6472" strokeWidth="2" />
    <circle cx="96" cy="92" r="11" fill="#3b424e" stroke="#79828f" />
    <text x="96" y="126" textAnchor="middle" className="fill-white/70" fontSize="9" fontWeight="700">MOVE</text>

    {/* Right stick */}
    <circle cx="188" cy="128" r="16" fill="#171b21" stroke="#5b6472" strokeWidth="2" />
    <circle cx="188" cy="128" r="9" fill="#3b424e" stroke="#79828f" />

    {/* Face buttons: Y top, X left, B right, A bottom */}
    <circle cx="228" cy="70" r="12" fill={FACE_COLORS.Y} />
    <text x="228" y="74" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1b1f26">Y</text>
    <circle cx="206" cy="92" r="12" fill={FACE_COLORS.X} />
    <text x="206" y="96" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1b1f26">X</text>
    <circle cx="250" cy="92" r="12" fill={FACE_COLORS.B} />
    <text x="250" y="96" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1b1f26">B</text>
    <circle cx="228" cy="114" r="12" fill={FACE_COLORS.A} />
    <text x="228" y="118" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1b1f26">A</text>

    {/* D-pad */}
    <path
      d="M128 118 h10 v-10 h12 v10 h10 v12 h-10 v10 h-12 v-10 h-10 z"
      fill="#171b21"
      stroke="#5b6472"
    />
  </svg>
);

export const LabelList: React.FC<{ title: string; rows: PadLabel[]; swatch?: boolean }> = ({ title, rows, swatch }) => (
  <div>
    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">{title}</h3>
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2 text-[11px]">
          {swatch && (
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: FACE_COLORS[row.key] ?? '#5b6472' }}
            />
          )}
          <span className="text-white/50 font-mono">{row.key}</span>
          <span className="ml-auto text-white text-right">{row.action}</span>
        </div>
      ))}
    </div>
  </div>
);

/**
 * The single control reference. The settings CONTROLS tab used to keep its own
 * hand-written copy of these bindings, which drifted: it still advertised
 * Shift+G for the lob and Space for switching players long after those became
 * C and V, and never listed the second player's lob at all. Both surfaces read
 * this now.
 */
export const ControlReference: React.FC = () => (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
    <div className="flex flex-col items-center gap-4">
      <ControllerDiagram />
      <div className="w-full space-y-4">
        <LabelList title="Buttons" rows={FACE_BUTTONS} swatch />
        <LabelList title="Shoulders" rows={SHOULDER_BUTTONS} />
      </div>
    </div>
    <div className="space-y-4">
      <LabelList title="Keyboard — Player 1" rows={KEYBOARD_P1} />
      <LabelList title="Keyboard — Player 2" rows={KEYBOARD_P2} />
    </div>
  </div>
);

const PauseOverlay: React.FC<{ onResume: () => void; onQuitToMenu?: () => void }> = ({ onResume, onQuitToMenu }) => (
  <div
    data-psl-pause-overlay="true"
    className="absolute inset-0 z-[190] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="psl-pause-title"
      className="w-[min(900px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 id="psl-pause-title" className="text-white text-lg font-bold uppercase tracking-[0.2em]">Paused</h2>
        <div className="flex items-center gap-2">
          {onQuitToMenu && (
            <button
              type="button"
              onClick={onQuitToMenu}
              data-psl-quit-to-menu="pause"
              className="rounded-md border border-white/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70 hover:border-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              Quit to Main Menu
            </button>
          )}
          <button
            type="button"
            onClick={onResume}
            data-psl-pause-resume="true"
            className="rounded-md border border-white/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            Resume
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <div className="flex flex-col items-center gap-4">
          <ControllerDiagram />
          <div className="w-full space-y-4">
            <LabelList title="Buttons" rows={FACE_BUTTONS} swatch />
            <LabelList title="Shoulders" rows={SHOULDER_BUTTONS} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <LabelList title="Keyboard — Player 1" rows={KEYBOARD_P1} />
          <LabelList title="Keyboard — Player 2" rows={KEYBOARD_P2} />
        </div>
      </div>

      <p className="mt-5 text-[10px] uppercase tracking-widest text-white/30">
        Press the pause button again to resume · ESC for options
      </p>
    </div>
  </div>
);

export default PauseOverlay;

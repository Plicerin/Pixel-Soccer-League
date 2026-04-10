import React, { useEffect, useRef, useState } from 'react';

interface TeamStats {
  name: string;
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  tackles: number;
  clearances: number;
  fouls: number;
  corners: number;
  throwIns: number;
  gkDistributions: number;
  gkDistCompleted: number;
  possession: number;
}

interface TelemEvent {
  time: number;
  team: 'A' | 'B' | '';
  action: string;
  detail: string;
}

interface LiveTelemetryData {
  teamA: TeamStats;
  teamB: TeamStats;
  carrier: { name: string; team: 'A' | 'B'; role: string; pos: { x: number; z: number } } | null;
  phase: string;
  half: number;
  elapsedInHalf: number;
  halfDuration: number;
  isLive: boolean;
  score: { a: number; b: number };
  eventLog: TelemEvent[];
}

interface Props {
  gameRef: React.RefObject<any>;
}

const STAT_ROWS: { key: keyof TeamStats; label: string }[] = [
  { key: 'possession', label: 'Possession %' },
  { key: 'passes', label: 'Passes (Comp/Att)' },
  { key: 'shots', label: 'Shots' },
  { key: 'shotsOnTarget', label: 'On Target' },
  { key: 'saves', label: 'Saves' },
  { key: 'tackles', label: 'Tackles Won' },
  { key: 'clearances', label: 'Clearances' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'corners', label: 'Corners' },
  { key: 'throwIns', label: 'Throw-Ins' },
  { key: 'gkDistCompleted', label: 'GK Dist (Comp/Att)' },
];

function formatTime(half: number, elapsed: number, halfDuration: number): string {
  const secsPerMin = halfDuration / 45;
  const minute = Math.max(1, Math.ceil(elapsed / secsPerMin));
  const displayMin = half === 1 ? Math.min(minute, 45) : Math.min(minute + 45, 90);
  return `${displayMin}'`;
}

function teamColor(team: 'A' | 'B' | ''): string {
  if (team === 'A') return 'text-cyan-400';
  if (team === 'B') return 'text-red-400';
  return 'text-white/50';
}

function teamBg(team: 'A' | 'B'): string {
  return team === 'A' ? 'border-cyan-500/30 bg-cyan-950/20' : 'border-red-500/30 bg-red-950/20';
}

export default function LiveTelemetry({ gameRef }: Props) {
  const [data, setData] = useState<LiveTelemetryData | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let raf: number;
    let lastUpdate = 0;
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const now = performance.now();
      if (now - lastUpdate < 250) return;
      lastUpdate = now;
      const telem = gameRef.current?.getLiveTelemetry?.();
      if (telem) setData(telem);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.eventLog.length]);

  if (!data) {
    return <div className="text-white/40 text-sm text-center py-8">Waiting for match data…</div>;
  }

  const { teamA, teamB, carrier, eventLog } = data;

  function copyTelemetry() {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`${teamA.name} ${data.score.a} – ${data.score.b} ${teamB.name}`);
    lines.push(`${data.phase.replace('_', ' ')} • ${data.half === 1 ? '1st Half' : '2nd Half'} • ${formatTime(data.half, data.elapsedInHalf, data.halfDuration)}`);
    lines.push('');
    for (const { key, label } of STAT_ROWS) {
      const suffix = key === 'possession' ? '%' : '';
      lines.push(`${String(teamA[key])}${suffix}  ${label}  ${String(teamB[key])}${suffix}`);
    }
    lines.push('');
    lines.push(`Ball Carrier: ${carrier ? `${carrier.name} (${carrier.role}, ${carrier.team === 'A' ? teamA.name : teamB.name})` : 'None'}`);
    lines.push('');
    lines.push('--- Event Log ---');
    for (const ev of eventLog) {
      const t = new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      lines.push(`[${t}] ${ev.team || '-'} ${ev.action}: ${ev.detail}`);
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Copy Button + Score Header */}
      <div className="flex items-center justify-between">
        <div className="w-24" />
        <div className="flex items-center gap-4 text-center">
          <span className="text-cyan-400 font-bold text-sm">{teamA.name}</span>
          <span className="text-white font-mono text-lg font-bold">{data.score.a} – {data.score.b}</span>
          <span className="text-red-400 font-bold text-sm">{teamB.name}</span>
        </div>
        <button
          onClick={copyTelemetry}
          className="w-24 px-2 py-1 text-[9px] uppercase tracking-widest border border-white/20 text-white/60 rounded hover:border-white hover:text-white transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className="text-center text-[10px] text-white/40 uppercase tracking-widest">
        {data.phase.replace('_', ' ')} • {data.half === 1 ? '1st Half' : '2nd Half'} • {formatTime(data.half, data.elapsedInHalf, data.halfDuration)}
        {data.isLive ? '' : ' • PAUSED'}
      </div>

      {/* Stat Comparison Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-cyan-400 text-right py-1.5 px-3 font-medium w-[30%]">{teamA.name}</th>
              <th className="text-white/50 text-center py-1.5 px-2 font-medium w-[40%]"></th>
              <th className="text-red-400 text-left py-1.5 px-3 font-medium w-[30%]">{teamB.name}</th>
            </tr>
          </thead>
          <tbody>
            {STAT_ROWS.map(({ key, label }) => {
              const valA = teamA[key];
              const valB = teamB[key];
              const suffix = key === 'possession' ? '%' : '';
              const isGkDist = key === 'gkDistCompleted';
              const isPasses = key === 'passes';
              const displayA = isGkDist ? `${teamA.gkDistCompleted}/${teamA.gkDistributions}` : isPasses ? `${teamA.passesCompleted}/${teamA.passes}` : `${valA}${suffix}`;
              const displayB = isGkDist ? `${teamB.gkDistCompleted}/${teamB.gkDistributions}` : isPasses ? `${teamB.passesCompleted}/${teamB.passes}` : `${valB}${suffix}`;
              return (
                <tr key={key} className="border-b border-white/5 last:border-0">
                  <td className="text-right py-1 px-3 tabular-nums text-white font-medium">
                    {displayA}
                  </td>
                  <td className="text-center py-1 px-2 text-white/40">{label}</td>
                  <td className="text-left py-1 px-3 tabular-nums text-white font-medium">
                    {displayB}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Possession Bar */}
      <div className="flex items-center gap-2">
        <span className="text-cyan-400 text-[10px] font-bold w-8 text-right">{teamA.possession}%</span>
        <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/10 flex">
          <div className="bg-cyan-500 transition-all duration-500" style={{ width: `${teamA.possession}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${teamB.possession}%` }} />
        </div>
        <span className="text-red-400 text-[10px] font-bold w-8">{teamB.possession}%</span>
      </div>

      {/* Ball Carrier Panel */}
      <div className={`border rounded-lg p-3 ${carrier ? teamBg(carrier.team) : 'border-white/10 bg-white/5'}`}>
        <div className="text-[9px] text-white/50 uppercase tracking-widest mb-1">Ball Carrier</div>
        {carrier ? (
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-bold ${carrier.team === 'A' ? 'text-cyan-300' : 'text-red-300'}`}>
                {carrier.name}
              </div>
              <div className="text-[10px] text-white/50">
                {carrier.role} • {carrier.team === 'A' ? teamA.name : teamB.name}
              </div>
            </div>
            <div className="text-[9px] text-white/35 tabular-nums">
              x:{carrier.pos.x.toFixed(1)} z:{carrier.pos.z.toFixed(1)}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-white/30">No carrier — ball is loose</div>
        )}
      </div>

      {/* Event Log */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 border-b border-white/10 bg-white/5">
          <span className="text-[9px] text-white/50 uppercase tracking-widest">Event Log</span>
          <span className="text-[9px] text-white/30 ml-2">({eventLog.length})</span>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {eventLog.length === 0 ? (
            <div className="text-[10px] text-white/30 px-3 py-2">No events yet</div>
          ) : (
            eventLog.slice().reverse().map((ev, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-1 border-b border-white/5 last:border-0 text-[10px]">
                <span className="text-white/25 shrink-0 tabular-nums w-14">
                  {new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`shrink-0 font-bold uppercase w-16 ${teamColor(ev.team)}`}>
                  {ev.action}
                </span>
                <span className="text-white/60 min-w-0 break-words">{ev.detail}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

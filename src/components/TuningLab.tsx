import React, { useEffect, useState } from 'react';
import { PRACTICE_PLAYS, getPlayRoutes } from '../practicePlays';

interface Props {
  gameRef: React.RefObject<any>;
}

export default function TuningLab({ gameRef }: Props) {
  const [weights, setWeights] = useState({
    tuningProgressWeight: 0.8,
    tuningLanePenalty: 0.15,
    tuningSpaceWeight: 0.05,
    tuningShortPassBias: 0.05,
    tuningRepCount: 0,
    practiceStats: {
      totalReps: 0,
      goals: 0,
      completions: 0,
      totalPasses: 0,
      turnovers: 0,
      progressivePasses: 0,
      boxEntries: 0,
      lastRepSummary: ""
    }
  });

  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!gameRef.current) return;
      const state = gameRef.current.getGameState?.() || {};
      setWeights({
        tuningProgressWeight: state.tuningProgressWeight ?? 0.8,
        tuningLanePenalty: state.tuningLanePenalty ?? 0.15,
        tuningSpaceWeight: state.tuningSpaceWeight ?? 0.05,
        tuningShortPassBias: state.tuningShortPassBias ?? 0.05,
        tuningRepCount: state._practiceRepCount ?? 0,
        practiceStats: state.practiceStats ?? {
          totalReps: 0,
          goals: 0,
          completions: 0,
          totalPasses: 0,
          turnovers: 0,
          progressivePasses: 0,
          boxEntries: 0,
          lastRepSummary: ""
        }
      });
      setIsRunning(state.practiceModeEnabled);
    }, 500);
    return () => clearInterval(timer);
  }, [gameRef]);

  const updateWeight = (key: string, val: number) => {
    if (!gameRef.current) return;
    gameRef.current.updateGameState({ [key]: val });
    setWeights(prev => ({ ...prev, [key]: val }));
  };

  if (!isRunning) return null;

  return (
    <div className="bg-black/80 border border-yellow-500/50 p-4 rounded-lg text-white font-mono text-xs w-72 flex flex-col gap-4 shadow-2xl backdrop-blur-md">
      <div className="flex justify-between items-center border-b border-yellow-500/30 pb-2">
        <span className="text-yellow-400 font-bold tracking-tighter uppercase">Tuning Lab 🧪</span>
        <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">REP #{weights.tuningRepCount}</span>
      </div>

      <div className="space-y-4">
        <WeightSlider 
          label="Progress Weight" 
          description="Bias towards forward gain"
          value={weights.tuningProgressWeight} 
          min={0} max={2} step={0.05}
          onChange={(v) => updateWeight('tuningProgressWeight', v)} 
        />
        <WeightSlider 
          label="Lane Penalty" 
          description="Pressure in passing lane"
          value={weights.tuningLanePenalty} 
          min={0} max={1} step={0.01}
          onChange={(v) => updateWeight('tuningLanePenalty', v)} 
        />
         <WeightSlider 
          label="Space Weight" 
          description="Value of open grass"
          value={weights.tuningSpaceWeight} 
          min={0} max={0.5} step={0.01}
          onChange={(v) => updateWeight('tuningSpaceWeight', v)} 
        />
        <WeightSlider 
          label="Short Pass Bias" 
          description="Penalty for long balls"
          value={weights.tuningShortPassBias} 
          min={-0.2} max={0.2} step={0.01}
          onChange={(v) => updateWeight('tuningShortPassBias', v)} 
        />
      </div>

      <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
         <button 
           onClick={() => {
             gameRef.current?.restartPracticeRep?.();
             const template = gameRef.current?.getActivePracticePlayTemplate?.();
             const play = PRACTICE_PLAYS.find(p => p.template === template);
             if (play) {
                // Redraw routes from fresh (snapped) player positions
                const freshPlayers = gameRef.current?.getPlayers?.() || [];
                const sortedPlayers = [...freshPlayers].sort((a: any, b: any) => (a.id || 0) - (b.id || 0));
                const routes = getPlayRoutes(play, sortedPlayers);
                gameRef.current?.drawPracticeRoutes?.(routes);
             }
           }}
           className="w-full bg-white/10 hover:bg-white/20 py-1.5 rounded transition-colors uppercase tracking-widest text-[10px]"
         >
           Force Reset Rep
         </button>
         <div className="text-[9px] text-white/40 italic">
           Watchdog: 12s auto-reset enabled
         </div>
      </div>

      {weights.practiceStats.totalReps > 0 && (
        <div className="mt-2 border-t border-yellow-500/30 pt-4 flex flex-col gap-3">
          <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest flex justify-between">
            <span>Aggregated Report</span>
            <span className="text-white/60">n={weights.practiceStats.totalReps}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <StatBox 
              label="Goals" 
              value={weights.practiceStats.goals} 
              sub={`${((weights.practiceStats.goals / weights.practiceStats.totalReps) * 100).toFixed(1)}%`}
            />
            <StatBox 
              label="Pass Prec" 
              value={`${weights.practiceStats.totalPasses > 0 ? ((weights.practiceStats.completions / weights.practiceStats.totalPasses) * 100).toFixed(1) : 0}%`}
              sub={`${weights.practiceStats.completions}/${weights.practiceStats.totalPasses}`}
            />
            <StatBox 
              label="Box Entry" 
              value={weights.practiceStats.boxEntries} 
              sub={`${((weights.practiceStats.boxEntries / weights.practiceStats.totalReps) * 100).toFixed(1)}%`}
            />
            <StatBox 
              label="Progression" 
              value={weights.practiceStats.progressivePasses} 
              sub={`${weights.practiceStats.totalPasses > 0 ? ((weights.practiceStats.progressivePasses / weights.practiceStats.totalPasses) * 100).toFixed(1) : 0}%`}
            />
          </div>

          <button 
            onClick={() => gameRef.current?.exportPracticeReport?.()}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded text-[10px] uppercase tracking-widest mt-2 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>📥</span>
            <span>Export Practice Report (.json)</span>
          </button>

          {weights.practiceStats.lastRepSummary && (
            <div className="bg-white/5 p-2 rounded border border-white/10 text-[9px] leading-tight text-white/70 italic">
              <span className="text-yellow-500/80 font-bold not-italic mr-1">LATEST:</span>
              {weights.practiceStats.lastRepSummary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub }: any) {
  return (
    <div className="bg-white/5 p-2 rounded border border-white/5 flex flex-col items-center justify-center">
      <div className="text-[8px] text-white/40 uppercase font-bold">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="text-[8px] text-white/30">{sub}</div>
    </div>
  );
}

function WeightSlider({ label, description, value, min, max, step, onChange }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-end">
        <div>
          <div className="text-white/90 font-bold">{label}</div>
          <div className="text-[9px] text-white/50">{description}</div>
        </div>
        <div className="text-yellow-400 font-bold text-sm bg-yellow-400/10 px-1 rounded tabular-nums">{value.toFixed(2)}</div>
      </div>
      <input 
        type="range" 
        min={min} max={max} step={step} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow-400 hover:accent-yellow-300 transition-all"
      />
    </div>
  );
}

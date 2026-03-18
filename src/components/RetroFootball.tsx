import React, { useEffect, useRef, useState } from 'react';
import { initGame } from '../gameEngine';
import PlayerCard from './PlayerCard';
import FrameViewer from './FrameViewer';

const RetroFootball: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitCanvasRef = useRef<HTMLCanvasElement>(null);
  const orbitDefenseCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const [lighting, setLighting] = useState('NOON');
  const [cameraMode, setCameraMode] = useState<'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE'>('BROADCAST');
  const [teamAUniform, setTeamAUniform] = useState(0);
  const [teamBUniform, setTeamBUniform] = useState(0);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'OPTIONS' | 'STATS' | 'FRAME_VIEWER'>('OPTIONS');
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [selectedDefensePlayer, setSelectedDefensePlayer] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  const [isGroundVisible, setIsGroundVisible] = useState(true);
  const [isFieldVisible, setIsFieldVisible] = useState(true);
  const [isGrassVisible, setIsGrassVisible] = useState(true);
  const prevIsLive = useRef(false);

  useEffect(() => {
    if (orbitCanvasRef.current && gameRef.current) {
      gameRef.current.setOrbitCanvas(orbitCanvasRef.current);
    }
    if (orbitDefenseCanvasRef.current && gameRef.current) {
      gameRef.current.setOrbitDefenseCanvas(orbitDefenseCanvasRef.current);
    }
  }, [gameRef.current]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameRef.current) {
        const currentIsLive = gameRef.current.getIsLive();
        if (prevIsLive.current && !currentIsLive) {
          // Play just ended
          setSelectedPlayer(gameRef.current.getSelectedPlayerStats());
          
          gameRef.current.selectRandomDefensePlayer();
          setSelectedDefensePlayer(gameRef.current.getSelectedDefensePlayerStats());
        }
        prevIsLive.current = currentIsLive;
        
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
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOptionsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLightingChange = (preset: string) => {
    setLighting(preset);
    gameRef.current?.setLighting(preset);
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-mono">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Options Menu Overlay */}
      {isOptionsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 p-8 rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full flex flex-col gap-8">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
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
              <div className="grid grid-cols-3 gap-6">
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
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-white/40 text-[10px] font-bold mb-2 uppercase tracking-widest">Uniforms</h3>
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-white/60 text-[9px] mb-1 uppercase">Miami</p>
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
                        <p className="text-white/60 text-[9px] mb-1 uppercase">San Fran</p>
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

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-white/40 text-[10px] font-bold mb-3 uppercase tracking-widest">Controls</h3>
              <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                <div className="text-white/60">WASD / ARROWS</div>
                <div className="text-white text-right">MOVE PLAYER</div>
                <div className="text-white/60">H / KEYBOARD H</div>
                <div className="text-white text-right">HIKE / KICK</div>
                <div className="text-white/60">SPACEBAR</div>
                <div className="text-white text-right">THROW PASS</div>
                <div className="text-white/60">Q / E</div>
                <div className="text-white text-right">CYCLE RECEIVERS</div>
                <div className="text-white/60">P</div>
                <div className="text-white text-right">TOGGLE PLAYBOOK</div>
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

      {selectedPlayer && !isLive && (
        <div className="absolute bottom-4 left-4 bg-zinc-900/80 backdrop-blur-sm p-3 rounded border border-white/10 text-white w-44">
          <canvas ref={orbitCanvasRef} width={256} height={256} className="hidden" />
          <PlayerCard player={selectedPlayer} />
        </div>
      )}

      {selectedDefensePlayer && !isLive && (
        <div className="absolute bottom-4 right-4 bg-zinc-900/80 backdrop-blur-sm p-3 rounded border border-white/10 text-white w-44">
          <canvas ref={orbitDefenseCanvasRef} width={256} height={256} className="hidden" />
          <PlayerCard player={selectedDefensePlayer} />
        </div>
      )}
    </div>
  );
};

export default RetroFootball;

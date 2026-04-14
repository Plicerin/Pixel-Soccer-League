import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Pixelation } from '@react-three/postprocessing';
import { GameState } from '../types';
import { GameScene } from './GameScene';

const FootballGame3D: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  return (
    <div className="relative w-full h-screen bg-zinc-950 font-mono overflow-hidden">
      {/* 2D UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-8 z-10 pointer-events-none flex flex-col items-center">
        <h1 className="text-4xl font-black italic tracking-tighter text-white drop-shadow-lg mb-2">
          PIXEL SOCCER LEAGUE
        </h1>
        <div className="flex gap-12 text-2xl">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">Score</span>
            <span className="text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">{score.toString().padStart(3, '0')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">High Score</span>
            <span className="text-fuchsia-400 font-bold drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]">{highScore.toString().padStart(3, '0')}</span>
          </div>
        </div>
      </div>

      {/* Game State Overlays */}
      {gameState !== 'PLAYING' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="text-center p-12 border-4 border-white/20 rounded-3xl bg-zinc-900/80 shadow-2xl">
            {gameState === 'START' && (
              <>
                <h2 className="text-6xl font-black text-white mb-6 italic tracking-tighter">READY?</h2>
                <button 
                  className="px-12 py-6 bg-cyan-500 text-white text-2xl font-black rounded-none hover:bg-cyan-400 transition-all transform hover:scale-105 shadow-[8px_8px_0_rgba(0,0,0,1)] mb-8 pointer-events-auto border-4 border-white"
                  onClick={() => setGameState('PLAYING')}
                >
                  KICK OFF
                </button>
                <div className="text-zinc-400 text-sm space-y-2 font-bold">
                  <p>WASD / ARROWS TO RUN</p>
                  <p>REACH THE ENDZONE TO SCORE</p>
                </div>
              </>
            )}
            {gameState === 'TOUCHDOWN' && (
              <>
                <h2 className="text-7xl font-black text-fuchsia-400 mb-6 italic tracking-tighter drop-shadow-[0_0_15px_rgba(232,121,249,0.8)]">TOUCHDOWN!</h2>
                <p className="text-white text-xl mb-8 font-bold">GREAT DRIVE!</p>
                <button 
                  className="px-8 py-4 bg-cyan-500 text-white font-black rounded-none hover:bg-cyan-400 transition-colors border-4 border-white shadow-[8px_8px_0_rgba(0,0,0,1)]"
                  onClick={() => setGameState('PLAYING')}
                >
                  NEXT DRIVE (SPACE)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas shadows dpr={[1, 1]} gl={{ antialias: false }}>
        <PerspectiveCamera makeDefault position={[-40, 25, 45]} fov={50} />
        <GameScene 
          gameState={gameState} 
          setGameState={setGameState} 
          setScore={setScore}
          setHighScore={setHighScore}
        />
        <EffectComposer>
          <Pixelation granularity={10} />
        </EffectComposer>
      </Canvas>

      {/* Controls Help */}
      <div className="absolute bottom-8 left-8 text-[10px] text-zinc-500 uppercase tracking-widest">
        WASD to Move • Space to Start
      </div>
    </div>
  );
};

export default FootballGame3D;

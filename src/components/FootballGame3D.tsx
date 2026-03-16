import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Text, Box, Plane, Center, Sky } from '@react-three/drei';
import { EffectComposer, Pixelation } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GameState } from '../types';

// --- Constants ---
const FIELD_WIDTH = 100;
const FIELD_HEIGHT = 60;
const ENDZONE_WIDTH = 10;
const PLAYER_SPEED = 0.5;

// --- Components ---

// Retro Sprite Data (Atari style)
const SPRITE_FRAMES = [
  // Frame 1: Mid-stride
  [
    [0,0,0,1,1,1,0],
    [0,0,0,1,1,1,0],
    [0,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [0,1,1,1,1,0,0],
    [0,0,1,1,0,0,0],
    [0,0,1,1,0,0,0],
    [0,1,1,0,0,0,0],
    [1,1,0,0,0,0,0],
  ],
  // Frame 2: Full-stride
  [
    [0,0,0,1,1,1,0],
    [0,0,0,1,1,1,0],
    [0,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [0,1,1,1,1,0,0],
    [0,0,1,1,0,0,0],
    [0,1,1,0,0,0,0],
    [1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1],
  ]
];

const Player: React.FC<{ 
  position: THREE.Vector3; 
  color: string; 
  isMain?: boolean;
}> = ({ position, color, isMain }) => {
  const groupRef = useRef<THREE.Group>(null);
  const prevPos = useRef(new THREE.Vector3());
  const frameRef = useRef(0);
  const isMovingRef = useRef(false);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.copy(position);
      
      // Movement detection
      const dist = position.distanceTo(prevPos.current);
      const moving = dist > 0.01;
      isMovingRef.current = moving;
      prevPos.current.copy(position);

      // Animation logic
      if (moving) {
        const animSpeed = isMain ? 12 : 10;
        frameRef.current = Math.floor(state.clock.elapsedTime * animSpeed) % 2;
        
        // Tilt forward when moving
        groupRef.current.rotation.z = -0.2;
      } else {
        frameRef.current = 0;
        groupRef.current.rotation.z = 0;
      }

      // Always face "forward" (right side of screen / positive X)
      groupRef.current.rotation.y = Math.PI / 2;

      // Update voxel visibility based on frameRef.current
      // Since we want to avoid re-renders, we can just toggle visibility of children
      // But for simplicity in this small component, we'll just let it re-render for now
      // or use a more performant way. 
      // Actually, let's keep it simple with state for the frame since it's only 2 frames.
    }
  });

  // We actually DO need state for the frame to trigger re-renders for the animation
  const [displayFrame, setDisplayFrame] = useState(0);
  useFrame((state) => {
    const animSpeed = isMain ? 12 : 10;
    const newFrame = isMovingRef.current ? Math.floor(state.clock.elapsedTime * animSpeed) % 2 : 0;
    if (newFrame !== displayFrame) setDisplayFrame(newFrame);
  });

  const currentSprite = SPRITE_FRAMES[displayFrame];
  const pixelSize = 0.25;

  return (
    <group ref={groupRef}>
      <group position={[0, 0, 0]}>
        {currentSprite.map((row, y) => 
          row.map((pixel, x) => {
            if (pixel === 0) return null;
            return (
              <mesh 
                key={`${x}-${y}`} 
                position={[
                  (x - 3) * pixelSize, 
                  (currentSprite.length - y - 1) * pixelSize, 
                  0
                ]}
              >
                <boxGeometry args={[pixelSize, pixelSize, pixelSize * 1.5]} />
                <meshStandardMaterial color={color} flatShading />
              </mesh>
            );
          })
        )}
      </group>
      
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshBasicMaterial color="black" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

const Field: React.FC = () => {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Main Grass */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[FIELD_WIDTH, FIELD_HEIGHT]} />
        <meshStandardMaterial color="#00aa00" flatShading />
      </mesh>

      {/* Yard Lines */}
      {Array.from({ length: 11 }).map((_, i) => {
        const x = -FIELD_WIDTH / 2 + ENDZONE_WIDTH + (i * (FIELD_WIDTH - 2 * ENDZONE_WIDTH) / 10);
        return (
          <mesh key={i} position={[x, 0, 0.01]}>
            <planeGeometry args={[0.5, FIELD_HEIGHT]} />
            <meshBasicMaterial color="white" />
          </mesh>
        );
      })}
      
      {/* Endzones */}
      <mesh position={[-FIELD_WIDTH / 2 + ENDZONE_WIDTH / 2, 0, 0.02]}>
        <planeGeometry args={[ENDZONE_WIDTH, FIELD_HEIGHT]} />
        <meshStandardMaterial color="#ff0000" flatShading />
      </mesh>
      <mesh position={[FIELD_WIDTH / 2 - ENDZONE_WIDTH / 2, 0, 0.02]}>
        <planeGeometry args={[ENDZONE_WIDTH, FIELD_HEIGHT]} />
        <meshStandardMaterial color="#ff0000" flatShading />
      </mesh>
    </group>
  );
};

const Goalpost: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Main Post */}
      <Box args={[0.5, 6, 0.5]} position={[0, 3, 0]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
      {/* Crossbar */}
      <Box args={[0.5, 0.5, 8]} position={[0, 6, 0]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
      {/* Uprights */}
      <Box args={[0.5, 6, 0.5]} position={[0, 9, -4]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
      <Box args={[0.5, 6, 0.5]} position={[0, 9, 4]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
    </group>
  );
};

// --- Main Game Logic ---

const GameScene: React.FC<{ 
  gameState: GameState; 
  setGameState: (s: GameState) => void;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  setHighScore: React.Dispatch<React.SetStateAction<number>>;
}> = ({ gameState, setGameState, setScore, setHighScore }) => {
  const playerPos = useRef(new THREE.Vector3(-40, 0, 0));
  const keys = useRef<{ [key: string]: boolean }>({});

  const initGame = () => {
    playerPos.current.set(-40, 0, 0);
  };

  useEffect(() => {
    if (gameState === 'PLAYING' || gameState === 'START') {
      initGame();
    }
  }, [gameState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (gameState !== 'PLAYING' && (e.key === ' ' || e.key === 'Enter' || e.code === 'Space' || e.code === 'Enter')) {
        setGameState('PLAYING');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current[e.code] = false;
    const onBlur = () => { keys.current = {}; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gameState]);

  const move = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    // TV Style Camera: Fixed sideline position, pans with player X
    // We position it at a fixed height and distance from the sideline
    const camX = playerPos.current.x;
    const camY = 25; // Height
    const camZ = 45; // Distance from sideline
    
    camTarget.set(camX, camY, camZ);
    state.camera.position.lerp(camTarget, 0.1); // Faster, more responsive tracking
    state.camera.lookAt(state.camera.position.x, 0, 0);

    if (gameState !== 'PLAYING') return;

    // Player Movement
    move.set(0, 0, 0);
    if (keys.current['ArrowUp'] || keys.current['KeyW']) move.z -= 1;
    if (keys.current['ArrowDown'] || keys.current['KeyS']) move.z += 1;
    if (keys.current['ArrowLeft'] || keys.current['KeyA']) move.x -= 1;
    if (keys.current['ArrowRight'] || keys.current['KeyD']) move.x += 1;

    if (move.length() > 0) {
      move.normalize().multiplyScalar(PLAYER_SPEED);
      playerPos.current.add(move);
    }

    // Boundaries
    playerPos.current.x = Math.max(-FIELD_WIDTH / 2, Math.min(FIELD_WIDTH / 2, playerPos.current.x));
    playerPos.current.z = Math.max(-FIELD_HEIGHT / 2, Math.min(FIELD_HEIGHT / 2, playerPos.current.z));

    // Touchdown
    if (playerPos.current.x > FIELD_WIDTH / 2 - ENDZONE_WIDTH) {
      setScore(s => {
        const next = s + 7;
        setHighScore(h => Math.max(h, next));
        return next;
      });
      setGameState('TOUCHDOWN');
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <color attach="background" args={["#1a1a1a"]} />
      <fog attach="fog" args={["#1a1a1a", 30, 100]} />
      
      <Field />
      <Goalpost position={[-FIELD_WIDTH / 2 + 2, 0, 0]} />
      <Goalpost position={[FIELD_WIDTH / 2 - 2, 0, 0]} />

      <Player position={playerPos.current} color="#0000ff" isMain />
      
      {/* UI Overlays in 3D (Optional, but better in HTML) */}
    </>
  );
};

const FootballGame3D: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  return (
    <div className="relative w-full h-screen bg-zinc-950 font-mono overflow-hidden">
      {/* 2D UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-8 z-10 pointer-events-none flex flex-col items-center">
        <h1 className="text-4xl font-black italic tracking-tighter text-white drop-shadow-lg mb-2">
          RETRO GRIDIRON 3D
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

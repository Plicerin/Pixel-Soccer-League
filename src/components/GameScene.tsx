import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState, AIPlayer } from '../types';
import { Player } from './Player';
import { Field } from './Field';
import { Ball } from './Ball';

const FIELD_WIDTH = 100;
const FIELD_HEIGHT = 60;
const ENDZONE_WIDTH = 10;
const PLAYER_SPEED = 0.5;
const WR_SPEED = 0.4;
const DEFENDER_SPEED = 0.45;

export const GameScene: React.FC<{ 
  gameState: GameState; 
  setGameState: (s: GameState) => void;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  setHighScore: React.Dispatch<React.SetStateAction<number>>;
}> = ({ gameState, setGameState, setScore, setHighScore }) => {
  const playerPos = useRef(new THREE.Vector3(-40, 4.5, 0));
  const keys = useRef<{ [key: string]: boolean }>({});
  
  const [aiPlayers, setAiPlayers] = useState<AIPlayer[]>([
    { id: 'wr1', position: new THREE.Vector3(-30, 4.5, 10), type: 'WR', speed: WR_SPEED, isBursting: false, burstTimer: 0 },
    { id: 'def1', position: new THREE.Vector3(-30, 4.5, 12), type: 'defender', speed: DEFENDER_SPEED, isBursting: false, burstTimer: 0 },
  ]);
  const [ballPos, setBallPos] = useState(new THREE.Vector3(0, 5, 0));
  const [ballCaught, setBallCaught] = useState(false);

  const initGame = () => {
    playerPos.current.set(-40, 4.5, 0);
    setAiPlayers([
      { id: 'wr1', position: new THREE.Vector3(-30, 4.5, 10), type: 'WR', speed: WR_SPEED, isBursting: false, burstTimer: 0 },
      { id: 'def1', position: new THREE.Vector3(-30, 4.5, 12), type: 'defender', speed: DEFENDER_SPEED, isBursting: false, burstTimer: 0 },
    ]);
    setBallPos(new THREE.Vector3(0, 5, 0));
    setBallCaught(false);
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
    const camX = playerPos.current.x;
    const camY = 25; // Height
    const camZ = 45; // Distance from sideline
    
    camTarget.set(camX, camY, camZ);
    state.camera.position.lerp(camTarget, 0.1);
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

    // AI Movement
    setAiPlayers(prev => prev.map(p => {
      let nextPos = p.position.clone();
      
      // AI Logic: Rapid direction change
      if (Math.random() < 0.05) {
        nextPos.z += (Math.random() - 0.5) * 2;
      }
      nextPos.x += p.speed * (p.isBursting ? 2 : 1);

      // Burst of speed
      let isBursting = p.isBursting;
      let burstTimer = p.burstTimer;
      if (p.type === 'WR' && !isBursting && Math.random() < 0.01) {
        isBursting = true;
        burstTimer = 60; // 1 second at 60fps
      }
      if (isBursting) {
        burstTimer--;
        if (burstTimer <= 0) {
          isBursting = false;
        }
      }

      // Jump and catch logic
      if (p.type === 'WR' && !ballCaught && nextPos.distanceTo(ballPos) < 2) {
        setBallCaught(true);
        nextPos.y = 4; // Jump
      } else if (p.type === 'WR' && nextPos.y > 2) {
        nextPos.y -= 0.1; // Land
      }

      return { ...p, position: nextPos, isBursting, burstTimer };
    }));

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

      <Player position={playerPos.current} color="#0000ff" isMain />
      {aiPlayers.map(p => (
        <Player key={p.id} position={p.position} color={p.type === 'WR' ? '#ffff00' : '#ff0000'} />
      ))}
      {!ballCaught && <Ball position={ballPos} />}
    </>
  );
};

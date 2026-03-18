import * as THREE from 'three';

export type Point = {
  x: number;
  y: number;
};

export type PlayerType = 'player' | 'teammate' | 'defender';

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: PlayerType;
  speed: number;
  vx: number;
  vy: number;
}

export interface AIPlayer {
  id: string;
  position: THREE.Vector3;
  type: 'WR' | 'defender';
  speed: number;
  isBursting: boolean;
  burstTimer: number;
}

export type GameState = 'START' | 'PLAYING' | 'TOUCHDOWN';

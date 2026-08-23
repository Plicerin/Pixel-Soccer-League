import * as THREE from 'three';
import { createGamepadLatch, pickStandardGamepad } from './gamepadSelect';
import { Text } from 'troika-three-text';
import {
  BALL_GROUND_Y,
  CENTER_CIRCLE_RADIUS,
  FIELD_D,
  FIELD_SCALE_PER_YARD,
  FIELD_W,
  GOAL_BOX_DEPTH,
  GOAL_BOX_HALF_Z,
  GOAL_FLOOR_DEPTH,
  GOAL_HEIGHT,
  GOAL_MOUTH_HALF_Z,
  LEFT_GOAL_X,
  LEFT_PENALTY_X,
  PENALTY_DEPTH,
  PENALTY_HALF_Z,
  PENALTY_SPOT_DIST,
  RIGHT_GOAL_X,
  RIGHT_PENALTY_X,
} from './core/constants';
import { SimpleMatchModel, type SimplePlayer } from './core/simpleMatchModel';
import { type RouteData } from './practicePlays';

// ============================================================================
// gameEngine.ts — simple model + restored PSL renderer shell (2026-05-12)
// ----------------------------------------------------------------------------
// Sprite + material + voxel-frame builders are preserved below so the React
// shell (RetroFootball, AnimationInspector, FrameViewer, StaticImageGenerator)
// keeps compiling. Gameplay comes from SimpleMatchModel; the old gameplay stack
// remains deleted. The visual shell restores the old broadcast/stadium feel
// without reintroducing the legacy model.
// ============================================================================
export const M = {
  fieldGreen:  new THREE.MeshStandardMaterial({ color: 0x2e8b2e, roughness: 0.8, metalness: 0.1 }),
  teamAEndZone: new THREE.MeshStandardMaterial({ color: 0x004d52, roughness: 0.8, metalness: 0.1 }),
  teamBEndZone: new THREE.MeshStandardMaterial({ color: 0x660000, roughness: 0.8, metalness: 0.1 }),
  white:       new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 }),
  goalPost:    new THREE.MeshStandardMaterial({ color: 0xf5d000, roughness: 0.3, metalness: 0.6 }),
  shadow:      new THREE.MeshStandardMaterial({ color: 0x1a5c1a, transparent: true, opacity: 0.45 }),
  blue:        new THREE.MeshStandardMaterial({ color: 0x008e97, roughness: 0.5, metalness: 0.2 }),
  red:         new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.5, metalness: 0.2 }),
  orange:      new THREE.MeshStandardMaterial({ color: 0xfc4c02, roughness: 0.5, metalness: 0.2 }),
  dark:        new THREE.MeshStandardMaterial({ color: 0x005778, roughness: 0.5, metalness: 0.2 }),
  hairBlack:   new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.0 }),
  hairBrown:   new THREE.MeshStandardMaterial({ color: 0x6f4b2a, roughness: 0.9, metalness: 0.0 }),
  hairBlond:   new THREE.MeshStandardMaterial({ color: 0xd9b56d, roughness: 0.9, metalness: 0.0 }),
  teamAVisor:  new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0.9 }),
  teamBVisor:  new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0.9 }),
  teamAShirt:  new THREE.MeshStandardMaterial({ color: 0xf52b8f, roughness: 0.7, metalness: 0.0 }),
  teamAPants:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.0 }),
  teamBShirt:  new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.7, metalness: 0.0 }),
  teamBPants:  new THREE.MeshStandardMaterial({ color: 0xc7a74b, roughness: 0.7, metalness: 0.0 }),
  teamAKeeperShirt: new THREE.MeshStandardMaterial({ color: 0x7fff00, roughness: 0.72, metalness: 0.0 }),
  teamAKeeperPants: new THREE.MeshStandardMaterial({ color: 0x7fff00, roughness: 0.72, metalness: 0.0 }),
  teamBKeeperShirt: new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.72, metalness: 0.0 }),
  teamBKeeperPants: new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.72, metalness: 0.0 }),
  refShirt:  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.0 }),
  refPants:  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.0 }),
  refVisor:  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.0 }),
};

export type PlayerPalette = { shirt: THREE.Material; pants: THREE.Material; hair: THREE.Material; visor: THREE.Material };
export const TEAM_PALETTES: Record<string, PlayerPalette> = {
  teamA: { shirt: M.teamAShirt, pants: M.teamAPants, hair: M.hairBlack, visor: M.teamAVisor },
  teamB: { shirt: M.teamBShirt, pants: M.teamBPants, hair: M.hairBlack, visor: M.teamBVisor },
  keeperA: { shirt: M.teamAKeeperShirt, pants: M.teamAKeeperPants, hair: M.hairBlack, visor: M.teamAVisor },
  keeperB: { shirt: M.teamBKeeperShirt, pants: M.teamBKeeperPants, hair: M.hairBlack, visor: M.teamBVisor },
  referee: { shirt: M.refShirt, pants: M.refPants, hair: M.hairBlack, visor: M.refVisor },
};
const PLAYER_HAIR_MATERIALS = [M.hairBlack, M.hairBrown, M.hairBlond];

export const PLAYER_IDLE_PATTERNS = [
  // Frame 0 – neutral stand: compact, arms at sides, both feet planted
  ['00000000001111110000','00000000001110000000','0000000011H1111H0000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000PPPPP0000000','00000000PPPPP0000000','00000000PPPPP0000000','00000000111110000000','00011111111110000000','00011100111000000000','00011100111000000000','00000000111000000000','00000000111110000000'],
  // Frame 1 – subtle weight shift
  ['00000000001111110000','00000000001110000000','0000000011H1111H0000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000PPPPP0000000','00000000PPPPP0000000','00000000PPPPP0000000','00000000011110000000','00000000111110000000','00000000111000000000','00000000P11000000000','00000000PPP000000000','00000000PPPPP0000000'],
];

export const PLAYER_PATTERNS = [
  ['00000000001111110000','00000000001110000000','0000011111H1111P0000','00011111111110000000','00011100111110000000','00011100111111111111','00000000SSSSS0000000','00000000PPPPP0000000','00000000PPPPP0000000','00000PPPPPPPPPPPPPPP','00000111100000000111','00011111100000011100','00011100000000011100','01111100000000000000','01110000000000000000','01110000000000000000'],
  ['00000000001111110000','00000000001110000000','0111111111H1111P0000','01110000111110000000','01110000111111111111','00000000111110000000','00000000SSSSS0000000','00000000PPPPP0000000','00000PPPPPPPP0000000','00000PPPPPPPPPPPPPPP','00000111100000000111','00011111100000000111','00011100000000000111','01111100000000000000','01110000000000000000','00000000000000000000'],
  ['00000000011111100000','00000000011100000000','000011111HH111100000','00111111111100000000','00111001111100000000','00111001111111111110','0000000SSSSS00000000','0000000PPPPP00000000','0000000PPPPP00000000','0000PPPPPPPPPPP00000','00001110000111100000','00111110000111111000','11111000000000111000','11100000000000111000','00000000000000111110','00000000000000000000'],
  ['00000000000011111100','00000000000011100000','00000000111S111HHH00','00000111111111110000','00011111111111110000','00011100111111111100','00011100SSSSS0000000','00000000PPPPP0000000','00000PPPPPPPP0000000','00000PPPPPPPPPPP0000','00000111100011110000','01111111100011110000','01110000000011110000','01110000000011110000','00000000000011110000','00000000000011111100'],
  ['00000000000111111000','00000000000111000000','000000011111111HH000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','0000000PPPPP00000000','0000000PPPPP00000000','0000000PPPPP00000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00000000011100000000','00000000011111100000'],
  ['00000000001111110000','00000000001110000000','0000000011H1111H0000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000PPPPP0000000','00000000PPPPP0000000','00000000PPPPP0000000','00000000111110000000','00011111111110000000','00011100111000000000','00011100111000000000','00000000111000000000','00000000111110000000'],
  ['00000000001111110000','00000000001110000000','0000011111H1111H0000','00011111111110000000','00011111111110000000','00011111111110000000','00011111111111110000','00000PPPPPP000000000','00000PPPPPPPP0000000','000PPPPPPPPPPPPP0000','00011100000011110000','00011100000111110000','00011100000011100000','00011100000000000000','00011100000000000000','00000111100000000000'],
  ['00000000000111111000','00000000000111000000','000000011111111HH000','00001111111111100000','00111111111111100000','00111001111111111000','0011100SSSSS00000000','0000000PPPPP00000000','0000000PPPPPPPP00000','0000PPPPPPPPPPPPPPP0','000011100000000P1110','00001110000011111110','00001110000011100000','00111000000011100000','00111000000000000000','00111000000000000000'],
];

// ─── Goalkeeper-specific side-view frames (with glove 'V' markings) ─────────
export const KEEPER_PATTERNS = [
  ['00000000001111110000','00000000001110000000','0000011111H1111H0000','00011111111110000000','00011100111110000000','000VVV001111111111VV','00000000SSSSS0000000','00000000PPPPP0000000','00000000PPPPP0000000','00000PPPPPPPPPPPPPPP','00000111100000000111','00011111100000011100','00011100000000011100','01111100000000000000','01110000000000000000','01110000000000000000'],
  ['00000000001111110000','00000000001110000000','0111111111H1111H0000','01110000111110000000','0VVV00001111111111VV','00000000111110000000','00000000SSSSS0000000','00000000PPPPP0000000','00000PPPPPPPP0000000','00000PPPPPPPPPPPPPPP','00000111100000000111','00011111100000000111','00011100000000000111','01111100000000000000','01110000000000000000','00000000000000000000'],
  ['00000000011111100000','00000000011100000000','000011111HH111100000','00111111111100000000','00111001111100000000','00VVV001111111111VV0','0000000SSSSS00000000','0000000PPPPP00000000','0000000PPPPP00000000','0000PPPPPPPPPPP00000','00001110000111100000','00111110000111111000','11111000000000111000','11100000000000111000','00000000000000111110','00000000000000000000'],
  ['00000000000011111100','00000000000011100000','00000000111S111HHH00','00000111111111110000','00011111111111110000','0001110011111111VV00','000VVV00SSSSS0000000','00000000PPPPP0000000','00000PPPPPPPP0000000','00000PPPPPPPPPPP0000','00000111100011110000','01111111100011110000','01110000000011110000','01110000000011110000','00000000000011110000','00000000000011111100'],
  ['00000000000111111000','00000000000111000000','000000011111111HH000','00001111111111100000','00001111111111100000','00001111111111100000','0000VVV11111111VV000','0000000PPPPP00000000','0000000PPPPP00000000','0000000PPPPP00000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00000000011100000000','00000000011111100000'],
  ['00000000001111110000','00000000001110000000','0000000011H1111H0000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000PPPPP0000000','00000000PPVVS0000000','00000000PPVVP0000000','00000000111110000000','00011111111110000000','00011100111000000000','00011100111000000000','00000000111000000000','00000000111110000000'],
  ['00000000001111110000','00000000001110000000','0000011111H1111H0000','00011111111110000000','00011111111110000000','00011111111110000000','000VV111111111VV0000','00000PPPPPP000000000','00000PPPPPPPP0000000','000PPPPPPPPPPPP00000','00011100000000110000','00011100000000110000','00011100000011100000','000111000000PP000000','000111000000P0000000','00000111100000000000'],
  ['00000000000111111000','00000000000111000000','000000011111111HH000','00001111111111100000','00111111111111100000','001110011111111VV000','00VVV00SSSSS00000000','0000000PPPPP00000000','0000000PPPPPPPP00000','0000PPPPPPPPPPPPPPP0','000011100000000P1110','00001110000011111110','00001110000011100000','00111000000011100000','00111000000000000000','00111000000000000000'],
];

export const KEEPER_IDLE_PATTERNS = [
  ['00000000001111110000','00000000001110000000','0000000011H1111H0000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000PPPPP0000000','00000000PPVVS0000000','00000000PPVVP0000000','00000000111110000000','00011111111110000000','00011100111000000000','00011100111000000000','00000000111000000000','00000000111110000000'],
  ['00000000001111110000','00000000001110000000','0000000011H1111H0000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000PPPPP0000000','00000000PPVVS0000000','00000000PPVVP0000000','00000000011110000000','00000000111110000000','00000000111000000000','00000000P11000000000','00000000PPP000000000','00000000PPPPP0000000'],
];

// ─── Goalkeeper diving frames ───────────────────────────────────────────────
// DIVE_LEFT: body stretched leftward (toward negative Z in sprite space).
// Arms/gloves (V) reach left, torso tilted, legs trailing right.
// Frame 0: launch, Frame 1: full extension
export const KEEPER_DIVE_LEFT_PATTERNS = [
  // Frame 0 — launch: keeper leaning left, arms beginning to extend
  ['0000000VV00000000000','0000000SS00000000000','0VV00000SS0000000000','0SS00HHHHS0000000000','00SS0HHHHSS000000000','000SSHHHHSS000000000','0000SSSSSSSS00000000','0000000SSSSSS0000000','00000000SSSSSP000000','00000000SSSSPPP00000','000000000SSPPPPP0000','0000000000PPPPPPP000','00000000000PPP0PPP00','000000000000PP000PP0','0000000000000PP000PP','00000000000000PP0000'],
  // Frame 1 — mid-dive: arms partially extended left
  ['00000000000000000000','00000000VV0000000000','00000000SS0000000000','00000HHHHS0000000000','00VS0HHHHSS000000000','00VSSHHHHSS000000000','0000SSSSSSSS00000000','0000000SSSSSS0000000','00000000SSSSSP000000','00000000SSSSPPP00000','000000000SSPPPPP0000','0000000000PPPPPPP000','00000000000PPP0PPP00','000000000000PP000PP0','0000000000000PP000PP','00000000000000PP0000'],
  // Frame 2 — recovery: same as launch
  ['0000000VV00000000000','0000000SS00000000000','0VV00000SS0000000000','0SS00HHHHS0000000000','00SS0HHHHSS000000000','000SSHHHHSS000000000','0000SSSSSSSS00000000','0000000SSSSSS0000000','00000000SSSSSP000000','00000000SSSSPPP00000','000000000SSPPPPP0000','0000000000PPPPPPP000','00000000000PPP0PPP00','000000000000PP000PP0','0000000000000PP000PP','00000000000000PP0000'],
];

// DIVE_RIGHT: mirror of DIVE_LEFT — body stretched rightward.
export const KEEPER_DIVE_RIGHT_PATTERNS = [
  // Frame 0 — launch: keeper leaning right, arms beginning to extend
  ['00000000000VV0000000','00000000000SS0000000','0000000000SS00000VV0','0000000000SHHHH00SS0','000000000SSHHHH0SS00','000000000SSHHHHSS000','00000000SSSSSSSS0000','0000000SSSSSS0000000','000000PSSSSS00000000','00000PPPSSSS00000000','0000PPPPPSS000000000','000PPPPPPP0000000000','00PPP0PPP00000000000','0PP000PP000000000000','PP000PP0000000000000','0000PP00000000000000'],
  // Frame 1 — mid-dive: arms partially extended right
  ['00000000000000000000','0000000000VV00000000','0000000000SS00000000','0000000000SHHHH00000','000000000SSHHHH0SV00','000000000SSHHHHSSV00','00000000SSSSSSSS0000','0000000SSSSSS0000000','000000PSSSSS00000000','00000PPPSSSS00000000','0000PPPPPSS000000000','000PPPPPPP0000000000','00PPP0PPP00000000000','0PP000PP000000000000','PP000PP0000000000000','0000PP00000000000000'],
  // Frame 2 — recovery: mirror of dive-left recovery
  ['00000000000VV0000000','00000000000SS0000000','0000000000SS00000VV0','0000000000SHHHH00SS0','000000000SSHHHH0SS00','000000000SSHHHHSS000','00000000SSSSSSSS0000','0000000SSSSSS0000000','000000PSSSSS00000000','00000PPPSSSS00000000','0000PPPPPSS000000000','000PPPPPPP0000000000','00PPP0PPP00000000000','0PP000PP000000000000','PP000PP0000000000000','0000PP00000000000000'],
];

// DIVE_UP: keeper jumping/stretching upward, arms raised high.
export const KEEPER_DIVE_UP_PATTERNS = [
  // Frame 0 — arms reaching out, body upright
  ['00000001111000000000','00000001111000000000','0000000HHHH000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','000VV00111100VV00000','00000000000000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000'],
  // Frame 1 — arms raised high, body stretched
  ['000VV00111100VV00000','000SS00111100SS00000','000SS00HHHH00SS00000','00000111111110000000','00000111111110000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000'],
];

// DIVE_DOWN: keeper dropping low, arms reaching down/forward.
export const KEEPER_DIVE_DOWN_PATTERNS = [
  // Frame 0 — arms reaching out, preparing to drop
  ['00000001111000000000','00000001111000000000','0000000HHHH000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','000VV00111100VV00000','00000000000000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000'],
  // Frame 1 — crouched low, arms spread wide
  ['00000000000000000000','00000000000000000000','00000000000000000000','0000000HHHH000000000','0000000HHHH000000000','0000000HHHH000000000','00000SSSSSSSS0000000','00000SSSSSSSS0000000','000SS00SSSS00SS00000','000SS00SSSS00SS00000','000VV00SSSS00VV00000','00000000000000000000','0000000PPPP000000000','0000000PPPP000000000','00000000000000000000','00000001111000000000'],
];

// ─── Front-view frames (running toward camera) ──────────────────────────────
const PLAYER_FRONT_RUN_PATTERNS = [
  ['00000001111000000000','00000001111000000000','00000001111000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','00011001111001100000','00000000000000000000','00000001111000000000','00000001111000000000','00000001100000000000','00000001100000000000','00000001100000000000','00000000000000000000','00000001100000000000'],
  ['00000001111000000000','00000001111000000000','00000001111000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','00011001111001100000','00000000000000000000','00000001111000000000','00000001111000000000','00000000011000000000','00000000011000000000','00000000011000000000','00000000000000000000','00000000011000000000'],
];
const PLAYER_FRONT_IDLE_PATTERNS = [
  ['00000001111000000000','00000001111000000000','00000001111000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','00011001111001100000','00000000000000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000'],
];
const PLAYER_FRONT_HELMET_MASK = [
  '00000001111000000000','00000001001000000000','00000001111000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
];
const PLAYER_FRONT_VISOR_MASK = [
  '00000000000000000000','00000000110000000000','00000000000000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
];
const PLAYER_FRONT_PANTS_OVERRIDES: Record<string, string[]> = {
  idle: ['00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000'],
  '0': ['00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000001111000000000','00000001111000000000','00000001100000000000','00000001100000000000','00000001100000000000','00000000000000000000','00000001100000000000'],
  '1': ['00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000001111000000000','00000001111000000000','00000000011000000000','00000000011000000000','00000000011000000000','00000000000000000000','00000000011000000000'],
};

// ─── Back-view frames (running away from camera) ─────────────────────────────
const PLAYER_BACK_RUN_PATTERNS = [
  ['00000001111000000000','00000001111000000000','00000001111000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','00011001111001100000','00000000000000000000','00000001111000000000','00000001111000000000','00000000011000000000','00000000011000000000','00000000011000000000','00000000000000000000','00000000011000000000'],
  ['00000001111000000000','00000001111000000000','00000001111000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','00011001111001100000','00000000000000000000','00000001111000000000','00000001111000000000','00000001100000000000','00000001100000000000','00000001100000000000','00000000000000000000','00000001100000000000'],
];
const PLAYER_BACK_IDLE_PATTERNS = [
  ['00000001111000000000','00000001111000000000','00000001111000000000','00000111111110000000','00000111111110000000','00011001111001100000','00011001111001100000','00011001111001100000','00000000000000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000'],
];
const PLAYER_BACK_HELMET_MASK = [
  '00000001111000000000','00000001111000000000','00000001111000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
];
const PLAYER_BACK_VISOR_MASK = [
  '00000000000000000000','00000000000000000000','00000000000000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
  '00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000',
];
const PLAYER_BACK_PANTS_OVERRIDES: Record<string, string[]> = {
  idle: ['00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000001111000000000','00000000000000000000','00000001111000000000'],
  '0': ['00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000001111000000000','00000001111000000000','00000000011000000000','00000000011000000000','00000000011000000000','00000000000000000000','00000000011000000000'],
  '1': ['00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000000000000000000','00000001111000000000','00000001111000000000','00000001100000000000','00000001100000000000','00000001100000000000','00000000000000000000','00000001100000000000'],
};

/** Compose a front/back base pattern with helmet, visor, and pants masks into SHVP format. */
function composeFBPattern(base: string[], helmet: string[], visor: string[], pants: string[]): string[] {
  return base.map((row, r) => {
    let out = '';
    for (let c = 0; c < row.length; c++) {
      if (base[r][c] === '0') { out += '0'; continue; }
      if (helmet[r][c] === '1') { out += 'H'; continue; }
      if (visor[r][c] === '1') { out += 'V'; continue; }
      if (pants[r][c] === '1') { out += 'P'; continue; }
      out += 'S';
    }
    return out;
  });
}

export const PLAYER_FRONT_RUN_COMPOSED = PLAYER_FRONT_RUN_PATTERNS.map((base, i) =>
  composeFBPattern(base, PLAYER_FRONT_HELMET_MASK, PLAYER_FRONT_VISOR_MASK, PLAYER_FRONT_PANTS_OVERRIDES[String(i)] || PLAYER_FRONT_PANTS_OVERRIDES['0'])
);
export const PLAYER_FRONT_IDLE_COMPOSED = PLAYER_FRONT_IDLE_PATTERNS.map(base =>
  composeFBPattern(base, PLAYER_FRONT_HELMET_MASK, PLAYER_FRONT_VISOR_MASK, PLAYER_FRONT_PANTS_OVERRIDES['idle'])
);
export const PLAYER_BACK_RUN_COMPOSED = PLAYER_BACK_RUN_PATTERNS.map((base, i) =>
  composeFBPattern(base, PLAYER_BACK_HELMET_MASK, PLAYER_BACK_VISOR_MASK, PLAYER_BACK_PANTS_OVERRIDES[String(i)] || PLAYER_BACK_PANTS_OVERRIDES['0'])
);
export const PLAYER_BACK_IDLE_COMPOSED = PLAYER_BACK_IDLE_PATTERNS.map(base =>
  composeFBPattern(base, PLAYER_BACK_HELMET_MASK, PLAYER_BACK_VISOR_MASK, PLAYER_BACK_PANTS_OVERRIDES['idle'])
);

const PLAYER_VOXEL_SIZE = 0.0665;
const PLAYER_SPRITE_CENTER_Y = PLAYER_VOXEL_SIZE * 5.25; // lowered so feet sit at ground level (group.y=0.15)
const PLAYER_VISUAL_SCALE = 1.12;
const CORNER_SETUP_PRESENTATION_SECONDS = 2.0;
const CORNER_RELEASE_PRESENTATION_SECONDS = 1.35;
const CORNER_RUNUP_DISTANCE = 1.15;
const CORNER_OUTSIDE_TOUCHLINE_OFFSET = 0.82;
const THROW_IN_SETUP_PRESENTATION_SECONDS = 1.9;
const THROW_IN_RELEASE_PRESENTATION_SECONDS = 1.15;
const THROW_IN_OUTSIDE_TOUCHLINE_OFFSET = 0.58;

export function buildPlayerFrame(pattern: string[], palette: { shirt: THREE.Material; pants: THREE.Material; hair: THREE.Material; visor: THREE.Material }) {
  const group = new THREE.Group();
  const voxelSize = PLAYER_VOXEL_SIZE;
  const rows = pattern.length;
  const cols = pattern[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = pattern[r][c];
      if (ch === '0') continue;
      let mat = palette.shirt;
      let part: 'shirt' | 'pants' | 'hair' | 'visor' = 'shirt';
      if (ch === 'H') { mat = palette.hair; part = 'hair'; }
      else if (ch === 'V') { mat = palette.visor; part = 'visor'; }
      else if (ch === 'S') { /* shirt - already default */ }
      else if (ch === 'P') { mat = palette.pants; part = 'pants'; }
      else if (ch === '1') {
        if (r < 2) { mat = palette.hair; part = 'hair'; }
        else if (r === 2 && c > 10 && c < 15) { mat = palette.visor; part = 'visor'; }
        else if (r > 9) { mat = palette.pants; part = 'pants'; }
      }
      const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize * 3.0);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.userData.uniformPart = part;
      mesh.castShadow = true;
      mesh.position.set((c - cols / 2) * voxelSize, (rows / 2 - r) * voxelSize, 0);
      group.add(mesh);
    }
  }
  return group;
}

// ── GPU-OPT-1: Merged voxel geometry ──
const _voxelTplBox = new THREE.BoxGeometry(1, 1, 1);
const _tplPos = (_voxelTplBox.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
const _tplNrm = (_voxelTplBox.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array;
const _tplIdx = _voxelTplBox.getIndex()!.array;
const VERTS_PER_BOX = 24;
const IDXS_PER_BOX = 36;

const _mergedPlayerMat = new THREE.MeshLambertMaterial({ vertexColors: true });

// Pre-compute per-template-vertex face-shading offsets
const _faceShadingOffsets = new Float32Array(VERTS_PER_BOX);
for (let _j = 0; _j < VERTS_PER_BOX; _j++) {
  const nx = _tplNrm[_j * 3], ny = _tplNrm[_j * 3 + 1], nz = _tplNrm[_j * 3 + 2];
  _faceShadingOffsets[_j] = nx > 0.5 ? -0.10 : nx < -0.5 ? 0.0 : ny > 0.5 ? 0.08 : ny < -0.5 ? -0.05 : nz < -0.5 ? -0.05 : 0.0;
}

type VoxelPart = 'shirt' | 'pants' | 'hair' | 'visor';

function materialForVoxelPart(part: VoxelPart, palette: PlayerPalette) {
  if (part === 'visor') return palette.visor;
  if (part === 'hair') return palette.hair;
  if (part === 'pants') return palette.pants;
  return palette.shirt;
}

export function buildMergedPlayerFrame(
  pattern: string[],
  palette: PlayerPalette
): THREE.Mesh {
  const voxelSize = PLAYER_VOXEL_SIZE;
  const depthSize = voxelSize * 3.0;
  const rows = pattern.length;
  const cols = pattern[0].length;

  // Collect voxels
  const parts: VoxelPart[] = [];
  const xs: number[] = [];
  const ys: number[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = pattern[r][c];
      if (ch === '0') continue;
      let part: VoxelPart = 'shirt';
      if (ch === 'H') part = 'hair';
      else if (ch === 'V') part = 'visor';
      else if (ch === 'S') { /* shirt */ }
      else if (ch === 'P') part = 'pants';
      else if (ch === '1') {
        if (r < 2) part = 'hair';
        else if (r === 2 && c > 10 && c < 15) part = 'visor';
        else if (r > 9) part = 'pants';
      }
      parts.push(part);
      xs.push((c - cols / 2) * voxelSize);
      ys.push((rows / 2 - r) * voxelSize);
    }
  }

  const voxelCount = parts.length;
  const totalVerts = voxelCount * VERTS_PER_BOX;
  const totalIdxs = voxelCount * IDXS_PER_BOX;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const indices = new Uint16Array(totalIdxs);

  for (let vi = 0; vi < voxelCount; vi++) {
    const part = parts[vi];
    const mat = materialForVoxelPart(part, palette);
    const baseColor = (mat as THREE.MeshStandardMaterial).color;
    const vx = xs[vi], vy = ys[vi];
    const posOff = vi * VERTS_PER_BOX * 3;
    const idxOff = vi * IDXS_PER_BOX;
    const vertBase = vi * VERTS_PER_BOX;

    for (let j = 0; j < VERTS_PER_BOX; j++) {
      const j3 = j * 3;
      const o = posOff + j3;
      positions[o]     = _tplPos[j3]     * voxelSize + vx;
      positions[o + 1] = _tplPos[j3 + 1] * voxelSize + vy;
      positions[o + 2] = _tplPos[j3 + 2] * depthSize;
      normals[o]     = _tplNrm[j3];
      normals[o + 1] = _tplNrm[j3 + 1];
      normals[o + 2] = _tplNrm[j3 + 2];
      const adj = _faceShadingOffsets[j];
      colors[o]     = Math.min(1, Math.max(0, baseColor.r + adj));
      colors[o + 1] = Math.min(1, Math.max(0, baseColor.g + adj));
      colors[o + 2] = Math.min(1, Math.max(0, baseColor.b + adj));
    }

    for (let j = 0; j < IDXS_PER_BOX; j++) {
      indices[idxOff + j] = _tplIdx[j] + vertBase;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const mesh = new THREE.Mesh(geo, _mergedPlayerMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.voxelPartMap = parts;
  mesh.userData.voxelCount = voxelCount;
  return mesh;
}

export function recolorMergedVoxelFrame(mesh: THREE.Mesh, palette: PlayerPalette) {
  const parts = mesh.userData.voxelPartMap as VoxelPart[];
  const count = mesh.userData.voxelCount as number;
  if (!parts || !count) return;
  const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const colors = colorAttr.array as Float32Array;

  for (let vi = 0; vi < count; vi++) {
    const part = parts[vi];
    const mat = materialForVoxelPart(part, palette);
    const baseColor = (mat as THREE.MeshStandardMaterial).color;
    const posOff = vi * VERTS_PER_BOX * 3;
    for (let j = 0; j < VERTS_PER_BOX; j++) {
      const j3 = j * 3;
      const o = posOff + j3;
      const adj = _faceShadingOffsets[j];
      colors[o]     = Math.min(1, Math.max(0, baseColor.r + adj));
      colors[o + 1] = Math.min(1, Math.max(0, baseColor.g + adj));
      colors[o + 2] = Math.min(1, Math.max(0, baseColor.b + adj));
    }
  }
  colorAttr.needsUpdate = true;
}

type SpriteFacingMode = 'side' | 'front' | 'back';
type KeeperDiveDirection = 'left' | 'right' | 'up' | 'down';
type KeeperReaction = { ttl: number; duration: number; zLean: number; direction: KeeperDiveDirection };
type WhistleAuditEvent = {
  reason: string;
  volume: number;
  assetPlayed: boolean;
  elapsed: number;
};
type KeeperAnimationEvent = {
  action: 'SAVE' | 'SMOTHER';
  team: string;
  keeperId: string;
  keeperName: string;
  direction: KeeperDiveDirection;
  duration: number;
  sourceEventSeq: number;
  phase: string;
  clock: string;
};
type HeaderReaction = { ttl: number; duration: number; kind: 'shot' | 'clearance' | 'touch'; direction: 1 | -1 };
type HeaderAnimationEvent = {
  action: 'HEADER_SHOT' | 'HEADER_CLEARANCE' | 'HEADER_TOUCH';
  team: string;
  playerId: string;
  playerName: string;
  kind: 'shot' | 'clearance' | 'touch';
  direction: 1 | -1;
  duration: number;
  sourceEventSeq: number;
  phase: string;
  clock: string;
};
type CornerPresentationEvent = {
  action: 'CORNER';
  team: string;
  phase: RestartPresentationPhase;
  requestedTakerId: string | null;
  takerId: string | null;
  takerName: string | null;
  usedFallback: boolean;
  spot: { x: number; z: number };
  sourceEventSeq: number;
  phaseName: string;
  clock: string;
};
type RestartPresentationType = 'throw_in' | 'corner' | 'goal_kick' | 'free_kick' | 'penalty' | 'drop_kick';
type RestartPresentationPhase = 'setup' | 'release';
type SoundBufferKey =
  | 'whistle'
  | 'kick'
  | 'shot'
  | 'catch'
  | 'crowd'
  | 'splashMusic'
  | 'welcome'
  | 'kickoff'
  | 'corner'
  | 'throw'
  | 'goal'
  | 'offside'
  | 'foul'
  | 'penalty'
  | 'out'
  | 'post';
type RestartPresentation = {
  type: RestartPresentationType;
  phase: RestartPresentationPhase;
  team: string;
  takerId: string | null;
  spot: { x: number; z: number };
  takerSpot: { x: number; z: number } | null;
  ttl: number;
  duration: number;
};
type PlayerVisual = {
  mesh: THREE.Group;
  spriteGroup: THREE.Group;
  runFrames: THREE.Mesh[];
  idleFrames: THREE.Mesh[];
  frontRunFrames: THREE.Mesh[];
  frontIdleFrames: THREE.Mesh[];
  backRunFrames: THREE.Mesh[];
  backIdleFrames: THREE.Mesh[];
  diveLeftFrames: THREE.Mesh[];
  diveRightFrames: THREE.Mesh[];
  diveUpFrames: THREE.Mesh[];
  diveDownFrames: THREE.Mesh[];
  allFrames: THREE.Mesh[];
  facingMode: SpriteFacingMode;
  dir: 1 | -1;
  state: 'IDLE' | 'RUN';
  frame: number;
  animTimer: number;
  animPhaseOffset: number;
  breathOffset: number;
};

const SOUND_ASSETS: Record<SoundBufferKey, string> = {
  whistle: '/whistle.mp3',
  kick: '/kick.mp3',
  shot: '/shot.mp3',
  catch: '/soft-body-impact.mp3',
  crowd: '/crowd.mp3',
  splashMusic: '/Pixel Soccer League.mp3',
  welcome: '/welcome.mp3',
  kickoff: '/kickoff.mp3',
  corner: '/corner.mp3',
  throw: '/throw.mp3',
  goal: '/announcer_goal.mp3',
  offside: '/offisides.mp3',
  foul: '/foul.mp3',
  penalty: '/penalty.mp3',
  out: '/out.mp3',
  post: '/donk.mp3',
};

const markPslPerf = (name: string) => {
  try {
    performance.mark(name);
    const bucket = ((window as any).pslPerf ??= { marks: {}, measures: {} });
    bucket.marks[name] = performance.now();
  } catch {}
};

const measurePslPerf = (name: string, start: string, end: string) => {
  try {
    performance.measure(name, start, end);
    const entries = performance.getEntriesByName(name, 'measure');
    const latest = entries[entries.length - 1];
    const bucket = ((window as any).pslPerf ??= { marks: {}, measures: {} });
    bucket.measures[name] = latest?.duration ?? null;
  } catch {}
};

class SimpleGameEngine {
  readonly model = new SimpleMatchModel();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 600);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  private readonly playerMeshes = new Map<string, PlayerVisual>();
  /** Aim arrow + power ring shown while a pass/shot is being charged. */
  private readonly chargeGroup = new THREE.Group();
  private readonly chargeArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1,
    0x63f7ff,
    0.6,
    0.28,
  );
  private readonly chargeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 32),
    new THREE.MeshBasicMaterial({ color: 0x63f7ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }),
  );
  private readonly selectedPlayerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.9, 32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  );
  private readonly refereePlayer = {
    id: 'referee',
    team: 'A',
    role: 'REF',
    name: 'Referee',
    shirtNumber: 0,
    pos: { x: 0, z: -8 },
    vel: { x: 0, z: 0 },
    targetPos: { x: 0, z: -8 },
  } as unknown as SimplePlayer;
  private readonly refereeVisual: PlayerVisual;
  private refereeInitialized = false;
  private readonly ballGroup: THREE.Group;
  private readonly ballMesh: THREE.Mesh;
  private readonly ballShadowMesh: THREE.Mesh;
  private readonly ballShadowMaterial: THREE.MeshBasicMaterial;
  private readonly ballTrail: THREE.Line;
  private readonly ballTrailPoints: THREE.Vector3[] = [];
  private shotBallTrailEnabled = true;
  private readonly eventCues: Array<{ mesh: THREE.Object3D; ttl: number }> = [];
  private readonly keeperReactions = new Map<string, KeeperReaction>();
  private readonly keeperAnimationEvents: KeeperAnimationEvent[] = [];
  private readonly headerReactions = new Map<string, HeaderReaction>();
  private readonly headerAnimationEvents: HeaderAnimationEvent[] = [];
  private readonly cornerPresentationEvents: CornerPresentationEvent[] = [];
  private activeRestartPresentation: RestartPresentation | null = null;
  private practiceModeEnabled = false;
  private practicePlayActive = false;
  private practicePlayTemplate: string | null = null;
  private practicePlayTimer: number | null = null;
  private readonly practiceRouteGroup = new THREE.Group();
  private readonly practiceRouteVisuals: THREE.Object3D[] = [];
  private readonly cameraFocusSmoothed = new THREE.Vector3();
  private readonly cameraLerpPosition = new THREE.Vector3();
  private readonly cameraLookTarget = new THREE.Vector3();
  private readonly broadcastCameraHome = new THREE.Vector3(0, 46, 42);
  /**
   * Camera rigs. Every mode used to resolve to the broadcast rig -- the
   * selector only stored a label -- so testers correctly reported that only
   * Broadcast worked.
   *
   * height/back: the rig's home position. followX/panZ: how much it tracks the
   * action. fov: lens. lookAhead: how far past the focus it aims.
   */
  private readonly cameraRigs: Record<string, { height: number; back: number; followX: number; panZ: number; fov: number; lookAhead: number }> = {
    BROADCAST: { height: 46, back: 42, followX: 0.70, panZ: 0.45, fov: 29, lookAhead: 0 },
    // Tighter, lower and closer behind the play.
    FOLLOW_BEHIND: { height: 26, back: 26, followX: 0.95, panZ: 0.85, fov: 38, lookAhead: 6 },
    // Low and square on, like a halfway-line camera.
    SIDELINE: { height: 16, back: 50, followX: 0.35, panZ: 0.12, fov: 26, lookAhead: 0 },
    // Static wide shot: no tracking at all.
    FIXED_ENDZONE: { height: 34, back: 58, followX: 0, panZ: 0, fov: 32, lookAhead: 0 },
    // Raised three-quarter view over the attacking end.
    GOAL_THREE_QUARTER: { height: 38, back: 30, followX: 0.85, panZ: 0.60, fov: 34, lookAhead: 4 },
    // Very high and wide, whole pitch in frame.
    STADIUM_CAM: { height: 74, back: 62, followX: 0.30, panZ: 0.20, fov: 24, lookAhead: 0 },
  };
  private cameraMode = 'BROADCAST';
  private cameraFocusInitialized = false;
  private crowdMesh: THREE.InstancedMesh | null = null;
  private readonly crowdBlocks: Array<{
    instanceIndex: number;
    baseX: number;
    baseY: number;
    baseZ: number;
    team: 'A' | 'B';
    toneIndex: number;
    angle: number;
    phase: number;
    speed: number;
    jumpHeight: number;
    vibeScale: number;
    vibePhaseX: number;
    vibePhaseZ: number;
    vibeSpeedX: number;
    vibeSpeedZ: number;
  }> = [];
  private readonly crowdDummy = new THREE.Object3D();
  private readonly bannerTexts: Text[] = [];
  private readonly goalNetMaterials: THREE.ShaderMaterial[] = [];
  private readonly goalNetPanels: Array<{
    origin: THREE.Vector3;
    axisU: THREE.Vector3;
    axisV: THREE.Vector3;
    normal: THREE.Vector3;
    material: THREE.ShaderMaterial;
  }> = [];
  private goalSwellUntil = 0;
  private waveStartTime = 0;
  private pendingGoalNetImpact: { target: THREE.Vector3; force: number; ttl: number } | null = null;
  private readonly clock = new THREE.Clock();
  private disposed = false;
  private backgroundModelTimer: number | null = null;
  private lastBackgroundModelTickMs = 0;
  private frameCount = 0;
  private fps = 60;
  private fpsTimer = 0;
  private onReset: (() => void) | null = null;
  private smokeTestMode = false;
  private practiceCompleteCallback: (() => void) | null = null;
  private processedLiveEvents = 0;
  private lastThrowInAnnouncementKey = '';
  private lastThrowInAnnouncementAt = -Infinity;
  private readonly scoreBugEl: HTMLDivElement;
  private scoreBugVisible = false;
  private lastScoreBugText = '';
  private paused = false;
  private readonly miniMapWidth = 322;
  private readonly miniMapHeight = 203;
  private readonly miniMapPitchPad = 8;
  private readonly miniMapTiltTransform = 'translateX(-50%) perspective(900px) rotateX(56deg)';
  private readonly miniMapPanelInset = 8;
  private readonly miniMapPanelWidth = Math.floor((this.miniMapWidth - this.miniMapPanelInset * 3) / 2);
  private readonly miniMapPitchCanvas: HTMLCanvasElement;
  private readonly miniMapOverlayCanvas: HTMLCanvasElement;
  private readonly miniMapToggleBtn: HTMLButtonElement;
  private readonly miniMapHomePanel: HTMLDivElement;
  private readonly miniMapAwayPanel: HTMLDivElement;
  private readonly miniMapBallTrail: Array<{ x: number; y: number }> = [];
  private lastMiniMapDrawMs = 0;
  private showMiniMap = true;
  private menuVisible = true;
  private splashSceneMode = false;
  private audioCtx: AudioContext | null = null;
  private audioMasterGain: GainNode | null = null;
  private audioPreloadStarted = false;
  private audioBytePreloadStarted = false;
  private readonly audioBytes: Partial<Record<SoundBufferKey, ArrayBuffer>> = {};
  private readonly audioFetchPromises: Partial<Record<SoundBufferKey, Promise<ArrayBuffer>>> = {};
  private readonly audioBuffers: Partial<Record<SoundBufferKey, AudioBuffer>> = {};
  private readonly audioDecodeStarted = new Set<SoundBufferKey>();
  private readonly oneShotAudioLastPlayedAt: Partial<Record<SoundBufferKey, number>> = {};
  private lastWhistleAt = -Infinity;
  private readonly whistleAuditEvents: WhistleAuditEvent[] = [];
  private readonly crowdLoop: {
    source: AudioBufferSourceNode | null;
    gain: GainNode | null;
    shouldPlay: boolean;
    baseVolume: number;
    ambientFrac: number;
  } = { source: null, gain: null, shouldPlay: false, baseVolume: 0.6, ambientFrac: 0.75 };
  private readonly splashMusic: { source: AudioBufferSourceNode | null; gain: GainNode | null } = { source: null, gain: null };
  private splashMusicRequested = false;
  private splashWelcomePlayed = false;
  private splashWelcomeTimer: number | null = null;
  private stadiumBuilt = false;
  private stadiumBuildHandle: number | null = null;
  private readonly engineBootedAt = Date.now();
  private engineRuntimeToken: string | null = null;
  private humanControlEnabled = false;
  private twoPlayerMode = false;
  private readonly pressedKeys = new Set<string>();
  private readonly gameplayGpPrev: boolean[] = new Array(17).fill(false);
  private readonly gamepadLatch = createGamepadLatch();

  private handleGameplayKeyDown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.code);
    if (event.repeat || !this.isModelActive()) return;
    if (this.humanControlEnabled) {
      if (event.code === 'Space' || event.code === 'KeyG') {
        event.preventDefault();
        this.model.beginManualCharge('A', 'pass');
      } else if (event.code === 'KeyF') {
        event.preventDefault();
        this.model.beginManualCharge('A', 'shot');
      } else if (event.code === 'KeyR') {
        event.preventDefault();
        this.model.triggerManualTackle('A');
      } else if (event.code === 'KeyC') {
        event.preventDefault();
        this.model.triggerManualLobPass('A');
      } else if (event.code === 'KeyV') {
        // Middle ground between AUTOMATIC and MANUAL switching: jump to the
        // player nearest the ball on demand.
        event.preventDefault();
        this.model.selectNearestManualPlayer('A');
      } else if (event.code === 'KeyQ') {
        event.preventDefault();
        this.model.cycleManualPlayer('A', -1);
      } else if (event.code === 'KeyE') {
        event.preventDefault();
        this.model.cycleManualPlayer('A', 1);
      }
    }
    if (this.twoPlayerMode) {
      if (event.code === 'Comma') {
        event.preventDefault();
        this.model.beginManualCharge('B', 'pass');
      } else if (event.code === 'Period') {
        event.preventDefault();
        this.model.beginManualCharge('B', 'shot');
      } else if (event.code === 'Slash') {
        event.preventDefault();
        this.model.triggerManualTackle('B');
      } else if (event.code === 'Semicolon') {
        event.preventDefault();
        this.model.triggerManualLobPass('B');
      } else if (event.code === 'Quote') {
        event.preventDefault();
        this.model.selectNearestManualPlayer('B');
      } else if (event.code === 'BracketLeft') {
        event.preventDefault();
        this.model.cycleManualPlayer('B', -1);
      } else if (event.code === 'BracketRight') {
        event.preventDefault();
        this.model.cycleManualPlayer('B', 1);
      }
    }
  };

  private handleGameplayKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
    // Release fires the charged action; power is however long it was held.
    if (this.humanControlEnabled && (event.code === 'Space' || event.code === 'KeyG' || event.code === 'KeyF')) {
      this.model.releaseManualCharge('A');
    }
    if (this.twoPlayerMode && (event.code === 'Comma' || event.code === 'Period')) {
      this.model.releaseManualCharge('B');
    }
  };

  constructor(private readonly container: HTMLElement) {
    markPslPerf('psl:engine:init:start');
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 100, 300);
    this.camera.position.copy(this.broadcastCameraHome);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setPixelRatio(Math.max(1, Math.min(1.25, window.devicePixelRatio || 1)));
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    markPslPerf('psl:renderer:ready');
    this.scoreBugEl = this.createScoreBug();
    this.container.appendChild(this.scoreBugEl);
    const miniMap = this.createMiniMap();
    this.miniMapPitchCanvas = miniMap.pitchCanvas;
    this.miniMapOverlayCanvas = miniMap.overlayCanvas;
    this.miniMapToggleBtn = miniMap.toggleButton;
    this.miniMapHomePanel = miniMap.homePanel;
    this.miniMapAwayPanel = miniMap.awayPanel;
    this.drawMiniMapPitch();
    this.applyMiniMapVisibility();
    this.model.setRuntimeProvenance({
      engineRuntimeToken: this.engineRuntimeToken,
      engineBootedAt: this.engineBootedAt,
    });

    this.addLights();
    this.addField();
    this.selectedPlayerRing.rotation.x = -Math.PI / 2;
    this.selectedPlayerRing.visible = false;
    this.selectedPlayerRing.name = 'manualSelectedPlayerRing';
    this.scene.add(this.selectedPlayerRing);
    this.chargeRing.rotation.x = -Math.PI / 2;
    this.chargeRing.renderOrder = 42;
    this.chargeArrow.line.renderOrder = 43;
    this.chargeArrow.cone.renderOrder = 43;
    (this.chargeArrow.line.material as THREE.Material).depthTest = false;
    (this.chargeArrow.cone.material as THREE.Material).depthTest = false;
    this.chargeGroup.name = 'manualChargeIndicator';
    this.chargeGroup.add(this.chargeRing);
    this.chargeGroup.add(this.chargeArrow);
    this.chargeGroup.visible = false;
    this.scene.add(this.chargeGroup);
    markPslPerf('psl:field:ready');
    this.scheduleStadiumBuild();
    this.refereeVisual = this.createPlayerVisual(this.refereePlayer, TEAM_PALETTES.referee);
    this.refereeVisual.mesh.name = 'refereeVisual';
    this.refereeVisual.mesh.visible = false;
    this.scene.add(this.refereeVisual.mesh);
    this.practiceRouteGroup.name = 'practiceRouteGroup';
    this.practiceRouteGroup.visible = false;
    this.scene.add(this.practiceRouteGroup);
    const ball = this.addBall();
    this.ballGroup = ball.group;
    this.ballMesh = ball.mesh;
    this.ballShadowMesh = ball.shadowMesh;
    this.ballShadowMaterial = ball.shadowMaterial;
    this.ballTrail = this.addBallTrail();
    this.syncPlayerMeshes();
    markPslPerf('psl:players:ready');
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.handleGameplayKeyDown);
    window.addEventListener('keyup', this.handleGameplayKeyUp);
    this.startBackgroundModelLoop();
    this.animate();
    this.preloadAudioBytes(['splashMusic', 'welcome', 'whistle']);
    markPslPerf('psl:engine:init:end');
    measurePslPerf('psl:engine:init', 'psl:engine:init:start', 'psl:engine:init:end');
  }

  private scheduleStadiumBuild() {
    if (this.stadiumBuilt || this.stadiumBuildHandle !== null) return;
    const build = () => {
      this.stadiumBuildHandle = null;
      if (this.disposed || this.stadiumBuilt) return;
      markPslPerf('psl:stadium:start');
      this.addStadium();
      this.stadiumBuilt = true;
      this.updateBannerText();
      markPslPerf('psl:stadium:ready');
      measurePslPerf('psl:stadium', 'psl:stadium:start', 'psl:stadium:ready');
    };
    const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, options?: { timeout?: number }) => number);
    this.stadiumBuildHandle = idle ? idle(build, { timeout: 1200 }) : window.setTimeout(build, 250);
  }

  resetMatch = () => {
    this.setPaused(false);
    this.deactivatePracticePlay();
    this.model.resetMatch();
    this.refereeInitialized = false;
    this.miniMapBallTrail.length = 0;
    this.syncPlayerMeshes();
    this.resetVisualCues();
    this.applyMiniMapVisibility();
    this.onReset?.();
  };

  startKickoffPresentation = (_fromUi = true) => {
    this.setPaused(false);
    this.menuVisible = false;
    this.splashSceneMode = false;
    this.miniMapBallTrail.length = 0;
    // Kickoff kills the theme for good. Crowd ambience carries the match --
    // music over live play drowns the whistle, kicks and crowd swells.
    this.splashMusicStop();
    this.preloadGameplayAudio();
    this.startCrowdLoop();
    this.model.setInteractiveHalftime(true);
    this.model.startMatch();
    this.updateScoreBug();
    this.applyMiniMapVisibility();
  };

  setTeamNames = (a: string, b: string) => {
    this.model.setTeamNames(a, b);
    this.syncPlayerMeshes();
    this.updateBannerText();
  };

  setTeamFormations = (a: string, b: string) => {
    this.model.setTeamFormations(a, b);
    this.syncPlayerMeshes();
  };

  setHalfDurationSeconds = (seconds: number) => this.model.setHalfDurationSeconds(seconds);
  setCpuVsCpu = (enabled: boolean) => {
    this.model.cpuVsCpu = !!enabled;
    if (enabled) {
      this.setHotSeatMode(false);
      this.setTwoPlayerMode(false);
    }
  };
  setInteractiveHalftime = (enabled: boolean) => this.model.setInteractiveHalftime(enabled);
  continueFromHalftime = (mode: 'manual' | 'auto_cpu' = 'manual') => {
    const continued = this.model.continueFromHalftime(mode);
    if (continued) {
      this.setPaused(false);
    }
    return continued;
  };
  setSeriesSpeedMul = (value: number) => this.model.setSeriesSpeedMul(value);
  setRestartDelays = (goalDelay: number, halfDelay: number) => this.model.setRestartDelays(goalDelay, halfDelay);
  setPaused = (paused: boolean) => {
    const next = !!paused;
    const changed = this.paused !== next;
    this.paused = next;
    if (changed) this.applyPausedAudio();
    this.updateScoreBug();
  };

  /**
   * Pause must silence everything, not just stop new sounds.
   * gameplayAudioEnabled() already blocks fresh one-shots while paused, but
   * looping sources (crowd, ambience) keep running because they were started
   * earlier -- so suspend the whole AudioContext and resume it on unpause.
   */
  private applyPausedAudio() {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state === 'closed') return;
    if (this.paused) {
      void ctx.suspend().catch(() => {});
      return;
    }
    if (!this.disposed && !this.splashSceneMode) void ctx.resume().catch(() => {});
  }
  togglePaused = () => {
    this.setPaused(!this.paused);
    return this.paused;
  };
  getPaused = () => this.paused;
  setSmokeTestMode = (active: boolean) => { this.smokeTestMode = !!active; };
  setOnReset = (callback: () => void) => { this.onReset = callback; };
  setAIStyle = (value: string) => { this.model.aiStyle = value; };
  setCameraMode = (value: string) => {
    this.cameraMode = this.cameraRigs[value] ? value : 'BROADCAST';
    this.model.cameraMode = this.cameraMode;
  };
  setPracticePlayCompleteCallback = (callback: () => void) => { this.practiceCompleteCallback = callback; };
  setPracticeMode = (enabled: boolean) => {
    this.practiceModeEnabled = !!enabled;
    if (!this.practiceModeEnabled) {
      this.deactivatePracticePlay();
      return;
    }
    this.practiceRouteGroup.visible = this.practiceRouteVisuals.length > 0;
  };
  setEngineRuntimeToken = (token: string | null) => {
    this.engineRuntimeToken = typeof token === 'string' && token.trim() ? token : null;
    this.model.setRuntimeProvenance({
      engineRuntimeToken: this.engineRuntimeToken,
      engineBootedAt: this.engineBootedAt,
    });
  };

  getMatchSnapshot = () => {
    const snapshot = this.model.getMatchSnapshot();
    return {
      ...snapshot,
      sessionActive: !this.splashSceneMode,
      engineRuntimeToken: this.engineRuntimeToken,
      engineBootedAt: this.engineBootedAt,
      // Drives the on-screen "your restart" prompt. Without it the hold is
      // invisible and reads as the game freezing.
      manualRestartPrompt: this.model.getManualRestartPrompt(),
    };
  };
  getIsLive = () => this.model.getMatchSnapshot().isLive;
  getLiveTelemetry = () => this.model.getLiveTelemetry();
  getPlayers = () => this.model.getPlayers();
  getSelectedPlayerStats = () => this.model.getSelectedPlayerStats();
  getSelectedDefensePlayerStats = () => this.model.getSelectedDefensePlayerStats();
  selectRandomDefensePlayer = () => this.model.getSelectedDefensePlayerStats();
  getRenderFps = () => this.fps;
  getTuningBundle = () => ({
    ...this.model.getTuningBundle(),
    sessionActive: !this.splashSceneMode,
    engineRuntimeToken: this.engineRuntimeToken,
    engineBootedAt: this.engineBootedAt,
    whistleAuditEvents: this.whistleAuditEvents.slice(-100),
    keeperAnimationEvents: this.keeperAnimationEvents.slice(-100),
    headerAnimationEvents: this.headerAnimationEvents.slice(-100),
    cornerPresentationEvents: this.cornerPresentationEvents.slice(-100),
  });
  getTeamAAttackSign = () => this.model.msm.clock.half === 1 ? 1 : -1;
  getPositionalDriftReport = () => [];

  setTeamColors = (team: 'A' | 'B', shirt: number, pants: number) => {
    const shirtMat = team === 'A' ? M.teamAShirt : M.teamBShirt;
    const pantsMat = team === 'A' ? M.teamAPants : M.teamBPants;
    shirtMat.color.setHex(shirt);
    pantsMat.color.setHex(pants);
    for (const player of this.model.players.filter((p) => p.team === team)) {
      this.recolorPlayerVisual(player);
    }
    this.refreshCrowdColors();
  };

  setUniform = (team: 'A' | 'B', shirt: number, pants: number) => this.setTeamColors(team, shirt, pants);
  setGroundVisible = (visible: boolean) => this.setNamedVisibility('ground', visible);
  setFieldVisible = (visible: boolean) => this.setNamedVisibility('fieldMarking', visible);
  setGrassVisible = (visible: boolean) => this.setNamedVisibility('pitch', visible);
  setShotBallTrailEnabled = (enabled: boolean) => {
    this.shotBallTrailEnabled = !!enabled;
    if (!this.shotBallTrailEnabled) this.clearBallTrail();
  };

  dispose = () => {
    this.disposed = true;
    if (this.practicePlayTimer !== null) {
      window.clearTimeout(this.practicePlayTimer);
      this.practicePlayTimer = null;
    }
    if (this.backgroundModelTimer !== null) {
      window.clearInterval(this.backgroundModelTimer);
      this.backgroundModelTimer = null;
    }
    if (this.stadiumBuildHandle !== null) {
      const cancelIdle = (window as any).cancelIdleCallback as undefined | ((handle: number) => void);
      if (cancelIdle) cancelIdle(this.stadiumBuildHandle);
      else window.clearTimeout(this.stadiumBuildHandle);
      this.stadiumBuildHandle = null;
    }
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleGameplayKeyDown);
    window.removeEventListener('keyup', this.handleGameplayKeyUp);
    this.resetVisualCues();
    this.stopAllAudio();
    this.renderer.dispose();
    this.container.removeChild(this.scoreBugEl);
    this.container.removeChild(this.miniMapPitchCanvas);
    this.container.removeChild(this.miniMapOverlayCanvas);
    this.container.removeChild(this.miniMapToggleBtn);
    this.container.removeChild(this.miniMapHomePanel);
    this.container.removeChild(this.miniMapAwayPanel);
    this.container.removeChild(this.renderer.domElement);
  };

  splashMusicStart = () => {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    this.splashMusicRequested = true;
    this.splashWelcomePlayed = false;
    void ctx.resume().catch(() => {});
    this.playLoop('splashMusic', this.splashMusic, 0.5);
    this.scheduleSplashWelcome(2000);
  };
  splashMusicStop = () => {
    this.splashMusicRequested = false;
    this.clearSplashWelcomeTimer();
    this.stopLoop(this.splashMusic, 0.45);
  };
  unlockGameplayAudio = () => {
    const ctx = this.ensureAudioContext();
    if (!ctx) return false;
    this.preloadAudio();
    if (!this.paused) void ctx.resume().catch(() => {});
    return true;
  };
  setSplashSceneMode = (active: boolean) => {
    this.splashSceneMode = !!active;
    this.applyMiniMapVisibility();
  };
  setMenuVisible = (visible: boolean) => {
    this.menuVisible = !!visible;
    this.applyMiniMapVisibility();
  };
  setScoreBugVisible = (visible: boolean) => {
    this.scoreBugVisible = !!visible;
    this.updateScoreBug();
  };
  setHotSeatMode = (enabled: boolean) => {
    this.humanControlEnabled = !!enabled;
    this.model.setManualControlEnabled('A', this.humanControlEnabled);
    if (!this.humanControlEnabled) this.model.setManualMove('A', 0, 0);
  };
  setTwoPlayerMode = (enabled: boolean) => {
    this.twoPlayerMode = !!enabled;
    this.model.setManualControlEnabled('B', this.twoPlayerMode);
    if (!this.twoPlayerMode) this.model.setManualMove('B', 0, 0);
  };
  setTestingMode = (_enabled: boolean) => {};
  setRealDataReplayMode = (_enabled: boolean) => {};
  setUseNewArchitecture = (_enabled: boolean) => {};
  setShowOrchTelemetry = (_enabled: boolean) => {};
  setAutoSwitching = (mode: string) => {
    const allowed = ['AUTOMATIC', 'AIR_BALLS', 'LOOSE_BALLS', 'MANUAL'] as const;
    const next = (allowed as readonly string[]).includes(mode) ? mode as typeof allowed[number] : 'AUTOMATIC';
    this.model.setAutoSwitchMode('A', next);
    this.model.setAutoSwitchMode('B', next);
  };
  /**
   * Coaching intent per team. Modifies the team's rated tuning rather than
   * replacing it, so FIFA/MLS strength still decides who is better.
   */
  setTeamAggression = (team: 'A' | 'B', key: string) => {
    const allowed = ['BALANCED', 'AGGRESSIVE', 'POSSESSION'] as const;
    const next = (allowed as readonly string[]).includes(key) ? key as typeof allowed[number] : 'BALANCED';
    this.model.setTeamAggression(team, next);
  };
  setTeamLogos = (_a: string, _b: string) => {};
  setCrowdVolume = (value: number) => {
    this.crowdLoop.baseVolume = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    if (this.crowdLoop.gain && this.audioCtx) {
      this.crowdLoop.gain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.crowdLoop.gain.gain.setValueAtTime(this.crowdLoop.gain.gain.value, this.audioCtx.currentTime);
      this.crowdLoop.gain.gain.linearRampToValueAtTime(this.crowdLoop.baseVolume * this.crowdLoop.ambientFrac, this.audioCtx.currentTime + 0.15);
    }
  };
  drawPracticeRoutes = (routes: unknown) => {
    this.clearPracticeRoutes();
    if (!this.practiceModeEnabled || !Array.isArray(routes)) return;
    for (const route of routes as RouteData[]) {
      if (!route || !Number.isFinite(route.fromX) || !Number.isFinite(route.fromZ) || !Number.isFinite(route.toX) || !Number.isFinite(route.toZ)) continue;
      const visual = this.createPracticeRouteVisual(route);
      this.practiceRouteGroup.add(visual);
      this.practiceRouteVisuals.push(visual);
    }
    this.practiceRouteGroup.visible = this.practiceRouteVisuals.length > 0;
  };
  clearPracticeRoutes = () => {
    while (this.practiceRouteVisuals.length > 0) {
      const visual = this.practiceRouteVisuals.pop();
      if (!visual) continue;
      this.disposePracticeRouteVisual(visual);
      this.practiceRouteGroup.remove(visual);
    }
    this.practiceRouteGroup.visible = false;
  };
  isPracticePlayActive = () => this.practiceModeEnabled && this.practicePlayActive;
  activatePracticePlay = (_routes: unknown, template: unknown) => {
    this.practicePlayActive = true;
    this.practicePlayTemplate = typeof template === 'string' ? template : null;
    if (this.practicePlayTimer !== null) window.clearTimeout(this.practicePlayTimer);
    this.practicePlayTimer = window.setTimeout(() => {
      this.practicePlayTimer = null;
      this.practicePlayActive = false;
      this.practiceCompleteCallback?.();
    }, 1200);
  };
  deactivatePracticePlay = () => {
    this.practicePlayActive = false;
    this.practicePlayTemplate = null;
    if (this.practicePlayTimer !== null) {
      window.clearTimeout(this.practicePlayTimer);
      this.practicePlayTimer = null;
    }
    this.clearPracticeRoutes();
  };
  resetAndStartPracticePlay = (redraw?: () => void) => {
    this.deactivatePracticePlay();
    this.startKickoffPresentation(true);
    if (typeof redraw !== 'function') return;
    const run = () => redraw();
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  };

  private createPracticeRouteVisual(route: RouteData) {
    const origin = new THREE.Vector3(route.fromX, 0.24, route.fromZ);
    const delta = new THREE.Vector3(route.toX - route.fromX, 0, route.toZ - route.fromZ);
    const length = Math.max(0.001, delta.length());
    const direction = delta.clone().normalize();
    const arrow = new THREE.ArrowHelper(
      direction,
      origin,
      length,
      route.color,
      Math.min(1.1, Math.max(0.45, length * 0.18)),
      Math.min(0.32, Math.max(0.12, length * 0.08)),
    );
    arrow.line.renderOrder = 40;
    arrow.cone.renderOrder = 41;
    (arrow.line.material as THREE.Material).depthTest = false;
    (arrow.cone.material as THREE.Material).depthTest = false;
    const startDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshBasicMaterial({ color: route.color }),
    );
    startDot.position.copy(origin);
    startDot.renderOrder = 42;
    const endDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      new THREE.MeshBasicMaterial({ color: route.color }),
    );
    endDot.position.set(route.toX, 0.24, route.toZ);
    endDot.renderOrder = 42;
    const group = new THREE.Group();
    group.name = `practiceRoute:${route.fromX.toFixed(2)}:${route.fromZ.toFixed(2)}:${route.toX.toFixed(2)}:${route.toZ.toFixed(2)}`;
    group.add(arrow);
    group.add(startDot);
    group.add(endDot);
    group.renderOrder = 40;
    return group;
  }

  private disposePracticeRouteVisual(root: THREE.Object3D) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments)) return;
      child.geometry?.dispose?.();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose?.());
      } else {
        material?.dispose?.();
      }
    });
  }

  private ensureAudioContext() {
    if (this.disposed) return null;
    if (!this.audioCtx) {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      this.audioCtx = new AudioCtor();
      this.audioMasterGain = this.audioCtx.createGain();
      this.audioMasterGain.gain.value = 0.62;
      this.audioMasterGain.connect(this.audioCtx.destination);
      this.audioCtx.addEventListener('statechange', () => {
        if (this.audioCtx?.state === 'running' && this.crowdLoop.shouldPlay && !this.crowdLoop.source) {
          this.startCrowdLoop();
        }
      });
    }
    this.preloadAudio(['splashMusic', 'welcome', 'whistle']);
    return this.audioCtx;
  }

  private preloadAudioBytes(keys?: SoundBufferKey[]) {
    if (this.disposed) return;
    const entries = keys ?? (Object.keys(SOUND_ASSETS) as SoundBufferKey[]);
    if (!keys) this.audioBytePreloadStarted = true;
    for (const key of entries) {
      if (this.audioBytes[key] || this.audioFetchPromises[key]) continue;
      this.audioFetchPromises[key] = fetch(SOUND_ASSETS[key])
        .then((response) => {
          if (!response.ok) throw new Error(`Audio fetch failed: ${SOUND_ASSETS[key]}`);
          return response.arrayBuffer();
        })
        .then((buffer) => {
          this.audioBytes[key] = buffer;
          return buffer;
        })
        .catch(() => {
          delete this.audioFetchPromises[key];
          return new ArrayBuffer(0);
        });
    }
  }

  private preloadAudio(keys?: SoundBufferKey[]) {
    if (!this.audioCtx) return;
    if (!keys) {
      this.audioPreloadStarted = true;
      if (!this.audioBytePreloadStarted) this.preloadAudioBytes();
    }
    const decodeOrder: SoundBufferKey[] = keys ?? ['splashMusic', 'welcome', 'crowd', ...((Object.keys(SOUND_ASSETS) as SoundBufferKey[]).filter((key) => key !== 'splashMusic' && key !== 'welcome' && key !== 'crowd'))];
    for (const key of decodeOrder) {
      if (this.audioBuffers[key] || this.audioDecodeStarted.has(key)) continue;
      this.audioDecodeStarted.add(key);
      const bytes = this.audioBytes[key]
        ? Promise.resolve(this.audioBytes[key] as ArrayBuffer)
        : (this.audioFetchPromises[key] ?? fetch(SOUND_ASSETS[key]).then((response) => response.arrayBuffer()));
      this.audioFetchPromises[key] = bytes;
      void bytes
        .then((buffer) => {
          if (buffer.byteLength <= 0) throw new Error(`Audio fetch failed: ${SOUND_ASSETS[key]}`);
          this.audioBytes[key] = buffer;
          const copy = buffer.slice(0);
          return this.audioCtx?.decodeAudioData(copy);
        })
        .then((decoded) => {
          if (!decoded) return;
          this.audioBuffers[key] = decoded;
          if (key === 'crowd' && this.crowdLoop.shouldPlay) this.startCrowdLoop();
          if (key === 'splashMusic' && this.splashMusicRequested) this.playLoop('splashMusic', this.splashMusic, 0.5);
          if (key === 'welcome' && this.splashMusicRequested && !this.splashWelcomePlayed && this.splashWelcomeTimer === null) this.scheduleSplashWelcome(0);
        })
        .catch(() => {});
    }
  }

  private preloadGameplayAudio() {
    if (!this.audioCtx || this.audioPreloadStarted) return;
    this.preloadAudio();
  }

  private audioDestination() {
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.audioMasterGain) return null;
    // Never auto-resume while paused: that would undo the deliberate suspend
    // in applyPausedAudio() the moment anything asked for an audio node.
    if (ctx.state === 'suspended' && !this.paused) void ctx.resume().catch(() => {});
    return { ctx, destination: this.audioMasterGain };
  }

  private gameplayAudioEnabled() {
    return !this.disposed && !this.splashSceneMode && !this.paused;
  }

  private playBuffer(key: SoundBufferKey, volume = 0.3, fadeSeconds = 0.08, minIntervalSeconds = 0) {
    const audio = this.audioDestination();
    const buffer = this.audioBuffers[key];
    if (!audio) return false;
    if (!buffer) {
      this.preloadAudio([key]);
      return false;
    }
    const now = audio.ctx.currentTime;
    const lastPlayedAt = this.oneShotAudioLastPlayedAt[key] ?? -Infinity;
    if (minIntervalSeconds > 0 && now - lastPlayedAt < minIntervalSeconds) return true;
    this.oneShotAudioLastPlayedAt[key] = now;
    const source = audio.ctx.createBufferSource();
    const gain = audio.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, now);
    const duration = Number.isFinite(buffer.duration) && buffer.duration > 0 ? buffer.duration : 0;
    if (fadeSeconds > 0 && duration > fadeSeconds + 0.04) {
      const fadeStart = now + Math.max(0, duration - fadeSeconds);
      gain.gain.setValueAtTime(volume, fadeStart);
      gain.gain.linearRampToValueAtTime(0, now + duration);
    }
    source.connect(gain);
    gain.connect(audio.destination);
    source.start(now);
    if (duration > 0) source.stop(now + duration + 0.05);
    source.onended = () => {
      try { source.disconnect(); gain.disconnect(); } catch {}
    };
    return true;
  }

  private playGameplayBuffer(key: SoundBufferKey, volume = 0.3, fadeSeconds = 0.08, minIntervalSeconds = 0) {
    if (!this.gameplayAudioEnabled()) return;
    this.playBuffer(key, volume, fadeSeconds, minIntervalSeconds);
  }

  private playWhistle(volume = 0.46) {
    if (!this.gameplayAudioEnabled()) return;
    const now = this.clock.elapsedTime;
    if (now - this.lastWhistleAt < 0.55) return;
    this.lastWhistleAt = now;
    const boostedVolume = Math.max(volume, 0.74);
    const assetPlayed = this.playBuffer('whistle', boostedVolume, 0.02, 0.55);
    this.whistleAuditEvents.push({ reason: 'stoppage', volume: boostedVolume, assetPlayed, elapsed: +now.toFixed(2) });
    while (this.whistleAuditEvents.length > 100) this.whistleAuditEvents.shift();
  }

  private playLoop(key: SoundBufferKey, loop: { source: AudioBufferSourceNode | null; gain: GainNode | null }, volume: number) {
    const audio = this.audioDestination();
    const buffer = this.audioBuffers[key];
    if (!audio || !buffer || loop.source) return;
    const source = audio.ctx.createBufferSource();
    const gain = audio.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, audio.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, audio.ctx.currentTime + 1.0);
    source.connect(gain);
    gain.connect(audio.destination);
    source.start();
    loop.source = source;
    loop.gain = gain;
    source.onended = () => {
      if (loop.source === source) {
        loop.source = null;
        loop.gain = null;
      }
    };
  }

  private stopLoop(loop: { source: AudioBufferSourceNode | null; gain: GainNode | null }, fadeSeconds = 1.0) {
    if (!loop.source || !loop.gain || !this.audioCtx) return;
    const source = loop.source;
    const gain = loop.gain;
    loop.source = null;
    loop.gain = null;
    gain.gain.cancelScheduledValues(this.audioCtx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + fadeSeconds);
    window.setTimeout(() => {
      try { source.stop(); source.disconnect(); gain.disconnect(); } catch {}
    }, Math.ceil((fadeSeconds + 0.1) * 1000));
  }

  private startCrowdLoop() {
    if (!this.gameplayAudioEnabled()) return;
    this.crowdLoop.shouldPlay = true;
    this.preloadAudio(['crowd']);
    this.playLoop('crowd', this.crowdLoop, this.crowdLoop.baseVolume * this.crowdLoop.ambientFrac);
  }

  private triggerGoalCrowdSwell() {
    this.startCrowdLoop();
    if (!this.audioCtx || !this.crowdLoop.gain) return;
    const now = this.audioCtx.currentTime;
    const base = THREE.MathUtils.clamp(this.crowdLoop.baseVolume * this.crowdLoop.ambientFrac, 0, 1);
    const boosted = THREE.MathUtils.clamp(base * 1.10, 0, 1);
    this.crowdLoop.gain.gain.cancelScheduledValues(now);
    this.crowdLoop.gain.gain.setValueAtTime(this.crowdLoop.gain.gain.value, now);
    this.crowdLoop.gain.gain.linearRampToValueAtTime(boosted, now + 0.25);
    this.crowdLoop.gain.gain.setValueAtTime(boosted, now + 8.0);
    this.crowdLoop.gain.gain.linearRampToValueAtTime(base, now + 9.25);
  }

  private stopCrowdLoop() {
    this.crowdLoop.shouldPlay = false;
    this.stopLoop(this.crowdLoop, 1.4);
  }

  private playSplashWelcomeOnce() {
    if (this.splashWelcomePlayed || !this.splashMusicRequested) return;
    if (!this.playBuffer('welcome', 0.48)) {
      this.scheduleSplashWelcome(200);
      return;
    }
    this.splashWelcomePlayed = true;
  }

  private scheduleSplashWelcome(delayMs: number) {
    if (this.splashWelcomePlayed || !this.splashMusicRequested) return;
    this.clearSplashWelcomeTimer();
    this.splashWelcomeTimer = window.setTimeout(() => {
      this.splashWelcomeTimer = null;
      this.playSplashWelcomeOnce();
    }, delayMs);
  }

  private clearSplashWelcomeTimer() {
    if (this.splashWelcomeTimer === null) return;
    window.clearTimeout(this.splashWelcomeTimer);
    this.splashWelcomeTimer = null;
  }

  private stopAllAudio() {
    this.clearSplashWelcomeTimer();
    this.stopCrowdLoop();
    this.stopLoop(this.splashMusic, 0.1);
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.audioMasterGain = null;
  }

  private playSoundForLiveEvent(event: { action: string; meta?: Record<string, unknown> }) {
    if (!this.gameplayAudioEnabled()) return;
    switch (event.action) {
      case 'KICKOFF':
        if (event.meta?.phase === 'release') {
          this.playGameplayBuffer('kick', 0.26, 0.24);
          break;
        }
        this.playGameplayBuffer('kickoff', 0.42, 0.8);
        this.playWhistle(0.48);
        this.startCrowdLoop();
        break;
      case 'PASS':
      case 'LIVE':
        this.playGameplayBuffer('kick', 0.22, 0.25);
        break;
      case 'SHOT':
        this.playGameplayBuffer('shot', 0.34, 0.32);
        break;
      case 'WOODWORK':
      case 'POST':
      case 'CROSSBAR':
        this.playGameplayBuffer('post', 0.48, 0.65);
        break;
      case 'GOAL':
        this.playWhistle(0.48);
        this.playGameplayBuffer('goal', 0.55, 1.4);
        this.triggerGoalCrowdSwell();
        break;
      case 'SAVE':
      case 'SMOTHER':
      case 'GK':
        this.playGameplayBuffer('catch', 0.28, 0.28);
        break;
      case 'TACKLE':
      case 'TURNOVER':
        // Won: a firmer hit than a routine catch so it reads as a challenge.
        this.playGameplayBuffer('catch', 0.46, 0.30);
        this.playGameplayBuffer('kick', 0.18, 0.20);
        break;
      case 'TACKLE_MISS':
        // Missed: quieter and thinner, so success and failure sound different.
        this.playGameplayBuffer('throw', 0.16, 0.18);
        break;
      case 'THROW':
        break;
      case 'THROW_IN':
        if (event.meta?.phase === 'setup') {
          this.playWhistle(0.42);
          const key = this.restartAnnouncementKey(event);
          if (key !== this.lastThrowInAnnouncementKey || this.clock.elapsedTime - this.lastThrowInAnnouncementAt > 4) {
            this.lastThrowInAnnouncementKey = key;
            this.lastThrowInAnnouncementAt = this.clock.elapsedTime;
            this.playGameplayBuffer('throw', 0.36, 0.08, 2.5);
          }
        }
        break;
      case 'CORNER':
        if (event.meta?.phase === 'setup') {
          this.playWhistle(0.42);
          this.playGameplayBuffer('corner', 0.38, 0.8);
        }
        else this.playGameplayBuffer('kick', 0.28, 0.3);
        break;
      case 'GOAL_KICK':
        if (event.meta?.phase === 'setup') this.playWhistle(0.4);
        else this.playGameplayBuffer('kick', 0.3, 0.35);
        break;
      case 'DROP_KICK':
        this.playGameplayBuffer('kick', 0.34, 0.35);
        break;
      case 'FREE_KICK':
        if (event.meta?.phase === 'setup') this.playWhistle(0.44);
        else this.playGameplayBuffer('kick', 0.3, 0.35);
        break;
      case 'PENALTY':
        if (event.meta?.phase === 'setup') {
          this.playWhistle(0.5);
          this.playGameplayBuffer('penalty', 0.44, 0.9);
        } else {
          this.playGameplayBuffer('shot', 0.34, 0.34);
        }
        break;
      case 'OFFSIDE':
        this.playWhistle(0.5);
        this.playGameplayBuffer('offside', 0.42, 0.9);
        break;
      case 'FOUL':
        this.playWhistle(0.5);
        this.playGameplayBuffer('foul', 0.42, 0.9);
        break;
      case 'HALF':
      case 'FULL':
        this.playWhistle(0.5);
        if (event.action === 'FULL') this.stopCrowdLoop();
        break;
      default:
        break;
    }
  }

  private restartAnnouncementKey(event: { team?: string; action: string; meta?: Record<string, unknown> }) {
    const spot = this.pointFromMeta(event.meta?.spot);
    const takerId = typeof event.meta?.takerId === 'string' ? event.meta.takerId : '';
    const restartType = typeof event.meta?.restartType === 'string' ? event.meta.restartType : event.action;
    return `${event.team || ''}|${restartType}|${takerId}|${spot ? `${spot.x.toFixed(1)},${spot.z.toFixed(1)}` : ''}`;
  }

  private addLights() {
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(amb);
    const hemi = new THREE.HemisphereLight(0xcae1ff, 0x3c5f35, 0.6);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-32, 40, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.012;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -84;
    sun.shadow.camera.right = 84;
    sun.shadow.camera.top = 64;
    sun.shadow.camera.bottom = -64;
    sun.shadow.radius = 1.25;
    this.scene.add(sun);
    this.scene.add(sun.target);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(26, 11, -18);
    this.scene.add(rim);
    const sidelineFill = new THREE.DirectionalLight(0xffffff, 0.2);
    sidelineFill.position.set(-6, 8, 28);
    this.scene.add(sidelineFill);
    const turfBounce = new THREE.DirectionalLight(0x9ac27d, 0.1);
    turfBounce.position.set(0, -8, 0);
    this.scene.add(turfBounce);
  }

  private addField() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({ color: 0x2e8b2e, roughness: 0.92, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);

    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W, FIELD_D),
      new THREE.MeshStandardMaterial({ color: 0x2e8b2e, map: this.createGrassTexture(), roughness: 0.88, metalness: 0 }),
    );
    pitch.name = 'pitch';
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.01;
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lineHeight = 0.035;
    const lineThickness = 0.16;
    const addPitchLine = (w: number, d: number, x: number, z: number) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, lineHeight, d), lineMaterial);
      line.position.set(x, 0.04, z);
      line.receiveShadow = true;
      line.name = 'fieldMarking';
      this.scene.add(line);
      return line;
    };

    addPitchLine(FIELD_W, lineThickness, 0, -FIELD_D / 2);
    addPitchLine(FIELD_W, lineThickness, 0, FIELD_D / 2);
    addPitchLine(lineThickness, FIELD_D, LEFT_GOAL_X, 0);
    addPitchLine(lineThickness, FIELD_D, RIGHT_GOAL_X, 0);
    addPitchLine(lineThickness, FIELD_D, 0, 0);

    addPitchLine(PENALTY_DEPTH, lineThickness, LEFT_GOAL_X + PENALTY_DEPTH / 2, -PENALTY_HALF_Z);
    addPitchLine(PENALTY_DEPTH, lineThickness, LEFT_GOAL_X + PENALTY_DEPTH / 2, PENALTY_HALF_Z);
    addPitchLine(lineThickness, PENALTY_HALF_Z * 2, LEFT_PENALTY_X, 0);
    addPitchLine(PENALTY_DEPTH, lineThickness, RIGHT_GOAL_X - PENALTY_DEPTH / 2, -PENALTY_HALF_Z);
    addPitchLine(PENALTY_DEPTH, lineThickness, RIGHT_GOAL_X - PENALTY_DEPTH / 2, PENALTY_HALF_Z);
    addPitchLine(lineThickness, PENALTY_HALF_Z * 2, RIGHT_PENALTY_X, 0);

    addPitchLine(GOAL_BOX_DEPTH, lineThickness, LEFT_GOAL_X + GOAL_BOX_DEPTH / 2, -GOAL_BOX_HALF_Z);
    addPitchLine(GOAL_BOX_DEPTH, lineThickness, LEFT_GOAL_X + GOAL_BOX_DEPTH / 2, GOAL_BOX_HALF_Z);
    addPitchLine(lineThickness, GOAL_BOX_HALF_Z * 2, LEFT_GOAL_X + GOAL_BOX_DEPTH, 0);
    addPitchLine(GOAL_BOX_DEPTH, lineThickness, RIGHT_GOAL_X - GOAL_BOX_DEPTH / 2, -GOAL_BOX_HALF_Z);
    addPitchLine(GOAL_BOX_DEPTH, lineThickness, RIGHT_GOAL_X - GOAL_BOX_DEPTH / 2, GOAL_BOX_HALF_Z);
    addPitchLine(lineThickness, GOAL_BOX_HALF_Z * 2, RIGHT_GOAL_X - GOAL_BOX_DEPTH, 0);

    this.addFieldDot(0, 0, lineMaterial);
    this.addFieldDot(LEFT_GOAL_X + PENALTY_SPOT_DIST, 0, lineMaterial);
    this.addFieldDot(RIGHT_GOAL_X - PENALTY_SPOT_DIST, 0, lineMaterial);
    const centerCircle = new THREE.Mesh(
      new THREE.TorusGeometry(CENTER_CIRCLE_RADIUS, lineThickness * 0.45, 12, 96),
      lineMaterial,
    );
    centerCircle.rotation.x = Math.PI / 2;
    centerCircle.position.set(0, 0.045, 0);
    centerCircle.name = 'fieldMarking';
    this.scene.add(centerCircle);

    const cornerRadius = FIELD_SCALE_PER_YARD;
    const makeCornerArc = (x: number, z: number, startAngle: number) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(cornerRadius, lineThickness * 0.45, 10, 48, Math.PI / 2),
        lineMaterial,
      );
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = startAngle;
      arc.position.set(x, 0.045, z);
      arc.name = 'fieldMarking';
      this.scene.add(arc);
    };
    makeCornerArc(LEFT_GOAL_X, -FIELD_D / 2, 0);
    makeCornerArc(RIGHT_GOAL_X, -FIELD_D / 2, Math.PI / 2);
    makeCornerArc(RIGHT_GOAL_X, FIELD_D / 2, Math.PI);
    makeCornerArc(LEFT_GOAL_X, FIELD_D / 2, -Math.PI / 2);

    this.addCornerFlags();
    this.addSoccerGoal(LEFT_GOAL_X, 1);
    this.addSoccerGoal(RIGHT_GOAL_X, -1);
  }

  private createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#2e8b2e';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#4caf50';
    ctx.globalAlpha = 0.22;
    ctx.fillRect(0, 0, 256, 128);
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = Math.random() * 2.5 + 0.8;
      ctx.fillStyle = Math.random() > 0.5 ? '#358f35' : '#277527';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 12);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private addFieldDot(x: number, z: number, material: THREE.Material) {
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 16), material);
    dot.position.set(x, 0.055, z);
    dot.name = 'fieldMarking';
    this.scene.add(dot);
  }

  private addCornerFlags() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.3 });
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xff4444, side: THREE.DoubleSide, roughness: 0.6 });
    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(0.45, 0.15);
    flagShape.lineTo(0, 0.3);
    flagShape.closePath();
    const flagGeo = new THREE.ShapeGeometry(flagShape);
    for (const [x, z] of [
      [LEFT_GOAL_X, -FIELD_D / 2],
      [RIGHT_GOAL_X, -FIELD_D / 2],
      [RIGHT_GOAL_X, FIELD_D / 2],
      [LEFT_GOAL_X, FIELD_D / 2],
    ] as Array<[number, number]>) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 0.75, z);
      pole.castShadow = true;
      pole.name = 'cornerFlag';
      this.scene.add(pole);
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(x, 1.2, z);
      flag.rotation.y = Math.atan2(-z, -x);
      flag.name = 'cornerFlag';
      this.scene.add(flag);
    }
  }

  private createGoalNetLineMaterial(panelNormal: THREE.Vector3) {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      uniforms: {
        uTime: { value: 0 },
        uPanelNormal: { value: panelNormal.clone() },
        uBaseColor: { value: new THREE.Color(0xffffff) },
        uImpacts: {
          value: [
            new THREE.Vector4(-10, -10, -100, 0),
            new THREE.Vector4(-10, -10, -100, 0),
            new THREE.Vector4(-10, -10, -100, 0),
            new THREE.Vector4(-10, -10, -100, 0),
          ],
        },
      },
      vertexShader: `
        uniform float uTime;
        uniform vec3 uPanelNormal;
        uniform vec4 uImpacts[4];
        varying float vRipple;
        void main() {
          vec3 displaced = position;
          float ripple = 0.0;
          for (int i = 0; i < 4; i++) {
            vec4 impact = uImpacts[i];
            if (impact.w <= 0.0001 || uTime < impact.z) continue;
            float age = uTime - impact.z;
            vec2 delta = uv - impact.xy;
            float dist = length(delta);
            float wave = sin(dist * 20.0 - age * 9.0) * exp(-dist * 4.0 - age * 1.4);
            ripple += wave * impact.w;
          }
          displaced += uPanelNormal * (ripple * 0.85);
          displaced.y -= abs(ripple) * 0.28;
          vRipple = ripple;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor;
        varying float vRipple;
        void main() {
          float crest = clamp(abs(vRipple) * 3.2, 0.0, 1.0);
          vec3 color = mix(uBaseColor, vec3(1.0), crest * 0.42);
          gl_FragColor = vec4(color, 0.92);
        }
      `,
    });
    this.goalNetMaterials.push(material);
    return material;
  }

  private buildGoalNetPanel(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, segU = 24, segV = 18) {
    const positions: number[] = [];
    const uvs: number[] = [];
    const sample = (u: number, v: number) => a.clone().multiplyScalar((1 - u) * (1 - v))
      .add(b.clone().multiplyScalar(u * (1 - v)))
      .add(c.clone().multiplyScalar(u * v))
      .add(d.clone().multiplyScalar((1 - u) * v));
    const pushSegment = (p0: THREE.Vector3, p1: THREE.Vector3, uv0: [number, number], uv1: [number, number]) => {
      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      uvs.push(uv0[0], uv0[1], uv1[0], uv1[1]);
    };

    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      for (let i = 0; i < segU; i++) pushSegment(sample(i / segU, v), sample((i + 1) / segU, v), [i / segU, v], [(i + 1) / segU, v]);
    }
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      for (let j = 0; j < segV; j++) pushSegment(sample(u, j / segV), sample(u, (j + 1) / segV), [u, j / segV], [u, (j + 1) / segV]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const axisU = b.clone().sub(a);
    const axisV = d.clone().sub(a);
    const normal = new THREE.Vector3().crossVectors(axisU, axisV).normalize();
    const material = this.createGoalNetLineMaterial(normal);
    const net = new THREE.LineSegments(geometry, material);
    net.name = 'goalNet';
    net.renderOrder = 2 + this.goalNetPanels.length;
    this.goalNetPanels.push({ origin: a.clone(), axisU, axisV, normal, material });
    this.scene.add(net);
  }

  private addGoalNetImpact(worldPos: THREE.Vector3, force: number) {
    let bestPanel: (typeof this.goalNetPanels)[number] | null = null;
    let bestScore = Infinity;
    for (const panel of this.goalNetPanels) {
      const offset = worldPos.clone().sub(panel.origin);
      const uLenSq = Math.max(panel.axisU.lengthSq(), 0.0001);
      const vLenSq = Math.max(panel.axisV.lengthSq(), 0.0001);
      const u = offset.dot(panel.axisU) / uLenSq;
      const v = offset.dot(panel.axisV) / vLenSq;
      const planeDist = Math.abs(offset.dot(panel.normal));
      if (u < -0.15 || u > 1.15 || v < -0.15 || v > 1.15 || planeDist > 1.8) continue;
      const centeredPenalty = Math.abs(u - 0.5) + Math.abs(v - 0.5) + planeDist * 0.6;
      if (centeredPenalty < bestScore) {
        bestScore = centeredPenalty;
        bestPanel = panel;
      }
    }
    if (!bestPanel) return;
    const offset = worldPos.clone().sub(bestPanel.origin);
    const u = THREE.MathUtils.clamp(offset.dot(bestPanel.axisU) / Math.max(bestPanel.axisU.lengthSq(), 0.0001), 0, 1);
    const v = THREE.MathUtils.clamp(offset.dot(bestPanel.axisV) / Math.max(bestPanel.axisV.lengthSq(), 0.0001), 0, 1);
    const impacts = bestPanel.material.uniforms.uImpacts.value as THREE.Vector4[];
    impacts.pop();
    impacts.unshift(new THREE.Vector4(u, v, this.clock.elapsedTime, THREE.MathUtils.clamp(force, 0.18, 1.0)));
    (bestPanel.material.uniforms.uImpacts as any).needsUpdate = true;
  }

  private addSoccerGoal(goalLineX: number, opensTowardField: 1 | -1) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.22 });
    const postRadius = 0.055;
    const halfW = GOAL_MOUTH_HALF_Z;
    const frontX = goalLineX - opensTowardField * postRadius;
    const backTopX = frontX - opensTowardField * (2 * FIELD_SCALE_PER_YARD);
    const backBottomX = frontX - opensTowardField * GOAL_FLOOR_DEPTH;
    const frontTopLeft = new THREE.Vector3(frontX, GOAL_HEIGHT, -halfW);
    const frontTopRight = new THREE.Vector3(frontX, GOAL_HEIGHT, halfW);
    const frontBottomLeft = new THREE.Vector3(frontX, postRadius * 0.75, -halfW);
    const frontBottomRight = new THREE.Vector3(frontX, postRadius * 0.75, halfW);
    const rearTopLeft = new THREE.Vector3(backTopX, GOAL_HEIGHT, -halfW);
    const rearTopRight = new THREE.Vector3(backTopX, GOAL_HEIGHT, halfW);
    const rearBottomLeft = new THREE.Vector3(backBottomX, postRadius * 0.75, -halfW);
    const rearBottomRight = new THREE.Vector3(backBottomX, postRadius * 0.75, halfW);

    const addGoalTube = (start: THREE.Vector3, end: THREE.Vector3) => {
      const dir = end.clone().sub(start);
      const len = dir.length();
      if (len < 0.001) return;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, len, 20), frameMat);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'goal';
      this.scene.add(mesh);
    };

    [
      [frontBottomLeft, frontTopLeft], [frontBottomRight, frontTopRight], [frontTopLeft, frontTopRight],
      [frontTopLeft, rearTopLeft], [frontTopRight, rearTopRight], [frontBottomLeft, rearBottomLeft],
      [frontBottomRight, rearBottomRight], [rearBottomLeft, rearTopLeft], [rearBottomRight, rearTopRight],
      [rearTopLeft, rearTopRight], [rearBottomLeft, rearBottomRight],
    ].forEach(([a, b]) => addGoalTube(a, b));

    this.buildGoalNetPanel(frontBottomLeft, frontTopLeft, rearTopLeft, rearBottomLeft, 12, 10);
    this.buildGoalNetPanel(frontBottomRight, frontTopRight, rearTopRight, rearBottomRight, 12, 10);
    this.buildGoalNetPanel(rearBottomLeft, rearTopLeft, rearTopRight, rearBottomRight, 14, 10);
    this.buildGoalNetPanel(frontTopLeft, frontTopRight, rearTopRight, rearTopLeft, 14, 8);
  }

  private addStadium() {
    const group = new THREE.Group();
    group.name = 'oldPslStadium';
    this.scene.add(group);
    const wallHeight = 4.8;
    const wallThickness = 1.0;
    const wallOffset = 9.5;
    const wallW = FIELD_W + wallOffset * 2;
    const wallD = FIELD_D + wallOffset * 2;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3b5a, roughness: 0.72 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4a, roughness: 0.8 });
    const addBox = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    addBox(wallW, wallHeight, wallThickness, wallMat, 0, wallHeight / 2, -wallD / 2);
    addBox(wallW, wallHeight, wallThickness, wallMat, 0, wallHeight / 2, wallD / 2);
    addBox(wallThickness, wallHeight, wallD, wallMat, -wallW / 2, wallHeight / 2, 0);
    addBox(wallThickness, wallHeight, wallD, wallMat, wallW / 2, wallHeight / 2, 0);

    const bannerTickerWindowChars = 124;
    const initBannerTicker = (textObj: any, seed: number, sourceText: string) => {
      textObj.tickerSource = sourceText;
      textObj.tickerLoop = sourceText.repeat(10);
      textObj.tickerOffset = Math.floor(seed * sourceText.length) % sourceText.length;
      textObj.tickerNextAt = 0;
      textObj.tickerPhase = 'scroll';
      textObj.visible = true;
      const doubled = textObj.tickerLoop + textObj.tickerLoop;
      textObj.text = doubled.slice(textObj.tickerOffset, textObj.tickerOffset + bannerTickerWindowChars);
    };

    const createBannerText = (text: string, color: string) => {
      const banner = new Text();
      banner.text = text;
      banner.fontSize = 1.05;
      banner.color = color;
      banner.anchorX = 'center';
      banner.anchorY = 'middle';
      banner.whiteSpace = 'nowrap';
      banner.font = '/assets/fonts/SubwayTicker-q1Z5.ttf';
      initBannerTicker(banner as any, Math.random(), text);
      banner.sync();
      this.bannerTexts.push(banner);
      return banner;
    };
    const snap = this.model.getMatchSnapshot();
    const bannerText = `${snap.teamBName || 'AWAY'}  •  •  •  PIXEL SOCCER LEAGUE  •  •  •  ${snap.teamAName || 'HOME'}  •  •  •  `;
    const b1 = createBannerText(bannerText, '#94a3b8');
    b1.position.set(0, wallHeight / 2, -wallD / 2 + 0.51);
    group.add(b1);
    const b2 = createBannerText(bannerText, '#94a3b8');
    b2.position.set(0, wallHeight / 2, wallD / 2 - 0.51);
    b2.rotation.y = Math.PI;
    group.add(b2);
    const bLeft = createBannerText(bannerText, '#94a3b8');
    bLeft.position.set(-wallW / 2 + 0.51, wallHeight / 2, 0);
    bLeft.rotation.y = Math.PI / 2;
    group.add(bLeft);
    const bRight = createBannerText(bannerText, '#94a3b8');
    bRight.position.set(wallW / 2 - 0.51, wallHeight / 2, 0);
    bRight.rotation.y = -Math.PI / 2;
    group.add(bRight);

    const spawnConfigs: Array<{ w: number; d: number; x: number; y: number; z: number; team: 'A' | 'B'; count: number }> = [];
    const prepareSpawn = (w: number, d: number, x: number, y: number, z: number, team: 'A' | 'B') => {
      spawnConfigs.push({ w, d, x, y, z, team, count: Math.max(48, Math.floor((w * d) / 0.6) * 2) });
    };
    for (let tier = 0; tier < 3; tier++) {
      const y = wallHeight + tier * 5;
      const off = tier * 4;
      const standW = wallW + off * 2 + 15;
      const standD = wallD + off * 2 + 15;
      addBox(standW, 0.2, 12, standMat, 0, y, -wallD / 2 - 6 - off);
      addBox(standW, 0.2, 12, standMat, 0, y, wallD / 2 + 6 + off);
      addBox(12, 0.2, standD, standMat, -wallW / 2 - 6 - off, y, 0);
      addBox(12, 0.2, standD, standMat, wallW / 2 + 6 + off, y, 0);
      addBox(standW, 5, 0.5, standMat, 0, y + 2.5, -wallD / 2 - 12 - off - 0.25);
      addBox(standW, 5, 0.5, standMat, 0, y + 2.5, wallD / 2 + 12 + off + 0.25);
      addBox(0.5, 5, standD, standMat, -wallW / 2 - 12 - off - 0.25, y + 2.5, 0);
      addBox(0.5, 5, standD, standMat, wallW / 2 + 12 + off + 0.25, y + 2.5, 0);
      prepareSpawn(standW / 2, 12, -standW / 4, y, -wallD / 2 - 6 - off, 'A');
      prepareSpawn(standW / 2, 12, standW / 4, y, -wallD / 2 - 6 - off, 'B');
      prepareSpawn(standW / 2, 12, -standW / 4, y, wallD / 2 + 6 + off, 'A');
      prepareSpawn(standW / 2, 12, standW / 4, y, wallD / 2 + 6 + off, 'B');
      prepareSpawn(12, standD, -wallW / 2 - 6 - off, y, 0, 'A');
      prepareSpawn(12, standD, wallW / 2 + 6 + off, y, 0, 'B');
    }

    const totalCrowdCount = spawnConfigs.reduce((sum, config) => sum + config.count, 0);
    const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.82 });
    this.crowdMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), crowdMat, totalCrowdCount);
    this.crowdMesh.castShadow = true;
    this.crowdMesh.receiveShadow = true;
    group.add(this.crowdMesh);

    let instanceIndex = 0;
    for (const config of spawnConfigs) {
      for (let i = 0; i < config.count / 2; i++) {
        const team = Math.random() < 0.08 ? (config.team === 'A' ? 'B' : 'A') : config.team;
        const palette = this.currentCrowdPalette(team);
        const x = config.x + (Math.random() - 0.5) * config.w;
        const z = config.z + (Math.random() - 0.5) * config.d;
        for (let layer = 0; layer < 2; layer++) {
          const y = config.y + 0.2 + layer * 0.4;
          const toneIndex = Math.floor(Math.random() * palette.length);
          this.crowdDummy.position.set(x, y, z);
          this.crowdDummy.updateMatrix();
          this.crowdMesh.setMatrixAt(instanceIndex, this.crowdDummy.matrix);
          this.crowdMesh.setColorAt(instanceIndex, new THREE.Color(palette[toneIndex]));
          this.crowdBlocks.push({
            instanceIndex,
            baseX: x,
            baseY: y,
            baseZ: z,
            team,
            toneIndex,
            angle: Math.atan2(z, x),
            phase: Math.random() * Math.PI * 2,
            speed: 2 + Math.random() * 4,
            jumpHeight: 0.2 + Math.random() * 0.4,
            vibeScale: 0.02 + Math.random() * 0.03,
            vibePhaseX: Math.random() * Math.PI * 2,
            vibePhaseZ: Math.random() * Math.PI * 2,
            vibeSpeedX: 3 + Math.random() * 2,
            vibeSpeedZ: 3 + Math.random() * 2,
          });
          instanceIndex++;
        }
      }
    }
    this.crowdMesh.instanceMatrix.needsUpdate = true;
    if (this.crowdMesh.instanceColor) this.crowdMesh.instanceColor.needsUpdate = true;

    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x606060, roughness: 0.6, metalness: 0.3 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe8c0, emissiveIntensity: 0.45 });
    for (const [px, pz] of [
      [-wallW / 2, -wallD / 2],
      [wallW / 2, -wallD / 2],
      [-wallW / 2, wallD / 2],
      [wallW / 2, wallD / 2],
    ] as Array<[number, number]>) {
      addBox(0.5, 18, 0.5, pylonMat, px, 9, pz);
      addBox(2.0, 0.4, 1.4, pylonMat, px, 18.2, pz);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          addBox(0.35, 0.35, 0.35, lampMat, px - 0.5 + col * 0.5, 18.6 + row * 0.4, pz - 0.25 + row * 0.5);
        }
      }
    }
  }

  private addBall() {
    const group = new THREE.Group();
    const ballMaterial = new THREE.MeshPhysicalMaterial({
      map: this.createFallbackBallTexture(),
      roughness: 0.37,
      metalness: 0.0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.58,
      reflectivity: 0.32,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 20), ballMaterial);
    new THREE.TextureLoader().load('/assets/ball-wrap.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      ballMaterial.map = tex;
      ballMaterial.needsUpdate = true;
    }, undefined, () => {});
    mesh.castShadow = true;
    mesh.renderOrder = 10;
    mesh.name = 'visibleBall';
    group.add(mesh);
    this.scene.add(group);

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), shadowMaterial);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.name = 'ballShadow';
    shadowMesh.renderOrder = 1;
    this.scene.add(shadowMesh);
    return { group, mesh, shadowMesh, shadowMaterial };
  }

  private createFallbackBallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    for (let x = -32; x < canvas.width + 32; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 32, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 16, 0);
      ctx.lineTo(x - 16, canvas.height);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(17,24,39,0.75)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(16 + i * 16, 32, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private addBallTrail() {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xfff06a, transparent: true, opacity: 0.82 }),
    );
    line.name = 'ballTrail';
    line.visible = false;
    this.scene.add(line);
    return line;
  }

  private syncPlayerMeshes() {
    const liveIds = new Set(this.model.players.map((p) => p.id));
    for (const [id, visual] of this.playerMeshes) {
      if (!liveIds.has(id)) {
        this.scene.remove(visual.mesh);
        visual.allFrames.forEach((frame) => frame.geometry.dispose());
        this.playerMeshes.delete(id);
      }
    }
    for (const player of this.model.players) {
      if (this.playerMeshes.has(player.id)) continue;
      const visual = this.createPlayerVisual(player);
      this.playerMeshes.set(player.id, visual);
      this.scene.add(visual.mesh);
    }
    this.updateMeshes();
  }

  private createPlayerVisual(player: SimplePlayer, paletteOverride?: PlayerPalette): PlayerVisual {
    const isKeeper = player.role === 'GK';
    const palette = paletteOverride ?? this.paletteForPlayer(player);
    const animPhaseOffset = this.animationPhaseForPlayer(player);
    const group = new THREE.Group();
    group.position.set(player.pos.x, 0.15, player.pos.z);
    const spriteGroup = new THREE.Group();
    spriteGroup.position.y = PLAYER_SPRITE_CENTER_Y;
    group.add(spriteGroup);

    const runFrames = (isKeeper ? KEEPER_PATTERNS : PLAYER_PATTERNS).map((p) => buildMergedPlayerFrame(p, palette));
    const idleFrames = (isKeeper ? KEEPER_IDLE_PATTERNS : PLAYER_IDLE_PATTERNS).map((p) => buildMergedPlayerFrame(p, palette));
    const frontRunFrames = PLAYER_FRONT_RUN_COMPOSED.map((p) => buildMergedPlayerFrame(p, palette));
    const frontIdleFrames = PLAYER_FRONT_IDLE_COMPOSED.map((p) => buildMergedPlayerFrame(p, palette));
    const backRunFrames = PLAYER_BACK_RUN_COMPOSED.map((p) => buildMergedPlayerFrame(p, palette));
    const backIdleFrames = PLAYER_BACK_IDLE_COMPOSED.map((p) => buildMergedPlayerFrame(p, palette));
    const diveLeftFrames = isKeeper ? KEEPER_DIVE_LEFT_PATTERNS.map((p) => buildMergedPlayerFrame(p, palette)) : [];
    const diveRightFrames = isKeeper ? KEEPER_DIVE_RIGHT_PATTERNS.map((p) => buildMergedPlayerFrame(p, palette)) : [];
    const diveUpFrames = isKeeper ? KEEPER_DIVE_UP_PATTERNS.map((p) => buildMergedPlayerFrame(p, palette)) : [];
    const diveDownFrames = isKeeper ? KEEPER_DIVE_DOWN_PATTERNS.map((p) => buildMergedPlayerFrame(p, palette)) : [];
    const allFrames = [
      ...runFrames, ...idleFrames, ...frontRunFrames, ...frontIdleFrames,
      ...backRunFrames, ...backIdleFrames, ...diveLeftFrames, ...diveRightFrames, ...diveUpFrames, ...diveDownFrames,
    ];
    allFrames.forEach((frame) => {
      frame.visible = false;
      spriteGroup.add(frame);
    });
    if (idleFrames[0]) idleFrames[0].visible = true;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return {
      mesh: group,
      spriteGroup,
      runFrames,
      idleFrames,
      frontRunFrames,
      frontIdleFrames,
      backRunFrames,
      backIdleFrames,
      diveLeftFrames,
      diveRightFrames,
      diveUpFrames,
      diveDownFrames,
      allFrames,
      facingMode: 'side',
      dir: player.team === 'A' ? 1 : -1,
      state: 'IDLE',
      frame: 0,
      animTimer: animPhaseOffset * 0.12,
      animPhaseOffset,
      breathOffset: animPhaseOffset * Math.PI * 2,
    };
  }

  private paletteForPlayer(player: SimplePlayer) {
    const base = player.role === 'GK'
      ? player.team === 'A' ? TEAM_PALETTES.keeperA : TEAM_PALETTES.keeperB
      : player.team === 'A' ? TEAM_PALETTES.teamA : TEAM_PALETTES.teamB;
    return { ...base, hair: this.hairMaterialForPlayer(player) };
  }

  private recolorPlayerVisual(player: SimplePlayer) {
    const visual = this.playerMeshes.get(player.id);
    if (!visual) return;
    const palette = this.paletteForPlayer(player);
    visual.allFrames.forEach((frame) => recolorMergedVoxelFrame(frame, palette));
  }

  private hairMaterialForPlayer(player: SimplePlayer) {
    return PLAYER_HAIR_MATERIALS[Math.abs(this.playerIdentityHash(player)) % PLAYER_HAIR_MATERIALS.length];
  }

  private animationPhaseForPlayer(player: SimplePlayer) {
    return (Math.abs(this.playerIdentityHash(player)) % 997) / 997;
  }

  private playerIdentityHash(player: SimplePlayer) {
    const seed = `${player.team}:${player.shirtNumber}:${player.name}:${player.role}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return hash;
  }

  private currentCrowdPalette(team: 'A' | 'B') {
    const shirt = team === 'A' ? M.teamAShirt.color : M.teamBShirt.color;
    const pants = team === 'A' ? M.teamAPants.color : M.teamBPants.color;
    return [
      shirt.getHex(),
      pants.clone().offsetHSL(0, 0, 0.08).getHex(),
      0xffffff,
      shirt.clone().offsetHSL(0, 0, 0.12).getHex(),
      shirt.clone().offsetHSL(0, 0, -0.1).getHex(),
    ];
  }

  private refreshCrowdColors() {
    if (!this.crowdMesh) return;
    for (const block of this.crowdBlocks) {
      const palette = this.currentCrowdPalette(block.team);
      this.crowdMesh.setColorAt(block.instanceIndex, new THREE.Color(palette[block.toneIndex % palette.length]));
    }
    if (this.crowdMesh.instanceColor) this.crowdMesh.instanceColor.needsUpdate = true;
  }

  private updateMeshes(dt = 1 / 60) {
    for (const player of this.model.players) {
      const visual = this.playerMeshes.get(player.id);
      if (!visual) continue;
      const keeperReaction = player.role === 'GK' ? this.keeperReactions.get(player.team) : null;
      const reactionActive = !!keeperReaction && keeperReaction.ttl > 0;
      const reactionProgress = reactionActive ? 1 - keeperReaction.ttl / keeperReaction.duration : 0;
      const reactionZ = reactionActive ? keeperReaction.zLean * Math.sin(reactionProgress * Math.PI) * 1.6 : 0;
      const headerReaction = this.headerReactions.get(player.id) || null;
      const headerActive = !!headerReaction && headerReaction.ttl > 0;
      const headerProgress = headerActive ? 1 - headerReaction.ttl / headerReaction.duration : 0;
      const headerLift = headerActive ? Math.sin(headerProgress * Math.PI) * 0.28 : 0;
      const restartPose = this.activeRestartPresentation?.takerId === player.id ? this.activeRestartPresentation : null;
      const restartDisplay = restartPose ? this.restartPresentationPlayerPosition(restartPose) : null;
      visual.mesh.position.set(restartDisplay?.x ?? player.pos.x, 0.15 + headerLift, restartDisplay?.z ?? player.pos.z + reactionZ);
      const scale = PLAYER_VISUAL_SCALE * (player.role === 'GK' ? 1.08 : 1) * (reactionActive ? 1.16 : 1) * (headerActive ? 1.08 : 1);
      visual.mesh.scale.setScalar(scale);
      this.updatePlayerSprite(visual, player, dt, keeperReaction, restartPose, headerReaction);
    }
    const selected = this.humanControlEnabled
      ? this.model.getSelectedPlayerStats()
      : this.twoPlayerMode
        ? this.model.getSelectedDefensePlayerStats()
        : null;
    this.selectedPlayerRing.visible = !!selected && selected.role !== 'GK';
    if (selected && this.selectedPlayerRing.visible) {
      this.selectedPlayerRing.position.set(selected.pos.x, 0.025, selected.pos.z);
    }
    this.updateChargeIndicator();
    this.updateRefereeVisual(dt);
    const ballY = Math.max(BALL_GROUND_Y, this.model.ball.pos.y);
    const restartBall = this.restartPresentationBallPosition();
    this.ballGroup.position.set(restartBall?.x ?? this.model.ball.pos.x, restartBall?.y ?? ballY, restartBall?.z ?? this.model.ball.pos.z);
    this.ballMesh.rotation.x += this.model.ball.vel.z * 0.035;
    this.ballMesh.rotation.z -= this.model.ball.vel.x * 0.035;
    const height = Math.max(0, ballY - BALL_GROUND_Y);
    const shadowScale = THREE.MathUtils.clamp(1 - height * 0.2, 0.36, 1.05);
    this.ballShadowMesh.position.set(restartBall?.x ?? this.model.ball.pos.x, 0.02, restartBall?.z ?? this.model.ball.pos.z);
    this.ballShadowMesh.scale.set(shadowScale, shadowScale, 1);
    this.ballShadowMaterial.opacity = THREE.MathUtils.clamp(0.36 - height * 0.05, 0.1, 0.38);
    this.updatePendingGoalNetImpact(dt);
    this.updateBallTrail();
  }

  /**
   * Aim arrow + power ring for the charging player. Arrow length and both
   * colours track the charge, so the player can see strength and direction
   * before releasing.
   */
  private updateChargeIndicator() {
    const team = this.humanControlEnabled ? 'A' : this.twoPlayerMode ? 'B' : null;
    const charge = team ? this.model.getManualChargeState(team) : null;
    if (!charge || !charge.hasBall) {
      this.chargeGroup.visible = false;
      return;
    }
    this.chargeGroup.visible = true;

    // Green (soft) -> yellow -> red (full power), as the original did.
    const colour = new THREE.Color().setHSL((1 - charge.progress) * 0.33, 1, 0.55);
    (this.chargeRing.material as THREE.MeshBasicMaterial).color.copy(colour);
    this.chargeArrow.setColor(colour);

    this.chargeRing.position.set(charge.origin.x, 0.03, charge.origin.z);
    this.chargeRing.scale.setScalar(0.6 + charge.progress * 1.5);

    const aim = new THREE.Vector3(charge.aim.x, 0, charge.aim.z);
    if (aim.lengthSq() < 0.0001) {
      // No stick input: point the arrow at the goal being attacked.
      aim.set(charge.attackSign, 0, 0);
    }
    aim.normalize();
    const length = 2.2 + charge.progress * 6.5;
    this.chargeArrow.position.set(charge.origin.x, 0.12, charge.origin.z);
    this.chargeArrow.setDirection(aim);
    this.chargeArrow.setLength(length, Math.min(1.2, 0.45 + length * 0.12), Math.min(0.34, 0.16 + length * 0.05));
  }

  private updateRefereeVisual(dt: number) {
    const phase = this.model.msm.state.kind;
    const visible = phase !== 'pre_match' && phase !== 'full_time';
    this.refereeVisual.mesh.visible = visible;
    if (!visible) {
      this.refereeInitialized = false;
      return;
    }

    const target = this.refereeTrackingTarget();
    const current = this.refereePlayer.pos;
    if (!this.refereeInitialized) {
      current.x = target.x;
      current.z = target.z;
      this.refereeInitialized = true;
    }

    const dx = target.x - current.x;
    const dz = target.z - current.z;
    const dist = Math.hypot(dx, dz);
    const maxStep = 7.4 * dt;
    const step = dist > 0 ? Math.min(dist, maxStep) / dist : 0;
    const nextX = current.x + dx * step;
    const nextZ = current.z + dz * step;
    this.refereePlayer.vel.x = dt > 0 ? (nextX - current.x) / dt : 0;
    this.refereePlayer.vel.z = dt > 0 ? (nextZ - current.z) / dt : 0;
    current.x = nextX;
    current.z = nextZ;
    this.refereePlayer.targetPos = target;
    this.refereeVisual.mesh.position.set(current.x, 0.15, current.z);
    this.refereeVisual.mesh.scale.setScalar(PLAYER_VISUAL_SCALE * 1.02);
    this.updatePlayerSprite(this.refereeVisual, this.refereePlayer, dt);
  }

  private refereeTrackingTarget() {
    const ball = this.model.ball.pos;
    const attackSign = this.refereeAttackSign();
    const zTowardCenter = Math.abs(ball.z) < 2 ? (ball.x >= 0 ? -1 : 1) * 5.2 : -Math.sign(ball.z) * 5.2;
    return {
      x: THREE.MathUtils.clamp(ball.x - attackSign * 8.0, -FIELD_W / 2 + 5, FIELD_W / 2 - 5),
      z: THREE.MathUtils.clamp(ball.z + zTowardCenter, -FIELD_D / 2 + 5, FIELD_D / 2 - 5),
    };
  }

  private refereeAttackSign(): 1 | -1 {
    const carrier = this.model.possession;
    if (carrier) {
      const teamAFirstHalf = this.model.msm.clock.half === 1 ? 1 : -1;
      return (carrier.team === 'A' ? teamAFirstHalf : -teamAFirstHalf) as 1 | -1;
    }
    if (Math.abs(this.model.ball.vel.x) > 0.05) return this.model.ball.vel.x > 0 ? 1 : -1;
    return this.model.ball.pos.x >= 0 ? 1 : -1;
  }

  private updatePlayerSprite(
    visual: PlayerVisual,
    player: SimplePlayer,
    dt: number,
    keeperReaction?: KeeperReaction | null,
    restartPose?: RestartPresentation | null,
    headerReaction?: HeaderReaction | null,
  ) {
    if (restartPose?.type === 'throw_in') {
      this.updateThrowInSprite(visual, restartPose);
      return;
    }
    if (restartPose?.type === 'corner') {
      this.updateCornerKickSprite(visual, restartPose);
      return;
    }
    if (restartPose?.type === 'goal_kick' || restartPose?.type === 'drop_kick') {
      this.updateGoalKickSprite(visual, restartPose);
      return;
    }
    if (restartPose?.type === 'free_kick') {
      this.updateGoalKickSprite(visual, restartPose);
      return;
    }
    if (restartPose?.type === 'penalty') {
      this.updateGoalKickSprite(visual, restartPose);
      return;
    }
    if (player.role === 'GK' && keeperReaction && keeperReaction.ttl > 0) {
      this.updateKeeperDiveSprite(visual, keeperReaction);
      return;
    }
    if (headerReaction && headerReaction.ttl > 0) {
      this.updateHeaderSprite(visual, headerReaction);
      return;
    }
    const vx = player.vel.x;
    const vz = player.vel.z;
    const speedSq = vx * vx + vz * vz;
    const moving = speedSq > 0.04;
    let facingMode: SpriteFacingMode = visual.facingMode;
    let dir = visual.dir;
    if (moving) {
      const absVx = Math.abs(vx);
      const absVz = Math.abs(vz);
      if (absVz > absVx * 1.3 && absVz > 0.1) {
        facingMode = vz > 0 ? 'front' : 'back';
      } else {
        facingMode = 'side';
        dir = vx >= 0 ? 1 : -1;
      }
    } else {
      facingMode = 'side';
      dir = player.team === 'A' ? 1 : -1;
    }
    const state: 'IDLE' | 'RUN' = moving ? 'RUN' : 'IDLE';
    const facingChanged = facingMode !== visual.facingMode || dir !== visual.dir || state !== visual.state;
    visual.facingMode = facingMode;
    visual.dir = dir;
    visual.state = state;
    visual.animTimer += dt;
    const animThreshold = state === 'IDLE' ? 0.6 : 0.12;
    if (facingChanged || visual.animTimer > animThreshold) {
      visual.animTimer = facingChanged ? visual.animPhaseOffset * animThreshold : 0;
      visual.allFrames.forEach((frame) => { frame.visible = false; });
      const frames = facingMode === 'front'
        ? (state === 'RUN' ? visual.frontRunFrames : visual.frontIdleFrames)
        : facingMode === 'back'
          ? (state === 'RUN' ? visual.backRunFrames : visual.backIdleFrames)
          : (state === 'RUN' ? visual.runFrames : visual.idleFrames);
      if (frames.length) {
        visual.frame = (visual.frame + (state === 'RUN' ? 1 : 0)) % frames.length;
        frames.forEach((frame, i) => { frame.visible = i === visual.frame; });
      }
    }
    const breath = state === 'IDLE' ? Math.sin(this.clock.elapsedTime * 2.5 + visual.breathOffset) * 0.012 : 0;
    const scaleX = 1.0 - breath * 0.3;
    const scaleY = 1.0 + breath;
    visual.spriteGroup.rotation.set(0, 0, 0);
    visual.spriteGroup.position.set(0, PLAYER_SPRITE_CENTER_Y, 0);
    visual.spriteGroup.scale.set((facingMode === 'side' ? dir : 1) * scaleX, scaleY, 1);
  }

  private updateKeeperDiveSprite(visual: PlayerVisual, reaction: KeeperReaction) {
    visual.allFrames.forEach((frame) => { frame.visible = false; });
    const frames = this.keeperDiveFrames(visual, reaction.direction);
    const duration = Math.max(0.1, reaction.duration);
    const progress = THREE.MathUtils.clamp(1 - reaction.ttl / duration, 0, 0.999);
    const frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));
    visual.facingMode = 'side';
    visual.state = 'IDLE';
    visual.frame = frameIndex;
    visual.animTimer = 0;
    if (frames.length) {
      frames.forEach((frame, i) => { frame.visible = i === frameIndex; });
    }
    const verticalOffset = reaction.direction === 'up' ? 0.06 : reaction.direction === 'down' ? -0.04 : 0;
    visual.spriteGroup.rotation.set(0, 0, 0);
    visual.spriteGroup.position.set(0, PLAYER_SPRITE_CENTER_Y + verticalOffset, 0);
    visual.spriteGroup.scale.set(1, 1, 1);
  }

  private keeperDiveFrames(visual: PlayerVisual, direction: KeeperDiveDirection) {
    if (direction === 'left') return visual.diveLeftFrames;
    if (direction === 'right') return visual.diveRightFrames;
    if (direction === 'up') return visual.diveUpFrames;
    return visual.diveDownFrames;
  }

  private updateHeaderSprite(visual: PlayerVisual, reaction: HeaderReaction) {
    visual.allFrames.forEach((frame) => { frame.visible = false; });
    const frames = visual.idleFrames.length ? visual.idleFrames : visual.runFrames;
    const duration = Math.max(0.1, reaction.duration);
    const progress = THREE.MathUtils.clamp(1 - reaction.ttl / duration, 0, 0.999);
    const snap = Math.sin(progress * Math.PI);
    const frameIndex = Math.min(frames.length - 1, Math.floor(progress * Math.max(1, frames.length)));
    visual.facingMode = 'side';
    visual.state = 'IDLE';
    visual.dir = reaction.direction;
    visual.frame = frameIndex;
    visual.animTimer = 0;
    frames.forEach((frame, i) => { frame.visible = i === frameIndex; });
    const lean = reaction.kind === 'shot' ? 0.46 : 0.34;
    visual.spriteGroup.rotation.set(0, 0, -reaction.direction * lean * snap);
    visual.spriteGroup.position.set(0.04 * reaction.direction * snap, PLAYER_SPRITE_CENTER_Y + 0.12 * snap, 0);
    visual.spriteGroup.scale.set(reaction.direction * (1 + snap * 0.12), 1 - snap * 0.06, 1);
  }

  private updateThrowInSprite(visual: PlayerVisual, restart: RestartPresentation) {
    visual.allFrames.forEach((frame) => { frame.visible = false; });
    const facingMode: SpriteFacingMode = restart.spot.z > 0 ? 'back' : 'front';
    const frames = facingMode === 'back' ? visual.backIdleFrames : visual.frontIdleFrames;
    const progress = this.restartPresentationProgress(restart);
    const frameIndex = restart.phase === 'release'
      ? Math.min(frames.length - 1, Math.floor(progress * Math.max(1, frames.length)))
      : Math.min(1, Math.max(0, frames.length - 1));
    const throwT = restart.phase === 'release' ? Math.sin(progress * Math.PI) : 0;
    const reachT = restart.phase === 'release' ? THREE.MathUtils.smoothstep(progress, 0.08, 0.48) : 0;
    const windup = restart.phase === 'setup' ? Math.sin(progress * Math.PI * 2) : 0;
    visual.facingMode = facingMode;
    visual.state = 'IDLE';
    visual.frame = frameIndex;
    visual.animTimer = 0;
    frames.forEach((frame, i) => { frame.visible = i === frameIndex; });
    visual.spriteGroup.rotation.set(-throwT * 0.34, 0, (restart.spot.z > 0 ? -1 : 1) * reachT * 0.16);
    visual.spriteGroup.position.set(0, PLAYER_SPRITE_CENTER_Y + 0.14 + windup * 0.045 - throwT * 0.10, 0);
    visual.spriteGroup.scale.set(1 + throwT * 0.08, 1.14 - throwT * 0.18, 1);
  }

  private updateCornerKickSprite(visual: PlayerVisual, restart: RestartPresentation) {
    visual.allFrames.forEach((frame) => { frame.visible = false; });
    const progress = this.restartPresentationProgress(restart);
    const frames = restart.phase === 'release' && visual.runFrames.length ? visual.runFrames : visual.idleFrames;
    const frameIndex = restart.phase === 'release'
      ? Math.min(frames.length - 1, Math.floor(progress * Math.max(1, frames.length)))
      : 0;
    const plantT = restart.phase === 'release' ? THREE.MathUtils.smoothstep(progress, 0.12, 0.55) : 0;
    const kickWindow = restart.phase === 'release' ? THREE.MathUtils.clamp((progress - 0.38) / 0.62, 0, 1) : 0;
    const kickT = Math.sin(kickWindow * Math.PI);
    const setupBounce = restart.phase === 'setup' ? Math.sin(progress * Math.PI * 2) * 0.035 : 0;
    const runupOffset = restart.phase === 'setup' ? setupBounce : -plantT * 0.14 - kickT * 0.18;
    visual.facingMode = 'side';
    visual.state = 'IDLE';
    visual.dir = restart.spot.x < 0 ? 1 : -1;
    visual.frame = frameIndex;
    visual.animTimer = 0;
    frames.forEach((frame, i) => { frame.visible = i === frameIndex; });
    visual.spriteGroup.rotation.set(0, 0, -visual.dir * (plantT * 0.18 + kickT * 0.52));
    visual.spriteGroup.position.set(runupOffset * visual.dir, PLAYER_SPRITE_CENTER_Y + kickT * 0.055, 0);
    visual.spriteGroup.scale.set(visual.dir * (1 + kickT * 0.2), 1 - kickT * 0.1, 1);
  }

  private updateGoalKickSprite(visual: PlayerVisual, restart: RestartPresentation) {
    visual.allFrames.forEach((frame) => { frame.visible = false; });
    const progress = this.restartPresentationProgress(restart);
    const frames = restart.phase === 'release' && visual.runFrames.length ? visual.runFrames : visual.idleFrames;
    const frameIndex = restart.phase === 'release'
      ? Math.min(frames.length - 1, Math.floor(progress * Math.max(1, frames.length)))
      : 0;
    const kickT = restart.phase === 'release' ? Math.sin(progress * Math.PI) : 0;
    const windup = restart.phase === 'setup' ? Math.sin(progress * Math.PI * 2) * 0.04 : -kickT * 0.16;
    visual.facingMode = 'side';
    visual.state = 'IDLE';
    visual.dir = restart.spot.x < 0 ? 1 : -1;
    visual.frame = frameIndex;
    visual.animTimer = 0;
    frames.forEach((frame, i) => { frame.visible = i === frameIndex; });
    visual.spriteGroup.rotation.set(0, 0, -visual.dir * kickT * 0.28);
    visual.spriteGroup.position.set(windup * visual.dir, PLAYER_SPRITE_CENTER_Y + kickT * 0.03, 0);
    visual.spriteGroup.scale.set(visual.dir * (1 + kickT * 0.1), 1 - kickT * 0.05, 1);
  }

  private restartPresentationProgress(restart: RestartPresentation) {
    const duration = Math.max(0.001, restart.duration);
    return THREE.MathUtils.clamp(1 - restart.ttl / duration, 0, 1);
  }

  private restartPresentationPlayerPosition(restart: RestartPresentation) {
    const base = this.restartPresentationPosition(restart);
    if (restart.type === 'throw_in') return this.throwInPresentationPlayerPosition(restart);
    if (restart.type === 'corner') return this.cornerPresentationPlayerPosition(restart);
    return base;
  }

  private throwInPresentationPlayerPosition(restart: RestartPresentation) {
    const base = this.restartPresentationPosition(restart);
    const progress = this.restartPresentationProgress(restart);
    const outsideZ = restart.spot.z >= 0 ? 1 : -1;
    const lineZ = restart.spot.z + outsideZ * 0.12;
    if (restart.phase === 'setup') {
      const rock = Math.sin(progress * Math.PI * 2) * 0.06;
      return {
        x: base.x + rock * 0.25,
        z: base.z + outsideZ * Math.abs(rock),
      };
    }
    const plantT = THREE.MathUtils.smoothstep(progress, 0, 0.52);
    const followT = THREE.MathUtils.smoothstep(progress, 0.48, 1);
    const plant = {
      x: base.x,
      z: THREE.MathUtils.lerp(base.z + outsideZ * 0.10, lineZ, plantT),
    };
    return {
      x: plant.x,
      z: THREE.MathUtils.lerp(plant.z, lineZ + outsideZ * 0.06, followT),
    };
  }

  private cornerPresentationPlayerPosition(restart: RestartPresentation) {
    const progress = this.restartPresentationProgress(restart);
    const kickDirX = restart.spot.x < 0 ? 1 : -1;
    const outsideZ = restart.spot.z >= 0 ? 1 : -1;
    const inwardZ = -outsideZ;
    const strike = restart.takerSpot || {
      x: restart.spot.x - kickDirX * 0.08,
      z: restart.spot.z + outsideZ * CORNER_OUTSIDE_TOUCHLINE_OFFSET,
    };
    const runup = {
      x: strike.x - kickDirX * CORNER_RUNUP_DISTANCE,
      z: strike.z + outsideZ * 0.26,
    };
    const follow = {
      x: strike.x + kickDirX * 0.16,
      z: strike.z + inwardZ * 0.10,
    };
    const preload = {
      x: strike.x - kickDirX * 0.10,
      z: strike.z + outsideZ * 0.06,
    };
    if (restart.phase === 'setup') {
      const setupPulse = Math.sin(progress * Math.PI * 2) * 0.07;
      return {
        x: preload.x + kickDirX * setupPulse * 0.18,
        z: preload.z - outsideZ * Math.abs(setupPulse) * 0.10,
      };
    }
    const drive = THREE.MathUtils.smoothstep(progress, 0, 0.68);
    const followT = THREE.MathUtils.smoothstep(progress, 0.82, 1);
    const plant = {
      x: THREE.MathUtils.lerp(preload.x, strike.x, drive),
      z: THREE.MathUtils.lerp(preload.z, strike.z, drive),
    };
    return {
      x: THREE.MathUtils.lerp(plant.x, follow.x, followT),
      z: THREE.MathUtils.lerp(plant.z, follow.z, followT),
    };
  }

  private restartPresentationPosition(restart: RestartPresentation) {
    if ((restart.type === 'throw_in' || restart.type === 'corner') && restart.takerSpot) return restart.takerSpot;
    if (restart.type !== 'throw_in') return restart.spot;
    const outsideZ = restart.spot.z >= 0 ? FIELD_D / 2 + THROW_IN_OUTSIDE_TOUCHLINE_OFFSET : -FIELD_D / 2 - THROW_IN_OUTSIDE_TOUCHLINE_OFFSET;
    return { x: restart.spot.x, z: outsideZ };
  }

  private restartPresentationBallPosition() {
    const restart = this.activeRestartPresentation;
    if (!restart || restart.phase !== 'setup') return null;
    if (restart.type === 'throw_in') {
      const takerPos = restart.takerSpot || this.restartPresentationPosition(restart);
      return { x: takerPos.x, y: 1.1, z: takerPos.z };
    }
    if (restart.type === 'corner') return { x: restart.spot.x, y: BALL_GROUND_Y, z: restart.spot.z };
    if (restart.type === 'goal_kick') return { x: restart.spot.x, y: BALL_GROUND_Y, z: restart.spot.z };
    if (restart.type === 'free_kick') return { x: restart.spot.x, y: BALL_GROUND_Y, z: restart.spot.z };
    if (restart.type === 'penalty') return { x: restart.spot.x, y: BALL_GROUND_Y, z: restart.spot.z };
    if (restart.type === 'drop_kick') return { x: restart.spot.x, y: BALL_GROUND_Y + 0.48, z: restart.spot.z };
    return null;
  }

  private updateBallTrail() {
    if (!this.shotBallTrailEnabled || this.model.getActiveBallFlightKind() !== 'shot') {
      this.clearBallTrail();
      return;
    }
    const current = this.ballGroup.position.clone();
    const previous = this.ballTrailPoints.at(-1);
    const moved = previous ? previous.distanceTo(current) > 0.08 : true;
    if (moved) this.ballTrailPoints.push(current);
    while (this.ballTrailPoints.length > 18) this.ballTrailPoints.shift();
    const hasTrail = this.ballTrailPoints.length > 2
      && this.ballTrailPoints[0].distanceTo(this.ballTrailPoints[this.ballTrailPoints.length - 1]) > 0.6;
    this.ballTrail.visible = hasTrail;
    if (hasTrail) {
      this.ballTrail.geometry.dispose();
      this.ballTrail.geometry = new THREE.BufferGeometry().setFromPoints(this.ballTrailPoints);
    }
  }

  private clearBallTrail() {
    this.ballTrailPoints.length = 0;
    this.ballTrail.visible = false;
  }

  private updatePendingGoalNetImpact(dt: number) {
    const pending = this.pendingGoalNetImpact;
    if (!pending) return;
    pending.ttl -= dt;
    const arrived = this.ballGroup.position.distanceTo(pending.target) <= 0.55;
    if (!arrived && pending.ttl > 0) return;
    this.addGoalNetImpact(pending.target, pending.force);
    this.pendingGoalNetImpact = null;
  }

  private resetVisualCues() {
    this.processedLiveEvents = 0;
    this.lastThrowInAnnouncementKey = '';
    this.lastThrowInAnnouncementAt = -Infinity;
    this.lastWhistleAt = -Infinity;
    this.clearBallTrail();
    this.keeperReactions.clear();
    this.keeperAnimationEvents.length = 0;
    this.headerReactions.clear();
    this.headerAnimationEvents.length = 0;
    this.cornerPresentationEvents.length = 0;
    this.activeRestartPresentation = null;
    this.pendingGoalNetImpact = null;
    for (const cue of this.eventCues.splice(0)) {
      this.scene.remove(cue.mesh);
      if (cue.mesh instanceof THREE.Mesh) {
        cue.mesh.geometry.dispose();
        if (cue.mesh.material instanceof THREE.Material) cue.mesh.material.dispose();
      }
    }
  }

  private processLiveEventCues(dt: number) {
    // Track the monotonic event seq, not an array index. The model caps the log
    // at 120 entries with shift(), which renumbers indices underneath us: the
    // old index cursor simply stopped firing once the cap was reached, so every
    // sound after the first ~120 events was silently dropped -- including the
    // goal announcement and its crowd swell.
    const events = this.model.eventLog;
    for (const event of events) {
      if (!event) continue;
      const seq = typeof event.seq === 'number' ? event.seq : 0;
      if (seq <= this.processedLiveEvents) continue;
      this.processedLiveEvents = seq;
      this.playSoundForLiveEvent(event);
      if (event.action === 'PASS') this.spawnEventCue(0x63f7ff, 0.45, 0.7);
      if (event.action === 'SHOT') this.spawnEventCue(0xfff06a, 0.7, 0.85);
      if (event.action === 'HEADER_SHOT' || event.action === 'HEADER_CLEARANCE' || event.action === 'HEADER_TOUCH') {
        this.spawnEventCue(event.action === 'HEADER_SHOT' ? 0xfff06a : event.action === 'HEADER_CLEARANCE' ? 0xffb46a : 0xffffff, 0.72, 0.82);
        const playerId = typeof event.meta?.playerId === 'string' ? event.meta.playerId : '';
        const player = this.model.players.find((p) => p.id === playerId);
        if (player) {
          const direction = player.team === 'A' ? 1 : -1;
          const duration = event.action === 'HEADER_SHOT' ? 0.55 : event.action === 'HEADER_CLEARANCE' ? 0.45 : 0.40;
          const kind = event.action === 'HEADER_SHOT' ? 'shot' : event.action === 'HEADER_CLEARANCE' ? 'clearance' : 'touch';
          this.headerReactions.set(player.id, {
            ttl: duration,
            duration,
            kind,
            direction,
          });
          this.recordHeaderAnimationEvent(event, player, kind, direction, duration, seq);
        }
      }
      if (event.action === 'GOAL') {
        this.spawnEventCue(0x7dff6a, 1.05, 1.25);
        this.goalSwellUntil = this.clock.elapsedTime + 3.5;
        this.waveStartTime = this.clock.elapsedTime;
        const netTarget = event.meta?.netTarget as { x?: number; y?: number; z?: number } | undefined;
        if (Number.isFinite(netTarget?.x) && Number.isFinite(netTarget?.z)) {
          this.pendingGoalNetImpact = {
            target: new THREE.Vector3(
              Number(netTarget?.x),
              Number.isFinite(netTarget?.y) ? Number(netTarget?.y) : BALL_GROUND_Y,
              Number(netTarget?.z),
            ),
            force: 0.72,
            ttl: 1.8,
          };
        }
      }
      if (event.action === 'TACKLE' || event.action === 'TURNOVER') this.spawnEventCue(0x6ee787, 0.8, 0.95);
      if (event.action === 'TACKLE_MISS') this.spawnEventCue(0x9aa4b2, 0.42, 0.55);
      if (event.action === 'THROW_IN' || event.action === 'CORNER' || event.action === 'GOAL_KICK' || event.action === 'FREE_KICK' || event.action === 'PENALTY' || event.action === 'DROP_KICK') {
        const color = event.action === 'THROW_IN' ? 0xb4dcff : event.action === 'CORNER' ? 0xffd16a : event.action === 'FREE_KICK' || event.action === 'PENALTY' ? 0xffffff : 0xd8f7ff;
        this.spawnEventCue(color, event.action === 'CORNER' ? 0.8 : 0.62, 0.78);
        this.updateRestartPresentationFromEvent(event, seq);
      }
      if (event.action === 'SAVE' || event.action === 'SMOTHER') {
        this.spawnEventCue(0xffffff, 0.9, 0.95);
        const team = event.team || '';
        const keeper = this.model.players.find((p) => p.team === team && p.role === 'GK');
        if (keeper) {
          const direction = this.keeperAnimationDirectionFromEvent(event, keeper);
          const zLean = direction === 'left' ? -1 : direction === 'right' ? 1 : Math.sign(this.model.ball.pos.z - keeper.pos.z) || 1;
          const duration = event.action === 'SAVE' ? 0.9 : 0.65;
          this.keeperReactions.set(team, { ttl: duration, duration, zLean, direction });
          this.recordKeeperAnimationEvent(event, keeper, direction, duration, seq);
        }
      }
    }

    for (let i = this.eventCues.length - 1; i >= 0; i--) {
      const cue = this.eventCues[i];
      cue.ttl -= dt;
      cue.mesh.scale.multiplyScalar(1 + dt * 2.5);
      const material = cue.mesh instanceof THREE.Mesh ? cue.mesh.material : null;
      if (material instanceof THREE.Material) {
        material.opacity = Math.max(0, cue.ttl / 0.9);
      }
      if (cue.ttl <= 0) {
        this.scene.remove(cue.mesh);
        if (cue.mesh instanceof THREE.Mesh) {
          cue.mesh.geometry.dispose();
          if (cue.mesh.material instanceof THREE.Material) cue.mesh.material.dispose();
        }
        this.eventCues.splice(i, 1);
      }
    }

    for (const [team, reaction] of this.keeperReactions) {
      reaction.ttl -= dt;
      if (reaction.ttl <= 0) this.keeperReactions.delete(team);
    }
    for (const [playerId, reaction] of this.headerReactions) {
      reaction.ttl -= dt;
      if (reaction.ttl <= 0) this.headerReactions.delete(playerId);
    }
    if (this.activeRestartPresentation) {
      this.activeRestartPresentation.ttl -= dt;
      if (this.activeRestartPresentation.ttl <= 0) this.activeRestartPresentation = null;
    }
  }

  private updateRestartPresentationFromEvent(event: { team: string; action: string; meta?: Record<string, unknown> }, sourceEventSeq: number) {
    const type = this.restartTypeFromEvent(event);
    const phase = event.meta?.phase === 'release' ? 'release' : 'setup';
    const spot = this.pointFromMeta(event.meta?.spot);
    const takerSpot = this.pointFromMeta(event.meta?.takerSpot);
    if (!type || !spot) return;
    const fallbackTaker = this.activeRestartPresentation?.type === type && this.activeRestartPresentation.team === (event.team || '')
      ? this.activeRestartPresentation.takerId
      : null;
    const requestedTakerId = typeof event.meta?.takerId === 'string' ? event.meta.takerId : null;
    const takerId = this.resolveRestartPresentationTakerId(type, event.team || '', spot, requestedTakerId, fallbackTaker);
    const metaDuration = Number(event.meta?.presentationSeconds);
    const duration = Number.isFinite(metaDuration) && metaDuration > 0
      ? metaDuration
      : type === 'corner' && phase === 'setup'
      ? CORNER_SETUP_PRESENTATION_SECONDS
      : type === 'corner' && phase === 'release'
        ? CORNER_RELEASE_PRESENTATION_SECONDS
        : type === 'throw_in' && phase === 'setup'
          ? THROW_IN_SETUP_PRESENTATION_SECONDS
          : type === 'throw_in' && phase === 'release'
            ? THROW_IN_RELEASE_PRESENTATION_SECONDS
            : phase === 'setup' ? 1.8 : 0.8;
    this.activeRestartPresentation = {
      type,
      phase,
      team: event.team || '',
      takerId,
      spot,
      takerSpot,
      ttl: duration,
      duration,
    };
    if (type === 'corner') this.recordCornerPresentationEvent(event, phase, spot, requestedTakerId, takerId, sourceEventSeq);
  }

  private resolveRestartPresentationTakerId(
    type: RestartPresentationType,
    team: string,
    spot: { x: number; z: number },
    requestedTakerId: string | null,
    fallbackTakerId: string | null,
  ) {
    const requestedVisual = requestedTakerId ? this.playerMeshes.get(requestedTakerId) : null;
    if (requestedVisual) return requestedTakerId;
    const fallbackVisual = fallbackTakerId ? this.playerMeshes.get(fallbackTakerId) : null;
    if (fallbackVisual) return fallbackTakerId;
    if (type !== 'corner') return requestedTakerId || fallbackTakerId;

    const visibleCornerTaker = this.model.players
      .filter((player) => player.team === team && player.role !== 'GK' && this.playerMeshes.has(player.id))
      .sort((a, b) => {
        const da = Math.hypot(a.pos.x - spot.x, a.pos.z - spot.z);
        const db = Math.hypot(b.pos.x - spot.x, b.pos.z - spot.z);
        return da - db;
      })[0];
    return visibleCornerTaker?.id || requestedTakerId || fallbackTakerId;
  }

  private recordCornerPresentationEvent(
    event: { team: string; action: string },
    phase: RestartPresentationPhase,
    spot: { x: number; z: number },
    requestedTakerId: string | null,
    takerId: string | null,
    sourceEventSeq: number,
  ) {
    const snapshot = this.model.getMatchSnapshot();
    const taker = takerId ? this.model.players.find((player) => player.id === takerId) || null : null;
    this.cornerPresentationEvents.push({
      action: 'CORNER',
      team: event.team || '',
      phase,
      requestedTakerId,
      takerId,
      takerName: taker?.name || null,
      usedFallback: !!requestedTakerId && requestedTakerId !== takerId,
      spot: { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2) },
      sourceEventSeq,
      phaseName: snapshot.phase,
      clock: `${snapshot.elapsedInHalf.toFixed(2)}s`,
    });
    while (this.cornerPresentationEvents.length > 100) this.cornerPresentationEvents.shift();
  }

  private restartTypeFromEvent(event: { action: string; meta?: Record<string, unknown> }): RestartPresentationType | null {
    const rawType = event.meta?.restartType;
    if (rawType === 'throw_in' || rawType === 'corner' || rawType === 'goal_kick' || rawType === 'free_kick' || rawType === 'penalty' || rawType === 'drop_kick') return rawType;
    if (event.action === 'THROW_IN') return 'throw_in';
    if (event.action === 'CORNER') return 'corner';
    if (event.action === 'GOAL_KICK') return 'goal_kick';
    if (event.action === 'FREE_KICK') return 'free_kick';
    if (event.action === 'PENALTY') return 'penalty';
    if (event.action === 'DROP_KICK') return 'drop_kick';
    return null;
  }

  private pointFromMeta(value: unknown): { x: number; z: number } | null {
    if (!value || typeof value !== 'object') return null;
    const point = value as { x?: unknown; z?: unknown };
    if (typeof point.x !== 'number' || typeof point.z !== 'number') return null;
    return { x: point.x, z: point.z };
  }

  private keeperDiveDirectionFromEvent(event: { meta?: Record<string, unknown> }, keeper: SimplePlayer): KeeperDiveDirection {
    const metaDirection = event.meta?.diveDirection;
    if (metaDirection === 'left' || metaDirection === 'right' || metaDirection === 'up' || metaDirection === 'down') {
      return metaDirection;
    }
    const zLean = Math.sign(this.model.ball.pos.z - keeper.pos.z);
    if (zLean < 0) return 'left';
    if (zLean > 0) return 'right';
    return 'down';
  }

  private keeperAnimationDirectionFromEvent(event: { action: string; meta?: Record<string, unknown> }, keeper: SimplePlayer): KeeperDiveDirection {
    if (event.action === 'SAVE') return this.keeperDiveDirectionFromEvent(event, keeper);
    const ballZ = Number.isFinite(this.model.ball.pos.z) ? this.model.ball.pos.z : keeper.pos.z;
    const zLean = Math.sign(ballZ - keeper.pos.z);
    if (zLean < 0) return 'left';
    if (zLean > 0) return 'right';
    return 'down';
  }

  private recordKeeperAnimationEvent(
    event: { action: string },
    keeper: SimplePlayer,
    direction: KeeperDiveDirection,
    duration: number,
    sourceEventSeq: number,
  ) {
    const snapshot = this.model.getMatchSnapshot();
    this.keeperAnimationEvents.push({
      action: event.action === 'SMOTHER' ? 'SMOTHER' : 'SAVE',
      team: keeper.team,
      keeperId: keeper.id,
      keeperName: keeper.name,
      direction,
      duration,
      sourceEventSeq,
      phase: snapshot.phase,
      clock: `${snapshot.elapsedInHalf.toFixed(2)}s`,
    });
    while (this.keeperAnimationEvents.length > 100) this.keeperAnimationEvents.shift();
  }

  private recordHeaderAnimationEvent(
    event: { action: string },
    player: SimplePlayer,
    kind: 'shot' | 'clearance' | 'touch',
    direction: 1 | -1,
    duration: number,
    sourceEventSeq: number,
  ) {
    const snapshot = this.model.getMatchSnapshot();
    this.headerAnimationEvents.push({
      action: event.action === 'HEADER_SHOT' ? 'HEADER_SHOT' : event.action === 'HEADER_CLEARANCE' ? 'HEADER_CLEARANCE' : 'HEADER_TOUCH',
      team: player.team,
      playerId: player.id,
      playerName: player.name,
      kind,
      direction,
      duration,
      sourceEventSeq,
      phase: snapshot.phase,
      clock: `${snapshot.elapsedInHalf.toFixed(2)}s`,
    });
    while (this.headerAnimationEvents.length > 100) this.headerAnimationEvents.shift();
  }

  private updateBroadcastCamera(dt: number) {
    const focusSource = this.model.ball;
    const focus = new THREE.Vector3(focusSource.pos.x, 0, focusSource.pos.z);
    if (!this.cameraFocusInitialized) {
      this.cameraFocusSmoothed.copy(focus);
      this.cameraFocusInitialized = true;
    } else {
      this.cameraFocusSmoothed.x = THREE.MathUtils.lerp(
        this.cameraFocusSmoothed.x,
        focus.x,
        THREE.MathUtils.clamp(dt * 4.0, 0.08, 0.24),
      );
      this.cameraFocusSmoothed.z = THREE.MathUtils.lerp(
        this.cameraFocusSmoothed.z,
        focus.z,
        THREE.MathUtils.clamp(dt * 3.0, 0.06, 0.18),
      );
    }

    const rig = this.cameraRigs[this.cameraMode] ?? this.cameraRigs.BROADCAST;

    const targetFov = rig.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, THREE.MathUtils.clamp(dt * 2.4, 0.08, 0.22));
      this.camera.updateProjectionMatrix();
    }

    const desiredCamX = THREE.MathUtils.clamp(this.cameraFocusSmoothed.x * rig.followX, -FIELD_W * 0.30, FIELD_W * 0.30);
    const desiredPanZ = THREE.MathUtils.clamp(this.cameraFocusSmoothed.z * rig.panZ, -FIELD_D * 0.18, FIELD_D * 0.18);
    this.cameraLerpPosition.set(desiredCamX, rig.height, rig.back + desiredPanZ);
    this.camera.position.lerp(this.cameraLerpPosition, THREE.MathUtils.clamp(dt * 4.0, 0.08, 0.28));

    this.cameraLookTarget.set(this.camera.position.x, 0, this.camera.position.z - rig.back - rig.lookAhead);
    this.camera.lookAt(this.cameraLookTarget);
  }

  private updateCrowd(dt: number) {
    if (!this.crowdMesh) return;
    const t = this.clock.elapsedTime;
    const goalBoost = this.goalSwellUntil > t ? 2.4 : 1;
    const waveAge = t - this.waveStartTime;
    const waveActive = this.waveStartTime > 0 && waveAge >= 0 && waveAge < 2.5;
    for (const block of this.crowdBlocks) {
      const wave = Math.max(0, Math.sin(t * block.speed + block.phase));
      const mexicanWave = waveActive
        ? Math.max(0, Math.cos(block.angle - waveAge * 3.2)) ** 4 * 1.8
        : 0;
      const y = block.baseY + wave * block.jumpHeight * goalBoost + mexicanWave * block.jumpHeight;
      this.crowdDummy.position.set(
        block.baseX + Math.sin(t * block.vibeSpeedX + block.vibePhaseX) * block.vibeScale,
        y,
        block.baseZ + Math.cos(t * block.vibeSpeedZ + block.vibePhaseZ) * block.vibeScale,
      );
      this.crowdDummy.updateMatrix();
      this.crowdMesh.setMatrixAt(block.instanceIndex, this.crowdDummy.matrix);
    }
    this.crowdMesh.instanceMatrix.needsUpdate = true;
    for (const material of this.goalNetMaterials) {
      material.uniforms.uTime.value = t;
    }
  }

  private updateBannerText() {
    const snap = this.model.getMatchSnapshot();
    const text = `${snap.teamBName || 'AWAY'}  •  •  •  PIXEL SOCCER LEAGUE  •  •  •  ${snap.teamAName || 'HOME'}  •  •  •  `;
    for (const banner of this.bannerTexts) {
      const b = banner as any;
      b.tickerSource = text;
      b.tickerLoop = text.repeat(10);
      b.tickerOffset = 0;
      banner.text = text;
      banner.sync();
    }
  }

  private updateBannerTicker(dt: number) {
    for (const banner of this.bannerTexts) {
      const b = banner as any;
      const source = b.tickerSource || banner.text || 'PIXEL SOCCER LEAGUE | ';
      b.tickerLoop = b.tickerLoop || source.repeat(10);
      b.tickerElapsed = (b.tickerElapsed || 0) + dt;
      if (b.tickerElapsed < 0.11) continue;
      b.tickerElapsed = 0;
      b.tickerOffset = ((b.tickerOffset || 0) + 1) % source.length;
      const doubled = b.tickerLoop + b.tickerLoop;
      const nextText = doubled.slice(b.tickerOffset, b.tickerOffset + 124);
      if (nextText !== banner.text) {
        banner.text = nextText;
        banner.sync();
      }
    }
  }

  private createMiniMap() {
    const panelInset = this.miniMapPanelInset;
    const panelWidth = this.miniMapPanelWidth;
    const halfWidth = Math.round(this.miniMapWidth / 2);
    const awayPanelOffset = -halfWidth + panelInset * 2 + panelWidth;

    const pitchCanvas = document.createElement('canvas');
    pitchCanvas.id = 'canvasPitch';
    pitchCanvas.width = this.miniMapWidth;
    pitchCanvas.height = this.miniMapHeight;
    Object.assign(pitchCanvas.style, {
      position: 'fixed',
      bottom: '10px',
      left: '50%',
      transform: this.miniMapTiltTransform,
      transformOrigin: 'center bottom',
      zIndex: '20',
      opacity: '0.6',
      backgroundColor: '#009900',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '6px',
      pointerEvents: 'none',
    });

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'canvasPitchAI';
    overlayCanvas.width = this.miniMapWidth;
    overlayCanvas.height = this.miniMapHeight;
    Object.assign(overlayCanvas.style, {
      position: 'fixed',
      bottom: '10px',
      left: '50%',
      transform: this.miniMapTiltTransform,
      transformOrigin: 'center bottom',
      zIndex: '30',
      pointerEvents: 'none',
    });

    const panelStyle = {
      position: 'fixed',
      bottom: '15px',
      width: '140px',
      padding: '6px',
      background: 'rgba(0,0,0,0.7)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px',
      color: 'white',
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: '12px',
      zIndex: '40',
      textAlign: 'center',
      display: 'none',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as const;

    const homePanel = document.createElement('div');
    homePanel.id = 'homePossessionPanel';
    Object.assign(homePanel.style, panelStyle, {
      width: `${panelWidth}px`,
      left: `calc(50% - ${halfWidth - panelInset}px)`,
    });

    const awayPanel = document.createElement('div');
    awayPanel.id = 'awayPossessionPanel';
    Object.assign(awayPanel.style, panelStyle, {
      width: `${panelWidth}px`,
      left: `calc(50% + ${awayPanelOffset}px)`,
    });

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    Object.assign(toggleButton.style, {
      position: 'fixed',
      right: '12px',
      top: '46px',
      padding: '6px 8px',
      background: 'rgba(0,0,0,0.62)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '6px',
      color: 'rgba(167,236,255,0.95)',
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: '11px',
      lineHeight: '1',
      cursor: 'pointer',
      zIndex: '220',
    });
    toggleButton.addEventListener('click', () => {
      this.showMiniMap = !this.showMiniMap;
      this.applyMiniMapVisibility();
    });

    this.container.appendChild(pitchCanvas);
    this.container.appendChild(overlayCanvas);
    this.container.appendChild(homePanel);
    this.container.appendChild(awayPanel);
    this.container.appendChild(toggleButton);

    return { pitchCanvas, overlayCanvas, homePanel, awayPanel, toggleButton };
  }

  private miniMapHidden() {
    const phase = this.model.getMatchSnapshot().phase;
    return this.menuVisible || this.splashSceneMode || !this.showMiniMap || phase === 'PRE_MATCH' || phase === 'FULL_TIME';
  }

  private applyMiniMapVisibility() {
    const hidden = this.miniMapHidden();
    this.miniMapPitchCanvas.style.display = hidden ? 'none' : 'block';
    this.miniMapOverlayCanvas.style.display = hidden ? 'none' : 'block';
    this.miniMapToggleBtn.style.display = (this.menuVisible || this.splashSceneMode) ? 'none' : 'block';
    this.miniMapToggleBtn.textContent = this.showMiniMap ? 'MINIMAP ON' : 'MINIMAP OFF';
    this.miniMapToggleBtn.style.color = this.showMiniMap ? 'rgba(167,236,255,0.95)' : 'rgba(255,255,255,0.88)';
    if (hidden) {
      this.miniMapHomePanel.style.display = 'none';
      this.miniMapAwayPanel.style.display = 'none';
    }
  }

  private worldToMiniMap(x: number, z: number) {
    const pad = this.miniMapPitchPad;
    return {
      x: pad + ((x + FIELD_W / 2) / FIELD_W) * (this.miniMapWidth - pad * 2),
      y: pad + ((z + FIELD_D / 2) / FIELD_D) * (this.miniMapHeight - pad * 2),
    };
  }

  private drawMiniMapPitch() {
    const ctx = this.miniMapPitchCanvas.getContext('2d');
    if (!ctx) return;
    const w = this.miniMapWidth;
    const h = this.miniMapHeight;
    const pad = this.miniMapPitchPad;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a8f35';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;

    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.beginPath();
    ctx.moveTo(w / 2, pad);
    ctx.lineTo(w / 2, h - pad);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();

    const penW = w * 0.18;
    const penH = h * 0.46;
    const goalW = w * 0.07;
    const goalH = h * 0.24;
    const penY = (h - penH) / 2;
    const goalY = (h - goalH) / 2;
    ctx.strokeRect(pad, penY, penW, penH);
    ctx.strokeRect(w - pad - penW, penY, penW, penH);
    ctx.strokeRect(pad, goalY, goalW, goalH);
    ctx.strokeRect(w - pad - goalW, goalY, goalW, goalH);
    ctx.beginPath();
    ctx.arc(pad + penW * 0.62, h / 2, 2.2, 0, Math.PI * 2);
    ctx.arc(w - pad - penW * 0.62, h / 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private updateMiniMap() {
    this.applyMiniMapVisibility();
    if (this.miniMapHidden()) return;
    const now = performance.now();
    if (now - this.lastMiniMapDrawMs < 1000 / 30) return;
    this.lastMiniMapDrawMs = now;

    const ctx = this.miniMapOverlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.miniMapWidth, this.miniMapHeight);

    const players = this.model.getPlayers();
    const pad = this.miniMapPitchPad;
    for (const player of players) {
      const pos = this.worldToMiniMap(player.pos.x, player.pos.z);
      const radius = player.role === 'GK' ? 4.1 : 3.2;
      const x = THREE.MathUtils.clamp(pos.x, pad + radius, this.miniMapWidth - pad - radius);
      const y = THREE.MathUtils.clamp(pos.y, pad + radius, this.miniMapHeight - pad - radius);
      const color = player.team === 'A'
        ? `#${(player.role === 'GK' ? M.teamAKeeperShirt : M.teamAShirt).color.getHexString()}`
        : `#${(player.role === 'GK' ? M.teamBKeeperShirt : M.teamBShirt).color.getHexString()}`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
    }

    const carrier = this.model.possession;
    if (carrier) {
      const pos = this.worldToMiniMap(carrier.pos.x, carrier.pos.z);
      const x = THREE.MathUtils.clamp(pos.x, pad + 6.4, this.miniMapWidth - pad - 6.4);
      const y = THREE.MathUtils.clamp(pos.y, pad + 6.4, this.miniMapHeight - pad - 6.4);
      ctx.beginPath();
      ctx.arc(x, y, 6.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    const ball = this.worldToMiniMap(this.model.ball.pos.x, this.model.ball.pos.z);
    const lastTrail = this.miniMapBallTrail[this.miniMapBallTrail.length - 1];
    if (!lastTrail || Math.hypot(ball.x - lastTrail.x, ball.y - lastTrail.y) > 0.7) {
      this.miniMapBallTrail.push(ball);
      if (this.miniMapBallTrail.length > 18) this.miniMapBallTrail.shift();
    }
    for (let i = 1; i < this.miniMapBallTrail.length; i++) {
      const a = this.miniMapBallTrail[i - 1];
      const b = this.miniMapBallTrail[i];
      const alpha = (i / this.miniMapBallTrail.length) * 0.45;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    const clampedBallX = THREE.MathUtils.clamp(ball.x, pad + 2.6, this.miniMapWidth - pad - 2.6);
    const clampedBallY = THREE.MathUtils.clamp(ball.y, pad + 2.6, this.miniMapHeight - pad - 2.6);
    ctx.beginPath();
    ctx.arc(clampedBallX, clampedBallY, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();

    this.updateMiniMapPossessionPanels(players);
  }

  private updateMiniMapPossessionPanels(players: SimplePlayer[]) {
    const ball = this.model.ball.pos;
    const panelPlayer = (team: 'A' | 'B') => {
      if (this.model.possession?.team === team) return this.model.possession;
      const fieldPlayers = players.filter((player) => player.team === team && player.role !== 'GK');
      return fieldPlayers.reduce<SimplePlayer | null>((best, player) => {
        if (!best) return player;
        const playerGap = Math.hypot(player.pos.x - ball.x, player.pos.z - ball.z);
        const bestGap = Math.hypot(best.pos.x - ball.x, best.pos.z - ball.z);
        return playerGap < bestGap ? player : best;
      }, null);
    };

    for (const { player, panel } of [
      { player: panelPlayer('A'), panel: this.miniMapHomePanel },
      { player: panelPlayer('B'), panel: this.miniMapAwayPanel },
    ]) {
      if (!player || this.miniMapHidden()) {
        panel.style.display = 'none';
        continue;
      }
      const parts = player.name.split(/\s+/).filter(Boolean);
      const lastName = parts.at(-1) || player.name || 'Player';
      panel.textContent = `${player.role.toUpperCase().slice(0, 2)} ${lastName}`;
      panel.style.display = 'block';
    }
  }

  private spawnEventCue(color: number, radius: number, ttl: number) {
    const cue = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.08, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    cue.rotation.x = -Math.PI / 2;
    cue.position.set(this.ballGroup.position.x, 0.08, this.ballGroup.position.z);
    cue.name = 'eventCue';
    this.scene.add(cue);
    this.eventCues.push({ mesh: cue, ttl });
  }

  private createScoreBug() {
    const el = document.createElement('div');
    el.dataset.pslScoreboard = 'engine-live';
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.top = '20px';
    el.style.transform = 'translateX(-50%)';
    el.style.zIndex = '90';
    el.style.pointerEvents = 'none';
    el.style.display = 'none';
    el.style.height = '68px';
    el.style.minWidth = '560px';
    el.style.maxWidth = 'min(92vw, 720px)';
    el.style.color = '#000';
    el.style.fontFamily = 'Inter, Helvetica Neue, Arial, sans-serif';
    return el;
  }

  private updateScoreBug() {
    const snap = this.model.getMatchSnapshot();
    const shouldShow = this.scoreBugVisible && snap.phase !== 'PRE_MATCH' && snap.phase !== 'FULL_TIME';
    this.scoreBugEl.style.display = shouldShow ? 'flex' : 'none';
    if (!shouldShow) return;

    const phase = this.scoreBugPhase(snap.phase);
    const clock = this.scoreBugClock(snap);
    const teamA = this.escapeHtml(snap.teamAName || 'Home');
    const teamB = this.escapeHtml(snap.teamBName || 'Away');
    const colorA = `#${M.teamAShirt.color.getHexString()}`;
    const colorB = `#${M.teamBShirt.color.getHexString()}`;
    const shortA = this.escapeHtml(this.shortScoreBugName(snap.teamAName || 'Home'));
    const shortB = this.escapeHtml(this.shortScoreBugName(snap.teamBName || 'Away'));
    const phaseLabel = this.paused ? 'PAUSED' : phase;
    const textKey = `${phaseLabel}|${clock}|${teamA}|${snap.scoreA}|${snap.scoreB}|${teamB}|${colorA}|${colorB}`;
    if (textKey === this.lastScoreBugText) return;
    this.lastScoreBugText = textKey;

    this.scoreBugEl.innerHTML = `
      <div style="position:relative; height:68px; width:min(92vw,720px); min-width:560px; background:#fff; border:1px solid rgba(255,255,255,.1); border-radius:6px; overflow:hidden; box-shadow:0 6px 28px rgba(0,0,0,.65); display:flex; align-items:stretch;">
        <div style="position:absolute; left:0; top:0; z-index:2; width:100%; height:3px; background:linear-gradient(90deg, ${colorA} 0 50%, ${colorB} 50% 100%);"></div>
        <div style="flex:1; min-width:0; display:flex; align-items:center; justify-content:flex-end; gap:12px; padding:0 20px;">
          <div style="min-width:0; text-align:right;">
            <div style="font-size:10px; line-height:1; color:rgba(0,0,0,.55); letter-spacing:.12em; text-transform:uppercase;">Home</div>
            <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; line-height:1.2; color:#000; font-weight:800; text-transform:uppercase;">${teamA}</div>
          </div>
          <div style="height:40px; width:40px; flex:0 0 40px; border-radius:4px; background:${colorA}; display:grid; place-items:center; color:#fff; font-size:10px; font-weight:900; text-transform:uppercase; box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);">${shortA}</div>
          <div style="min-width:28px; text-align:center; font-size:34px; line-height:1; color:#000; font-weight:900; font-variant-numeric:tabular-nums;">${snap.scoreA}</div>
        </div>
        <div style="width:128px; flex:0 0 128px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:0 10px; border-left:1px solid rgba(0,0,0,.1); border-right:1px solid rgba(0,0,0,.1); background:#fff;">
          <div style="font-family:Roboto Mono, Courier New, monospace; font-size:26px; line-height:1; color:#000; font-weight:700; letter-spacing:.04em; font-variant-numeric:tabular-nums;">${clock}</div>
          <div style="font-size:10px; line-height:1; color:rgba(0,0,0,.72); font-weight:600; letter-spacing:.12em; text-transform:uppercase;">${phaseLabel}</div>
        </div>
        <div style="flex:1; min-width:0; display:flex; align-items:center; justify-content:flex-start; gap:12px; padding:0 20px;">
          <div style="min-width:28px; text-align:center; font-size:34px; line-height:1; color:#000; font-weight:900; font-variant-numeric:tabular-nums;">${snap.scoreB}</div>
          <div style="height:40px; width:40px; flex:0 0 40px; border-radius:4px; background:${colorB}; display:grid; place-items:center; color:#fff; font-size:10px; font-weight:900; text-transform:uppercase; box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);">${shortB}</div>
          <div style="min-width:0; text-align:left;">
            <div style="font-size:10px; line-height:1; color:rgba(0,0,0,.55); letter-spacing:.12em; text-transform:uppercase;">Away</div>
            <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; line-height:1.2; color:#000; font-weight:800; text-transform:uppercase;">${teamB}</div>
          </div>
        </div>
      </div>
    `;
  }

  private scoreBugClock(snapshot: ReturnType<SimpleMatchModel['getMatchSnapshot']>) {
    const elapsed = Math.max(0, Number(snapshot.elapsedInHalf) || 0);
    const halfDuration = Math.max(1, Number(snapshot.halfDuration) || 45 * 60);
    const halfOffset = snapshot.half === 2 ? halfDuration : 0;
    const totalSeconds = Math.floor(halfOffset + elapsed);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private scoreBugPhase(phase: string) {
    if (phase === 'FIRST_HALF') return '1ST HALF';
    if (phase === 'SECOND_HALF') return '2ND HALF';
    if (phase === 'HALFTIME') return 'HT';
    if (phase === 'FULL_TIME') return 'FT';
    if (phase === 'KICKOFF') return 'KO';
    return 'PRE';
  }

  private shortScoreBugName(value: string) {
    return String(value)
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 3) || 'FC';
  }

  private escapeHtml(value: string) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char));
  }

  private setNamedVisibility(name: string, visible: boolean) {
    this.scene.traverse((object) => {
      if (object.name === name || object.name.startsWith(name)) object.visible = visible;
    });
  }

  private resize = () => {
    const viewportWidth = window.innerWidth || 1280;
    const viewportHeight = window.innerHeight || 720;
    const width = Math.max(1, Math.min(this.container.clientWidth || viewportWidth, viewportWidth));
    const height = Math.max(1, Math.min(this.container.clientHeight || viewportHeight, viewportHeight));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  /** Delegates to the shared selector so the UI poller agrees on the device. */
  private pickGamepad(): Gamepad | null {
    return pickStandardGamepad(this.gamepadLatch, () => this.gameplayGpPrev.fill(false));
  }

  private pollManualControls(modelActive: boolean) {
    if (!this.humanControlEnabled && !this.twoPlayerMode) return;
    if (!modelActive) {
      this.model.setManualMove('A', 0, 0);
      this.model.setManualMove('B', 0, 0);
      return;
    }

    const right = new THREE.Vector3();
    right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    right.y = 0;
    right.normalize();

    const forward = new THREE.Vector3();
    forward.crossVectors(right, new THREE.Vector3(0, 1, 0)).negate().normalize();
    if (right.lengthSq() < 0.01 || forward.lengthSq() < 0.01) {
      right.set(1, 0, 0);
      forward.set(0, 0, -1);
    }

    const moveA = new THREE.Vector3();
    if (this.pressedKeys.has('KeyW')) moveA.add(forward);
    if (this.pressedKeys.has('KeyS')) moveA.addScaledVector(forward, -1);
    if (this.pressedKeys.has('KeyA')) moveA.addScaledVector(right, -1);
    if (this.pressedKeys.has('KeyD')) moveA.add(right);

    const gamepad = this.pickGamepad();
    const gamepadActive = this.humanControlEnabled && !!gamepad;
    if (gamepadActive && gamepad) {
      const axisX = Math.abs(gamepad.axes[0] ?? 0) > 0.2 ? (gamepad.axes[0] ?? 0) : 0;
      const axisY = Math.abs(gamepad.axes[1] ?? 0) > 0.2 ? (gamepad.axes[1] ?? 0) : 0;
      moveA.addScaledVector(right, axisX);
      moveA.addScaledVector(forward, -axisY);
    }

    const moveB = new THREE.Vector3();
    if (this.pressedKeys.has('ArrowUp')) moveB.add(forward);
    if (this.pressedKeys.has('ArrowDown')) moveB.addScaledVector(forward, -1);
    if (this.pressedKeys.has('ArrowLeft')) moveB.addScaledVector(right, -1);
    if (this.pressedKeys.has('ArrowRight')) moveB.add(right);

    const normalizeMove = (vector: THREE.Vector3) => {
      vector.y = 0;
      if (vector.lengthSq() <= 0.0001) return { x: 0, z: 0 };
      vector.normalize();
      return { x: vector.x, z: vector.z };
    };

    const nextA = this.humanControlEnabled ? normalizeMove(moveA) : { x: 0, z: 0 };
    const nextB = this.twoPlayerMode ? normalizeMove(moveB) : { x: 0, z: 0 };
    this.model.setManualMove('A', nextA.x, nextA.z);
    this.model.setManualMove('B', nextB.x, nextB.z);

    // Hold to sprint: Left Shift / gamepad RT for player 1, Right Shift for player 2.
    const gamepadSprint = !!gamepad && (!!gamepad.buttons[7]?.pressed || !!gamepad.buttons[6]?.pressed);
    this.model.setManualSprint('A', this.humanControlEnabled && (this.pressedKeys.has('ShiftLeft') || gamepadSprint));
    this.model.setManualSprint('B', this.twoPlayerMode && this.pressedKeys.has('ShiftRight'));

    // Buttons are dispatched only after the aim above is committed to the
    // model. Dispatching first made pass/shot read the previous frame's stick,
    // so flicking the stick and shooting in the same instant aimed at stale
    // input -- the reason gamepad shots ignored direction.
    if (gamepadActive && gamepad) {
      const justPressed = (index: number) => !!gamepad.buttons[index]?.pressed && !this.gameplayGpPrev[index];
      const justReleased = (index: number) => !gamepad.buttons[index]?.pressed && this.gameplayGpPrev[index];
      if (justPressed(0)) this.model.beginManualCharge('A', 'pass');
      if (justPressed(1)) this.model.beginManualCharge('A', 'shot');
      if (justReleased(0) || justReleased(1)) this.model.releaseManualCharge('A');
      if (justPressed(2)) {
        // X tackles when there is someone to tackle, otherwise it switches to
        // the player nearest the ball -- the old build's behaviour.
        if (!this.model.triggerManualTackle('A')) this.model.selectNearestManualPlayer('A');
      }
      if (justPressed(3)) this.model.triggerManualLobPass('A');
      if (justPressed(4)) this.model.cycleManualPlayer('A', -1);
      if (justPressed(5)) this.model.cycleManualPlayer('A', 1);
      for (let i = 0; i < this.gameplayGpPrev.length; i++) {
        this.gameplayGpPrev[i] = !!gamepad.buttons[i]?.pressed;
      }
    } else {
      this.gameplayGpPrev.fill(false);
    }
  }

  private isModelActive() {
    return !this.paused && !this.menuVisible && !this.splashSceneMode;
  }

  private advanceModel(dt: number, updateVisuals: boolean) {
    if (dt <= 0) return;
    const maxChunk = 0.05;
    let remaining = Math.min(dt, 1.25);
    while (remaining > 0.0001 && !this.disposed && this.isModelActive()) {
      const stepDt = Math.min(maxChunk, remaining);
      this.model.step(stepDt);
      if (updateVisuals) this.model.updateVisuals(stepDt);
      remaining -= stepDt;
    }
  }

  private startBackgroundModelLoop() {
    if (this.backgroundModelTimer !== null) return;
    this.lastBackgroundModelTickMs = performance.now();
    this.backgroundModelTimer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(0, (now - this.lastBackgroundModelTickMs) / 1000);
      this.lastBackgroundModelTickMs = now;
      if (this.disposed || !document.hidden || !this.isModelActive()) return;
      this.advanceModel(elapsed, false);
    }, 250);
  }

  private animate = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    const modelActive = this.isModelActive();
    this.pollManualControls(modelActive);
    if (modelActive && !document.hidden) {
      this.lastBackgroundModelTickMs = performance.now();
      this.advanceModel(dt, true);
    }
    this.updateMeshes(dt);
    this.updateScoreBug();
    this.updateMiniMap();
    if (modelActive) {
      this.processLiveEventCues(dt);
      this.updateBroadcastCamera(dt);
      this.updateCrowd(dt);
      this.updateBannerTicker(dt);
    }
    this.frameCount += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount / this.fpsTimer;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
    this.renderer.render(this.scene, this.camera);
  };
}

export function initGame(container: HTMLElement): any {
  return new SimpleGameEngine(container);
}

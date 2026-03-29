import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { OFFENSE_FORMATIONS, DEFENSE_FORMATIONS, PASS_PLAYBOOK, DEFENSE_PLAYBOOK } from './playbookData';
import { MLS_PLAYER_RATINGS, type MLSPlayerRating } from './mlsRatings';
import { getMLS2025TeamModifiers } from './mlsTeamStats2025';

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
};

export const TEAM_PALETTES = {
  teamA: { shirt: M.teamAShirt, pants: M.teamAPants, hair: M.hairBlack, visor: M.teamAVisor },
  teamB: { shirt: M.teamBShirt, pants: M.teamBPants, hair: M.hairBlack, visor: M.teamBVisor },
};

export const PLAYER_IDLE_PATTERNS = [
  // Frame 0 – neutral stand: both feet flat, arms at sides
  ['00000000000111111000','00000000000111100000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00111000011100000000','00111000011111100000'],
  // Frame 1 – weight right: left knee raised, right foot planted
  ['00000000000111111000','00000000000111100000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00011000011100000000','00000000011100000000','00000000011100000000','00000000011111100000'],
  // Frame 2 – arms up / ready: arms raised one row, both feet flat
  ['00000000000111111000','00000000000111100000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111111000','00001111111111000000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00111000011100000000','00111000011111100000'],
  // Frame 3 – weight left: right knee raised, left foot planted
  ['00000000000111111000','00000000000111100000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000001100000000','00111000000000000000','00111000000000000000','00111110000000000000'],
];

export const PLAYER_PATTERNS = [
  ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011100111110000000','00011100111111111111','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000011100','00011100000000011100','01111100000000000000','01110000000000000000','01110000000000000000'],
  ['00000000001111110000','00000000001110000000','01111111111111110000','01110000111110000000','01110000111111111111','00000000111110000000','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000000111','00011100000000000111','01111100000000000000','01110000000000000000','00000000000000000000'],
  ['00000000011111100000','00000000011100000000','00001111111111100000','00111111111100000000','00111001111100000000','00111001111111111110','00000000000000000000','00000001111100000000','00000001111100000000','00001111111111100000','00001110000111100000','00111110000111111000','11111000000000111000','11100000000000111000','00000000000000111110','00000000000000000000'],
  ['00000000000011111100','00000000000011100000','00000000111111111100','00000111111111110000','00011111111111110000','00011100111111111100','00011100000000000000','00000000111110000000','00000111111110000000','00000111111111110000','00000111100011110000','01111111100011110000','01110000000011110000','01110000000011110000','00000000000011110000','00000000000011111100'],
  ['00000000000111111000','00000000000111000000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00000000011100000000','00000000011111100000'],
  ['00000000001111110000','00000000001110000000','00000000111111110000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00011111111110000000','00011100111000000000','00011100111000000000','00000000111000000000','00000000111110000000'],
  ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011111111110000000','00011111111110000000','00011111111111110000','00000111111000000000','00000111111110000000','00011111111111110000','00011100000011110000','00011100000111110000','00011100000011100000','00011100000000000000','00011100000000000000','00000111100000000000'],
  ['00000000000111111000','00000000000111000000','00000001111111111000','00001111111111100000','00111111111111100000','00111001111111111000','00111000000000000000','00000001111100000000','00000001111111100000','00001111111111111110','00001110000000001110','00001110000011111110','00001110000011100000','00111000000011100000','00111000000000000000','00111000000000000000'],
];

const PLAYER_VOXEL_SIZE = 0.0665;
const PLAYER_SPRITE_CENTER_Y = PLAYER_VOXEL_SIZE * 7.5;

export function buildPlayerFrame(pattern: string[], palette: { shirt: THREE.Material; pants: THREE.Material; hair: THREE.Material; visor: THREE.Material }) {
  const group = new THREE.Group();
  const voxelSize = PLAYER_VOXEL_SIZE;
  const rows = pattern.length;
  const cols = pattern[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pattern[r][c] === '1') {
        let mat = palette.shirt;
        if (r < 2) mat = palette.hair;
        else if (r === 2 && c > 10 && c < 15) mat = palette.visor;
        else if (r > 9) mat = palette.pants;
        const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize * 3.0);
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.castShadow = true;
        mesh.position.set((c - cols / 2) * voxelSize, (rows / 2 - r) * voxelSize, 0);
        group.add(mesh);
      }
    }
  }
  return group;
}

export function initGame(container: HTMLElement) {
  // --- Sound Manager ---
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  function playSound(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  const sounds = {
    throw: () => playSound(400, 'sine', 0.2, 0.05),
    catch: () => playSound(200, 'triangle', 0.1, 0.08),
    whistle: () => {
      playSound(1460, 'square', 0.08, 0.06);
      setTimeout(() => playSound(1280, 'square', 0.08, 0.055), 90);
    },
    touchdown: () => {
      playSound(440, 'square', 0.2, 0.05);
      setTimeout(() => playSound(554, 'square', 0.2, 0.05), 200);
      setTimeout(() => playSound(659, 'square', 0.4, 0.05), 400);
    },
    incomplete: () => playSound(100, 'sawtooth', 0.3, 0.05),
    select: () => playSound(800, 'sine', 0.05, 0.02)
  };

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(window.devicePixelRatio);
  
  const bannerTexts: Text[] = [];
  const teamABannerMeshes: Text[] = [];
  const teamBBannerMeshes: Text[] = [];
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.style.display = 'block';
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // Crisper shadows
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const teamAUniformPalettes = {
    home: { label: 'Home', shirt: 0xf52b8f, pants: 0xffffff, visor: 0x000000 },
    away: { label: 'Away', shirt: 0xffffff, pants: 0xf52b8f, visor: 0x000000 },
    alternate: { label: 'Alternate', shirt: 0x231f20, pants: 0xf52b8f, visor: 0xf52b8f },
  };

  const GOALKEEPER_KIT_HEX_OPTIONS = [0x7fff00, 0xff7a00, 0x8a2be2, 0xfff200];
  const keeperKitHexByTeam: Record<'A' | 'B', number> = { A: 0x7fff00, B: 0xff7a00 };

  function pickRandomGoalkeeperKitHex() {
    return GOALKEEPER_KIT_HEX_OPTIONS[Math.floor(Math.random() * GOALKEEPER_KIT_HEX_OPTIONS.length)];
  }

  function applyGoalkeeperKitHex(team: 'A' | 'B', hex: number) {
    keeperKitHexByTeam[team] = hex;
    if (team === 'A') {
      M.teamAKeeperShirt.color.setHex(hex);
      M.teamAKeeperPants.color.setHex(hex);
      return;
    }
    M.teamBKeeperShirt.color.setHex(hex);
    M.teamBKeeperPants.color.setHex(hex);
  }

  function assignRandomGoalkeeperKits() {
    applyGoalkeeperKitHex('A', pickRandomGoalkeeperKitHex());
    applyGoalkeeperKitHex('B', pickRandomGoalkeeperKitHex());
  }

  function getKeeperPaletteForTeam(team: 'A' | 'B', hair: THREE.Material, visor: THREE.Material) {
    return team === 'A'
      ? { shirt: M.teamAKeeperShirt, pants: M.teamAKeeperPants, hair, visor }
      : { shirt: M.teamBKeeperShirt, pants: M.teamBKeeperPants, hair, visor };
  }

  function getPaletteForPlayer(player: any, basePalette: any) {
    if ((player?.displayRole || player?.role) !== 'GK') return basePalette;
    return getKeeperPaletteForTeam(player.team, basePalette.hair, basePalette.visor);
  }

  assignRandomGoalkeeperKits();

  function performPossessionSwap() {
    console.log('Swapping possession from', gameState.offensiveTeam);
    gameState.offensiveTeam = gameState.offensiveTeam === 'A' ? 'B' : 'A';
    gameState.crossAssistTeam = '';
    gameState.crossAssistUntil = 0;
    console.log('Swapped to', gameState.offensiveTeam);
    ballState.pos.set(gameState.ballPos.x, 1.2, 0);
    ballState.vel.set(0, 0, 0);
    ballState.heldBy = null;
    setupFormation();
  }

  function swapSides() {
    gameState.ballPos.x = -gameState.ballPos.x;
    ballState.pos.set(gameState.ballPos.x, 1.2, 0);
    setupFormation();
  }

  const soccerRestart = {
    type: 'KICK_OFF' as 'KICK_OFF' | 'THROW_IN' | 'GOAL_KICK' | 'CORNER' | 'TURNOVER' | 'PENALTY',
    team: 'A' as 'A' | 'B',
    lastTouchTeam: 'A' as 'A' | 'B',
  };

  const kickoffLawState = {
    active: false,
    kickoffTeam: 'A' as 'A' | 'B',
    kicker: null as any,
    firstKickTaken: false,
    touchedByAnotherPlayer: false,
    centerPosition: new THREE.Vector3(0, 0.15, 0),
  };

  const kickoffPresentation = {
    active: false,
    autoKick: true,
    fieldRevealAt: 0,
    whistleAt: 0,
    kickoffAt: 0,
    whistlePlayed: false,
  };

  const freeKickPresentation = {
    active: false,
    taker: null as any,
    receiver: null as any,
    startedAt: 0,
    whistleAt: 0,
    restartAt: 0,
    foulSpot: new THREE.Vector3(),
    takerStart: new THREE.Vector3(),
    whistlePlayed: false,
  };

  const throwInPresentation = {
    active: false,
    thrower: null as any,
    throwAt: 0,
    holdStarted: 0,
  };

  const penaltyPresentation = {
    active: false,
    kicker: null as any,
    keeperTeam: '' as 'A' | 'B' | '',
    penaltySpotX: 0,
    whistleAt: 0,
    shotAt: 0,
    whistlePlayed: false,
    shotTaken: false,
  };

  const kickoffSchedule = {
    firstHalfTeam: 'A' as 'A' | 'B',
    secondHalfTeam: 'B' as 'A' | 'B',
  };

  function teamAttacksRight(team: 'A' | 'B') {
    return matchClock.half === 1 ? team === 'A' : team === 'B';
  }

  function getTeamAttackingGoal(rightGoal: boolean) {
    const rightAttacker = teamAttacksRight('A') ? 'A' : 'B';
    return rightGoal ? rightAttacker : (rightAttacker === 'A' ? 'B' : 'A');
  }

  function setKickoffScheduleByCoinToss() {
    const firstHalfTeam = Math.random() < 0.5 ? 'A' : 'B';
    kickoffSchedule.firstHalfTeam = firstHalfTeam;
    kickoffSchedule.secondHalfTeam = firstHalfTeam === 'A' ? 'B' : 'A';
  }

  function clearKickoffLawState() {
    kickoffLawState.active = false;
    kickoffLawState.kicker = null;
    kickoffLawState.firstKickTaken = false;
    kickoffLawState.touchedByAnotherPlayer = false;
  }

  function markKickoffTouch(player: any) {
    if (!kickoffLawState.active || !player) return;
    if (player !== kickoffLawState.kicker) {
      kickoffLawState.touchedByAnotherPlayer = true;
      // Kickoff restrictions end once another player touches the ball.
      kickoffLawState.active = false;
      gameState.isKickoff = false;
      gameState.kickoffState = 'NONE';
    }
  }

  function isTeamInOwnHalf(player: any) {
    const attacksRight = teamAttacksRight(player.team);
    return attacksRight ? player.pos.x <= 0 : player.pos.x >= 0;
  }

  function enforceKickoffDoubleTouchIfNeeded(player: any) {
    if (!kickoffLawState.active || !kickoffLawState.firstKickTaken || !player) return false;
    if (player !== kickoffLawState.kicker) return false;
    if (kickoffLawState.touchedByAnotherPlayer) return false;
    startSoccerRestart('TURNOVER', player.team === 'A' ? 'B' : 'A', player.pos.x, player.pos.z, 'INDIRECT FREE KICK');
    gameState.messageReason = 'Double Touch at Kick-Off';
    return true;
  }

  function enforceKickoffRetakeIfIllegal() {
    if (!kickoffLawState.active || kickoffLawState.firstKickTaken) return false;

    const centerRadius = 10 * X_PER_YARD;
    const ballOffSpot = ballState.pos.distanceTo(kickoffLawState.centerPosition) > 0.12;
    const ballMoving = ballState.vel.lengthSq() > 0.03;

    if (ballOffSpot || ballMoving) {
      startSoccerRestart('KICK_OFF', kickoffLawState.kickoffTeam, 0, 0, 'KICK-OFF RETAKE');
      return true;
    }

    const opponents = players.filter((p: any) => p.team !== kickoffLawState.kickoffTeam);
    const teammates = players.filter((p: any) => p.team === kickoffLawState.kickoffTeam && p !== kickoffLawState.kicker);

    for (const p of teammates) {
      if (!isTeamInOwnHalf(p)) {
        startSoccerRestart('KICK_OFF', kickoffLawState.kickoffTeam, 0, 0, 'KICK-OFF RETAKE');
        return true;
      }
    }

    for (const p of opponents) {
      const inOwnHalf = isTeamInOwnHalf(p);
      const awayFromCenter = p.pos.distanceTo(kickoffLawState.centerPosition) >= centerRadius;
      if (!inOwnHalf || !awayFromCenter) {
        startSoccerRestart('KICK_OFF', kickoffLawState.kickoffTeam, 0, 0, 'KICK-OFF RETAKE');
        return true;
      }
    }

    return false;
  }

  let restartAutoStartTimer: ReturnType<typeof setTimeout> | null = null;
  let stuckRestartTimer: ReturnType<typeof setTimeout> | null = null;

  function clearStuckRestartTimer() {
    if (stuckRestartTimer !== null) {
      clearTimeout(stuckRestartTimer);
      stuckRestartTimer = null;
    }
  }

  function beginCurrentRestart() {
    if (matchClock.phase === 'FULL_TIME') return;
    clearStuckRestartTimer();
    freeKickPresentation.active = false;
    freeKickPresentation.taker = null;
    freeKickPresentation.receiver = null;
    freeKickPresentation.whistlePlayed = false;
    throwInPresentation.active = false;
    throwInPresentation.thrower = null;
    penaltyPresentation.active = false;
    penaltyPresentation.kicker = null;
    penaltyPresentation.shotTaken = false;
    gameState.isLive = true;
    const isKickoffRestart = soccerRestart.type === 'KICK_OFF';
    const isGoalKickRestart = soccerRestart.type === 'GOAL_KICK';
    const isThrowInRestart = soccerRestart.type === 'THROW_IN';
    gameState.isKickoff = isKickoffRestart;
    gameState.kickoffState = isKickoffRestart ? 'READY' : 'NONE';
    gameState.status = 'PLAYING';
    gameState.passCaught = false;
    gameState.goalKickInProgress = isGoalKickRestart;
    ballState.isFlying = false;
    ballState.isRolling = false;
    const goalkeeper = offenseTeam.find((p: any) => isGoalkeeper(p)) || null;
    const restartTaker = isGoalKickRestart
      ? (goalkeeper || offenseTeam[0] || null)
      : (
        offenseTeam
          .filter((p: any) => (p.displayRole || p.role) !== 'GK')
          .sort((a: any, b: any) => a.pos.distanceTo(ballState.pos) - b.pos.distanceTo(ballState.pos))[0]
        || goalkeeper
        || offenseTeam[0]
        || null
      );
    ballState.heldBy = restartTaker;
    if (ballState.heldBy) {
      soccerRestart.lastTouchTeam = ballState.heldBy.team;
      if (isKickoffRestart) {
        kickoffLawState.active = true;
        kickoffLawState.kickoffTeam = soccerRestart.team;
        kickoffLawState.kicker = ballState.heldBy;
        kickoffLawState.firstKickTaken = false;
        kickoffLawState.touchedByAnotherPlayer = false;
        kickoffLawState.centerPosition.set(0, 0.15, 0);
        ballState.pos.copy(kickoffLawState.centerPosition);
        ballState.vel.set(0, 0, 0);
      } else if (isThrowInRestart) {
        clearKickoffLawState();
        const now = performance.now() / 1000;
        throwInPresentation.active = true;
        throwInPresentation.thrower = ballState.heldBy;
        throwInPresentation.holdStarted = now;
        throwInPresentation.throwAt = now + 1.0;
        // Ball above head during throw-in hold
        ballState.pos.copy(ballState.heldBy.pos);
        ballState.pos.y = 1.1;
        ballState.vel.set(0, 0, 0);
      } else {
        clearKickoffLawState();
        updateDribbleBallPosition(ballState.heldBy, performance.now() / 1000);
      }
    } else if (!isKickoffRestart) {
      clearKickoffLawState();
    }
    const restartDefenseTeam: 'A' | 'B' = gameState.offensiveTeam === 'A' ? 'B' : 'A';
    playState.activeRoutes = buildActiveRoutes(gameState.offensiveTeam);
    playState.defenseAssignments = buildDefenseAssignments(restartDefenseTeam, gameState.offensiveTeam);
    gameState.lastOffensePlay = gameState.selectedOffensePlay;
    gameState.lastDefensePlay = gameState.selectedDefensePlay;
    sounds.select();
  }

  function executeKickoffTouch() {
    if (!kickoffLawState.active || !kickoffLawState.kicker) return;

    const kicker = kickoffLawState.kicker;
    const attackSign = teamAttacksRight(kicker.team) ? 1 : -1;
    const teammateTarget = players
      .filter((p: any) => p.team === kicker.team && p !== kicker)
      .filter((p: any) => (p.pos.x - kickoffLawState.centerPosition.x) * attackSign <= 0.25)
      .sort((a: any, b: any) => a.pos.distanceTo(kickoffLawState.centerPosition) - b.pos.distanceTo(kickoffLawState.centerPosition))[0] || null;

    const kickDirection = teammateTarget
      ? teammateTarget.pos.clone().sub(kickoffLawState.centerPosition)
      : new THREE.Vector3(-attackSign, 0, 0);
    kickDirection.y = 0;
    if (kickDirection.lengthSq() < 0.001) {
      kickDirection.set(-attackSign, 0, 0);
    }
    kickDirection.normalize();

    ballState.pos.copy(kickoffLawState.centerPosition).addScaledVector(kickDirection, 0.22);
    ballState.pos.y = BALL_GROUND_Y;
    // Use enough speed to guarantee the ball reaches the target teammate.
    const kickTargetPos = teammateTarget ? teammateTarget.pos : kickoffLawState.centerPosition.clone().addScaledVector(kickDirection, 5);
    const kickDist = Math.max(ballState.pos.distanceTo(kickTargetPos), 0.5);
    const weather = getActiveWeatherPreset();
    const minKickSpeed = THREE.MathUtils.clamp(6.8 + kickDist * 2.8, 8.8, 17.5) * GAME_SPEED_SCALE * weather.kickSpeedMul;
    ballState.vel.copy(kickDirection.multiplyScalar(minKickSpeed));
    ballState.heldBy = null;
    ballState.lastHeldBy = kicker;
    ballState.isFlying = false;
    ballState.isRolling = true;
    ballState.isShot = false;
    ballState.possessionLockUntil = performance.now() / 1000 + 0.45;
    kickoffLawState.firstKickTaken = true;
    // After the legal first touch, play is normal soccer.
    gameState.isKickoff = false;
    gameState.kickoffState = 'KICKED';
    gameState.message = '';
  }

  function startKickoffPresentationSequence(autoKick: boolean = true) {
    const now = performance.now() / 1000;
    const kickoffTeam = matchClock.half === 1 ? kickoffSchedule.firstHalfTeam : kickoffSchedule.secondHalfTeam;

    // Ensure the game is staged at a center kickoff before cinematic start.
    startSoccerRestart('KICK_OFF', kickoffTeam, 0, 0, '');

    kickoffPresentation.active = true;
    kickoffPresentation.autoKick = autoKick;
    kickoffPresentation.fieldRevealAt = now + 0.7;
    kickoffPresentation.whistleAt = now + 2.1;
    kickoffPresentation.kickoffAt = now + 2.7;
    kickoffPresentation.whistlePlayed = false;

    gameState.message = 'GET READY';
    gameState.isLive = false;
    gameState.isKickoff = true;
    gameState.kickoffState = 'READY';
  }

  function chooseFreeKickReceiver(team: 'A' | 'B', taker: any, foulSpot: THREE.Vector3) {
    const attackSign = teamAttacksRight(team) ? 1 : -1;
    const teammates = players.filter((p: any) => p.team === team && p !== taker && !isGoalkeeper(p));
    if (teammates.length === 0) {
      return players.find((p: any) => p.team === team && p !== taker) || null;
    }

    return teammates.slice().sort((a: any, b: any) => {
      const aForward = (a.homePos.x - foulSpot.x) * attackSign;
      const bForward = (b.homePos.x - foulSpot.x) * attackSign;
      const aForwardScore = Math.abs(THREE.MathUtils.clamp(aForward, 0, 8 * X_PER_YARD) - 4.5 * X_PER_YARD);
      const bForwardScore = Math.abs(THREE.MathUtils.clamp(bForward, 0, 8 * X_PER_YARD) - 4.5 * X_PER_YARD);
      const aWidthScore = Math.abs(a.homePos.z - foulSpot.z);
      const bWidthScore = Math.abs(b.homePos.z - foulSpot.z);
      return (aForwardScore + aWidthScore * 0.15) - (bForwardScore + bWidthScore * 0.15);
    })[0] || null;
  }

  function startSoccerRestart(type: 'KICK_OFF' | 'THROW_IN' | 'GOAL_KICK' | 'CORNER' | 'TURNOVER' | 'PENALTY', team: 'A' | 'B', x: number, z: number, message: string) {
    clearKickoffLawState();
    throwInPresentation.active = false;
    throwInPresentation.thrower = null;
    penaltyPresentation.active = false;
    penaltyPresentation.kicker = null;
    penaltyPresentation.shotTaken = false;
    freeKickPresentation.active = false;
    freeKickPresentation.taker = null;
    freeKickPresentation.receiver = null;
    soccerRestart.type = type;
    soccerRestart.team = team;
    gameState.crossAssistTeam = '';
    gameState.crossAssistUntil = 0;
    gameState.offensiveTeam = team;
    gameState.ballPos.set(x, 0.15, z);
    gameState.isLive = false;
    gameState.isResetting = false;
    gameState.isKickoff = type === 'KICK_OFF';
    gameState.kickoffState = type === 'KICK_OFF' ? 'READY' : 'NONE';
    gameState.goalKickInProgress = false;
    gameState.status = matchClock.phase === 'FULL_TIME' ? 'START' : 'PLAYING';
    gameState.message = message;
    gameState.messageReason = '';
    gameState.passCaught = false;
    playState.offsidePlayer = null;
    ballState.isFlying = false;
    ballState.isRolling = false;
    ballState.heldBy = null;
    ballState.lastHeldBy = null;
    ballState.vel.set(0, 0, 0);
    ballState.pos.set(type === 'KICK_OFF' ? 0 : x, 0.15, type === 'KICK_OFF' ? 0 : z);
    ballState.keeperDistributor = null;
    setupFormation();
    updateHUD();
    if (restartAutoStartTimer) clearTimeout(restartAutoStartTimer);
    restartAutoStartTimer = null;
    freeKickPresentation.whistlePlayed = false;

    if (type === 'PENALTY') {
      const now = performance.now() / 1000;
      const defendingTeam: 'A' | 'B' = team === 'A' ? 'B' : 'A';
      const attackRight = teamAttacksRight(team);
      const goalX = attackRight ? FIELD_W / 2 : -FIELD_W / 2;
      const spotX = attackRight ? goalX - 12 * X_PER_YARD : goalX + 12 * X_PER_YARD;
      // Place ball on penalty spot
      ballState.pos.set(spotX, 0.15, 0);
      gameState.ballPos.set(spotX, 0.15, 0);
      // Set up penalty presentation
      penaltyPresentation.active = true;
      penaltyPresentation.penaltySpotX = spotX;
      penaltyPresentation.keeperTeam = defendingTeam;
      penaltyPresentation.whistleAt = now + 1.2;
      penaltyPresentation.shotAt = now + 2.4;
      penaltyPresentation.whistlePlayed = false;
      penaltyPresentation.shotTaken = false;
      gameState.message = 'PENALTY KICK';
    } else if (type === 'TURNOVER') {
      const now = performance.now() / 1000;
      const foulSpot = new THREE.Vector3(x, 0.15, z);
      const takerCandidates = offenseTeam
        .filter((p: any) => !isGoalkeeper(p))
        .slice()
        .sort((a: any, b: any) => a.homePos.distanceTo(foulSpot) - b.homePos.distanceTo(foulSpot));
      const taker = takerCandidates[0] || offenseTeam[0] || null;
      const receiver = taker ? chooseFreeKickReceiver(team, taker, foulSpot) : null;
      const attackSign = teamAttacksRight(team) ? 1 : -1;
      const holdTarget = foulSpot.clone().add(new THREE.Vector3(-attackSign * 0.42, 0, 0));
      const takerStart = taker?.homePos?.clone?.() || holdTarget.clone();
      if (takerStart.distanceTo(holdTarget) < 1.2) {
        takerStart.copy(foulSpot).add(new THREE.Vector3(-attackSign * 3.4 * X_PER_YARD, 0, 0));
      }
      freeKickPresentation.active = true;
      freeKickPresentation.taker = taker;
      freeKickPresentation.receiver = receiver;
      freeKickPresentation.startedAt = now;
      freeKickPresentation.whistleAt = now + 1.15;
      freeKickPresentation.restartAt = now + 2.0;
      freeKickPresentation.foulSpot.copy(foulSpot);
      freeKickPresentation.takerStart.copy(takerStart);
      gameState.message = message || 'FREE KICK';
    } else if (type !== 'KICK_OFF') {
      restartAutoStartTimer = setTimeout(() => {
        beginCurrentRestart();
        restartAutoStartTimer = null;
      }, 300);
    }
  }

  function isPlayerOffside(player: any, attackingTeam: 'A' | 'B') {
    const opponents = players.filter(p => p.team !== attackingTeam);
    if (opponents.length < 2) return false;
    const attackRight = teamAttacksRight(attackingTeam);
    const inOppHalf = attackRight ? player.pos.x > 0 : player.pos.x < 0;
    if (!inOppHalf) return false;
    const aheadOfBall = attackRight ? player.pos.x > ballState.pos.x : player.pos.x < ballState.pos.x;
    if (!aheadOfBall) return false;
    const sortedOpponents = opponents.slice().sort((a, b) => attackRight ? b.pos.x - a.pos.x : a.pos.x - b.pos.x);
    const secondLastOpponentX = sortedOpponents[1].pos.x;
    return attackRight ? player.pos.x > secondLastOpponentX : player.pos.x < secondLastOpponentX;
  }

  function isGoalkeeper(player: any) {
    return (player?.displayRole || player?.role) === 'GK';
  }

  function isInsideOwnPenaltyArea(player: any, position: THREE.Vector3 = ballState.pos) {
    const defendsRightGoal = !teamAttacksRight(player.team);
    const inDepth = defendsRightGoal ? position.x >= rightPenaltyX : position.x <= leftPenaltyX;
    return inDepth && Math.abs(position.z) <= penaltyHalfZ;
  }

  function isKeeperHandlingInBox(player: any) {
    return !!player && ballState.heldBy === player && isGoalkeeper(player) && isInsideOwnPenaltyArea(player, player.pos);
  }

  function maybeCallSoccerFoul(challenger: any, carrier: any, dt: number, elapsed: number) {
    if (!challenger || !carrier) return false;
    if (challenger.team === carrier.team) return false;
    if (!gameState.isLive || elapsed < ballState.possessionLockUntil) return false;

    const carrierForward = carrier.vel.clone().setY(0);
    if (carrierForward.lengthSq() < 0.02) {
      carrierForward.set(teamAttacksRight(carrier.team) ? 1 : -1, 0, 0);
    }
    carrierForward.normalize();

    const fromCarrierToChallenger = new THREE.Vector3().subVectors(challenger.pos, carrier.pos);
    fromCarrierToChallenger.y = 0;
    if (fromCarrierToChallenger.lengthSq() < 0.001) return false;
    fromCarrierToChallenger.normalize();

    const fromBehind = carrierForward.dot(fromCarrierToChallenger) < -0.28;
    const speedDelta = Math.max(0, challenger.vel.length() - carrier.vel.length());
    const contactDist = challenger.pos.distanceTo(carrier.pos);
    const contactFactor = THREE.MathUtils.clamp((1.2 - contactDist) / 1.2, 0, 1);
    const foulChancePerSecond = THREE.MathUtils.clamp(
      0.015 + (fromBehind ? 0.08 : 0) + speedDelta * 0.018 + contactFactor * 0.045,
      0.01,
      0.22,
    );
    if (Math.random() >= foulChancePerSecond * dt * 60) return false;

    const foulReasons = fromBehind
      ? ['Tackle from Behind', 'Push in the Back', 'Reckless Challenge']
      : ['Tripping', 'Holding', 'Obstruction', 'Reckless Challenge', 'Dangerous Play'];
    const reason = foulReasons[Math.floor(Math.random() * foulReasons.length)];

    // Check if the foul occurred inside the challenger's own penalty area → penalty kick
    const foulInsidePenaltyArea = isInsideOwnPenaltyArea(challenger, carrier.pos);
    if (foulInsidePenaltyArea) {
      startSoccerRestart('PENALTY', carrier.team, 0, 0, 'PENALTY KICK');
      gameState.message = 'PENALTY KICK';
      gameState.messageReason = reason;
    } else {
      startSoccerRestart('TURNOVER', carrier.team, carrier.pos.x, carrier.pos.z, 'FREE KICK');
      gameState.message = 'FREE KICK';
      gameState.messageReason = reason;
    }
    return true;
  }

  function getCarrierTouchQuality(carrier: any) {
    if (!carrier || ballState.heldBy !== carrier) return 0;
    const ballOffset = carrier.pos.distanceTo(ballState.pos);
    const carrierSpeed = carrier.vel.clone().setY(0).length();
    const looseTouch = THREE.MathUtils.clamp((ballOffset - 0.44) / 0.42, 0, 1);
    const speedLoad = THREE.MathUtils.clamp((carrierSpeed - 4.0) / 4.8, 0, 1);
    return THREE.MathUtils.clamp(looseTouch * 0.72 + speedLoad * 0.28, 0, 1);
  }

  function getForceDirectionSign(defender: any, carrier: any) {
    const defenderBias = Math.sign(defender?.homePos?.z || defender?.pos?.z || 0);
    const attackerBias = Math.sign(carrier?.homePos?.z || carrier?.pos?.z || 0);
    const forceSign = attackerBias !== 0 ? -attackerBias : (defenderBias !== 0 ? defenderBias : (carrier.pos.z >= 0 ? 1 : -1));
    return forceSign || 1;
  }

  function getDefensiveCoverTarget(carrier: any, defender: any, rank: number, forceSign: number) {
    const attackSign = teamAttacksRight(carrier.team as 'A' | 'B') ? 1 : -1;
    const role = (defender?.displayRole || defender?.role || '').toString().toUpperCase();
    const roleSideBias = Math.sign(defender?.homePos?.z || defender?.pos?.z || 0) || forceSign;
    const prefersCentral = role === 'CB' || role === 'DM' || role === 'CM';
    const prefersWide = role === 'LB' || role === 'RB' || role === 'LM' || role === 'RM';
    const cover = carrier.pos.clone();
    if (rank === 1) {
      // First cover defender: role-aware shade (CB/DM central lane, FB/WM wide lane).
      cover.x += -attackSign * (prefersCentral ? 2.8 : 2.2);
      if (prefersCentral) {
        cover.z = THREE.MathUtils.lerp(cover.z, 0, 0.72);
      } else if (prefersWide) {
        cover.z += roleSideBias * 2.0;
      } else {
        cover.z += forceSign * 1.7;
      }
    } else {
      // Additional defenders: role-aware lane coverage and second-ball spacing.
      const laneSignBase = ((rank % 2 === 0) ? 1 : -1) * forceSign;
      const laneSign = prefersWide ? roleSideBias : laneSignBase;
      cover.x += -attackSign * (3.2 + Math.min(rank, 4) * 0.35 + (prefersCentral ? 0.4 : 0));
      if (prefersCentral) {
        cover.z = THREE.MathUtils.lerp(cover.z + laneSign * 1.0, 0, 0.62);
      } else if (prefersWide) {
        cover.z += laneSign * (2.8 + Math.min(rank, 4) * 0.55);
      } else {
        cover.z += laneSign * (2.2 + Math.min(rank, 4) * 0.5);
      }
    }
    const tether = new THREE.Vector3().subVectors(cover, defender.homePos);
    tether.y = 0;
    if (tether.lengthSq() > 16 * 16) {
      tether.setLength(16);
      cover.copy(defender.homePos).add(tether);
    }
    cover.x = THREE.MathUtils.clamp(cover.x, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5);
    cover.z = THREE.MathUtils.clamp(cover.z, -FIELD_D / 2 + 1.5, FIELD_D / 2 - 1.5);
    cover.y = 0.15;
    return cover;
  }

  function getGoalkeeperHomeTarget(player: any) {
    const defendsRightGoal = !teamAttacksRight(player.team);
    const x = defendsRightGoal ? FIELD_W / 2 - 3 * X_PER_YARD : -FIELD_W / 2 + 3 * X_PER_YARD;
    return new THREE.Vector3(x, 0.15, 0);
  }

  function awardSoccerGoal(scoringTeam: 'A' | 'B', fromShot: boolean = false) {
    if (scoringTeam === 'A') gameState.scoreA += 1;
    else gameState.scoreB += 1;
    if (fromShot) {
      recordShotOnTarget(scoringTeam);
    }
    sounds.touchdown();
    startSoccerRestart('KICK_OFF', scoringTeam === 'A' ? 'B' : 'A', 0, 0, 'GOAL!');
  }

  function handleSoccerOutOfPlay() {
    const goalMouthHalfWidth = goalMouthWidth / 2;
    const goalKickDepth = 6 * X_PER_YARD;
    const x = ballState.pos.x;
    const z = ballState.pos.z;

    const holder = ballState.heldBy;
    if (holder) {
      const sidelineEpsilon = 0.05;
      const endlineEpsilon = 0.05;
      const holderOutwardSideline = Math.sign(holder.pos.z || 0) === Math.sign(holder.vel.z || 0);
      const holderOutwardEndline = Math.sign(holder.pos.x || 0) === Math.sign(holder.vel.x || 0);

      if (
        Math.abs(holder.pos.z) >= FIELD_D / 2 - sidelineEpsilon &&
        Math.abs(holder.vel.z) > 0.35 &&
        holderOutwardSideline
      ) {
        const throwInTeam = holder.team === 'A' ? 'B' : 'A';
        startSoccerRestart(
          'THROW_IN',
          throwInTeam,
          THREE.MathUtils.clamp(holder.pos.x, -FIELD_W / 2 + 1, FIELD_W / 2 - 1),
          holder.pos.z > 0 ? FIELD_D / 2 : -FIELD_D / 2,
          'THROW-IN'
        );
        return true;
      }

      if (
        Math.abs(holder.pos.x) >= FIELD_W / 2 - endlineEpsilon &&
        Math.abs(holder.vel.x) > 0.35 &&
        holderOutwardEndline
      ) {
        const rightGoal = holder.pos.x > 0;
        if (Math.abs(holder.pos.z) <= goalMouthHalfWidth) {
          const scoringTeam = getTeamAttackingGoal(rightGoal);
          awardSoccerGoal(scoringTeam);
          return true;
        }

        const attackingTeam = getTeamAttackingGoal(rightGoal);
        const defendingTeam = attackingTeam === 'A' ? 'B' : 'A';
        if (holder.team === attackingTeam) {
          startSoccerRestart(
            'GOAL_KICK',
            defendingTeam,
            rightGoal ? FIELD_W / 2 - goalKickDepth : -FIELD_W / 2 + goalKickDepth,
            0,
            'GOAL KICK'
          );
        } else {
          startSoccerRestart(
            'CORNER',
            attackingTeam,
            rightGoal ? FIELD_W / 2 : -FIELD_W / 2,
            holder.pos.z >= 0 ? FIELD_D / 2 : -FIELD_D / 2,
            'CORNER'
          );
        }
        return true;
      }
    }

    if (Math.abs(z) >= FIELD_D / 2) {
      const throwInTeam = soccerRestart.lastTouchTeam === 'A' ? 'B' : 'A';
      startSoccerRestart('THROW_IN', throwInTeam, THREE.MathUtils.clamp(x, -FIELD_W / 2 + 1, FIELD_W / 2 - 1), z > 0 ? FIELD_D / 2 : -FIELD_D / 2, 'THROW-IN');
      return true;
    }

    if (Math.abs(x) > FIELD_W / 2) {
      const rightGoal = x > 0;
      if (Math.abs(z) <= goalMouthHalfWidth) {
        const scoringTeam = getTeamAttackingGoal(rightGoal);
        if (kickoffLawState.active && kickoffLawState.firstKickTaken && !kickoffLawState.touchedByAnotherPlayer) {
          const ownTeam = kickoffLawState.kickoffTeam;
          if (scoringTeam === ownTeam) {
            const opponents = ownTeam === 'A' ? 'B' : 'A';
            startSoccerRestart('CORNER', opponents, rightGoal ? FIELD_W / 2 : -FIELD_W / 2, z >= 0 ? FIELD_D / 2 : -FIELD_D / 2, 'CORNER');
            return true;
          }
        }
        awardSoccerGoal(scoringTeam, ballState.isShot);
        return true;
      }

      const attackingTeam = getTeamAttackingGoal(rightGoal);
      const defendingTeam = attackingTeam === 'A' ? 'B' : 'A';
      if (soccerRestart.lastTouchTeam === attackingTeam) {
        startSoccerRestart('GOAL_KICK', defendingTeam, rightGoal ? FIELD_W / 2 - goalKickDepth : -FIELD_W / 2 + goalKickDepth, 0, 'GOAL KICK');
      } else {
        startSoccerRestart('CORNER', attackingTeam, rightGoal ? FIELD_W / 2 : -FIELD_W / 2, z >= 0 ? FIELD_D / 2 : -FIELD_D / 2, 'CORNER');
      }
      return true;
    }

    return false;
  }

  const teamBUniformPalettes = {
    home: { label: 'Home', shirt: 0xaa0000, pants: 0xc7a74b, visor: 0x000000 },
    away: { label: 'Away', shirt: 0xf5f6f7, pants: 0xc7a74b, visor: 0x000000 },
    alternate: { label: 'Alternate', shirt: 0xff1a1a, pants: 0xc7a74b, visor: 0x000000 },
  };

  const scoreBug = document.createElement('div');
  scoreBug.style.position = 'fixed';
  scoreBug.style.top = '20px';
  scoreBug.style.left = '50%';
  scoreBug.style.transform = 'translateX(-50%)';
  scoreBug.style.display = 'flex';
  scoreBug.style.alignItems = 'stretch';
  scoreBug.style.height = '68px';
  scoreBug.style.minWidth = '560px';
  scoreBug.style.background = '#ffffff';
  scoreBug.style.backdropFilter = 'none';
  scoreBug.style.border = '1px solid rgba(255,255,255,0.08)';
  scoreBug.style.borderRadius = '6px';
  scoreBug.style.overflow = 'hidden';
  scoreBug.style.boxShadow = '0 6px 28px rgba(0,0,0,0.65)';
  scoreBug.style.zIndex = '100';
  scoreBug.style.fontFamily = '"Inter", "Helvetica Neue", sans-serif';
  container.appendChild(scoreBug);

  // Top accent stripe — split team colors, updated by updateScoreboardTheme
  const topAccent = document.createElement('div');
  topAccent.style.position = 'absolute';
  topAccent.style.top = '0';
  topAccent.style.left = '0';
  topAccent.style.width = '100%';
  topAccent.style.height = '3px';
  topAccent.style.background = 'linear-gradient(90deg, #f52b8f 50%, #aa0000 50%)';
  topAccent.style.pointerEvents = 'none';
  topAccent.style.zIndex = '2';
  scoreBug.appendChild(topAccent);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes messageFlashScroll {
      0% { transform: translate(100vw, -50%) skewX(-15deg); opacity: 0; }
      15% { transform: translate(-50%, -50%) skewX(-15deg); opacity: 1; }
      20% { transform: translate(-50%, -50%) skewX(-15deg) scale(1.2); color: #ffeb3b; text-shadow: 0 0 30px #ffeb3b; }
      25% { transform: translate(-50%, -50%) skewX(-15deg) scale(1); color: #fff; text-shadow: 0 0 20px rgba(0,0,0,0.8); }
      85% { transform: translate(-50%, -50%) skewX(-15deg); opacity: 1; }
      100% { transform: translate(-100vw, -50%) skewX(-15deg); opacity: 0; }
    }
    .game-message-anim {
      animation: messageFlashScroll 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }
  `;
  document.head.appendChild(style);

  const messageOverlay = document.createElement('div');
  messageOverlay.style.position = 'fixed';
  messageOverlay.style.top = '40%';
  messageOverlay.style.left = '50%';
  messageOverlay.style.transform = 'translate(-50%, -50%) skewX(-15deg)';
  messageOverlay.style.fontFamily = '"Inter", sans-serif';
  messageOverlay.style.fontSize = '8vw';
  messageOverlay.style.fontWeight = '900';
  messageOverlay.style.color = '#fff';
  messageOverlay.style.textTransform = 'uppercase';
  messageOverlay.style.textShadow = '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)';
  messageOverlay.style.pointerEvents = 'none';
  messageOverlay.style.zIndex = '200';
  messageOverlay.style.opacity = '0';
  messageOverlay.style.whiteSpace = 'nowrap';
  messageOverlay.style.textAlign = 'center';
  container.appendChild(messageOverlay);

  const messageReasonEl = document.createElement('div');
  messageReasonEl.style.fontSize = '2.5vw';
  messageReasonEl.style.fontWeight = '600';
  messageReasonEl.style.marginTop = '0.3em';
  messageReasonEl.style.letterSpacing = '0.08em';
  messageReasonEl.style.opacity = '0.85';
  messageOverlay.appendChild(messageReasonEl);

  const hintOverlay = document.createElement('div');
  hintOverlay.style.position = 'fixed';
  hintOverlay.style.top = '40%';
  hintOverlay.style.left = '50%';
  hintOverlay.style.transform = 'translate(-50%, -50%) skewX(-15deg)';
  hintOverlay.style.fontFamily = '"Inter", sans-serif';
  hintOverlay.style.fontSize = '4vw';
  hintOverlay.style.fontWeight = '900';
  hintOverlay.style.color = '#fff';
  hintOverlay.style.textTransform = 'uppercase';
  hintOverlay.style.textShadow = '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)';
  hintOverlay.style.pointerEvents = 'none';
  hintOverlay.style.zIndex = '200';
  hintOverlay.style.opacity = '0';
  hintOverlay.style.whiteSpace = 'nowrap';
  hintOverlay.style.textAlign = 'center';
  hintOverlay.textContent = 'PRESS SPACE TO KICK OFF';
  container.appendChild(hintOverlay);

  const controlsOverlay = document.createElement('div');
  controlsOverlay.style.position = 'fixed';
  controlsOverlay.style.left = '12px';
  controlsOverlay.style.bottom = '12px';
  controlsOverlay.style.padding = '8px 10px';
  controlsOverlay.style.background = 'rgba(0,0,0,0.62)';
  controlsOverlay.style.border = '1px solid rgba(255,255,255,0.15)';
  controlsOverlay.style.borderRadius = '6px';
  controlsOverlay.style.color = 'rgba(255,255,255,0.92)';
  controlsOverlay.style.fontFamily = 'Consolas, Monaco, monospace';
  controlsOverlay.style.fontSize = '11px';
  controlsOverlay.style.lineHeight = '1.45';
  controlsOverlay.style.zIndex = '210';
  controlsOverlay.style.pointerEvents = 'none';
  controlsOverlay.textContent = 'TEAM A: WASD MOVE  F SHOOT  G PASS  Q/E SWITCH  |  TEAM B: ARROWS MOVE  . SHOOT  , PASS  [ ] SWITCH  |  P PAUSE';
  container.appendChild(controlsOverlay);

  const fpsOverlay = document.createElement('div');
  fpsOverlay.style.position = 'fixed';
  fpsOverlay.style.right = '12px';
  fpsOverlay.style.top = '12px';
  fpsOverlay.style.display = 'flex';
  fpsOverlay.style.alignItems = 'center';
  fpsOverlay.style.gap = '6px';
  fpsOverlay.style.zIndex = '220';

  const fpsDisplay = document.createElement('button');
  fpsDisplay.type = 'button';
  fpsDisplay.style.padding = '6px 8px';
  fpsDisplay.style.background = 'rgba(0,0,0,0.62)';
  fpsDisplay.style.border = '1px solid rgba(255,255,255,0.15)';
  fpsDisplay.style.borderRadius = '6px';
  fpsDisplay.style.color = 'rgba(173,255,212,0.95)';
  fpsDisplay.style.fontFamily = 'Consolas, Monaco, monospace';
  fpsDisplay.style.fontSize = '11px';
  fpsDisplay.style.lineHeight = '1';
  fpsDisplay.style.cursor = 'pointer';
  fpsDisplay.textContent = 'FPS 60';
  fpsDisplay.title = 'Click to hide FPS';

  const fpsToggle = document.createElement('button');
  fpsToggle.type = 'button';
  fpsToggle.style.padding = '6px 8px';
  fpsToggle.style.background = 'rgba(0,0,0,0.62)';
  fpsToggle.style.border = '1px solid rgba(255,255,255,0.15)';
  fpsToggle.style.borderRadius = '6px';
  fpsToggle.style.color = 'rgba(255,255,255,0.88)';
  fpsToggle.style.fontFamily = 'Consolas, Monaco, monospace';
  fpsToggle.style.fontSize = '11px';
  fpsToggle.style.lineHeight = '1';
  fpsToggle.style.cursor = 'pointer';
  fpsToggle.textContent = 'FPS';
  fpsToggle.title = 'Toggle FPS display';

  let showFPSDisplay = true;
  fpsOverlay.appendChild(fpsDisplay);
  fpsOverlay.appendChild(fpsToggle);
  container.appendChild(fpsOverlay);

  function applyFPSVisibility() {
    fpsDisplay.style.display = showFPSDisplay ? 'inline-flex' : 'none';
    fpsToggle.textContent = showFPSDisplay ? 'FPS ON' : 'FPS OFF';
    fpsToggle.style.color = showFPSDisplay ? 'rgba(173,255,212,0.95)' : 'rgba(255,255,255,0.88)';
  }

  fpsDisplay.addEventListener('click', () => {
    showFPSDisplay = false;
    applyFPSVisibility();
  });

  fpsToggle.addEventListener('click', () => {
    showFPSDisplay = !showFPSDisplay;
    applyFPSVisibility();
  });

  applyFPSVisibility();

  const pauseToggleBtn = document.createElement('button');
  pauseToggleBtn.type = 'button';
  pauseToggleBtn.style.position = 'fixed';
  pauseToggleBtn.style.right = '12px';
  pauseToggleBtn.style.top = '80px';
  pauseToggleBtn.style.padding = '6px 8px';
  pauseToggleBtn.style.background = 'rgba(0,0,0,0.62)';
  pauseToggleBtn.style.border = '1px solid rgba(255,255,255,0.15)';
  pauseToggleBtn.style.borderRadius = '6px';
  pauseToggleBtn.style.color = 'rgba(255,234,163,0.95)';
  pauseToggleBtn.style.fontFamily = 'Consolas, Monaco, monospace';
  pauseToggleBtn.style.fontSize = '11px';
  pauseToggleBtn.style.lineHeight = '1';
  pauseToggleBtn.style.cursor = 'pointer';
  pauseToggleBtn.style.zIndex = '220';
  container.appendChild(pauseToggleBtn);

  const pauseOverlay = document.createElement('div');
  pauseOverlay.style.position = 'fixed';
  pauseOverlay.style.left = '50%';
  pauseOverlay.style.top = '58%';
  pauseOverlay.style.transform = 'translate(-50%, -50%)';
  pauseOverlay.style.padding = '8px 14px';
  pauseOverlay.style.background = 'rgba(0,0,0,0.62)';
  pauseOverlay.style.border = '1px solid rgba(255,255,255,0.24)';
  pauseOverlay.style.borderRadius = '7px';
  pauseOverlay.style.color = 'rgba(255,245,210,0.96)';
  pauseOverlay.style.fontFamily = 'Consolas, Monaco, monospace';
  pauseOverlay.style.fontSize = '13px';
  pauseOverlay.style.letterSpacing = '0.08em';
  pauseOverlay.style.textTransform = 'uppercase';
  pauseOverlay.style.pointerEvents = 'none';
  pauseOverlay.style.zIndex = '230';
  pauseOverlay.style.opacity = '0';
  pauseOverlay.style.transition = 'opacity 100ms ease';
  pauseOverlay.textContent = 'Paused';
  container.appendChild(pauseOverlay);

  let isManualPause = false;

  function applyPauseUI() {
    pauseToggleBtn.textContent = isManualPause ? 'RESUME' : 'PAUSE';
    pauseToggleBtn.style.color = isManualPause ? 'rgba(161,255,184,0.95)' : 'rgba(255,234,163,0.95)';
    pauseOverlay.style.opacity = isManualPause ? '1' : '0';
  }

  function setManualPause(nextPause: boolean) {
    isManualPause = nextPause;
    lastTime = performance.now();
    applyPauseUI();
  }

  pauseToggleBtn.addEventListener('click', () => {
    setManualPause(!isManualPause);
  });

  applyPauseUI();

  const aiStateOverlay = document.createElement('div');
  aiStateOverlay.style.position = 'fixed';
  aiStateOverlay.style.left = '12px';
  aiStateOverlay.style.top = '12px';
  aiStateOverlay.style.maxHeight = '46vh';
  aiStateOverlay.style.overflowY = 'auto';
  aiStateOverlay.style.padding = '8px 10px';
  aiStateOverlay.style.background = 'rgba(0,0,0,0.68)';
  aiStateOverlay.style.border = '1px solid rgba(255,255,255,0.18)';
  aiStateOverlay.style.borderRadius = '6px';
  aiStateOverlay.style.color = 'rgba(188,242,255,0.95)';
  aiStateOverlay.style.fontFamily = 'Consolas, Monaco, monospace';
  aiStateOverlay.style.fontSize = '10px';
  aiStateOverlay.style.lineHeight = '1.35';
  aiStateOverlay.style.whiteSpace = 'pre';
  aiStateOverlay.style.pointerEvents = 'none';
  aiStateOverlay.style.zIndex = '221';
  aiStateOverlay.textContent = '';
  container.appendChild(aiStateOverlay);

  let showAIStateOverlay = false;

  function applyAIStateOverlayVisibility() {
    aiStateOverlay.style.display = showAIStateOverlay ? 'block' : 'none';
  }

  applyAIStateOverlayVisibility();

  const playPatternOverlay = document.createElement('div');
  playPatternOverlay.style.position = 'fixed';
  playPatternOverlay.style.left = '50%';
  playPatternOverlay.style.top = '96px';
  playPatternOverlay.style.transform = 'translateX(-50%)';
  playPatternOverlay.style.padding = '6px 10px';
  playPatternOverlay.style.background = 'rgba(0,0,0,0.58)';
  playPatternOverlay.style.border = '1px solid rgba(255,255,255,0.20)';
  playPatternOverlay.style.borderRadius = '6px';
  playPatternOverlay.style.color = 'rgba(170,255,210,0.96)';
  playPatternOverlay.style.fontFamily = 'Consolas, Monaco, monospace';
  playPatternOverlay.style.fontSize = '11px';
  playPatternOverlay.style.letterSpacing = '0.06em';
  playPatternOverlay.style.textTransform = 'uppercase';
  playPatternOverlay.style.pointerEvents = 'none';
  playPatternOverlay.style.zIndex = '215';
  playPatternOverlay.style.opacity = '0';
  playPatternOverlay.style.transition = 'opacity 120ms ease';
  playPatternOverlay.textContent = '';
  container.appendChild(playPatternOverlay);

  let playPatternHideAt = 0;
  const playPatternCooldownUntil: Record<string, number> = {};

  function showPlayPatternTag(tag: string, color: string = 'rgba(170,255,210,0.96)') {
    const now = performance.now() / 1000;
    const cooldownUntil = playPatternCooldownUntil[tag] || 0;
    if (now < cooldownUntil) return;
    playPatternCooldownUntil[tag] = now + 1.6;
    playPatternHideAt = now + 1.05;
    playPatternOverlay.textContent = tag;
    playPatternOverlay.style.color = color;
    playPatternOverlay.style.opacity = '1';
  }

  // Two-canvas minimap: static pitch layer + dynamic player/ball overlay layer.
  const miniMapWidth = 322;
  const miniMapHeight = 203;

  const miniMapPitchCanvas = document.createElement('canvas');
  miniMapPitchCanvas.id = 'canvasPitch';
  miniMapPitchCanvas.width = miniMapWidth;
  miniMapPitchCanvas.height = miniMapHeight;
  miniMapPitchCanvas.style.position = 'fixed';
  miniMapPitchCanvas.style.bottom = '10px';
  miniMapPitchCanvas.style.left = '50%';
  miniMapPitchCanvas.style.transform = 'translateX(-50%)';
  miniMapPitchCanvas.style.zIndex = '20';
  miniMapPitchCanvas.style.opacity = '0.6';
  miniMapPitchCanvas.style.backgroundColor = '#009900';
  miniMapPitchCanvas.style.border = '1px solid rgba(255,255,255,0.15)';
  miniMapPitchCanvas.style.borderRadius = '6px';
  miniMapPitchCanvas.style.pointerEvents = 'none';
  container.appendChild(miniMapPitchCanvas);

  const miniMapOverlayCanvas = document.createElement('canvas');
  miniMapOverlayCanvas.id = 'canvasPitchAI';
  miniMapOverlayCanvas.width = miniMapWidth;
  miniMapOverlayCanvas.height = miniMapHeight;
  miniMapOverlayCanvas.style.position = 'fixed';
  miniMapOverlayCanvas.style.bottom = '10px';
  miniMapOverlayCanvas.style.left = '50%';
  miniMapOverlayCanvas.style.transform = 'translateX(-50%)';
  miniMapOverlayCanvas.style.zIndex = '30';
  miniMapOverlayCanvas.style.pointerEvents = 'none';
  container.appendChild(miniMapOverlayCanvas);

  const miniMapPitchCtx = miniMapPitchCanvas.getContext('2d');
  const miniMapOverlayCtx = miniMapOverlayCanvas.getContext('2d');
  let lastMiniMapDrawMs = 0;
  const MINI_MAP_DRAW_INTERVAL_MS = 1000 / 30;
  const miniMapToggleBtn = document.createElement('button');
  miniMapToggleBtn.type = 'button';
  miniMapToggleBtn.style.position = 'fixed';
  miniMapToggleBtn.style.right = '12px';
  miniMapToggleBtn.style.top = '46px';
  miniMapToggleBtn.style.padding = '6px 8px';
  miniMapToggleBtn.style.background = 'rgba(0,0,0,0.62)';
  miniMapToggleBtn.style.border = '1px solid rgba(255,255,255,0.15)';
  miniMapToggleBtn.style.borderRadius = '6px';
  miniMapToggleBtn.style.color = 'rgba(167,236,255,0.95)';
  miniMapToggleBtn.style.fontFamily = 'Consolas, Monaco, monospace';
  miniMapToggleBtn.style.fontSize = '11px';
  miniMapToggleBtn.style.lineHeight = '1';
  miniMapToggleBtn.style.cursor = 'pointer';
  miniMapToggleBtn.style.zIndex = '220';
  container.appendChild(miniMapToggleBtn);

  let showMiniMap = true;
  const miniMapBallTrail: Array<{ x: number; y: number }> = [];

  function applyMiniMapVisibility() {
    miniMapPitchCanvas.style.display = showMiniMap ? 'block' : 'none';
    miniMapOverlayCanvas.style.display = showMiniMap ? 'block' : 'none';
    miniMapToggleBtn.textContent = showMiniMap ? 'MINIMAP ON' : 'MINIMAP OFF';
    miniMapToggleBtn.style.color = showMiniMap ? 'rgba(167,236,255,0.95)' : 'rgba(255,255,255,0.88)';
  }

  miniMapToggleBtn.addEventListener('click', () => {
    showMiniMap = !showMiniMap;
    applyMiniMapVisibility();
  });

  function worldToMiniMap(x: number, z: number) {
    const mapX = ((x + FIELD_W / 2) / FIELD_W) * miniMapWidth;
    const mapY = ((z + FIELD_D / 2) / FIELD_D) * miniMapHeight;
    return { x: mapX, y: mapY };
  }

  function drawMiniMapPitch() {
    if (!miniMapPitchCtx) return;
    const ctx = miniMapPitchCtx;
    const w = miniMapWidth;
    const h = miniMapHeight;
    const pad = 8;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a8f35';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;

    // Outer lines
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(w / 2, pad);
    ctx.lineTo(w / 2, h - pad);
    ctx.stroke();

    // Center circle + spot
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();

    // Penalty boxes + goal boxes (scaled)
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

    // Penalty spots
    ctx.beginPath();
    ctx.arc(pad + penW * 0.62, h / 2, 2.2, 0, Math.PI * 2);
    ctx.arc(w - pad - penW * 0.62, h / 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMiniMapOverlay() {
    if (!miniMapOverlayCtx || !showMiniMap) return;
    const ctx = miniMapOverlayCtx;
    ctx.clearRect(0, 0, miniMapWidth, miniMapHeight);

    // Draw players
    players.forEach((p: any) => {
      const pos = worldToMiniMap(p.pos.x, p.pos.z);
      const isKeeper = isGoalkeeper(p);
      const r = isKeeper ? 4.1 : 3.2;
      const color = p.team === 'A'
        ? `#${M.teamAShirt.color.getHexString()}`
        : `#${M.teamBShirt.color.getHexString()}`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.stroke();
    });

    // Highlight current carrier for quick possession awareness.
    if (ballState.heldBy) {
      const carrierPos = worldToMiniMap(ballState.heldBy.pos.x, ballState.heldBy.pos.z);
      ctx.beginPath();
      ctx.arc(carrierPos.x, carrierPos.y, 6.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Ball
    const ball = worldToMiniMap(ballState.pos.x, ballState.pos.z);
    const lastTrail = miniMapBallTrail[miniMapBallTrail.length - 1];
    if (!lastTrail || Math.hypot(ball.x - lastTrail.x, ball.y - lastTrail.y) > 0.7) {
      miniMapBallTrail.push({ x: ball.x, y: ball.y });
      if (miniMapBallTrail.length > 18) miniMapBallTrail.shift();
    }

    for (let i = 1; i < miniMapBallTrail.length; i++) {
      const a = miniMapBallTrail[i - 1];
      const b = miniMapBallTrail[i];
      const alpha = (i / miniMapBallTrail.length) * 0.45;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawMiniMapPitch();
  applyMiniMapVisibility();

  let smoothedFPS = 60;
  let lastFPSUiUpdate = 0;
  let lastAIStateUiUpdate = 0;

  const CORNER_BUNCH_MIN_PLAYERS = 3;
  const CORNER_BUNCH_COMBINED_MIN_PLAYERS = 5;
  const CORNER_BUNCH_MIN_SECONDS = 1.5;
  const CORNER_NEAR_X_RATIO = 0.24;
  const CORNER_NEAR_Z_RATIO = 0.34;
  const cornerBunchTracker = {
    A: { timer: 0, active: false, events: 0, peak: 0, current: 0 },
    B: { timer: 0, active: false, events: 0, peak: 0, current: 0 },
    MIXED: { timer: 0, active: false, events: 0, peak: 0, current: 0 },
  };

  let lastMessage = '';


  let isPlaybookVisible = false;
  const playbookBar = document.createElement('div');
  playbookBar.style.position = 'fixed';
  playbookBar.style.top = '10px';
  playbookBar.style.left = '50%';
  playbookBar.style.transform = 'translateX(-50%)';
  playbookBar.style.width = 'min(1200px, calc(100vw - 20px))';
  playbookBar.style.display = 'none';
  playbookBar.style.flexDirection = 'column';
  playbookBar.style.gap = '10px';
  playbookBar.style.padding = '10px';
  playbookBar.style.zIndex = '30';
  container.appendChild(playbookBar);

  const playbookHint = document.createElement('div');
  playbookHint.style.position = 'fixed';
  playbookHint.style.top = '20px';
  playbookHint.style.left = '50%';
  playbookHint.style.transform = 'translateX(-50%)';
  playbookHint.style.background = 'rgba(0, 0, 0, 0.4)';
  playbookHint.style.backdropFilter = 'blur(4px)';
  playbookHint.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  playbookHint.style.padding = '6px 12px';
  playbookHint.style.borderRadius = '4px';
  playbookHint.style.color = 'rgba(255, 255, 255, 0.4)';
  playbookHint.style.fontFamily = '"Inter", sans-serif';
  playbookHint.style.fontSize = '9px';
  playbookHint.style.textTransform = 'uppercase';
  playbookHint.style.letterSpacing = '0.1em';
  playbookHint.style.pointerEvents = 'none';
  playbookHint.style.zIndex = '20';
  playbookHint.style.display = 'none';
  playbookHint.textContent = 'Press [P] for Playbook';
  container.appendChild(playbookHint);

  function createTeamSection(logoPath: string, teamName: string, _color: string, isLeft: boolean) {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    section.style.flex = '1';
    section.style.gap = '12px';
    section.style.padding = isLeft ? '0 0 0 16px' : '0 16px 0 0';
    section.style.overflow = 'hidden';
    if (!isLeft) section.style.flexDirection = 'row-reverse';

    const logo = document.createElement('img');
    logo.src = logoPath;
    logo.referrerPolicy = 'no-referrer';
    logo.style.height = '40px';
    logo.style.width = '40px';
    logo.style.objectFit = 'contain';
    logo.style.flexShrink = '0';

    const name = document.createElement('div');
    name.textContent = teamName;
    name.style.color = '#000000';
    name.style.fontSize = '12px';
    name.style.fontWeight = '800';
    name.style.textTransform = 'uppercase';
    name.style.letterSpacing = '0.04em';
    name.style.flex = '1';
    name.style.textAlign = 'center';
    name.style.whiteSpace = 'normal';
    name.style.wordBreak = 'break-word';
    name.style.lineHeight = '1.05';
    name.style.maxHeight = '2.2em';
    name.style.overflow = 'hidden';

    const score = document.createElement('div');
    score.style.width = '60px';
    score.style.height = '100%';
    score.style.display = 'flex';
    score.style.alignItems = 'center';
    score.style.justifyContent = 'center';
    score.style.fontSize = '34px';
    score.style.fontWeight = '900';
    score.style.color = 'white';
    score.style.background = 'rgba(255,255,255,0.10)';
    score.style.flexShrink = '0';
    score.style.fontVariantNumeric = 'tabular-nums';
    score.textContent = '0';

    section.appendChild(logo);
    section.appendChild(name);
    section.appendChild(score);

    return { section, score, name, logo };
  }

  const activeTeams = {
    A: { scoreName: 'INTER MIAMI', rosterName: 'Inter Miami' },
    B: { scoreName: 'LA GALAXY', rosterName: 'LA Galaxy' },
  };

  const teamA = createTeamSection('/assets/miami-helmet-logo.png', activeTeams.A.scoreName, '#f52b8f', true);
  const teamB = createTeamSection('/assets/sf-helmet-logo.png', activeTeams.B.scoreName, '#aa0000', false);

  function updateScoreboardTeamNames() {
    teamA.name.textContent = activeTeams.A.scoreName;
    teamB.name.textContent = activeTeams.B.scoreName;
  }

  function updateStadiumBanners() {
    const colorA = '#' + M.teamAShirt.color.getHexString();
    const colorB = '#' + M.teamBShirt.color.getHexString();
    // Long wall mapping: left = visiting team (B), middle = league, right = home team (A)
    for (const t of teamABannerMeshes) {
      (t as any).tickerSource = `${activeTeams.A.scoreName} • `;
      (t as any).tickerLoop = (t as any).tickerSource.repeat(10);
      t.color = colorA;
      t.sync();
    }
    for (const t of teamBBannerMeshes) {
      (t as any).tickerSource = `${activeTeams.B.scoreName} • `;
      (t as any).tickerLoop = (t as any).tickerSource.repeat(10);
      t.color = colorB;
      t.sync();
    }
  }

  function createTeamLineupNamer(teamId: 'A' | 'B') {
    const roleCounts: Record<string, number> = {};
    return (displayRole: string) => {
      roleCounts[displayRole] = (roleCounts[displayRole] || 0) + 1;
      const index = roleCounts[displayRole];
      const suffix = index > 1 ? ` ${index}` : '';
      return `${activeTeams[teamId].rosterName} ${displayRole}${suffix}`;
    };
  }

  const ROLE_POSITION_PREFERENCES: Record<string, string[]> = {
    GK: ['GK'],
    LB: ['LB', 'LWB', 'CB'],
    RB: ['RB', 'RWB', 'CB'],
    CB: ['CB', 'LB', 'RB'],
    DM: ['CDM', 'CM', 'CB'],
    CM: ['CM', 'CDM', 'CAM'],
    LM: ['LM', 'LW', 'CAM'],
    RM: ['RM', 'RW', 'CAM'],
    ST: ['ST', 'CF', 'CAM'],
  };

  function normalizeRosterTeamName(value: string) {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function getRatingsPoolForTeam(teamId: 'A' | 'B') {
    const rosterKey = normalizeRosterTeamName(activeTeams[teamId].rosterName);
    const exact = MLS_PLAYER_RATINGS.filter((p) => normalizeRosterTeamName(p.team).includes(rosterKey) || rosterKey.includes(normalizeRosterTeamName(p.team)));
    if (exact.length > 0) return exact;
    return MLS_PLAYER_RATINGS;
  }

  function scaleEAStat(value: number, min: number, max: number) {
    return THREE.MathUtils.clamp(min + (THREE.MathUtils.clamp(value, 1, 99) / 99) * (max - min), min, max);
  }

  function getTeamRoleMultipliers(teamId: 'A' | 'B', isKeeper: boolean) {
    const teamMods = getMLS2025TeamModifiers(activeTeams[teamId].rosterName);
    const overallMult = teamMods ? 1 + teamMods.overallCentered * 0.06 : 1;
    const attackMult = teamMods ? 1 + (0.65 * teamMods.attackCentered + 0.35 * teamMods.overallCentered) * 0.06 : 1;
    const defenseMult = teamMods ? 1 + (0.65 * teamMods.defenseCentered + 0.35 * teamMods.overallCentered) * 0.06 : 1;
    const keeperMult = teamMods ? 1 + (0.75 * teamMods.defenseCentered + 0.25 * teamMods.overallCentered) * 0.06 : 1;
    return { teamMods, overallMult, attackMult, defenseMult, keeperMult, appliedRoleMult: isKeeper ? keeperMult : attackMult };
  }

  function buildPlayerStatsFromMLS(player: MLSPlayerRating, displayRole: string, teamId: 'A' | 'B') {
    const isKeeper = displayRole === 'GK' || player.pos === 'GK';
    const baseDef = (player.def + player.defensiveAwareness + player.standingTackle) / 3;
    const basePass = (player.pas + player.shortPassing + player.longPassing) / 3;
    const carryBase = (player.dri + player.phy) / 2;
    const { overallMult, attackMult, defenseMult, keeperMult } = getTeamRoleMultipliers(teamId, isKeeper);

    const tuned = (value: number, min: number, max: number, mult: number) => THREE.MathUtils.clamp(value * mult, min, max);

    return {
      speed: tuned(scaleEAStat(isKeeper ? player.gkReflexes : player.pac, 0.1, 0.27), 0.1, 0.27, isKeeper ? keeperMult : attackMult),
      acceleration: tuned(scaleEAStat(isKeeper ? player.gkReflexes : player.acceleration, 0.45, 1.15), 0.45, 1.15, isKeeper ? keeperMult : attackMult),
      agility: tuned(scaleEAStat(isKeeper ? player.gkReflexes : player.agility, 0.55, 1.25), 0.55, 1.25, isKeeper ? keeperMult : attackMult),
      strength: tuned(scaleEAStat(player.strength, 0.25, 0.95), 0.25, 0.95, overallMult),
      jumping: tuned(scaleEAStat(player.phy, 0.25, 0.9), 0.25, 0.9, overallMult),
      stamina: tuned(scaleEAStat(player.stamina, 0.45, 1.0), 0.45, 1.0, overallMult),
      catching: tuned(scaleEAStat(isKeeper ? player.gkHandling : player.dri, 0.35, 0.95), 0.35, 0.95, isKeeper ? keeperMult : attackMult),
      routeRunning: tuned(scaleEAStat(basePass, 0.3, 0.95), 0.3, 0.95, attackMult),
      blocking: tuned(scaleEAStat(player.phy, 0.2, 0.85), 0.2, 0.85, defenseMult),
      carrying: tuned(scaleEAStat(carryBase, 0.35, 0.92), 0.35, 0.92, attackMult),
      throwPower: tuned(scaleEAStat(isKeeper ? player.gkKicking : player.longPassing, 0.2, 0.9), 0.2, 0.9, isKeeper ? keeperMult : attackMult),
      accuracy: tuned(scaleEAStat(basePass, 0.2, 0.9), 0.2, 0.9, attackMult),
      tackle: tuned(scaleEAStat(baseDef, 0.25, 0.9), 0.25, 0.9, defenseMult),
      breakTackle: tuned(scaleEAStat(carryBase, 0.2, 0.85), 0.2, 0.85, attackMult),
      coverage: tuned(scaleEAStat(baseDef, 0.25, 0.92), 0.25, 0.92, defenseMult),
      blockShedding: tuned(scaleEAStat((player.def + player.phy) / 2, 0.2, 0.88), 0.2, 0.88, defenseMult),
      awareness: tuned(scaleEAStat(player.reactions, 0.35, 0.95), 0.35, 0.95, overallMult),
    };
  }

  function pickMLSPlayerForRole(teamId: 'A' | 'B', displayRole: string, usedIds: Set<number>) {
    const pool = getRatingsPoolForTeam(teamId);
    const preferred = ROLE_POSITION_PREFERENCES[displayRole] || [displayRole];

    const positionMatches = (p: MLSPlayerRating) => {
      const posBag = [p.pos, ...(p.altPos || [])];
      return preferred.some((wanted) => posBag.includes(wanted));
    };

    const candidates = pool
      .filter((p) => !usedIds.has(p.id))
      .filter(positionMatches)
      .sort((a, b) => b.overall - a.overall);

    if (candidates.length > 0) {
      const chosen = candidates[0];
      usedIds.add(chosen.id);
      return chosen;
    }

    const fallback = pool
      .filter((p) => !usedIds.has(p.id))
      .sort((a, b) => b.overall - a.overall)[0] || null;

    if (fallback) usedIds.add(fallback.id);
    return fallback;
  }

  const centerInfo = document.createElement('div');
  centerInfo.style.display = 'flex';
  centerInfo.style.flexDirection = 'column';
  centerInfo.style.alignItems = 'center';
  centerInfo.style.justifyContent = 'center';
  centerInfo.style.width = '128px';
  centerInfo.style.flexShrink = '0';
  centerInfo.style.gap = '3px';
  centerInfo.style.padding = '0 10px';
  centerInfo.style.borderLeft = '1px solid rgba(255,255,255,0.08)';
  centerInfo.style.borderRight = '1px solid rgba(255,255,255,0.08)';

  const timerDisplay = document.createElement('div');
  timerDisplay.style.color = '#000000';
  timerDisplay.style.fontSize = '26px';
  timerDisplay.style.fontWeight = '700';
  timerDisplay.style.fontFamily = '"Roboto Mono", "Courier New", monospace';
  timerDisplay.style.letterSpacing = '0.04em';
  timerDisplay.style.lineHeight = '1';
  timerDisplay.textContent = '00:00';

  const qtrDisplay = document.createElement('div');
  qtrDisplay.style.color = 'rgba(0,0,0,0.72)';
  qtrDisplay.style.fontSize = '10px';
  qtrDisplay.style.fontWeight = '600';
  qtrDisplay.style.textTransform = 'uppercase';
  qtrDisplay.style.letterSpacing = '0.12em';
  qtrDisplay.style.lineHeight = '1';
  qtrDisplay.textContent = '1ST HALF';

  const testClockBadge = document.createElement('div');
  testClockBadge.textContent = 'TEST CLOCK';
  testClockBadge.style.display = 'none';
  testClockBadge.style.fontSize = '8px';
  testClockBadge.style.fontWeight = '800';
  testClockBadge.style.letterSpacing = '0.14em';
  testClockBadge.style.textTransform = 'uppercase';
  testClockBadge.style.color = '#111';
  testClockBadge.style.background = '#fbbf24';
  testClockBadge.style.borderRadius = '3px';
  testClockBadge.style.padding = '1px 5px';
  testClockBadge.style.lineHeight = '1.4';

  const downDistanceDisplay = document.createElement('div');
  downDistanceDisplay.style.display = 'none';
  downDistanceDisplay.textContent = '';

  centerInfo.appendChild(timerDisplay);
  centerInfo.appendChild(qtrDisplay);
  centerInfo.appendChild(testClockBadge);
  centerInfo.appendChild(downDistanceDisplay);

  scoreBug.appendChild(teamA.section);
  scoreBug.appendChild(centerInfo);
  scoreBug.appendChild(teamB.section);

  updateScoreboardTeamNames();
  updateScoreboardTheme();

  const REGULAR_HALF_DURATION_SECONDS = 45 * 60;
  const TESTING_HALF_DURATION_SECONDS = 5 * 60;
  const REGULAR_STOPPAGE_SECONDS = 60;
  const HALFTIME_BREAK_SECONDS = 3;
  let testingClockMode = false;

  function getHalfDurationSeconds() {
    return testingClockMode ? TESTING_HALF_DURATION_SECONDS : REGULAR_HALF_DURATION_SECONDS;
  }

  function getStoppageSeconds() {
    // Testing mode uses exact half lengths.
    return testingClockMode ? 0 : REGULAR_STOPPAGE_SECONDS;
  }

  const matchClock = {
    phase: 'FIRST_HALF' as 'FIRST_HALF' | 'HALFTIME' | 'SECOND_HALF' | 'FULL_TIME',
    half: 1 as 1 | 2,
    elapsedInHalf: 0,
    halftimeBreakRemaining: 0,
  };

  function formatTimer(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    testClockBadge.style.display = testingClockMode ? 'inline-block' : 'none';
    const halfDuration = getHalfDurationSeconds();
    const stoppage = getStoppageSeconds();

    if (matchClock.phase === 'FULL_TIME') {
      timerDisplay.textContent = formatTimer(halfDuration * 2);
      qtrDisplay.textContent = 'FULL TIME';
      return;
    }

    if (matchClock.phase === 'HALFTIME') {
      timerDisplay.textContent = formatTimer(halfDuration);
      qtrDisplay.textContent = 'HALFTIME';
      return;
    }

    const elapsed = Math.min(matchClock.elapsedInHalf, halfDuration + stoppage);
    const totalElapsed = (matchClock.half === 1 ? 0 : halfDuration) + elapsed;
    timerDisplay.textContent = formatTimer(Math.floor(totalElapsed));
    const inStoppage = stoppage > 0 && matchClock.elapsedInHalf >= halfDuration;
    qtrDisplay.textContent = matchClock.half === 1
      ? (inStoppage ? '1ST HALF STOPPAGE' : '1ST HALF')
      : (inStoppage ? '2ND HALF STOPPAGE' : '2ND HALF');
  }

  updateTimerDisplay();


  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Neutral sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 100, 300);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 350);
  const orbitCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const orbitRenderTarget = new THREE.WebGLRenderTarget(256, 256);
  const broadcastCameraPosition = new THREE.Vector3(0, 46, 42);
  const broadcastCameraTarget = new THREE.Vector3(0, 0, 0);
  const closeupCameraPosition = new THREE.Vector3();
  const closeupCameraTarget = new THREE.Vector3();
  const cameraLerpPosition = new THREE.Vector3();
  const cameraModeState = { mode: 'broadcast' };
  camera.position.copy(broadcastCameraPosition);
  camera.lookAt(broadcastCameraTarget);

  const amb = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(amb);
  const skyBounce = new THREE.HemisphereLight(0xcae1ff, 0x3c5f35, 0.6);
  scene.add(skyBounce);
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-32, 40, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.radius = 1;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
  rimLight.position.set(26, 11, -18);
  scene.add(rimLight);
  const sidelineFill = new THREE.DirectionalLight(0xffffff, 0.2);
  sidelineFill.position.set(-6, 8, 28);
  scene.add(sidelineFill);
  const turfBounce = new THREE.DirectionalLight(0x9ac27d, 0.1);
  turfBounce.position.set(0, -8, 0);
  scene.add(turfBounce);

  const lightingPresets: any = {
    noon: { 
      label: 'High Noon', 
      background: 0x87ceeb, 
      fogColor: 0x87ceeb, 
      fogNear: 100, 
      fogFar: 250, 
      exposure: 1.1, 
      ambientColor: 0xffffff, 
      ambientIntensity: 0.4, 
      hemiSkyColor: 0xffffff, 
      hemiGroundColor: 0x444444, 
      hemiIntensity: 0.6, 
      sunColor: 0xfffaf0, 
      sunIntensity: 2.0, 
      sunPosition: [10, 50, 10], 
      rimColor: 0xffffff, 
      rimIntensity: 0.5, 
      rimPosition: [-20, 20, -20], 
      fillColor: 0xffffff, 
      fillIntensity: 0.3, 
      fillPosition: [0, 10, 30], 
      turfColor: 0xffffff, 
      turfIntensity: 0.1 
    },
    'late-afternoon': { 
      label: 'Golden Hour', 
      background: 0xffa07a, 
      fogColor: 0xffa07a, 
      fogNear: 50, 
      fogFar: 180, 
      exposure: 1.05, 
      ambientColor: 0xffd700, 
      ambientIntensity: 0.3, 
      hemiSkyColor: 0xffa500, 
      hemiGroundColor: 0x222222, 
      hemiIntensity: 0.5, 
      sunColor: 0xff8c00, 
      sunIntensity: 2.5, 
      sunPosition: [-40, 15, 5], 
      rimColor: 0xffd700, 
      rimIntensity: 0.8, 
      rimPosition: [30, 10, -20], 
      fillColor: 0xffa07a, 
      fillIntensity: 0.4, 
      fillPosition: [-10, 5, 20], 
      turfColor: 0xffa500, 
      turfIntensity: 0.2 
    },
    night: { 
      label: 'Stadium Lights', 
      background: 0x050510, 
      fogColor: 0x050510, 
      fogNear: 40, 
      fogFar: 130, 
      exposure: 1.0, 
      ambientColor: 0x111122, 
      ambientIntensity: 0.2, 
      hemiSkyColor: 0x222244, 
      hemiGroundColor: 0x000000, 
      hemiIntensity: 0.4, 
      sunColor: 0xccccff, 
      sunIntensity: 3.0, 
      sunPosition: [0, 40, 0], 
      rimColor: 0xaaaaff, 
      rimIntensity: 1.2, 
      rimPosition: [-30, 20, -30], 
      fillColor: 0x8888ff, 
      fillIntensity: 0.6, 
      fillPosition: [30, 20, 30], 
      turfColor: 0x4444ff, 
      turfIntensity: 0.3 
    },
  };

  function applyLightingPreset(presetKey: string) {
    const preset = lightingPresets[presetKey] || lightingPresets['late-afternoon'];
    renderer.toneMappingExposure = preset.exposure;
    scene.background = new THREE.Color(preset.background);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.setHex(preset.fogColor);
      scene.fog.near = preset.fogNear;
      scene.fog.far = preset.fogFar;
    }
    skyBounce.color.setHex(preset.hemiSkyColor);
    skyBounce.groundColor.setHex(preset.hemiGroundColor);
    skyBounce.intensity = preset.hemiIntensity;
    sun.color.setHex(preset.sunColor);
    sun.intensity = preset.sunIntensity;
    sun.position.set(preset.sunPosition[0], preset.sunPosition[1], preset.sunPosition[2]);
    rimLight.color.setHex(preset.rimColor);
    rimLight.intensity = preset.rimIntensity;
    rimLight.position.set(preset.rimPosition[0], preset.rimPosition[1], preset.rimPosition[2]);
    sidelineFill.color.setHex(preset.fillColor);
    sidelineFill.intensity = preset.fillIntensity;
    sidelineFill.position.set(preset.fillPosition[0], preset.fillPosition[1], preset.fillPosition[2]);
    turfBounce.color.setHex(preset.turfColor);
    turfBounce.intensity = preset.turfIntensity;
  }

  let teamARosterPlayers: any[] = [];
  let teamBRosterPlayers: any[] = [];

  function setVoxelMaterialColor(materials: any[], baseHex: number) {
    const base = new THREE.Color(baseHex);
    const shades = [
      base.clone().offsetHSL(0, 0, -0.1),
      base.clone().offsetHSL(0, 0, -0.18),
      base.clone().offsetHSL(0, 0, 0.08),
      base.clone().offsetHSL(0, 0, -0.24),
      base.clone().offsetHSL(0, 0, 0.03),
      base.clone().offsetHSL(0, 0, -0.14),
    ];
    for (let i = 0; i < Math.min(materials.length, shades.length); i += 1) {
      materials[i].color.copy(shades[i]);
    }
  }

  function recolorPlayerUniform(player: any, palette: any) {
    const allFrames = [...player.runFrames, ...player.idleFrames];
    for (const frame of allFrames) {
      for (const pixel of frame.group.children) {
        const part = pixel.userData.uniformPart || 'shirt';
        const hex = part === 'visor' ? palette.visor.color.getHex() : part === 'helmet' ? palette.helmet.color.getHex() : part === 'pants' ? palette.pants.color.getHex() : palette.shirt.color.getHex();
        if (Array.isArray(pixel.material)) {
          setVoxelMaterialColor(pixel.material, hex);
        } else if (pixel.material.color) {
          pixel.material.color.setHex(hex);
        }
      }
    }
  }

  function getColorDistance(a: THREE.Color, b: THREE.Color) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function ensureDistinctKits() {
    const shirtGap = getColorDistance(M.teamAShirt.color, M.teamBShirt.color);
    const pantsGap = getColorDistance(M.teamAPants.color, M.teamBPants.color);
    const strongClash = shirtGap < 0.2;
    const combinedClash = shirtGap < 0.3 && pantsGap < 0.2;
    if (!strongClash && !combinedClash) return;

    const awayCandidates = [
      new THREE.Color(0xf5f6f7),
      new THREE.Color(0x101522),
      new THREE.Color(0xffd24d),
    ];
    let best = awayCandidates[0];
    let bestScore = -Infinity;
    awayCandidates.forEach((candidate) => {
      const score = getColorDistance(M.teamAShirt.color, candidate) + getColorDistance(M.teamAPants.color, candidate) * 0.45;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    });
    M.teamBShirt.color.copy(best);
    if (getColorDistance(M.teamAPants.color, M.teamBPants.color) < 0.22) {
      M.teamBPants.color.offsetHSL(0, 0, -0.16);
    }
  }

  function applyTeamAUniformVariant(variantKey: string) {
    const variant = (teamAUniformPalettes as any)[variantKey] || teamAUniformPalettes.home;
    M.teamAShirt.color.setHex(variant.shirt);
    M.teamAPants.color.setHex(variant.pants);
    M.teamAVisor.color.setHex(variant.visor);
    ensureDistinctKits();
    for (const player of teamARosterPlayers) {
      recolorPlayerUniform(player, getPaletteForPlayer(player, TEAM_PALETTES.teamA));
    }
    refreshFrameInspector();
  }

  function applyTeamBUniformVariant(variantKey: string) {
    const variant = (teamBUniformPalettes as any)[variantKey] || teamBUniformPalettes.home;
    M.teamBShirt.color.setHex(variant.shirt);
    M.teamBPants.color.setHex(variant.pants);
    M.teamBVisor.color.setHex(variant.visor);
    ensureDistinctKits();
    for (const player of teamBRosterPlayers) {
      recolorPlayerUniform(player, getPaletteForPlayer(player, TEAM_PALETTES.teamB));
    }
    refreshFrameInspector();
  }

  function setCameraMode(modeKey: string) {
    cameraModeState.mode = modeKey === 'closeup' ? 'closeup' : 'broadcast';
  }

  const LIGHTING_PRESETS = {
    NOON: { sun: 1.5, amb: 0.54, sky: 0x77a9d9 },
    LATE: { sun: 1.7, amb: 0.42, sky: 0x6d7f5a },
    NIGHT: { sun: 1.95, amb: 0.23, sky: 0x0c1224 },
  };

  type WeatherKey = 'SUNNY' | 'RAINY' | 'SNOW' | 'WINDY';
  const WEATHER_PRESETS: Record<WeatherKey, {
    windBase: number;
    windGust: number;
    airDragMul: number;
    rollDampMul: number;
    passSpeedMul: number;
    shotSpeedMul: number;
    kickSpeedMul: number;
    precip: 'none' | 'rain' | 'snow';
    fogNear: number;
    fogFar: number;
    skyTint: number;
    ambientMul: number;
    sunMul: number;
  }> = {
    SUNNY: {
      windBase: 0.25,
      windGust: 0.15,
      airDragMul: 1.0,
      rollDampMul: 1.0,
      passSpeedMul: 1.0,
      shotSpeedMul: 1.0,
      kickSpeedMul: 1.0,
      precip: 'none',
      fogNear: 100,
      fogFar: 260,
      skyTint: 0x9fc5e8,
      ambientMul: 1.0,
      sunMul: 1.0,
    },
    RAINY: {
      windBase: 1.05,
      windGust: 0.65,
      airDragMul: 1.12,
      rollDampMul: 0.9,
      passSpeedMul: 0.97,
      shotSpeedMul: 0.98,
      kickSpeedMul: 0.97,
      precip: 'rain',
      fogNear: 70,
      fogFar: 190,
      skyTint: 0x63748a,
      ambientMul: 0.9,
      sunMul: 0.76,
    },
    SNOW: {
      windBase: 0.6,
      windGust: 0.5,
      airDragMul: 1.18,
      rollDampMul: 1.25,
      passSpeedMul: 0.93,
      shotSpeedMul: 0.94,
      kickSpeedMul: 0.92,
      precip: 'snow',
      fogNear: 55,
      fogFar: 170,
      skyTint: 0xcad6e8,
      ambientMul: 1.08,
      sunMul: 0.82,
    },
    WINDY: {
      windBase: 2.2,
      windGust: 1.35,
      airDragMul: 1.05,
      rollDampMul: 0.95,
      passSpeedMul: 0.99,
      shotSpeedMul: 1.01,
      kickSpeedMul: 1.0,
      precip: 'none',
      fogNear: 90,
      fogFar: 230,
      skyTint: 0x7ca0c7,
      ambientMul: 0.96,
      sunMul: 0.92,
    },
  };
  let activeLightingPreset: keyof typeof LIGHTING_PRESETS = 'NOON';
  let activeWeather: WeatherKey = 'SUNNY';
  const weatherWind = new THREE.Vector3();
  const weatherBaseWindDir = new THREE.Vector3(0.96, 0, 0.28).normalize();
  const weatherGustPhase = Math.random() * Math.PI * 2;

  const WEATHER_PARTICLE_COUNT = 900;
  const rainPositions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const snowPositions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const rainDrift = new Float32Array(WEATHER_PARTICLE_COUNT);
  const snowDrift = new Float32Array(WEATHER_PARTICLE_COUNT);

  function seedWeatherPositions(positions: Float32Array, drift: Float32Array, yMax: number) {
    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i += 1) {
      const j = i * 3;
      positions[j] = (Math.random() - 0.5) * 150;
      positions[j + 1] = Math.random() * yMax;
      positions[j + 2] = (Math.random() - 0.5) * 95;
      drift[i] = (Math.random() - 0.5) * 1.2;
    }
  }

  seedWeatherPositions(rainPositions, rainDrift, 34);
  seedWeatherPositions(snowPositions, snowDrift, 34);

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0x9db9d8,
    size: 0.12,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = false;
  scene.add(rainPoints);

  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snowMat = new THREE.PointsMaterial({
    color: 0xf5f9ff,
    size: 0.18,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.visible = false;
  scene.add(snowPoints);

  function getActiveWeatherPreset() {
    return WEATHER_PRESETS[activeWeather];
  }

  function applyWeatherAtmosphere() {
    const lighting = LIGHTING_PRESETS[activeLightingPreset] || LIGHTING_PRESETS.NOON;
    const weather = WEATHER_PRESETS[activeWeather] || WEATHER_PRESETS.SUNNY;
    const baseSky = new THREE.Color(lighting.sky);
    const tintSky = new THREE.Color(weather.skyTint);
    const mixedSky = baseSky.clone().lerp(tintSky, 0.42);

    sun.intensity = lighting.sun * weather.sunMul;
    amb.intensity = lighting.amb * weather.ambientMul;
    scene.background = mixedSky;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(mixedSky);
      scene.fog.near = weather.fogNear;
      scene.fog.far = weather.fogFar;
    }
    rainPoints.visible = weather.precip === 'rain';
    snowPoints.visible = weather.precip === 'snow';
  }

  function updateWeatherEffects(dt: number, elapsed: number) {
    const weather = WEATHER_PRESETS[activeWeather] || WEATHER_PRESETS.SUNNY;
    const gust = 0.85 + Math.sin(elapsed * 0.75 + weatherGustPhase) * 0.15 + Math.sin(elapsed * 2.1) * 0.08;
    const windSpeed = weather.windBase + weather.windGust * gust;
    weatherWind.copy(weatherBaseWindDir).multiplyScalar(windSpeed);

    if (rainPoints.visible) {
      for (let i = 0; i < WEATHER_PARTICLE_COUNT; i += 1) {
        const j = i * 3;
        rainPositions[j] += (weatherWind.x * 0.85 + rainDrift[i] * 0.45) * dt;
        rainPositions[j + 1] -= (20 + weather.windBase * 4) * dt;
        rainPositions[j + 2] += (weatherWind.z * 0.85 + rainDrift[i] * 0.25) * dt;

        if (rainPositions[j + 1] < 0) {
          rainPositions[j] = (Math.random() - 0.5) * 150;
          rainPositions[j + 1] = 30 + Math.random() * 6;
          rainPositions[j + 2] = (Math.random() - 0.5) * 95;
        }
      }
      (rainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    if (snowPoints.visible) {
      for (let i = 0; i < WEATHER_PARTICLE_COUNT; i += 1) {
        const j = i * 3;
        const sideWobble = Math.sin(elapsed * 1.2 + i * 0.03) * 0.35;
        snowPositions[j] += (weatherWind.x * 0.55 + sideWobble + snowDrift[i] * 0.3) * dt;
        snowPositions[j + 1] -= (5.6 + weather.windBase * 1.7) * dt;
        snowPositions[j + 2] += (weatherWind.z * 0.55 + snowDrift[i] * 0.35) * dt;

        if (snowPositions[j + 1] < 0) {
          snowPositions[j] = (Math.random() - 0.5) * 150;
          snowPositions[j + 1] = 30 + Math.random() * 7;
          snowPositions[j + 2] = (Math.random() - 0.5) * 95;
        }
      }
      (snowGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  // --- Ball Texture ---
  const ballCanvas = document.createElement('canvas');
  ballCanvas.width = 512;
  ballCanvas.height = 512;
  const ballCtx = ballCanvas.getContext('2d')!;
  const ballSize = ballCanvas.width;
  ballCtx.fillStyle = '#fcfcfa';
  ballCtx.fillRect(0, 0, ballSize, ballSize);
  ballCtx.strokeStyle = '#0b0b0b';
  ballCtx.lineWidth = 8;
  ballCtx.lineJoin = 'round';

  for (let i = 0; i < 1400; i += 1) {
    const x = Math.random() * ballSize;
    const y = Math.random() * ballSize;
    const s = 0.8 + Math.random() * 1.8;
    ballCtx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.012)' : 'rgba(255,255,255,0.012)';
    ballCtx.fillRect(x, y, s, s);
  }

  const drawPentagon = (x: number, y: number, radius: number, fillStyle = '#090909') => {
    ballCtx.fillStyle = fillStyle;
    ballCtx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ballCtx.moveTo(px, py);
      else ballCtx.lineTo(px, py);
    }
    ballCtx.closePath();
    ballCtx.fill();
    ballCtx.stroke();
  };

  const c = ballSize / 2;
  drawPentagon(c, c, 68);
  drawPentagon(c, c - 138, 44);
  drawPentagon(c - 126, c - 42, 44);
  drawPentagon(c + 126, c - 42, 44);
  drawPentagon(c - 78, c + 130, 44);
  drawPentagon(c + 78, c + 130, 44);

  // Extra edge pentagons improve UV wrap continuity.
  drawPentagon(20, c, 36);
  drawPentagon(ballSize - 20, c, 36);

  ballCtx.lineWidth = 7.5;
  ballCtx.strokeStyle = '#101010';
  ballCtx.beginPath();
  ballCtx.moveTo(c, c - 74);
  ballCtx.lineTo(c - 90, c - 12);
  ballCtx.lineTo(c - 108, c + 86);
  ballCtx.moveTo(c, c - 74);
  ballCtx.lineTo(c + 90, c - 12);
  ballCtx.lineTo(c + 108, c + 86);
  ballCtx.moveTo(c - 60, c + 44);
  ballCtx.lineTo(c + 60, c + 44);
  ballCtx.moveTo(c - 108, c + 86);
  ballCtx.lineTo(c - 78, c + 132);
  ballCtx.moveTo(c + 108, c + 86);
  ballCtx.lineTo(c + 78, c + 132);
  ballCtx.moveTo(c - 78, c + 132);
  ballCtx.lineTo(c, c + 170);
  ballCtx.lineTo(c + 78, c + 132);
  ballCtx.stroke();
  ballCtx.lineWidth = 2.8;
  ballCtx.strokeStyle = 'rgba(255,255,255,0.22)';
  ballCtx.stroke();

  // Add tiny stitch dots around seams so seams read better at gameplay distance.
  ballCtx.fillStyle = 'rgba(25,25,25,0.45)';
  for (let i = 0; i < 42; i += 1) {
    const t = i / 41;
    const sx = THREE.MathUtils.lerp(c - 95, c + 95, t);
    const sy = c - 22 + Math.sin(t * Math.PI) * 5;
    ballCtx.beginPath();
    ballCtx.arc(sx, sy, 1.2, 0, Math.PI * 2);
    ballCtx.fill();
  }

  // Gentle top-light highlight for a leather-like look.
  const topLight = ballCtx.createRadialGradient(c * 0.9, c * 0.72, 12, c * 0.95, c * 0.85, c * 0.9);
  topLight.addColorStop(0, 'rgba(255,255,255,0.16)');
  topLight.addColorStop(1, 'rgba(255,255,255,0)');
  ballCtx.fillStyle = topLight;
  ballCtx.fillRect(0, 0, ballSize, ballSize);

  // Subtle edge darkening to keep the ball from looking flat at distance.
  const vignette = ballCtx.createRadialGradient(c, c, c * 0.45, c, c, c * 0.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.24)');
  ballCtx.fillStyle = vignette;
  ballCtx.fillRect(0, 0, ballSize, ballSize);

  const fallbackBallTex = new THREE.CanvasTexture(ballCanvas);
  fallbackBallTex.colorSpace = THREE.SRGBColorSpace;
  fallbackBallTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  fallbackBallTex.needsUpdate = true;

  // --- Grass Texture ---
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const grassCtx = grassCanvas.getContext('2d')!;
  
  // Base color
  grassCtx.fillStyle = '#2e8b2e'; // SeaGreen
  grassCtx.fillRect(0, 0, 256, 256);
  
  // Add a subtle turf noise layer (light texture)
  grassCtx.globalAlpha = 0.12;
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const size = Math.random() * 2.5 + 0.8;
    grassCtx.fillStyle = Math.random() > 0.5 ? '#358f35' : '#277527';
    grassCtx.beginPath();
    grassCtx.arc(x, y, size, 0, Math.PI * 2);
    grassCtx.fill();
  }
  grassCtx.globalAlpha = 1.0; // Reset
  
  const grassTex = new THREE.CanvasTexture(grassCanvas);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  // Apply tiling to the texture
  grassTex.repeat.set(20, 12);
  grassTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // --- Materials ---

  const TEAM_PALETTES = {
    teamA: { shirt: M.teamAShirt, pants: M.teamAPants, hair: M.hairBlack, visor: M.teamAVisor },
    teamB: { shirt: M.teamBShirt, pants: M.teamBPants, hair: M.hairBlack, visor: M.teamBVisor },
  };

  const gameState = {
    status: 'PLAYING',
    scoreA: 0,
    scoreB: 0,
    shotsA: 0,
    shotsB: 0,
    shotsOnTargetA: 0,
    shotsOnTargetB: 0,
    savesA: 0,
    savesB: 0,
    period: 1,
    timer: 60,
    down: 1,
    distance: 10,
    ballPos: new THREE.Vector3(-20, 0.15, 0),
    message: 'READY',
    messageReason: '',
    isLive: false,
    isResetting: false,
    isKickoff: false,
    kickoffState: 'NONE' as 'NONE' | 'READY' | 'KICKED',
    selectedKickoffPlayerIndex: 0,
    passCaught: false,
    selectedOffensePlay: 'slant-flood',
    selectedDefensePlay: 'cover-2',
    lastOffensePlay: 'slant-flood',
    lastDefensePlay: 'cover-2',
    hintDismissed: false,
    offensiveTeam: 'A' as 'A' | 'B',
    selectedReceiverIndex: 0,
    selectedDefenderIndex: 0,
    selectedDefenderOrbitRotated: false,
    isChargingPass: false,
    isPassLocked: false,
    passChargeProgress: 0,
    passChargeOffset: new THREE.Vector3(),
    isChargingShot: false,
    shotChargeProgress: 0,
    screenShake: 0,
    humanPlayerIndex: 0,
    manualSelectCooldown: 0,
    hotSeatMode: false,
    testingMode: false,
    humanPlayerIndexB: 0,
    manualSelectCooldownB: 0,
    cpuVsCpu: false,
    menuVisible: true,
    cpuDecisionCooldownA: 0,
    cpuDecisionCooldownB: 0,
    goalKickInProgress: false,
    saveSlowmoUntil: 0,
    aiStyle: 'BALANCED' as 'BALANCED' | 'AGGRESSIVE' | 'POSSESSION',
    // Counter-attack burst
    counterAttackActive: false,
    counterAttackTeam: '' as 'A' | 'B' | '',
    counterAttackExpiry: 0,
    // Attack-to-defense transition sprint
    transitionDefenseExpiry: 0,
    transitionDefenseTeam: '' as 'A' | 'B' | '',
    // Give-and-go state
    giveAndGoActive: false,
    giveAndGoPasser: null as any,
    giveAndGoReceiver: null as any,
    giveAndGoExpiry: 0,
    defenseCalloutUntil: 0,
    defenseCalloutTeam: '' as 'A' | 'B' | '',
    crossAssistTeam: '' as 'A' | 'B' | '',
    crossAssistUntil: 0,
    lastShotTelemetrySeq: 0,
    lastShotTelemetry: null as null | {
      seq: number;
      timestamp: number;
      team: 'A' | 'B';
      style: string;
      skillDriven: boolean;
      distToGoal: number;
      closePressure: number;
      inShootingLane: boolean;
      inTapInZone: boolean;
      half: number;
      phase: string;
      elapsedInHalf: number;
    },
  };

  const playState = {
    activeRoutes: [] as any[],
    defenseAssignments: [] as any[],
    dynamicOffenseTeam: 'A' as 'A' | 'B',
    lastShapeRefresh: 0,
    targetPlayer: null as any,
    offsidePlayer: null as any,
    ballState: 'held' as 'held' | 'thrown' | 'caught' | 'incomplete',
    throwElapsed: 0,
    throwDuration: 1.2,
    throwStart: new THREE.Vector3(),
    throwEnd: new THREE.Vector3(),
  };

  const ballState = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    angularVel: new THREE.Vector3(),
    heldBy: null as any,
    lastHeldBy: null as any,
    intendedReceiver: null as any,
    intendedTeam: null as 'A' | 'B' | null,
    intendedUntil: 0,
    receiveLockUntil: 0,
    attachFrom: new THREE.Vector3(),
    attachUntil: 0,
    attachedTo: null as any,
    isFlying: false,
    isRolling: false,
    isShot: false,
    shotByTeam: null as 'A' | 'B' | null,
    possessionLockUntil: 0,
    rollingTime: 0,
    rollingLaunchSpeed: 0,
    keeperDistributor: null as any,
  };

  function recordShot(team: 'A' | 'B') {
    if (team === 'A') gameState.shotsA += 1;
    else gameState.shotsB += 1;
  }

  function recordShotOnTarget(team: 'A' | 'B') {
    if (team === 'A') gameState.shotsOnTargetA += 1;
    else gameState.shotsOnTargetB += 1;
  }

  function recordSave(team: 'A' | 'B') {
    if (team === 'A') gameState.savesA += 1;
    else gameState.savesB += 1;
  }

  function setIntendedReceiver(target: any, team: 'A' | 'B', elapsed: number, windowSeconds: number = 1.8) {
    ballState.intendedReceiver = target;
    ballState.intendedTeam = team;
    ballState.intendedUntil = elapsed + windowSeconds;
  }

  function clearIntendedReceiver() {
    ballState.intendedReceiver = null;
    ballState.intendedTeam = null;
    ballState.intendedUntil = 0;
  }

  const GAME_SPEED_SCALE = 0.7;
  const BALL_GROUND_Y = 0.15;
  const BALL_RADIUS = 0.2;
  const BALL_GRAVITY = 9.8;
  const BALL_AIR_DRAG = 0.14;
  const BALL_BOUNCE_RESTITUTION = 0.46;
  const BALL_BOUNCE_GROUND_DAMP = 0.9;
  const BALL_BOUNCE_TO_ROLL_IMPACT_VY = 1.0;
  const BALL_ROLL_LINEAR_DRAG = 0.58;
  const BALL_ROLL_QUAD_DRAG = 0.2;
  const BALL_ROLL_DRAG_START_FACTOR = 0.42;
  const BALL_ROLL_DRAG_RAMP_RATE = 3.2;
  const BALL_ROLL_STOP_SPEED_SQ = 0.02;
  const BALL_STATIC_FRICTION_SPEED = 0.16;
  const BALL_SPIN_AIR_DAMP = 0.22;
  const BALL_SPIN_GROUND_DAMP = 0.95;
  const PLAYER_GROUND_DRAG_RATE = 8.2;
  const PLAYER_STOP_SPEED_SQ = 0.01;
  const SAVE_SLOWMO_DURATION = 0.1;
  const SAVE_SLOWMO_SCALE = 0.24;

  const ballGroundNormal = new THREE.Vector3(0, 1, 0);
  const ballSpinAxis = new THREE.Vector3();
  const ballSpinQuat = new THREE.Quaternion();

  function getRollingAngularVelocity(linearVel: THREE.Vector3) {
    return new THREE.Vector3(linearVel.z, 0, -linearVel.x).multiplyScalar(1 / Math.max(0.001, BALL_RADIUS));
  }

  function dampAngularVelocity(rate: number, dt: number) {
    const damp = Math.max(0, 1.0 - dt * rate);
    ballState.angularVel.multiplyScalar(damp);
    if (ballState.angularVel.lengthSq() < 0.000001) {
      ballState.angularVel.set(0, 0, 0);
    }
  }

  function getPlayerMaxGroundSpeed(player: any, carryingBall: boolean) {
    const speedStat = THREE.MathUtils.clamp(player?.stats?.speed ?? 0.16, 0.08, 0.35);
    const accelStat = THREE.MathUtils.clamp(player?.stats?.acceleration ?? 0.7, 0.35, 1.3);
    const agilityStat = THREE.MathUtils.clamp(player?.stats?.agility ?? 0.8, 0.45, 1.35);
    const keeperBonus = isGoalkeeper(player) ? 0.55 : 0;
    const base = (2.85 + speedStat * 10.2 + accelStat * 0.55 + agilityStat * 0.85 + keeperBonus) * GAME_SPEED_SCALE;
    return base * (carryingBall ? 0.92 : 1.0);
  }

  function setPlayerAIState(player: any, nextState: string) {
    if (!player) return;
    player.aiState = nextState;
  }

  const CORNER_CLUSTER_RADIUS = 7.0;
  const CORNER_CLUSTER_MAX_TEAMMATES = 2;

  function isInCornerQuadrant(pos: THREE.Vector3, cornerApex: THREE.Vector3) {
    const sameXSide = Math.sign(pos.x || 0) === Math.sign(cornerApex.x || 0);
    const sameZSide = Math.sign(pos.z || 0) === Math.sign(cornerApex.z || 0);
    if (!sameXSide || !sameZSide) return false;
    return Math.abs(pos.x) > FIELD_W * (CORNER_NEAR_X_RATIO - 0.02) && Math.abs(pos.z) > FIELD_D * (CORNER_NEAR_Z_RATIO - 0.02);
  }

  function getCornerApexIfInChannel(pos: THREE.Vector3) {
    const inCornerChannel = Math.abs(pos.z) > FIELD_D * CORNER_NEAR_Z_RATIO && Math.abs(pos.x) > FIELD_W * CORNER_NEAR_X_RATIO;
    if (!inCornerChannel) return null;
    return new THREE.Vector3(pos.x > 0 ? FIELD_W / 2 : -FIELD_W / 2, 0.15, pos.z > 0 ? FIELD_D / 2 : -FIELD_D / 2);
  }

  function getCornerReliefTarget(player: any, cornerApex: THREE.Vector3) {
    const cornerEscapeX = FIELD_W * 0.2;
    const cornerEscapeZ = FIELD_D * 0.34;
    const relief = new THREE.Vector3(
      cornerApex.x > 0 ? cornerEscapeX : -cornerEscapeX,
      0.15,
      THREE.MathUtils.clamp((player?.homePos?.z ?? 0) * 0.72, -cornerEscapeZ, cornerEscapeZ)
    );
    const fromCorner = new THREE.Vector3().subVectors(relief, cornerApex);
    fromCorner.y = 0;
    if (fromCorner.lengthSq() < 0.01) {
      fromCorner.set(cornerApex.x > 0 ? -1 : 1, 0, cornerApex.z > 0 ? -1 : 1);
    }
    if (fromCorner.lengthSq() < (CORNER_CLUSTER_RADIUS + 1.8) * (CORNER_CLUSTER_RADIUS + 1.8)) {
      fromCorner.setLength(CORNER_CLUSTER_RADIUS + 1.8);
      relief.copy(cornerApex).add(fromCorner);
    }
    relief.x = THREE.MathUtils.clamp(relief.x, -FIELD_W / 2 + 1.8, FIELD_W / 2 - 1.8);
    relief.z = THREE.MathUtils.clamp(relief.z, -FIELD_D / 2 + 1.8, FIELD_D / 2 - 1.8);
    relief.y = 0.15;
    return relief;
  }

  function getCornerRoleLabel(player: any) {
    return (player?.displayRole || player?.role || '').toString().toUpperCase();
  }

  function isCornerPreferredRole(player: any) {
    const role = getCornerRoleLabel(player);
    return role === 'CB' || role === 'DM';
  }

  function updateCornerBunchDetector(dt: number) {
    const byTeam = {
      A: { LT: 0, LB: 0, RT: 0, RB: 0 },
      B: { LT: 0, LB: 0, RT: 0, RB: 0 },
    };
    const mixed = { LT: 0, LB: 0, RT: 0, RB: 0 };

    for (const p of players) {
      if (isGoalkeeper(p)) continue;
      if (Math.abs(p.pos.x) <= FIELD_W * CORNER_NEAR_X_RATIO || Math.abs(p.pos.z) <= FIELD_D * CORNER_NEAR_Z_RATIO) continue;
      const xKey = p.pos.x > 0 ? 'R' : 'L';
      const zKey = p.pos.z > 0 ? 'T' : 'B';
      const cornerKey = `${xKey}${zKey}` as 'LT' | 'LB' | 'RT' | 'RB';
      (byTeam[p.team as 'A' | 'B'] as any)[cornerKey] += 1;
      (mixed as any)[cornerKey] += 1;
    }

    (['A', 'B'] as const).forEach((team) => {
      const counts = byTeam[team] as { LT: number; LB: number; RT: number; RB: number };
      const maxCornerCount = Math.max(counts.LT, counts.LB, counts.RT, counts.RB);
      const tracker = cornerBunchTracker[team];
      tracker.current = maxCornerCount;
      tracker.peak = Math.max(tracker.peak, maxCornerCount);

      if (gameState.isLive && maxCornerCount >= CORNER_BUNCH_MIN_PLAYERS) {
        tracker.timer += dt;
        if (!tracker.active && tracker.timer >= CORNER_BUNCH_MIN_SECONDS) {
          tracker.active = true;
          tracker.events += 1;
          showPlayPatternTag(`CORNER BUNCH ${team} (${maxCornerCount})`, 'rgba(255,132,132,0.97)');
        }
      } else {
        tracker.timer = Math.max(0, tracker.timer - dt * 1.5);
        if (tracker.timer < 0.2) tracker.active = false;
      }
    });

    const mixedMaxCornerCount = Math.max(mixed.LT, mixed.LB, mixed.RT, mixed.RB);
    const mixedTracker = cornerBunchTracker.MIXED;
    mixedTracker.current = mixedMaxCornerCount;
    mixedTracker.peak = Math.max(mixedTracker.peak, mixedMaxCornerCount);
    if (gameState.isLive && mixedMaxCornerCount >= CORNER_BUNCH_COMBINED_MIN_PLAYERS) {
      mixedTracker.timer += dt;
      if (!mixedTracker.active && mixedTracker.timer >= CORNER_BUNCH_MIN_SECONDS) {
        mixedTracker.active = true;
        mixedTracker.events += 1;
        showPlayPatternTag(`CORNER TRAFFIC (${mixedMaxCornerCount})`, 'rgba(255,170,120,0.97)');
      }
    } else {
      mixedTracker.timer = Math.max(0, mixedTracker.timer - dt * 1.5);
      if (mixedTracker.timer < 0.2) mixedTracker.active = false;
    }
  }

  function steerPlayerTowards(
    player: any,
    target: THREE.Vector3,
    dt: number,
    maxSpeed: number,
    maxAccel: number,
    slowRadius: number,
    arrivalEpsilon: number = 0.08,
  ) {
    let steeringTarget = target;
    const targetCornerApex = getCornerApexIfInChannel(target);
    const playerCornerApex = getCornerApexIfInChannel(player.pos);
    const activeCornerApex = targetCornerApex || playerCornerApex;
    if (activeCornerApex && !isGoalkeeper(player)) {
      const sameTeamOutfield = players
        .filter((p: any) => p.team === player.team && !isGoalkeeper(p))
        .slice();
      const preferred = sameTeamOutfield
        .filter((p: any) => isCornerPreferredRole(p))
        .sort((a: any, b: any) => a.pos.distanceTo(activeCornerApex) - b.pos.distanceTo(activeCornerApex));
      const others = sameTeamOutfield
        .filter((p: any) => !isCornerPreferredRole(p))
        .sort((a: any, b: any) => a.pos.distanceTo(activeCornerApex) - b.pos.distanceTo(activeCornerApex));

      const allowedCornerPlayers: any[] = [];
      for (const p of preferred) {
        if (allowedCornerPlayers.length >= CORNER_CLUSTER_MAX_TEAMMATES) break;
        allowedCornerPlayers.push(p);
      }
      for (const p of others) {
        if (allowedCornerPlayers.length >= CORNER_CLUSTER_MAX_TEAMMATES) break;
        allowedCornerPlayers.push(p);
      }

      const isAllowedCornerPlayer = allowedCornerPlayers.includes(player);
      const playerInsideCornerBubble = player.pos.distanceTo(activeCornerApex) < CORNER_CLUSTER_RADIUS;
      const targetInsideCornerBubble = target.distanceTo(activeCornerApex) < CORNER_CLUSTER_RADIUS;
      const crowdCount = sameTeamOutfield.filter((p: any) => p.pos.distanceTo(activeCornerApex) < CORNER_CLUSTER_RADIUS).length;
      const channelCrowdCount = sameTeamOutfield.filter((p: any) => isInCornerQuadrant(p.pos, activeCornerApex)).length;
      const playerInCornerChannel = isInCornerQuadrant(player.pos, activeCornerApex);
      const targetInCornerChannel = isInCornerQuadrant(target, activeCornerApex);

      if (!isAllowedCornerPlayer && (
        playerInsideCornerBubble ||
        targetInsideCornerBubble ||
        playerInCornerChannel ||
        targetInCornerChannel ||
        crowdCount > CORNER_CLUSTER_MAX_TEAMMATES ||
        channelCrowdCount > CORNER_CLUSTER_MAX_TEAMMATES
      )) {
        steeringTarget = getCornerReliefTarget(player, activeCornerApex);
      }
    }

    const toTarget = new THREE.Vector3().subVectors(steeringTarget, player.pos);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist < arrivalEpsilon) {
      const settle = Math.max(0, 1 - dt * 9);
      player.vel.x *= settle;
      player.vel.z *= settle;
      return dist;
    }

    const desiredSpeed = maxSpeed * (dist < slowRadius ? THREE.MathUtils.clamp(dist / Math.max(0.001, slowRadius), 0.18, 1) : 1);
    const desiredVel = toTarget.normalize().multiplyScalar(desiredSpeed);

    const inCornerChannel = Math.abs(player.pos.z) > FIELD_D * CORNER_NEAR_Z_RATIO && Math.abs(player.pos.x) > FIELD_W * CORNER_NEAR_X_RATIO;

    // Lightweight local separation so players do not stack into each other.
    const separation = new THREE.Vector3();
    const separationRadius = inCornerChannel ? 1.75 : 1.15;
    for (const teammate of players) {
      if (teammate === player || teammate.team !== player.team) continue;
      const away = new THREE.Vector3().subVectors(player.pos, teammate.pos);
      away.y = 0;
      const d = away.length();
      if (d > 0.0001 && d < separationRadius) {
        separation.addScaledVector(away.normalize(), (separationRadius - d) / separationRadius);
      }
    }
    if (separation.lengthSq() > 0.0001) {
      separation.normalize();
      desiredVel.addScaledVector(separation, maxSpeed * (inCornerChannel ? 0.45 : 0.2));
    }

    // Corner escape bias: avoid trapping multiple teammates against touchline + goal line.
    if (inCornerChannel) {
      desiredVel.x += (player.pos.x > 0 ? -1 : 1) * 5.2;
      desiredVel.z += (player.pos.z > 0 ? -1 : 1) * 5.8;
    }

    // Soft boundary avoidance before hard clamping.
    const margin = 1.2;
    if (Math.abs(player.pos.x) > FIELD_W / 2 - margin) {
      desiredVel.x += (player.pos.x > 0 ? -1 : 1) * 3.4;
    }
    if (Math.abs(player.pos.z) > FIELD_D / 2 - margin) {
      desiredVel.z += (player.pos.z > 0 ? -1 : 1) * 3.8;
    }

    const currentVel = new THREE.Vector3(player.vel.x, 0, player.vel.z);
    const steer = desiredVel.sub(currentVel);
    const maxDeltaV = Math.max(0.001, maxAccel * dt);
    if (steer.lengthSq() > maxDeltaV * maxDeltaV) {
      steer.setLength(maxDeltaV);
    }

    currentVel.add(steer);
    if (currentVel.lengthSq() > maxSpeed * maxSpeed) {
      currentVel.setLength(maxSpeed);
    }

    player.vel.x = currentVel.x;
    player.vel.z = currentVel.z;
    player.pos.addScaledVector(currentVel, dt);
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, -FIELD_W / 2, FIELD_W / 2);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, -FIELD_D / 2, FIELD_D / 2);
    return dist;
  }

  const AI_STYLE_PRESETS = {
    BALANCED: {
      pressureCount: 4,
      looseBallChasers: 2,
      chaseSpeedLead: 6.7,
      chaseSpeedSupport: 5.8,
      carryBias: 8.5,
      passChanceFar: 0.48,
      passChanceNear: 0.3,
      shootChanceFar: 0.42,
      shootChanceNear: 0.68,
      cooldownShoot: 0.95,
      cooldownPass: 0.9,
      cpuShotAimErrorRad: 0.12,
      cpuShotPressureError: 0.06,
    },
    AGGRESSIVE: {
      pressureCount: 5,
      looseBallChasers: 3,
      chaseSpeedLead: 7.2,
      chaseSpeedSupport: 6.4,
      carryBias: 9.8,
      passChanceFar: 0.34,
      passChanceNear: 0.2,
      shootChanceFar: 0.56,
      shootChanceNear: 0.82,
      cooldownShoot: 0.72,
      cooldownPass: 0.7,
      cpuShotAimErrorRad: 0.15,
      cpuShotPressureError: 0.08,
    },
    POSSESSION: {
      pressureCount: 3,
      looseBallChasers: 2,
      chaseSpeedLead: 6.2,
      chaseSpeedSupport: 5.2,
      carryBias: 7.0,
      passChanceFar: 0.68,
      passChanceNear: 0.5,
      shootChanceFar: 0.28,
      shootChanceNear: 0.48,
      cooldownShoot: 1.15,
      cooldownPass: 0.75,
      cpuShotAimErrorRad: 0.1,
      cpuShotPressureError: 0.05,
    },
  };

  function getActiveAIStyle() {
    return AI_STYLE_PRESETS[gameState.aiStyle] || AI_STYLE_PRESETS.BALANCED;
  }

  let cpuShotAimErrorRad = AI_STYLE_PRESETS.BALANCED.cpuShotAimErrorRad;
  let cpuShotPressureError = AI_STYLE_PRESETS.BALANCED.cpuShotPressureError;

  const discipline = {
    yellowA: 0,
    yellowB: 0,
    redA: 0,
    redB: 0,
  };

  const keys: { [key: string]: boolean } = {};
  let lastTime = performance.now();
  let cameraMode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE' = 'BROADCAST';
  const cameraFocusSmoothed = new THREE.Vector3();
  let cameraFocusInitialized = false;
  const BROADCAST_PAN_BLEND = 0.028;
  const broadcastCameraHome = new THREE.Vector3();

  const teamAUniforms = [
    { name: 'Home', palette: TEAM_PALETTES.teamA },
    { name: 'Away', palette: { ...TEAM_PALETTES.teamA, shirt: M.white } },
    { name: 'Alt', palette: { ...TEAM_PALETTES.teamA, shirt: M.orange, pants: M.white } },
  ];
  const teamBUniforms = [
    { name: 'Home', palette: TEAM_PALETTES.teamB },
    { name: 'Away', palette: { ...TEAM_PALETTES.teamB, shirt: M.white } },
    { name: 'Alt', palette: { ...TEAM_PALETTES.teamB, shirt: M.dark } },
  ];
  const hairChoices = [M.hairBlack, M.hairBrown, M.hairBlond];
  const playerHairMap = new Map<string, THREE.Material>();
  let teamAUniformIndex = 0;
  let teamBUniformIndex = 0;

  function hexToRgba(hex: number, alpha: number) {
    const c = new THREE.Color(hex);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getActiveTeamPrimaryHex(team: 'A' | 'B') {
    return team === 'A' ? M.teamAShirt.color.getHex() : M.teamBShirt.color.getHex();
  }

  function updateScoreboardTheme() {
    const colorA = getActiveTeamPrimaryHex('A');
    const colorB = getActiveTeamPrimaryHex('B');
    topAccent.style.background = `linear-gradient(90deg, ${hexToRgba(colorA, 1.0)} 50%, ${hexToRgba(colorB, 1.0)} 50%)`;
    teamA.score.style.background = hexToRgba(colorA, 0.55);
    teamB.score.style.background = hexToRgba(colorB, 0.55);
    teamA.section.style.background = hexToRgba(colorA, 0.08);
    teamB.section.style.background = hexToRgba(colorB, 0.08);
    centerInfo.style.background = 'transparent';
    teamA.name.style.color = '#000000';
    teamB.name.style.color = '#000000';
    timerDisplay.style.color = '#000000';
    qtrDisplay.style.color = 'rgba(0,0,0,0.72)';
  }

  function updateHUD() {
    const target = getSelectedPassTarget();
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A');
    const passHint = gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' ? ' [G: PASS]' : '';
    const shootHint = gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' ? ' [F: SHOOT]' : '';
    const selectionHint = canSelect ? ' [SPACE: SWITCH PLAYER]' : '';
    const targetDisplay = target ? `PASS: ${target.displayRole || target.role}` : 'NO TARGET';
    const kickoffPrompt = gameState.isKickoff && !gameState.isLive && !gameState.menuVisible ? 'PRESS SPACE TO KICK OFF' : '';
    
    teamA.score.textContent = gameState.scoreA.toString();
    teamB.score.textContent = gameState.scoreB.toString();
    updateScoreboardTheme();

    hintOverlay.textContent = 'Play restarts automatically';
    updateTimerDisplay();
  }

  function refreshFrameInspector() {
    // Optional: implement if needed
  }

  // --- Field dimensions ---
  const PITCH_LENGTH_YDS = 120;
  const PITCH_WIDTH_YDS = 80;
  const EZONE_W = 4.8;
  const FIELD_OF_PLAY_W = 56;
  const FIELD_W = FIELD_OF_PLAY_W + EZONE_W * 2;
  const FIELD_SCALE_PER_YARD = FIELD_W / PITCH_LENGTH_YDS;
  const FIELD_D = PITCH_WIDTH_YDS * FIELD_SCALE_PER_YARD;
  broadcastCameraHome.set(0, 30, FIELD_D * 1.02);
  const UNITS_PER_YARD = FIELD_OF_PLAY_W / 100;
  const TEN_YARDS_UNITS = UNITS_PER_YARD * 10;
  const FIVE_YARDS_UNITS = UNITS_PER_YARD * 5;
  const RIGHT_ENDZONE_X = FIELD_W / 2 - EZONE_W;
  const GOALPOST_OFFSET = 1.15;
  const OUTLINE_W = FIELD_W + GOALPOST_OFFSET * 2;

  const fieldElements: THREE.Mesh[] = [];

  function addBox(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  function addFieldBox(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
    const m = addBox(w, h, d, mat, x, y, z);
    m.receiveShadow = true;
    fieldElements.push(m);
    return m;
  }

  const fieldGrassMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e8b2e,
    map: grassTex,
    roughness: 0.88,
    metalness: 0.0,
  });
  const fieldGrass = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_D), fieldGrassMaterial);
  fieldGrass.rotation.x = -Math.PI / 2;
  fieldGrass.position.y = 0.01;
  fieldGrass.receiveShadow = true;
  scene.add(fieldGrass);
  const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
  const groundMaterial = M.fieldGreen;
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true; // Re-enabled after test
  scene.add(ground);

  // Soccer pitch markings (dimension map from diagram)
  const X_PER_YARD = FIELD_SCALE_PER_YARD;
  const Z_PER_YARD = FIELD_SCALE_PER_YARD;
  const REGULATION_GOAL_WIDTH_YARDS = 8;
  const REGULATION_GOAL_HEIGHT_YARDS = 8 / 3;
  const REGULATION_GOAL_TOP_DEPTH_YARDS = 2;
  const REGULATION_GOAL_BOTTOM_DEPTH_YARDS = 8 / 3;
  const goalMouthWidth = REGULATION_GOAL_WIDTH_YARDS * Z_PER_YARD;
  const goalMouthHeight = REGULATION_GOAL_HEIGHT_YARDS * X_PER_YARD;
  const goalRoofDepth = REGULATION_GOAL_TOP_DEPTH_YARDS * X_PER_YARD;
  const goalFloorDepth = REGULATION_GOAL_BOTTOM_DEPTH_YARDS * X_PER_YARD;

  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineHeight = 0.035;
  const lineThickness = 0.16;

  const addPitchLine = (w: number, d: number, x: number, z: number) =>
    addFieldBox(w, lineHeight, d, lineMaterial, x, 0.03, z);

  // Outer boundary
  addPitchLine(FIELD_W, lineThickness, 0, -FIELD_D / 2);
  addPitchLine(FIELD_W, lineThickness, 0, FIELD_D / 2);
  addPitchLine(lineThickness, FIELD_D, -FIELD_W / 2, 0);
  addPitchLine(lineThickness, FIELD_D, FIELD_W / 2, 0);

  // Half-way line
  addPitchLine(lineThickness, FIELD_D, 0, 0);

  // Penalty boxes: 18 yds deep, 44 yds wide
  const penaltyDepth = 18 * X_PER_YARD;
  const penaltyWidth = 44 * Z_PER_YARD;
  const penaltyHalfZ = penaltyWidth / 2;
  const leftGoalX = -FIELD_W / 2;
  const rightGoalX = FIELD_W / 2;
  const leftPenaltyX = leftGoalX + penaltyDepth;
  const rightPenaltyX = rightGoalX - penaltyDepth;

  addPitchLine(penaltyDepth, lineThickness, leftGoalX + penaltyDepth / 2, -penaltyHalfZ);
  addPitchLine(penaltyDepth, lineThickness, leftGoalX + penaltyDepth / 2, penaltyHalfZ);
  addPitchLine(lineThickness, penaltyWidth, leftPenaltyX, 0);

  addPitchLine(penaltyDepth, lineThickness, rightGoalX - penaltyDepth / 2, -penaltyHalfZ);
  addPitchLine(penaltyDepth, lineThickness, rightGoalX - penaltyDepth / 2, penaltyHalfZ);
  addPitchLine(lineThickness, penaltyWidth, rightPenaltyX, 0);

  // Goal boxes: 6 yds deep, 20 yds wide
  const goalBoxDepth = 6 * X_PER_YARD;
  const goalBoxWidth = 20 * Z_PER_YARD;
  const goalBoxHalfZ = goalBoxWidth / 2;
  const leftGoalBoxX = leftGoalX + goalBoxDepth;
  const rightGoalBoxX = rightGoalX - goalBoxDepth;

  addPitchLine(goalBoxDepth, lineThickness, leftGoalX + goalBoxDepth / 2, -goalBoxHalfZ);
  addPitchLine(goalBoxDepth, lineThickness, leftGoalX + goalBoxDepth / 2, goalBoxHalfZ);
  addPitchLine(lineThickness, goalBoxWidth, leftGoalBoxX, 0);

  addPitchLine(goalBoxDepth, lineThickness, rightGoalX - goalBoxDepth / 2, -goalBoxHalfZ);
  addPitchLine(goalBoxDepth, lineThickness, rightGoalX - goalBoxDepth / 2, goalBoxHalfZ);
  addPitchLine(lineThickness, goalBoxWidth, rightGoalBoxX, 0);

  // Center and penalty spots
  addFieldBox(0.22, lineHeight, 0.22, lineMaterial, 0, 0.03, 0);
  addFieldBox(0.22, lineHeight, 0.22, lineMaterial, leftGoalX + 12 * X_PER_YARD, 0.03, 0);
  addFieldBox(0.22, lineHeight, 0.22, lineMaterial, rightGoalX - 12 * X_PER_YARD, 0.03, 0);

  // Center circle (10 yds)
  const centerCircle = new THREE.Mesh(
    new THREE.TorusGeometry(10 * X_PER_YARD, lineThickness * 0.45, 12, 96),
    lineMaterial
  );
  centerCircle.rotation.x = Math.PI / 2;
  centerCircle.position.set(0, 0.032, 0);
  centerCircle.receiveShadow = true;
  fieldElements.push(centerCircle);
  scene.add(centerCircle);

  // Corner arcs (1 yd)
  const cornerRadius = 1 * X_PER_YARD;
  const makeCornerArc = (x: number, z: number, startAngle: number) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(cornerRadius, lineThickness * 0.45, 10, 48, Math.PI / 2),
      lineMaterial
    );
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = startAngle;
    arc.position.set(x, 0.032, z);
    arc.receiveShadow = true;
    fieldElements.push(arc);
    scene.add(arc);
  };

  makeCornerArc(-FIELD_W / 2, -FIELD_D / 2, 0);
  makeCornerArc(FIELD_W / 2, -FIELD_D / 2, Math.PI / 2);
  makeCornerArc(FIELD_W / 2, FIELD_D / 2, Math.PI);
  makeCornerArc(-FIELD_W / 2, FIELD_D / 2, -Math.PI / 2);

  // Soccer goals: regulation senior 11-a-side size is 24 ft x 8 ft (8 yds x 8/3 yds)
  const goalFrameMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.22 });
  const goalNetCanvas = document.createElement('canvas');
  goalNetCanvas.width = 256;
  goalNetCanvas.height = 256;
  const goalNetCtx = goalNetCanvas.getContext('2d')!;
  goalNetCtx.clearRect(0, 0, goalNetCanvas.width, goalNetCanvas.height);
  goalNetCtx.strokeStyle = 'rgba(255,255,255,0.84)';
  goalNetCtx.lineWidth = 1.6;
  const netCell = 20;
  for (let px = 0; px <= goalNetCanvas.width; px += netCell) {
    goalNetCtx.beginPath();
    goalNetCtx.moveTo(px, 0);
    goalNetCtx.lineTo(px, goalNetCanvas.height);
    goalNetCtx.stroke();
  }
  for (let py = 0; py <= goalNetCanvas.height; py += netCell) {
    goalNetCtx.beginPath();
    goalNetCtx.moveTo(0, py);
    goalNetCtx.lineTo(goalNetCanvas.width, py);
    goalNetCtx.stroke();
  }
  const goalNetTexture = new THREE.CanvasTexture(goalNetCanvas);
  goalNetTexture.wrapS = THREE.RepeatWrapping;
  goalNetTexture.wrapT = THREE.RepeatWrapping;
  goalNetTexture.repeat.set(1.8, 1.8);
  goalNetTexture.needsUpdate = true;
  const goalNetMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    alphaMap: goalNetTexture,
    roughness: 0.88,
    metalness: 0.0,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  function addGoalPart(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    fieldElements.push(mesh);
  }

  function addSoccerGoal(goalLineX: number, opensTowardField: 1 | -1) {
    const goalWidth = goalMouthWidth;
    const goalHeight = goalMouthHeight;
    const topDepth = goalRoofDepth;
    const bottomDepth = goalFloorDepth;
    const postRadius = 0.11;
    const halfW = goalWidth / 2;
    const frontX = goalLineX - opensTowardField * postRadius;
    const backTopX = frontX - opensTowardField * topDepth;
    const backBottomX = frontX - opensTowardField * bottomDepth;

    const frontTopLeft = new THREE.Vector3(frontX, goalHeight, -halfW);
    const frontTopRight = new THREE.Vector3(frontX, goalHeight, halfW);
    const frontBottomLeft = new THREE.Vector3(frontX, postRadius * 0.75, -halfW);
    const frontBottomRight = new THREE.Vector3(frontX, postRadius * 0.75, halfW);

    const rearTopLeft = new THREE.Vector3(backTopX, goalHeight, -halfW);
    const rearTopRight = new THREE.Vector3(backTopX, goalHeight, halfW);
    const rearBottomLeft = new THREE.Vector3(backBottomX, postRadius * 0.75, -halfW);
    const rearBottomRight = new THREE.Vector3(backBottomX, postRadius * 0.75, halfW);

    const addGoalTube = (start: THREE.Vector3, end: THREE.Vector3) => {
      const dir = end.clone().sub(start);
      const len = dir.length();
      if (len < 0.001) return;
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(postRadius, postRadius, len, 20),
        goalFrameMaterial
      );
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      addGoalPart(mesh);
    };

    const addNetPanel = (
      a: THREE.Vector3,
      b: THREE.Vector3,
      c: THREE.Vector3,
      d: THREE.Vector3,
      sagFn?: (u: number, v: number, point: THREE.Vector3) => void,
      segU: number = 14,
      segV: number = 10
    ) => {
      const geom = new THREE.PlaneGeometry(1, 1, segU, segV);
      const pos = geom.attributes.position as THREE.BufferAttribute;
      const temp = new THREE.Vector3();
      const wa = new THREE.Vector3();
      const wb = new THREE.Vector3();
      const wc = new THREE.Vector3();
      const wd = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const u = (pos.getX(i) + 0.5);
        const v = 1 - (pos.getY(i) + 0.5);
        wa.copy(a).multiplyScalar((1 - u) * (1 - v));
        wb.copy(b).multiplyScalar(u * (1 - v));
        wc.copy(c).multiplyScalar(u * v);
        wd.copy(d).multiplyScalar((1 - u) * v);
        temp.copy(wa).add(wb).add(wc).add(wd);
        if (sagFn) sagFn(u, v, temp);
        pos.setXYZ(i, temp.x, temp.y, temp.z);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();
      const mesh = new THREE.Mesh(geom, goalNetMaterial);
      addGoalPart(mesh);
    };

    // Front goal mouth frame.
    addGoalTube(frontBottomLeft, frontTopLeft);
    addGoalTube(frontBottomRight, frontTopRight);
    addGoalTube(frontTopLeft, frontTopRight);

    // Side rails and rear frame.
    addGoalTube(frontTopLeft, rearTopLeft);
    addGoalTube(frontTopRight, rearTopRight);
    addGoalTube(frontBottomLeft, rearBottomLeft);
    addGoalTube(frontBottomRight, rearBottomRight);
    addGoalTube(rearBottomLeft, rearTopLeft);
    addGoalTube(rearBottomRight, rearTopRight);
    addGoalTube(rearTopLeft, rearTopRight);
    addGoalTube(rearBottomLeft, rearBottomRight);

    // Side nets hang backward and down toward the middle.
    addNetPanel(frontBottomLeft, frontTopLeft, rearTopLeft, rearBottomLeft, (_u, v, point) => {
      const wave = Math.sin(v * Math.PI);
      point.x -= opensTowardField * wave * 0.18 * X_PER_YARD;
      point.y -= wave * 0.05 * X_PER_YARD;
    });
    addNetPanel(frontBottomRight, frontTopRight, rearTopRight, rearBottomRight, (_u, v, point) => {
      const wave = Math.sin(v * Math.PI);
      point.x -= opensTowardField * wave * 0.18 * X_PER_YARD;
      point.y -= wave * 0.05 * X_PER_YARD;
    });

    // Back net hangs with a slight inward curve and vertical sag.
    addNetPanel(rearBottomLeft, rearTopLeft, rearTopRight, rearBottomRight, (u, v, point) => {
      const centerWave = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      point.x -= opensTowardField * centerWave * 0.14 * X_PER_YARD;
      point.y -= centerWave * 0.14 * X_PER_YARD;
    });

    // Roof net droops between the bar and rear top rail.
    addNetPanel(frontTopLeft, frontTopRight, rearTopRight, rearTopLeft, (u, v, point) => {
      const roofSag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      point.y -= roofSag * 0.2 * X_PER_YARD;
    });

    // Floor net with slight lift near the center to avoid z-fighting.
    addNetPanel(frontBottomLeft, frontBottomRight, rearBottomRight, rearBottomLeft, (u, v, point) => {
      const rise = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.008;
      point.y += rise;
    });
  }

  addSoccerGoal(leftGoalX, 1);
  addSoccerGoal(rightGoalX, -1);

  const crowdBlocks: any[] = [];
  const visibleCrowdBlocks: any[] = [];
  const teamAPhrases = ["Let's Go!", "Come On!", "Goal!", "Great Play!"];
  const teamBPhrases = ["Attack!", "Press!", "Goal!", "Brilliant!"];
  const CROWD_CROSSOVER_RATIO = 0.08; // small away-supporter mix in each stand section
  const CROWD_ANIMATION_INTERVAL_MS = 1000 / 24;
  const MAX_ACTIVE_WORD_BALLOONS = 3;
  let activeWordBalloons = 0;
  let lastCrowdAnimationMs = 0;

  function spawnWordBalloon(x: number, y: number, z: number, text: string, color: string) {
    activeWordBalloons += 1;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 192, 40);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 96);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y + 1, z);
    sprite.scale.set(8, 4, 1);
    scene.add(sprite);
    
    let opacity = 1;
    const animateBalloon = () => {
      opacity -= 0.02; // Fade speed reduced by 50% (fade 100% slower)
      sprite.position.y += 0.005; // Movement speed reduced by 75%
      sprite.material.opacity = opacity;
      if (opacity > 0) {
        requestAnimationFrame(animateBalloon);
      } else {
        scene.remove(sprite);
        texture.dispose();
        spriteMat.dispose();
        activeWordBalloons = Math.max(0, activeWordBalloons - 1);
      }
    };
    animateBalloon();
  }

  let crowdMesh: THREE.InstancedMesh;
  function getCrowdPalette(team: 'teamA' | 'teamB') {
    if (team === 'teamA') {
      return [
        M.teamAShirt.color.getHex(),
        M.teamAPants.color.clone().offsetHSL(0, 0, 0.08).getHex(),
        0xffffff,
        M.teamAShirt.color.clone().offsetHSL(0, 0, 0.12).getHex(),
        M.teamAShirt.color.clone().offsetHSL(0, 0, -0.1).getHex(),
      ];
    }
    return [
      M.teamBShirt.color.getHex(),
      M.teamBPants.color.clone().offsetHSL(0, 0, 0.08).getHex(),
      0xffffff,
      M.teamBShirt.color.clone().offsetHSL(0, 0, 0.12).getHex(),
      M.teamBShirt.color.clone().offsetHSL(0, 0, -0.1).getHex(),
    ];
  }

  function refreshCrowdColors() {
    if (!crowdMesh || crowdBlocks.length === 0) return;
    crowdBlocks.forEach((block) => {
      const palette = getCrowdPalette(block.team === 'teamA' ? 'teamA' : 'teamB');
      const toneIndex = (typeof block.toneIndex === 'number' ? block.toneIndex : 0) % palette.length;
      crowdMesh.setColorAt(block.instanceIndex, new THREE.Color(palette[toneIndex]));
    });
    if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
  }

  function createStadium() {
    const stadiumGroup = new THREE.Group();
    scene.add(stadiumGroup);

    const stadiumColor = 0x2a3b5a; // Dark blue/purple
    const wallMat = new THREE.MeshStandardMaterial({ color: stadiumColor, roughness: 0.7 });

    const addSBox = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.castShadow = true;
      stadiumGroup.add(m);
      return m;
    };

    const wallHeight = 2.4;
    const wallThickness = 1.0;
    const wallOffset = 5; 

    const wallW = FIELD_W + wallOffset * 2;
    const wallD = FIELD_D + wallOffset * 2;

    // Base Walls
    addSBox(wallW, wallHeight, wallThickness, wallMat, 0, wallHeight/2, -wallD/2);
    addSBox(wallW, wallHeight, wallThickness, wallMat, 0, wallHeight/2, wallD/2);
    addSBox(wallThickness, wallHeight, wallD, wallMat, -wallW/2, wallHeight/2, 0);
    addSBox(wallThickness, wallHeight, wallD, wallMat, wallW/2, wallHeight/2, 0);

    // Banners
    const defaultBannerTickerSource = 'PIXEL SOCCER LEAGUE • ';
    const bannerTickerWindowChars = 26;
    const BANNER_SCROLL_STEP_SECONDS = 0.11;
    const BANNER_SCROLL_STEPS_PER_CYCLE = 18;
    const BANNER_STOP_SECONDS = 0.8;
    const BANNER_BLINK_STEP_SECONDS = 0.12;
    const BANNER_BLINK_TOGGLES = 4; // off/on/off/on = two blinks

    const applyBannerTickerText = (textObj: any, offset: number) => {
      const tickerSource = textObj.tickerSource || defaultBannerTickerSource;
      const tickerLoop = textObj.tickerLoop || tickerSource.repeat(10);
      const loopLen = tickerSource.length;
      const normalizedOffset = ((offset % loopLen) + loopLen) % loopLen;
      const doubled = tickerLoop + tickerLoop;
      const textSlice = doubled.slice(normalizedOffset, normalizedOffset + bannerTickerWindowChars);
      if (textObj._tickerText === textSlice) return;
      textObj._tickerText = textSlice;
      textObj.text = textSlice;
      textObj.sync();
    };

    const initBannerTicker = (textObj: any, seed: number, sourceText: string = defaultBannerTickerSource) => {
      textObj.tickerSource = sourceText;
      textObj.tickerLoop = sourceText.repeat(10);
      textObj.tickerPhase = 'scroll';
      textObj.tickerOffset = Math.floor(seed * sourceText.length) % sourceText.length;
      textObj.tickerSteps = 0;
      textObj.tickerBlinkToggles = 0;
      textObj.tickerNextAt = 0;
      textObj.visible = true;
      applyBannerTickerText(textObj, textObj.tickerOffset);
    };

    const createBannerText = (text: string, color: string) => {
      const t = new Text();
      t.text = text;
      t.fontSize = 1.05;
      t.color = color;
      t.anchorX = 'center';
      t.anchorY = 'middle';
      t.whiteSpace = 'nowrap';
      t.font = '/assets/fonts/SubwayTicker-q1Z5.ttf';
      initBannerTicker(t as any, Math.random(), `${text} • `);
      t.sync();
      return t;
    };

    const textLeft = createBannerText(activeTeams.B.scoreName, '#' + M.teamBShirt.color.getHexString());
    const textMiddle = createBannerText('PIXEL SOCCER LEAGUE', '#94a3b8');
    const textRight = createBannerText(activeTeams.A.scoreName, '#' + M.teamAShirt.color.getHexString());

    for (let x = -24; x <= 24; x += 24) {
      const bannerText = x === -24 ? textLeft : (x === 0 ? textMiddle : textRight);
      
      const b1 = bannerText.clone();
      initBannerTicker(b1 as any, Math.random(), (bannerText as any).tickerSource || defaultBannerTickerSource);
      b1.position.set(x, wallHeight/2, -wallD/2 + 0.51);
      stadiumGroup.add(b1);
      bannerTexts.push(b1);
      if (x === -24) teamBBannerMeshes.push(b1 as Text);
      else if (x === 24) teamABannerMeshes.push(b1 as Text);
      
      const b2 = bannerText.clone();
      initBannerTicker(b2 as any, Math.random(), (bannerText as any).tickerSource || defaultBannerTickerSource);
      b2.position.set(x, wallHeight/2, wallD/2 - 0.51);
      b2.rotation.y = Math.PI;
      stadiumGroup.add(b2);
      bannerTexts.push(b2);
      if (x === -24) teamBBannerMeshes.push(b2 as Text);
      else if (x === 24) teamABannerMeshes.push(b2 as Text);
    }

    // Add banners to short side walls (top/bottom only, no middle banner)
    for (const z of [-wallD / 4, wallD / 4]) {
      const bLeft = textMiddle.clone();
      initBannerTicker(bLeft as any, Math.random(), (textMiddle as any).tickerSource || defaultBannerTickerSource);
      bLeft.position.set(-wallW/2 + 0.51, wallHeight/2, z);
      bLeft.rotation.y = Math.PI / 2;
      stadiumGroup.add(bLeft);
      bannerTexts.push(bLeft);

      const bRight = textMiddle.clone();
      initBannerTicker(bRight as any, Math.random(), (textMiddle as any).tickerSource || defaultBannerTickerSource);
      bRight.position.set(wallW/2 - 0.51, wallHeight/2, z);
      bRight.rotation.y = -Math.PI / 2;
      stadiumGroup.add(bRight);
      bannerTexts.push(bRight);
    }

    // Crowd Blocks - Team A on one side, Team B on the other
    const teamACrowdColors = getCrowdPalette('teamA');
    const teamBCrowdColors = getCrowdPalette('teamB');
    const blockGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const crowdMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8 });

    // Pre-calculate total crowd count
    let totalCrowdCount = 0;
    const spawnConfigs: any[] = [];
    
    const prepareSpawn = (w: number, d: number, x: number, y: number, z: number, colors: number[], team: string) => {
      const count = Math.floor((w * d) / 0.6) * 2; // *2 for layers
      totalCrowdCount += count;
      spawnConfigs.push({ w, d, x, y, z, colors, count: count / 2, team });
    };

    const tierCount = 3;
    const tierH = 5;
    const tierD = 12;
    const tierStep = 4;

    for (let i = 0; i < tierCount; i++) {
      const y = wallHeight + i * tierH;
      const dOff = i * tierStep;
      const currentW = wallW + dOff * 2 + 15;
      const currentD = wallD + dOff * 2 + 15;
      
      // Stands (Base structure)
      const standMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4a });
      addSBox(currentW, 0.2, tierD, standMat, 0, y, -wallD/2 - tierD/2 - dOff);
      addSBox(currentW, 0.2, tierD, standMat, 0, y, wallD/2 + tierD/2 + dOff);
      addSBox(tierD, 0.2, currentD, standMat, -wallW/2 - tierD/2 - dOff, y, 0);
      addSBox(tierD, 0.2, currentD, standMat, wallW/2 + tierD/2 + dOff, y, 0);

      // Team A side (X < 0)
      prepareSpawn(currentW/2, tierD, -currentW/4, y, -wallD/2 - tierD/2 - dOff, teamACrowdColors, 'teamA');
      prepareSpawn(currentW/2, tierD, -currentW/4, y, wallD/2 + tierD/2 + dOff, teamACrowdColors, 'teamA');
      prepareSpawn(tierD, currentD, -wallW/2 - tierD/2 - dOff, y, 0, teamACrowdColors, 'teamA');
      
      // Team B side (X > 0)
      prepareSpawn(currentW/2, tierD, currentW/4, y, -wallD/2 - tierD/2 - dOff, teamBCrowdColors, 'teamB');
      prepareSpawn(currentW/2, tierD, currentW/4, y, wallD/2 + tierD/2 + dOff, teamBCrowdColors, 'teamB');
      prepareSpawn(tierD, currentD, wallW/2 + tierD/2 + dOff, y, 0, teamBCrowdColors, 'teamB');
      
      // Structure back
      addSBox(currentW, tierH, 0.5, standMat, 0, y + tierH/2, -wallD/2 - tierD - dOff - 0.25);
      addSBox(currentW, tierH, 0.5, standMat, 0, y + tierH/2, wallD/2 + tierD + dOff + 0.25);
    }

    crowdMesh = new THREE.InstancedMesh(blockGeo, crowdMaterial, totalCrowdCount);
    crowdMesh.castShadow = true;
    crowdMesh.receiveShadow = true;
    stadiumGroup.add(crowdMesh);

    let instanceIndex = 0;
    const dummy = new THREE.Object3D();

    spawnConfigs.forEach(config => {
      const { w, d, x, y, z, colors, count, team } = config;
      for (let i = 0; i < count; i++) {
        const bx = x + (Math.random() - 0.5) * w;
        const bz = z + (Math.random() - 0.5) * d;
        const mixedTeam = Math.random() < CROWD_CROSSOVER_RATIO
          ? (team === 'teamA' ? 'teamB' : 'teamA')
          : team;
        const mixedPalette = mixedTeam === 'teamA' ? teamACrowdColors : teamBCrowdColors;
        
        for (let layer = 0; layer < 2; layer++) {
          const by = y + 0.2 + (layer * 0.4);
          
          dummy.position.set(bx, by, bz);
          dummy.updateMatrix();
          crowdMesh.setMatrixAt(instanceIndex, dummy.matrix);
          
          const toneIndex = Math.floor(Math.random() * mixedPalette.length);
          const color = new THREE.Color(mixedPalette[toneIndex]);
          crowdMesh.setColorAt(instanceIndex, color);
          
          crowdBlocks.push({
            instanceIndex,
            baseX: bx,
            baseY: by,
            baseZ: bz,
            team: mixedTeam,
            toneIndex,
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
    });
    crowdMesh.instanceMatrix.needsUpdate = true;
    if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;

    // Filter visible blocks for word balloons
    visibleCrowdBlocks.length = 0;
    crowdBlocks.forEach(b => {
      if (Math.abs(b.baseX) < 45 && Math.abs(b.baseZ) < 45) {
        visibleCrowdBlocks.push(b);
      }
    });

    // Floodlights & Flags
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const flagColors = [0xff4e00, 0x3d5a8c, 0xffcc00];

    const corners = [
      {x: -wallW/2 - 2, z: -wallD/2 - 2},
      {x: wallW/2 + 2, z: -wallD/2 - 2},
      {x: -wallW/2 - 2, z: wallD/2 + 2},
      {x: wallW/2 + 2, z: wallD/2 + 2}
    ];

    corners.forEach((c, idx) => {
      // Pole
      // addSBox(0.4, 24, 0.4, poleMat, c.x, 12, c.z);
      // Light array
      // addSBox(4, 3, 1, lightMat, c.x, 22, c.z);
      // Flag
      const fMat = new THREE.MeshStandardMaterial({ color: flagColors[idx % flagColors.length] });
      const flag = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), fMat);
      flag.position.set(c.x + 1.5, 20, c.z);
      stadiumGroup.add(flag);
    });
  }

  createStadium();

  const PLAYER_MASK = [
    ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011100111110000000','00011100111111111111','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000011100','00011100000000011100','01111100000000000000','01110000000000000000','01110000000000000000'],
  ];


  const players: any[] = [];
  function addPlayer(
    x: number,
    z: number,
    team: 'A' | 'B',
    role: string,
    name: string = 'Player',
    displayRole?: string,
    statsOverride?: any,
    ratingProfile?: MLSPlayerRating | null,
  ) {
    const basePalette = team === 'A' ? teamAUniforms[teamAUniformIndex].palette : teamBUniforms[teamBUniformIndex].palette;
    const isKeeperRole = (displayRole || role) === 'GK';
    const hairKey = `${team}_${name}`;
    if (!playerHairMap.has(hairKey)) {
      playerHairMap.set(hairKey, hairChoices[Math.floor(Math.random() * hairChoices.length)]);
    }
    const playerHair = playerHairMap.get(hairKey)!;
    const palette = isKeeperRole
      ? getKeeperPaletteForTeam(team, playerHair, basePalette.visor)
      : { ...basePalette, hair: playerHair };
    const group = new THREE.Group();
    // Set group at field level (y=0.15).
    group.position.set(x, 0.15, z);
    const spriteGroup = new THREE.Group();
    spriteGroup.position.y = PLAYER_SPRITE_CENTER_Y;
    group.add(spriteGroup);
    const runFrames = PLAYER_PATTERNS.map(p => buildPlayerFrame(p, palette));
    const idleFrames = PLAYER_IDLE_PATTERNS.map(p => buildPlayerFrame(p, palette));
    runFrames.forEach(f => { f.visible = false; spriteGroup.add(f); });
    idleFrames.forEach(f => { f.visible = false; spriteGroup.add(f); });
    
    group.castShadow = true;
    group.receiveShadow = true;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const marker: THREE.Mesh | null = null;

    const controlMarkerGeo = new THREE.TorusGeometry(0.9, 0.1, 8, 32);
    const controlMarkerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const controlMarker = new THREE.Mesh(controlMarkerGeo, controlMarkerMat);
    controlMarker.rotation.x = -Math.PI / 2;
    controlMarker.position.y = 0.02;
    controlMarker.visible = false;
    group.add(controlMarker);

    const glowGeo = new THREE.SphereGeometry(0.75, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    // Glow at player center height.
    glow.position.y = PLAYER_SPRITE_CENTER_Y;
    glow.visible = false;
    group.add(glow);

    const player = {
      mesh: group,
      spriteGroup,
      runFrames,
      idleFrames,
      glow,
      team,
      role,
      displayRole: displayRole || role,
      mlsPrimaryPos: ratingProfile?.pos || null,
      mlsAltPos: ratingProfile?.altPos || [],
      name,
      aiState: 'IDLE',
      state: 'IDLE',
      frame: 0,
      animTimer: 0,
      vel: new THREE.Vector3(),
      pos: new THREE.Vector3(x, 0.15, z),
      homePos: new THREE.Vector3(x, 0.15, z),
      dir: team === 'A' ? 1 : -1,
      targetPos: new THREE.Vector3(x, 0.15, z),
      selectionMarker: marker,
      controlMarker,
      breathOffset: Math.random() * Math.PI * 2,
      saveAnimType: 'NONE' as 'NONE' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN',
      saveAnimStart: 0,
      saveAnimUntil: 0,
      tackleAnimActive: false,
      tackleAnimElapsed: 0,
      tackleAnimDuration: 0,
      tackleAnimRole: 'none' as 'none' | 'carrier' | 'tackler',
      tackleAnimDirZ: 1,
      tackleCooldown: 0,
      burstTimer: 0,
      burstCooldown: 0,
      stats: statsOverride || {
        // Physical
        speed: name === 'Tyreek Hill' ? 0.3 : (['WR', 'CB', 'FS', 'SS'].includes(role) ? 0.18 : (['RB', 'LB'].includes(role) ? 0.16 : 0.14)),
        acceleration: ['WR', 'CB', 'RB'].includes(role) ? 0.9 : (['LB', 'FS', 'SS'].includes(role) ? 0.7 : 0.5),
        agility: ['WR', 'CB'].includes(role) ? 1.2 : 1.0,
        strength: ['OL', 'DL'].includes(role) ? 0.9 : (['TE', 'LB'].includes(role) ? 0.7 : 0.4),
        jumping: ['WR', 'CB', 'FS', 'SS'].includes(role) ? 0.8 : (['TE', 'LB'].includes(role) ? 0.6 : 0.3),
        stamina: 0.8,
        
        // Offense
        catching: ['WR', 'TE'].includes(role) ? 0.9 : (['RB', 'CB', 'FS', 'SS'].includes(role) ? 0.6 : 0.2),
        routeRunning: ['WR'].includes(role) ? 0.9 : (['TE', 'RB'].includes(role) ? 0.7 : 0.2),
        blocking: ['OL'].includes(role) ? 0.9 : (['TE', 'FB'].includes(role) ? 0.7 : 0.2),
        carrying: ['RB', 'FB'].includes(role) ? 0.9 : (['WR', 'TE', 'QB'].includes(role) ? 0.7 : 0.4),
        throwPower: role === 'QB' ? 0.9 : 0.2,
        accuracy: role === 'QB' ? 0.88 : 0.2,
        
        // Defense
        tackle: role === 'LB' ? 0.8 : (role === 'DL' ? 0.7 : (['CB', 'FS', 'SS'].includes(role) ? 0.6 : 0.3)),
        breakTackle: ['RB', 'FB'].includes(role) ? 0.7 : (role === 'TE' ? 0.6 : (role === 'WR' ? 0.4 : 0.2)),
        coverage: ['CB', 'FS', 'SS'].includes(role) ? 0.9 : (role === 'LB' ? 0.6 : 0.2),
        blockShedding: ['DL', 'LB'].includes(role) ? 0.8 : (['FS', 'SS'].includes(role) ? 0.5 : 0.2),
        awareness: ['QB', 'LB', 'FS'].includes(role) ? 0.9 : 0.6
      }
    };
    players.push(player);
    scene.add(group);
    return player;
  }

  const offenseTeam: any[] = [];
  const defenseTeam: any[] = [];
  type SoccerFormationKey = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '3-4-3';
  const SOCCER_FORMATIONS: Record<SoccerFormationKey, { roles: string[]; team: Array<{ x: number; z: number }> }> = {
    '4-4-2': {
      roles: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
      team: [
        { x: 8, z: 0 }, { x: 22, z: -26 }, { x: 20, z: -8 }, { x: 20, z: 8 }, { x: 22, z: 26 },
        { x: 46, z: -26 }, { x: 44, z: -8 }, { x: 44, z: 8 }, { x: 46, z: 26 }, { x: 72, z: -10 }, { x: 72, z: 10 }
      ]
    },
    '4-3-3': {
      roles: ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LM', 'ST', 'RM'],
      team: [
        { x: 8, z: 0 }, { x: 22, z: -26 }, { x: 20, z: -8 }, { x: 20, z: 8 }, { x: 22, z: 26 },
        { x: 40, z: 0 }, { x: 50, z: -12 }, { x: 50, z: 12 }, { x: 72, z: -28 }, { x: 76, z: 0 }, { x: 72, z: 28 }
      ]
    },
    '4-2-3-1': {
      roles: ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'LM', 'CM', 'RM', 'ST'],
      team: [
        { x: 8, z: 0 }, { x: 22, z: -26 }, { x: 20, z: -8 }, { x: 20, z: 8 }, { x: 22, z: 26 },
        { x: 38, z: -10 }, { x: 38, z: 10 }, { x: 56, z: -24 }, { x: 58, z: 0 }, { x: 56, z: 24 }, { x: 78, z: 0 }
      ]
    },
    '3-5-2': {
      roles: ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'DM', 'CM', 'RM', 'ST', 'ST'],
      team: [
        { x: 8, z: 0 }, { x: 20, z: -12 }, { x: 18, z: 0 }, { x: 20, z: 12 },
        { x: 40, z: -28 }, { x: 44, z: -10 }, { x: 42, z: 0 }, { x: 44, z: 10 }, { x: 40, z: 28 },
        { x: 72, z: -8 }, { x: 72, z: 8 }
      ]
    },
    '3-4-3': {
      roles: ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LM', 'ST', 'RM'],
      team: [
        { x: 8, z: 0 }, { x: 20, z: -12 }, { x: 18, z: 0 }, { x: 20, z: 12 },
        { x: 42, z: -24 }, { x: 44, z: -8 }, { x: 44, z: 8 }, { x: 42, z: 24 },
        { x: 72, z: -28 }, { x: 76, z: 0 }, { x: 72, z: 28 }
      ]
    },
  };
  const activeTeamFormations: Record<'A' | 'B', SoccerFormationKey> = {
    A: '4-2-3-1',
    B: '4-3-3',
  };

  function getSoccerRoleArchetype(displayRole: string) {
    switch (displayRole) {
      case 'GK': return 'QB';
      case 'LB':
      case 'RB':
      case 'CB': return 'CB';
      case 'DM':
      case 'CM': return 'LB';
      case 'LM':
      case 'RM': return 'WR';
      case 'ST': return 'RB';
      default: return 'CM';
    }
  }

  function toSoccerFieldPosition(slot: { x: number; z: number }, attackRight: boolean) {
    const x = attackRight
      ? -FIELD_W / 2 + (slot.x / 120) * FIELD_W
      : FIELD_W / 2 - (slot.x / 120) * FIELD_W;
    const z = (slot.z / 80) * FIELD_D;
    return { x, z };
  }

  function getEligibleReceivers() {
    return offenseTeam.filter(p => ['LM', 'RM', 'CM', 'ST'].includes(p.displayRole || p.role));
  }

  function getPassTargets() {
    const carrierTeam: 'A' | 'B' = ballState.heldBy?.team || gameState.offensiveTeam;
    const teamPlayers = players.filter((p: any) => p.team === carrierTeam);
    const targets = teamPlayers.filter((p: any) => p !== ballState.heldBy && !isGoalkeeper(p));
    return targets.length > 0 ? targets : teamPlayers;
  }

  // Switch the human-controlled Team A player to the given player (unless manually overriding)
  function autoSelectTeamA(player: any) {
    if (!player || player.team !== 'A' || isGoalkeeper(player)) return;
    const teamAField = players.filter((p: any) => p.team === 'A' && !isGoalkeeper(p));
    const idx = teamAField.indexOf(player);
    if (idx >= 0) {
      gameState.humanPlayerIndex = idx;
      gameState.manualSelectCooldown = 0; // clear manual lock so next auto can take over naturally
    }
  }

  function getSelectedPassTarget() {
    const targets = getPassTargets();
    if (targets.length === 0) return null;
    if (gameState.selectedReceiverIndex >= targets.length) {
      gameState.selectedReceiverIndex = targets.length - 1;
    }
    return targets[gameState.selectedReceiverIndex] || null;
  }

  function updateDribbleBallPosition(holder: any, elapsed: number) {
    const travel = holder.vel.clone();
    travel.y = 0;
    const speed = travel.length();
    if (speed > 0.15) {
      travel.normalize();
    } else {
      travel.set(holder.dir || 1, 0, 0).normalize();
    }

    const lateral = new THREE.Vector3(-travel.z, 0, travel.x);
    const cadence = elapsed * 10.0;
    const push = THREE.MathUtils.lerp(0.35, 0.65, Math.min(speed / 7.0, 1));
    const sway = speed > 0.2 ? Math.sin(cadence) * 0.16 : 0;
    const lift = speed > 0.2 ? Math.abs(Math.sin(cadence * 0.5)) * 0.04 : 0;

    const target = holder.pos.clone()
      .addScaledVector(travel, push)
      .addScaledVector(lateral, sway);
    target.y = 0.18 + lift;

    const keeperHandsControl = isGoalkeeper(holder) && !gameState.goalKickInProgress && isInsideOwnPenaltyArea(holder, holder.pos);
    if (keeperHandsControl) {
      target.copy(holder.pos).addScaledVector(travel, 0.28);
      target.y = 0.58;
    }

    if (elapsed < ballState.attachUntil) {
      const blendT = THREE.MathUtils.clamp(1 - (ballState.attachUntil - elapsed) / 0.11, 0, 1);
      ballState.pos.copy(ballState.attachFrom).lerp(target, blendT);
    } else {
      ballState.pos.copy(target);
    }
  }

  function triggerGoalkeeperSaveAnimation(keeper: any, elapsed: number) {
    if (!keeper) return;
    const keeperFacingRight = (keeper.dir || 1) > 0;
    const lateral = ballState.pos.z - keeper.pos.z;
    const lateralFromKeeperRight = lateral * (keeperFacingRight ? -1 : 1);
    const height = ballState.pos.y;

    let saveType: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
    if (height > 1.55) {
      saveType = 'UP';
    } else if (height < 0.52 && Math.abs(lateral) < 1.05) {
      saveType = 'DOWN';
    } else {
      saveType = lateralFromKeeperRight >= 0 ? 'RIGHT' : 'LEFT';
    }

    keeper.saveAnimType = saveType;
    keeper.saveAnimStart = elapsed;
    keeper.saveAnimUntil = elapsed + 0.38;
    gameState.saveSlowmoUntil = Math.max(gameState.saveSlowmoUntil, elapsed + SAVE_SLOWMO_DURATION);
  }

  function getGoalkeeperSavePose(player: any, elapsed: number) {
    if (!player || player.saveAnimType === 'NONE' || elapsed >= player.saveAnimUntil) {
      return { offsetX: 0, offsetY: 0, rotZ: 0, scaleXMul: 1, scaleYMul: 1 };
    }

    const duration = Math.max(0.001, player.saveAnimUntil - player.saveAnimStart);
    const t = THREE.MathUtils.clamp((elapsed - player.saveAnimStart) / duration, 0, 1);
    const arc = Math.sin(t * Math.PI);

    switch (player.saveAnimType) {
      case 'LEFT':
        return { offsetX: -0.34 * arc, offsetY: 0.06 * arc, rotZ: 0.95 * arc, scaleXMul: 1.04, scaleYMul: 0.94 };
      case 'RIGHT':
        return { offsetX: 0.34 * arc, offsetY: 0.06 * arc, rotZ: -0.95 * arc, scaleXMul: 1.04, scaleYMul: 0.94 };
      case 'UP':
        return { offsetX: 0, offsetY: 0.28 * arc, rotZ: 0, scaleXMul: 0.96, scaleYMul: 1.2 };
      case 'DOWN':
        return { offsetX: 0, offsetY: -0.11 * arc, rotZ: 0, scaleXMul: 1.12, scaleYMul: 0.86 };
      default:
        return { offsetX: 0, offsetY: 0, rotZ: 0, scaleXMul: 1, scaleYMul: 1 };
    }
  }

  const TACKLE_ANIM_CARRIER_DURATION = 0.46;
  const TACKLE_ANIM_TACKLER_DURATION = 0.38;

  function snapToGrid(value: number, step: number) {
    if (step <= 0) return value;
    return Math.round(value / step) * step;
  }

  function triggerTacklePoseAnimation(carrier: any, tackler: any) {
    if (!carrier || !tackler || carrier === tackler) return;

    const hitVector = new THREE.Vector3().subVectors(carrier.pos, tackler.pos);
    hitVector.y = 0;
    if (hitVector.lengthSq() > 0.000001) {
      hitVector.normalize();
    }
    const sideSign = hitVector.z >= 0 ? 1 : -1;

    carrier.tackleAnimActive = true;
    carrier.tackleAnimElapsed = 0;
    carrier.tackleAnimDuration = TACKLE_ANIM_CARRIER_DURATION;
    carrier.tackleAnimRole = 'carrier';
    carrier.tackleAnimDirZ = sideSign;

    tackler.tackleAnimActive = true;
    tackler.tackleAnimElapsed = 0;
    tackler.tackleAnimDuration = TACKLE_ANIM_TACKLER_DURATION;
    tackler.tackleAnimRole = 'tackler';
    tackler.tackleAnimDirZ = -sideSign;
  }

  function getTacklePose(player: any, dt: number) {
    if (!player?.tackleAnimActive) {
      return { y: 0, rotX: 0, rotY: 0, rotZ: 0 };
    }

    player.tackleAnimElapsed += dt;
    const animDuration = Math.max(player.tackleAnimDuration || 0, 0.000001);
    const animT = THREE.MathUtils.clamp(player.tackleAnimElapsed / animDuration, 0, 1);
    const impact = Math.sin(Math.PI * THREE.MathUtils.clamp(animT * 1.55, 0, 1));
    const collapse = THREE.MathUtils.smoothstep(animT, 0.1, 0.86);
    const sideSign = player.tackleAnimDirZ >= 0 ? 1 : -1;

    let y = 0;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;

    if (player.tackleAnimRole === 'carrier') {
      y = -0.08 * impact - 0.2 * collapse;
      rotX = -0.22 * impact - 0.5 * collapse;
      rotZ = 0.34 * sideSign * collapse;
      rotY = 0.14 * sideSign * impact;
    } else if (player.tackleAnimRole === 'tackler') {
      const recover = 1 - THREE.MathUtils.smoothstep(animT, 0.22, 0.9);
      y = -0.06 * impact * recover;
      rotX = -0.28 * impact * recover;
      rotZ = 0.12 * sideSign * impact * recover;
      rotY = -0.08 * sideSign * impact * recover;
    }

    if (animT >= 1) {
      player.tackleAnimActive = false;
      player.tackleAnimRole = 'none';
      player.tackleAnimElapsed = 0;
      player.tackleAnimDuration = 0;
    }

    return { y, rotX, rotY, rotZ };
  }

  function getGroundPassTargetPosition(target: any) {
    const lead = target.pos.clone().addScaledVector(target.vel, 0.35);
    lead.y = 0.15;
    return lead;
  }

  function executeAIGroundPass(
    passer: any,
    target: any,
    elapsed: number,
    options?: {
      style?: 'SHORT' | 'DRIVEN' | 'OUTSIDE' | 'BACK' | 'DIAGONAL' | 'WALL';
      receiverWindow?: number;
    }
  ) {
    if (!passer || !target || passer === target) return;
    const weather = getActiveWeatherPreset();
    const passSkill = getPassSkill(passer);
    const style = options?.style || 'SHORT';
    const nearbyOppPressure = players
      .filter((p: any) => p.team !== passer.team && !isGoalkeeper(p) && p.pos.distanceTo(passer.pos) < 5.8)
      .length;
    const targetPos = getGroundPassTargetPosition(target);
    const dir = new THREE.Vector3().subVectors(targetPos, passer.pos);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.1) return;

    dir.normalize();
    let angleErrorBase = THREE.MathUtils.lerp(0.22, 0.03, passSkill) + nearbyOppPressure * 0.035;
    let speedMultiplier = 1.0;
    let receiverWindow = options?.receiverWindow ?? 2.0;

    switch (style) {
      case 'DRIVEN':
        angleErrorBase *= 0.78;
        speedMultiplier = 1.22;
        receiverWindow = options?.receiverWindow ?? 1.8;
        break;
      case 'OUTSIDE':
        angleErrorBase *= 0.9;
        speedMultiplier = 1.06;
        receiverWindow = options?.receiverWindow ?? 1.95;
        break;
      case 'BACK':
        angleErrorBase *= 0.62;
        speedMultiplier = 0.94;
        receiverWindow = options?.receiverWindow ?? 2.2;
        break;
      case 'DIAGONAL':
        angleErrorBase *= 0.74;
        speedMultiplier = 1.12;
        receiverWindow = options?.receiverWindow ?? 2.2;
        break;
      case 'WALL':
        angleErrorBase *= 0.5;
        speedMultiplier = 0.98;
        receiverWindow = options?.receiverWindow ?? 1.35;
        break;
      case 'SHORT':
      default:
        break;
    }

    const angleError = (Math.random() * 2 - 1) * angleErrorBase;
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleError);
    const powerScale = THREE.MathUtils.lerp(0.9, 1.08, passSkill) * THREE.MathUtils.lerp(1.0, 0.94, Math.min(nearbyOppPressure, 3) / 3);
    const distNorm = THREE.MathUtils.clamp((dist - 4) / 24, 0, 1);
    const baseSpeed = THREE.MathUtils.lerp(4.4, 12.6, distNorm);
    const speed = THREE.MathUtils.clamp(baseSpeed * powerScale * speedMultiplier, 4.6, 15.8) * GAME_SPEED_SCALE * weather.passSpeedMul;
    ballState.lastHeldBy = passer;
    ballState.heldBy = null;
    if (gameState.goalKickInProgress) gameState.goalKickInProgress = false;
    ballState.isFlying = false;
    ballState.isRolling = true;
    ballState.isShot = false;
    ballState.receiveLockUntil = elapsed + 0.2;
    setIntendedReceiver(target, passer.team, elapsed, receiverWindow);
    ballState.vel.copy(dir.multiplyScalar(speed));
    ballState.pos.copy(passer.pos).addScaledVector(dir, 0.45);
    ballState.pos.y = BALL_GROUND_Y;
    ballState.possessionLockUntil = elapsed + 0.22;
    sounds.throw();

    if (style !== 'SHORT') {
      const label =
        style === 'WALL' ? 'WALL PASS' :
        style === 'OUTSIDE' ? 'OUTSIDE FOOT PASS' :
        style === 'DIAGONAL' ? 'DIAGONAL PASS' :
        style === 'BACK' ? 'BACK PASS' :
        style === 'DRIVEN' ? 'DRIVEN PASS' :
        'PASS';
      showPlayPatternTag(label, 'rgba(144,214,255,0.96)');
    }
  }

  function executeAILoftedPass(
    passer: any,
    target: any,
    elapsed: number,
    style: 'LONG_LOFTED' | 'LONG_DRIVEN' = 'LONG_LOFTED'
  ) {
    if (!passer || !target || passer === target) return;
    const weather = getActiveWeatherPreset();
    const passSkill = getPassSkill(passer);
    const targetPos = getGroundPassTargetPosition(target);
    const dir = new THREE.Vector3().subVectors(targetPos, passer.pos);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.1) return;

    dir.normalize();
    const baseError = style === 'LONG_LOFTED' ? THREE.MathUtils.lerp(0.2, 0.06, passSkill) : THREE.MathUtils.lerp(0.16, 0.045, passSkill);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() * 2 - 1) * baseError);

    ballState.lastHeldBy = passer;
    ballState.heldBy = null;
    if (gameState.goalKickInProgress) gameState.goalKickInProgress = false;
    ballState.isFlying = true;
    ballState.isRolling = false;
    ballState.isShot = false;
    ballState.receiveLockUntil = elapsed + 0.16;
    setIntendedReceiver(target, passer.team, elapsed, style === 'LONG_LOFTED' ? 2.8 : 2.2);
    ballState.pos.copy(passer.pos).addScaledVector(dir, 0.46);
    ballState.pos.y = 0.24;

    const distNorm = THREE.MathUtils.clamp((dist - 12) / 34, 0, 1);
    const horizSpeed = (style === 'LONG_LOFTED'
      ? THREE.MathUtils.lerp(10.5, 16.8, distNorm)
      : THREE.MathUtils.lerp(12.2, 18.2, distNorm)
    ) * GAME_SPEED_SCALE * weather.passSpeedMul;
    ballState.vel.copy(dir.multiplyScalar(horizSpeed));
    ballState.vel.y = style === 'LONG_LOFTED'
      ? THREE.MathUtils.clamp(3.9 + dist * 0.045, 3.9, 7.8)
      : THREE.MathUtils.clamp(1.8 + dist * 0.02, 1.8, 3.8);
    ballState.possessionLockUntil = elapsed + 0.2;

    const attackRight = teamAttacksRight(passer.team);
    const targetInAttackingBox = attackRight
      ? target.pos.x >= rightPenaltyX - 1.0
      : target.pos.x <= leftPenaltyX + 1.0;
    const targetInCentralBoxLane = Math.abs(target.pos.z) <= penaltyHalfZ * 0.92;
    const passerInWideChannel = Math.abs(passer.pos.z) >= goalMouthWidth * 0.92;
    const passerInAttackingHalf = attackRight ? passer.pos.x > 0 : passer.pos.x < 0;
    const forwardProgress = (target.pos.x - passer.pos.x) * (attackRight ? 1 : -1);
    const isCrossDelivery =
      style === 'LONG_LOFTED' &&
      passerInWideChannel &&
      passerInAttackingHalf &&
      targetInAttackingBox &&
      targetInCentralBoxLane &&
      forwardProgress > 1.5;

    if (isCrossDelivery) {
      gameState.crossAssistTeam = passer.team;
      gameState.crossAssistUntil = elapsed + 2.4;
    }

    sounds.throw();
    showPlayPatternTag(style === 'LONG_LOFTED' ? 'LONG LOFTED PASS' : 'LONG DRIVEN PASS', 'rgba(144,214,255,0.96)');
  }

  function executeAIKeeperKick(
    keeper: any,
    target: any,
    elapsed: number,
    style: 'GOAL_KICK_STANDARD' | 'PUNT' | 'DROP_KICK' | 'SIDEWINDER' | 'DRIVEN_KICK'
  ) {
    if (!keeper || !target) return false;

    const weather = getActiveWeatherPreset();
    const kickDir = new THREE.Vector3().subVectors(target.pos, keeper.pos);
    kickDir.y = 0;
    if (kickDir.lengthSq() < 0.01) {
      kickDir.set(teamAttacksRight(keeper.team) ? 1 : -1, 0, 0);
    }

    const kickDist = Math.max(keeper.pos.distanceTo(target.pos), 1);
    kickDir.normalize();
    ballState.lastHeldBy = keeper;
    ballState.heldBy = null;
    ballState.keeperDistributor = keeper;
    gameState.goalKickInProgress = false;
    ballState.isFlying = true;
    ballState.isRolling = false;
    ballState.isShot = false;
    ballState.shotByTeam = null;
    ballState.receiveLockUntil = elapsed + 0.18;
    ballState.possessionLockUntil = elapsed + 0.2;

    let speed = 0;
    let lift = 0;
    let releaseHeight = 0.24;
    let angleError = 0;
    let tag = 'KEEPER KICK';
    let intendedWindow = 0;

    switch (style) {
      case 'GOAL_KICK_STANDARD':
        speed = THREE.MathUtils.clamp(19.5 + kickDist * 0.24, 19.5, 28.5) * GAME_SPEED_SCALE * weather.kickSpeedMul;
        lift = THREE.MathUtils.clamp(4.8 + kickDist * 0.045, 4.8, 8.4);
        releaseHeight = BALL_GROUND_Y;
        angleError = 0.03;
        tag = 'GOAL KICK';
        intendedWindow = 2.6;
        break;
      case 'PUNT':
        {
          const keeperKickStrength = THREE.MathUtils.clamp(keeper.stats?.throwPower ?? 0.62, 0.2, 1.0);
          const puntStrengthMul = THREE.MathUtils.lerp(1.04, 1.2, keeperKickStrength);
          speed = THREE.MathUtils.clamp(25.5 + kickDist * 0.34, 27.0, 38.0) * GAME_SPEED_SCALE * weather.kickSpeedMul * puntStrengthMul;
          lift = THREE.MathUtils.clamp(7.4 + kickDist * 0.055, 7.4, 11.8);
        }
        releaseHeight = 0.72;
        angleError = 0.08;
        tag = 'PUNT';
        intendedWindow = 0;
        break;
      case 'DROP_KICK':
        speed = THREE.MathUtils.clamp(19.0 + kickDist * 0.24, 19.0, 28.0) * GAME_SPEED_SCALE * weather.kickSpeedMul;
        lift = THREE.MathUtils.clamp(3.2 + kickDist * 0.03, 3.2, 5.8);
        releaseHeight = 0.17;
        angleError = 0.04;
        tag = 'DROP KICK';
        intendedWindow = 2.2;
        break;
      case 'SIDEWINDER':
        speed = THREE.MathUtils.clamp(17.8 + kickDist * 0.21, 17.8, 24.0) * GAME_SPEED_SCALE * weather.kickSpeedMul;
        lift = THREE.MathUtils.clamp(2.1 + kickDist * 0.018, 2.1, 3.8);
        releaseHeight = 0.34;
        angleError = 0.02;
        tag = 'SIDEWINDER';
        intendedWindow = 2.4;
        break;
      case 'DRIVEN_KICK':
      default:
        speed = THREE.MathUtils.clamp(16.5 + kickDist * 0.18, 16.5, 23.5) * GAME_SPEED_SCALE * weather.kickSpeedMul;
        lift = THREE.MathUtils.clamp(1.3 + kickDist * 0.01, 1.3, 2.3);
        releaseHeight = BALL_GROUND_Y;
        angleError = 0.025;
        tag = 'DRIVEN KICK';
        intendedWindow = 2.0;
        break;
    }

    if (angleError > 0) {
      kickDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() * 2 - 1) * angleError);
    }

    ballState.pos.copy(keeper.pos).addScaledVector(kickDir, style === 'PUNT' ? 0.34 : 0.52);
    ballState.pos.y = releaseHeight;
    ballState.vel.copy(kickDir.multiplyScalar(speed));
    ballState.vel.y = lift;

    if (intendedWindow > 0) {
      setIntendedReceiver(target, keeper.team, elapsed, intendedWindow);
    } else {
      clearIntendedReceiver();
    }

    showPlayPatternTag(tag, 'rgba(146,220,255,0.96)');
    sounds.throw();
    return true;
  }

  function getClosestOpponentDistance(pos: THREE.Vector3, team: 'A' | 'B') {
    const opponents = players.filter((p: any) => p.team !== team && !isGoalkeeper(p));
    if (opponents.length === 0) return 99;
    let minDist = 99;
    opponents.forEach((opp: any) => {
      const d = opp.pos.distanceTo(pos);
      if (d < minDist) minDist = d;
    });
    return minDist;
  }

  function distancePointToSegmentXZ(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const apx = point.x - a.x;
    const apz = point.z - a.z;
    const abLenSq = abx * abx + abz * abz;
    if (abLenSq < 0.0001) {
      const dx = point.x - a.x;
      const dz = point.z - a.z;
      return Math.sqrt(dx * dx + dz * dz);
    }
    const t = THREE.MathUtils.clamp((apx * abx + apz * abz) / abLenSq, 0, 1);
    const cx = a.x + abx * t;
    const cz = a.z + abz * t;
    const dx = point.x - cx;
    const dz = point.z - cz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function getPassLanePressure(from: THREE.Vector3, to: THREE.Vector3, team: 'A' | 'B') {
    const opponents = players.filter((p: any) => p.team !== team && !isGoalkeeper(p));
    if (opponents.length === 0) return 0;
    let pressure = 0;
    opponents.forEach((opp: any) => {
      const d = distancePointToSegmentXZ(opp.pos, from, to);
      if (d < 2.2) pressure += 1.25;
      else if (d < 3.4) pressure += 0.55;
    });
    return pressure;
  }

  function getPassSkill(player: any) {
    if (!player?.stats) return 0.5;
    return THREE.MathUtils.clamp(
      player.stats.accuracy * 0.48 + player.stats.routeRunning * 0.28 + player.stats.throwPower * 0.24,
      0.15,
      0.98,
    );
  }

  function getDribbleSkill(player: any) {
    if (!player?.stats) return 0.5;
    return THREE.MathUtils.clamp(
      player.stats.carrying * 0.5 + player.stats.agility * 0.28 + player.stats.acceleration * 0.22,
      0.15,
      0.98,
    );
  }

  function getShotSkill(player: any) {
    if (!player?.stats) return 0.5;
    return THREE.MathUtils.clamp(
      player.stats.accuracy * 0.5 + player.stats.throwPower * 0.32 + player.stats.awareness * 0.18,
      0.15,
      0.98,
    );
  }

  function chooseAIShotStyle(
    shooter: any,
    closePressure: number,
    distToGoal: number,
    inShootingLane: boolean,
    inTapInZone: boolean,
  ) {
    const wideAngle = Math.abs(shooter?.pos?.z || 0) > goalMouthWidth * 0.42;
    const roll = Math.random();
    const nowSec = performance.now() / 1000;
    const crossWindow = gameState.crossAssistTeam === shooter.team && nowSec <= gameState.crossAssistUntil;

    if (crossWindow && distToGoal < 16 && Math.abs(shooter?.pos?.z || 0) < goalMouthWidth * 1.7) {
      if (roll < 0.44) return 'HEADER';
      if (roll < 0.76) return 'VOLLEY';
      return 'HALF_VOLLEY';
    }

    if (inTapInZone && closePressure >= 2 && roll < 0.38) return 'TOE_POKE';
    if (inTapInZone && roll < 0.18) return 'CHIP';
    if (inTapInZone && roll < 0.22) return 'PLACED';

    if (distToGoal > 23 && closePressure <= 1) {
      return roll < 0.65 ? 'LACES_DRIVE' : 'CURLED';
    }

    if (wideAngle && distToGoal < 24 && roll < 0.52) return 'CURLED';
    if (distToGoal < 15 && inShootingLane && closePressure <= 2 && roll < 0.34) return 'PLACED';
    if (distToGoal < 18 && closePressure >= 2 && roll < 0.08) return 'VOLLEY';
    if (distToGoal < 20 && closePressure >= 1 && roll < 0.06) return 'HALF_VOLLEY';

    return inShootingLane ? 'LACES_DRIVE' : 'PLACED';
  }

  function getRoleDecisionProfile(player: any) {
    const label = (player?.displayRole || player?.role || 'CM') as string;
    let base: { progressivePass: number; dribbleIntent: number; shootBias: number; shotRange: number };

    switch (label) {
      case 'LB':
      case 'RB':
        base = { progressivePass: 0.4, dribbleIntent: 0.45, shootBias: -0.16, shotRange: 12 };
        break;
      case 'CB':
      case 'GK':
        base = { progressivePass: 0.25, dribbleIntent: 0.28, shootBias: -0.3, shotRange: 8 };
        break;
      case 'DM':
        base = { progressivePass: 0.5, dribbleIntent: 0.42, shootBias: -0.1, shotRange: 13 };
        break;
      case 'CM':
        base = { progressivePass: 0.62, dribbleIntent: 0.55, shootBias: 0.02, shotRange: 15 };
        break;
      case 'LM':
      case 'RM':
        base = { progressivePass: 0.66, dribbleIntent: 0.72, shootBias: 0.07, shotRange: 16 };
        break;
      case 'ST':
        base = { progressivePass: 0.52, dribbleIntent: 0.68, shootBias: 0.2, shotRange: 19 };
        break;
      default:
        base = { progressivePass: 0.58, dribbleIntent: 0.56, shootBias: 0, shotRange: 15 };
        break;
    }

    const posBag = [player?.mlsPrimaryPos, ...(Array.isArray(player?.mlsAltPos) ? player.mlsAltPos : [])]
      .filter(Boolean)
      .map((p: string) => p.toUpperCase());

    if (posBag.includes('CAM')) {
      base.progressivePass += 0.15;
      base.dribbleIntent += 0.11;
      base.shootBias += 0.08;
      base.shotRange += 2;
    }
    if (posBag.includes('CF')) {
      base.progressivePass += 0.1;
      base.dribbleIntent += 0.08;
      base.shootBias += 0.13;
      base.shotRange += 2;
    }
    if (posBag.includes('RW') || posBag.includes('LW')) {
      base.progressivePass += 0.06;
      base.dribbleIntent += 0.16;
      base.shootBias += 0.1;
      base.shotRange += 1;
    }
    if (posBag.includes('RM') || posBag.includes('LM')) {
      base.progressivePass += 0.07;
      base.dribbleIntent += 0.11;
      base.shootBias += 0.04;
    }
    if (posBag.includes('CDM')) {
      base.progressivePass += 0.06;
      base.dribbleIntent -= 0.09;
      base.shootBias -= 0.13;
      base.shotRange -= 2;
    }
    if (posBag.includes('CM')) {
      base.progressivePass += 0.03;
      base.dribbleIntent += 0.04;
    }
    if (posBag.includes('LWB') || posBag.includes('RWB')) {
      base.progressivePass += 0.08;
      base.dribbleIntent += 0.08;
      base.shootBias -= 0.04;
    }
    if (posBag.includes('ST')) {
      base.shootBias += 0.08;
      base.shotRange += 2;
    }
    if (posBag.includes('CB')) {
      base.progressivePass -= 0.08;
      base.dribbleIntent -= 0.1;
      base.shootBias -= 0.12;
      base.shotRange -= 3;
    }

    return {
      progressivePass: THREE.MathUtils.clamp(base.progressivePass, 0.2, 0.92),
      dribbleIntent: THREE.MathUtils.clamp(base.dribbleIntent, 0.2, 0.94),
      shootBias: THREE.MathUtils.clamp(base.shootBias, -0.36, 0.34),
      shotRange: THREE.MathUtils.clamp(base.shotRange, 8, 22),
    };
  }

  function chooseAIPassTarget(carrier: any, teammates: any[], team: 'A' | 'B', attackSign: number) {
    if (!carrier || teammates.length === 0) return null;
    let bestTarget: any = null;
    let bestScore = -Infinity;
    const passSkill = getPassSkill(carrier);
    const roleProfile = getRoleDecisionProfile(carrier);
    const progressiveBlend = passSkill * 0.62 + roleProfile.progressivePass * 0.38;
    const idealDist = THREE.MathUtils.lerp(9.5, 19.0, progressiveBlend);
    const progressWeight = THREE.MathUtils.lerp(0.34, 0.72, progressiveBlend);
    const spaceWeight = THREE.MathUtils.lerp(0.82, 0.58, progressiveBlend);
    const lanePenaltyScale = THREE.MathUtils.lerp(3.2, 1.55, passSkill);

    teammates.forEach((candidate: any) => {
      const passDist = carrier.pos.distanceTo(candidate.pos);
      if (passDist < 4.0) return;
      const progress = (candidate.pos.x - carrier.pos.x) * attackSign;
      const lanePressure = getPassLanePressure(carrier.pos, candidate.pos, team);
      const supportSpace = getClosestOpponentDistance(candidate.pos, team);
      const preferredDistPenalty = Math.abs(passDist - idealDist) * THREE.MathUtils.lerp(0.14, 0.07, passSkill);
      const receiverSkill = THREE.MathUtils.clamp(
        (candidate.stats?.routeRunning || 0.5) * 0.6 + (candidate.stats?.carrying || 0.5) * 0.4,
        0.1,
        1,
      );
      const candidateRole = candidate.displayRole || candidate.role;
      const carrierRole = carrier.displayRole || carrier.role;
      const movingForward = candidate.vel.dot(new THREE.Vector3(attackSign, 0, 0)) > 0.35;
      const isWideRunner = (candidateRole === 'LM' || candidateRole === 'RM') && Math.abs(candidate.pos.z) > FIELD_D * 0.22;
      const diagonalRunBonus = movingForward && progress > 2.5 && Math.abs(candidate.pos.z - carrier.pos.z) > 5.5 ? 1.25 : 0;
      const widthStretchBonus = isWideRunner && progress >= 0 ? 1.35 : 0;
      // ST dropping in to combine (wall pass) before spinning forward.
      const wallPassBonus = carrierRole === 'ST' && passDist < 11 && progress < 0.8 && progress > -7 ? 1.6 : 0;
      const score =
        progress * progressWeight +
        supportSpace * spaceWeight -
        lanePressure * lanePenaltyScale -
        preferredDistPenalty +
        receiverSkill * 1.15 +
        diagonalRunBonus +
        widthStretchBonus +
        wallPassBonus;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = candidate;
      }
    });

    return bestTarget;
  }

  function chooseAIDribbleTarget(carrier: any, team: 'A' | 'B', attackSign: number, carryBias: number) {
    const dribbleSkill = getDribbleSkill(carrier);
    const roleProfile = getRoleDecisionProfile(carrier);
    const forwardBlend = dribbleSkill * 0.64 + roleProfile.dribbleIntent * 0.36;
    const forwardBias = THREE.MathUtils.lerp(4.6, 10.8, forwardBlend);
    const targetX = THREE.MathUtils.clamp(
      carrier.pos.x + attackSign * THREE.MathUtils.clamp(carryBias * 0.7 + forwardBias * 0.3, 5.2, 10.8),
      -FIELD_W / 2 + 1.2,
      FIELD_W / 2 - 1.2,
    );
    const laneSamples = [-24, -16, -9, -3, 3, 9, 16, 24];
    let bestTarget = new THREE.Vector3(targetX, 0.15, THREE.MathUtils.clamp(carrier.pos.z * 0.55, -FIELD_D * 0.42, FIELD_D * 0.42));
    let bestScore = -Infinity;

    laneSamples.forEach((sampleZ) => {
      const z = THREE.MathUtils.clamp(carrier.pos.z * 0.42 + sampleZ * 0.58, -FIELD_D / 2 + 2, FIELD_D / 2 - 2);
      const candidate = new THREE.Vector3(targetX, 0.15, z);
      const nearestOpp = getClosestOpponentDistance(candidate, team);
      const lanePressure = getPassLanePressure(carrier.pos, candidate, team);
      const centerPenalty = Math.max(0, 4 - Math.abs(z) * 0.5);
      const score =
        nearestOpp * THREE.MathUtils.lerp(0.9, 1.2, dribbleSkill) -
        lanePressure * THREE.MathUtils.lerp(3.05, 1.75, dribbleSkill) -
        centerPenalty * THREE.MathUtils.lerp(1.2, 0.7, dribbleSkill);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = candidate;
      }
    });

    return bestTarget;
  }

  function setCPUTeamDecisionCooldown(team: 'A' | 'B', seconds: number) {
    const key = team === 'A' ? 'cpuDecisionCooldownA' : 'cpuDecisionCooldownB';
    (gameState as any)[key] = Math.max((gameState as any)[key], seconds);
  }

  function tryGoalkeeperHandsClaim(elapsed: number) {
    if (ballState.heldBy) return null;
    if (!ballState.isFlying && !ballState.isRolling) return null;
    if (elapsed < ballState.receiveLockUntil) return null;

    const claimRadius = ballState.isFlying ? 2.05 : 1.78;
    let bestKeeper: any = null;
    let bestDist = Infinity;

    for (const p of players) {
      if (!isGoalkeeper(p)) continue;
      if (!isInsideOwnPenaltyArea(p, ballState.pos)) continue;
      if (ballState.keeperDistributor === p) continue;
      const dist = p.pos.distanceTo(ballState.pos);
      if (dist < claimRadius && dist < bestDist) {
        bestKeeper = p;
        bestDist = dist;
      }
    }

    if (!bestKeeper) return null;

    const wasShot = ballState.isShot;
    const shootingTeam = ballState.shotByTeam;
    ballState.isFlying = false;
    ballState.isRolling = false;
    ballState.isShot = false;
    ballState.shotByTeam = null;
    ballState.heldBy = bestKeeper;
    ballState.lastHeldBy = bestKeeper;
    ballState.vel.set(0, 0, 0);
    ballState.pos.copy(bestKeeper.pos);
    ballState.pos.y = 0.58;
    const keeperHoldSeconds = 1.2 + Math.random() * 2.2;
    ballState.possessionLockUntil = elapsed + keeperHoldSeconds + 0.65;
    clearIntendedReceiver();
    markKickoffTouch(bestKeeper);
    soccerRestart.lastTouchTeam = bestKeeper.team;
    // Keepers should distribute promptly after claiming in hands.
    setCPUTeamDecisionCooldown(bestKeeper.team, keeperHoldSeconds);
    if (wasShot && shootingTeam) {
      recordShotOnTarget(shootingTeam);
      recordSave(bestKeeper.team);
      triggerGoalkeeperSaveAnimation(bestKeeper, elapsed);
      gameState.message = 'SAVE!';
    }
    sounds.catch();

    return bestKeeper;
  }

  function takeShot(
    shooter: any,
    skillDriven: boolean = false,
    shotPower: number = 1.0,
    requestedStyle:
      | 'AUTO'
      | 'LACES_DRIVE'
      | 'PLACED'
      | 'CHIP'
      | 'VOLLEY'
      | 'HALF_VOLLEY'
      | 'CURLED'
      | 'TOE_POKE'
      | 'HEADER' = 'AUTO',
  ) {
    if (!shooter) return;
    clearIntendedReceiver();
    recordShot(shooter.team);

    const weather = getActiveWeatherPreset();
    const powerScale = skillDriven ? THREE.MathUtils.lerp(0.92, 1.15, shooter.stats?.throwPower || 0.5) : shotPower;

    // CPU shots use the established shot solution used by the preview arc.
    if (skillDriven) {
      const shotSkill = getShotSkill(shooter);
      const opponents = players.filter((p: any) => p.team !== shooter.team && !isGoalkeeper(p));
      const closePressure = opponents.filter((opp: any) => opp.pos.distanceTo(shooter.pos) < 5.8).length;
      const composure = THREE.MathUtils.clamp(shotSkill - closePressure * cpuShotPressureError, 0.12, 0.98);
      const attackRight = teamAttacksRight(shooter.team);
      const goalX = attackRight ? FIELD_W / 2 : -FIELD_W / 2;
      const distToGoal = Math.abs(goalX - shooter.pos.x);
      const inShootingLane = Math.abs(shooter.pos.z) < goalMouthWidth * 0.78;
      const inTapInZone = distToGoal < 9.5 && Math.abs(shooter.pos.z) < goalMouthWidth * 1.1;
      const shotStyle = requestedStyle === 'AUTO'
        ? chooseAIShotStyle(shooter, closePressure, distToGoal, inShootingLane, inTapInZone)
        : requestedStyle;
      const maxAimError = THREE.MathUtils.lerp(cpuShotAimErrorRad, cpuShotAimErrorRad * 0.22, composure);
      const aimError = (Math.random() * 2 - 1) * maxAimError;

      const arc = computeShotArc(shooter, powerScale);
      const launchDir = shooter.vel.clone().setY(0);
      if (launchDir.lengthSq() < 0.01) {
        const toGoal = new THREE.Vector3(arc.targetPos.x - shooter.pos.x, 0, arc.targetPos.z - shooter.pos.z);
        if (toGoal.lengthSq() < 0.01) {
          const attackRight = teamAttacksRight(shooter.team);
          toGoal.set(attackRight ? 1 : -1, 0, 0);
        }
        launchDir.copy(toGoal);
      }
      launchDir.normalize();

      ballState.lastHeldBy = shooter;
      ballState.heldBy = null;
      ballState.receiveLockUntil = performance.now() / 1000 + 0.2;
      ballState.isRolling = false;
      ballState.isFlying = true;
      ballState.isShot = true;
      ballState.shotByTeam = shooter.team;
      ballState.pos.copy(shooter.pos).addScaledVector(launchDir, 0.48);
      ballState.pos.y = 0.24;
      ballState.vel.copy(arc.vel);

      let shotLabel = 'SHOT';
      let speedMul = 1.0;
      let liftMul = 1.0;
      let releaseY = 0.24;
      let extraCurve = 0;
      let extraAimScale = 1.0;

      switch (shotStyle) {
        case 'LACES_DRIVE':
          shotLabel = 'LACES DRIVE';
          speedMul = 1.18;
          liftMul = 0.82;
          releaseY = 0.21;
          extraAimScale = 0.82;
          break;
        case 'PLACED':
          shotLabel = 'PLACED SHOT';
          speedMul = 0.88;
          liftMul = 0.92;
          releaseY = 0.22;
          extraAimScale = 0.42;
          break;
        case 'CHIP':
          shotLabel = 'CHIPPED SHOT';
          speedMul = 0.74;
          liftMul = 1.5;
          releaseY = 0.27;
          extraAimScale = 0.64;
          break;
        case 'VOLLEY':
          shotLabel = 'VOLLEY';
          speedMul = 1.12;
          liftMul = 1.16;
          releaseY = 0.36;
          extraAimScale = 0.86;
          break;
        case 'HALF_VOLLEY':
          shotLabel = 'HALF-VOLLEY';
          speedMul = 1.06;
          liftMul = 0.9;
          releaseY = 0.18;
          extraAimScale = 0.82;
          break;
        case 'CURLED':
          shotLabel = 'CURLED SHOT';
          speedMul = 0.96;
          liftMul = 1.02;
          releaseY = 0.24;
          extraCurve = (shooter.pos.z >= 0 ? -1 : 1) * 2.15 * GAME_SPEED_SCALE;
          extraAimScale = 0.72;
          break;
        case 'TOE_POKE':
          shotLabel = 'TOE POKE';
          speedMul = 1.08;
          liftMul = 0.72;
          releaseY = 0.19;
          extraAimScale = 0.95;
          break;
        case 'HEADER':
          shotLabel = 'HEADER';
          speedMul = 0.9;
          liftMul = 0.95;
          releaseY = 0.92;
          extraAimScale = 0.5;
          break;
        default:
          break;
      }

      const horizVel = new THREE.Vector3(ballState.vel.x, 0, ballState.vel.z);
      const horizSpeed = horizVel.length();
      if (horizSpeed > 0.001) {
        horizVel.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), aimError * extraAimScale);
        ballState.vel.x = horizVel.x * horizSpeed;
        ballState.vel.z = horizVel.z * horizSpeed;
      }
      ballState.pos.y = releaseY;
      ballState.vel.x *= speedMul;
      ballState.vel.y *= liftMul;
      ballState.vel.z *= speedMul;
      ballState.vel.z += extraCurve;
      if (shotStyle === 'CHIP') {
        ballState.vel.y = Math.max(ballState.vel.y, 6.2);
      }
      if (shotStyle === 'HEADER') {
        ballState.vel.y = THREE.MathUtils.clamp(ballState.vel.y, 2.1, 4.6);
      }
      ballState.vel.x *= weather.shotSpeedMul;
      ballState.vel.z *= weather.shotSpeedMul;

      gameState.lastShotTelemetrySeq += 1;
      gameState.lastShotTelemetry = {
        seq: gameState.lastShotTelemetrySeq,
        timestamp: Date.now(),
        team: shooter.team,
        style: shotStyle,
        skillDriven: true,
        distToGoal,
        closePressure,
        inShootingLane,
        inTapInZone,
        half: matchClock.half,
        phase: matchClock.phase,
        elapsedInHalf: matchClock.elapsedInHalf,
      };

      gameState.message = 'SHOT!';
      showPlayPatternTag(shotLabel, 'rgba(255,226,146,0.97)');
      sounds.throw();
      setTimeout(() => {
        if (gameState.message === 'SHOT!') gameState.message = '';
      }, 500);
      return;
    }

    const attackRight = teamAttacksRight(shooter.team);
    const shotDirection = shooter.vel.clone().setY(0);
    if (shotDirection.lengthSq() < 0.01) {
      shotDirection.set(shooter.dir || (attackRight ? 1 : -1), 0, 0);
    }
    shotDirection.normalize();

    const goalX = attackRight ? FIELD_W / 2 : -FIELD_W / 2;
    const shotSkill = getShotSkill(shooter);
    const opponents = players.filter((p: any) => p.team !== shooter.team && !isGoalkeeper(p));
    const closePressure = opponents.filter((opp: any) => opp.pos.distanceTo(shooter.pos) < 5.8).length;
    const distToGoal = Math.abs(goalX - shooter.pos.x);
    const inShootingLane = Math.abs(shooter.pos.z) < goalMouthWidth * 0.78;
    const inTapInZone = distToGoal < 9.5 && Math.abs(shooter.pos.z) < goalMouthWidth * 1.1;
    const composure = THREE.MathUtils.clamp(shotSkill - closePressure * 0.08, 0.12, 0.98);
    const sign = shooter.pos.z >= 0 ? -1 : 1;
    const desiredCornerBias = THREE.MathUtils.lerp(0.06, 0.34, composure) * sign;
    const baseAimZ = THREE.MathUtils.clamp(
      shooter.pos.z * THREE.MathUtils.lerp(0.4, 0.18, composure) + desiredCornerBias * goalMouthWidth,
      -goalMouthWidth * 0.45,
      goalMouthWidth * 0.45,
    );
    const aimError = skillDriven ? (Math.random() * 2 - 1) * THREE.MathUtils.lerp(0.32, 0.05, composure) : 0;
    const targetZ = THREE.MathUtils.clamp(baseAimZ + aimError, -goalMouthWidth * 0.45, goalMouthWidth * 0.45);
    const targetPos = new THREE.Vector3(goalX, 1.1, targetZ);

    ballState.lastHeldBy = shooter;
    ballState.heldBy = null;
    ballState.receiveLockUntil = performance.now() / 1000 + 0.2;
    ballState.isRolling = false;
    ballState.isFlying = true;
    ballState.isShot = true;
    ballState.shotByTeam = shooter.team;
    ballState.pos.copy(shooter.pos).addScaledVector(shotDirection, 0.48);
    ballState.pos.y = 0.24;

    const dx = targetPos.x - ballState.pos.x;
    const dz = targetPos.z - ballState.pos.z;
    const distH = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    const speedH = 24 * powerScale * GAME_SPEED_SCALE * weather.shotSpeedMul;
    const time = distH / speedH;
    const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
    const liftMin = skillDriven ? THREE.MathUtils.lerp(2.6, 3.0, composure) : 2.8;
    const liftMax = skillDriven ? THREE.MathUtils.lerp(6.2, 7.3, composure) : 7.0;
    vel.y = THREE.MathUtils.clamp((targetPos.y - ballState.pos.y + 4.9 * time * time) / time, liftMin, liftMax);
    ballState.vel.copy(vel);

    gameState.lastShotTelemetrySeq += 1;
    gameState.lastShotTelemetry = {
      seq: gameState.lastShotTelemetrySeq,
      timestamp: Date.now(),
      team: shooter.team,
      style: requestedStyle === 'AUTO' ? 'MANUAL' : requestedStyle,
      skillDriven: false,
      distToGoal,
      closePressure,
      inShootingLane,
      inTapInZone,
      half: matchClock.half,
      phase: matchClock.phase,
      elapsedInHalf: matchClock.elapsedInHalf,
    };

    gameState.message = 'SHOT!';
    sounds.throw();
    setTimeout(() => {
      if (gameState.message === 'SHOT!') gameState.message = '';
    }, 500);
  }

  function getSupportRunProfile(player: any, index: number) {
    const label = player.displayRole || player.role;
    const sideBias = player.homePos.z === 0 ? 0 : Math.sign(player.homePos.z);

    switch (label) {
      case 'GK':
        return { depthBias: -24, widthBias: 0, anchorBlend: 0.18, speedScale: 0.55 };
      case 'LB':
        return { depthBias: -14, widthBias: -15, anchorBlend: 0.42, speedScale: 0.9 };
      case 'RB':
        return { depthBias: -14, widthBias: 15, anchorBlend: 0.42, speedScale: 0.9 };
      case 'CB':
        return { depthBias: -18, widthBias: sideBias * 6, anchorBlend: 0.28, speedScale: 0.78 };
      case 'DM':
        return { depthBias: -10, widthBias: 0, anchorBlend: 0.5, speedScale: 0.9 };
      case 'LM':
        return { depthBias: -2, widthBias: -19, anchorBlend: 0.62, speedScale: 1.0 };
      case 'RM':
        return { depthBias: -2, widthBias: 19, anchorBlend: 0.62, speedScale: 1.0 };
      case 'CM':
        return { depthBias: index < 8 ? -4 : 4, widthBias: sideBias * 8, anchorBlend: 0.58, speedScale: 1.0 };
      case 'ST':
        return { depthBias: 16, widthBias: 0, anchorBlend: 0.72, speedScale: 1.08 };
      default:
        return { depthBias: 0, widthBias: sideBias * 6, anchorBlend: 0.45, speedScale: 0.92 };
    }
  }

  function getRoleShapeLeash(player: any) {
    const role = (player?.displayRole || player?.role || '').toString().toUpperCase();
    switch (role) {
      case 'GK':
        return 4.5;
      case 'CB':
        return 12.5;
      case 'LB':
      case 'RB':
        return 14.5;
      case 'DM':
        return 15.5;
      case 'CM':
        return 17.5;
      case 'LM':
      case 'RM':
        return 19.5;
      case 'ST':
        return 22.0;
      default:
        return 16.0;
    }
  }

  function getSupportRunTarget(route: any, controller: any) {
    const player = route.player;
    if (!player) return new THREE.Vector3();

    const attackRight = teamAttacksRight(player.team);
    const attackSign = attackRight ? 1 : -1;
    const carrier = ballState.heldBy && ballState.heldBy.team === player.team ? ballState.heldBy : null;
    const roleLabel = (player.displayRole || player.role || '').toString().toUpperCase();
    const looseBallBlend = !ballState.heldBy && (ballState.isRolling || ballState.isFlying) ? 0.18 : 0.08;
    const neutralAnchor = player.homePos.clone().lerp(ballState.pos, looseBallBlend);
    const anchor = carrier ? carrier.pos : neutralAnchor;

    const supportTarget = new THREE.Vector3(
      anchor.x + route.depthBias * attackSign,
      0.15,
      THREE.MathUtils.clamp(anchor.z + route.widthBias, -FIELD_D / 2 + 2, FIELD_D / 2 - 2)
    );

    const carrierProgress = carrier
      ? THREE.MathUtils.clamp(((carrier.pos.x * attackSign) + FIELD_W / 2) / FIELD_W, 0, 1)
      : 0;
    const supportBlend = carrier
      ? THREE.MathUtils.lerp(route.anchorBlend, Math.min(0.9, route.anchorBlend + 0.2), carrierProgress)
      : 0.2;
    const finalTarget = player.homePos.clone().lerp(supportTarget, supportBlend);

    if (carrier) {
      const opponents = players.filter((opponent: any) => opponent.team !== player.team);
      if (opponents.length >= 2) {
        const sortedOpponents = opponents.slice().sort((a: any, b: any) => attackRight ? b.pos.x - a.pos.x : a.pos.x - b.pos.x);
        const secondLastOpponentX = sortedOpponents[1].pos.x;
        const onsideX = attackRight
          ? Math.min(anchor.x, secondLastOpponentX) - 1.1
          : Math.max(anchor.x, secondLastOpponentX) + 1.1;
        finalTarget.x = attackRight ? Math.min(finalTarget.x, onsideX) : Math.max(finalTarget.x, onsideX);
      }

      if (controller && controller.team === player.team && finalTarget.distanceTo(controller.pos) < 3.5) {
        finalTarget.z += route.widthBias >= 0 ? 3 : -3;
      }

      const isAttacker = roleLabel === 'ST' || roleLabel === 'LM' || roleLabel === 'RM' || roleLabel === 'CM';
      if (isAttacker) {
        const playerAdvance = (player.pos.x - player.homePos.x) * attackSign;
        const carrierAdvance = (carrier.pos.x - player.homePos.x) * attackSign;
        const minimumProgressX = Math.max(player.pos.x * attackSign - 1.25, carrier.pos.x * attackSign - 11.0);
        if (playerAdvance > 5 && carrierAdvance > 9) {
          finalTarget.x = attackRight
            ? Math.max(finalTarget.x, minimumProgressX)
            : Math.min(finalTarget.x, -minimumProgressX);
        }
      }
    }

    // Corner anti-swarm: if anchor is in a corner channel, pull support runners back toward role lanes.
    const anchorInCornerChannel = Math.abs(anchor.z) > FIELD_D * CORNER_NEAR_Z_RATIO && Math.abs(anchor.x) > FIELD_W * CORNER_NEAR_X_RATIO;
    if (anchorInCornerChannel) {
      const laneHomeZ = THREE.MathUtils.clamp(player.homePos.z * 0.85, -FIELD_D * 0.42, FIELD_D * 0.42);
      finalTarget.z = THREE.MathUtils.lerp(finalTarget.z, laneHomeZ, 0.48);
      const retreatX = player.homePos.x + attackSign * route.depthBias * 0.38;
      finalTarget.x = THREE.MathUtils.lerp(finalTarget.x, retreatX, 0.46);

      // Spread support runners by slot so the whole team does not collapse to one corner.
      const supportSlot = typeof route.supportSlot === 'number' ? route.supportSlot : 0;
      const inwardSign = anchor.z >= 0 ? -1 : 1;
      finalTarget.z += inwardSign * (3.0 + Math.abs(supportSlot) * 1.45);
      finalTarget.x += -attackSign * Math.abs(supportSlot) * 1.25;

      // Enforce a minimum distance from the active corner apex.
      const cornerX = anchor.x > 0 ? FIELD_W / 2 : -FIELD_W / 2;
      const cornerZ = anchor.z > 0 ? FIELD_D / 2 : -FIELD_D / 2;
      const cornerApex = new THREE.Vector3(cornerX, 0.15, cornerZ);
      const fromCorner = new THREE.Vector3().subVectors(finalTarget, cornerApex);
      fromCorner.y = 0;
      const minCornerRadius = 7.6;
      if (fromCorner.lengthSq() < minCornerRadius * minCornerRadius) {
        if (fromCorner.lengthSq() < 0.01) {
          fromCorner.set(anchor.x > 0 ? -1 : 1, 0, anchor.z > 0 ? -1 : 1);
        }
        fromCorner.setLength(minCornerRadius);
        finalTarget.copy(cornerApex).add(fromCorner);
      }
    }

    // Diagonal runs: ST/LM/RM make angled runs behind the defensive line when carrier has the ball
    if (carrier) {
      const isAttacker = roleLabel === 'ST' || roleLabel === 'LM' || roleLabel === 'RM';
      if (isAttacker) {
        const opponents = players.filter((o: any) => o.team !== player.team && !isGoalkeeper(o));
        if (opponents.length >= 2) {
          const sortedOpps = opponents.slice().sort((a: any, b: any) =>
            attackSign > 0 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x
          );
          const lastDefX = sortedOpps[0].pos.x;
          const secondLastDefX = sortedOpps[1]?.pos.x ?? lastDefX;
          const distToLine = (secondLastDefX - player.pos.x) * attackSign;
          if (distToLine > 0 && distToLine < 16) {
            // Near the defensive line — run diagonally behind it
            finalTarget.x += attackSign * THREE.MathUtils.lerp(5, 10, Math.max(0, 1 - distToLine / 16));
            // Cut inward (toward centre) to stay onside-safe
            const cutAngle = player.homePos.z >= 0 ? -1 : 1;
            finalTarget.z += cutAngle * 4;
          }
        }
      }

      if (roleLabel === 'ST') {
        finalTarget.x = attackRight
          ? Math.max(finalTarget.x, carrier.pos.x + 3.5)
          : Math.min(finalTarget.x, carrier.pos.x - 3.5);
      }
    }

    const shapeLeash = getRoleShapeLeash(player);
    const fromHome = new THREE.Vector3().subVectors(finalTarget, player.homePos);
    fromHome.y = 0;
    if (fromHome.lengthSq() > shapeLeash * shapeLeash) {
      fromHome.setLength(shapeLeash);
      finalTarget.copy(player.homePos).add(fromHome);
    }

    finalTarget.x = THREE.MathUtils.clamp(finalTarget.x, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5);
    finalTarget.z = THREE.MathUtils.clamp(finalTarget.z, -FIELD_D / 2 + 1.5, FIELD_D / 2 - 1.5);
    return finalTarget;
  }

  function getRestartOffsets(type: 'KICK_OFF' | 'THROW_IN' | 'GOAL_KICK' | 'CORNER' | 'TURNOVER' | 'PENALTY', hasRestart: boolean) {
    if (hasRestart) {
      switch (type) {
        case 'KICK_OFF':
          return [
            [0, 0],
            [-10, -8],
            [-10, 8],
            [-16, 0],
            [-22, -18],
            [-22, 18],
            [-28, -6],
            [-28, 6],
            [-36, -20],
            [-36, 20],
            [-42, 0],
          ];
        case 'THROW_IN':
          return [
            [0, 0],
            [-6, 5],
            [-8, -5],
            [6, 8],
            [10, -8],
            [14, 0],
            [-14, 12],
            [-14, -12],
            [22, 14],
            [24, -14],
            [32, 0],
          ];
        case 'GOAL_KICK':
          return [
            [0, 0],
            [8, -16],
            [8, 16],
            [12, -6],
            [12, 6],
            [18, -22],
            [18, 22],
            [26, -10],
            [26, 10],
            [34, -2],
            [42, 2],
          ];
        case 'CORNER':
          return [
            [0, 0],
            [-8, 5],
            [-10, -5],
            [-12, 0],
            [-14, 9],
            [-14, -9],
            [-18, 14],
            [-18, -14],
            [-26, 0],
            [-32, 10],
            [-32, -10],
          ];
        case 'TURNOVER':
        default:
          return [
            [0, 0],
            [-7, -8],
            [-7, 8],
            [-12, 0],
            [-16, -16],
            [-16, 16],
            [-22, -6],
            [-22, 6],
            [-30, -18],
            [-30, 18],
            [-36, 0],
          ];
      }
    }

    // Defending team keeps compact shape and legal distance around restart.
    switch (type) {
      case 'KICK_OFF':
        return [
          [12, 0],
          [18, -10],
          [18, 10],
          [24, 0],
          [30, -18],
          [30, 18],
          [36, -6],
          [36, 6],
          [44, -20],
          [44, 20],
          [50, 0],
        ];
      case 'THROW_IN':
        return [
          [6, 0],
          [10, -8],
          [10, 8],
          [14, 0],
          [20, -14],
          [20, 14],
          [26, -6],
          [26, 6],
          [32, -18],
          [32, 18],
          [38, 0],
        ];
      case 'GOAL_KICK':
        return [
          [16, 0],
          [22, -10],
          [22, 10],
          [28, 0],
          [34, -18],
          [34, 18],
          [40, -6],
          [40, 6],
          [46, -20],
          [46, 20],
          [52, 0],
        ];
      case 'CORNER':
        return [
          [8, 0],
          [10, -6],
          [10, 6],
          [14, -12],
          [14, 12],
          [18, -18],
          [18, 18],
          [24, -8],
          [24, 8],
          [30, -2],
          [34, 2],
        ];
      case 'TURNOVER':
      default:
        return [
          [10, 0],
          [14, -8],
          [14, 8],
          [20, 0],
          [26, -16],
          [26, 16],
          [32, -6],
          [32, 6],
          [38, -18],
          [38, 18],
          [44, 0],
        ];
    }
  }

  function buildRestartFormationSlots(offenseAttacksRight: boolean) {
    const attackSign = offenseAttacksRight ? 1 : -1;
    const restartX = gameState.ballPos.x;
    const restartZ = gameState.ballPos.z;

    if (soccerRestart.type === 'KICK_OFF') {
      const toKickoffWorld = (xYards: number, zYards: number) => ({
        x: THREE.MathUtils.clamp(xYards * X_PER_YARD, -FIELD_W / 2 + 1.4, FIELD_W / 2 - 1.4),
        z: THREE.MathUtils.clamp(zYards * Z_PER_YARD, -FIELD_D / 2 + 1.4, FIELD_D / 2 - 1.4),
      });

      const offenseKickoffYards = [
        [-52 * attackSign, 0],
        [-30 * attackSign, -24],
        [-34 * attackSign, -8],
        [-34 * attackSign, 8],
        [-30 * attackSign, 24],
        [-18 * attackSign, -20],
        [-16 * attackSign, -6],
        [-16 * attackSign, 6],
        [-18 * attackSign, 20],
        [0, 0],
        [-4 * attackSign, 0],
      ];

      const defenseKickoffYards = [
        [52 * attackSign, 0],
        [26 * attackSign, -24],
        [22 * attackSign, -10],
        [22 * attackSign, 10],
        [26 * attackSign, 24],
        [16 * attackSign, -20],
        [14 * attackSign, -6],
        [14 * attackSign, 6],
        [16 * attackSign, 20],
        [12 * attackSign, -30],
        [12 * attackSign, 30],
      ];

      const offenseSlots = offenseKickoffYards.map((o) => toKickoffWorld(o[0], o[1]));
      const defenseSlots = defenseKickoffYards.map((o) => toKickoffWorld(o[0], o[1]));

      return {
        offense: {
          qb: offenseSlots[0],
          line: offenseSlots.slice(1, 6),
          skill: offenseSlots.slice(6, 11),
          team: offenseSlots.slice(0, 11),
        },
        defense: {
          team: defenseSlots.slice(0, 11),
        },
      };
    }

    const toWorld = (offsetXYards: number, offsetZYards: number) => ({
      x: THREE.MathUtils.clamp(restartX + offsetXYards * attackSign * X_PER_YARD, -FIELD_W / 2 + 1.4, FIELD_W / 2 - 1.4),
      z: THREE.MathUtils.clamp(restartZ + offsetZYards * Z_PER_YARD, -FIELD_D / 2 + 1.4, FIELD_D / 2 - 1.4),
    });

    const offenseOffsets = getRestartOffsets(soccerRestart.type, true);
    const defenseOffsets = getRestartOffsets(soccerRestart.type, false);
    const offenseSlots = offenseOffsets.map((o) => toWorld(o[0], o[1]));
    const defenseSlots = defenseOffsets.map((o) => toWorld(o[0], o[1]));

    const offenseOwnGoalX = offenseAttacksRight ? (-FIELD_W / 2 + 4 * X_PER_YARD) : (FIELD_W / 2 - 4 * X_PER_YARD);
    const defenseAttacksRight = !offenseAttacksRight;
    const defenseOwnGoalX = defenseAttacksRight ? (-FIELD_W / 2 + 4 * X_PER_YARD) : (FIELD_W / 2 - 4 * X_PER_YARD);
    offenseSlots[0] = { x: offenseOwnGoalX, z: 0 };
    defenseSlots[0] = { x: defenseOwnGoalX, z: 0 };

    return {
      offense: {
        qb: offenseSlots[0],
        line: offenseSlots.slice(1, 6),
        skill: offenseSlots.slice(6, 11),
        team: offenseSlots.slice(0, 11),
      },
      defense: {
        team: defenseSlots.slice(0, 11),
      },
    };
  }

  function setupFormation() {
    gameState.selectedReceiverIndex = 0;
    players.forEach(p => {
      scene.remove(p.mesh);
      p.mesh.traverse((child: any) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material && child.material.type === 'MeshBasicMaterial') {
            child.material.dispose();
          }
        }
      });
    });
    players.length = 0;
    offenseTeam.length = 0;
    defenseTeam.length = 0;

    const offTeam = gameState.offensiveTeam;
    const defTeam = offTeam === 'A' ? 'B' : 'A';
    const offenseAttacksRight = teamAttacksRight(offTeam);
    const defenseAttacksRight = !offenseAttacksRight;
    const offFormation = SOCCER_FORMATIONS[activeTeamFormations[offTeam]] || SOCCER_FORMATIONS['4-2-3-1'];
    const defFormation = SOCCER_FORMATIONS[activeTeamFormations[defTeam]] || SOCCER_FORMATIONS['4-2-3-1'];
    const useRestartShape = !gameState.isLive;
    const restartSlots = useRestartShape ? buildRestartFormationSlots(offenseAttacksRight) : null;
    const offenseSlots = restartSlots ? restartSlots.offense : { team: offFormation.team };
    const defenseSlots = restartSlots ? restartSlots.defense : { team: defFormation.team };

    const nameForOffense = createTeamLineupNamer(offTeam);
    const nameForDefense = createTeamLineupNamer(defTeam);
    const usedRatingsByTeam: Record<'A' | 'B', Set<number>> = { A: new Set<number>(), B: new Set<number>() };

    for (let idx = 0; idx < 11; idx++) {
      const roleLabel = offFormation.roles[idx] || 'CM';
      const rawSlot = offenseSlots.team[idx] || offenseSlots.team[offenseSlots.team.length - 1];
      const slot = restartSlots ? rawSlot : toSoccerFieldPosition(rawSlot, offenseAttacksRight);
      const archetype = getSoccerRoleArchetype(roleLabel);
      const ratingProfile = pickMLSPlayerForRole(offTeam, roleLabel, usedRatingsByTeam[offTeam]);
      const playerName = ratingProfile?.name || nameForOffense(roleLabel);
      const statProfile = ratingProfile ? buildPlayerStatsFromMLS(ratingProfile, roleLabel, offTeam) : undefined;
      offenseTeam.push(addPlayer(slot.x, slot.z, offTeam, archetype, playerName, roleLabel, statProfile, ratingProfile));
    }

    for (let idx = 0; idx < 11; idx++) {
      const roleLabel = defFormation.roles[idx] || 'CM';
      const rawSlot = defenseSlots.team[idx] || defenseSlots.team[defenseSlots.team.length - 1];
      const slot = restartSlots ? rawSlot : toSoccerFieldPosition(rawSlot, defenseAttacksRight);
      const archetype = getSoccerRoleArchetype(roleLabel);
      const ratingProfile = pickMLSPlayerForRole(defTeam, roleLabel, usedRatingsByTeam[defTeam]);
      const playerName = ratingProfile?.name || nameForDefense(roleLabel);
      const statProfile = ratingProfile ? buildPlayerStatsFromMLS(ratingProfile, roleLabel, defTeam) : undefined;
      defenseTeam.push(addPlayer(slot.x, slot.z, defTeam, archetype, playerName, roleLabel, statProfile, ratingProfile));
    }
  }

  const ballGroup = new THREE.Group();
  const ballMaterial = new THREE.MeshPhysicalMaterial({
    map: fallbackBallTex,
    roughness: 0.37,
    metalness: 0.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.58,
    reflectivity: 0.32,
  });

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 28, 20),
    ballMaterial
  );

  // Prefer external wrap texture if present; keep procedural map as fallback.
  new THREE.TextureLoader().load(
    '/assets/ball-wrap.png',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      ballMaterial.map = tex;
      ballMaterial.needsUpdate = true;
    },
    undefined,
    () => {
      // Ignore missing texture file and continue with fallbackBallTex.
    }
  );
  ballMesh.castShadow = true;
  ballGroup.add(ballMesh);
  scene.add(ballGroup);

  const ballShadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const ballShadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), ballShadowMaterial);
  ballShadowMesh.rotation.x = -Math.PI / 2;
  ballShadowMesh.position.y = 0.02;
  scene.add(ballShadowMesh);

  function updateBallShadowVisual() {
    const height = Math.max(0, ballState.pos.y - BALL_GROUND_Y);
    const scale = THREE.MathUtils.clamp(1 - height * 0.2, 0.36, 1.05);
    const alpha = THREE.MathUtils.clamp(0.36 - height * 0.05, 0.1, 0.38);
    ballShadowMesh.position.set(ballState.pos.x, 0.02, ballState.pos.z);
    ballShadowMesh.scale.set(scale, scale, 1);
    ballShadowMaterial.opacity = alpha;
  }

  const trajectoryIndicator = new THREE.Group();
  scene.add(trajectoryIndicator);
  trajectoryIndicator.visible = false;

  const MAX_TRAIL_POINTS = 30;
  const ballTrailPositions: THREE.Vector3[] = [];
  for (let i = 0; i < MAX_TRAIL_POINTS; i++) ballTrailPositions.push(new THREE.Vector3());
  
  const ballTrailGeo = new THREE.BufferGeometry().setFromPoints(ballTrailPositions);
  const ballTrailMat = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.6,
    linewidth: 2
  });
  const ballTrailLine = new THREE.Line(ballTrailGeo, ballTrailMat);
  scene.add(ballTrailLine);
  ballTrailLine.visible = false;
  
  let trailPointCount = 0;
  let trailTimer = 0;

  const chargeLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const chargeLineMat = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
  const chargeLine = new THREE.Line(chargeLineGeo, chargeLineMat);
  scene.add(chargeLine);
  chargeLine.visible = false;

  const chargeCircleGeo = new THREE.TorusGeometry(1.2, 0.1, 8, 32);
  const chargeCircleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
  const chargeCircle = new THREE.Mesh(chargeCircleGeo, chargeCircleMat);
  chargeCircle.rotation.x = -Math.PI / 2;
  scene.add(chargeCircle);
  chargeCircle.visible = false;

  // Shot aiming indicator – arc of dots + growing power ring + goal target ring
  const SHOT_ARC_DOT_COUNT = 22;
  const shotArcGroup = new THREE.Group();
  const shotArcDotGeo = new THREE.SphereGeometry(0.12, 6, 6);
  for (let i = 0; i < SHOT_ARC_DOT_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.9 });
    shotArcGroup.add(new THREE.Mesh(shotArcDotGeo, mat));
  }
  scene.add(shotArcGroup);
  shotArcGroup.visible = false;

  const shotRingGeo = new THREE.TorusGeometry(0.6, 0.09, 8, 40);
  const shotRingMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.85 });
  const shotPowerRing = new THREE.Mesh(shotRingGeo, shotRingMat);
  shotPowerRing.rotation.x = -Math.PI / 2;
  scene.add(shotPowerRing);
  shotPowerRing.visible = false;

  const shotTargetGeo = new THREE.RingGeometry(0.18, 0.36, 20);
  const shotTargetMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const shotTargetMarker = new THREE.Mesh(shotTargetGeo, shotTargetMat);
  scene.add(shotTargetMarker);
  shotTargetMarker.visible = false;

  function computeShotArc(shooter: any, powerScale: number) {
    const attackRight = teamAttacksRight(shooter.team);
    const goalX = attackRight ? FIELD_W / 2 : -FIELD_W / 2;
    const shotSkill = getShotSkill(shooter);
    const composure = THREE.MathUtils.clamp(shotSkill * 0.8, 0.12, 0.98);
    const sign = shooter.pos.z >= 0 ? -1 : 1;
    const cornerSide = Math.random() < 0.5 ? 1 : -1;
    const desiredCornerBias = THREE.MathUtils.lerp(0.22, 0.42, composure) * cornerSide;
    const baseAimZ = THREE.MathUtils.clamp(
      desiredCornerBias * goalMouthWidth,
      -goalMouthWidth * 0.48,
      goalMouthWidth * 0.48,
    );
    const startPos = shooter.pos.clone();
    startPos.y = 0.24;
    const targetPos = new THREE.Vector3(goalX, 1.1, baseAimZ);
    const dx = targetPos.x - startPos.x;
    const dz = targetPos.z - startPos.z;
    const distH = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    const weather = getActiveWeatherPreset();
    const speedH = 24 * powerScale * GAME_SPEED_SCALE * weather.shotSpeedMul;
    const time = distH / speedH;
    const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
    const liftMin = THREE.MathUtils.lerp(2.6, 3.0, composure);
    const liftMax = THREE.MathUtils.lerp(6.2, 7.3, composure);
    vel.y = THREE.MathUtils.clamp((targetPos.y - startPos.y + 4.9 * time * time) / time, liftMin, liftMax);
    return { startPos, vel, time, targetPos };
  }

  function calculatePassingAccuracy(qb: any, target: any) {
    if (!qb || !target) return 0;
    let accuracy = qb.stats.accuracy;
    const qbSpeed = qb.vel.length();
    accuracy -= qbSpeed * 0.15;
    const dist = qb.pos.distanceTo(target.pos);
    accuracy -= (dist / 120);
    defenseTeam.forEach(d => {
      const distToQB = d.pos.distanceTo(qb.pos);
      if (distToQB < 4.0) accuracy -= (4.0 - distToQB) * 0.08;
      const distToTarget = d.pos.distanceTo(target.pos);
      if (distToTarget < 5.0) accuracy -= (5.0 - distToTarget) * 0.04;
    });
    return Math.max(0.05, accuracy);
  }

  function calculateLeadPosition(qbPos: THREE.Vector3, receiver: any, speedH: number = 18) {
    if (!receiver) return new THREE.Vector3();
    const dist0 = qbPos.distanceTo(receiver.pos);
    const time0 = dist0 / speedH;
    const leadPos = receiver.pos.clone().addScaledVector(receiver.vel, time0);
    const dist1 = qbPos.distanceTo(leadPos);
    const time1 = dist1 / speedH;
    return receiver.pos.clone().addScaledVector(receiver.vel, time1);
  }

  setupFormation();
  setKickoffScheduleByCoinToss();

  const playUIUpdates: (() => void)[] = [];

  function randomizePlays() {
    const offKeys = Object.keys(PASS_PLAYBOOK).filter(k => k !== 'kickoff');
    const defKeys = Object.keys(DEFENSE_PLAYBOOK).filter(k => k !== 'kickoff-return');
    gameState.selectedOffensePlay = offKeys[Math.floor(Math.random() * offKeys.length)];
    gameState.selectedDefensePlay = defKeys[Math.floor(Math.random() * defKeys.length)];
    gameState.isKickoff = false;
    playUIUpdates.forEach(u => u());
    setupFormation();
  }

  function resetBall(shouldRandomize = true) {
    gameState.isLive = false;
    gameState.isResetting = false;
    isPlaybookVisible = false;
    playbookBar.style.display = 'none';
    playbookHint.style.display = 'none';
    if (shouldRandomize) {
      gameState.isKickoff = false;
      gameState.kickoffState = 'NONE';
    }
    ballState.isFlying = false;
    ballState.heldBy = null; // Ball starts on the ground
    ballState.lastHeldBy = null;
    ballState.shotByTeam = null;
    ballState.vel.set(0, 0, 0);
    ballState.pos.set(gameState.ballPos.x, 0.15, 0);
    trailPointCount = 0;
    ballTrailLine.visible = false;
    
    // Randomize plays on reset
    if (shouldRandomize) randomizePlays();
    if (shouldRandomize) setKickoffScheduleByCoinToss();
    const kickoffTeam = matchClock.half === 1 ? kickoffSchedule.firstHalfTeam : kickoffSchedule.secondHalfTeam;
    startSoccerRestart('KICK_OFF', kickoffTeam, 0, 0, 'KICK-OFF');
  }
  resetBall();

  function getOrderedTeamPlayers(team: 'A' | 'B') {
    return players
      .filter((p: any) => p.team === team)
      .slice()
      .sort((a: any, b: any) => {
        const ax = a.homePos?.x ?? 0;
        const bx = b.homePos?.x ?? 0;
        if (Math.abs(ax - bx) > 0.01) return ax - bx;
        const az = a.homePos?.z ?? 0;
        const bz = b.homePos?.z ?? 0;
        return az - bz;
      });
  }

  function buildActiveRoutes(offenseTeamId: 'A' | 'B' = gameState.offensiveTeam) {
    const routePlayers = getOrderedTeamPlayers(offenseTeamId);
    return routePlayers.map((player, index) => ({
      player,
      supportSlot: (index % 5) - 2,
      ...getSupportRunProfile(player, index)
    }));
  }

  function getDefensiveRoleProfile(player: any) {
    const label = player.displayRole || player.role;
    const sideBias = player.homePos.z === 0 ? 0 : Math.sign(player.homePos.z);

    switch (label) {
      case 'GK':
        return { depthBias: 27, widthBias: 0, anchorBlend: 0.12, pressStrength: 0.08, pressRadius: 1.6 };
      case 'LB':
        return { depthBias: 18, widthBias: -15, anchorBlend: 0.38, pressStrength: 0.55, pressRadius: 2.2 };
      case 'RB':
        return { depthBias: 18, widthBias: 15, anchorBlend: 0.38, pressStrength: 0.55, pressRadius: 2.2 };
      case 'CB':
        return { depthBias: 20, widthBias: sideBias * 6, anchorBlend: 0.28, pressStrength: 0.42, pressRadius: 1.9 };
      case 'DM':
        return { depthBias: 12, widthBias: 0, anchorBlend: 0.48, pressStrength: 0.7, pressRadius: 2.4 };
      case 'LM':
        return { depthBias: 8, widthBias: -18, anchorBlend: 0.56, pressStrength: 0.72, pressRadius: 2.5 };
      case 'RM':
        return { depthBias: 8, widthBias: 18, anchorBlend: 0.56, pressStrength: 0.72, pressRadius: 2.5 };
      case 'CM':
        return { depthBias: 6, widthBias: sideBias * 8, anchorBlend: 0.6, pressStrength: 0.78, pressRadius: 2.5 };
      case 'ST':
        return { depthBias: 2, widthBias: 0, anchorBlend: 0.72, pressStrength: 0.95, pressRadius: 2.8 };
      default:
        return { depthBias: 10, widthBias: sideBias * 6, anchorBlend: 0.45, pressStrength: 0.62, pressRadius: 2.2 };
    }
  }

  function getDefensiveShapeTarget(assignment: any, attackAnchor: any) {
    const player = assignment.player;
    if (!player) return new THREE.Vector3();

    const liveAttackingTeam = ballState.heldBy?.team || ballState.lastHeldBy?.team || gameState.offensiveTeam;
    const attackingTeam = liveAttackingTeam === 'A' || liveAttackingTeam === 'B'
      ? liveAttackingTeam
      : (offenseTeam[0]?.team || 'A');
    const attackRight = teamAttacksRight(attackingTeam);
    const attackSign = attackRight ? 1 : -1;
    const anchor = attackAnchor || { pos: ballState.pos };

    // Compact shape: when ball is deep in our half, squeeze width inward
    const defGoalX = attackRight ? -FIELD_W / 2 : FIELD_W / 2;
    const ballDistToGoal = Math.abs(anchor.pos.x - defGoalX);
    const compactFactor = ballDistToGoal < FIELD_W * 0.35
      ? THREE.MathUtils.lerp(0.42, 0.78, ballDistToGoal / (FIELD_W * 0.35))
      : 1.0;

    const compactTarget = new THREE.Vector3(
      anchor.pos.x - assignment.depthBias * attackSign,
      0.15,
      THREE.MathUtils.clamp(anchor.pos.z + assignment.widthBias * compactFactor, -FIELD_D / 2 + 2, FIELD_D / 2 - 2)
    );

    const finalTarget = player.homePos.clone().lerp(compactTarget, attackAnchor ? assignment.anchorBlend : 0.3);
    finalTarget.x = THREE.MathUtils.clamp(finalTarget.x, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5);
    finalTarget.z = THREE.MathUtils.clamp(finalTarget.z, -FIELD_D / 2 + 1.5, FIELD_D / 2 - 1.5);
    return finalTarget;
  }

  // Through-ball: find an attacker who can run behind the last defender
  function findThroughBallTarget(carrier: any, team: 'A' | 'B', attackSign: number) {
    const attackers = players.filter((p: any) =>
      p.team === team && p !== carrier && !isGoalkeeper(p) &&
      ['ST', 'LM', 'RM', 'CM'].includes(p.displayRole || p.role)
    );
    if (attackers.length === 0) return null;

    const opponents = players.filter((p: any) => p.team !== team && !isGoalkeeper(p));
    if (opponents.length < 2) return null;

    // Find last-but-one defender's x (leaving 1 GK onside)
    const sortedDefs = opponents.slice().sort((a: any, b: any) =>
      attackSign > 0 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x
    );
    const lastDefX = sortedDefs[0].pos.x;
    const secondLastDefX = sortedDefs[1]?.pos.x ?? lastDefX;

    let best: { player: any; throughPos: THREE.Vector3 } | null = null;
    let bestScore = -Infinity;

    attackers.forEach((candidate: any) => {
      // Must be moving roughly toward goal
      const movingForward = candidate.vel.dot(new THREE.Vector3(attackSign, 0, 0)) > 0.5;
      // Must be within 14 units of the 2nd-last defender (near the line)
      const distToLine = (secondLastDefX - candidate.pos.x) * attackSign;
      if (distToLine < -1 || distToLine > 14) return; // offside or too far back
      if (!movingForward && distToLine > 8) return;

      // Through position: 8 units past the last-but-one defender toward goal
      const throughX = secondLastDefX + attackSign * 8;
      const throughPos = new THREE.Vector3(
        THREE.MathUtils.clamp(throughX, -FIELD_W / 2 + 4, FIELD_W / 2 - 4),
        0.15,
        THREE.MathUtils.clamp(candidate.pos.z * 0.7, -FIELD_D / 2 + 2, FIELD_D / 2 - 2)
      );

      // Lane must be reasonably open
      const laneOpenness = getClosestOpponentDistance(throughPos, team);
      if (laneOpenness < 3.5) return;
      const lanePressure = getPassLanePressure(carrier.pos, throughPos, team);

      const score = laneOpenness * 0.8 - lanePressure * 1.2 - distToLine * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = { player: candidate, throughPos };
      }
    });

    return best;
  }

  // Called whenever ball changes team hands during live play
  function handlePossessionChange(newHolder: any, elapsed: number) {
    const wonTeam = newHolder.team as 'A' | 'B';
    const lostTeam = wonTeam === 'A' ? 'B' : 'A';
    const attackSign = teamAttacksRight(wonTeam) ? 1 : -1;

    // Counter-attack: ball was won while opponents were pushed forward (in their own attacking half)
    const ballInOpponentHalf = ballState.pos.x * attackSign < -6;
    if (ballInOpponentHalf) {
      gameState.counterAttackActive = true;
      gameState.counterAttackTeam = wonTeam;
      gameState.counterAttackExpiry = elapsed + 8;
    }

    // Transition defense: losing team must sprint back
    gameState.transitionDefenseExpiry = elapsed + 3.5;
    gameState.transitionDefenseTeam = lostTeam;

    // Cancel any give-and-go if possession changed to opponent
    if (gameState.giveAndGoActive && gameState.giveAndGoReceiver?.team !== wonTeam) {
      gameState.giveAndGoActive = false;
    }

    refreshDynamicTeamShape(elapsed, true);
  }

  function buildDefenseAssignments(defendingTeamId: 'A' | 'B', attackingTeamId: 'A' | 'B') {
    const unassignedAttackers = getOrderedTeamPlayers(attackingTeamId).filter((p: any) => !isGoalkeeper(p));
    const defenders = getOrderedTeamPlayers(defendingTeamId);
    return defenders.map((player) => {
      const profile = getDefensiveRoleProfile(player);
      let markTarget = null;

      if (unassignedAttackers.length > 0) {
        unassignedAttackers.sort((a, b) => player.homePos.distanceTo(a.homePos) - player.homePos.distanceTo(b.homePos));
        markTarget = unassignedAttackers.shift() || null;
      }

      return {
        player,
        markTarget,
        ...profile
      };
    });
  }

  function refreshDynamicTeamShape(elapsed: number, force: boolean = false) {
    const liveOffenseTeam: 'A' | 'B' = (ballState.heldBy?.team === 'A' || ballState.heldBy?.team === 'B')
      ? ballState.heldBy.team
      : ((ballState.lastHeldBy?.team === 'A' || ballState.lastHeldBy?.team === 'B')
        ? ballState.lastHeldBy.team
        : gameState.offensiveTeam);
    gameState.offensiveTeam = liveOffenseTeam;

    const defendingTeam: 'A' | 'B' = liveOffenseTeam === 'A' ? 'B' : 'A';
    const shouldRefresh =
      force ||
      playState.dynamicOffenseTeam !== liveOffenseTeam ||
      elapsed - playState.lastShapeRefresh > 0.22 ||
      playState.activeRoutes.length === 0 ||
      playState.defenseAssignments.length === 0;
    if (!shouldRefresh) return;

    offenseTeam.length = 0;
    defenseTeam.length = 0;
    getOrderedTeamPlayers(liveOffenseTeam).forEach((p: any) => offenseTeam.push(p));
    getOrderedTeamPlayers(defendingTeam).forEach((p: any) => defenseTeam.push(p));
    playState.activeRoutes = buildActiveRoutes(liveOffenseTeam);
    playState.defenseAssignments = buildDefenseAssignments(defendingTeam, liveOffenseTeam);
    playState.dynamicOffenseTeam = liveOffenseTeam;
    playState.lastShapeRefresh = elapsed;
  }

  function createPlaySelector(isOffense: boolean) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.alignItems = 'center';

    const select = document.createElement('select');
    select.style.fontFamily = 'Consolas, Monaco, monospace';
    select.style.fontSize = '12px';
    select.style.background = '#0c1a2b';
    select.style.color = '#eaf0fb';
    select.style.border = '1px solid rgba(162,190,255,0.35)';
    select.style.padding = '5px 10px';
    select.style.borderRadius = '4px';
    select.style.cursor = 'pointer';
    select.style.width = '160px';
    select.style.outline = 'none';
    select.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    const playbook = isOffense ? PASS_PLAYBOOK : DEFENSE_PLAYBOOK;
    const currentPlayKey = isOffense ? gameState.selectedOffensePlay : gameState.selectedDefensePlay;

    Object.keys(playbook).forEach(playKey => {
      const play = (playbook as any)[playKey];
      const option = document.createElement('option');
      option.value = playKey;
      option.textContent = play.label;
      option.selected = playKey === currentPlayKey;
      select.appendChild(option);
    });

    const updateUI = () => {
      const currentKey = isOffense ? gameState.selectedOffensePlay : gameState.selectedDefensePlay;
      select.value = currentKey;
    };
    playUIUpdates.push(updateUI);

    select.onchange = () => {
      if (!gameState.isLive) {
        hintOverlay.style.opacity = '1';
        gameState.hintDismissed = false;
        const playKey = select.value;
        if (isOffense) {
          gameState.selectedOffensePlay = playKey;
          gameState.isKickoff = false;
        } else {
          gameState.selectedDefensePlay = playKey;
        }
        setupFormation();
        updateHUD();
        isPlaybookVisible = false;
        playbookBar.style.display = 'none';
        playbookHint.style.display = 'block';
      } else {
        // Revert if live
        select.value = isOffense ? gameState.selectedOffensePlay : gameState.selectedDefensePlay;
      }
      select.blur();
    };

    container.appendChild(select);
    return container;
  }

  const playbookRows = document.createElement('div');
  playbookRows.style.display = 'flex';
  playbookRows.style.alignItems = 'flex-start';
  playbookRows.style.justifyContent = 'center';
  playbookRows.style.gap = '20px';
  playbookBar.appendChild(playbookRows);

  const offCol = document.createElement('div');
  offCol.style.display = 'flex';
  offCol.style.flexDirection = 'column';
  offCol.style.gap = '5px';
  const offLabel = document.createElement('div');
  offLabel.textContent = 'OFFENSE';
  offLabel.style.fontSize = '11px';
  offLabel.style.color = '#7fd5ff';
  offLabel.style.fontWeight = 'bold';
  offLabel.style.textAlign = 'center';
  offCol.appendChild(offLabel);
  offCol.appendChild(createPlaySelector(true));
  playbookRows.appendChild(offCol);

  // Scoreboard in the middle
  // playbookRows.appendChild(logoBar); // Removed

  const defCol = document.createElement('div');
  defCol.style.display = 'flex';
  defCol.style.flexDirection = 'column';
  defCol.style.gap = '5px';
  const defLabel = document.createElement('div');
  defLabel.textContent = 'DEFENSE';
  defLabel.style.fontSize = '11px';
  defLabel.style.color = '#ff8d8d';
  defLabel.style.fontWeight = 'bold';
  defLabel.style.textAlign = 'center';
  defCol.appendChild(defLabel);
  defCol.appendChild(createPlaySelector(false));
  playbookRows.appendChild(defCol);

  function getHumanControlFlags() {
    if (gameState.cpuVsCpu) {
      return { controlA: false, controlB: false };
    }
    if (gameState.testingMode) {
      const liveOffenseTeam: 'A' | 'B' = (ballState.heldBy?.team === 'A' || ballState.heldBy?.team === 'B')
        ? ballState.heldBy.team
        : ((ballState.lastHeldBy?.team === 'A' || ballState.lastHeldBy?.team === 'B')
          ? ballState.lastHeldBy.team
          : gameState.offensiveTeam);
      gameState.offensiveTeam = liveOffenseTeam;
      return {
        controlA: liveOffenseTeam === 'A',
        controlB: liveOffenseTeam === 'B',
      };
    }
    if (gameState.hotSeatMode) {
      return { controlA: true, controlB: true };
    }
    return { controlA: true, controlB: false };
  }


  function animate() {
    requestAnimationFrame(animate);
    const bannerNow = performance.now() / 1000;
    
    // Animate Banners
    bannerTexts.forEach((t: any) => {
      if (!t.tickerPhase) {
        t.tickerPhase = 'scroll';
        t.tickerOffset = 0;
        t.tickerSteps = 0;
        t.tickerBlinkToggles = 0;
        t.tickerNextAt = bannerNow + 0.1;
      }

      if (bannerNow >= (t.tickerNextAt || 0)) {
        if (t.tickerPhase === 'scroll') {
          const tickerSource = t.tickerSource || 'PIXEL SOCCER LEAGUE • ';
          const tickerLoop = t.tickerLoop || tickerSource.repeat(10);
          t.tickerOffset = (t.tickerOffset + 1) % tickerSource.length;
          const tickerWindowChars = typeof t.tickerWindowChars === 'number' ? t.tickerWindowChars : 14;
          const doubled = tickerLoop + tickerLoop;
          const textSlice = doubled.slice(t.tickerOffset, t.tickerOffset + tickerWindowChars);
          if (t._tickerText !== textSlice) {
            t._tickerText = textSlice;
            t.text = textSlice;
            t.sync();
          }
          t.visible = true;
          t.tickerSteps = (t.tickerSteps || 0) + 1;
          if (t.tickerSteps >= 18) {
            t.tickerSteps = 0;
            t.tickerPhase = 'stop';
            t.tickerNextAt = bannerNow + 0.8;
          } else {
            t.tickerNextAt = bannerNow + 0.11;
          }
        } else if (t.tickerPhase === 'stop') {
          t.visible = true;
          t.tickerPhase = 'blink';
          t.tickerBlinkToggles = 0;
          t.tickerNextAt = bannerNow + 0.12;
        } else {
          t.visible = !t.visible;
          t.tickerBlinkToggles = (t.tickerBlinkToggles || 0) + 1;
          if (t.tickerBlinkToggles >= 4) {
            t.visible = true;
            t.tickerPhase = 'scroll';
            t.tickerNextAt = bannerNow + 0.11;
          } else {
            t.tickerNextAt = bannerNow + 0.12;
          }
        }
      }

      // Ensure visible
      if (t.tickerPhase !== 'blink') t.visible = true;
      
      // Soft Neon Glow
      t.outlineWidth = 0.05;
      t.outlineColor = t.color;
      t.outlineBlur = 0.15;
    });

    // Snapshot possession team before any AI writes it this frame
    const prevHolderTeam: 'A' | 'B' | null = (ballState.heldBy?.team as 'A' | 'B') ?? null;

    if (!gameState.isLive && !gameState.isKickoff && !gameState.hintDismissed && gameState.down >= 2) {
      if (hintOverlay.style.opacity === '0') {
        hintOverlay.style.opacity = '1';
      }
    } else {
      hintOverlay.style.opacity = '0';
    }

    if (gameState.isLive) {
      gameState.hintDismissed = false;
      hintOverlay.style.opacity = '0';
    }
    const now = performance.now();
    const rawDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    const elapsed = now / 1000;
    if (isManualPause) {
      updateBallShadowVisual();
      renderer.render(scene, camera);
      return;
    }
    if (gameState.crossAssistTeam && elapsed > gameState.crossAssistUntil) {
      gameState.crossAssistTeam = '';
      gameState.crossAssistUntil = 0;
    }
    if (playPatternHideAt > 0 && elapsed >= playPatternHideAt) {
      playPatternOverlay.style.opacity = '0';
      playPatternHideAt = 0;
    }
    const instantFPS = rawDt > 0 ? (1 / rawDt) : smoothedFPS;
    smoothedFPS = smoothedFPS * 0.9 + instantFPS * 0.1;
    updateCornerBunchDetector(rawDt);
    if (showFPSDisplay && now - lastFPSUiUpdate >= 120) {
      fpsDisplay.textContent = `FPS ${Math.round(smoothedFPS)}`;
      lastFPSUiUpdate = now;
    }
    if (showAIStateOverlay && now - lastAIStateUiUpdate >= 180) {
      const teamA = players.filter((p: any) => p.team === 'A');
      const teamB = players.filter((p: any) => p.team === 'B');
      const teamAName = (activeTeams.A.scoreName || 'TEAM A').toUpperCase();
      const teamBName = (activeTeams.B.scoreName || 'TEAM B').toUpperCase();
      const holderName = ballState.heldBy ? `${ballState.heldBy.team}:${ballState.heldBy.name}` : 'LOOSE';
      const formatLine = (p: any) => {
        const role = (p.displayRole || p.role || 'P').padEnd(2, ' ');
        const state = (p.aiState || 'IDLE').padEnd(18, ' ');
        return `${role} ${p.name.slice(0, 12).padEnd(12, ' ')} ${state}`;
      };
      aiStateOverlay.textContent = [
        'AI STATE DEBUG',
        `BALL: ${holderName}`,
        `FPS: ${Math.round(smoothedFPS)}`,
        `CORNER BUNCH ${teamAName}: now ${cornerBunchTracker.A.current} • events ${cornerBunchTracker.A.events} • peak ${cornerBunchTracker.A.peak}`,
        `CORNER BUNCH ${teamBName}: now ${cornerBunchTracker.B.current} • events ${cornerBunchTracker.B.events} • peak ${cornerBunchTracker.B.peak}`,
        `CORNER MIXED: now ${cornerBunchTracker.MIXED.current} • events ${cornerBunchTracker.MIXED.events} • peak ${cornerBunchTracker.MIXED.peak}`,
        '',
        teamAName,
        ...teamA.map(formatLine),
        '',
        teamBName,
        ...teamB.map(formatLine),
      ].join('\n');
      lastAIStateUiUpdate = now;
    }
    const saveSlowmoActive = elapsed < gameState.saveSlowmoUntil;
    const dt = rawDt * (saveSlowmoActive ? SAVE_SLOWMO_SCALE : 1.0);
    updateWeatherEffects(dt, elapsed);
    if (ballState.heldBy && (ballState.heldBy.team === 'A' || ballState.heldBy.team === 'B')) {
      gameState.offensiveTeam = ballState.heldBy.team;
    } else if (ballState.lastHeldBy && (ballState.lastHeldBy.team === 'A' || ballState.lastHeldBy.team === 'B')) {
      gameState.offensiveTeam = ballState.lastHeldBy.team;
    }
    refreshDynamicTeamShape(elapsed);

    gameState.cpuDecisionCooldownA = Math.max(0, gameState.cpuDecisionCooldownA - dt);
    gameState.cpuDecisionCooldownB = Math.max(0, gameState.cpuDecisionCooldownB - dt);

    // In CPU vs CPU, automatically trigger restarts and kickoff touch with no user input.
    // In CPU vs CPU, automatically trigger restarts and kickoff touch with no user input.
    if (gameState.cpuVsCpu && !kickoffPresentation.active && !freeKickPresentation.active && !gameState.menuVisible && !gameState.isResetting && !gameState.isLive && gameState.status === 'PLAYING') {
      // Clear stale HALFTIME message if the clock has moved past halftime.
      if (gameState.message === 'HALFTIME' && matchClock.phase !== 'HALFTIME') {
        gameState.message = '';
      }
      beginCurrentRestart();
      if (gameState.isKickoff && gameState.kickoffState === 'READY') {
        executeKickoffTouch();
      }
    }

    // Watchdog: if CPU mode is stuck (isLive=false, status=PLAYING) for >2 s, force a kick-off restart.
    if (gameState.cpuVsCpu && !kickoffPresentation.active && !freeKickPresentation.active && !gameState.menuVisible && gameState.status === 'PLAYING') {
      if (!gameState.isLive) {
        if (stuckRestartTimer === null) {
          stuckRestartTimer = setTimeout(() => {
            stuckRestartTimer = null;
            if (!gameState.isLive && gameState.cpuVsCpu && gameState.status === 'PLAYING' && !kickoffPresentation.active && !freeKickPresentation.active) {
              const kickoffTeam = matchClock.half === 1 ? kickoffSchedule.firstHalfTeam : kickoffSchedule.secondHalfTeam;
              startSoccerRestart('KICK_OFF', kickoffTeam, 0, 0, matchClock.half === 1 ? '1ST HALF KICK-OFF' : '2ND HALF KICK-OFF');
              beginCurrentRestart();
              if (gameState.isKickoff && gameState.kickoffState === 'READY') {
                executeKickoffTouch();
              }
            }
          }, 2000);
        }
      } else {
        clearStuckRestartTimer();
      }
    }

    if (kickoffPresentation.active && !gameState.menuVisible && gameState.status === 'PLAYING') {
      if (elapsed >= kickoffPresentation.fieldRevealAt && gameState.message === 'GET READY') {
        gameState.message = '';
      }

      if (!kickoffPresentation.whistlePlayed && elapsed >= kickoffPresentation.whistleAt) {
        sounds.whistle();
        gameState.message = 'GAME START';
        kickoffPresentation.whistlePlayed = true;
      }

      if (elapsed >= kickoffPresentation.kickoffAt) {
        kickoffPresentation.active = false;
        gameState.message = 'GAME START';
        beginCurrentRestart();
        setTimeout(() => {
          if (gameState.message === 'GAME START' && gameState.isLive) {
            gameState.message = '';
          }
        }, 900);
        if (kickoffPresentation.autoKick && gameState.isKickoff && gameState.kickoffState === 'READY') {
          executeKickoffTouch();
        }
      }
    }

    if (freeKickPresentation.active && !gameState.menuVisible && gameState.status === 'PLAYING') {
      const foulSpot = freeKickPresentation.foulSpot;
      const taker = freeKickPresentation.taker;
      const receiver = freeKickPresentation.receiver;
      const team = soccerRestart.team;
      const attackSign = teamAttacksRight(team) ? 1 : -1;
      const holdTarget = foulSpot.clone().add(new THREE.Vector3(-attackSign * 0.42, 0, 0));

      ballState.heldBy = null;
      ballState.lastHeldBy = null;
      ballState.isFlying = false;
      ballState.isRolling = false;
      ballState.vel.set(0, 0, 0);
      ballState.pos.copy(foulSpot);

      if (taker) {
        const walkDuration = Math.max(0.01, freeKickPresentation.restartAt - freeKickPresentation.startedAt);
        const walkProgress = THREE.MathUtils.clamp((elapsed - freeKickPresentation.startedAt) / walkDuration, 0, 1);
        const easedWalk = THREE.MathUtils.smoothstep(walkProgress, 0, 1);
        const scriptedPos = freeKickPresentation.takerStart.clone().lerp(holdTarget, easedWalk);
        const prevPos = taker.pos.clone();
        taker.pos.copy(scriptedPos);
        taker.pos.y = 0.15;
        taker.vel.copy(scriptedPos.clone().sub(prevPos).multiplyScalar(1 / Math.max(dt, 0.0001)));
        taker.dir = attackSign;
      }

      if (receiver) {
        receiver.dir = attackSign;
      }

      if (!freeKickPresentation.whistlePlayed && elapsed >= freeKickPresentation.whistleAt) {
        sounds.whistle();
        freeKickPresentation.whistlePlayed = true;
      }
      if (elapsed >= freeKickPresentation.restartAt) {
        const passTarget = receiver
          || players.find((p: any) => p.team === team && p !== taker && !isGoalkeeper(p))
          || players.find((p: any) => p.team === team && p !== taker)
          || null;
        freeKickPresentation.active = false;
        beginCurrentRestart();
        const passer = ballState.heldBy;
        if (passer && passTarget && passer !== passTarget) {
          executeAIGroundPass(passer, passTarget, elapsed, { style: 'WALL', receiverWindow: 1.6 });
          if (passTarget.team === 'A') autoSelectTeamA(passTarget);
          gameState.message = '';
        }
      }
    }

    // Throw-in presentation: hold ball above head, then throw to teammate
    if (throwInPresentation.active && throwInPresentation.thrower) {
      const thrower = throwInPresentation.thrower;
      // Keep ball above thrower's head during hold
      ballState.pos.copy(thrower.pos);
      ballState.pos.y = 1.1;
      ballState.vel.set(0, 0, 0);
      // Force arms-up idle frame (index 2)
      thrower.state = 'IDLE';
      thrower.idleFrames.forEach((f: any, i: number) => f.visible = i === 2);
      thrower.runFrames.forEach((f: any) => f.visible = false);
      thrower.frame = 2;

      if (elapsed >= throwInPresentation.throwAt) {
        // Execute the throw-in
        const team = thrower.team as 'A' | 'B';
        const teammates = players.filter((p: any) => p.team === team && p !== thrower && !isGoalkeeper(p));
        const target = teammates
          .slice()
          .sort((a: any, b: any) => a.pos.distanceTo(thrower.pos) - b.pos.distanceTo(thrower.pos))[0]
          || players.find((p: any) => p.team === team && p !== thrower)
          || null;
        throwInPresentation.active = false;
        throwInPresentation.thrower = null;
        if (target) {
          const throwDir = new THREE.Vector3().subVectors(target.pos, thrower.pos);
          throwDir.y = 0;
          if (throwDir.lengthSq() < 0.01) throwDir.set(teamAttacksRight(team) ? 1 : -1, 0, 0);
          const throwDist = throwDir.length();
          throwDir.normalize();
          const weather = getActiveWeatherPreset();
          ballState.lastHeldBy = thrower;
          ballState.heldBy = null;
          ballState.isFlying = true;
          ballState.isRolling = false;
          ballState.isShot = false;
          ballState.receiveLockUntil = elapsed + 0.14;
          ballState.possessionLockUntil = elapsed + 0.18;
          setIntendedReceiver(target, team, elapsed, 2.2);
          ballState.pos.copy(thrower.pos);
          ballState.pos.y = 1.1;
          const throwSpeed = THREE.MathUtils.clamp(9.0 + throwDist * 0.3, 9.0, 16.0) * GAME_SPEED_SCALE * weather.passSpeedMul;
          ballState.vel.copy(throwDir.multiplyScalar(throwSpeed));
          ballState.vel.y = THREE.MathUtils.clamp(2.2 + throwDist * 0.04, 2.2, 4.0);
          soccerRestart.lastTouchTeam = team;
          showPlayPatternTag('THROW-IN', 'rgba(180,220,255,0.96)');
          sounds.throw();
        }
      }
    }

    // Penalty presentation: position kicker & GK, then execute the penalty shot
    if (penaltyPresentation.active && !gameState.menuVisible && gameState.status === 'PLAYING') {
      const spotX = penaltyPresentation.penaltySpotX;
      const attackingTeam = soccerRestart.team;
      const defendingTeam: 'A' | 'B' = attackingTeam === 'A' ? 'B' : 'A';
      const attackRight = teamAttacksRight(attackingTeam);
      const goalX = attackRight ? FIELD_W / 2 : -FIELD_W / 2;
      const approachSign = attackRight ? -1 : 1;

      // Select kicker once (best outfield shooter on the attacking team)
      if (!penaltyPresentation.kicker) {
        const candidates = players
          .filter((p: any) => p.team === attackingTeam && !isGoalkeeper(p))
          .sort((a: any, b: any) => getShotSkill(b) - getShotSkill(a));
        penaltyPresentation.kicker = candidates[0] || players.find((p: any) => p.team === attackingTeam) || null;
      }

      const kicker = penaltyPresentation.kicker;

      // Position kicker a few yards behind the penalty spot
      if (kicker) {
        kicker.pos.x = spotX + approachSign * 3 * X_PER_YARD;
        kicker.pos.z = 0;
        kicker.pos.y = 0.15;
      }

      // Position defending goalkeeper centered on the goal line
      const defGK = players.find((p: any) => p.team === defendingTeam && isGoalkeeper(p));
      if (defGK) {
        defGK.pos.x = goalX + (attackRight ? -0.4 : 0.4);
        defGK.pos.z = 0;
        defGK.pos.y = 0.15;
      }

      // Move all non-kicker, non-GK players behind the penalty mark and outside the box
      const penaltyArcDist = 10 * X_PER_YARD;
      players.forEach((p: any) => {
        if (p === kicker || p === defGK) return;
        // Push behind the penalty spot (away from the goal being attacked)
        const behindX = spotX + approachSign * penaltyArcDist;
        const side = (p.homePos?.z || p.pos.z) >= 0 ? 1 : -1;
        const spreadZ = penaltyHalfZ * 0.5 + Math.random() * penaltyHalfZ * 0.5;
        p.pos.x = behindX + approachSign * Math.random() * 2;
        p.pos.z = side * spreadZ;
        p.pos.y = 0.15;
      });

      // Keep ball on penalty spot
      ballState.pos.set(spotX, 0.15, 0);
      ballState.vel.set(0, 0, 0);
      ballState.heldBy = null;

      // Whistle
      if (!penaltyPresentation.whistlePlayed && elapsed >= penaltyPresentation.whistleAt) {
        sounds.whistle();
        penaltyPresentation.whistlePlayed = true;
      }

      // Execute the penalty shot
      if (!penaltyPresentation.shotTaken && elapsed >= penaltyPresentation.shotAt) {
        penaltyPresentation.shotTaken = true;
        penaltyPresentation.active = false;

        // Give ball to kicker, make game live, then take the shot
        gameState.isLive = true;
        gameState.message = '';
        if (kicker) {
          // Move kicker to the ball
          kicker.pos.x = spotX;
          kicker.pos.z = 0;
          ballState.heldBy = kicker;
          ballState.lastHeldBy = kicker;
          soccerRestart.lastTouchTeam = attackingTeam;

          // Take a high-quality penalty shot aimed at the corners
          const shotSkill = getShotSkill(kicker);
          const composure = THREE.MathUtils.clamp(shotSkill * 0.9 + 0.1, 0.4, 0.98);
          const cornerSide = Math.random() < 0.5 ? 1 : -1;
          const cornerBias = THREE.MathUtils.lerp(0.30, 0.46, composure) * cornerSide;
          const aimZ = THREE.MathUtils.clamp(
            cornerBias * goalMouthWidth,
            -goalMouthWidth * 0.48,
            goalMouthWidth * 0.48,
          );
          // Aim mid-to-low height
          const aimY = THREE.MathUtils.lerp(0.3, 1.4, Math.random());
          const targetPos = new THREE.Vector3(goalX, aimY, aimZ);
          const dx = targetPos.x - spotX;
          const dz = targetPos.z;
          const distH = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
          const weather = getActiveWeatherPreset();
          const speedH = THREE.MathUtils.lerp(22, 28, composure) * GAME_SPEED_SCALE * weather.shotSpeedMul;
          const time = distH / speedH;
          const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
          vel.y = THREE.MathUtils.clamp((targetPos.y - 0.24 + 4.9 * time * time) / time, 1.0, 5.5);

          // Small aim error based on composure
          const aimErr = (Math.random() * 2 - 1) * THREE.MathUtils.lerp(0.12, 0.02, composure);
          vel.z += aimErr * speedH * 0.08;

          ballState.heldBy = null;
          ballState.lastHeldBy = kicker;
          ballState.isFlying = true;
          ballState.isRolling = false;
          ballState.isShot = true;
          ballState.shotByTeam = attackingTeam;
          ballState.pos.set(spotX, 0.24, 0);
          ballState.vel.copy(vel);
          ballState.receiveLockUntil = elapsed + 0.2;
          ballState.possessionLockUntil = elapsed + 0.25;
          recordShot(attackingTeam);
          showPlayPatternTag('PENALTY', 'rgba(255,80,80,0.96)');
          sounds.throw();
        }
        penaltyPresentation.kicker = null;
      }
    }

    const { controlA, controlB } = getHumanControlFlags();

    const activeBannerMessage = gameState.menuVisible
      ? ''
      : (kickoffPresentation.active
        ? gameState.message
        : ((gameState.isKickoff && !gameState.isLive)
        ? 'PRESS SPACE TO KICK OFF'
        : gameState.message));

    if (activeBannerMessage !== lastMessage) {
      lastMessage = activeBannerMessage;
      if (activeBannerMessage) {
        messageOverlay.childNodes.forEach(n => { if (n !== messageReasonEl) n.remove(); });
        messageOverlay.insertBefore(document.createTextNode(activeBannerMessage), messageReasonEl);
        messageReasonEl.textContent = gameState.messageReason || '';
        messageReasonEl.style.display = gameState.messageReason ? 'block' : 'none';
        messageOverlay.classList.remove('game-message-anim');
        // Trigger reflow
        void messageOverlay.offsetWidth;
        messageOverlay.classList.add('game-message-anim');
        messageOverlay.style.opacity = '1';
      } else {
        messageOverlay.classList.remove('game-message-anim');
        messageOverlay.style.opacity = '0';
        gameState.messageReason = '';
      }
    }

    const qb = offenseTeam.find((p: any) => (p.displayRole || p.role) !== 'GK') || offenseTeam[0];
    const qbPos = qb ? qb.pos : new THREE.Vector3();

    if (matchClock.phase === 'HALFTIME') {
      matchClock.halftimeBreakRemaining -= dt;
      if (matchClock.halftimeBreakRemaining <= 0) {
        matchClock.phase = 'SECOND_HALF';
        matchClock.half = 2;
        matchClock.elapsedInHalf = 0;
        startSoccerRestart('KICK_OFF', kickoffSchedule.secondHalfTeam, 0, 0, '2ND HALF KICK-OFF');
      }
    }

    updateTimerDisplay();

    if (gameState.status === 'PLAYING') {
      if (gameState.isLive && (matchClock.phase === 'FIRST_HALF' || matchClock.phase === 'SECOND_HALF')) {
        matchClock.elapsedInHalf += dt;
        const halfLimit = getHalfDurationSeconds() + getStoppageSeconds();
        if (matchClock.elapsedInHalf >= halfLimit) {
          matchClock.elapsedInHalf = halfLimit;
          if (matchClock.phase === 'FIRST_HALF') {
            matchClock.phase = 'HALFTIME';
            matchClock.halftimeBreakRemaining = HALFTIME_BREAK_SECONDS;
            gameState.status = 'START';
            gameState.isLive = false;
            gameState.message = 'HALFTIME';
            setupFormation();
          } else {
            matchClock.phase = 'FULL_TIME';
            gameState.status = 'START';
            gameState.isLive = false;
            gameState.message = 'FULL TIME';
          }
          updateTimerDisplay();
        }
      }

      // Update trajectory indicator and charging logic
        if (gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A') {
          const target = getSelectedPassTarget();
        if (target) {
          if (gameState.isChargingPass) {
            trajectoryIndicator.visible = false;
            chargeLine.visible = true;
            
            // Increment progress - takes about 1.5 seconds to reach target
            gameState.passChargeProgress = Math.min(1.0, gameState.passChargeProgress + dt * 0.66);
            
            const startPos = ballState.pos.clone();
            // Current target point moves from offset towards receiver's LEAD position
            const leadPos = calculateLeadPosition(startPos, target);
            const currentOffset = gameState.passChargeOffset.clone().multiplyScalar(1.0 - gameState.passChargeProgress);
            const targetPoint = leadPos.clone().add(currentOffset);
            
            chargeLine.geometry.setFromPoints([startPos, targetPoint]);
            
            // Color transition: Red (0) to Green (1)
            const color = new THREE.Color().setHSL(gameState.passChargeProgress * 0.35, 1, 0.5);
            chargeLineMat.color.copy(color);

            if (gameState.passChargeProgress >= 1.0) {
              gameState.isPassLocked = true;
              chargeCircle.visible = true;
              chargeCircle.position.copy(leadPos).y = 0.1;
            } else {
              gameState.isPassLocked = false;
              chargeCircle.visible = false;
            }
          } else {
            chargeLine.visible = false;
            chargeCircle.visible = false;
            gameState.isPassLocked = false;
            trajectoryIndicator.visible = true;
            const startPos = ballState.pos.clone();
            const leadPos = calculateLeadPosition(startPos, target);
            
            // Calculate horizontal distance and time
            const dx = leadPos.x - startPos.x;
            const dz = leadPos.z - startPos.z;
            const distH = Math.sqrt(dx * dx + dz * dz);
            const speedH = 18;
            const time = distH / speedH;
            
            // Horizontal velocity
            const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
            // Vertical velocity to hit target at y=1.2 (chest height)
            // y = y0 + vy*t - 0.5*g*t^2  => 1.2 = 1.2 + vy*t - 4.9*t^2 => vy = 4.9*t
            vel.y = 4.9 * time;
            
            const accuracy = calculatePassingAccuracy(ballState.heldBy, target);
            const color = new THREE.Color().setHSL(accuracy * 0.35, 1, 0.5); // Green to Red

            for (let i = 0; i < trajectoryIndicator.children.length; i++) {
              const t = (i / trajectoryIndicator.children.length) * time;
              const dot = trajectoryIndicator.children[i] as THREE.Mesh;
              const p = startPos.clone()
                .addScaledVector(vel, t)
                .addScaledVector(new THREE.Vector3(0, -9.8, 0), 0.5 * t * t);
              dot.position.copy(p);
              (dot.material as THREE.MeshBasicMaterial).color.copy(color);
              dot.scale.setScalar(0.5 + accuracy * 0.8);
            }
          }
        } else {
          trajectoryIndicator.visible = false;
          chargeLine.visible = false;
        }
      } else {
        trajectoryIndicator.visible = false;
        chargeLine.visible = false;
      }

      const carryingBall = !!ballState.heldBy && ballState.heldBy.team === 'A';
            // --- Shot charge indicator ---
      // --- Shot charge indicator ---
      if (gameState.isChargingShot && !ballState.heldBy) {
        // Possession lost mid-charge – cancel
        gameState.isChargingShot = false;
        gameState.shotChargeProgress = 0;
        shotArcGroup.visible = false;
        shotPowerRing.visible = false;
        shotTargetMarker.visible = false;
      } else if (gameState.isChargingShot && ballState.heldBy) {
              gameState.shotChargeProgress = Math.min(1.0, gameState.shotChargeProgress + dt * 1.1);
              const power = 0.55 + gameState.shotChargeProgress * 0.85;
              const arc = computeShotArc(ballState.heldBy, power);
              // Color: green (weak) → yellow → red (full power)
              const hue = (1 - gameState.shotChargeProgress) * 0.33; // 0.33=green, 0=red
              const arcColor = new THREE.Color().setHSL(hue, 1.0, 0.55);
              shotArcGroup.visible = true;
              for (let i = 0; i < SHOT_ARC_DOT_COUNT; i++) {
                const t = ((i + 1) / SHOT_ARC_DOT_COUNT) * arc.time;
                const dot = shotArcGroup.children[i] as THREE.Mesh;
                const p = arc.startPos.clone()
                  .addScaledVector(arc.vel, t)
                  .addScaledVector(new THREE.Vector3(0, -9.8, 0), 0.5 * t * t);
                p.y = Math.max(p.y, 0.15);
                dot.position.copy(p);
                const dotScale = 0.6 + (i / SHOT_ARC_DOT_COUNT) * 0.9 * gameState.shotChargeProgress;
                dot.scale.setScalar(dotScale);
                (dot.material as THREE.MeshBasicMaterial).color.copy(arcColor);
                (dot.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * (i / SHOT_ARC_DOT_COUNT);
              }
              // Power ring around shooter – grows with charge
              const ringScale = 0.5 + gameState.shotChargeProgress * 1.5;
              shotPowerRing.visible = true;
              shotPowerRing.position.copy(ballState.heldBy.pos);
              shotPowerRing.position.y = 0.12;
              shotPowerRing.scale.setScalar(ringScale);
              shotRingMat.color.copy(arcColor);
              // Target marker floating at goal mouth
              shotTargetMarker.visible = true;
              shotTargetMarker.position.copy(arc.targetPos);
              shotTargetMarker.rotation.x = -Math.PI / 2;
              const targetScale = 0.7 + gameState.shotChargeProgress * 1.1;
              shotTargetMarker.scale.setScalar(targetScale);
              shotTargetMat.color.copy(arcColor);
              shotTargetMat.opacity = 0.5 + 0.4 * gameState.shotChargeProgress;
            } else if (!gameState.isChargingShot) {
              shotArcGroup.visible = false;
              shotPowerRing.visible = false;
              shotTargetMarker.visible = false;
            }

      const moveSpeed = (carryingBall ? (gameState.isChargingPass ? 4.8 : 5.8) : 6.5) * GAME_SPEED_SCALE;
      const accel = 40.0;
      
      // Get camera's right vector (horizontal on screen)
      const right = new THREE.Vector3();
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      right.y = 0;
      right.normalize();
      
      // Get camera's forward vector (vertical on screen)
      const forward = new THREE.Vector3();
      forward.crossVectors(right, new THREE.Vector3(0, 1, 0)).negate().normalize();

      // Fallback if camera is looking straight down/up
      if (right.lengthSq() < 0.01 || forward.lengthSq() < 0.01) {
        forward.set(0, 0, -1);
        right.set(1, 0, 0);
      }

      const targetVel = new THREE.Vector3(0, 0, 0);
      if (controlA) {
        if (keys['w'] || keys['W']) targetVel.addScaledVector(forward, moveSpeed);
        if (keys['s'] || keys['S']) targetVel.addScaledVector(forward, -moveSpeed);
        if (keys['a'] || keys['A']) targetVel.addScaledVector(right, -moveSpeed);
        if (keys['d'] || keys['D']) targetVel.addScaledVector(right, moveSpeed);
      }

      // Determine which player the user is controlling
      let controlledPlayer;
      const teamAField = players.filter((p: any) => p.team === 'A' && !isGoalkeeper(p));
      if (gameState.isKickoff) {
        if (ballState.heldBy && ballState.heldBy.team === 'A') {
          controlledPlayer = ballState.heldBy;
        } else {
          controlledPlayer = teamAField[Math.min(gameState.selectedKickoffPlayerIndex, Math.max(0, teamAField.length - 1))]
            || players.find((p: any) => p.team === 'A')
            || players[0];
        }
      } else if (ballState.heldBy && ballState.heldBy.team === 'A') {
        controlledPlayer = ballState.heldBy;
      } else {
        // Auto-select nearest Team A field player to ball (unless manual override active)
        if (gameState.manualSelectCooldown > 0) {
          gameState.manualSelectCooldown -= dt;
        } else {
          if (teamAField.length > 0) {
            let nearestIdx = 0;
            let nearestDist = Infinity;
            teamAField.forEach((p: any, idx: number) => {
              const d = p.pos.distanceTo(ballState.pos);
              if (d < nearestDist) { nearestDist = d; nearestIdx = idx; }
            });
            gameState.humanPlayerIndex = nearestIdx;
          }
        }
        gameState.humanPlayerIndex = Math.min(gameState.humanPlayerIndex, teamAField.length - 1);
        controlledPlayer = teamAField[gameState.humanPlayerIndex]
          || players.find((p: any) => p.team === 'A')
          || players[0];
      }
      const cpPos = controlledPlayer.pos;

      if (controlA) {
        // Smooth acceleration for controlled player
        controlledPlayer.vel.lerp(targetVel, dt * 5.0);

        // Move controlled player
        if (controlledPlayer.vel.lengthSq() > 0.01) {
          controlledPlayer.pos.addScaledVector(controlledPlayer.vel, dt);
          controlledPlayer.pos.x = THREE.MathUtils.clamp(controlledPlayer.pos.x, -FIELD_W / 2, FIELD_W / 2);
          controlledPlayer.pos.z = THREE.MathUtils.clamp(controlledPlayer.pos.z, -FIELD_D / 2, FIELD_D / 2);
        }
      }

      // Player 2 (Team B) hot seat mode
      let controlledPlayerB: any = null;
      if (controlB) {
        const teamBField = players.filter((p: any) => p.team === 'B' && !isGoalkeeper(p));
        if (ballState.heldBy && ballState.heldBy.team === 'B') {
          controlledPlayerB = ballState.heldBy;
        } else {
          if (gameState.manualSelectCooldownB > 0) {
            gameState.manualSelectCooldownB -= dt;
          } else if (teamBField.length > 0) {
            let nearestIdx = 0, nearestDist = Infinity;
            teamBField.forEach((p: any, idx: number) => {
              const d = p.pos.distanceTo(ballState.pos);
              if (d < nearestDist) { nearestDist = d; nearestIdx = idx; }
            });
            gameState.humanPlayerIndexB = nearestIdx;
          }
          gameState.humanPlayerIndexB = Math.min(gameState.humanPlayerIndexB, teamBField.length - 1);
          controlledPlayerB = teamBField[gameState.humanPlayerIndexB] || null;
        }
        if (controlledPlayerB) {
          setPlayerAIState(controlledPlayerB, 'USER_CONTROL');
          const bMoveSpeed = (ballState.heldBy === controlledPlayerB ? 5.8 : 6.5) * GAME_SPEED_SCALE;
          const targetVelB = new THREE.Vector3(0, 0, 0);
          if (keys['arrowup']) targetVelB.addScaledVector(forward, bMoveSpeed);
          if (keys['arrowdown']) targetVelB.addScaledVector(forward, -bMoveSpeed);
          if (keys['arrowleft']) targetVelB.addScaledVector(right, -bMoveSpeed);
          if (keys['arrowright']) targetVelB.addScaledVector(right, bMoveSpeed);
          controlledPlayerB.vel.lerp(targetVelB, dt * 5.0);
          if (controlledPlayerB.vel.lengthSq() > 0.01) {
            controlledPlayerB.pos.addScaledVector(controlledPlayerB.vel, dt);
            controlledPlayerB.pos.x = THREE.MathUtils.clamp(controlledPlayerB.pos.x, -FIELD_W / 2, FIELD_W / 2);
            controlledPlayerB.pos.z = THREE.MathUtils.clamp(controlledPlayerB.pos.z, -FIELD_D / 2, FIELD_D / 2);
          }
        }
      }

      if (gameState.isLive) {
        if (gameState.goalKickInProgress && !ballState.heldBy && (ballState.isFlying || ballState.isRolling)) {
          gameState.goalKickInProgress = false;
        }
        players.forEach((p: any) => setPlayerAIState(p, 'IDLE'));
        if (controlA && controlledPlayer) setPlayerAIState(controlledPlayer, 'USER_CONTROL');
        if (controlB && controlledPlayerB) setPlayerAIState(controlledPlayerB, 'USER_CONTROL');
        const aiStyle = getActiveAIStyle();
        // Loose-ball pursuit and offense decision-making.
        if (!ballState.heldBy) {
          const looseBallTarget = ballState.isFlying
            ? ballState.pos.clone().addScaledVector(ballState.vel, 0.35)
            : ballState.pos.clone();
          looseBallTarget.y = 0.15;
          const looseBallInCornerChannel = Math.abs(looseBallTarget.z) > FIELD_D * 0.42 && Math.abs(looseBallTarget.x) > FIELD_W * 0.3;

          const cpuTeams: Array<'A' | 'B'> = [];
          if (!controlA) cpuTeams.push('A');
          if (!controlB) cpuTeams.push('B');

          cpuTeams.forEach((team) => {
            const fieldPlayers = players.filter((p: any) => p.team === team && !isGoalkeeper(p));
            if (fieldPlayers.length === 0) return;
            const maxCornerChasers = looseBallInCornerChannel ? 1 : aiStyle.looseBallChasers;
            const chasers = fieldPlayers
              .slice()
              .sort((a: any, b: any) => a.pos.distanceTo(looseBallTarget) - b.pos.distanceTo(looseBallTarget))
              .slice(0, maxCornerChasers);
            chasers.forEach((p: any, idx: number) => {
              const chaseSpeed = (idx === 0 ? aiStyle.chaseSpeedLead : aiStyle.chaseSpeedSupport) * GAME_SPEED_SCALE;
              setPlayerAIState(p, 'CHASE_LOOSE_BALL');
              steerPlayerTowards(p, looseBallTarget, dt, chaseSpeed, 32, 4.8, 0.05);
            });
          });

          // Help nearby teammates react to second balls even when one side is user-controlled.
          // This avoids freeze-like moments where multiple players stand near a loose ball.
          const humanAssistTeams: Array<{ team: 'A' | 'B'; controlled: any | null }> = [];
          if (controlA) humanAssistTeams.push({ team: 'A', controlled: controlledPlayer || null });
          if (controlB) humanAssistTeams.push({ team: 'B', controlled: controlledPlayerB || null });

          humanAssistTeams.forEach(({ team, controlled }) => {
            const helpers = players
              .filter((p: any) => p.team === team && !isGoalkeeper(p) && p !== controlled)
              .slice()
              .sort((a: any, b: any) => a.pos.distanceTo(looseBallTarget) - b.pos.distanceTo(looseBallTarget))
              .slice(0, looseBallInCornerChannel ? 1 : Math.max(1, Math.min(2, aiStyle.looseBallChasers - 1)));

            helpers.forEach((p: any, idx: number) => {
              const toBall = new THREE.Vector3().subVectors(looseBallTarget, p.pos);
              toBall.y = 0;
              const dist = toBall.length();
              const reactRadius = ballState.isFlying ? 22 : 16;
              if (dist < 0.05 || dist > reactRadius) return;

              const assistSpeedBase = ballState.isFlying ? 6.8 : 6.0;
              const assistSpeed = (assistSpeedBase + (idx === 0 ? 0.55 : 0)) * GAME_SPEED_SCALE;
              setPlayerAIState(p, 'SUPPORT_LOOSE_BALL');
              steerPlayerTowards(p, looseBallTarget, dt, assistSpeed, 28, 4.4, 0.05);
            });
          });
        }

        const cpuCarrier = ballState.heldBy && !throwInPresentation.active && !penaltyPresentation.active && ((ballState.heldBy.team === 'A' && !controlA) || (ballState.heldBy.team === 'B' && !controlB))
          ? ballState.heldBy
          : null;
        if (cpuCarrier) {
          const team = cpuCarrier.team as 'A' | 'B';
          const attackSign = teamAttacksRight(team) ? 1 : -1;
          const goalX = attackSign > 0 ? FIELD_W / 2 : -FIELD_W / 2;
          const distToGoal = Math.abs(goalX - cpuCarrier.pos.x);
          const teammates = players.filter((p: any) => p.team === team && p !== cpuCarrier && !isGoalkeeper(p));
          const opponents = players.filter((p: any) => p.team !== team && !isGoalkeeper(p));
          const cooldownKey = team === 'A' ? 'cpuDecisionCooldownA' : 'cpuDecisionCooldownB';

          if (isGoalkeeper(cpuCarrier)) {
            // Panic-press override: 3+ opponents within 6.5 m → cut distribution delay to ≤0.3 s
            const panicPressure = opponents.filter((opp: any) => opp.pos.distanceTo(cpuCarrier.pos) < 6.5).length;
            if (panicPressure >= 3) {
              (gameState as any)[cooldownKey] = Math.min((gameState as any)[cooldownKey], 0.3);
            }
            if ((gameState as any)[cooldownKey] <= 0 && teammates.length > 0) {
              const progressiveTarget = teammates
                .slice()
                .sort((a: any, b: any) => {
                  const aProg = (a.pos.x - cpuCarrier.pos.x) * attackSign;
                  const bProg = (b.pos.x - cpuCarrier.pos.x) * attackSign;
                  return bProg - aProg;
                })[0] || teammates[0];
              const safeOutlet = teammates
                .filter((p: any) => ['CB', 'LB', 'RB', 'DM'].includes((p.displayRole || p.role || '').toString().toUpperCase()))
                .slice()
                .sort((a: any, b: any) => a.pos.distanceTo(cpuCarrier.pos) - b.pos.distanceTo(cpuCarrier.pos))[0] || null;

              const nearbyPressure = opponents.filter((opp: any) => opp.pos.distanceTo(cpuCarrier.pos) < 8).length;
              const weather = getActiveWeatherPreset();
              const forceLongGoalKick = gameState.goalKickInProgress;
              const keeperStillHoldingBeforePass = ballState.heldBy === cpuCarrier;
              const target = nearbyPressure <= 1 && safeOutlet ? safeOutlet : progressiveTarget;
              const canThrowOutlet = !!safeOutlet && nearbyPressure <= 1 && safeOutlet.pos.distanceTo(cpuCarrier.pos) < 18;

              // Distribution style matrix:
              // calm -> throw/driven/sidewinder, medium pressure -> drop-kick mix, high pressure -> punt/drop-kick.
              let selectedKickStyle: 'GOAL_KICK_STANDARD' | 'PUNT' | 'DROP_KICK' | 'SIDEWINDER' | 'DRIVEN_KICK' = 'DRIVEN_KICK';
              const outlet = safeOutlet || target;
              const outletWidth = outlet ? Math.abs(outlet.pos.z - cpuCarrier.pos.z) : 0;
              const outletDist = outlet ? outlet.pos.distanceTo(cpuCarrier.pos) : 22;
              const outletProgress = outlet ? (outlet.pos.x - cpuCarrier.pos.x) * attackSign : 0;
              const hasReliableOutlet = !!safeOutlet && outletDist < 20;

              if (forceLongGoalKick) {
                selectedKickStyle = 'GOAL_KICK_STANDARD';
              } else if (nearbyPressure >= 3) {
                selectedKickStyle = Math.random() < 0.72 ? 'PUNT' : 'DROP_KICK';
              } else if (nearbyPressure === 2) {
                const roll = Math.random();
                if (roll < 0.52) selectedKickStyle = 'DROP_KICK';
                else if (roll < 0.77) selectedKickStyle = 'PUNT';
                else selectedKickStyle = outletWidth > 8 ? 'SIDEWINDER' : 'DRIVEN_KICK';
              } else if (nearbyPressure === 1) {
                const roll = Math.random();
                if (hasReliableOutlet && roll < 0.22) selectedKickStyle = 'SIDEWINDER';
                else if (roll < 0.58) selectedKickStyle = 'DRIVEN_KICK';
                else if (roll < 0.84) selectedKickStyle = 'DROP_KICK';
                else selectedKickStyle = 'PUNT';
              } else {
                const roll = Math.random();
                if (hasReliableOutlet && roll < 0.4) selectedKickStyle = outletWidth > 8 ? 'SIDEWINDER' : 'DRIVEN_KICK';
                else if (roll < 0.72) selectedKickStyle = 'DRIVEN_KICK';
                else if (roll < 0.88) selectedKickStyle = 'SIDEWINDER';
                else selectedKickStyle = outletProgress > 14 ? 'DROP_KICK' : 'DRIVEN_KICK';
              }

              const preferThrow =
                canThrowOutlet &&
                !forceLongGoalKick &&
                nearbyPressure === 0 &&
                outletDist < 16 &&
                Math.random() < 0.42;

              if (preferThrow) {
                const throwDir = new THREE.Vector3().subVectors(safeOutlet!.pos, cpuCarrier.pos);
                throwDir.y = 0;
                if (throwDir.lengthSq() < 0.01) throwDir.set(attackSign, 0, 0);
                const throwDist = throwDir.length();
                throwDir.normalize();
                ballState.lastHeldBy = cpuCarrier;
                ballState.heldBy = null;
                gameState.goalKickInProgress = false;
                ballState.isFlying = true;
                ballState.isRolling = false;
                ballState.isShot = false;
                ballState.receiveLockUntil = elapsed + 0.15;
                setIntendedReceiver(safeOutlet, team, elapsed, 1.9);
                ballState.pos.copy(cpuCarrier.pos).addScaledVector(throwDir, 0.38);
                ballState.pos.y = 0.52;
                const throwSpeed = THREE.MathUtils.clamp(10.5 + throwDist * 0.28, 10.5, 15.5) * GAME_SPEED_SCALE * weather.passSpeedMul;
                ballState.vel.copy(throwDir.multiplyScalar(throwSpeed));
                ballState.vel.y = THREE.MathUtils.clamp(2.6 + throwDist * 0.05, 2.6, 4.4);
                ballState.possessionLockUntil = elapsed + 0.2;
                sounds.throw();
              } else {
                executeAIKeeperKick(cpuCarrier, target, elapsed, selectedKickStyle);
              }

              // Safety net: if distribution attempt failed to release possession, force a clearance.
              if (keeperStillHoldingBeforePass && ballState.heldBy === cpuCarrier) {
                const fallbackTarget = progressiveTarget || teammates[0];
                executeAIKeeperKick(cpuCarrier, fallbackTarget, elapsed, 'PUNT');
              }

              (gameState as any)[cooldownKey] = 2.5; // brief re-hold pause after distributing
            }
            // Keeper should distribute, not dribble/shoot.
          }

          if (!isGoalkeeper(cpuCarrier)) {
            // Choose a dribble lane with space instead of blindly running central.
            const carryTarget = chooseAIDribbleTarget(cpuCarrier, team, attackSign, aiStyle.carryBias);
            const carryDir = new THREE.Vector3().subVectors(carryTarget, cpuCarrier.pos);
            carryDir.y = 0;
            if (carryDir.lengthSq() > 0.02) {
              const dribbleSkill = getDribbleSkill(cpuCarrier);
              const carrySpeed = (4.6 + cpuCarrier.stats.speed * 7.6 + dribbleSkill * 1.9) * GAME_SPEED_SCALE;
              setPlayerAIState(cpuCarrier, 'CARRY');
              steerPlayerTowards(cpuCarrier, carryTarget, dt, carrySpeed, 30, 5.6, 0.08);
            }

            if ((gameState as any)[cooldownKey] <= 0) {
              const bestPassTarget = chooseAIPassTarget(cpuCarrier, teammates, team, attackSign);
              const closePressure = opponents.filter((opp: any) => opp.pos.distanceTo(cpuCarrier.pos) < 6.5).length;
              const carryLanePressure = getPassLanePressure(cpuCarrier.pos, carryTarget, team);
              const passSkill = getPassSkill(cpuCarrier);
              const dribbleSkill = getDribbleSkill(cpuCarrier);
              const shotSkill = getShotSkill(cpuCarrier);
              const roleProfile = getRoleDecisionProfile(cpuCarrier);
              const pressurePassBoost = closePressure >= 3 ? 0.34 : (closePressure === 2 ? 0.22 : (closePressure === 1 ? 0.1 : 0));
              const lanePassBoost = carryLanePressure > 2.1 ? 0.16 : (carryLanePressure > 1.1 ? 0.08 : 0);
              const inShootingLane = Math.abs(cpuCarrier.pos.z) < goalMouthWidth * 0.78;
              const inPrimeZone = distToGoal < 16.5 && inShootingLane;
              const inTapInZone = distToGoal < 9.5 && Math.abs(cpuCarrier.pos.z) < goalMouthWidth * 1.1;
              const teamShots = team === 'A' ? gameState.shotsA : gameState.shotsB;
              const teamShotsOnTarget = team === 'A' ? gameState.shotsOnTargetA : gameState.shotsOnTargetB;
              const onTargetRate = teamShots > 0 ? teamShotsOnTarget / teamShots : 0.22;
              const poorAccuracyFactor = THREE.MathUtils.clamp((0.16 - onTargetRate) / 0.16, 0, 1);
              const shotVolumeFactor = THREE.MathUtils.clamp((teamShots - 16) / 36, 0, 1);
              let shotSpamSuppression = poorAccuracyFactor * shotVolumeFactor * 0.55;
              if (inTapInZone) shotSpamSuppression *= 0.15;
              else if (inPrimeZone) shotSpamSuppression *= 0.45;
              const basePassChance = distToGoal > 26 ? aiStyle.passChanceFar : aiStyle.passChanceNear;
              const passChance = THREE.MathUtils.clamp(
                basePassChance
                  + pressurePassBoost
                  + lanePassBoost
                  + shotSpamSuppression * 0.55
                  + (passSkill - 0.5) * 0.34
                  + (roleProfile.progressivePass - 0.5) * 0.22
                  - (dribbleSkill - 0.5) * 0.12
                  - (inPrimeZone ? 0.26 : 0),
                0.08,
                0.88,
              );
              const pressureShotPenalty = inPrimeZone ? closePressure * 0.025 : closePressure * 0.05;
              const shotUrgencyBoost = inTapInZone ? 0.34 : (inPrimeZone ? 0.18 : 0);
              const shootChance = THREE.MathUtils.clamp(
                (distToGoal < 14 ? aiStyle.shootChanceNear : aiStyle.shootChanceFar)
                  - pressureShotPenalty
                  - shotSpamSuppression
                  + (distToGoal < 10 ? 0.18 : (distToGoal < 14 ? 0.08 : 0))
                  + shotUrgencyBoost
                  + (shotSkill - 0.5) * 0.36
                  + roleProfile.shootBias,
                0.14,
                0.94,
              );
              const holdDribbleChance = THREE.MathUtils.clamp(
                (dribbleSkill - 0.5) * 0.24 + (roleProfile.dribbleIntent - 0.5) * 0.22 - closePressure * 0.05,
                -0.25,
                0.26,
              );
              const maxShootDistance = THREE.MathUtils.clamp(roleProfile.shotRange + (shotSkill - 0.5) * 4.5, 8, 23);

            const forceShotNow = inTapInZone && closePressure <= 2;
            const shouldShoot = distToGoal < maxShootDistance && (forceShotNow || Math.random() < shootChance);
            const shouldPass = !shouldShoot && bestPassTarget && (closePressure >= 3 || Math.random() < passChance);
            const shouldHoldDribble = !shouldShoot && !shouldPass && Math.random() < holdDribbleChance;
            const nearTouchline = Math.abs(cpuCarrier.pos.z) > FIELD_D / 2 - 2.2;
            const nearGoalLine = Math.abs(cpuCarrier.pos.x) > FIELD_W / 2 - 2.2;
            const emergencyPass = !shouldShoot && !shouldPass && !!bestPassTarget && (nearTouchline || nearGoalLine);

            // Through-ball check: when not shooting and a through-ball lane exists
            const inCentralChannel = Math.abs(cpuCarrier.pos.z) < 11;
            const throughBallChance = 0.22 + (passSkill - 0.5) * 0.28 + (inCentralChannel ? 0.08 : 0) + (gameState.giveAndGoActive ? 0.1 : 0);
            const throughBallData = !shouldShoot && !inPrimeZone && distToGoal > 14 && distToGoal < 50 && Math.random() < throughBallChance
              ? findThroughBallTarget(cpuCarrier, team, attackSign)
              : null;

            if (shouldShoot) {
              takeShot(cpuCarrier, true);
              (gameState as any)[cooldownKey] = aiStyle.cooldownShoot;
            } else if (throughBallData) {
              // Through-ball: aim pass at the projected space, set intended receiver
              const { player: throughReceiver, throughPos } = throughBallData;
              showPlayPatternTag('THROUGH RUN', 'rgba(255,216,122,0.96)');
              const dir = new THREE.Vector3().subVectors(throughPos, cpuCarrier.pos);
              dir.y = 0;
              const dist = Math.max(0.1, dir.length());
              dir.normalize();
              const weather = getActiveWeatherPreset();
              const angleError = (Math.random() * 2 - 1) * THREE.MathUtils.lerp(0.14, 0.03, passSkill);
              dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleError);
              // Clamp base speed first, then scale by game speed/weather (prevents unintended high minimum speed).
              const distNorm = THREE.MathUtils.clamp((dist - 8) / 28, 0, 1);
              const baseSpeed = THREE.MathUtils.lerp(8.0, 16.2, distNorm);
              const speed = baseSpeed * GAME_SPEED_SCALE * weather.passSpeedMul;
              ballState.lastHeldBy = cpuCarrier;
              ballState.heldBy = null;
              if (gameState.goalKickInProgress) gameState.goalKickInProgress = false;
              ballState.isFlying = false;
              ballState.isRolling = true;
              ballState.isShot = false;
              ballState.receiveLockUntil = elapsed + 0.14;
              setIntendedReceiver(throughReceiver, team, elapsed, 2.2);
              ballState.vel.copy(dir.multiplyScalar(speed));
              ballState.pos.copy(cpuCarrier.pos).addScaledVector(dir, 0.45);
              ballState.pos.y = BALL_GROUND_Y;
              ballState.possessionLockUntil = elapsed + 0.22;
              sounds.throw();
              (gameState as any)[cooldownKey] = aiStyle.cooldownPass;
            } else if ((shouldPass || emergencyPass) && bestPassTarget) {
              // Give-and-go: short pass + sprint forward
              const passDist = cpuCarrier.pos.distanceTo(bestPassTarget.pos);
              const passVec = new THREE.Vector3().subVectors(bestPassTarget.pos, cpuCarrier.pos);
              const forwardProg = passVec.x * attackSign;
              const diagonalWidth = Math.abs(passVec.z);
              const isBackPass = forwardProg < -1.1;
              const isDiagonalPass = diagonalWidth > 8 && forwardProg > 1.5;
              const lanePressureToTarget = getPassLanePressure(cpuCarrier.pos, bestPassTarget.pos, team);
              const centralCongestion = Math.abs(cpuCarrier.pos.z) < 10.5 && closePressure >= 2;
              const tightCentralPocket = Math.abs(cpuCarrier.pos.z) < 8.5 && closePressure >= 3;
              const wingSwitchOpportunity = isDiagonalPass && passDist > 18 && diagonalWidth > 11 && lanePressureToTarget < 2.2;
              const centralComboZone = Math.abs(cpuCarrier.pos.z) < 13;
              const comboPressure = closePressure >= 1;
              const comboChance = THREE.MathUtils.clamp(
                (centralComboZone ? (comboPressure ? 0.68 : 0.44) : 0.26) +
                (centralCongestion ? 0.15 : 0) +
                (tightCentralPocket ? 0.08 : 0),
                0.18,
                0.9,
              );
              const forceQuickOneTwo = tightCentralPocket && passDist < 10.2 && forwardProg > 1.2;
              if (passDist < 13 && !gameState.giveAndGoActive && Math.random() < comboChance) {
                gameState.giveAndGoActive = true;
                gameState.giveAndGoPasser = cpuCarrier;
                gameState.giveAndGoReceiver = bestPassTarget;
                gameState.giveAndGoExpiry = elapsed + 3.5;
                showPlayPatternTag('GIVE + GO', 'rgba(126,226,255,0.96)');
              } else if (forceQuickOneTwo && !gameState.giveAndGoActive) {
                gameState.giveAndGoActive = true;
                gameState.giveAndGoPasser = cpuCarrier;
                gameState.giveAndGoReceiver = bestPassTarget;
                gameState.giveAndGoExpiry = elapsed + 3.2;
                showPlayPatternTag('GIVE + GO', 'rgba(126,226,255,0.96)');
              }
              if (isBackPass) {
                executeAIGroundPass(cpuCarrier, bestPassTarget, elapsed, { style: 'BACK' });
              } else if (passDist > 22 && lanePressureToTarget < 1.65) {
                const longStyle = (wingSwitchOpportunity || diagonalWidth > 10) && Math.random() < 0.72
                  ? 'LONG_LOFTED'
                  : 'LONG_DRIVEN';
                executeAILoftedPass(cpuCarrier, bestPassTarget, elapsed, longStyle);
              } else if (isDiagonalPass) {
                if (passDist > 16 && lanePressureToTarget < 2.3 && Math.random() < (wingSwitchOpportunity ? 0.8 : 0.56)) {
                  executeAILoftedPass(cpuCarrier, bestPassTarget, elapsed, 'LONG_LOFTED');
                } else {
                  executeAIGroundPass(cpuCarrier, bestPassTarget, elapsed, { style: 'DIAGONAL' });
                }
              } else if (gameState.giveAndGoActive && gameState.giveAndGoPasser === cpuCarrier && passDist < 13) {
                executeAIGroundPass(cpuCarrier, bestPassTarget, elapsed, { style: 'WALL' });
              } else if (passDist < 12 && centralCongestion && Math.random() < (tightCentralPocket ? 0.74 : 0.62)) {
                executeAIGroundPass(cpuCarrier, bestPassTarget, elapsed, { style: 'OUTSIDE' });
              } else if (passDist < 11 && closePressure >= 2 && Math.random() < 0.46) {
                executeAIGroundPass(cpuCarrier, bestPassTarget, elapsed, { style: 'OUTSIDE' });
              } else if (passDist > 14) {
                executeAIGroundPass(cpuCarrier, bestPassTarget, elapsed, { style: 'DRIVEN' });
              } else {
                executeAIGroundPass(cpuCarrier, bestPassTarget, elapsed, { style: 'SHORT' });
              }
              (gameState as any)[cooldownKey] = aiStyle.cooldownPass;
            } else if (shouldHoldDribble) {
              (gameState as any)[cooldownKey] = 0.12;
            } else {
              (gameState as any)[cooldownKey] = 0.25;
            }

            // Give-and-go return pass: if give-and-go receiver now has ball, pass back to the sprinting passer
            if (gameState.giveAndGoActive && elapsed < gameState.giveAndGoExpiry &&
                ballState.heldBy === gameState.giveAndGoReceiver && !isGoalkeeper(gameState.giveAndGoReceiver)) {
              const passer = gameState.giveAndGoPasser;
              if (passer && passer.team === team && (gameState as any)[cooldownKey] <= 0) {
                const returnDist = ballState.heldBy.pos.distanceTo(passer.pos);
                const passerIsForward = (passer.pos.x - ballState.heldBy.pos.x) * attackSign > 3;
                if (returnDist < 22 && passerIsForward && Math.random() < 0.74) {
                  executeAIGroundPass(gameState.giveAndGoReceiver, passer, elapsed, { style: 'WALL' });
                  gameState.giveAndGoActive = false;
                  (gameState as any)[cooldownKey] = aiStyle.cooldownPass;
                } else if (returnDist > 20 || elapsed > gameState.giveAndGoExpiry - 0.5) {
                  gameState.giveAndGoActive = false;
                }
              }
            }
            }
          }
        }

        if (enforceKickoffRetakeIfIllegal()) {
          ballGroup.position.copy(ballState.pos);
          updateBallShadowVisual();
          updateHUD();
          if (now - lastMiniMapDrawMs >= MINI_MAP_DRAW_INTERVAL_MS) {
            drawMiniMapOverlay();
            lastMiniMapDrawMs = now;
          }
          renderer.render(scene, camera);
          return;
        }

        if (kickoffLawState.active && !kickoffLawState.firstKickTaken) {
          if (ballState.heldBy === kickoffLawState.kicker) {
            const moved = ballState.pos.distanceTo(kickoffLawState.centerPosition) > 0.45;
            const kickedByPass = ballState.lastHeldBy === kickoffLawState.kicker && (ballState.isFlying || ballState.isRolling);
            if (moved || kickedByPass) {
              kickoffLawState.firstKickTaken = true;
              gameState.kickoffState = 'KICKED';
              gameState.message = '';
            }
          } else if (!ballState.heldBy && ballState.lastHeldBy === kickoffLawState.kicker && (ballState.isFlying || ballState.isRolling)) {
            kickoffLawState.firstKickTaken = true;
            gameState.kickoffState = 'KICKED';
            gameState.message = '';
          }
        }

        // Keepers can use hands to claim any loose ball in their own penalty area.
        const keeperClaim = tryGoalkeeperHandsClaim(elapsed);
        if (keeperClaim && keeperClaim.team === 'A') {
          autoSelectTeamA(keeperClaim);
        }

        // Clear keeper distribution lock once another player touches the ball
        if (ballState.keeperDistributor && ballState.heldBy && ballState.heldBy !== ballState.keeperDistributor) {
          ballState.keeperDistributor = null;
        }

        // Expire counter-attack and transition timers
        if (gameState.counterAttackActive && elapsed > gameState.counterAttackExpiry) {
          gameState.counterAttackActive = false;
        }

        // Off-ball support runs
        playState.activeRoutes.forEach(route => {
          const p = route.player;
          if (!p || (p === controlledPlayer && controlA) || (p === controlledPlayerB && controlB)) return;

          const isAttacker = ['ST', 'LM', 'RM', 'CM'].includes(p.displayRole || p.role);
          const isTransitionTeam = gameState.transitionDefenseTeam === p.team && elapsed < gameState.transitionDefenseExpiry;
          const isCounterTeam = gameState.counterAttackActive && gameState.counterAttackTeam === p.team;

          let supportTarget: THREE.Vector3;
          if (isTransitionTeam && !ballState.heldBy?.team) {
            // Sprint straight home to recover defensive shape
            supportTarget = p.homePos.clone();
          } else {
            supportTarget = getSupportRunTarget(route, controlledPlayer);
          }

          const toTarget = new THREE.Vector3().subVectors(supportTarget, p.pos);
          toTarget.y = 0;
          const dist = toTarget.length();

          if (dist < 0.2) {
            p.vel.lerp(new THREE.Vector3(0, 0, 0), dt * 5.0);
            p.glow.visible = false;
            return;
          }

          const dir = toTarget.normalize();
          let speed = (4.2 + p.stats.speed * 14) * route.speedScale * GAME_SPEED_SCALE;
          if (ballState.heldBy && ballState.heldBy.team === p.team && getSelectedPassTarget() === p && !isGoalkeeper(p)) {
            speed += 0.6;
          }
          // Counter-attack burst: attackers sprint faster into space
          if (isCounterTeam && isAttacker && !isGoalkeeper(p)) speed *= 1.28;
          // Transition defense: losing team sprints home faster
          if (isTransitionTeam) speed *= 1.35;
          p.glow.visible = false;

          if (dist < 2.0) speed *= 0.65;
          else if (dist > 8.0) speed *= 1.08;

          p.vel.lerp(dir.multiplyScalar(speed), dt * (dist > 4 ? 4.8 : 7.0));
          p.pos.addScaledVector(p.vel, dt);
        });

        // Dynamic pressure from the non-possession side.
        const liveCarrier = ballState.heldBy;
        // Goalkeepers holding the ball cannot be challenged (soccer law: keeper in hands, 6-second rule)
        if (liveCarrier && !isGoalkeeper(liveCarrier) && elapsed >= ballState.possessionLockUntil) {
          const aiStyle = getActiveAIStyle();
          const carrierInCornerTrap = Math.abs(liveCarrier.pos.z) > FIELD_D * 0.42 && Math.abs(liveCarrier.pos.x) > FIELD_W * 0.3;
          const maxPressers = carrierInCornerTrap ? Math.min(2, aiStyle.pressureCount) : aiStyle.pressureCount;
          const pressureCandidates = players
            .filter((p: any) => p.team !== liveCarrier.team && !isGoalkeeper(p))
            .filter((p: any) => !(controlB && p === controlledPlayerB) && !(controlA && p === controlledPlayer))
            .sort((a: any, b: any) => a.pos.distanceTo(liveCarrier.pos) - b.pos.distanceTo(liveCarrier.pos))
            .slice(0, maxPressers);

          const carrierAttackSign = teamAttacksRight(liveCarrier.team as 'A' | 'B') ? 1 : -1;
          const carrierOutwardSign = Math.sign(liveCarrier.pos.z || 0) || 1;

          if (
            pressureCandidates.length >= 2 &&
            (elapsed > gameState.defenseCalloutUntil || gameState.defenseCalloutTeam !== pressureCandidates[0].team)
          ) {
            showPlayPatternTag('PRESS + COVER', 'rgba(135,232,183,0.96)');
            gameState.defenseCalloutUntil = elapsed + 2.8;
            gameState.defenseCalloutTeam = pressureCandidates[0].team;
          }

          pressureCandidates.forEach((p: any, idx: number) => {
            // Keep shape: only press if reasonably close to the ball and not too far from home position.
            if (p.pos.distanceTo(liveCarrier.pos) > 14) return;
            if (p.pos.distanceTo(p.homePos) > 22) return;
            let pressureTarget = liveCarrier.pos.clone();
            if (idx === 1) {
              // Second presser blocks the inside lane while the first presser engages ball side.
              pressureTarget.add(new THREE.Vector3(-carrierAttackSign * 2.6, 0, carrierOutwardSign * 2.1));
            } else if (idx >= 2) {
              // Supporting pressers stay compact and staggered around the trap side.
              pressureTarget.add(new THREE.Vector3(-carrierAttackSign * 1.6, 0, carrierOutwardSign * (1.1 + idx * 0.35)));
            }

            const speed = (idx === 0 ? 4.05 : 3.75) * GAME_SPEED_SCALE;
            if (idx === 0) {
              // Force wide: first presser angles body to push carrier toward touchline.
              pressureTarget.z += carrierOutwardSign * 0.9;
            } else {
              pressureTarget.copy(getDefensiveCoverTarget(liveCarrier, p, idx, carrierOutwardSign));
            }
            const distToCarrier = p.pos.distanceTo(liveCarrier.pos);
            const forceSign = getForceDirectionSign(p, liveCarrier);
            const carrierTouchQuality = getCarrierTouchQuality(liveCarrier);
            const heavyTouch = carrierTouchQuality > 0.46;
            const jockeyDistance = idx === 0 ? 1.35 : 1.55;

            if (distToCarrier <= 2.5) {
              // Jockey: stay side-on, contain space, and guide away from goal-side lanes.
              const containTarget = liveCarrier.pos.clone();
              containTarget.add(new THREE.Vector3(-carrierAttackSign * 0.55, 0, forceSign * 1.1));
              const containSpeed = (idx === 0 ? 3.35 : 3.05) * GAME_SPEED_SCALE;
              setPlayerAIState(p, 'JOCKEY');
              steerPlayerTowards(p, containTarget, dt, containSpeed, 18, 2.6, 0.05);
              if (distToCarrier < jockeyDistance && !heavyTouch) {
                p.vel.multiplyScalar(Math.max(0, 1 - dt * 7.2));
              }
            } else {
              const supportState = idx === 0 ? 'PRESS_PRIMARY' : (idx === 1 ? 'COVER_SHADOW' : 'CUT_PASS_LANE');
              setPlayerAIState(p, supportState);
              steerPlayerTowards(p, pressureTarget, dt, speed, 26, 3.2, 0.06);
            }

            if (idx === 0 && Math.abs(liveCarrier.pos.z) > FIELD_D * 0.24 && p.pos.distanceTo(liveCarrier.pos) < 3.2) {
              showPlayPatternTag('FORCE WIDE TRAP', 'rgba(255,153,153,0.97)');
            }

            if (distToCarrier < 1.02) {
              if (maybeCallSoccerFoul(p, liveCarrier, dt, elapsed)) return;
              const challengeWindow = heavyTouch || (distToCarrier < 0.78 && carrierTouchQuality > 0.26);
              if (!challengeWindow || p.tackleCooldown > 0) return;
              const speedDiff = p.stats.speed - liveCarrier.stats.speed;
              const rawWinChance = 0.28 + (p.stats.coverage * 0.2) - (liveCarrier.stats.carrying * 0.12) + (speedDiff * 1.8);
              const winChance = THREE.MathUtils.clamp(rawWinChance + carrierTouchQuality * 0.18, 0.08, 0.74);
              if (Math.random() < winChance * dt * 60) {
                triggerTacklePoseAnimation(liveCarrier, p);
                ballState.heldBy = p;
                ballState.lastHeldBy = p;
                ballState.possessionLockUntil = elapsed + 0.55;
                p.tackleCooldown = 0.55;
                markKickoffTouch(p);
                soccerRestart.lastTouchTeam = p.team;
                sounds.catch();
              } else {
                p.tackleCooldown = Math.max(p.tackleCooldown, 0.28);
              }
            }
          });
        }

        // Possession-change detection: fire strategy callbacks when teams swap control
        if (ballState.heldBy && prevHolderTeam !== null && ballState.heldBy.team !== prevHolderTeam) {
          gameState.crossAssistTeam = '';
          gameState.crossAssistUntil = 0;
          handlePossessionChange(ballState.heldBy, elapsed);
        }
        // Expire counter-attack if ball has moved into opponent's third
        if (gameState.counterAttackActive && ballState.heldBy?.team === gameState.counterAttackTeam) {
          const sign = teamAttacksRight(gameState.counterAttackTeam as 'A' | 'B') ? 1 : -1;
          if (ballState.pos.x * sign > FIELD_W * 0.25) {
            gameState.counterAttackActive = false;
          }
        }

        // Defense Assignments
        playState.defenseAssignments.forEach((assignment: any) => {
          const p = assignment.player;
          if (!p) return;
          if (controlB && p === controlledPlayerB && !isGoalkeeper(p)) return;
          if (controlA && p === controlledPlayer && !isGoalkeeper(p)) return;

          if (isGoalkeeper(p)) {
            const keeperHome = getGoalkeeperHomeTarget(p);
            const target = keeperHome.clone();
            const attackCarrier = ballState.heldBy && ballState.heldBy.team !== p.team ? ballState.heldBy : null;
            const ballInOwnBox = isInsideOwnPenaltyArea(p, ballState.pos);
            const defendsRightGoal = !teamAttacksRight(p.team);
            const keeperMinX = defendsRightGoal ? rightPenaltyX : -FIELD_W / 2 + 0.75;
            const keeperMaxX = defendsRightGoal ? FIELD_W / 2 - 0.75 : leftPenaltyX;

            if (ballState.isFlying && ballState.isShot && ballInOwnBox) {
              // Shot incoming: predict where ball crosses the keeper's goal-line X and sprint there
              const keeperLineX = defendsRightGoal ? FIELD_W / 2 - 0.4 : -FIELD_W / 2 + 0.4;
              const vx = ballState.vel.x;
              const tCross = Math.abs(vx) > 0.1 ? (keeperLineX - ballState.pos.x) / vx : 0.5;
              const predictedZ = ballState.pos.z + ballState.vel.z * Math.max(0, Math.min(tCross, 1.2));
              target.x = keeperHome.x;
              target.z = THREE.MathUtils.clamp(predictedZ, -goalMouthWidth * 0.52, goalMouthWidth * 0.52);
            } else if (attackCarrier && ballInOwnBox) {
              target.x = THREE.MathUtils.clamp(ballState.pos.x, keeperMinX, keeperMaxX);
              target.z = THREE.MathUtils.clamp(ballState.pos.z, -goalMouthWidth * 0.52, goalMouthWidth * 0.52);
            } else if (!ballState.heldBy && ballInOwnBox) {
              target.lerp(ballState.pos, 0.38);
            } else {
              target.x = keeperHome.x;
              target.z = THREE.MathUtils.clamp(ballState.pos.z * 0.1, -3.4, 3.4);
            }

            target.x = THREE.MathUtils.clamp(target.x, keeperMinX, keeperMaxX);
            target.z = THREE.MathUtils.clamp(target.z, -penaltyHalfZ + 0.75, penaltyHalfZ - 0.75);

            const dir = new THREE.Vector3().subVectors(target, p.pos);
            dir.y = 0;
            const dist = dir.length();
            if (dist > 0.05) {
              dir.normalize();
              // Boost keeper sprint speed when reacting to an incoming shot
              const shotReactionBoost = (ballState.isFlying && ballState.isShot) ? 1.18 : 1.0;
              const keeperSpeed = (3.7 + p.stats.agility * 2.6) * GAME_SPEED_SCALE * shotReactionBoost;
              p.vel.lerp(dir.multiplyScalar(keeperSpeed), dt * 7.5);
              p.pos.addScaledVector(p.vel, dt);
              p.pos.x = THREE.MathUtils.clamp(p.pos.x, keeperMinX, keeperMaxX);
              p.pos.z = THREE.MathUtils.clamp(p.pos.z, -penaltyHalfZ + 0.75, penaltyHalfZ - 0.75);
            } else {
              p.vel.multiplyScalar(Math.max(0, 1 - dt * 10));
            }
            return;
          }

          const ballCarrier = ballState.heldBy;
          const attackAnchor = ballCarrier || offenseTeam[0];
          
          // 1. Ball in Air: Reaction logic (Interception/Breakup)
          if (ballState.isFlying) {
            // Kickoff specific reaction: Defense (Receiving team) moves fast to ball
            if (gameState.isKickoff) {
              const speed = 9.0 * GAME_SPEED_SCALE; // Faster pursuit
              setPlayerAIState(p, 'INTERCEPT_AIR');
              steerPlayerTowards(p, ballState.pos, dt, speed, 40, 5.2, 0.05);
              return;
            }

            // Predict ball path
            const timeToImpact = p.pos.distanceTo(ballState.pos) / 12;
            const predictedBallPos = ballState.pos.clone().addScaledVector(ballState.vel, Math.min(timeToImpact, 1.0));
            predictedBallPos.y = 0;

            const shapeTarget = getDefensiveShapeTarget(assignment, attackAnchor);
            const distToBall = p.pos.distanceTo(predictedBallPos);
            const markToBall = assignment.markTarget ? assignment.markTarget.pos.distanceTo(predictedBallPos) : 100;
            const shapeToBall = shapeTarget.distanceTo(predictedBallPos);
            let reactionStrength = assignment.pressStrength * 0.55;
            if (distToBall < 18.0 || markToBall < 15.0 || shapeToBall < 14.0) reactionStrength = 1.0;
            else if (distToBall < 26.0) reactionStrength = Math.max(reactionStrength, 0.55);

            if (reactionStrength > 0) {
              // Aggressive pursuit of the ball
              const maxSpeed = p.stats.speed * 45 * GAME_SPEED_SCALE; // Fast pursuit
              const speed = maxSpeed * reactionStrength;
              setPlayerAIState(p, 'INTERCEPT_AIR');
              steerPlayerTowards(p, predictedBallPos, dt, speed, 46, 5.4, 0.05);
              
              // Interception attempt
              if (p.pos.distanceTo(ballState.pos) < 2.2 && ballState.pos.y < 3.5) {
                // Base chance + catching/coverage bonus
                const shotBonus = ballState.isShot ? 0.08 : 0;
                const interceptChance = 0.11 + (p.stats.catching * 0.1) + (p.stats.coverage * 0.07) + shotBonus;
                if (Math.random() < interceptChance * dt * 60) { // Chance to intercept per frame
                  ballState.isFlying = false;
                  ballState.isRolling = false;
                   ballState.isShot = false;
                  ballState.heldBy = p;
                  ballState.possessionLockUntil = elapsed + 0.55;
                  ballState.vel.set(0,0,0);
                  markKickoffTouch(p);
                   gameState.message = '';
                  sounds.catch();
                  // Change direction for return
                   p.dir = -1;
                }
              }
              return;
            }
          }

          // 2. Ball Carrier Reaction (press/poke challenge)
          if (ballCarrier && ballCarrier.team !== p.team) {
            if (isKeeperHandlingInBox(ballCarrier)) {
              setPlayerAIState(p, 'HOLD_SHAPE');
              return;
            }
            const shapeTarget = getDefensiveShapeTarget(assignment, ballCarrier);
            const distToCarrier = p.pos.distanceTo(ballCarrier.pos);
            const distToShape = p.pos.distanceTo(shapeTarget);
            const shouldBreak = distToCarrier < assignment.pressRadius + 3.4 || (assignment.pressStrength > 0.76 && distToShape < 8.2);
            
            if (shouldBreak && elapsed >= ballState.possessionLockUntil) {
              // Dynamic Pursuit: Aim for intercept point
              const dist = p.pos.distanceTo(ballCarrier.pos);
              const interceptTime = dist / 6.0;
              const interceptPos = ballCarrier.pos.clone().addScaledVector(ballCarrier.vel, interceptTime);
              const forceSign = getForceDirectionSign(p, ballCarrier);
              const containTarget = interceptPos.clone().add(new THREE.Vector3(-(teamAttacksRight(ballCarrier.team as 'A' | 'B') ? 1 : -1) * 0.5, 0, forceSign * 0.95));
              const distToCarrier = p.pos.distanceTo(ballCarrier.pos);
              const touchQuality = getCarrierTouchQuality(ballCarrier);
              const heavyTouch = touchQuality > 0.46;
              const useJockey = distToCarrier < 2.35;
              const speed = ((useJockey ? 3.2 : 4.4) + assignment.pressStrength * (useJockey ? 1.5 : 2.8)) * GAME_SPEED_SCALE;
              setPlayerAIState(p, useJockey ? 'JOCKEY' : 'PRESS_CARRIER');
              steerPlayerTowards(p, useJockey ? containTarget : interceptPos, dt, speed, useJockey ? 22 : 34, useJockey ? 2.8 : 3.8, 0.05);
              
              if (distToCarrier < 1.08) {
                if (maybeCallSoccerFoul(p, ballCarrier, dt, elapsed)) return;
                const challengeWindow = heavyTouch || (distToCarrier < 0.8 && touchQuality > 0.24);
                if (!challengeWindow || p.tackleCooldown > 0) return;
                const speedDiff = p.stats.speed - ballCarrier.stats.speed;
                const rawChallengeWinChance = 0.24
                  + assignment.pressStrength * 0.3
                  + p.stats.coverage * 0.18
                  - ballCarrier.stats.carrying * 0.12
                  + (speedDiff * 2.0);
                const challengeWinChance = THREE.MathUtils.clamp(rawChallengeWinChance + touchQuality * 0.2, 0.08, 0.76);
                if (Math.random() < challengeWinChance * dt * 60) {
                  triggerTacklePoseAnimation(ballCarrier, p);
                  ballState.heldBy = p;
                  ballState.possessionLockUntil = elapsed + 0.55;
                  ballState.lastHeldBy = p;
                  p.tackleCooldown = 0.58;
                  soccerRestart.lastTouchTeam = p.team;
                  sounds.catch();
                } else {
                  p.tackleCooldown = Math.max(p.tackleCooldown, 0.3);
                }
              }
              return;
            }
          } else if (ballCarrier && ballCarrier.team === p.team) {
            // In-possession support for either team.
            if (p === ballCarrier) {
              // Ball-carrier movement/decision is handled in the dedicated CPU (or human) possession block.
              // Do not override it here, or carriers can get stuck in endless straight dribbles.
              setPlayerAIState(p, 'CARRY');
              p.vel.multiplyScalar(Math.max(0, 1 - dt * 7.5));
            } else {
              const attackSign = teamAttacksRight(p.team) ? 1 : -1;
              const supportTarget = new THREE.Vector3(
                ballCarrier.pos.x + (7 - assignment.depthBias * 0.2) * attackSign,
                0.15,
                THREE.MathUtils.clamp(ballCarrier.pos.z + assignment.widthBias * 0.45, -FIELD_D / 2 + 2, FIELD_D / 2 - 2)
              );
              const nearCornerTrap = Math.abs(ballCarrier.pos.z) > FIELD_D * CORNER_NEAR_Z_RATIO
                && Math.abs(ballCarrier.pos.x) > FIELD_W * CORNER_NEAR_X_RATIO;
              if (nearCornerTrap) {
                const slotSeed = typeof assignment.widthBias === 'number'
                  ? assignment.widthBias
                  : (p.homePos.z >= 0 ? 8 : -8);
                const supportSlot = THREE.MathUtils.clamp(Math.round(slotSeed / 6), -3, 3);
                const inwardSign = ballCarrier.pos.z >= 0 ? -1 : 1;
                const laneHomeZ = THREE.MathUtils.clamp(p.homePos.z * 0.82, -FIELD_D * 0.4, FIELD_D * 0.4);
                supportTarget.z = THREE.MathUtils.lerp(
                  supportTarget.z,
                  laneHomeZ + inwardSign * (2.0 + Math.abs(supportSlot) * 1.25),
                  0.62,
                );
                supportTarget.x = THREE.MathUtils.lerp(
                  supportTarget.x,
                  p.homePos.x + attackSign * assignment.depthBias * 0.2,
                  0.42,
                );
                supportTarget.z = THREE.MathUtils.clamp(supportTarget.z, -FIELD_D / 2 + 2, FIELD_D / 2 - 2);
              }
              const speed = p.stats.speed * 34 * GAME_SPEED_SCALE;
              setPlayerAIState(p, 'SUPPORT_ATTACK');
              steerPlayerTowards(p, supportTarget, dt, speed, 28, 4.6, 0.07);
            }
            return;
          }

          // 3. Default defensive shape and marking
          const shapeTarget = getDefensiveShapeTarget(assignment, attackAnchor);
          let desiredTarget = shapeTarget.clone();

          if (assignment.markTarget) {
            const predictedMarkPos = assignment.markTarget.pos.clone().addScaledVector(assignment.markTarget.vel, 0.18);
            const anchorToMark = new THREE.Vector3().subVectors(predictedMarkPos, attackAnchor.pos).normalize();
            const markingLane = predictedMarkPos.clone().addScaledVector(anchorToMark, -0.8);
            desiredTarget.lerp(markingLane, 0.45 + assignment.pressStrength * 0.2);
          }

          const dir = new THREE.Vector3().subVectors(desiredTarget, p.pos);
          dir.y = 0;
          const dist = dir.length();
          if (dist > 0.05) {
            const maxSpeed = p.stats.speed * (28 + assignment.pressStrength * 10) * GAME_SPEED_SCALE;
            const speed = dist > 2.5 ? maxSpeed : maxSpeed * 0.55;
            setPlayerAIState(p, assignment.markTarget ? 'MARK' : 'HOLD_SHAPE');
            steerPlayerTowards(p, desiredTarget, dt, speed, dist > 2 ? 30 : 22, 3.6, 0.08);
          } else {
            setPlayerAIState(p, 'HOLD_SHAPE');
            p.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
          }
        });

        players.forEach(p => {
          if (!ballState.heldBy && elapsed < ballState.receiveLockUntil) {
            return;
          }

          if (ballState.isFlying) {
            // Prevent the thrower from instantly re-catching the ball
            if (p === ballState.lastHeldBy) return;

            const distToBall = p.pos.distanceTo(ballState.pos);
            const isKeeperClaim = isGoalkeeper(p) && isInsideOwnPenaltyArea(p, ballState.pos);
            // Reduce keeper save radius for shots — keeper must be positioned correctly to stop a shot
            const flyingCollectRadius = isKeeperClaim
              ? (ballState.isShot ? 1.1 : 2.15)
              : 1.5;
            if (distToBall < flyingCollectRadius) {
              const wasShot = ballState.isShot;

              if (wasShot && !isKeeperClaim) {
                // Outfield player in path of shot: probabilistic block based on proximity
                // Only very close defenders (within 0.7 units) reliably block; otherwise the shot flies past
                const blockChance = THREE.MathUtils.clamp(1.0 - distToBall / flyingCollectRadius, 0.1, 0.85);
                if (Math.random() > blockChance) {
                  // Ball deflects past — don't award possession, just let it continue
                  // Slightly redirect the ball off the defender's body
                  const deflect = (Math.random() - 0.5) * 1.8;
                  ballState.vel.z += deflect;
                  ballState.vel.x *= 0.88;
                  soccerRestart.lastTouchTeam = p.team;
                  return;
                }
              }

              ballState.isFlying = false;
              ballState.isRolling = false;
              ballState.isShot = false;
              ballState.shotByTeam = null;

              if (wasShot) {
                // Shot: keeper saves or outfield blocks
                ballState.heldBy = p;
                ballState.lastHeldBy = p;
                if (enforceKickoffDoubleTouchIfNeeded(p)) return;
                markKickoffTouch(p);
                if (isKeeperClaim) {
                  const shootingTeam = p.team === 'A' ? 'B' : 'A';
                  recordShotOnTarget(shootingTeam);
                  recordSave(p.team);
                  // Keeper has ball in hands — give full distribution window (no challenge allowed)
                  const keeperHoldSeconds = 1.0 + Math.random() * 2.0;
                  setCPUTeamDecisionCooldown(p.team, keeperHoldSeconds);
                  ballState.possessionLockUntil = elapsed + keeperHoldSeconds + 0.65;
                  ballState.pos.y = 0.58;
                  triggerGoalkeeperSaveAnimation(p, elapsed);
                  gameState.message = 'SAVE!';
                  sounds.catch();
                } else {
                  gameState.message = 'BLOCKED!';
                  sounds.catch();
                  if (p.team === 'A') autoSelectTeamA(p);
                }
              } else {
                // Soccer receiving: secure first touch, no football-style drop/breakup outcomes.
                ballState.heldBy = p;
                ballState.lastHeldBy = p;
                if (enforceKickoffDoubleTouchIfNeeded(p)) return;
                markKickoffTouch(p);
                if (isGoalkeeper(p) && (p.team === 'A' || p.team === 'B')) {
                  const keeperHoldSeconds = 0.9 + Math.random() * 1.7;
                  setCPUTeamDecisionCooldown(p.team, keeperHoldSeconds);
                  ballState.possessionLockUntil = elapsed + keeperHoldSeconds + 0.55;
                  ballState.pos.y = 0.58;
                }

                if (playState.offsidePlayer === p) {
                  startSoccerRestart('TURNOVER', p.team === 'A' ? 'B' : 'A', p.pos.x, p.pos.z, 'OFFSIDE');
                  gameState.messageReason = 'Player in Offside Position';
                  sounds.incomplete();
                  return;
                }

                if (p.team === 'A') {
                  autoSelectTeamA(p);
                  gameState.passCaught = true;
                }
                gameState.message = '';
                sounds.catch();
              }
            }
          }

          if (p.tackleCooldown > 0) p.tackleCooldown -= dt;

          const horizSpeedSq = p.vel.x * p.vel.x + p.vel.z * p.vel.z;
          if (horizSpeedSq > 0.000001) {
            const carryingBall = ballState.heldBy === p;
            const maxSpeed = getPlayerMaxGroundSpeed(p, carryingBall);
            const horizSpeed = Math.sqrt(horizSpeedSq);
            if (horizSpeed > maxSpeed) {
              const scale = maxSpeed / Math.max(0.0001, horizSpeed);
              p.vel.x *= scale;
              p.vel.z *= scale;
            }
          }

          const playerDrag = Math.max(0, 1.0 - dt * PLAYER_GROUND_DRAG_RATE);
          p.vel.x *= playerDrag;
          p.vel.z *= playerDrag;
          if ((p.vel.x * p.vel.x + p.vel.z * p.vel.z) < PLAYER_STOP_SPEED_SQ) {
            p.vel.x = 0;
            p.vel.z = 0;
          }

          p.pos.x = THREE.MathUtils.clamp(p.pos.x, -FIELD_W / 2, FIELD_W / 2);
          p.pos.z = THREE.MathUtils.clamp(p.pos.z, -FIELD_D / 2, FIELD_D / 2);
          p.pos.y = 0.15;
          p.vel.y = 0;
          p.mesh.position.copy(p.pos);

          const horizSpeedSqNow = p.vel.x * p.vel.x + p.vel.z * p.vel.z;
          const aiIntent = (p.aiState || '').toString();
          const hasIntentToMove = gameState.isLive && aiIntent !== 'IDLE' && aiIntent !== 'MARK' && aiIntent !== 'NONE';
          if (horizSpeedSqNow > 0.035 || hasIntentToMove) {
            p.state = 'RUN';
            if (Math.abs(p.vel.x) > 0.01) p.dir = p.vel.x > 0 ? 1 : -1;
          } else {
            p.state = 'IDLE';
          }
          if (isGoalkeeper(p)) {
            const faceBallDeltaX = ballState.pos.x - p.pos.x;
            if (Math.abs(faceBallDeltaX) > 0.05) p.dir = faceBallDeltaX >= 0 ? 1 : -1;
          }

          const animThreshold = p.state === 'IDLE' ? 0.32 : 0.12;
          p.animTimer += dt;
          if (p.animTimer > animThreshold) {
            p.animTimer = 0;
            const frames = p.state === 'RUN' ? p.runFrames : p.idleFrames;
            p.frame = (p.frame + 1) % frames.length;
            frames.forEach((f: any, i: number) => f.visible = i === p.frame);
            if (p.state === 'RUN') {
              p.idleFrames.forEach((f: any) => f.visible = false);
            } else {
              p.runFrames.forEach((f: any) => f.visible = false);
            }
          }
          
          let spriteRotX = 0;
          let spriteRotY = 0;
          let spriteRotZ = 0;
          let spriteOffsetX = 0;
          let spriteOffsetY = PLAYER_SPRITE_CENTER_Y;
          const breath = p.state === 'IDLE' ? Math.sin(elapsed * 3.0 + (p as any).breathOffset) * 0.018 : 0;
          let scaleX = 1.0 - breath * 0.3;
          let scaleY = 1.0 + breath;

          if (isGoalkeeper(p)) {
            const pose = getGoalkeeperSavePose(p, elapsed);
            spriteOffsetX += pose.offsetX;
            spriteOffsetY += pose.offsetY;
            spriteRotZ = pose.rotZ;
            scaleX *= pose.scaleXMul;
            scaleY *= pose.scaleYMul;
            if (elapsed >= p.saveAnimUntil) {
              p.saveAnimType = 'NONE';
            }
          } else {
            const horizSpeed = Math.sqrt(horizSpeedSqNow);
            const runBlend = THREE.MathUtils.clamp(horizSpeed / 5.0, 0, 1);
            const lateralLean = THREE.MathUtils.clamp(p.vel.z * 0.055, -0.18, 0.18);
            const runBob = p.state === 'RUN' ? Math.sin(elapsed * (8.5 + runBlend * 8.0) + p.breathOffset) * (0.01 + runBlend * 0.018) : 0;
            spriteRotZ += lateralLean;
            spriteOffsetY += runBob;
          }

          const tacklePose = getTacklePose(p, dt);
          spriteOffsetY += tacklePose.y;
          spriteRotX += tacklePose.rotX;
          spriteRotY += tacklePose.rotY;
          spriteRotZ += tacklePose.rotZ;

          spriteOffsetY = snapToGrid(spriteOffsetY, 0.01);
          spriteRotX = snapToGrid(spriteRotX, 0.01);
          spriteRotY = snapToGrid(spriteRotY, 0.01);
          spriteRotZ = snapToGrid(spriteRotZ, 0.01);

          p.spriteGroup.rotation.x = spriteRotX;
          p.spriteGroup.rotation.y = spriteRotY;
          p.spriteGroup.rotation.z = spriteRotZ;
          p.spriteGroup.position.set(spriteOffsetX, spriteOffsetY, 0);
          p.spriteGroup.scale.set(p.dir * scaleX, scaleY, 1.0);
        });

        // Player-to-Player Collisions (Blocking & Tackling)
        players.forEach(p1 => {
          players.forEach(p2 => {
            if (p1 === p2) return;
            const dx = p1.pos.x - p2.pos.x;
            const dz = p1.pos.z - p2.pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.85) {
              const pushDir = new THREE.Vector3(dx, 0, dz);
              if (pushDir.lengthSq() < 0.000001) {
                pushDir.set(Math.random() < 0.5 ? -1 : 1, 0, 0);
              } else {
                pushDir.normalize();
              }
              const pushForce = (0.85 - dist) * 2.0;
              
              // Shoulder challenge (no American-football tackle stops)
              if (ballState.heldBy === p2 && p1.team !== p2.team) {
                if (isKeeperHandlingInBox(p2)) return;
                if (maybeCallSoccerFoul(p1, p2, dt, elapsed)) return;
                const speedDiff = p1.stats.speed - p2.stats.speed;
                const rawChallengeWinChance = 0.24
                  + (p1.stats.coverage * 0.2)
                  + (p1.stats.tackle * 0.12)
                  - (p2.stats.carrying * 0.12)
                  + (speedDiff * 2.0);
                const challengeWinChance = THREE.MathUtils.clamp(rawChallengeWinChance, 0.08, 0.72);
                if (Math.random() < challengeWinChance * dt * 60 && elapsed >= ballState.possessionLockUntil) {
                  triggerTacklePoseAnimation(p2, p1);
                  ballState.heldBy = p1;
                  ballState.lastHeldBy = p1;
                  ballState.possessionLockUntil = elapsed + 0.55;
                  markKickoffTouch(p1);
                  soccerRestart.lastTouchTeam = p1.team;
                  sounds.catch();
                }
              }
              
              // Blocking logic (Offense hits Defense)
              // Positional separation for all player pairs
              const overlap = 0.85 - dist;
              p1.pos.addScaledVector(pushDir, overlap * 0.5);
              p2.pos.addScaledVector(pushDir, -overlap * 0.5);
            }
          });
        });

        players.forEach((p: any) => {
          p.pos.y = 0.15;
          p.vel.y = 0;
          p.mesh.position.copy(p.pos);
        });

        if (ballState.heldBy) {
          if (ballState.attachedTo !== ballState.heldBy) {
            ballState.attachFrom.copy(ballState.pos);
            ballState.attachUntil = elapsed + 0.11;
            ballState.attachedTo = ballState.heldBy;
          }
          clearIntendedReceiver();
          if ((!throwInPresentation.active || ballState.heldBy !== throwInPresentation.thrower) && !penaltyPresentation.active) {
            updateDribbleBallPosition(ballState.heldBy, elapsed);
          }
          // Ball should settle while in a player's control.
          dampAngularVelocity(16.0, dt);
          soccerRestart.lastTouchTeam = ballState.heldBy.team;
        } else if (ballState.isFlying) {
          ballState.attachedTo = null;
          const weather = getActiveWeatherPreset();
          ballState.pos.addScaledVector(ballState.vel, dt);
          ballState.vel.addScaledVector(weatherWind, dt * (ballState.isShot ? 0.5 : 0.72));
          const airDrag = Math.max(0, 1.0 - dt * BALL_AIR_DRAG * weather.airDragMul);
          ballState.vel.x *= airDrag;
          ballState.vel.z *= airDrag;
          ballState.vel.y -= BALL_GRAVITY * dt;

          // Airborne spin naturally damps over time.
          dampAngularVelocity(BALL_SPIN_AIR_DAMP, dt);

          // If spin is very low, seed a physically plausible spin from travel direction.
          if (ballState.angularVel.lengthSq() < 0.02) {
            const horiz = new THREE.Vector3(ballState.vel.x, 0, ballState.vel.z);
            if (horiz.lengthSq() > 0.02) {
              const seededSpin = getRollingAngularVelocity(horiz).multiplyScalar(0.35);
              ballState.angularVel.lerp(seededSpin, 0.18);
            }
          }

          if (ballState.pos.y <= BALL_GROUND_Y) {
            ballState.pos.y = BALL_GROUND_Y;
            const impactVy = Math.abs(ballState.vel.y);
            const tangential = new THREE.Vector3(ballState.vel.x, 0, ballState.vel.z);
            if (impactVy > BALL_BOUNCE_TO_ROLL_IMPACT_VY) {
              ballState.vel.y = impactVy * BALL_BOUNCE_RESTITUTION;

              // Ground impact friction: preserve momentum but bleed some tangential speed.
              const groundImpulse = THREE.MathUtils.clamp(0.08 + impactVy * 0.025, 0.08, 0.28);
              ballState.vel.x *= (BALL_BOUNCE_GROUND_DAMP - groundImpulse * 0.35);
              ballState.vel.z *= (BALL_BOUNCE_GROUND_DAMP - groundImpulse * 0.35);

              // Convert part of impact/tangential motion into spin.
              const bounceSpin = getRollingAngularVelocity(tangential).multiplyScalar(0.22 + groundImpulse * 0.9);
              ballState.angularVel.lerp(bounceSpin, 0.42);
            } else {
              ballState.isFlying = false;
              ballState.isRolling = true;
              ballState.vel.y = 0;
              ballState.rollingTime = 0;
              ballState.rollingLaunchSpeed = Math.hypot(ballState.vel.x, ballState.vel.z);

              // Transition into rolling without losing all momentum.
              ballState.vel.x *= 0.97;
              ballState.vel.z *= 0.97;
              const rollingOmega = getRollingAngularVelocity(new THREE.Vector3(ballState.vel.x, 0, ballState.vel.z));
              ballState.angularVel.lerp(rollingOmega, 0.55);
            }
          }
        } else if (ballState.isRolling) {
          ballState.attachedTo = null;
          if (ballState.rollingTime <= 0) {
            ballState.rollingLaunchSpeed = Math.max(ballState.rollingLaunchSpeed, Math.hypot(ballState.vel.x, ballState.vel.z));
          }
          ballState.rollingTime += dt;
          if (ballState.intendedReceiver && elapsed <= ballState.intendedUntil) {
            const receiver = ballState.intendedReceiver;
            if (receiver && !ballState.heldBy) {
              const toBall = new THREE.Vector3().subVectors(ballState.pos, receiver.pos);
              toBall.y = 0;
              const d = toBall.length();
              if (d > 0.08) {
                toBall.normalize();
                const assistSpeed = (5.4 + (receiver.stats?.speed || 0.5) * 8.4) * GAME_SPEED_SCALE;
                receiver.vel.lerp(toBall.multiplyScalar(assistSpeed), dt * 6.0);
                receiver.pos.addScaledVector(receiver.vel, dt);
              }
            }
          } else if (ballState.intendedReceiver) {
            clearIntendedReceiver();
          }

          const weather = getActiveWeatherPreset();
          ballState.pos.addScaledVector(ballState.vel, dt);
          ballState.pos.y = BALL_GROUND_Y;
          ballState.vel.addScaledVector(weatherWind, dt * 0.22);

          // Rolling resistance: linear + quadratic drag keeps momentum believable at higher speeds.
          const horizSpeed = Math.hypot(ballState.vel.x, ballState.vel.z);
          if (horizSpeed > 0.0001) {
            const dragRamp = 1 - Math.exp(-ballState.rollingTime * BALL_ROLL_DRAG_RAMP_RATE);
            const dragScale = THREE.MathUtils.lerp(BALL_ROLL_DRAG_START_FACTOR, 1.0, dragRamp);
            const dragAccel = (BALL_ROLL_LINEAR_DRAG + BALL_ROLL_QUAD_DRAG * horizSpeed * horizSpeed) * weather.rollDampMul * dragScale;
            const newSpeed = Math.max(0, horizSpeed - dragAccel * dt);
            let targetSpeed = newSpeed;
            if (ballState.rollingTime < 0.24 && ballState.rollingLaunchSpeed > 0.01) {
              const earlyFloor = ballState.rollingLaunchSpeed * 0.72;
              targetSpeed = Math.max(targetSpeed, earlyFloor * (1 - dragRamp));
            }
            const scale = targetSpeed / horizSpeed;
            ballState.vel.x *= scale;
            ballState.vel.z *= scale;
          }

          // Rolling spin should match tangential travel with mild ground damping.
          const rollingOmega = getRollingAngularVelocity(new THREE.Vector3(ballState.vel.x, 0, ballState.vel.z));
          ballState.angularVel.lerp(rollingOmega, THREE.MathUtils.clamp(dt * 11.0, 0.08, 0.34));
          dampAngularVelocity(BALL_SPIN_GROUND_DAMP, dt);

          ballState.vel.y = 0;
          if (ballState.vel.lengthSq() < BALL_ROLL_STOP_SPEED_SQ || Math.hypot(ballState.vel.x, ballState.vel.z) < BALL_STATIC_FRICTION_SPEED) {
            ballState.isRolling = false;
            ballState.vel.set(0, 0, 0);
            ballState.angularVel.set(0, 0, 0);
            ballState.rollingTime = 0;
            ballState.rollingLaunchSpeed = 0;
          }

          let collector: any = null;
          let bestDist = Infinity;
          if (elapsed >= ballState.receiveLockUntil) {
            for (const p of players) {
              if (p === ballState.lastHeldBy) continue;
              const distToBall = p.pos.distanceTo(ballState.pos);
              const isIntended = p === ballState.intendedReceiver && elapsed <= ballState.intendedUntil;
              const collectRadius = isGoalkeeper(p) && isInsideOwnPenaltyArea(p, ballState.pos)
                ? 1.6
                : (isIntended ? 1.35 : 0.92);
              if (distToBall < collectRadius && distToBall < bestDist) {
                collector = p;
                bestDist = distToBall;
              }
            }
          }

          if (!collector && !ballState.isRolling && ballState.intendedReceiver && elapsed <= ballState.intendedUntil) {
            const receiver = ballState.intendedReceiver;
            if (receiver.pos.distanceTo(ballState.pos) < 2.2) {
              collector = receiver;
            }
          }

          if (collector) {
            ballState.isRolling = false;
            ballState.vel.set(0, 0, 0);
            ballState.rollingTime = 0;
            ballState.rollingLaunchSpeed = 0;
            if (playState.offsidePlayer === collector) {
              startSoccerRestart('TURNOVER', collector.team === 'A' ? 'B' : 'A', collector.pos.x, collector.pos.z, 'OFFSIDE');
              gameState.messageReason = 'Player in Offside Position';
              sounds.incomplete();
            } else {
              ballState.heldBy = collector;
              ballState.lastHeldBy = collector;
              clearIntendedReceiver();
              // Keeper picking up a rolling ball in their area gets the full distribution window
              const rollingKeeperClaim = isGoalkeeper(collector) && isInsideOwnPenaltyArea(collector, ballState.pos);
              if (rollingKeeperClaim) {
                const keeperHoldSeconds = 0.9 + Math.random() * 1.7;
                setCPUTeamDecisionCooldown(collector.team, keeperHoldSeconds);
                ballState.possessionLockUntil = elapsed + keeperHoldSeconds + 0.55;
                ballState.pos.y = 0.58;
              } else {
                ballState.possessionLockUntil = elapsed + 0.45;
              }
              if (enforceKickoffDoubleTouchIfNeeded(collector)) return;
              markKickoffTouch(collector);
              soccerRestart.lastTouchTeam = collector.team;
              if (collector.team === 'A') {
                autoSelectTeamA(collector);
                gameState.passCaught = true;
              }
            }
          }
        } else {
          ballState.attachedTo = null;
          ballState.vel.y = 0;
          ballState.pos.y = BALL_GROUND_Y;
          // Stationary loose ball: no phantom spin.
          ballState.angularVel.set(0, 0, 0);
          let collector: any = null;
          let bestDist = Infinity;
          if (elapsed >= ballState.receiveLockUntil) {
            for (const p of players) {
              // While kickoff law is active and the ball hasn't been touched by another player,
              // exclude the original kicker from picking up the loose ball (prevents instant double-touch penalty).
              if (kickoffLawState.active && kickoffLawState.firstKickTaken && !kickoffLawState.touchedByAnotherPlayer && p === kickoffLawState.kicker) continue;
              const distToBall = p.pos.distanceTo(ballState.pos);
              const collectRadius = isGoalkeeper(p) && isInsideOwnPenaltyArea(p, ballState.pos) ? 2.1 : 1.25;
              if (distToBall < collectRadius && distToBall < bestDist) {
                collector = p;
                bestDist = distToBall;
              }
            }
          }
          if (collector) {
            if (playState.offsidePlayer === collector) {
              startSoccerRestart('TURNOVER', collector.team === 'A' ? 'B' : 'A', collector.pos.x, collector.pos.z, 'OFFSIDE');
              gameState.messageReason = 'Player in Offside Position';
              sounds.incomplete();
            } else {
              ballState.heldBy = collector;
              ballState.lastHeldBy = collector;
              clearIntendedReceiver();
              // Keeper picking up a loose ball in their area: full distribution window
              const looseKeeperClaim = isGoalkeeper(collector) && isInsideOwnPenaltyArea(collector, ballState.pos);
              if (looseKeeperClaim) {
                const keeperHoldSeconds = 0.9 + Math.random() * 1.7;
                setCPUTeamDecisionCooldown(collector.team, keeperHoldSeconds);
                ballState.possessionLockUntil = elapsed + keeperHoldSeconds + 0.55;
                ballState.pos.y = 0.58;
              } else {
                ballState.possessionLockUntil = elapsed + 0.45;
              }
              if (enforceKickoffDoubleTouchIfNeeded(collector)) return;
              markKickoffTouch(collector);
              soccerRestart.lastTouchTeam = collector.team;
              if (collector.team === 'A') autoSelectTeamA(collector);
            }
          }
        }
        ballGroup.position.copy(ballState.pos);
        const omegaMag = ballState.angularVel.length();
        if (omegaMag > 0.0001) {
          ballSpinAxis.copy(ballState.angularVel).normalize();
          ballSpinQuat.setFromAxisAngle(ballSpinAxis, omegaMag * dt);
          ballGroup.quaternion.premultiply(ballSpinQuat);
        }

        if (handleSoccerOutOfPlay()) {
          ballGroup.position.copy(ballState.pos);
        }

        // Update Ball Trail (Solid Line)
        if (ballState.isFlying) {
          ballTrailLine.visible = true;
          trailTimer += dt;
          if (trailTimer > 0.016) { // Update ~60fps
            trailTimer = 0;
            // Shift points
            for (let i = 0; i < MAX_TRAIL_POINTS - 1; i++) {
              ballTrailPositions[i].copy(ballTrailPositions[i + 1]);
            }
            // Add new point
            ballTrailPositions[MAX_TRAIL_POINTS - 1].copy(ballState.pos);
            trailPointCount = Math.min(trailPointCount + 1, MAX_TRAIL_POINTS);
            
            // Update geometry
            ballTrailGeo.setFromPoints(ballTrailPositions);
            
            // Fade out the start of the line if it's not full yet
            if (trailPointCount < MAX_TRAIL_POINTS) {
              // Initialize points to current ball pos if we just started
              if (trailPointCount === 1) {
                for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
                  ballTrailPositions[i].copy(ballState.pos);
                }
              }
            }
          }
        } else {
          // Slowly fade out or hide
          if (ballTrailLine.visible) {
            const mat = ballTrailLine.material as THREE.LineBasicMaterial;
            mat.opacity -= dt * 2;
            if (mat.opacity <= 0) {
              ballTrailLine.visible = false;
              mat.opacity = 0.6;
              trailPointCount = 0;
            }
          }
        }

      } else {
        players.forEach(p => {
          p.pos.y = 0.15;
          p.vel.y = 0;
          p.mesh.position.copy(p.pos);
          if (p === qb && p.vel.lengthSq() > 0.1) {
            p.state = 'RUN';
            if (p.vel.x !== 0) p.dir = p.vel.x > 0 ? 1 : -1;
          } else {
            p.state = 'IDLE';
          }
          if (isGoalkeeper(p)) {
            const faceBallDeltaX = ballState.pos.x - p.pos.x;
            if (Math.abs(faceBallDeltaX) > 0.05) p.dir = faceBallDeltaX >= 0 ? 1 : -1;
          }
          const animThreshold = p.state === 'IDLE' ? 0.32 : 0.12;
          p.animTimer += dt;
          if (p.animTimer > animThreshold) {
            p.animTimer = 0;
            const frames = p.state === 'RUN' ? p.runFrames : p.idleFrames;
            p.frame = (p.frame + 1) % frames.length;
            frames.forEach((f: any, i: number) => f.visible = i === p.frame);
            if (p.state === 'RUN') {
              p.idleFrames.forEach((f: any) => f.visible = false);
            } else {
              p.runFrames.forEach((f: any) => f.visible = false);
            }
          }
          
          const breath = p.state === 'IDLE' ? Math.sin(elapsed * 2.5 + (p as any).breathOffset) * 0.012 : 0;
          let scaleX = 1.0 - breath * 0.3;
          let scaleY = 1.0 + breath;
          let spriteRotZ = 0;
          let spriteOffsetX = 0;
          let spriteOffsetY = PLAYER_SPRITE_CENTER_Y;
          if (isGoalkeeper(p)) {
            const pose = getGoalkeeperSavePose(p, elapsed);
            spriteOffsetX += pose.offsetX;
            spriteOffsetY += pose.offsetY;
            spriteRotZ = pose.rotZ;
            scaleX *= pose.scaleXMul;
            scaleY *= pose.scaleYMul;
            if (elapsed >= p.saveAnimUntil) {
              p.saveAnimType = 'NONE';
            }
          }
          p.spriteGroup.scale.set(p.dir * scaleX, scaleY, 1.0);
          p.spriteGroup.rotation.z = spriteRotZ;
          p.spriteGroup.position.set(spriteOffsetX, spriteOffsetY, 0);
        });
        // Before snap, ball stays at LOS
        ballState.pos.set(gameState.ballPos.x, 0.15, 0);
        ballGroup.position.copy(ballState.pos);
      }
    }

    if (cameraMode === 'FOLLOW_BEHIND') {
      const targetFov = 40;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, THREE.MathUtils.clamp(dt * 4.0, 0.1, 0.25));
        camera.updateProjectionMatrix();
      }
      const followFocus = ballState.heldBy
        ? ballState.heldBy.pos
        : ((ballState.isFlying || ballState.isRolling) ? ballState.pos : qb.pos);
      if (!cameraFocusInitialized) {
        cameraFocusSmoothed.copy(followFocus);
        cameraFocusInitialized = true;
      } else {
        const followBlend = THREE.MathUtils.clamp(dt * 9.5, 0.06, 0.35);
        cameraFocusSmoothed.lerp(followFocus, followBlend);
      }
      // Always look from the negative X side (Team A's end)
      camera.position.lerp(new THREE.Vector3(cameraFocusSmoothed.x - 20, 15, cameraFocusSmoothed.z + 10), 0.1);
      camera.lookAt(cameraFocusSmoothed.x + 10, 0, cameraFocusSmoothed.z);
    } else if (cameraMode === 'BROADCAST') {
      // TV-style broadcast camera: high sideline angle, smooth horizontal glide, subtle final-third zoom.
      const broadcastFocus = ballState.heldBy ? ballState.heldBy.pos : ballState.pos;
      if (!cameraFocusInitialized) {
        cameraFocusSmoothed.copy(broadcastFocus);
        cameraFocusInitialized = true;
      } else {
        cameraFocusSmoothed.lerp(broadcastFocus, BROADCAST_PAN_BLEND);
      }

      // Dynamic but subtle zoom as play enters the final third.
      const absFocusX = Math.abs(cameraFocusSmoothed.x);
      const absFocusZ = Math.abs(cameraFocusSmoothed.z);
      const finalThirdStart = FIELD_W / 6;
      const finalThirdEnd = FIELD_W / 2 - 6;
      const finalThirdT = THREE.MathUtils.clamp((absFocusX - finalThirdStart) / Math.max(1, finalThirdEnd - finalThirdStart), 0, 1);
      const targetFov = THREE.MathUtils.lerp(28.5, 24.5, finalThirdT);
      if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, THREE.MathUtils.clamp(dt * 2.4, 0.08, 0.22));
        camera.updateProjectionMatrix();
      }

      // Horizontal tracking: slide left/right with the flow without rotating around the field.
      // Increase sideline tracking near corner channels so lower-screen action stays visible.
      const edgeTrackT = THREE.MathUtils.clamp((absFocusZ - FIELD_D * 0.25) / Math.max(1, FIELD_D * 0.24), 0, 1);
      const desiredCamX = THREE.MathUtils.clamp(cameraFocusSmoothed.x * 0.8, -FIELD_W * 0.32, FIELD_W * 0.32);
      const camZMul = THREE.MathUtils.lerp(0.05, 0.26, edgeTrackT);
      const camZClamp = THREE.MathUtils.lerp(2.6, 9.2, edgeTrackT);
      const desiredCamZ = broadcastCameraHome.z + THREE.MathUtils.clamp(cameraFocusSmoothed.z * camZMul, -camZClamp, camZClamp);
      cameraLerpPosition.set(desiredCamX, broadcastCameraHome.y, desiredCamZ);
      camera.position.lerp(cameraLerpPosition, THREE.MathUtils.clamp(dt * 3.6, 0.08, 0.28));

      // Keep orientation stable and broadcast-like, but pan deeper toward touchline/corner play.
      const lookX = THREE.MathUtils.clamp(cameraFocusSmoothed.x * 0.88, -FIELD_W * 0.32, FIELD_W * 0.32);
      const lookZMul = THREE.MathUtils.lerp(0.12, 0.5, edgeTrackT);
      const lookZClamp = THREE.MathUtils.lerp(4.5, 12.0, edgeTrackT);
      const lookZ = THREE.MathUtils.clamp(cameraFocusSmoothed.z * lookZMul, -lookZClamp, lookZClamp);
      const lookY = THREE.MathUtils.lerp(0.9, 0.55, edgeTrackT);
      broadcastCameraTarget.set(lookX, lookY, lookZ);
      camera.lookAt(broadcastCameraTarget);
    } else if (cameraMode === 'SIDELINE') {
      const targetFov = 40;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, THREE.MathUtils.clamp(dt * 4.0, 0.1, 0.25));
        camera.updateProjectionMatrix();
      }
      cameraFocusInitialized = false;
      camera.position.lerp(new THREE.Vector3(0, 15, 40), 0.1);
      camera.lookAt(0, 0, 0);
    } else if (cameraMode === 'FIXED_ENDZONE') {
      const targetFov = 40;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, THREE.MathUtils.clamp(dt * 4.0, 0.1, 0.25));
        camera.updateProjectionMatrix();
      }
      cameraFocusInitialized = false;
      camera.position.lerp(new THREE.Vector3(-FIELD_W / 2 - 20, 15, 0), 0.1);
      camera.lookAt(0, 0, 0);
    }

    if (cameraMode !== 'BROADCAST' && gameState.screenShake > 0) {
      gameState.screenShake -= dt;
      const shakeAmt = gameState.screenShake * 1.5;
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }

    const passTargets = getPassTargets();
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A');
    
    // Determine the currently-controlled Team A field player for marker
    const teamAFieldMarker = players.filter((p: any) => p.team === 'A' && !isGoalkeeper(p));
    const humanControlled = (!ballState.heldBy || ballState.heldBy.team !== 'A')
      ? (teamAFieldMarker[Math.min(gameState.humanPlayerIndex, teamAFieldMarker.length - 1)] || null)
      : ballState.heldBy;

    // Show controlMarker on the player the human is controlling (white ring)
    // Recompute team B controlled for marker (may not be set if !hotSeatMode earlier in frame)
    let markerPlayerB: any = null;
    if (controlB) {
      const teamBFieldM = players.filter((p: any) => p.team === 'B' && !isGoalkeeper(p));
      markerPlayerB = ballState.heldBy?.team === 'B'
        ? ballState.heldBy
        : teamBFieldM[Math.min(gameState.humanPlayerIndexB, teamBFieldM.length - 1)] || null;
    }
    players.forEach((p: any) => {
      if (p.controlMarker) {
        const isHumanA = p === humanControlled && controlA;
        const isHumanB = controlB && p === markerPlayerB;
        p.controlMarker.visible = gameState.isLive && (isHumanA || isHumanB);
        if (p.controlMarker.visible) {
          p.controlMarker.rotation.z += dt * 2;
        }
      }
    });

    // Selection markers removed — white controlMarker rings are used instead.

    // Kickoff taker is automatic; hide kickoff marker ring to avoid shield-like visuals.

    updateHUD();
    // Animate Crowd
    if (now - lastCrowdAnimationMs >= CROWD_ANIMATION_INTERVAL_MS) {
      const time = now * 0.001;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < crowdBlocks.length; i++) {
        const b = crowdBlocks[i];
        // Jump
        const jump = Math.max(0, Math.sin(time * b.speed + b.phase)) * b.jumpHeight;
        // Vibrate (deterministic sine/cosine to avoid per-frame random calls)
        const vx = Math.sin(time * b.vibeSpeedX + b.vibePhaseX) * b.vibeScale * 0.5;
        const vz = Math.cos(time * b.vibeSpeedZ + b.vibePhaseZ) * b.vibeScale * 0.5;

        dummy.position.set(b.baseX + vx, b.baseY + jump, b.baseZ + vz);
        dummy.updateMatrix();
        crowdMesh.setMatrixAt(b.instanceIndex, dummy.matrix);
      }
      crowdMesh.instanceMatrix.needsUpdate = true;
      lastCrowdAnimationMs = now;

      // Randomly spawn word balloons (throttled and capped)
      if (activeWordBalloons < MAX_ACTIVE_WORD_BALLOONS && Math.random() < 0.012) {
        const b = visibleCrowdBlocks[Math.floor(Math.random() * visibleCrowdBlocks.length)];
        if (b) {
          const phrase = b.team === 'teamA'
            ? teamAPhrases[Math.floor(Math.random() * teamAPhrases.length)]
            : teamBPhrases[Math.floor(Math.random() * teamBPhrases.length)];
          const color = b.team === 'teamA' ? '#' + M.teamAShirt.color.getHexString() : '#' + M.teamBShirt.color.getHexString();
          spawnWordBalloon(b.baseX, b.baseY + 0.5, b.baseZ, phrase, color);
        }
      }
    }

    if (now - lastMiniMapDrawMs >= MINI_MAP_DRAW_INTERVAL_MS) {
      drawMiniMapOverlay();
      lastMiniMapDrawMs = now;
    }
    updateBallShadowVisual();
    renderer.render(scene, camera);

    // Orbit camera
    const target = getSelectedPassTarget();
    if (target) {
      const radius = -5;
      orbitCamera.position.x = target.pos.x + radius;
      orbitCamera.position.z = target.pos.z + radius;
      orbitCamera.position.y = target.pos.y + 2;
      orbitCamera.lookAt(target.pos);
      
      const orbitRenderer = (window as any).orbitRenderer;
      if (orbitRenderer) {
        orbitRenderer.render(scene, orbitCamera);
      }
    }

    // Orbit defense camera
    const defenders = defenseTeam;
    let defTarget = defenders[gameState.selectedDefenderIndex];
    if (defTarget) {
      const radius = gameState.selectedDefenderOrbitRotated ? -5 : 5;
      orbitCamera.position.x = defTarget.pos.x + radius;
      orbitCamera.position.z = defTarget.pos.z + radius;
      orbitCamera.position.y = defTarget.pos.y + 2;
      orbitCamera.lookAt(defTarget.pos);
      
      const orbitDefenseRenderer = (window as any).orbitDefenseRenderer;
      if (orbitDefenseRenderer) {
        orbitDefenseRenderer.render(scene, orbitCamera);
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    hintOverlay.style.opacity = '0';
    gameState.hintDismissed = true;
    const nowSec = performance.now() / 1000;
    const key = e.key.toLowerCase();
    const code = e.code;
    const { controlA, controlB } = getHumanControlFlags();

    // Ignore kickoff hotkeys while the start menu is open.
    if (gameState.menuVisible && (key === ' ' || code === 'Space' || key === 'k' || code === 'KeyK')) {
      e.preventDefault();
      return;
    }
    
    keys[key] = true;

    // Manual center kick-off
    if ((key === 'k' || code === 'KeyK') && !gameState.menuVisible && !gameState.isLive && !gameState.isResetting) {
      e.preventDefault();
      const kickoffTeam = matchClock.half === 1 ? kickoffSchedule.firstHalfTeam : kickoffSchedule.secondHalfTeam;
      startSoccerRestart('KICK_OFF', kickoffTeam, 0, 0, 'KICK-OFF');
      playbookBar.style.display = 'none';
      playbookHint.style.display = 'none';
      sounds.select();
    }
    
    if ((key === ' ' || code === 'Space') && !kickoffPresentation.active && !gameState.menuVisible && gameState.isKickoff && !gameState.isLive && gameState.kickoffState === 'READY') {
      e.preventDefault();
      hintOverlay.style.opacity = '0';
      beginCurrentRestart();
      executeKickoffTouch();
      sounds.select();
      return;
    }

    if ((key === 'p' || code === 'KeyP') && !gameState.menuVisible) {
      e.preventDefault();
      setManualPause(!isManualPause);
      return;
    }

    // Pass
    if (controlA && (key === 'g' || code === 'KeyG') && gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' && !gameState.isChargingPass) {
      e.preventDefault();
      gameState.isChargingPass = true;
      gameState.passChargeProgress = 0;
      // Random offset between -20 and 20 units (yards)
      gameState.passChargeOffset.set(
        (Math.random() - 0.5) * 40,
        0,
        (Math.random() - 0.5) * 40
      );
    }

    if (controlA && (key === 'f' || code === 'KeyF') && gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' && !gameState.isChargingPass) {
      e.preventDefault();
      if (!gameState.isChargingShot) {
        gameState.isChargingShot = true;
        gameState.shotChargeProgress = 0;
      }
      return;
    }

    // Q/E manually cycle the human-controlled Team A field player
    if (controlA && (key === 'q' || code === 'KeyQ' || key === 'e' || code === 'KeyE') && gameState.isLive) {
      e.preventDefault();
      const teamAField = players.filter((p: any) => p.team === 'A' && !isGoalkeeper(p));
      if (teamAField.length > 0) {
        const dir = (key === 'q' || code === 'KeyQ') ? -1 : 1;
        gameState.humanPlayerIndex = (gameState.humanPlayerIndex + dir + teamAField.length) % teamAField.length;
        gameState.manualSelectCooldown = 2.0;
        sounds.select();
      }
      return;
    }

    // Player 2 (Team B) hot seat controls
    if (controlB) {
      // . = shoot for Team B
      if ((key === '.' || code === 'Period') && gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'B') {
        e.preventDefault();
        if (!gameState.isChargingShot) {
          gameState.isChargingShot = true;
          gameState.shotChargeProgress = 0;
        }
        return;
      }
      // , = ground pass for Team B to nearest outfield teammate
      if ((key === ',' || code === 'Comma') && gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'B') {
        e.preventDefault();
        const passer = ballState.heldBy;
        const targets = players.filter((p: any) => p.team === 'B' && p !== passer && !isGoalkeeper(p));
        if (targets.length > 0) {
          const target = targets.reduce((prev: any, curr: any) =>
            curr.pos.distanceTo(passer.pos) < prev.pos.distanceTo(passer.pos) ? curr : prev);
          const dir = new THREE.Vector3().subVectors(target.pos, passer.pos);
          dir.y = 0;
          const distH = dir.length();
          if (distH > 0.1) {
            dir.normalize();
            const weather = getActiveWeatherPreset();
            const speedH = THREE.MathUtils.clamp(6.5 + distH * 2.2, 9.0, 16.5) * GAME_SPEED_SCALE * weather.passSpeedMul;
            ballState.lastHeldBy = passer;
            ballState.heldBy = null;
            ballState.isFlying = false;
            ballState.isRolling = true;
            ballState.isShot = false;
            ballState.receiveLockUntil = nowSec + 0.14;
            setIntendedReceiver(target, passer.team, nowSec, 1.8);
            ballState.vel.copy(dir.multiplyScalar(speedH));
            ballState.pos.copy(passer.pos).addScaledVector(dir, 0.45);
            ballState.pos.y = BALL_GROUND_Y;
            ballState.possessionLockUntil = nowSec + 0.28;
            sounds.throw();
          }
        }
        return;
      }
      // [ = cycle Team B player backward
      if ((key === '[' || code === 'BracketLeft') && gameState.isLive) {
        e.preventDefault();
        const tBField = players.filter((p: any) => p.team === 'B' && !isGoalkeeper(p));
        if (tBField.length > 0) {
          gameState.humanPlayerIndexB = (gameState.humanPlayerIndexB - 1 + tBField.length) % tBField.length;
          gameState.manualSelectCooldownB = 2.0;
          sounds.select();
        }
        return;
      }
      // ] = cycle Team B player forward
      if ((key === ']' || code === 'BracketRight') && gameState.isLive) {
        e.preventDefault();
        const tBField = players.filter((p: any) => p.team === 'B' && !isGoalkeeper(p));
        if (tBField.length > 0) {
          gameState.humanPlayerIndexB = (gameState.humanPlayerIndexB + 1) % tBField.length;
          gameState.manualSelectCooldownB = 2.0;
          sounds.select();
        }
        return;
      }
    }

    // Space: when holding the ball = cycle pass target; when off-ball = switch to most relevant defender / runner
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A');
    if (controlA && (key === ' ' || code === 'Space') && gameState.isLive && !gameState.isChargingPass) {
      e.preventDefault();
      if (ballState.heldBy && ballState.heldBy.team === 'A') {
        // Cycling pass target while in possession
        const targets = getPassTargets();
        if (targets.length > 0) {
          gameState.selectedReceiverIndex = (gameState.selectedReceiverIndex + 1) % targets.length;
          sounds.select();
          updateHUD();
        }
      } else {
        // No possession: smart switch — nearest Team A outfield player to the ball
        const teamAField = players.filter((p: any) => p.team === 'A' && !isGoalkeeper(p));
        if (teamAField.length > 0) {
          const nearest = teamAField.reduce((best: any, p: any) =>
            p.pos.distanceTo(ballState.pos) < best.pos.distanceTo(ballState.pos) ? p : best);
          autoSelectTeamA(nearest);
          gameState.manualSelectCooldown = 2.0;
          sounds.select();
        }
      }
      return;
    }

    if (key === 'r' || code === 'KeyR') {
      e.preventDefault();
      onResetCallback?.();
      gameState.scoreA = 0;
      gameState.scoreB = 0;
      gameState.shotsA = 0;
      gameState.shotsB = 0;
      gameState.shotsOnTargetA = 0;
      gameState.shotsOnTargetB = 0;
      gameState.savesA = 0;
      gameState.savesB = 0;
      matchClock.phase = 'FIRST_HALF';
      matchClock.half = 1;
      matchClock.elapsedInHalf = 0;
      matchClock.halftimeBreakRemaining = 0;
      setKickoffScheduleByCoinToss();
      soccerRestart.lastTouchTeam = kickoffSchedule.firstHalfTeam;
      gameState.isLive = false;
      gameState.status = 'PLAYING';
      gameState.message = 'READY';
      isPlaybookVisible = false;
      playbookBar.style.display = 'none';
      playbookHint.style.display = 'none';
      startSoccerRestart('KICK_OFF', kickoffSchedule.firstHalfTeam, 0, 0, 'KICK-OFF');
    }
  });
  window.addEventListener('keyup', (e) => {
    const nowSec = performance.now() / 1000;
    const key = e.key.toLowerCase();
    keys[key] = false;
    const { controlA } = getHumanControlFlags();
        // Release charged shot (F for team A, . for team B)
        const isShootReleaseKey = (key === 'f' || e.code === 'KeyF') || (key === '.' || e.code === 'Period');
        if (isShootReleaseKey && gameState.isChargingShot) {
          gameState.isChargingShot = false;
          shotArcGroup.visible = false;
          shotPowerRing.visible = false;
          shotTargetMarker.visible = false;
          if (ballState.heldBy) {
            const power = 0.55 + gameState.shotChargeProgress * 0.85;
            takeShot(ballState.heldBy, false, power);
          }
          gameState.shotChargeProgress = 0;
        }
    if ((key === 'g' || e.code === 'KeyG') && controlA) {
      if (gameState.isChargingPass && ballState.heldBy) {
        const passer = ballState.heldBy;
        const releaseCharge = gameState.passChargeProgress;
        gameState.isChargingPass = false;
          // Cancel an in-progress shot charge if the ball is no longer held
          // (handled in the animate loop, already clears if !ballState.heldBy)
        
        // EXECUTE THROW
        ballState.lastHeldBy = passer;
        ballState.heldBy = null;
        clearIntendedReceiver();
        ballState.isFlying = false;
        ballState.isRolling = false;
        ballState.isShot = false;
        
        const target = getSelectedPassTarget();
        
        if (target) {
          playState.offsidePlayer = isPlayerOffside(target, ballState.lastHeldBy?.team || gameState.offensiveTeam) ? target : null;
          if (releaseCharge < 0.22) {
            const targetPos = getGroundPassTargetPosition(target);
            const groundDir = new THREE.Vector3().subVectors(targetPos, passer.pos);
            groundDir.y = 0;
            if (groundDir.lengthSq() < 0.01) {
              groundDir.set(passer.dir || 1, 0, 0);
            }
            groundDir.normalize();

            ballState.pos.copy(passer.pos).addScaledVector(groundDir, 0.45);
            ballState.pos.y = BALL_GROUND_Y;
            const groundDist = targetPos.distanceTo(passer.pos);
            const weather = getActiveWeatherPreset();
            const groundDistNorm = THREE.MathUtils.clamp((groundDist - 4) / 24, 0, 1);
            const groundBaseSpeed = THREE.MathUtils.lerp(4.0, 11.8, groundDistNorm);
            const groundSpeed = groundBaseSpeed * GAME_SPEED_SCALE * weather.passSpeedMul;
            ballState.vel.copy(groundDir.multiplyScalar(groundSpeed));
            ballState.isRolling = true;
            ballState.receiveLockUntil = nowSec + 0.2;
            setIntendedReceiver(target, passer.team, nowSec, 2.0);
          } else {
            ballState.isFlying = true;
            ballState.receiveLockUntil = nowSec + 0.2;
            setIntendedReceiver(target, passer.team, nowSec, 2.2);
            // Target point is based on current charge progress and receiver's lead position
            const leadPos = calculateLeadPosition(ballState.pos, target);
            const currentOffset = gameState.passChargeOffset.clone().multiplyScalar(1.0 - releaseCharge);
            const targetPos = leadPos.clone().add(currentOffset);
            
            const dx = targetPos.x - ballState.pos.x;
            const dz = targetPos.z - ballState.pos.z;
            const distH = Math.sqrt(dx * dx + dz * dz);
            const weather = getActiveWeatherPreset();
            const speedH = 20.5 * GAME_SPEED_SCALE * weather.passSpeedMul;
            const time = distH / speedH;
            
            const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
            vel.y = THREE.MathUtils.clamp(4.6 * time, 2.4, 6.4);
            ballState.vel.copy(vel);
          }
          sounds.throw();
          autoSelectTeamA(target);
        } else {
          // No specific target — pass toward movement direction, switch to nearest teammate
          const fallbackDir = passer.vel.clone().setY(0);
          if (fallbackDir.lengthSq() < 0.01) {
            fallbackDir.set(passer.dir || 1, 0, 0);
          }
          fallbackDir.normalize();
          ballState.pos.copy(passer.pos).addScaledVector(fallbackDir, 0.45);
          if (releaseCharge < 0.22) {
            ballState.pos.y = BALL_GROUND_Y;
            const weather = getActiveWeatherPreset();
            ballState.vel.copy(fallbackDir.multiplyScalar(6.0 * GAME_SPEED_SCALE * weather.passSpeedMul));
            ballState.isRolling = true;
            ballState.receiveLockUntil = nowSec + 0.2;
          } else {
            ballState.isFlying = true;
            const weather = getActiveWeatherPreset();
            ballState.vel.copy(fallbackDir.multiplyScalar(20 * GAME_SPEED_SCALE * weather.passSpeedMul));
            ballState.vel.y = 6.2;
            ballState.receiveLockUntil = nowSec + 0.2;
          }
          // Switch to nearest teammate in pass direction
          const teamAField = players.filter((p: any) => p.team === 'A' && !isGoalkeeper(p) && p !== passer);
          if (teamAField.length > 0) {
            const nearest = teamAField.reduce((best: any, p: any) =>
              p.pos.distanceTo(ballState.pos) < best.pos.distanceTo(ballState.pos) ? p : best);
            autoSelectTeamA(nearest);
          }
        }
        gameState.passChargeProgress = 0;
      }
      gameState.isChargingPass = false;
    }
  });

  applyWeatherAtmosphere();
  animate();

  let onResetCallback: (() => void) | null = null;

  return {
    setLighting: (preset: string) => {
      const key = preset as keyof typeof LIGHTING_PRESETS;
      activeLightingPreset = LIGHTING_PRESETS[key] ? key : 'NOON';
      applyWeatherAtmosphere();
    },
    setWeather: (weather: string) => {
      const key = weather as WeatherKey;
      activeWeather = WEATHER_PRESETS[key] ? key : 'SUNNY';
      applyWeatherAtmosphere();
    },
    setAIStyle: (style: string) => {
      const key = style as 'BALANCED' | 'AGGRESSIVE' | 'POSSESSION';
      gameState.aiStyle = AI_STYLE_PRESETS[key] ? key : 'BALANCED';
      const preset = getActiveAIStyle();
      cpuShotAimErrorRad = preset.cpuShotAimErrorRad;
      cpuShotPressureError = preset.cpuShotPressureError;
    },
    setCPUShotTuning: (aimErrorRad: number, pressureError: number) => {
      cpuShotAimErrorRad = THREE.MathUtils.clamp(Number(aimErrorRad), 0, 0.45);
      cpuShotPressureError = THREE.MathUtils.clamp(Number(pressureError), 0, 0.2);
    },
    getCPUShotTuning: () => ({
      aimErrorRad: cpuShotAimErrorRad,
      pressureError: cpuShotPressureError,
    }),
    setMenuVisible: (visible: boolean) => {
      gameState.menuVisible = visible;
    },
    setShowAIStateOverlay: (visible: boolean) => {
      showAIStateOverlay = !!visible;
      applyAIStateOverlayVisibility();
    },
    startKickoffPresentation: (autoKick: boolean = true) => {
      startKickoffPresentationSequence(autoKick);
    },
    setHotSeatMode: (enabled: boolean) => { gameState.hotSeatMode = enabled; },
    setOnReset: (cb: (() => void) | null) => { onResetCallback = cb; },
    setTestingMode: (enabled: boolean) => {
      gameState.testingMode = enabled;
      gameState.hotSeatMode = enabled;
      if (enabled) {
        showAIStateOverlay = true;
        applyAIStateOverlayVisibility();
      }
      testingClockMode = enabled;
      const halfLimit = getHalfDurationSeconds() + getStoppageSeconds();
      if (matchClock.elapsedInHalf > halfLimit) {
        matchClock.elapsedInHalf = halfLimit;
      }
      updateTimerDisplay();
      if (enabled) gameState.cpuVsCpu = false;
    },
    setCpuVsCpu: (enabled: boolean) => {
      gameState.cpuVsCpu = enabled;
      testingClockMode = enabled;
      if (enabled) {
        showAIStateOverlay = true;
        applyAIStateOverlayVisibility();
      }
      updateTimerDisplay();
    },
    setCameraMode: (mode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE') => cameraMode = mode,
    setUniform: (team: 'A' | 'B', index: number) => {
      if (team === 'A') teamAUniformIndex = index;
      else teamBUniformIndex = index;
      updateScoreboardTheme();
      refreshCrowdColors();
      setupFormation();
    },
    setTeamColors: (team: 'A' | 'B', primaryHex: number, secondaryHex: number) => {
      if (team === 'A') {
        M.teamAShirt.color.setHex(primaryHex);
        M.teamAPants.color.setHex(secondaryHex);
        M.teamAVisor.color.setHex(0x000000);
      } else {
        M.teamBShirt.color.setHex(primaryHex);
        M.teamBPants.color.setHex(secondaryHex);
        M.teamBVisor.color.setHex(0x000000);
      }
      ensureDistinctKits();
      updateScoreboardTheme();
      updateStadiumBanners();
      refreshCrowdColors();
    },
    setTeamLogos: (teamALogoPath: string, teamBLogoPath: string) => {
      if (teamALogoPath) teamA.logo.src = teamALogoPath;
      if (teamBLogoPath) teamB.logo.src = teamBLogoPath;
    },
    setTeamNames: (teamAName: string, teamBName: string) => {
      activeTeams.A.scoreName = teamAName.trim().toUpperCase();
      activeTeams.B.scoreName = teamBName.trim().toUpperCase();
      activeTeams.A.rosterName = teamAName.trim();
      activeTeams.B.rosterName = teamBName.trim();
      assignRandomGoalkeeperKits();
      playerHairMap.clear();
      updateScoreboardTeamNames();
      updateStadiumBanners();
      setupFormation();
    },
    setTeamFormations: (teamAFormation: string, teamBFormation: string) => {
      const validFormations = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3'];
      activeTeamFormations.A = (validFormations.includes(teamAFormation) ? teamAFormation : '4-2-3-1') as SoccerFormationKey;
      activeTeamFormations.B = (validFormations.includes(teamBFormation) ? teamBFormation : '4-2-3-1') as SoccerFormationKey;
      setupFormation();
    },
    getPlayers: () => players.map(p => ({
      role: p.role,
      team: p.team,
      name: p.name,
      stats: p.stats,
      pos: {
        x: p.pos?.x ?? 0,
        y: p.pos?.y ?? 0,
        z: p.pos?.z ?? 0,
      },
    })),
    getRenderFps: () => smoothedFPS,
    getOrbitViewTexture: () => orbitRenderTarget.texture,
    setOrbitCanvas: (canvas: HTMLCanvasElement) => {
      const orbitRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      orbitRenderer.setSize(256, 256);
      (window as any).orbitRenderer = orbitRenderer;
    },
    setOrbitDefenseCanvas: (canvas: HTMLCanvasElement) => {
      const orbitDefenseRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      orbitDefenseRenderer.setSize(256, 256);
      (window as any).orbitDefenseRenderer = orbitDefenseRenderer;
    },
    getSelectedPlayerStats: () => {
      const target = getSelectedPassTarget();
      const isKeeper = !!target && ((target.displayRole || target.role) === 'GK' || target.role === 'GK');
      const multipliers = target ? getTeamRoleMultipliers(target.team, isKeeper) : null;
      return target ? {
        role: target.displayRole || target.role,
        team: target.team,
        name: target.name,
        stats: target.stats,
        pos: {
          x: target.pos?.x ?? 0,
          y: target.pos?.y ?? 0,
          z: target.pos?.z ?? 0,
        },
        rosterTeam: activeTeams[target.team].rosterName,
        mls2025: multipliers ? {
          quality: multipliers.teamMods,
          multipliers: {
            overall: multipliers.overallMult,
            attack: multipliers.attackMult,
            defense: multipliers.defenseMult,
            keeper: multipliers.keeperMult,
            appliedRole: multipliers.appliedRoleMult,
          },
        } : null,
      } : null;
    },
    getSelectedDefensePlayerStats: () => {
      const defenders = defenseTeam;
      let target = defenders[gameState.selectedDefenderIndex];
      if (!target) {
        target = defenders[Math.floor(Math.random() * defenders.length)];
      }
      const isKeeper = !!target && (target.role === 'GK');
      const multipliers = target ? getTeamRoleMultipliers(target.team, isKeeper) : null;
      return target ? {
        role: target.role,
        team: target.team,
        name: target.name,
        stats: target.stats,
        pos: {
          x: target.pos?.x ?? 0,
          y: target.pos?.y ?? 0,
          z: target.pos?.z ?? 0,
        },
        rosterTeam: activeTeams[target.team].rosterName,
        mls2025: multipliers ? {
          quality: multipliers.teamMods,
          multipliers: {
            overall: multipliers.overallMult,
            attack: multipliers.attackMult,
            defense: multipliers.defenseMult,
            keeper: multipliers.keeperMult,
            appliedRole: multipliers.appliedRoleMult,
          },
        } : null,
      } : null;
    },
    selectRandomDefensePlayer: () => {
      const linebackers = defenseTeam.filter(p => p.role === 'LB');
      if (linebackers.length > 0) {
        gameState.selectedDefenderIndex = defenseTeam.indexOf(linebackers[Math.floor(Math.random() * linebackers.length)]);
      } else {
        gameState.selectedDefenderIndex = Math.floor(Math.random() * defenseTeam.length);
      }
    },
    getIsLive: () => gameState.isLive,
    getMatchSnapshot: () => ({
      timestamp: Date.now(),
      scoreA: gameState.scoreA,
      scoreB: gameState.scoreB,
      shotsA: gameState.shotsA,
      shotsB: gameState.shotsB,
      shotsOnTargetA: gameState.shotsOnTargetA,
      shotsOnTargetB: gameState.shotsOnTargetB,
      savesA: gameState.savesA,
      savesB: gameState.savesB,
      offensiveTeam: gameState.offensiveTeam,
      isLive: gameState.isLive,
      weather: activeWeather,
      lighting: activeLightingPreset,
      aiStyle: gameState.aiStyle,
      cameraMode,
      phase: matchClock.phase,
      half: matchClock.half,
      elapsedInHalf: matchClock.elapsedInHalf,
      teamAName: activeTeams.A.rosterName,
      teamBName: activeTeams.B.rosterName,
      teamAFormation: activeTeamFormations.A,
      teamBFormation: activeTeamFormations.B,
      lastShotTelemetry: gameState.lastShotTelemetry,
    }),
    performPossessionSwap,
    setGroundVisible: (visible: boolean) => {
      ground.visible = visible;
    },
    setFieldVisible: (visible: boolean) => {
      fieldElements.forEach(m => m.visible = visible);
    },
    setGrassVisible: (visible: boolean) => {
      fieldGrass.visible = visible;
    }
  };
}

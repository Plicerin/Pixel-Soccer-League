import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { OFFENSE_FORMATIONS, DEFENSE_FORMATIONS, PASS_PLAYBOOK, DEFENSE_PLAYBOOK } from './playbookData';

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
  teamAShirt:  new THREE.MeshStandardMaterial({ color: 0x008e97, roughness: 0.7, metalness: 0.0 }),
  teamAPants:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.0 }),
  teamBShirt:  new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.7, metalness: 0.0 }),
  teamBPants:  new THREE.MeshStandardMaterial({ color: 0xc7a74b, roughness: 0.7, metalness: 0.0 }),
};

export const TEAM_PALETTES = {
  teamA: { shirt: M.teamAShirt, pants: M.teamAPants, hair: M.hairBlack, visor: M.teamAVisor },
  teamB: { shirt: M.teamBShirt, pants: M.teamBPants, hair: M.hairBlack, visor: M.teamBVisor },
};

export const PLAYER_IDLE_PATTERNS = [
  ['00000000000111111000','00000000000111100000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00000000011100000000','00000000011111100000'],
];

export const PLAYER_PATTERNS = [
  ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011100111110000000','00011100111111111111','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000011100','00011100000000011100','01111100000000000000','01110000000000000000','01110000000000000000'],
  ['00000000001111110000','00000000001110000000','01111111111111110000','01110000111110000000','01110000111111111111','00000000111110000000','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000000111','00011100000000000111','01111100000000000000','01110000000000000000','00000000000000000000'],
  ['00000000011111100000','00000000011100000000','00001111111111100000','00111111111100000000','00111001111100000000','00111001111111111110','00000000000000000000','00000001111100000000','00000001111100000000','00001111111111100000','00001110000111100000','00111110000111111000','11111000000000111000','11100000000000111000','00000000000000111110','00000000000000000000'],
  ['00000000000011111100','00000000000011100000','00000000111111111100','00000111111111110000','00011111111111110000','00011100111111111100','00011100000000000000','00000000111110000000','00000111111110000000','00000111111111110000','00000111100011110000','01111111100011110000','01110000000011110000','01110000000011110000','00000000000011110000','00000000000011111100'],
  ['00000000000111111000','00000000000111000000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00000000011100000000','00000000011111100000'],
  ['00000000001111110000','00000000001110000000','00000000111111110000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00011111111110000000','00011100111000000000','00011100111000000000','00000000111000000000','00000000111110000000'],
  ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011111111110000000','00011111111110000000','00011111111111110000','00000111111000000000','00000111111110000000','00011111111111110000','00011100000011110000','00011100111111110000','00011100111000000000','00011100000000000000','00011100000000000000','00000111100000000000'],
  ['00000000000111111000','00000000000111000000','00000001111111111000','00001111111111100000','00111111111111100000','00111001111111111000','00111000000000000000','00000001111100000000','00000001111111100000','00001111111111111110','00001110000000001110','00001110000111111110','00001110000111100000','00111000000111100000','00111000000000000000','00111000000000000000'],
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
    home: { label: 'Home', shirt: 0x008e97, pants: 0xebedef, visor: 0x000000 },
    away: { label: 'Away', shirt: 0xf5f6f7, pants: 0x1497a2, visor: 0x000000 },
    alternate: { label: 'Alternate', shirt: 0x0b8a97, pants: 0xebedef, visor: 0x000000 },
  };

  function performPossessionSwap() {
    console.log('Swapping possession from', gameState.offensiveTeam);
    gameState.offensiveTeam = gameState.offensiveTeam === 'A' ? 'B' : 'A';
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
    type: 'KICK_OFF' as 'KICK_OFF' | 'THROW_IN' | 'GOAL_KICK' | 'CORNER' | 'TURNOVER',
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

  function beginCurrentRestart() {
    if (matchClock.phase === 'FULL_TIME' || matchClock.phase === 'HALFTIME') return;
    gameState.isLive = true;
    const isKickoffRestart = soccerRestart.type === 'KICK_OFF';
    gameState.isKickoff = isKickoffRestart;
    gameState.kickoffState = isKickoffRestart ? 'READY' : 'NONE';
    gameState.status = 'PLAYING';
    gameState.passCaught = false;
    ballState.isFlying = false;
    ballState.isRolling = false;
    const restartTaker = offenseTeam
      .filter((p: any) => (p.displayRole || p.role) !== 'GK')
      .sort((a: any, b: any) => a.pos.distanceTo(ballState.pos) - b.pos.distanceTo(ballState.pos))[0] || offenseTeam[0] || null;
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
      } else {
        clearKickoffLawState();
        updateDribbleBallPosition(ballState.heldBy, performance.now() / 1000);
      }
    } else if (!isKickoffRestart) {
      clearKickoffLawState();
    }
    playState.activeRoutes = buildActiveRoutes();
    playState.defenseAssignments = buildDefenseAssignments();
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
    ballState.pos.y = 0.15;
    ballState.vel.copy(kickDirection.multiplyScalar(5.8 * GAME_SPEED_SCALE));
    ballState.heldBy = null;
    ballState.lastHeldBy = kicker;
    ballState.isFlying = false;
    ballState.isRolling = true;
    ballState.possessionLockUntil = performance.now() / 1000 + 0.45;
    kickoffLawState.firstKickTaken = true;
    // After the legal first touch, play is normal soccer.
    gameState.isKickoff = false;
    gameState.kickoffState = 'KICKED';
    gameState.message = '';
  }

  function startSoccerRestart(type: 'KICK_OFF' | 'THROW_IN' | 'GOAL_KICK' | 'CORNER' | 'TURNOVER', team: 'A' | 'B', x: number, z: number, message: string) {
    clearKickoffLawState();
    soccerRestart.type = type;
    soccerRestart.team = team;
    gameState.offensiveTeam = team;
    gameState.ballPos.set(x, 0.15, z);
    gameState.isLive = false;
    gameState.isResetting = false;
    gameState.isKickoff = type === 'KICK_OFF';
    gameState.kickoffState = type === 'KICK_OFF' ? 'READY' : 'NONE';
    gameState.status = matchClock.phase === 'FULL_TIME' ? 'START' : 'PLAYING';
    gameState.message = message;
    gameState.passCaught = false;
    playState.offsidePlayer = null;
    ballState.isFlying = false;
    ballState.isRolling = false;
    ballState.heldBy = null;
    ballState.lastHeldBy = null;
    ballState.vel.set(0, 0, 0);
    ballState.pos.set(type === 'KICK_OFF' ? 0 : x, 0.15, type === 'KICK_OFF' ? 0 : z);
    setupFormation();
    updateHUD();
    if (restartAutoStartTimer) clearTimeout(restartAutoStartTimer);
    restartAutoStartTimer = null;
    if (type !== 'KICK_OFF') {
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

  function getGoalkeeperHomeTarget(player: any) {
    const defendsRightGoal = !teamAttacksRight(player.team);
    const x = defendsRightGoal ? FIELD_W / 2 - 3 * X_PER_YARD : -FIELD_W / 2 + 3 * X_PER_YARD;
    return new THREE.Vector3(x, 0.15, 0);
  }

  function awardSoccerGoal(scoringTeam: 'A' | 'B') {
    if (scoringTeam === 'A') gameState.scoreA += 1;
    else gameState.scoreB += 1;
    sounds.touchdown();
    startSoccerRestart('KICK_OFF', scoringTeam === 'A' ? 'B' : 'A', 0, 0, 'GOAL!');
  }

  function handleSoccerOutOfPlay() {
    const goalMouthHalfWidth = goalMouthWidth / 2;
    const goalKickDepth = 6 * X_PER_YARD;
    const x = ballState.pos.x;
    const z = ballState.pos.z;

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
        awardSoccerGoal(scoringTeam);
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
  scoreBug.style.bottom = '20px';
  scoreBug.style.left = '50%';
  scoreBug.style.transform = 'translateX(-50%)';
  scoreBug.style.display = 'flex';
  scoreBug.style.alignItems = 'stretch';
  scoreBug.style.height = '62px';
  scoreBug.style.background = 'rgba(0, 0, 0, 0.85)';
  scoreBug.style.backdropFilter = 'blur(8px)';
  scoreBug.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  scoreBug.style.borderRadius = '4px';
  scoreBug.style.overflow = 'hidden';
  scoreBug.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
  scoreBug.style.zIndex = '100';
  scoreBug.style.fontFamily = '"Inter", sans-serif';
  container.appendChild(scoreBug);

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
  controlsOverlay.textContent = 'CONTROLS  WASD MOVE  F SHOOT  G PASS  SPACE SWITCH PLAYER';
  container.appendChild(controlsOverlay);

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

  function createTeamSection(logoPath: string, teamName: string, color: string, isLeft: boolean) {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    section.style.background = isLeft ? `linear-gradient(90deg, ${color} 0%, rgba(0,0,0,0) 100%)` : `linear-gradient(-90deg, ${color} 0%, rgba(0,0,0,0) 100%)`;
    section.style.padding = '0 32px';
    section.style.gap = '16px';

    const logo = document.createElement('img');
    logo.src = logoPath;
    logo.referrerPolicy = 'no-referrer';
    logo.style.height = '42px';
    logo.style.width = 'auto';
    logo.style.objectFit = 'contain';
    if (!isLeft) logo.style.transform = 'scaleX(-1)';

    const name = document.createElement('div');
    name.textContent = teamName;
    name.style.color = 'white';
    name.style.fontSize = '22px';
    name.style.fontWeight = '800';
    name.style.textTransform = 'uppercase';
    name.style.letterSpacing = '0.05em';

    const score = document.createElement('div');
    score.style.width = '70px';
    score.style.display = 'flex';
    score.style.alignItems = 'center';
    score.style.justifyContent = 'center';
    score.style.fontSize = '36px';
    score.style.fontWeight = '900';
    score.style.color = 'white';
    score.style.background = 'rgba(255,255,255,0.1)';
    score.style.height = '100%';
    score.textContent = '0';

    if (isLeft) {
      section.appendChild(logo);
      section.appendChild(name);
      section.appendChild(score);
    } else {
      section.appendChild(score);
      section.appendChild(name);
      section.appendChild(logo);
    }

    return { section, score, name };
  }

  const activeTeams = {
    A: { scoreName: 'INTER MIAMI', rosterName: 'Inter Miami' },
    B: { scoreName: 'LA GALAXY', rosterName: 'LA Galaxy' },
  };

  const teamA = createTeamSection('/assets/miami-helmet-logo.png', activeTeams.A.scoreName, '#008e97', true);
  const teamB = createTeamSection('/assets/sf-helmet-logo.png', activeTeams.B.scoreName, '#aa0000', false);

  function updateScoreboardTeamNames() {
    teamA.name.textContent = activeTeams.A.scoreName;
    teamB.name.textContent = activeTeams.B.scoreName;
  }

  function updateStadiumBanners() {
    const colorA = '#' + M.teamAShirt.color.getHexString();
    const colorB = '#' + M.teamBShirt.color.getHexString();
    for (const t of teamABannerMeshes) { t.text = activeTeams.A.scoreName; t.color = colorA; t.sync(); }
    for (const t of teamBBannerMeshes) { t.text = activeTeams.B.scoreName; t.color = colorB; t.sync(); }
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

  const centerInfo = document.createElement('div');
  centerInfo.style.display = 'flex';
  centerInfo.style.flexDirection = 'column';
  centerInfo.style.alignItems = 'center';
  centerInfo.style.justifyContent = 'center';
  centerInfo.style.padding = '0 40px';
  centerInfo.style.minWidth = '180px';
  centerInfo.style.borderLeft = '1px solid rgba(255,255,255,0.1)';
  centerInfo.style.borderRight = '1px solid rgba(255,255,255,0.1)';

  const timerDisplay = document.createElement('div');
  timerDisplay.style.color = '#ffe7a7';
  timerDisplay.style.fontSize = '28px';
  timerDisplay.style.fontWeight = '700';
  timerDisplay.style.fontFamily = 'monospace';
  timerDisplay.textContent = '00:00';

  const qtrDisplay = document.createElement('div');
  qtrDisplay.style.color = 'white';
  qtrDisplay.style.fontSize = '14px';
  qtrDisplay.style.fontWeight = '600';
  qtrDisplay.style.opacity = '0.6';
  qtrDisplay.textContent = '1ST HALF';

  const downDistanceDisplay = document.createElement('div');
  downDistanceDisplay.style.color = '#fff';
  downDistanceDisplay.style.fontSize = '14px';
  downDistanceDisplay.style.fontWeight = '600';
  downDistanceDisplay.style.marginTop = '4px';
  downDistanceDisplay.textContent = 'KICK-OFF';

  centerInfo.appendChild(timerDisplay);
  centerInfo.appendChild(qtrDisplay);
  centerInfo.appendChild(downDistanceDisplay);

  scoreBug.appendChild(teamA.section);
  scoreBug.appendChild(centerInfo);
  scoreBug.appendChild(teamB.section);

  updateScoreboardTeamNames();

  // Increase scoreBug height to accommodate new element
  scoreBug.style.height = '90px';

  const HALF_DURATION_SECONDS = 45 * 60;
  const STOPPAGE_SECONDS = 60;
  const HALFTIME_BREAK_SECONDS = 3;
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
    if (matchClock.phase === 'FULL_TIME') {
      timerDisplay.textContent = '90:00';
      qtrDisplay.textContent = 'FULL TIME';
      return;
    }

    if (matchClock.phase === 'HALFTIME') {
      timerDisplay.textContent = '45:00';
      qtrDisplay.textContent = 'HALFTIME';
      return;
    }

    const elapsed = Math.min(matchClock.elapsedInHalf, HALF_DURATION_SECONDS + STOPPAGE_SECONDS);
    const totalElapsed = (matchClock.half === 1 ? 0 : HALF_DURATION_SECONDS) + elapsed;
    timerDisplay.textContent = formatTimer(Math.floor(totalElapsed));
    const inStoppage = matchClock.elapsedInHalf >= HALF_DURATION_SECONDS;
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

  function applyTeamAUniformVariant(variantKey: string) {
    const variant = (teamAUniformPalettes as any)[variantKey] || teamAUniformPalettes.home;
    M.teamAShirt.color.setHex(variant.shirt);
    M.teamAPants.color.setHex(variant.pants);
    M.teamAVisor.color.setHex(variant.visor);
    for (const player of teamARosterPlayers) recolorPlayerUniform(player, TEAM_PALETTES.teamA);
    refreshFrameInspector();
  }

  function applyTeamBUniformVariant(variantKey: string) {
    const variant = (teamBUniformPalettes as any)[variantKey] || teamBUniformPalettes.home;
    M.teamBShirt.color.setHex(variant.shirt);
    M.teamBPants.color.setHex(variant.pants);
    M.teamBVisor.color.setHex(variant.visor);
    for (const player of teamBRosterPlayers) recolorPlayerUniform(player, TEAM_PALETTES.teamB);
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

  // --- Ball Texture ---
  const ballCanvas = document.createElement('canvas');
  ballCanvas.width = 64;
  ballCanvas.height = 64;
  const ballCtx = ballCanvas.getContext('2d')!;
  ballCtx.fillStyle = '#f6f6f3';
  ballCtx.fillRect(0, 0, 64, 64);
  ballCtx.strokeStyle = '#202020';
  ballCtx.lineWidth = 1.75;

  const drawPentagon = (x: number, y: number, radius: number) => {
    ballCtx.fillStyle = '#161616';
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

  drawPentagon(32, 32, 8.5);
  drawPentagon(32, 12, 5.2);
  drawPentagon(14, 25, 5.2);
  drawPentagon(50, 25, 5.2);
  drawPentagon(20, 50, 5.2);
  drawPentagon(44, 50, 5.2);

  ballCtx.beginPath();
  ballCtx.moveTo(32, 23);
  ballCtx.lineTo(20, 28);
  ballCtx.lineTo(17, 40);
  ballCtx.moveTo(32, 23);
  ballCtx.lineTo(44, 28);
  ballCtx.lineTo(47, 40);
  ballCtx.moveTo(25, 38);
  ballCtx.lineTo(39, 38);
  ballCtx.moveTo(20, 28);
  ballCtx.lineTo(44, 28);
  ballCtx.moveTo(17, 40);
  ballCtx.lineTo(20, 50);
  ballCtx.moveTo(47, 40);
  ballCtx.lineTo(44, 50);
  ballCtx.moveTo(20, 50);
  ballCtx.lineTo(32, 56);
  ballCtx.lineTo(44, 50);
  ballCtx.stroke();
  const ballTex = new THREE.CanvasTexture(ballCanvas);

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
    period: 1,
    timer: 60,
    down: 1,
    distance: 10,
    ballPos: new THREE.Vector3(-20, 0.15, 0),
    message: 'READY',
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
    screenShake: 0,
  };

  const playState = {
    activeRoutes: [] as any[],
    defenseAssignments: [] as any[],
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
    heldBy: null as any,
    lastHeldBy: null as any,
    isFlying: false,
    isRolling: false,
    possessionLockUntil: 0,
  };

  const GAME_SPEED_SCALE = 0.7;

  const discipline = {
    yellowA: 0,
    yellowB: 0,
    redA: 0,
    redB: 0,
  };

  const keys: { [key: string]: boolean } = {};
  let lastTime = performance.now();
  let cameraMode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE' = 'BROADCAST';

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
  let teamAUniformIndex = 0;
  let teamBUniformIndex = 0;

  function updateHUD() {
    const target = getSelectedPassTarget();
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A');
    const passHint = gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' ? ' [G: PASS]' : '';
    const shootHint = gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' ? ' [F: SHOOT]' : '';
    const selectionHint = canSelect ? ' [SPACE: SWITCH PLAYER]' : '';
    const targetDisplay = target ? `PASS: ${target.displayRole || target.role}` : 'NO TARGET';
    const kickoffPrompt = gameState.isKickoff && !gameState.isLive ? 'PRESS SPACE TO KICK OFF' : '';
    
    teamA.score.textContent = gameState.scoreA.toString();
    teamB.score.textContent = gameState.scoreB.toString();

    downDistanceDisplay.textContent = kickoffPrompt || `${targetDisplay}${selectionHint}${passHint}${shootHint}`;
    hintOverlay.textContent = kickoffPrompt || 'Play restarts automatically';
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
  const REGULATION_GOAL_TOP_DEPTH_YARDS = 4 / 3;
  const REGULATION_GOAL_BOTTOM_DEPTH_YARDS = 10 / 3;
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
  const goalFrameMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.15 });
  const goalNetMaterial = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.9, metalness: 0.0, transparent: true, opacity: 0.35, side: THREE.DoubleSide });

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
    const postSize = 0.14;

    const frontX = goalLineX - opensTowardField * postSize;
    const backTopX = frontX - opensTowardField * topDepth;
    const backBottomX = frontX - opensTowardField * bottomDepth;
    const midTopX = (frontX + backTopX) / 2;
    const midBottomX = (frontX + backBottomX) / 2;
    const halfW = goalWidth / 2;
    const backHeight = goalHeight * 0.7;

    const makeBeam = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      addGoalPart(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goalFrameMaterial));
      const mesh = fieldElements[fieldElements.length - 1];
      mesh.position.set(x, y, z);
    };

    const makeAngledBeam = (start: THREE.Vector3, end: THREE.Vector3) => {
      const dir = end.clone().sub(start);
      const len = dir.length();
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(postSize * 0.48, postSize * 0.48, len, 12),
        goalFrameMaterial
      );
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      addGoalPart(mesh);
    };

    // Front frame
    makeBeam(postSize, goalHeight, postSize, frontX, goalHeight / 2, -halfW);
    makeBeam(postSize, goalHeight, postSize, frontX, goalHeight / 2, halfW);
    makeBeam(postSize, postSize, goalWidth + postSize, frontX, goalHeight, 0);

    // Rear stanchions and roof support
    makeBeam(postSize, backHeight, postSize, backBottomX, backHeight / 2, -halfW);
    makeBeam(postSize, backHeight, postSize, backBottomX, backHeight / 2, halfW);
    makeBeam(postSize, postSize, goalWidth + postSize, backTopX, backHeight, 0);
    makeAngledBeam(new THREE.Vector3(frontX, goalHeight, -halfW), new THREE.Vector3(backTopX, backHeight, -halfW));
    makeAngledBeam(new THREE.Vector3(frontX, goalHeight, halfW), new THREE.Vector3(backTopX, backHeight, halfW));
    makeBeam(bottomDepth + postSize, postSize, postSize, midBottomX, 0.07, -halfW);
    makeBeam(bottomDepth + postSize, postSize, postSize, midBottomX, 0.07, halfW);
    makeAngledBeam(new THREE.Vector3(frontX, goalHeight * 0.45, -halfW), new THREE.Vector3(backBottomX, 0.07, -halfW));
    makeAngledBeam(new THREE.Vector3(frontX, goalHeight * 0.45, halfW), new THREE.Vector3(backBottomX, 0.07, halfW));

    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight), goalNetMaterial);
    backNet.position.set(backBottomX, backHeight / 2, 0);
    backNet.rotation.y = opensTowardField > 0 ? Math.PI / 2 : -Math.PI / 2;
    addGoalPart(backNet);

    const sideNetL = new THREE.Mesh(new THREE.PlaneGeometry(bottomDepth, goalHeight), goalNetMaterial);
    sideNetL.position.set(midBottomX, goalHeight / 2, -halfW);
    addGoalPart(sideNetL);

    const sideNetR = new THREE.Mesh(new THREE.PlaneGeometry(bottomDepth, goalHeight), goalNetMaterial);
    sideNetR.position.set(midBottomX, goalHeight / 2, halfW);
    addGoalPart(sideNetR);

    const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(topDepth, goalWidth), goalNetMaterial);
    roofNet.rotation.x = -Math.PI / 2;
    roofNet.position.set(midTopX, goalHeight - 0.01, 0);
    addGoalPart(roofNet);

    const floorNet = new THREE.Mesh(new THREE.PlaneGeometry(bottomDepth, goalWidth), goalNetMaterial);
    floorNet.rotation.x = -Math.PI / 2;
    floorNet.position.set(midBottomX, 0.04, 0);
    addGoalPart(floorNet);
  }

  addSoccerGoal(leftGoalX, 1);
  addSoccerGoal(rightGoalX, -1);

  const crowdBlocks: any[] = [];
  const visibleCrowdBlocks: any[] = [];
  const teamAPhrases = ["Let's Go!", "Come On!", "Goal!", "Great Play!"];
  const teamBPhrases = ["Attack!", "Press!", "Goal!", "Brilliant!"];

  function spawnWordBalloon(x: number, y: number, z: number, text: string, color: string) {
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
      }
    };
    animateBalloon();
  }

  let crowdMesh: THREE.InstancedMesh;
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
    const createBannerText = (text: string, color: string) => {
      const t = new Text();
      t.text = text;
      t.fontSize = 1.0;
      t.color = color;
      t.anchorX = 'center';
      t.anchorY = 'middle';
      t.font = 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf'; // Roboto
      t.sync();
      return t;
    };

    const textLeft = createBannerText(activeTeams.A.scoreName, '#' + M.teamAShirt.color.getHexString());
    const textMiddle = createBannerText('PIXEL SOCCER', '#94a3b8');
    const textRight = createBannerText(activeTeams.B.scoreName, '#' + M.teamBShirt.color.getHexString());

    for (let x = -24; x <= 24; x += 24) {
      const bannerText = x === -24 ? textLeft : (x === 0 ? textMiddle : textRight);
      
      const b1 = bannerText.clone();
      (b1 as any).blinkOffset = Math.random() * 1000;
      b1.position.set(x, wallHeight/2, -wallD/2 + 0.51);
      stadiumGroup.add(b1);
      bannerTexts.push(b1);
      if (x === -24) teamABannerMeshes.push(b1 as Text);
      else if (x === 24) teamBBannerMeshes.push(b1 as Text);
      
      const b2 = bannerText.clone();
      (b2 as any).blinkOffset = Math.random() * 1000;
      b2.position.set(x, wallHeight/2, wallD/2 - 0.51);
      b2.rotation.y = Math.PI;
      stadiumGroup.add(b2);
      bannerTexts.push(b2);
      if (x === -24) teamABannerMeshes.push(b2 as Text);
      else if (x === 24) teamBBannerMeshes.push(b2 as Text);
    }

    // Add banners to side walls
    for (let z = -wallD/4; z <= wallD/4; z += 12) {
      const bLeft = textMiddle.clone();
      (bLeft as any).blinkOffset = Math.random() * 1000;
      bLeft.position.set(-wallW/2 + 0.51, wallHeight/2, z);
      bLeft.rotation.y = Math.PI / 2;
      stadiumGroup.add(bLeft);
      bannerTexts.push(bLeft);

      const bRight = textMiddle.clone();
      (bRight as any).blinkOffset = Math.random() * 1000;
      bRight.position.set(wallW/2 - 0.51, wallHeight/2, z);
      bRight.rotation.y = -Math.PI / 2;
      stadiumGroup.add(bRight);
      bannerTexts.push(bRight);
    }

    // Crowd Blocks - Team A on one side, Team B on the other
    const teamACrowdColors = [
      M.teamAShirt.color.getHex(),
      M.teamAVisor.color.clone().offsetHSL(0.05, 0, 0.1).getHex(),
      0xffffff,
      M.teamAShirt.color.clone().offsetHSL(0, 0, 0.1).getHex(),
      M.teamAShirt.color.clone().offsetHSL(0, 0, -0.1).getHex(),
    ];
    const teamBCrowdColors = [
      M.teamBShirt.color.getHex(),
      M.teamBPants.color.clone().offsetHSL(0, 0, 0.1).getHex(),
      0xffffff,
      M.teamBShirt.color.clone().offsetHSL(0, 0, 0.15).getHex(),
      M.teamBShirt.color.clone().offsetHSL(0, 0, -0.1).getHex(),
    ];
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
        
        for (let layer = 0; layer < 2; layer++) {
          const by = y + 0.2 + (layer * 0.4);
          
          dummy.position.set(bx, by, bz);
          dummy.updateMatrix();
          crowdMesh.setMatrixAt(instanceIndex, dummy.matrix);
          
          const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
          crowdMesh.setColorAt(instanceIndex, color);
          
          crowdBlocks.push({
            instanceIndex,
            baseX: bx,
            baseY: by,
            baseZ: bz,
            team,
            phase: Math.random() * Math.PI * 2,
            speed: 2 + Math.random() * 4,
            jumpHeight: 0.2 + Math.random() * 0.4,
            vibeScale: 0.02 + Math.random() * 0.03
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
  function addPlayer(x: number, z: number, team: 'A' | 'B', role: string, name: string = 'Player', displayRole?: string) {
    const basePalette = team === 'A' ? teamAUniforms[teamAUniformIndex].palette : teamBUniforms[teamBUniformIndex].palette;
    const randomHair = hairChoices[Math.floor(Math.random() * hairChoices.length)];
    const palette = { ...basePalette, hair: randomHair };
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

    const markerGeo = new THREE.TorusGeometry(1.2, 0.12, 8, 32);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = -Math.PI / 2;
    // Marker at field level.
    marker.position.y = 0.01;
    marker.visible = false;
    group.add(marker);

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
      name,
      state: 'IDLE',
      frame: 0,
      animTimer: 0,
      vel: new THREE.Vector3(),
      pos: new THREE.Vector3(x, 0.15, z),
      homePos: new THREE.Vector3(x, 0.15, z),
      dir: team === 'A' ? 1 : -1,
      targetPos: new THREE.Vector3(x, 0.15, z),
      selectionMarker: marker,
      breathOffset: Math.random() * Math.PI * 2,
      tackleCooldown: 0,
      burstTimer: 0,
      burstCooldown: 0,
      stats: {
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
    const targets = offenseTeam.filter(p => p !== ballState.heldBy && !isGoalkeeper(p));
    return targets.length > 0 ? targets : offenseTeam;
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

    ballState.pos.copy(holder.pos)
      .addScaledVector(travel, push)
      .addScaledVector(lateral, sway);
    ballState.pos.y = 0.18 + lift;
  }

  function getGroundPassTargetPosition(target: any) {
    const lead = target.pos.clone().addScaledVector(target.vel, 0.35);
    lead.y = 0.15;
    return lead;
  }

  function takeShot(shooter: any) {
    if (!shooter) return;

    const attackRight = teamAttacksRight(shooter.team);
    const shotDirection = shooter.vel.clone().setY(0);
    if (shotDirection.lengthSq() < 0.01) {
      shotDirection.set(shooter.dir || (attackRight ? 1 : -1), 0, 0);
    }
    shotDirection.normalize();

    const goalX = attackRight ? FIELD_W / 2 : -FIELD_W / 2;
    const targetZ = THREE.MathUtils.clamp(
      shooter.pos.z + shotDirection.z * 6,
      -goalMouthWidth * 0.42,
      goalMouthWidth * 0.42,
    );
    const targetPos = new THREE.Vector3(goalX, 1.1, targetZ);

    ballState.lastHeldBy = shooter;
    ballState.heldBy = null;
    ballState.isRolling = false;
    ballState.isFlying = true;
    ballState.pos.copy(shooter.pos).addScaledVector(shotDirection, 0.48);
    ballState.pos.y = 0.28;

    const dx = targetPos.x - ballState.pos.x;
    const dz = targetPos.z - ballState.pos.z;
    const distH = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    const speedH = 19.5 * GAME_SPEED_SCALE;
    const time = distH / speedH;
    const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
    vel.y = THREE.MathUtils.clamp((targetPos.y - ballState.pos.y + 4.9 * time * time) / time, 3.8, 8.2);
    ballState.vel.copy(vel);

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

  function getSupportRunTarget(route: any, controller: any) {
    const player = route.player;
    if (!player) return new THREE.Vector3();

    const attackRight = teamAttacksRight(player.team);
    const attackSign = attackRight ? 1 : -1;
    const carrier = ballState.heldBy && ballState.heldBy.team === player.team ? ballState.heldBy : null;
    const anchor = carrier ? carrier.pos : ballState.pos;

    const supportTarget = new THREE.Vector3(
      anchor.x + route.depthBias * attackSign,
      0.15,
      THREE.MathUtils.clamp(anchor.z + route.widthBias, -FIELD_D / 2 + 2, FIELD_D / 2 - 2)
    );

    const finalTarget = player.homePos.clone().lerp(supportTarget, carrier ? route.anchorBlend : 0.35);

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
    }

    finalTarget.x = THREE.MathUtils.clamp(finalTarget.x, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5);
    finalTarget.z = THREE.MathUtils.clamp(finalTarget.z, -FIELD_D / 2 + 1.5, FIELD_D / 2 - 1.5);
    return finalTarget;
  }

  function getRestartOffsets(type: 'KICK_OFF' | 'THROW_IN' | 'GOAL_KICK' | 'CORNER' | 'TURNOVER', hasRestart: boolean) {
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

    for (let idx = 0; idx < 11; idx++) {
      const roleLabel = offFormation.roles[idx] || 'CM';
      const rawSlot = offenseSlots.team[idx] || offenseSlots.team[offenseSlots.team.length - 1];
      const slot = restartSlots ? rawSlot : toSoccerFieldPosition(rawSlot, offenseAttacksRight);
      const archetype = getSoccerRoleArchetype(roleLabel);
      offenseTeam.push(addPlayer(slot.x, slot.z, offTeam, archetype, nameForOffense(roleLabel), roleLabel));
    }

    for (let idx = 0; idx < 11; idx++) {
      const roleLabel = defFormation.roles[idx] || 'CM';
      const rawSlot = defenseSlots.team[idx] || defenseSlots.team[defenseSlots.team.length - 1];
      const slot = restartSlots ? rawSlot : toSoccerFieldPosition(rawSlot, defenseAttacksRight);
      const archetype = getSoccerRoleArchetype(roleLabel);
      defenseTeam.push(addPlayer(slot.x, slot.z, defTeam, archetype, nameForDefense(roleLabel), roleLabel));
    }
  }

  const ballGroup = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.6, metalness: 0.1 }));
  ballMesh.castShadow = true;
  ballGroup.add(ballMesh);
  scene.add(ballGroup);

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

  function buildActiveRoutes() {
    return offenseTeam.map((player, index) => ({
      player,
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

    const attackingTeam = offenseTeam[0]?.team || (ballState.heldBy?.team === 'A' ? 'A' : 'B');
    const attackRight = teamAttacksRight(attackingTeam);
    const attackSign = attackRight ? 1 : -1;
    const anchor = attackAnchor || { pos: ballState.pos };

    const compactTarget = new THREE.Vector3(
      anchor.pos.x - assignment.depthBias * attackSign,
      0.15,
      THREE.MathUtils.clamp(anchor.pos.z + assignment.widthBias, -FIELD_D / 2 + 2, FIELD_D / 2 - 2)
    );

    const finalTarget = player.homePos.clone().lerp(compactTarget, attackAnchor ? assignment.anchorBlend : 0.3);
    finalTarget.x = THREE.MathUtils.clamp(finalTarget.x, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5);
    finalTarget.z = THREE.MathUtils.clamp(finalTarget.z, -FIELD_D / 2 + 1.5, FIELD_D / 2 - 1.5);
    return finalTarget;
  }

  function buildDefenseAssignments() {
    const unassignedAttackers = offenseTeam.slice();
    return defenseTeam.map((player) => {
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


  function animate() {
    requestAnimationFrame(animate);
    
    // Animate Banners
    bannerTexts.forEach((t) => {
      // Ensure visible
      t.visible = true;
      
      // Soft Neon Glow
      t.outlineWidth = 0.05;
      t.outlineColor = t.color;
      t.outlineBlur = 0.15;
    });

    if (!gameState.isLive && gameState.isKickoff) {
      if (hintOverlay.style.opacity === '0') {
        hintOverlay.style.opacity = '1';
      }
    } else if (!gameState.isLive && !gameState.hintDismissed && gameState.down >= 2) {
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
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    const elapsed = now / 1000;

    const activeBannerMessage = gameState.isKickoff && !gameState.isLive ? 'PRESS SPACE TO KICK OFF' : gameState.message;

    if (activeBannerMessage !== lastMessage) {
      lastMessage = activeBannerMessage;
      if (activeBannerMessage) {
        messageOverlay.textContent = activeBannerMessage;
        messageOverlay.classList.remove('game-message-anim');
        // Trigger reflow
        void messageOverlay.offsetWidth;
        messageOverlay.classList.add('game-message-anim');
        messageOverlay.style.opacity = '1';
      } else {
        messageOverlay.classList.remove('game-message-anim');
        messageOverlay.style.opacity = '0';
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
      if (matchClock.phase === 'FIRST_HALF' || matchClock.phase === 'SECOND_HALF') {
        matchClock.elapsedInHalf += dt;
        const halfLimit = HALF_DURATION_SECONDS + STOPPAGE_SECONDS;
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
      if (keys['w'] || keys['W']) targetVel.addScaledVector(forward, moveSpeed);
      if (keys['s'] || keys['S']) targetVel.addScaledVector(forward, -moveSpeed);
      if (keys['a'] || keys['A']) targetVel.addScaledVector(right, -moveSpeed);
      if (keys['d'] || keys['D']) targetVel.addScaledVector(right, moveSpeed);

      // Determine which player the user is controlling
      let controlledPlayer;
      if (gameState.isKickoff) {
        if (ballState.heldBy && ballState.heldBy.team === 'A') {
          controlledPlayer = ballState.heldBy;
        } else {
          controlledPlayer = offenseTeam[gameState.selectedKickoffPlayerIndex] || offenseTeam[0];
        }
      } else {
        controlledPlayer = (ballState.heldBy && ballState.heldBy.team === 'A') ? ballState.heldBy : qb;
      }
      const cpPos = controlledPlayer.pos;

      // Smooth acceleration for controlled player
      controlledPlayer.vel.lerp(targetVel, dt * 5.0);

      // Move controlled player
      if (controlledPlayer.vel.lengthSq() > 0.01) {
        controlledPlayer.pos.addScaledVector(controlledPlayer.vel, dt);
        controlledPlayer.pos.x = THREE.MathUtils.clamp(controlledPlayer.pos.x, -FIELD_W / 2, FIELD_W / 2);
        controlledPlayer.pos.z = THREE.MathUtils.clamp(controlledPlayer.pos.z, -FIELD_D / 2, FIELD_D / 2);
      }

      if (gameState.isLive) {
        if (enforceKickoffRetakeIfIllegal()) {
          ballGroup.position.copy(ballState.pos);
          updateHUD();
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

        // Off-ball support runs
        playState.activeRoutes.forEach(route => {
          const p = route.player;
          if (!p || p === controlledPlayer) return;

          const supportTarget = getSupportRunTarget(route, controlledPlayer);
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
            p.glow.visible = true;
          } else {
            p.glow.visible = false;
          }

          if (dist < 2.0) speed *= 0.65;
          else if (dist > 8.0) speed *= 1.08;

          p.vel.lerp(dir.multiplyScalar(speed), dt * (dist > 4 ? 4.8 : 7.0));
          p.pos.addScaledVector(p.vel, dt);
        });

        // Dynamic pressure from the non-possession side.
        const liveCarrier = ballState.heldBy;
        if (liveCarrier && elapsed >= ballState.possessionLockUntil) {
          players.forEach((p) => {
            if (p.team === liveCarrier.team || isGoalkeeper(p)) return;
            const dir = new THREE.Vector3().subVectors(liveCarrier.pos, p.pos).normalize();
            const speed = 3.2 * GAME_SPEED_SCALE;
            p.vel.lerp(dir.multiplyScalar(speed), dt * 2.6);
            p.pos.addScaledVector(p.vel, dt);

            if (p.pos.distanceTo(liveCarrier.pos) < 0.95) {
              const speedDiff = p.stats.speed - liveCarrier.stats.speed;
              const winChance = 0.24 + (p.stats.coverage * 0.16) - (liveCarrier.stats.carrying * 0.1) + (speedDiff * 1.8);
              if (Math.random() < winChance * dt * 60) {
                ballState.heldBy = p;
                ballState.lastHeldBy = p;
                ballState.possessionLockUntil = elapsed + 0.55;
                markKickoffTouch(p);
                soccerRestart.lastTouchTeam = p.team;
                sounds.catch();
              }
            }
          });
        }

        // Defense Assignments
        defenseTeam.forEach((p, i) => {
          const assignment = playState.defenseAssignments[i];
          if (!assignment) return;

          if (isGoalkeeper(p)) {
            const keeperHome = getGoalkeeperHomeTarget(p);
            const target = keeperHome.clone();
            const attackCarrier = ballState.heldBy && ballState.heldBy.team !== p.team ? ballState.heldBy : null;
            const ballInOwnBox = isInsideOwnPenaltyArea(p, ballState.pos);

            if (attackCarrier && ballInOwnBox) {
              target.x = THREE.MathUtils.clamp(ballState.pos.x, Math.min(keeperHome.x, leftPenaltyX), Math.max(keeperHome.x, rightPenaltyX));
              target.z = THREE.MathUtils.clamp(ballState.pos.z, -goalMouthWidth * 0.52, goalMouthWidth * 0.52);
            } else if (!ballState.heldBy && ballInOwnBox) {
              target.lerp(ballState.pos, 0.55);
            } else {
              const sweepBias = teamAttacksRight(p.team) ? 1 : -1;
              target.x += sweepBias * THREE.MathUtils.clamp((ballState.pos.x - keeperHome.x) * 0.14, -3.5, 3.5);
              target.z = THREE.MathUtils.clamp(ballState.pos.z * 0.2, -6.5, 6.5);
            }

            const dir = new THREE.Vector3().subVectors(target, p.pos);
            dir.y = 0;
            const dist = dir.length();
            if (dist > 0.05) {
              dir.normalize();
              const keeperSpeed = (3.7 + p.stats.agility * 2.6) * GAME_SPEED_SCALE;
              p.vel.lerp(dir.multiplyScalar(keeperSpeed), dt * 7.5);
              p.pos.addScaledVector(p.vel, dt);
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
              const pursuitDir = new THREE.Vector3().subVectors(ballState.pos, p.pos).normalize();
              pursuitDir.y = 0;
              const speed = 9.0 * GAME_SPEED_SCALE; // Faster pursuit
              p.vel.lerp(pursuitDir.multiplyScalar(speed), dt * 8.0);
              p.pos.addScaledVector(p.vel, dt);
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
              const pursuitDir = new THREE.Vector3().subVectors(predictedBallPos, p.pos).normalize();
              const maxSpeed = p.stats.speed * 45 * GAME_SPEED_SCALE; // Fast pursuit
              const speed = maxSpeed * reactionStrength;
              p.vel.lerp(pursuitDir.multiplyScalar(speed), dt * 8.0);
              p.pos.addScaledVector(p.vel, dt);
              
              // Interception attempt
              if (p.pos.distanceTo(ballState.pos) < 2.2 && ballState.pos.y < 3.5) {
                // Base chance + catching/coverage bonus
                const interceptChance = 0.05 + (p.stats.catching * 0.1) + (p.stats.coverage * 0.05);
                if (Math.random() < interceptChance * dt * 60) { // Chance to intercept per frame
                  ballState.isFlying = false;
                  ballState.isRolling = false;
                  ballState.heldBy = p;
                  ballState.possessionLockUntil = elapsed + 0.55;
                  ballState.vel.set(0,0,0);
                  markKickoffTouch(p);
                  gameState.message = 'INTERCEPTED!';
                  sounds.catch();
                  // Change direction for return
                  p.dir = -1; // BUG: Teams are not swapping possession after interceptions
                }
              }
              return;
            }
          }

          // 2. Ball Carrier Reaction (press/poke challenge)
          if (ballCarrier && ballCarrier.team !== p.team) {
            const shapeTarget = getDefensiveShapeTarget(assignment, ballCarrier);
            const distToCarrier = p.pos.distanceTo(ballCarrier.pos);
            const distToShape = p.pos.distanceTo(shapeTarget);
            const shouldBreak = distToCarrier < assignment.pressRadius + 2.6 || (assignment.pressStrength > 0.82 && distToShape < 6.5);
            
            if (shouldBreak && elapsed >= ballState.possessionLockUntil) {
              // Dynamic Pursuit: Aim for intercept point
              const dist = p.pos.distanceTo(ballCarrier.pos);
              const interceptTime = dist / 6.0;
              const interceptPos = ballCarrier.pos.clone().addScaledVector(ballCarrier.vel, interceptTime);
              
              const dir = new THREE.Vector3().subVectors(interceptPos, p.pos).normalize();
              const speed = (4.4 + assignment.pressStrength * 2.8) * GAME_SPEED_SCALE;
              p.vel.lerp(dir.multiplyScalar(speed), dt * 5.5);
              p.pos.addScaledVector(p.vel, dt);
              
              if (p.pos.distanceTo(ballCarrier.pos) < 1.1) {
                const speedDiff = p.stats.speed - ballCarrier.stats.speed;
                const challengeWinChance = 0.3 + assignment.pressStrength * 0.25 + (speedDiff * 2.0);
                if (Math.random() < challengeWinChance * dt * 60) {
                  ballState.heldBy = p;
                  ballState.possessionLockUntil = elapsed + 0.55;
                  ballState.lastHeldBy = p;
                  soccerRestart.lastTouchTeam = p.team;
                  sounds.catch();
                }
              }
              return;
            }
          } else if (ballCarrier && ballCarrier.team === p.team) {
            // In-possession support for either team.
            if (p === ballCarrier) {
              const attackSign = teamAttacksRight(p.team) ? 1 : -1;
              const carryTarget = new THREE.Vector3(ballCarrier.pos.x + 10 * attackSign, 0.15, ballCarrier.pos.z * 0.6);
              const dir = new THREE.Vector3().subVectors(carryTarget, p.pos).normalize();
              const speed = p.stats.speed * 40 * GAME_SPEED_SCALE;
              p.vel.lerp(dir.multiplyScalar(speed), dt * 5.0);
              p.pos.addScaledVector(p.vel, dt);
            } else {
              const attackSign = teamAttacksRight(p.team) ? 1 : -1;
              const supportTarget = new THREE.Vector3(
                ballCarrier.pos.x + (7 - assignment.depthBias * 0.2) * attackSign,
                0.15,
                THREE.MathUtils.clamp(ballCarrier.pos.z + assignment.widthBias * 0.45, -FIELD_D / 2 + 2, FIELD_D / 2 - 2)
              );
              const dir = new THREE.Vector3().subVectors(supportTarget, p.pos).normalize();
              const speed = p.stats.speed * 34 * GAME_SPEED_SCALE;
              p.vel.lerp(dir.multiplyScalar(speed), dt * 4.5);
              p.pos.addScaledVector(p.vel, dt);
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
            dir.normalize();
            const maxSpeed = p.stats.speed * (28 + assignment.pressStrength * 10) * GAME_SPEED_SCALE;
            const speed = dist > 2.5 ? maxSpeed : maxSpeed * 0.55;
            p.vel.lerp(dir.multiplyScalar(speed), dt * (dist > 2 ? 5.2 : 8.0));
            p.pos.addScaledVector(p.vel, dt);
          } else {
            p.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
          }
        });

        players.forEach(p => {
          if (ballState.isFlying) {
            // Prevent the thrower from instantly re-catching the ball
            if (p === ballState.lastHeldBy) return;

            const distToBall = p.pos.distanceTo(ballState.pos);
            const isKeeperClaim = isGoalkeeper(p) && isInsideOwnPenaltyArea(p, ballState.pos);
            const flyingCollectRadius = isKeeperClaim ? 2.15 : 1.5;
            if (distToBall < flyingCollectRadius) {
              // Drop chance based on catching stat. 
              // e.g., catching 0.9 -> 5% drop chance. catching 0.2 -> 40% drop chance.
              const dropChance = isKeeperClaim ? 0.02 : (1.0 - p.stats.catching) * 0.5;
              const isDrop = p.team === 'A' && Math.random() < dropChance;
              
              if (isDrop) {
                gameState.message = 'DROPPED!';
                sounds.incomplete();
                // Ball bounces a bit
                ballState.vel.set((Math.random() - 0.5) * 5, 5, (Math.random() - 0.5) * 5);
                ballState.lastHeldBy = p; // Prevent instant re-catch
              } else {
                // Check for pass breakup if caught by offense
                let isBrokenUp = false;
                if (p.team === 'A') {
                  defenseTeam.forEach(def => {
                    const distToReceiver = def.pos.distanceTo(p.pos);
                    if (distToReceiver < 2.0) {
                      // Chance to break up depends on proximity and stats
                      const statBonus = (def.stats.coverage * 0.3) + (def.stats.speed * 0.5);
                      const breakupChance = 0.20 + (2.0 - distToReceiver) * 0.30 + statBonus; // Higher chance
                      if (Math.random() < breakupChance) {
                        isBrokenUp = true;
                      }
                    }
                  });
                }

                if (isBrokenUp) {
                  gameState.message = 'BROKEN UP!';
                  sounds.incomplete();
                  // Ball bounces away with more energy
                  ballState.vel.set((Math.random() - 0.5) * 10, 7, (Math.random() - 0.5) * 10);
                  ballState.lastHeldBy = p;
                } else {
                  ballState.isFlying = false;
                  ballState.isRolling = false;
                  ballState.heldBy = p;
                  ballState.lastHeldBy = p;
                  if (enforceKickoffDoubleTouchIfNeeded(p)) return;
                  markKickoffTouch(p);

                  if (playState.offsidePlayer === p) {
                    startSoccerRestart('TURNOVER', p.team === 'A' ? 'B' : 'A', p.pos.x, p.pos.z, 'OFFSIDE');
                    sounds.incomplete();
                    return;
                  }
                  
                  if (p.team === 'B') {
                    gameState.message = isKeeperClaim ? 'SAVE!' : 'INTERCEPTED!';
                    sounds.incomplete();
                  } else {
                    gameState.passCaught = true;
                    gameState.message = 'CAUGHT!';
                    sounds.catch();
                  }
                }
              }
            }
          }

          if (p.tackleCooldown > 0) p.tackleCooldown -= dt;

          p.pos.x = THREE.MathUtils.clamp(p.pos.x, -FIELD_W / 2, FIELD_W / 2);
          p.pos.z = THREE.MathUtils.clamp(p.pos.z, -FIELD_D / 2, FIELD_D / 2);
          p.mesh.position.copy(p.pos);

          if (p.vel.lengthSq() > 0.1 || (p.team === 'A' && gameState.isLive)) {
            p.state = 'RUN';
            if (p.vel.x !== 0) p.dir = p.vel.x > 0 ? 1 : -1;
          } else {
            p.state = 'IDLE';
          }

          const animThreshold = p.state === 'IDLE' ? 0.25 : 0.12;
          p.animTimer += dt;
          if (p.animTimer > animThreshold) {
            p.animTimer = 0;
            const frames = p.state === 'RUN' ? p.runFrames : p.idleFrames;
            p.frame = (p.frame + 1) % frames.length;
            frames.forEach((f: any, i: number) => f.visible = i === p.frame);
          }
          
          p.spriteGroup.rotation.z = 0;
          p.spriteGroup.position.y = PLAYER_SPRITE_CENTER_Y;
          const breath = p.state === 'IDLE' ? Math.sin(elapsed * 3.0 + (p as any).breathOffset) * 0.04 : 0;
          p.spriteGroup.scale.set(p.dir * (1.0 - breath * 0.3), 1.0 + breath, 1.0);
        });

        // Player-to-Player Collisions (Blocking & Tackling)
        players.forEach(p1 => {
          players.forEach(p2 => {
            if (p1 === p2) return;
            const dist = p1.pos.distanceTo(p2.pos);
            if (dist < 0.85) {
              const pushDir = new THREE.Vector3().subVectors(p1.pos, p2.pos).normalize();
              const pushForce = (0.85 - dist) * 2.0;
              
              // Shoulder challenge (no American-football tackle stops)
              if (p1.team === 'B' && ballState.heldBy === p2 && p2.team === 'A') {
                const speedDiff = p1.stats.speed - p2.stats.speed;
                const challengeWinChance = 0.24 + (p1.stats.coverage * 0.18) - (p2.stats.carrying * 0.1) + (speedDiff * 2.0);
                if (Math.random() < challengeWinChance * dt * 60 && elapsed >= ballState.possessionLockUntil) {
                  ballState.heldBy = p1;
                  ballState.lastHeldBy = p1;
                  ballState.possessionLockUntil = elapsed + 0.55;
                  markKickoffTouch(p1);
                  soccerRestart.lastTouchTeam = p1.team;
                  sounds.catch();
                }
              }
              
              // Blocking logic (Offense hits Defense)
              if (p1.team === 'A' && p2.team === 'B') {
                if (['C', 'G', 'T', 'TE', 'FB'].includes(p1.role)) {
                  p1.pos.addScaledVector(pushDir, pushForce * 0.4);
                  p2.pos.addScaledVector(pushDir, -pushForce * 0.6);
                  p1.vel.multiplyScalar(0.7);
                  p2.vel.multiplyScalar(0.7);
                }
              }
            }
          });
        });

        if (ballState.heldBy) {
          updateDribbleBallPosition(ballState.heldBy, elapsed);
          soccerRestart.lastTouchTeam = ballState.heldBy.team;
        } else if (ballState.isFlying) {
          ballState.pos.addScaledVector(ballState.vel, dt);
          ballState.vel.y -= 9.8 * dt;
          if (ballState.pos.y < 0.2) {
            ballState.pos.y = 0.15;
            ballState.isFlying = false;
            ballState.vel.set(0, 0, 0);
          }
        } else if (ballState.isRolling) {
          ballState.pos.addScaledVector(ballState.vel, dt);
          ballState.pos.y = 0.15;
          ballState.vel.multiplyScalar(Math.max(0, 1.0 - dt * 2.8));
          if (ballState.vel.lengthSq() < 1.0) {
            ballState.isRolling = false;
            ballState.vel.set(0, 0, 0);
          }

          let collector: any = null;
          let bestDist = Infinity;
          for (const p of players) {
            if (p === ballState.lastHeldBy) continue;
            const distToBall = p.pos.distanceTo(ballState.pos);
            const collectRadius = isGoalkeeper(p) && isInsideOwnPenaltyArea(p, ballState.pos) ? 1.9 : 1.05;
            if (distToBall < collectRadius && distToBall < bestDist) {
              collector = p;
              bestDist = distToBall;
            }
          }
          if (collector) {
            ballState.isRolling = false;
            ballState.vel.set(0, 0, 0);
            if (playState.offsidePlayer === collector) {
              startSoccerRestart('TURNOVER', collector.team === 'A' ? 'B' : 'A', collector.pos.x, collector.pos.z, 'OFFSIDE');
              sounds.incomplete();
            } else {
              ballState.heldBy = collector;
              ballState.lastHeldBy = collector;
              ballState.possessionLockUntil = elapsed + 0.45;
              if (enforceKickoffDoubleTouchIfNeeded(collector)) return;
              markKickoffTouch(collector);
              soccerRestart.lastTouchTeam = collector.team;
              if (collector.team === 'A') {
                gameState.passCaught = true;
              }
            }
          }
        } else {
          let collector: any = null;
          let bestDist = Infinity;
          for (const p of players) {
            const distToBall = p.pos.distanceTo(ballState.pos);
            const collectRadius = isGoalkeeper(p) && isInsideOwnPenaltyArea(p, ballState.pos) ? 2.1 : 1.25;
            if (distToBall < collectRadius && distToBall < bestDist) {
              collector = p;
              bestDist = distToBall;
            }
          }
          if (collector) {
            if (playState.offsidePlayer === collector) {
              startSoccerRestart('TURNOVER', collector.team === 'A' ? 'B' : 'A', collector.pos.x, collector.pos.z, 'OFFSIDE');
              sounds.incomplete();
            } else {
              ballState.heldBy = collector;
              ballState.lastHeldBy = collector;
              ballState.possessionLockUntil = elapsed + 0.45;
              if (enforceKickoffDoubleTouchIfNeeded(collector)) return;
              markKickoffTouch(collector);
              soccerRestart.lastTouchTeam = collector.team;
            }
          }
        }
        ballGroup.position.copy(ballState.pos);
        ballGroup.rotation.z += dt * 10;

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
          p.mesh.position.copy(p.pos);
          if (p === qb && p.vel.lengthSq() > 0.1) {
            p.state = 'RUN';
            if (p.vel.x !== 0) p.dir = p.vel.x > 0 ? 1 : -1;
          } else {
            p.state = 'IDLE';
          }
          const animThreshold = p.state === 'IDLE' ? 0.25 : 0.12;
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
          
          const breath = p.state === 'IDLE' ? Math.sin(elapsed * 2.5 + (p as any).breathOffset) * 0.025 : 0;
          p.spriteGroup.scale.set(p.dir * (1.0 - breath * 0.3), 1.0 + breath, 1.0);
          p.spriteGroup.rotation.z = 0;
          p.spriteGroup.position.y = PLAYER_SPRITE_CENTER_Y;
        });
        // Before snap, ball stays at LOS
        ballState.pos.set(gameState.ballPos.x, 0.15, 0);
        ballGroup.position.copy(ballState.pos);
      }
    }

    if (cameraMode === 'FOLLOW_BEHIND') {
      const controlledPlayer = ballState.heldBy ? ballState.heldBy : qb;
      const cpPos = controlledPlayer.pos;
      // Always look from the negative X side (Team A's end)
      camera.position.lerp(new THREE.Vector3(cpPos.x - 20, 15, cpPos.z + 10), 0.1);
      camera.lookAt(cpPos.x + 10, 0, cpPos.z);
    } else if (cameraMode === 'BROADCAST') {
      const broadcastFocus = ballState.heldBy ? ballState.heldBy.pos : ballState.pos;
      const broadcastX = THREE.MathUtils.clamp(broadcastFocus.x * 0.55, -18, 18);
      const broadcastZ = THREE.MathUtils.clamp(broadcastFocus.z * 0.16, -5, 5);
      camera.position.lerp(new THREE.Vector3(broadcastX, 24, 20 + broadcastZ), 0.055);
      camera.lookAt(broadcastFocus.x * 0.68, 0, broadcastFocus.z * 0.4);
    } else if (cameraMode === 'SIDELINE') {
      camera.position.lerp(new THREE.Vector3(0, 15, 40), 0.1);
      camera.lookAt(0, 0, 0);
    } else if (cameraMode === 'FIXED_ENDZONE') {
      camera.position.lerp(new THREE.Vector3(-FIELD_W / 2 - 20, 15, 0), 0.1);
      camera.lookAt(0, 0, 0);
    }

    if (gameState.screenShake > 0) {
      gameState.screenShake -= dt;
      const shakeAmt = gameState.screenShake * 1.5;
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }

    const passTargets = getPassTargets();
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A');
    
    // Update selection markers for pass targets
    passTargets.forEach((p, idx) => {
      if (p.selectionMarker) {
        p.selectionMarker.visible = (canSelect && idx === gameState.selectedReceiverIndex);
        if (p.selectionMarker.visible) {
          p.selectionMarker.rotation.z += dt * 3;
          const scale = 1.2 + Math.sin(now * 0.01) * 0.3;
          p.selectionMarker.scale.set(scale, scale, scale);
          p.selectionMarker.material.opacity = 0.6 + Math.sin(now * 0.01) * 0.3;
        }
      }
    });

    // Kickoff taker is automatic; hide kickoff marker ring to avoid shield-like visuals.

    updateHUD();
    // Animate Crowd
    const time = performance.now() * 0.001;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < crowdBlocks.length; i++) {
      const b = crowdBlocks[i];
      // Jump
      const jump = Math.max(0, Math.sin(time * b.speed + b.phase)) * b.jumpHeight;
      // Vibrate
      const vx = (Math.random() - 0.5) * b.vibeScale;
      const vz = (Math.random() - 0.5) * b.vibeScale;
      
      dummy.position.set(b.baseX + vx, b.baseY + jump, b.baseZ + vz);
      dummy.updateMatrix();
      crowdMesh.setMatrixAt(b.instanceIndex, dummy.matrix);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;

    // Randomly spawn word balloons
    if (Math.random() < 0.02) { // 2% chance per frame
      const b = visibleCrowdBlocks[Math.floor(Math.random() * visibleCrowdBlocks.length)];
      if (b) {
        const phrase = b.team === 'teamA' 
          ? teamAPhrases[Math.floor(Math.random() * teamAPhrases.length)]
          : teamBPhrases[Math.floor(Math.random() * teamBPhrases.length)];
        const color = b.team === 'teamA' ? '#' + M.teamAShirt.color.getHexString() : '#' + M.teamBShirt.color.getHexString();
        spawnWordBalloon(b.baseX, b.baseY + 0.5, b.baseZ, phrase, "");
      }
    }

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
    const key = e.key.toLowerCase();
    const code = e.code;
    
    keys[key] = true;

    // Manual center kick-off
    if ((key === 'k' || code === 'KeyK') && !gameState.isLive && !gameState.isResetting) {
      e.preventDefault();
      const kickoffTeam = matchClock.half === 1 ? kickoffSchedule.firstHalfTeam : kickoffSchedule.secondHalfTeam;
      startSoccerRestart('KICK_OFF', kickoffTeam, 0, 0, 'KICK-OFF');
      playbookBar.style.display = 'none';
      playbookHint.style.display = 'none';
      sounds.select();
    }
    
    if ((key === ' ' || code === 'Space') && gameState.isKickoff && !gameState.isLive && gameState.kickoffState === 'READY') {
      e.preventDefault();
      hintOverlay.style.opacity = '0';
      beginCurrentRestart();
      executeKickoffTouch();
      sounds.select();
      return;
    }

    // Pass
    if ((key === 'g' || code === 'KeyG') && gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' && !gameState.isChargingPass) {
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

    if ((key === 'f' || code === 'KeyF') && gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A' && !gameState.isChargingPass) {
      e.preventDefault();
      takeShot(ballState.heldBy);
      return;
    }

    // Space switches selected player (or starts kickoff when waiting for kickoff).
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.team === 'A');
    if ((key === ' ' || code === 'Space') && gameState.isLive && canSelect && !gameState.isChargingPass) {
      e.preventDefault();
      const targets = getPassTargets();
      if (targets.length > 0) {
        gameState.selectedReceiverIndex = (gameState.selectedReceiverIndex + 1) % targets.length;
        sounds.select();
        updateHUD();
      }
      return;
    }

    if (key === 'r' || code === 'KeyR') {
      e.preventDefault();
      gameState.scoreA = 0;
      gameState.scoreB = 0;
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
    const key = e.key.toLowerCase();
    keys[key] = false;
    if (key === 'g' || e.code === 'KeyG') {
      if (gameState.isChargingPass && ballState.heldBy) {
        const passer = ballState.heldBy;
        const releaseCharge = gameState.passChargeProgress;
        gameState.isChargingPass = false;
        
        // EXECUTE THROW
        ballState.lastHeldBy = passer;
        ballState.heldBy = null;
        ballState.isFlying = false;
        ballState.isRolling = false;
        
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
            ballState.pos.y = 0.15;
            ballState.vel.copy(groundDir.multiplyScalar((11 + target.stats.speed * 2.5) * GAME_SPEED_SCALE));
            ballState.isRolling = true;
          } else {
            ballState.isFlying = true;
            // Target point is based on current charge progress and receiver's lead position
            const leadPos = calculateLeadPosition(ballState.pos, target);
            const currentOffset = gameState.passChargeOffset.clone().multiplyScalar(1.0 - releaseCharge);
            const targetPos = leadPos.clone().add(currentOffset);
            
            const dx = targetPos.x - ballState.pos.x;
            const dz = targetPos.z - ballState.pos.z;
            const distH = Math.sqrt(dx * dx + dz * dz);
            const speedH = 18 * GAME_SPEED_SCALE;
            const time = distH / speedH;
            
            const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
            vel.y = 4.9 * time;
            ballState.vel.copy(vel);
          }
          sounds.throw();
        } else {
          const fallbackDir = passer.vel.clone().setY(0);
          if (fallbackDir.lengthSq() < 0.01) {
            fallbackDir.set(passer.dir || 1, 0, 0);
          }
          fallbackDir.normalize();
          ballState.pos.copy(passer.pos).addScaledVector(fallbackDir, 0.45);
          if (releaseCharge < 0.22) {
            ballState.pos.y = 0.15;
            ballState.vel.copy(fallbackDir.multiplyScalar(10 * GAME_SPEED_SCALE));
            ballState.isRolling = true;
          } else {
            ballState.isFlying = true;
            ballState.vel.copy(fallbackDir.multiplyScalar(18 * GAME_SPEED_SCALE));
            ballState.vel.y = 7;
          }
        }
        gameState.passChargeProgress = 0;
      }
      gameState.isChargingPass = false;
    }
  });

  animate();

  return {
    setLighting: (preset: string) => {
      const p = LIGHTING_PRESETS[preset as keyof typeof LIGHTING_PRESETS] || LIGHTING_PRESETS.NOON;
      sun.intensity = p.sun;
      amb.intensity = p.amb;
      scene.background = new THREE.Color(p.sky);
    },
    setCameraMode: (mode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE') => cameraMode = mode,
    setUniform: (team: 'A' | 'B', index: number) => {
      if (team === 'A') teamAUniformIndex = index;
      else teamBUniformIndex = index;
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
      updateStadiumBanners();
    },
    setTeamNames: (teamAName: string, teamBName: string) => {
      activeTeams.A.scoreName = teamAName.trim().toUpperCase();
      activeTeams.B.scoreName = teamBName.trim().toUpperCase();
      activeTeams.A.rosterName = teamAName.trim();
      activeTeams.B.rosterName = teamBName.trim();
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
      stats: p.stats
    })),
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
      return target ? {
        role: target.displayRole || target.role,
        team: target.team,
        name: target.name,
        stats: target.stats
      } : null;
    },
    getSelectedDefensePlayerStats: () => {
      const defenders = defenseTeam;
      let target = defenders[gameState.selectedDefenderIndex];
      if (!target) {
        target = defenders[Math.floor(Math.random() * defenders.length)];
      }
      return target ? {
        role: target.role,
        team: target.team,
        name: target.name,
        stats: target.stats
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

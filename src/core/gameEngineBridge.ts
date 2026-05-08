import type { TeamSide, PlayerRole, PlayerBelief, PlayerIntent, BallCommand, MatchState } from "../core/types";
import type { GameOrchestrator, OrchestratorPlayer, OrchestratorConfig, TickResult, OrchestratorEvent } from "../core/gameOrchestrator";
import { createGameOrchestrator } from "../core/gameOrchestrator";
import { FIELD_W, FIELD_D, LEFT_GOAL_X, RIGHT_GOAL_X, BASE_RUN_SPEED, GAME_SPEED_SCALE, SPRINT_MULTIPLIER } from "../core/constants";

export type GameEngineBridge = {
  orchestrator: GameOrchestrator;
  enabled: boolean;
  lastTickResult: TickResult | null;
  synced: boolean;
  homeAttackSign: 1 | -1;
};

export function createGameEngineBridge(
  playersData: Array<{
    id: string;
    team: "A" | "B";
    role: string;
    pos: { x: number; z: number };
    isGK: boolean;
    ratings: PlayerBelief["ratings"];
  }>,
  options: {
    homeAttackSign?: 1 | -1;
    halfDuration?: number;
  } = {},
): GameEngineBridge {
  const homeAttackSign = options.homeAttackSign ?? 1;

  const teamMap: Record<"A" | "B", TeamSide> = { A: "home", B: "away" };

  const baseSpeed = BASE_RUN_SPEED * GAME_SPEED_SCALE;

  const orchestratorPlayers: OrchestratorPlayer[] = playersData.map(p => ({
    id: p.id,
    team: teamMap[p.team],
    role: (p.role as PlayerRole) ?? "CM_L",
    pos: { x: p.pos.x, z: p.pos.z },
    vel: { x: 0, z: 0 },
    prevPos: { x: p.pos.x, z: p.pos.z },
    facingRad: 0,
    stamina01: 1.0,
    hasBall: false,
    isGK: p.isGK,
    ratings: p.ratings,
    speed: baseSpeed * (0.7 + 0.6 * (p.ratings.pace / 100)) * SPRINT_MULTIPLIER,
    acceleration: (p.ratings.acceleration / 100) * baseSpeed * 4.0,
  }));

  const config: OrchestratorConfig = {
    homeAttackSign,
    halfDuration: options.halfDuration ?? 150,
    teamServiceHz: 4,
    playerControllerHz: 8,
  };

  const orchestrator = createGameOrchestrator(orchestratorPlayers, config);

  return {
    orchestrator,
    enabled: false,
    lastTickResult: null,
    synced: false,
    homeAttackSign,
  };
}

export function tickBridge(
  bridge: GameEngineBridge,
  dt: number,
  elapsed: number,
): TickResult | null {
  if (!bridge.enabled) return null;

  const result = bridge.orchestrator.tick(dt, elapsed);
  bridge.lastTickResult = result;
  bridge.synced = true;
  return result;
}

export function syncPositionsFromOrchestrator(
  bridge: GameEngineBridge,
  gameEnginePlayers: Array<{
    id: any;
    pos: { x: number; z: number };
    vel?: { x: number; z: number };
    facingRad?: number;
  }>,
): void {
  if (!bridge.lastTickResult) return;

  let matchCount = 0;
  const orchIds = bridge.lastTickResult.players.map(p => p.id);
  for (const gep of gameEnginePlayers) {
    const idStr = String(gep.id);
    const orchPlayer = bridge.lastTickResult.players.find(p => p.id === idStr);
    if (!orchPlayer) continue;

    gep.pos.x = orchPlayer.pos.x;
    gep.pos.z = orchPlayer.pos.z;

    if (gep.vel) {
      gep.vel.x = orchPlayer.vel.x;
      gep.vel.z = orchPlayer.vel.z;
    }
    if (gep.facingRad !== undefined) {
      gep.facingRad = orchPlayer.facingRad;
    }
    matchCount++;
  }
  const geIds = gameEnginePlayers.map(p => String(p.id)).slice(0, 3);
  console.log(`[SYNC FROM ORCH] ${matchCount}/${gameEnginePlayers.length} matched. GE ids=${geIds.join(",")} Orch ids=${orchIds.slice(0, 3).join(",")}`);
}

export function syncBallFromOrchestrator(
  bridge: GameEngineBridge,
  ballState: {
    pos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
    isFlying: boolean;
    isRolling: boolean;
    heldBy: any;
  },
  ballGroup: { position: { x: number; y: number; z: number } },
  gameEnginePlayers?: Array<{ id: any; [key: string]: any }>,
): void {
  if (!bridge.lastTickResult) return;

  const orchBall = bridge.lastTickResult.ball;
  ballState.pos.x = orchBall.pos.x;
  ballState.pos.y = orchBall.pos.y;
  ballState.pos.z = orchBall.pos.z;
  ballState.vel.x = orchBall.vel.x;
  ballState.vel.y = orchBall.vel.y;
  ballState.vel.z = orchBall.vel.z;
  ballState.isFlying = orchBall.state === "in_flight";
  ballState.isRolling = orchBall.state === "loose";
  if (orchBall.ownerPlayerId && gameEnginePlayers) {
    ballState.heldBy = gameEnginePlayers.find(p => String(p.id) === orchBall.ownerPlayerId) ?? null;
  } else if (orchBall.ownerPlayerId) {
    ballState.heldBy = { id: orchBall.ownerPlayerId };
  } else {
    ballState.heldBy = null;
  }

  ballGroup.position.x = orchBall.pos.x;
  ballGroup.position.y = orchBall.pos.y;
  ballGroup.position.z = orchBall.pos.z;
}

export function processOrchestratorEvents(
  bridge: GameEngineBridge,
  handlers: {
    onGoal?: (team: TeamSide) => void;
    onBallOut?: (restartType: string, restartTeam: TeamSide) => void;
    onPass?: (fromId: string, toId: string, type: string) => void;
    onShot?: (playerId: string, style: string, onTarget: boolean) => void;
    onSave?: (keeperId: string) => void;
    onPossessionChange?: (newTeam: TeamSide) => void;
    onTackle?: (winnerId: string, loserId: string) => void;
    onClearance?: (playerId: string) => void;
    onInterception?: (playerId: string) => void;
    onOffside?: (team: TeamSide) => void;
  },
): void {
  if (!bridge.lastTickResult) return;

  for (const event of bridge.lastTickResult.events) {
    switch (event.kind) {
      case "goal": handlers.onGoal?.(event.team); break;
      case "ball_out": handlers.onBallOut?.(event.restartType, event.restartTeam); break;
      case "pass": handlers.onPass?.(event.fromId, event.toId, event.type); break;
      case "shot": handlers.onShot?.(event.playerId, event.style, event.onTarget); break;
      case "save": handlers.onSave?.(event.keeperId); break;
      case "possession_change": handlers.onPossessionChange?.(event.newTeam); break;
      case "tackle": handlers.onTackle?.(event.winnerId, event.loserId); break;
      case "clearance": handlers.onClearance?.(event.playerId); break;
      case "interception": handlers.onInterception?.(event.playerId); break;
      case "offside": handlers.onOffside?.(event.team); break;
    }
  }
}

export function syncBallToOrchestrator(
  bridge: GameEngineBridge,
  ballState: {
    pos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
    isFlying: boolean;
    isRolling: boolean;
    heldBy: any;
    lastHeldBy?: any;
    intendedReceiver?: any;
    intendedTeam?: "A" | "B" | null;
    intendedUntil?: number;
  },
): void {
  if (!bridge.enabled) return;
  const orchBall = bridge.orchestrator.getBallState();
  const orchestratorElapsed = bridge.orchestrator.getMatchState().clock.elapsedInHalf;
  if (ballState.heldBy) {
    const playerId = String(ballState.heldBy.id);
    bridge.orchestrator.giveBallToPlayer(playerId);
  } else {
    const legacyBallIsLive = ballState.isFlying || ballState.isRolling
      || Math.abs(ballState.vel.x) > 0.01
      || Math.abs(ballState.vel.y) > 0.01
      || Math.abs(ballState.vel.z) > 0.01;
    if (orchBall.state === "attached" && orchBall.ownerPlayerId && !legacyBallIsLive) {
      return;
    }
    orchBall.pos.x = ballState.pos.x;
    orchBall.pos.y = ballState.pos.y;
    orchBall.pos.z = ballState.pos.z;
    orchBall.vel.x = ballState.vel.x;
    orchBall.vel.y = ballState.vel.y;
    orchBall.vel.z = ballState.vel.z;
    if (ballState.isFlying) {
      orchBall.state = "in_flight";
    } else if (ballState.isRolling) {
      orchBall.state = "loose";
    }
    if (orchBall.state !== "attached") {
      orchBall.ownerPlayerId = null;
      orchBall.ownerTeam = null;
      const orchPlayers = bridge.orchestrator.getPlayers();
      for (const p of orchPlayers) p.hasBall = false;
    }
    orchBall.lastHeldById = ballState.lastHeldBy ? String(ballState.lastHeldBy.id) : orchBall.lastHeldById;
    if (ballState.lastHeldBy) {
      orchBall.lastHeldAtTime = orchestratorElapsed;
    }
    orchBall.intendedReceiverId = ballState.intendedReceiver ? String(ballState.intendedReceiver.id) : null;
    orchBall.intendedTeam = ballState.intendedTeam === "A" ? "home"
      : ballState.intendedTeam === "B" ? "away"
      : null;
    if (typeof ballState.intendedUntil === "number" && ballState.intendedUntil > 1000 && typeof performance !== "undefined") {
      const remainingWindow = Math.max(0.25, Math.min(2.5, ballState.intendedUntil - performance.now() / 1000));
      orchBall.intendedUntil = orchestratorElapsed + remainingWindow;
    } else {
      orchBall.intendedUntil = ballState.intendedUntil ?? 0;
    }
    if (legacyBallIsLive && ballState.intendedReceiver?.pos) {
      bridge.orchestrator.protectRestartReceive({
        receiverId: String(ballState.intendedReceiver.id),
        receiverTarget: { x: ballState.intendedReceiver.pos.x, z: ballState.intendedReceiver.pos.z },
        holdSeconds: 1.0,
        kickerId: ballState.lastHeldBy ? String(ballState.lastHeldBy.id) : undefined,
        kickerTarget: ballState.lastHeldBy?.pos
          ? { x: ballState.lastHeldBy.pos.x, z: ballState.lastHeldBy.pos.z }
          : undefined,
      });
    }
  }
}

export function syncPositionsToOrchestrator(
  bridge: GameEngineBridge,
  gameEnginePlayers: Array<{
    id: any;
    pos: { x: number; z: number };
  }>,
): void {
  if (!bridge.enabled) return;
  let matchCount = 0;
  for (const gep of gameEnginePlayers) {
    const idStr = String(gep.id);
    bridge.orchestrator.setPlayerPosition(idStr, { x: gep.pos.x, z: gep.pos.z });
    const orchP = bridge.orchestrator.getPlayers().find(p => p.id === idStr);
    if (orchP) matchCount++;
  }
  console.log(`[SYNC TO ORCH] ${matchCount}/${gameEnginePlayers.length} players matched`);
}

export function enableOrchestrator(bridge: GameEngineBridge, kickoffTeam: TeamSide = "home"): void {
  bridge.enabled = true;
  bridge.orchestrator.reset();
  bridge.orchestrator.forceMatchState({ kind: "live_play", half: 1, startTick: 0 });
  const orchPlayers = bridge.orchestrator.getPlayers();
  const kickoffPlayer = orchPlayers.find(p => p.team === kickoffTeam && p.role === "ST");
  if (kickoffPlayer) {
    bridge.orchestrator.giveBallToPlayer(kickoffPlayer.id);
  }
  bridge.synced = false;
  bridge.lastTickResult = null;
}

export function disableOrchestrator(bridge: GameEngineBridge): void {
  bridge.enabled = false;
  bridge.lastTickResult = null;
  bridge.synced = false;
}

/**
 * swosTactics.ts — SWOS (Sensible World of Soccer) Tactics File Format
 *
 * Implements the .TAC binary format and a position-lookup system for outfield AI.
 *
 * ── File layout (370 bytes) ─────────────────────────────────────────────────
 *   Bytes   0–7  : Tactic name (8 chars, null-padded)
 *   Byte    8    : Null terminator
 *   Bytes  9–358 : Player positions — 10 players × 35 ball areas = 350 bytes
 *                  Formula: offset = (playerNo * 35) − 26 + (areaNo − 1)
 *                  playerNo = 1–10 (outfield, GK excluded)
 *                  areaNo   = 1–35
 *   Bytes 359–369: Magic: 00 FF FF 00 01 FF FF 01 FF FF 00
 *
 * ── Ball areas (35) ─────────────────────────────────────────────────────────
 *   5 columns (z-axis, left→right) × 7 rows (x-axis, own goal→opp goal)
 *   area = row × 5 + col + 1  (1-indexed, 1–35)
 *   Row 0 = own-goal end   Row 6 = opponent-goal end
 *   Col 0 = left touchline Col 4 = right touchline
 *
 * ── Position encoding (1 byte per slot) ─────────────────────────────────────
 *   High nibble X (0–F): lateral/z,  0 = left touchline, F = right touchline
 *   Low  nibble Y (0–F): depth/x,   0 = own goal line,   F = opponent goal line
 *   240 usable positions  (16 × 15 in practice; F×F = far-right opp goal mouth)
 *   Example: 0x7F = centre of opponent goal mouth (Ginola tactic)
 *
 * References: Jonathan Daniel's hex analysis, SWOS manual
 */

import { FIELD_W, FIELD_D } from "../core/constants";

// ── Constants ─────────────────────────────────────────────────────────────────
const NUM_AREAS   = 35;
const NUM_COLS    = 5;   // z-axis bands
const NUM_ROWS    = 7;   // x-axis bands
const NUM_PLAYERS = 10;  // outfield only (no GK)

const HALF_W = FIELD_W / 2;  // 32.8
const HALF_D = FIELD_D / 2;  // ≈ 21.87

const TAC_MAGIC = Uint8Array.from([0x00, 0xFF, 0xFF, 0x00, 0x01, 0xFF, 0xFF, 0x01, 0xFF, 0xFF, 0x00]);
export const TAC_SIZE = 370;

// ── Ball area detection ───────────────────────────────────────────────────────
/**
 * Returns the ball area 1–35 from the perspective of a team with `attackSign`.
 * Row 0 = own goal, row 6 = opponent goal.
 */
export function getBallArea(ballX: number, ballZ: number, attackSign: 1 | -1): number {
  // Team-relative x: 0 = own goal end, FIELD_W = opp goal end
  const relX = attackSign === 1 ? ballX + HALF_W : HALF_W - ballX;
  const row = Math.min(NUM_ROWS - 1, Math.max(0, Math.floor(relX / FIELD_W * NUM_ROWS)));
  const col = Math.min(NUM_COLS - 1, Math.max(0, Math.floor((ballZ + HALF_D) / FIELD_D * NUM_COLS)));
  return row * NUM_COLS + col + 1;
}

// ── Position encoding / decoding ──────────────────────────────────────────────
/**
 * Encodes game-world (x, z) into a SWOS position byte from `attackSign`'s perspective.
 */
export function encodeSWOSPos(x: number, z: number, attackSign: 1 | -1): number {
  const relX = attackSign === 1 ? x + HALF_W : HALF_W - x;
  const xNib = Math.round(Math.min(15, Math.max(0, (z + HALF_D) / FIELD_D * 15)));
  const yNib = Math.round(Math.min(15, Math.max(0, relX / FIELD_W * 15)));
  return (xNib << 4) | yNib;
}

/**
 * Decodes a SWOS position byte into game-world (x, z) from `attackSign`'s perspective.
 */
export function decodeSWOSPos(byte: number, attackSign: 1 | -1): { x: number; z: number } {
  const xNib = (byte >> 4) & 0xF;
  const yNib = byte & 0xF;
  const relX = (yNib / 15) * FIELD_W;
  const x    = attackSign === 1 ? relX - HALF_W : HALF_W - relX;
  const z    = (xNib / 15) * FIELD_D - HALF_D;
  return { x, z };
}

// ── Tactic type ────────────────────────────────────────────────────────────────
/**
 * A raw SWOS tactic: 10 players × 35 areas = 350 bytes.
 * Always stored from the home-team perspective (attackSign = +1).
 */
export interface SWOSTactic {
  name: string;
  /** Flat array [playerIdx 0–9][areaIdx 0–34] = encoded position byte. */
  data: Uint8Array;
}

// ── .TAC file parser / writer ──────────────────────────────────────────────────
export function parseTacFile(buffer: ArrayBuffer): SWOSTactic {
  const view = new Uint8Array(buffer);
  if (view.length !== TAC_SIZE) {
    throw new Error(`Invalid .TAC: expected ${TAC_SIZE} bytes, got ${view.length}`);
  }
  for (let i = 0; i < TAC_MAGIC.length; i++) {
    if (view[359 + i] !== TAC_MAGIC[i]) throw new Error("Invalid .TAC magic bytes");
  }

  let name = "";
  for (let i = 0; i < 8 && view[i] !== 0; i++) name += String.fromCharCode(view[i]);

  const data = new Uint8Array(NUM_PLAYERS * NUM_AREAS);
  for (let p = 0; p < NUM_PLAYERS; p++) {
    for (let a = 0; a < NUM_AREAS; a++) {
      // SWOS formula: (playerNo * 35) − 26 + (areaNo − 1), playerNo is 1-indexed
      const fileOffset = (p + 1) * 35 - 26 + a;
      data[p * NUM_AREAS + a] = view[fileOffset];
    }
  }
  return { name, data };
}

export function writeTacFile(tactic: SWOSTactic): ArrayBuffer {
  const buf = new Uint8Array(TAC_SIZE);
  for (let i = 0; i < Math.min(8, tactic.name.length); i++) {
    buf[i] = tactic.name.charCodeAt(i);
  }
  for (let p = 0; p < NUM_PLAYERS; p++) {
    for (let a = 0; a < NUM_AREAS; a++) {
      const fileOffset = (p + 1) * 35 - 26 + a;
      buf[fileOffset] = tactic.data[p * NUM_AREAS + a];
    }
  }
  buf.set(TAC_MAGIC, 359);
  return buf.buffer;
}

// ── Procedural tactic generation ──────────────────────────────────────────────
type RoleConfig = {
  /** Team-relative base x (0 = own goal, FIELD_W = opp goal) at neutral ball. */
  baseRelX: number;
  /** Default z position (signed: negative = left, positive = right). */
  baseZ: number;
  /** Max advance (relX units) when ball is at the opponent goal end. */
  fwdAdvance: number;
  /** Max retreat (relX units) when ball is at the own goal end. */
  defRetreat: number;
  /** Fraction of ball's z offset to mirror laterally (0 = none, 1 = full). */
  latTrack: number;
};

/** Builds a 35-byte position table for a role in home-team perspective. */
function buildRoleTable(cfg: RoleConfig): number[] {
  const positions: number[] = [];
  for (let area = 1; area <= NUM_AREAS; area++) {
    const row = Math.floor((area - 1) / NUM_COLS);
    const col = (area - 1) % NUM_COLS;

    // Ball centre in team-relative coordinates
    const ballRelX = (row + 0.5) / NUM_ROWS * FIELD_W;
    const ballZ    = -HALF_D + (col + 0.5) / NUM_COLS * FIELD_D;

    // Advance toward opp goal when ball is in opp half; retreat otherwise
    const distFromCenter = ballRelX - HALF_W;
    let relX = cfg.baseRelX;
    if (distFromCenter > 0) {
      relX = Math.min(FIELD_W - 4, relX + cfg.fwdAdvance * distFromCenter / HALF_W);
    } else {
      relX = Math.max(3, relX - cfg.defRetreat * (-distFromCenter) / HALF_W);
    }

    // Lateral tracking
    const z = Math.max(-HALF_D + 1.5, Math.min(HALF_D - 1.5, cfg.baseZ + ballZ * cfg.latTrack));

    // Store as home-team perspective (attackSign = +1)
    positions.push(encodeSWOSPos(relX - HALF_W, z, 1));
  }
  return positions;
}

/**
 * Canonical role configs.  CB_L / ST_L are left-side variants for roles that
 * field two players — selected when homePos.z < 0.
 */
const ROLE_CONFIGS: Record<string, RoleConfig> = {
  //         baseRelX baseZ   fwd  def  lat
  ST:   { baseRelX: 52, baseZ:  5, fwdAdvance:  8, defRetreat: 24, latTrack: 0.22 },
  ST_L: { baseRelX: 52, baseZ: -5, fwdAdvance:  8, defRetreat: 24, latTrack: 0.22 },
  LW:   { baseRelX: 44, baseZ:-18, fwdAdvance: 10, defRetreat: 18, latTrack: 0.14 },
  RW:   { baseRelX: 44, baseZ: 18, fwdAdvance: 10, defRetreat: 18, latTrack: 0.14 },
  AM:   { baseRelX: 46, baseZ:  0, fwdAdvance: 10, defRetreat: 20, latTrack: 0.35 },
  CM_L: { baseRelX: 35, baseZ: -6, fwdAdvance:  9, defRetreat: 13, latTrack: 0.28 },
  CM_R: { baseRelX: 35, baseZ:  6, fwdAdvance:  9, defRetreat: 13, latTrack: 0.28 },
  CM:   { baseRelX: 35, baseZ:  0, fwdAdvance:  9, defRetreat: 13, latTrack: 0.28 },
  DM:   { baseRelX: 26, baseZ:  0, fwdAdvance:  5, defRetreat:  7, latTrack: 0.20 },
  LB:   { baseRelX: 16, baseZ:-18, fwdAdvance:  7, defRetreat:  5, latTrack: 0.28 },
  RB:   { baseRelX: 16, baseZ: 18, fwdAdvance:  7, defRetreat:  5, latTrack: 0.28 },
  CB:   { baseRelX: 11, baseZ:  6, fwdAdvance:  3, defRetreat:  4, latTrack: 0.10 },
  CB_L: { baseRelX: 11, baseZ: -6, fwdAdvance:  3, defRetreat:  4, latTrack: 0.10 },
};

// Lazy table cache (home-team perspective)
const _tableCache: Record<string, number[]> = {};
function getRoleTable(role: string): number[] {
  if (!_tableCache[role]) {
    const cfg = ROLE_CONFIGS[role] ?? ROLE_CONFIGS["CB"];
    _tableCache[role] = buildRoleTable(cfg);
  }
  return _tableCache[role];
}

/**
 * Returns the SWOS target position for a non-carrier outfield player.
 *
 * @param role      Player role string ("ST", "LW", "CB", "CM_L", …)
 * @param homePos   Formation home position (used to select CB_L / ST_L variant)
 * @param ballArea  Ball area 1–35 from getBallArea()
 * @param attackSign +1 = home team, -1 = away team
 */
export function getSWOSTarget(
  role: string,
  homePos: { x: number; z: number },
  ballArea: number,
  attackSign: 1 | -1,
): { x: number; z: number } {
  // Map legacy role labels to SWOS role keys
  const roleMap: Record<string, string> = {
    LM: "LW", RM: "RW", CF: "ST", CAM: "AM", LW: "LW", RW: "RW",
  };
  // Select left-side variant for shared roles
  let effectiveRole = roleMap[role] ?? role;
  if ((effectiveRole === "CB" || role === "CB") && homePos.z < 0) effectiveRole = "CB_L";
  if ((effectiveRole === "ST" || role === "ST" || role === "CF") && homePos.z < 0) effectiveRole = "ST_L";

  const table = getRoleTable(effectiveRole);
  const idx   = Math.max(0, Math.min(NUM_AREAS - 1, ballArea - 1));
  const byte  = table[idx];

  // Tables are stored home-team perspective (attackSign=+1); flip x for away.
  const decoded = decodeSWOSPos(byte, 1);
  return attackSign === 1 ? decoded : { x: -decoded.x, z: decoded.z };
}

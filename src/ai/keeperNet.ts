/**
 * Lightweight pure-JS feedforward neural network for goalkeeper distribution.
 * No external dependencies — just matrix math for inference.
 *
 * Architecture: inputSize → 32 (ReLU) → 16 (ReLU) → outputSize (softmax)
 *
 * Weights can be loaded from a JSON file exported by the training script.
 * If no weights are loaded, predict() returns null and the caller falls back
 * to the rule-based system.
 */

// ── Action enum matching the keeper distribution styles ──
export const KEEPER_ACTIONS = [
  'THROW',        // 0
  'DRIVEN_KICK',  // 1
  'DROP_KICK',    // 2
  'SIDEWINDER',   // 3
  'PUNT',         // 4
  'GOAL_KICK',    // 5
  'HOLD',         // 6
] as const;
export type KeeperAction = typeof KEEPER_ACTIONS[number];

export const STATE_SIZE = 25;
export const ACTION_SIZE = KEEPER_ACTIONS.length; // 7

// ── Minimal matrix helpers ──
function matMulAddBias(input: Float32Array, weights: Float32Array, bias: Float32Array, rows: number, cols: number): Float32Array {
  const out = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    let sum = bias[r];
    for (let c = 0; c < cols; c++) {
      sum += weights[r * cols + c] * input[c];
    }
    out[r] = sum;
  }
  return out;
}

function relu(arr: Float32Array): Float32Array {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < 0) arr[i] = 0;
  }
  return arr;
}

function softmax(arr: Float32Array): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
  const out = new Float32Array(arr.length);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    out[i] = Math.exp(arr[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < arr.length; i++) out[i] /= sum;
  return out;
}

// ── Weight structure ──
export interface KeeperNetWeights {
  w1: number[];  // 32 * 25 = 800
  b1: number[];  // 32
  w2: number[];  // 16 * 32 = 512
  b2: number[];  // 16
  w3: number[];  // 7 * 16 = 112
  b3: number[];  // 7
}

// ── The network ──
export class KeeperNet {
  private w1: Float32Array | null = null;
  private b1: Float32Array | null = null;
  private w2: Float32Array | null = null;
  private b2: Float32Array | null = null;
  private w3: Float32Array | null = null;
  private b3: Float32Array | null = null;
  private _loaded = false;

  get loaded() { return this._loaded; }

  /** Load weights from a JSON object */
  loadWeights(w: KeeperNetWeights) {
    if (w.w1.length !== 32 * STATE_SIZE) throw new Error(`w1 size: expected ${32 * STATE_SIZE}, got ${w.w1.length}`);
    if (w.b1.length !== 32) throw new Error(`b1 size: expected 32, got ${w.b1.length}`);
    if (w.w2.length !== 16 * 32) throw new Error(`w2 size: expected ${16 * 32}, got ${w.w2.length}`);
    if (w.b2.length !== 16) throw new Error(`b2 size: expected 16, got ${w.b2.length}`);
    if (w.w3.length !== ACTION_SIZE * 16) throw new Error(`w3 size: expected ${ACTION_SIZE * 16}, got ${w.w3.length}`);
    if (w.b3.length !== ACTION_SIZE) throw new Error(`b3 size: expected ${ACTION_SIZE}, got ${w.b3.length}`);
    this.w1 = Float32Array.from(w.w1);
    this.b1 = Float32Array.from(w.b1);
    this.w2 = Float32Array.from(w.w2);
    this.b2 = Float32Array.from(w.b2);
    this.w3 = Float32Array.from(w.w3);
    this.b3 = Float32Array.from(w.b3);
    this._loaded = true;
  }

  /** Forward pass → action probabilities (Float32Array of length 7), or null if not loaded */
  predict(state: Float32Array): Float32Array | null {
    if (!this._loaded || !this.w1) return null;
    let h = matMulAddBias(state, this.w1, this.b1!, 32, STATE_SIZE);
    h = relu(h);
    h = matMulAddBias(h, this.w2!, this.b2!, 16, 32);
    h = relu(h);
    const logits = matMulAddBias(h, this.w3!, this.b3!, ACTION_SIZE, 16);
    return softmax(logits);
  }

  /** Sample an action from the distribution, or return the argmax if greedy */
  sampleAction(probs: Float32Array, greedy = false): number {
    if (greedy) {
      let best = 0;
      for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
      return best;
    }
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (r < cumulative) return i;
    }
    return probs.length - 1;
  }
}

// ── State encoder: normalizes raw game state into a Float32Array[25] ──
export interface KeeperStateInput {
  keeperX: number;      // world position
  keeperZ: number;
  ballX: number;
  ballZ: number;
  fieldW: number;       // field dimensions for normalization
  fieldD: number;
  nearbyPressure: number; // count of opponents within 8m
  panicPressure: number;  // count within 6.5m
  scoreDiff: number;      // our score - their score
  timeRemainingFrac: number; // 0..1 (1 = start of half)
  isSecondHalf: boolean;
  isGoalKick: boolean;
  attackSign: number;     // +1 or -1
  /** Up to 5 teammates, sorted by cover score. Each: [relX, relZ, nearestOppDist, rolePriority] */
  teammates: { relX: number; relZ: number; oppDist: number; rolePri: number }[];
}

export function encodeKeeperState(s: KeeperStateInput): Float32Array {
  const v = new Float32Array(STATE_SIZE);
  // Positions normalized to [-1, 1]
  v[0] = s.keeperX / (s.fieldW / 2);
  v[1] = s.keeperZ / (s.fieldD / 2);
  v[2] = s.ballX / (s.fieldW / 2);
  v[3] = s.ballZ / (s.fieldD / 2);
  // Pressure (normalized roughly)
  v[4] = Math.min(s.nearbyPressure / 5, 1);
  v[5] = Math.min(s.panicPressure / 4, 1);
  // Game context
  v[6] = Math.max(-1, Math.min(1, s.scoreDiff / 3));
  v[7] = s.timeRemainingFrac;
  v[8] = s.isSecondHalf ? 1 : 0;
  v[9] = s.isGoalKick ? 1 : 0;
  v[10] = s.attackSign;
  // 5 teammates × 3 features = indices 11..25 (really 11..25 = 15 slots → pad to 14)
  // Actually: 5 * (relX, relZ, oppDist) = 15 → total 11+15 = 26. Let's use 5 * (relX, relZ, oppDistNorm) = 15
  // But we have 25 total so 11 + 14 = 25. Use 4 teammates × 3 + 1 extra = 13, or 5×2+4 = 14.
  // Let's do: 5 teammates × (relX_norm, relZ_norm, oppDist_norm) = 15 → that's 26. 
  // Reduce to 4 teammates × 3 + 2 extras:
  // Simpler: indices 11-24 → 14 slots → 4 teammates × 3 features + 2 extras
  for (let i = 0; i < 4; i++) {
    const base = 11 + i * 3;
    if (i < s.teammates.length) {
      const tm = s.teammates[i];
      v[base] = Math.max(-1, Math.min(1, tm.relX / 30));
      v[base + 1] = Math.max(-1, Math.min(1, tm.relZ / 20));
      v[base + 2] = Math.min(tm.oppDist / 15, 1);
    }
    // else zeros (already initialized)
  }
  // Slot 23: average coverage of top 4 teammates
  const avgCover = s.teammates.length > 0
    ? s.teammates.slice(0, 4).reduce((a, t) => a + t.oppDist, 0) / Math.min(s.teammates.length, 4)
    : 0;
  v[23] = Math.min(avgCover / 15, 1);
  // Slot 24: best teammate coverage
  v[24] = s.teammates.length > 0 ? Math.min(s.teammates[0].oppDist / 15, 1) : 0;

  return v;
}

// ── Experience record for training ──
export interface KeeperExperience {
  state: number[];        // STATE_SIZE floats
  action: number;         // 0..6
  reward: number;         // +1 teammate received, -1 opponent intercepted, 0 neutral
  style: string;          // human-readable style name
  timestamp: number;
}

// ── Singleton instance ──
export const keeperNet = new KeeperNet();

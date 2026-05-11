/**
 * Pure-JS feedforward net for outfield player decision-making.
 * Architecture: 20 → 128 (ReLU) → 64 (ReLU) → 4 (linear)
 * Actions: 0=pass, 1=shoot, 2=dribble, 3=move
 *
 * Weights loaded from rl/models/outfield_weights.json (extracted from DQN training).
 * Returns Q-values — caller picks the action with the highest value.
 */

export const OUTFIELD_ACTIONS = ['pass', 'shoot', 'dribble', 'move'] as const;
export type OutfieldAction = typeof OUTFIELD_ACTIONS[number];

export interface OutfieldNetWeights {
  w1: number[];  // 128 * 20 = 2560
  b1: number[];  // 128
  w2: number[];  // 64 * 128 = 8192
  b2: number[];  // 64
  w3: number[];  // 4 * 64 = 256
  b3: number[];  // 4
  meta: { state_size: number; hidden1: number; hidden2: number; action_size: number };
}

export interface OutfieldStateInput {
  ballX: number;           // 0..1 (normalized field position)
  ballY: number;           // 0..1
  possession: number;      // 1 = we have ball, 0 = lost
  distToGoal: number;      // normalized 0..1
  closePressure: number;   // opponents within 6.5m (normalized 0..1)
  inFinalThird: boolean;
  inPenaltyArea: boolean;
  inShootingLane: boolean;
  passOptionCount: number; // number of available pass targets (normalized 0..1)
  scoreDiff: number;       // our score - their score (clamped -1..1)
  timeRemainingFrac: number; // 0..1
}

function matMulAddBias(
  input: Float32Array, w: Float32Array, b: Float32Array,
  outRows: number, inCols: number
): Float32Array {
  const out = new Float32Array(outRows);
  for (let r = 0; r < outRows; r++) {
    let sum = b[r];
    for (let c = 0; c < inCols; c++) sum += w[r * inCols + c] * input[c];
    out[r] = sum;
  }
  return out;
}

function relu(arr: Float32Array): Float32Array {
  for (let i = 0; i < arr.length; i++) if (arr[i] < 0) arr[i] = 0;
  return arr;
}

export class OutfieldNet {
  private w1: Float32Array | null = null;
  private b1: Float32Array | null = null;
  private w2: Float32Array | null = null;
  private b2: Float32Array | null = null;
  private w3: Float32Array | null = null;
  private b3: Float32Array | null = null;
  private _loaded = false;

  get loaded() { return this._loaded; }

  loadWeights(w: OutfieldNetWeights) {
    this.w1 = Float32Array.from(w.w1);
    this.b1 = Float32Array.from(w.b1);
    this.w2 = Float32Array.from(w.w2);
    this.b2 = Float32Array.from(w.b2);
    this.w3 = Float32Array.from(w.w3);
    this.b3 = Float32Array.from(w.b3);
    this._loaded = true;
  }

  /** Forward pass → Q-values for [pass, shoot, dribble, move], or null if not loaded */
  predict(state: Float32Array): Float32Array | null {
    if (!this._loaded) return null;
    let h = matMulAddBias(state, this.w1!, this.b1!, 128, 20);
    h = relu(h);
    h = matMulAddBias(h, this.w2!, this.b2!, 64, 128);
    h = relu(h);
    return matMulAddBias(h, this.w3!, this.b3!, 4, 64);
  }

  /** Returns the best action index (0=pass, 1=shoot, 2=dribble, 3=move) */
  bestAction(state: Float32Array): number | null {
    const q = this.predict(state);
    if (!q) return null;
    let best = 0;
    for (let i = 1; i < q.length; i++) if (q[i] > q[best]) best = i;
    return best;
  }
}

export function encodeOutfieldState(s: OutfieldStateInput): Float32Array {
  const v = new Float32Array(20);
  v[0] = s.ballX;
  v[1] = s.ballY;
  v[2] = s.possession;
  v[3] = Math.min(s.distToGoal / 50, 1);        // normalize ~50m max
  v[4] = Math.min(s.closePressure / 4, 1);       // normalize ~4 opponents max
  v[5] = s.inFinalThird ? 1 : 0;
  v[6] = s.inPenaltyArea ? 1 : 0;
  v[7] = s.inShootingLane ? 1 : 0;
  v[8] = Math.min(s.passOptionCount / 5, 1);     // normalize ~5 options max
  v[9] = Math.max(-1, Math.min(1, s.scoreDiff / 3));
  v[10] = s.timeRemainingFrac;
  // v[11..19] = zeros (match training state_size=20, padding for future features)
  return v;
}

export const outfieldNet = new OutfieldNet();

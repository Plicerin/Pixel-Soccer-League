/**
 * Generate seed weights for the keeper distribution neural net by
 * creating synthetic experience from the rule-based system,
 * then training on it via behavioral cloning.
 *
 * Usage: npx tsx src/ai/seedKeeperWeights.ts
 * Output: public/assets/keeper-model/weights.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { STATE_SIZE, ACTION_SIZE, type KeeperNetWeights, type KeeperExperience } from './keeperNet.ts';

// ── Reproduce the rule-based logic to generate labeled data ──
function ruleBasedAction(state: Float64Array): number {
  const nearbyPressure = Math.round(state[4] * 5);   // slot 4: nearbyPressure / 5
  const isGoalKick = state[9] > 0.5;                  // slot 9: isGoalKick
  // Estimate outlet width from teammate positions
  const tmRelZ0 = state[12] * 20; // slot 12: first teammate relZ (denormalized roughly)
  const outletWidth = Math.abs(tmRelZ0);
  // Estimate best outlet distance from coverage
  const bestCover = state[24] * 15; // slot 24: best coverage (denormalized)
  const avgCover = state[23] * 15;

  // GOAL_KICK override
  if (isGoalKick) return 5; // GOAL_KICK

  // Extreme panic
  if (nearbyPressure >= 4) {
    return Math.random() < 0.55 ? 2 : 4; // DROP_KICK or PUNT
  }

  // High pressure
  if (nearbyPressure >= 3) {
    return Math.random() < 0.7 ? 2 : 1; // DROP_KICK or DRIVEN_KICK
  }

  // Medium pressure
  if (nearbyPressure === 2) {
    const roll = Math.random();
    if (roll < 0.45) return 1; // DRIVEN_KICK
    if (roll < 0.72) return 2; // DROP_KICK
    return outletWidth > 8 ? 3 : 1; // SIDEWINDER or DRIVEN_KICK
  }

  // Low pressure — check throw preference
  if (nearbyPressure <= 1 && bestCover > 4.0 && Math.random() < 0.58) {
    return 0; // THROW
  }

  // Calm distribution
  const roll = Math.random();
  if (roll < 0.38) return 1; // DRIVEN_KICK
  if (roll < 0.62) return outletWidth > 8 ? 3 : 1; // SIDEWINDER or DRIVEN_KICK
  if (roll < 0.82) return 2; // DROP_KICK
  return 3; // SIDEWINDER
}

function randomState(): Float64Array {
  const v = new Float64Array(STATE_SIZE);
  // Keeper position — usually near own goal
  v[0] = (Math.random() * 0.3 - 0.85) * (Math.random() < 0.5 ? 1 : -1); // keeperX
  v[1] = (Math.random() * 0.4 - 0.2); // keeperZ
  // Ball — near keeper
  v[2] = v[0] + (Math.random() * 0.04 - 0.02);
  v[3] = v[1] + (Math.random() * 0.04 - 0.02);
  // Pressure
  v[4] = Math.random() * 0.8; // nearbyPressure / 5
  v[5] = Math.min(v[4], Math.random() * 0.6); // panicPressure / 4
  // Game context
  v[6] = (Math.random() * 2 - 1) * 0.67; // scoreDiff / 3
  v[7] = Math.random(); // timeRemainingFrac
  v[8] = Math.random() < 0.5 ? 0 : 1; // isSecondHalf
  v[9] = Math.random() < 0.15 ? 1 : 0; // isGoalKick
  v[10] = Math.random() < 0.5 ? 1 : -1; // attackSign
  // 4 teammates
  for (let i = 0; i < 4; i++) {
    const base = 11 + i * 3;
    v[base] = (Math.random() * 2 - 1) * 0.7;     // relX normalized
    v[base + 1] = (Math.random() * 2 - 1) * 0.6; // relZ normalized
    v[base + 2] = Math.random() * 0.9;             // oppDist normalized
  }
  // Average and best coverage
  v[23] = Math.random() * 0.8;
  v[24] = Math.max(v[23], Math.random() * 0.9);
  return v;
}

// ── Training logic (same as trainKeeper.ts but self-contained) ──
function randn(): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function xavierInit(fanIn: number, fanOut: number): Float64Array {
  const scale = Math.sqrt(2.0 / (fanIn + fanOut));
  const arr = new Float64Array(fanIn * fanOut);
  for (let i = 0; i < arr.length; i++) arr[i] = randn() * scale;
  return arr;
}

function zeros(n: number): Float64Array { return new Float64Array(n); }

function relu(x: Float64Array): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] > 0 ? x[i] : 0;
  return out;
}

function reluGrad(x: Float64Array): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] > 0 ? 1 : 0;
  return out;
}

function softmax(x: Float64Array): Float64Array {
  let max = -Infinity;
  for (let i = 0; i < x.length; i++) if (x[i] > max) max = x[i];
  const out = new Float64Array(x.length);
  let sum = 0;
  for (let i = 0; i < x.length; i++) { out[i] = Math.exp(x[i] - max); sum += out[i]; }
  for (let i = 0; i < x.length; i++) out[i] /= sum;
  return out;
}

function matMulAddBias(input: Float64Array, w: Float64Array, b: Float64Array, rows: number, cols: number): Float64Array {
  const out = new Float64Array(rows);
  for (let r = 0; r < rows; r++) {
    let sum = b[r];
    for (let c = 0; c < cols; c++) sum += w[r * cols + c] * input[c];
    out[r] = sum;
  }
  return out;
}

const HIDDEN1 = 32, HIDDEN2 = 16;

interface Net {
  w1: Float64Array; b1: Float64Array;
  w2: Float64Array; b2: Float64Array;
  w3: Float64Array; b3: Float64Array;
  dw1: Float64Array; db1: Float64Array;
  dw2: Float64Array; db2: Float64Array;
  dw3: Float64Array; db3: Float64Array;
}

function createNet(): Net {
  return {
    w1: xavierInit(STATE_SIZE, HIDDEN1), b1: zeros(HIDDEN1),
    w2: xavierInit(HIDDEN1, HIDDEN2), b2: zeros(HIDDEN2),
    w3: xavierInit(HIDDEN2, ACTION_SIZE), b3: zeros(ACTION_SIZE),
    dw1: zeros(HIDDEN1 * STATE_SIZE), db1: zeros(HIDDEN1),
    dw2: zeros(HIDDEN2 * HIDDEN1), db2: zeros(HIDDEN2),
    dw3: zeros(ACTION_SIZE * HIDDEN2), db3: zeros(ACTION_SIZE),
  };
}

function forward(net: Net, input: Float64Array) {
  const z1 = matMulAddBias(input, net.w1, net.b1, HIDDEN1, STATE_SIZE);
  const h1 = relu(z1);
  const z2 = matMulAddBias(h1, net.w2, net.b2, HIDDEN2, HIDDEN1);
  const h2 = relu(z2);
  const logits = matMulAddBias(h2, net.w3, net.b3, ACTION_SIZE, HIDDEN2);
  const probs = softmax(logits);
  return { z1, h1, z2, h2, logits, probs };
}

function backward(net: Net, input: Float64Array, fwd: ReturnType<typeof forward>, target: number) {
  const dLogits = new Float64Array(ACTION_SIZE);
  for (let i = 0; i < ACTION_SIZE; i++) dLogits[i] = fwd.probs[i];
  dLogits[target] -= 1; // cross-entropy gradient

  for (let r = 0; r < ACTION_SIZE; r++) {
    for (let c = 0; c < HIDDEN2; c++) net.dw3[r * HIDDEN2 + c] += dLogits[r] * fwd.h2[c];
    net.db3[r] += dLogits[r];
  }
  const dh2 = new Float64Array(HIDDEN2);
  for (let c = 0; c < HIDDEN2; c++) {
    let s = 0; for (let r = 0; r < ACTION_SIZE; r++) s += net.w3[r * HIDDEN2 + c] * dLogits[r];
    dh2[c] = s;
  }
  const rg2 = reluGrad(fwd.z2);
  const dz2 = new Float64Array(HIDDEN2);
  for (let i = 0; i < HIDDEN2; i++) dz2[i] = dh2[i] * rg2[i];

  for (let r = 0; r < HIDDEN2; r++) {
    for (let c = 0; c < HIDDEN1; c++) net.dw2[r * HIDDEN1 + c] += dz2[r] * fwd.h1[c];
    net.db2[r] += dz2[r];
  }
  const dh1 = new Float64Array(HIDDEN1);
  for (let c = 0; c < HIDDEN1; c++) {
    let s = 0; for (let r = 0; r < HIDDEN2; r++) s += net.w2[r * HIDDEN1 + c] * dz2[r];
    dh1[c] = s;
  }
  const rg1 = reluGrad(fwd.z1);
  const dz1 = new Float64Array(HIDDEN1);
  for (let i = 0; i < HIDDEN1; i++) dz1[i] = dh1[i] * rg1[i];

  for (let r = 0; r < HIDDEN1; r++) {
    for (let c = 0; c < STATE_SIZE; c++) net.dw1[r * STATE_SIZE + c] += dz1[r] * input[c];
    net.db1[r] += dz1[r];
  }
}

function applyGrads(net: Net, lr: number, bs: number) {
  const scale = lr / Math.max(bs, 1);
  const pairs = [
    [net.w1, net.dw1], [net.b1, net.db1],
    [net.w2, net.dw2], [net.b2, net.db2],
    [net.w3, net.dw3], [net.b3, net.db3],
  ] as [Float64Array, Float64Array][];
  for (const [p, g] of pairs) {
    for (let i = 0; i < p.length; i++) { p[i] -= scale * g[i]; g[i] = 0; }
  }
}

// ── Main ──
function main() {
  const NUM_SAMPLES = 10000;
  const EPOCHS = 300;
  const LR = 0.008;
  const BATCH = 64;

  console.log(`Generating ${NUM_SAMPLES} synthetic samples from rule-based policy...`);

  const samples: { state: Float64Array; action: number }[] = [];
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const state = randomState();
    const action = ruleBasedAction(state);
    samples.push({ state, action });
  }

  // Stats
  const counts = new Array(ACTION_SIZE).fill(0);
  for (const s of samples) counts[s.action]++;
  console.log('Actions:', counts.map((c, i) => `${['THROW','DRIVEN','DROP','SIDE','PUNT','GOAL','HOLD'][i]}=${c}`).join('  '));

  const net = createNet();

  console.log(`Training for ${EPOCHS} epochs...`);
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    // Shuffle
    for (let i = samples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [samples[i], samples[j]] = [samples[j], samples[i]];
    }

    let totalLoss = 0;
    for (let i = 0; i < samples.length; i++) {
      const { state, action } = samples[i];
      const fwd = forward(net, state);
      backward(net, state, fwd, action);
      totalLoss += -Math.log(Math.max(fwd.probs[action], 1e-10));

      if ((i + 1) % BATCH === 0 || i === samples.length - 1) {
        applyGrads(net, LR, BATCH);
      }
    }

    if ((epoch + 1) % 50 === 0 || epoch === 0) {
      let correct = 0;
      for (const { state, action } of samples) {
        const fwd = forward(net, state);
        let best = 0;
        for (let j = 1; j < ACTION_SIZE; j++) if (fwd.probs[j] > fwd.probs[best]) best = j;
        if (best === action) correct++;
      }
      console.log(`  Epoch ${epoch + 1}/${EPOCHS}  loss=${(totalLoss / samples.length).toFixed(4)}  acc=${(correct / samples.length * 100).toFixed(1)}%`);
    }
  }

  // Export
  const outDir = path.join('public', 'assets', 'keeper-model');
  fs.mkdirSync(outDir, { recursive: true });
  const weights: KeeperNetWeights = {
    w1: Array.from(net.w1), b1: Array.from(net.b1),
    w2: Array.from(net.w2), b2: Array.from(net.b2),
    w3: Array.from(net.w3), b3: Array.from(net.b3),
  };
  fs.writeFileSync(path.join(outDir, 'weights.json'), JSON.stringify(weights));
  console.log(`\nWeights saved to ${path.join(outDir, 'weights.json')}`);

  // Final test
  let correct = 0;
  for (const { state, action } of samples) {
    const fwd = forward(net, state);
    let best = 0;
    for (let j = 1; j < ACTION_SIZE; j++) if (fwd.probs[j] > fwd.probs[best]) best = j;
    if (best === action) correct++;
  }
  console.log(`Final accuracy: ${(correct / samples.length * 100).toFixed(1)}%`);
}

main();

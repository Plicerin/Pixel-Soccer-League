/**
 * Offline training script for the keeper distribution neural net.
 *
 * Usage:
 *   npx tsx src/ai/trainKeeper.ts [experience.json] [--epochs N] [--lr RATE]
 *
 * Reads experience tuples, trains via policy-gradient (REINFORCE) or
 * behavioral cloning, and writes weights to public/assets/keeper-model/weights.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { STATE_SIZE, ACTION_SIZE, type KeeperNetWeights, type KeeperExperience } from './keeperNet.ts';

// ── Hyperparameters ──
const DEFAULT_EPOCHS = 200;
const DEFAULT_LR = 0.005;
const HIDDEN1 = 32;
const HIDDEN2 = 16;

// ── Matrix helpers (training needs gradients too) ──
function randn(): number {
  // Box-Muller transform
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

function zeros(n: number): Float64Array {
  return new Float64Array(n);
}

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
  for (let i = 0; i < x.length; i++) {
    out[i] = Math.exp(x[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < x.length; i++) out[i] /= sum;
  return out;
}

function matMulAddBias(input: Float64Array, w: Float64Array, b: Float64Array, rows: number, cols: number): Float64Array {
  const out = new Float64Array(rows);
  for (let r = 0; r < rows; r++) {
    let sum = b[r];
    for (let c = 0; c < cols; c++) {
      sum += w[r * cols + c] * input[c];
    }
    out[r] = sum;
  }
  return out;
}

// ── Network with gradient storage ──
interface TrainableNet {
  w1: Float64Array; b1: Float64Array;
  w2: Float64Array; b2: Float64Array;
  w3: Float64Array; b3: Float64Array;
  // Gradient accumulators
  dw1: Float64Array; db1: Float64Array;
  dw2: Float64Array; db2: Float64Array;
  dw3: Float64Array; db3: Float64Array;
}

function createNet(): TrainableNet {
  return {
    w1: xavierInit(STATE_SIZE, HIDDEN1), b1: zeros(HIDDEN1),
    w2: xavierInit(HIDDEN1, HIDDEN2), b2: zeros(HIDDEN2),
    w3: xavierInit(HIDDEN2, ACTION_SIZE), b3: zeros(ACTION_SIZE),
    dw1: zeros(HIDDEN1 * STATE_SIZE), db1: zeros(HIDDEN1),
    dw2: zeros(HIDDEN2 * HIDDEN1), db2: zeros(HIDDEN2),
    dw3: zeros(ACTION_SIZE * HIDDEN2), db3: zeros(ACTION_SIZE),
  };
}

function forward(net: TrainableNet, input: Float64Array) {
  const z1 = matMulAddBias(input, net.w1, net.b1, HIDDEN1, STATE_SIZE);
  const h1 = relu(z1);
  const z2 = matMulAddBias(h1, net.w2, net.b2, HIDDEN2, HIDDEN1);
  const h2 = relu(z2);
  const logits = matMulAddBias(h2, net.w3, net.b3, ACTION_SIZE, HIDDEN2);
  const probs = softmax(logits);
  return { z1, h1, z2, h2, logits, probs };
}

function backward(net: TrainableNet, input: Float64Array, fwd: ReturnType<typeof forward>, targetAction: number, advantage: number) {
  // Cross-entropy gradient for policy gradient: dL/dlogits = probs - one_hot(action), scaled by advantage
  const dLogits = new Float64Array(ACTION_SIZE);
  for (let i = 0; i < ACTION_SIZE; i++) {
    dLogits[i] = fwd.probs[i] * advantage;
  }
  dLogits[targetAction] -= advantage;

  // Gradient for w3, b3
  for (let r = 0; r < ACTION_SIZE; r++) {
    for (let c = 0; c < HIDDEN2; c++) {
      net.dw3[r * HIDDEN2 + c] += dLogits[r] * fwd.h2[c];
    }
    net.db3[r] += dLogits[r];
  }

  // Backprop through h2
  const dh2 = new Float64Array(HIDDEN2);
  for (let c = 0; c < HIDDEN2; c++) {
    let sum = 0;
    for (let r = 0; r < ACTION_SIZE; r++) sum += net.w3[r * HIDDEN2 + c] * dLogits[r];
    dh2[c] = sum;
  }
  const dz2 = new Float64Array(HIDDEN2);
  const rg2 = reluGrad(fwd.z2);
  for (let i = 0; i < HIDDEN2; i++) dz2[i] = dh2[i] * rg2[i];

  // Gradient for w2, b2
  for (let r = 0; r < HIDDEN2; r++) {
    for (let c = 0; c < HIDDEN1; c++) {
      net.dw2[r * HIDDEN1 + c] += dz2[r] * fwd.h1[c];
    }
    net.db2[r] += dz2[r];
  }

  // Backprop through h1
  const dh1 = new Float64Array(HIDDEN1);
  for (let c = 0; c < HIDDEN1; c++) {
    let sum = 0;
    for (let r = 0; r < HIDDEN2; r++) sum += net.w2[r * HIDDEN1 + c] * dz2[r];
    dh1[c] = sum;
  }
  const dz1 = new Float64Array(HIDDEN1);
  const rg1 = reluGrad(fwd.z1);
  for (let i = 0; i < HIDDEN1; i++) dz1[i] = dh1[i] * rg1[i];

  // Gradient for w1, b1
  for (let r = 0; r < HIDDEN1; r++) {
    for (let c = 0; c < STATE_SIZE; c++) {
      net.dw1[r * STATE_SIZE + c] += dz1[r] * input[c];
    }
    net.db1[r] += dz1[r];
  }
}

function applyGradients(net: TrainableNet, lr: number, batchSize: number) {
  const scale = lr / Math.max(batchSize, 1);
  const params = [
    [net.w1, net.dw1], [net.b1, net.db1],
    [net.w2, net.dw2], [net.b2, net.db2],
    [net.w3, net.dw3], [net.b3, net.db3],
  ] as [Float64Array, Float64Array][];
  for (const [p, g] of params) {
    for (let i = 0; i < p.length; i++) {
      p[i] -= scale * g[i];
      g[i] = 0; // zero gradients
    }
  }
}

function exportWeights(net: TrainableNet): KeeperNetWeights {
  return {
    w1: Array.from(net.w1),
    b1: Array.from(net.b1),
    w2: Array.from(net.w2),
    b2: Array.from(net.b2),
    w3: Array.from(net.w3),
    b3: Array.from(net.b3),
  };
}

// ── Main ──
function main() {
  const args = process.argv.slice(2);
  let experienceFile = 'keeper-experience.json';
  let epochs = DEFAULT_EPOCHS;
  let lr = DEFAULT_LR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--epochs' && args[i + 1]) { epochs = parseInt(args[i + 1]); i++; }
    else if (args[i] === '--lr' && args[i + 1]) { lr = parseFloat(args[i + 1]); i++; }
    else if (!args[i].startsWith('-')) experienceFile = args[i];
  }

  if (!fs.existsSync(experienceFile)) {
    console.error(`Experience file not found: ${experienceFile}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(experienceFile, 'utf-8');
  let experiences: KeeperExperience[];
  try {
    experiences = JSON.parse(rawData);
  } catch {
    // Try JSONL format
    experiences = rawData.trim().split('\n').map(line => JSON.parse(line));
  }

  console.log(`Loaded ${experiences.length} experiences`);
  if (experiences.length === 0) {
    console.error('No experiences to train on');
    process.exit(1);
  }

  // Stats
  const actionCounts = new Array(ACTION_SIZE).fill(0);
  let posRewards = 0, negRewards = 0, neutralRewards = 0;
  for (const exp of experiences) {
    actionCounts[exp.action]++;
    if (exp.reward > 0) posRewards++;
    else if (exp.reward < 0) negRewards++;
    else neutralRewards++;
  }
  console.log('Action distribution:', actionCounts.map((c, i) => `${['THROW','DRIVEN','DROP','SIDE','PUNT','GOAL','HOLD'][i]}=${c}`).join(' '));
  console.log(`Rewards: +1=${posRewards}  -1=${negRewards}  0=${neutralRewards}`);

  const net = createNet();

  // Check if we have an existing model to warm-start from
  const modelPath = path.join('public', 'assets', 'keeper-model', 'weights.json');
  if (fs.existsSync(modelPath)) {
    const existing = JSON.parse(fs.readFileSync(modelPath, 'utf-8')) as KeeperNetWeights;
    net.w1 = Float64Array.from(existing.w1);
    net.b1 = Float64Array.from(existing.b1);
    net.w2 = Float64Array.from(existing.w2);
    net.b2 = Float64Array.from(existing.b2);
    net.w3 = Float64Array.from(existing.w3);
    net.b3 = Float64Array.from(existing.b3);
    console.log('Warm-starting from existing weights');
  }

  // Training loop
  for (let epoch = 0; epoch < epochs; epoch++) {
    // Shuffle experiences
    for (let i = experiences.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [experiences[i], experiences[j]] = [experiences[j], experiences[i]];
    }

    let totalLoss = 0;
    const batchSize = Math.min(32, experiences.length);
    let batchCount = 0;

    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];
      const input = Float64Array.from(exp.state);
      const fwd = forward(net, input);

      // For behavioral cloning (reward = 0): use advantage = 1 (just imitate)
      // For policy gradient: use actual reward as advantage
      const advantage = exp.reward === 0 ? 1.0 : exp.reward;

      backward(net, input, fwd, exp.action, advantage);

      // Log loss: -log(prob of taken action)
      totalLoss += -Math.log(Math.max(fwd.probs[exp.action], 1e-10));

      if ((i + 1) % batchSize === 0 || i === experiences.length - 1) {
        applyGradients(net, lr, batchSize);
        batchCount++;
      }
    }

    if ((epoch + 1) % 20 === 0 || epoch === 0) {
      const avgLoss = totalLoss / experiences.length;
      // Compute accuracy
      let correct = 0;
      for (const exp of experiences) {
        const fwd = forward(net, Float64Array.from(exp.state));
        let best = 0;
        for (let j = 1; j < ACTION_SIZE; j++) if (fwd.probs[j] > fwd.probs[best]) best = j;
        if (best === exp.action) correct++;
      }
      console.log(`Epoch ${epoch + 1}/${epochs}  loss=${avgLoss.toFixed(4)}  acc=${(correct / experiences.length * 100).toFixed(1)}%`);
    }
  }

  // Export weights
  const outDir = path.join('public', 'assets', 'keeper-model');
  fs.mkdirSync(outDir, { recursive: true });
  const weights = exportWeights(net);
  fs.writeFileSync(path.join(outDir, 'weights.json'), JSON.stringify(weights));
  console.log(`\nWeights saved to ${path.join(outDir, 'weights.json')}`);

  // Final accuracy
  let correct = 0;
  for (const exp of experiences) {
    const fwd = forward(net, Float64Array.from(exp.state));
    let best = 0;
    for (let j = 1; j < ACTION_SIZE; j++) if (fwd.probs[j] > fwd.probs[best]) best = j;
    if (best === exp.action) correct++;
  }
  console.log(`Final accuracy: ${(correct / experiences.length * 100).toFixed(1)}%`);
}

main();

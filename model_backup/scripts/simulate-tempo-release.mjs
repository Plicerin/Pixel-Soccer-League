import { chooseTempoReleaseTarget } from '../src/ai/tempoRelease.ts';

const roles = ['NEAR_POST', 'FAR_POST', 'CUTBACK', 'SECOND_WAVE'];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function chance(p) {
  return Math.random() < p;
}

function makeTarget(role, forceNoCentralFinish) {
  const central = role === 'CUTBACK' || role === 'SECOND_WAVE';
  const finishLane = forceNoCentralFinish && central
    ? false
    : chance(central ? 0.64 : 0.82);
  const maxPassDist = central ? rand(9, 15) : rand(11, 19);
  const passDist = maxPassDist + rand(-5, 7);

  return {
    role,
    finishLane,
    laneAcceptable: chance(0.86),
    laneBlocked: chance(central ? 0.14 : 0.10),
    passDist,
    maxPassDist,
    oppSpace: rand(0.2, 5.0),
    forwardProg: central ? rand(-12, 8) : rand(-7, 9),
    score: rand(-0.5, 5.0),
  };
}

function makeScenario() {
  const forceNoCentralFinish = chance(0.16);
  return {
    targets: roles.map((role) => makeTarget(role, forceNoCentralFinish)),
    context: {
      secondsSinceIntentStart: rand(0.5, 4.8),
      structuredTouchCount: Math.floor(rand(0, 4)),
      coachWaitCapHit: chance(0.12),
      carrierWideEnough: chance(0.88),
      carrierAdvancedEnough: chance(0.86),
    },
  };
}

function runBatch(samples) {
  const metrics = {
    samples,
    ready: 0,
    selected: 0,
    noCentralFinish: 0,
    notReady: 0,
    invalidSelection: 0,
    roles: Object.fromEntries(roles.map((role) => [role, 0])),
    reasons: {
      tempo_age: 0,
      setup_complete: 0,
      coach_wait_cap: 0,
      not_ready: 0,
      no_central_finish: 0,
    },
  };

  for (let i = 0; i < samples; i += 1) {
    const scenario = makeScenario();
    const decision = chooseTempoReleaseTarget(scenario.targets, scenario.context);
    metrics.reasons[decision.reason] += 1;

    if (!decision.ready) {
      metrics.notReady += 1;
      continue;
    }

    metrics.ready += 1;
    if (!decision.target) {
      if (decision.reason === 'no_central_finish') metrics.noCentralFinish += 1;
      continue;
    }

    metrics.selected += 1;
    metrics.roles[decision.target.role] += 1;
    if (
      !['CUTBACK', 'SECOND_WAVE'].includes(decision.target.role)
      || !decision.target.finishLane
      || !decision.target.laneAcceptable
      || decision.target.laneBlocked
      || decision.target.passDist > decision.target.maxPassDist + 3.5
      || decision.target.oppSpace < 0.85
      || decision.target.forwardProg <= -10.0
    ) {
      metrics.invalidSelection += 1;
    }
  }

  return metrics;
}

function passes(metrics) {
  if (metrics.selected < 1000) return false;
  if (metrics.roles.NEAR_POST !== 0 || metrics.roles.FAR_POST !== 0) return false;
  if (metrics.invalidSelection !== 0) return false;

  const cutbackShare = metrics.roles.CUTBACK / metrics.selected;
  const secondWaveShare = metrics.roles.SECOND_WAVE / metrics.selected;
  return cutbackShare >= 0.25 && secondWaveShare >= 0.35 && metrics.noCentralFinish > 0;
}

const attempts = 6;
const samples = 25000;
let last = null;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const metrics = runBatch(samples);
  last = { attempt, ...metrics };
  if (passes(metrics)) {
    console.log(JSON.stringify({ pass: true, ...last }, null, 2));
    process.exit(0);
  }
}

console.log(JSON.stringify({ pass: false, ...last }, null, 2));
process.exit(1);


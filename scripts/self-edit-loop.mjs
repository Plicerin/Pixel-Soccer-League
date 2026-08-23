#!/usr/bin/env node

console.error([
  'self-edit-loop is disabled for the simple gameplay model rewrite.',
  'The previous recipes targeted deleted files such as src/ai/fsmPositioning.ts and src/ai/structuredAttack.ts.',
  'Use telemetry reports and direct code changes against src/core/simpleMatchModel.ts instead.',
].join('\n'));

process.exit(2);

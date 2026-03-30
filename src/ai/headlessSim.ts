// Legacy headless simulation — replaced by browser-based experience collection.
//
// The new keeper RL pipeline:
//   1. Play matches in browser → experiences logged to keeperExperienceBuffer
//   2. Export via window.__gameRef.exportKeeperExperienceJSON()
//   3. Train offline: npx tsx src/ai/trainKeeper.ts experience.json
//   4. Seed from rule-based: npx tsx src/ai/seedKeeperWeights.ts
//
// This file is kept for reference only.
export {};

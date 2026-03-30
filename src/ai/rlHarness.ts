// Legacy RL harness — replaced by hybrid keeper model in keeperNet.ts
// The old getGoalkeeperState/applyGoalkeeperAction/getReward/isGameOver
// exports have been removed from gameEngine.ts.
// See keeperNet.ts for the new pure-JS neural net approach.
export { keeperNet, encodeKeeperState, KEEPER_ACTIONS } from './keeperNet.ts';

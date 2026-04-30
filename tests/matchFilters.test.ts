import test from 'node:test';
import assert from 'node:assert/strict';

import { filterGhostMatchRows, isGhostMatchRow } from '../src/server/matchFilters.ts';

test('V16 ghost match rows are hidden from DB match history', () => {
  const real = {
    session_id: 'ft-real',
    phase: 'FULL_TIME',
    bundle_json: JSON.stringify({ sessionActive: true, matchId: 'M-REAL1', teamA: { name: 'Atlanta United' } }),
  };
  const ghost = {
    session_id: 'ft-ghost',
    phase: 'FULL_TIME',
    bundle_json: JSON.stringify({ sessionActive: false, teamA: { name: 'Inter Miami' }, teamB: { name: 'LA Galaxy' } }),
  };
  const legacy = {
    session_id: 'ft-legacy',
    bundle_json: JSON.stringify({ teamA: { name: 'Inter Miami' }, teamB: { name: 'LA Galaxy' } }),
  };

  assert.equal(isGhostMatchRow(ghost), true);
  assert.equal(isGhostMatchRow(real), false);
  assert.equal(isGhostMatchRow(legacy), false);
  assert.deepEqual(filterGhostMatchRows([ghost, real, legacy]).map((row) => row.session_id), ['ft-real', 'ft-legacy']);
});

test('modern default Miami-Galaxy full-time row without match id is hidden', () => {
  const ghost = {
    session_id: 'ft-1777253519813',
    team_a_name: 'Inter Miami',
    team_b_name: 'LA Galaxy',
    phase: 'FULL_TIME',
    bundle_json: JSON.stringify({
      sessionActive: true,
      matchId: null,
      teamA: { name: 'Inter Miami' },
      teamB: { name: 'LA Galaxy' },
    }),
  };
  const realMiamiGalaxy = {
    session_id: 'ft-real-miami-la',
    team_a_name: 'Inter Miami',
    team_b_name: 'LA Galaxy',
    phase: 'FULL_TIME',
    bundle_json: JSON.stringify({
      sessionActive: true,
      matchId: 'M-ABCDE',
      teamA: { name: 'Inter Miami' },
      teamB: { name: 'LA Galaxy' },
    }),
  };

  assert.equal(isGhostMatchRow(ghost), true);
  assert.equal(isGhostMatchRow(realMiamiGalaxy), false);
  assert.deepEqual(filterGhostMatchRows([ghost, realMiamiGalaxy]).map((row) => row.session_id), ['ft-real-miami-la']);
});

test('default Miami-Galaxy ft session without row phase is hidden', () => {
  const ghost = {
    session_id: 'ft-1777253519813',
    team_a_name: 'Inter Miami',
    team_b_name: 'LA Galaxy',
    bundle_json: JSON.stringify({
      sessionActive: true,
      teamA: { name: 'Inter Miami' },
      teamB: { name: 'LA Galaxy' },
      snapshot: { phase: 'FULL_TIME' },
    }),
  };

  assert.equal(isGhostMatchRow(ghost), true);
});

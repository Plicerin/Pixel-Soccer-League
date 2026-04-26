import test from 'node:test';
import assert from 'node:assert/strict';

import { filterGhostMatchRows, isGhostMatchRow } from '../src/server/matchFilters.ts';

test('V16 ghost match rows are hidden from DB match history', () => {
  const real = {
    session_id: 'ft-real',
    bundle_json: JSON.stringify({ sessionActive: true, teamA: { name: 'Atlanta United' } }),
  };
  const ghost = {
    session_id: 'ft-ghost',
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

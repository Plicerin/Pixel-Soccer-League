import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGamepadPairLatch, pickStandardGamepads } from '../src/gamepadSelect';

/**
 * Dual-gamepad selection. Slot 0 is player 1 (team A), slot 1 is player 2
 * (team B). Touch order decides who is who, not USB slot order: the analog
 * keyboards and virtual-pad buses that motivated the single-pad latch take the
 * low getGamepads() slots, so slot numbers mean nothing.
 */

type PadInit = {
  index: number;
  mapping?: string;
  connected?: boolean;
  pressedButton?: number;
  axis0?: number;
};

const makePad = (init: PadInit): Gamepad =>
  ({
    index: init.index,
    connected: init.connected ?? true,
    mapping: init.mapping ?? 'standard',
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === init.pressedButton })),
    axes: [init.axis0 ?? 0, 0, 0, 0],
  }) as unknown as Gamepad;

/** getGamepads() keeps each pad at its own index, with nulls between. */
const installPads = (...pads: Gamepad[]) => {
  const slots: (Gamepad | null)[] = [];
  for (const pad of pads) slots[pad.index] = pad;
  for (let i = 0; i < slots.length; i++) slots[i] ??= null;
  Object.defineProperty(globalThis, 'navigator', {
    value: { getGamepads: () => slots },
    configurable: true,
    writable: true,
  });
};

test('dual pads: touch order assigns player 1 then player 2', () => {
  const latch = createGamepadPairLatch();
  // Player 1 grabs their pad first -- even from a high USB slot.
  installPads(makePad({ index: 0 }), makePad({ index: 3, pressedButton: 0 }));
  let [padA, padB] = pickStandardGamepads(latch);
  assert.equal(padA?.index, 3, 'first touched pad must become player 1');
  assert.equal(padB, null, 'nobody has claimed player 2 yet');

  // Now player 2 touches theirs.
  installPads(makePad({ index: 0, pressedButton: 1 }), makePad({ index: 3 }));
  [padA, padB] = pickStandardGamepads(latch);
  assert.equal(padA?.index, 3, 'player 1 keeps their pad');
  assert.equal(padB?.index, 0, 'second touched pad must become player 2');
});

test('dual pads: one pad never fills both slots', () => {
  const latch = createGamepadPairLatch();
  installPads(makePad({ index: 1, pressedButton: 0 }));
  let [padA, padB] = pickStandardGamepads(latch);
  assert.equal(padA?.index, 1);
  assert.equal(padB, null, 'a lone pad must not double as player 2');

  // Still held and still touched on the next poll: unchanged.
  [padA, padB] = pickStandardGamepads(latch);
  assert.equal(padA?.index, 1);
  assert.equal(padB, null);
});

test('dual pads: player 2 requires a deliberate touch, player 1 keeps the idle fallback', () => {
  const latch = createGamepadPairLatch();
  // Two idle standard pads: the first works for player 1 immediately (menu
  // parity with the single-pad picker), but player 2 stays empty so a phantom
  // ViGEm device can never start steering team B unprompted.
  installPads(makePad({ index: 0 }), makePad({ index: 1 }));
  const [padA, padB] = pickStandardGamepads(latch);
  assert.equal(padA?.index, 0, 'player 1 falls back to the first standard pad');
  assert.equal(latch.indices[0], null, 'the fallback must not latch');
  assert.equal(padB, null, 'player 2 must stay empty until touched');
});

test('dual pads: a pad latched to player 2 never doubles as player 1 fallback', () => {
  const latch = createGamepadPairLatch();
  installPads(makePad({ index: 0, pressedButton: 0 }), makePad({ index: 1 }));
  pickStandardGamepads(latch);
  installPads(makePad({ index: 0 }), makePad({ index: 1, pressedButton: 0 }));
  pickStandardGamepads(latch);
  assert.deepEqual(latch.indices, [0, 1]);

  // Player 1's pad dies; only player 2's pad remains.
  installPads(makePad({ index: 1 }));
  const [padA, padB] = pickStandardGamepads(latch);
  assert.equal(padA, null, 'player 2\'s pad must not be handed to player 1');
  assert.equal(padB?.index, 1);
});

test('dual pads: disconnect frees the slot and reports which one', () => {
  const latch = createGamepadPairLatch();
  installPads(makePad({ index: 0, pressedButton: 0 }), makePad({ index: 1 }));
  pickStandardGamepads(latch);
  installPads(makePad({ index: 0 }), makePad({ index: 1, pressedButton: 0 }));
  pickStandardGamepads(latch);

  const switched: number[] = [];
  installPads(makePad({ index: 0 }));
  const [padA, padB] = pickStandardGamepads(latch, (slot) => switched.push(slot));
  assert.equal(padA?.index, 0, 'player 1 keeps their pad');
  assert.equal(padB, null, 'disconnected pad must vacate player 2');
  assert.deepEqual(switched, [1], 'the freed slot must be reported so edge state resets');
  assert.equal(latch.indices[1], null);

  // A newly touched pad can then claim the freed slot.
  installPads(makePad({ index: 0 }), makePad({ index: 2, pressedButton: 0 }));
  const [, nextB] = pickStandardGamepads(latch);
  assert.equal(nextB?.index, 2, 'a new touched pad must claim the freed player 2 slot');
});

test('dual pads: non-standard devices never claim a player slot', () => {
  const latch = createGamepadPairLatch();
  // An analog keyboard mashing away in slot 0 must not become either player.
  installPads(makePad({ index: 0, mapping: '', pressedButton: 0 }), makePad({ index: 1 }));
  const [padA, padB] = pickStandardGamepads(latch);
  assert.equal(padA?.index, 1, 'fallback must skip non-standard devices');
  assert.equal(padB, null);
  assert.deepEqual(latch.indices, [null, null]);
});

test('dual pads: engine routes the second pad to team B in two-player mode', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(engine, /createGamepadPairLatch\(\)/, 'engine must keep a two-slot pad latch');
  assert.match(engine, /pickStandardGamepads\(/, 'engine must poll both pads through the shared selector');
  assert.match(
    engine,
    /gamepadBActive = this\.twoPlayerMode && !!gamepadB/,
    'pad 2 must only act in two-player mode',
  );
  assert.match(
    engine,
    /justPressedB\(0\)\) this\.model\.beginManualCharge\('B', 'pass'\)/,
    'pad 2 A button must charge a team-B pass',
  );
  assert.match(
    engine,
    /justPressedB\(1\)\) this\.model\.beginManualCharge\('B', 'shot'\)/,
    'pad 2 B button must charge a team-B shot',
  );
  assert.match(
    engine,
    /justPressedB\(3\)\) this\.model\.beginManualCharge\('B', 'lob'\)/,
    'pad 2 Y button must charge a team-B lob',
  );
  assert.match(
    engine,
    /callRestartRoutineByDirection\('up', 'B'\)/,
    'pad 2 D-pad must call routines for team B only',
  );
  assert.match(
    engine,
    /setManualSprint\('B', this\.twoPlayerMode && \(this\.pressedKeys\.has\('ShiftRight'\) \|\| gamepadSprintB\)\)/,
    'pad 2 triggers must sprint team B alongside Right Shift',
  );
  assert.match(
    engine,
    /callRestartRoutineByDirection\('up', padARoutineTeam\)/,
    'with a second pad present, pad 1 routine calls must be pinned to team A',
  );
});

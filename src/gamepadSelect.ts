/**
 * Shared gamepad selection.
 *
 * Slot 0 is not reliably the controller. Analog keyboards (e.g. Razer
 * Huntsman Analog, vendor 1532) and virtual-pad buses (ViGEm, Steam) enumerate
 * as gamepads and routinely take the low slots, so `getGamepads()[0]` can be a
 * keyboard. Both the engine's gameplay poller and the UI's menu poller must
 * agree on which device is the pad, hence one implementation here.
 *
 * Only standard-mapped pads are eligible: every button index either caller
 * uses (A=0, B=1, X=2, Y=3, LB=4, RB=5, LT=6, RT=7, Start=9) comes from the
 * W3C standard mapping and means nothing on a device that does not claim it.
 */
export type GamepadLatch = { index: number | null };

export function createGamepadLatch(): GamepadLatch {
  return { index: null };
}

/** Deadzone above which stick movement counts as deliberate input. */
const ACTIVE_AXIS_THRESHOLD = 0.35;

const eligiblePad = (pad: Gamepad | null | undefined): pad is Gamepad =>
  !!pad && pad.connected && pad.mapping === 'standard';

const deliberatelyTouched = (pad: Gamepad) =>
  pad.buttons.some((button) => button?.pressed)
  || pad.axes.some((axis) => Math.abs(axis ?? 0) > ACTIVE_AXIS_THRESHOLD);

export function pickStandardGamepad(latch: GamepadLatch, onSwitch?: () => void): Gamepad | null {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];

  if (latch.index !== null) {
    const held = pads[latch.index];
    if (eligiblePad(held)) return held;
    latch.index = null;
    onSwitch?.();
  }

  let firstStandard: Gamepad | null = null;
  for (const pad of pads) {
    if (!eligiblePad(pad)) continue;
    firstStandard ??= pad;
    if (!deliberatelyTouched(pad)) continue;
    latch.index = pad.index;
    onSwitch?.();
    return pad;
  }
  return firstStandard;
}

/**
 * Two-player selection. Slot 0 is player 1 (team A), slot 1 is player 2
 * (team B), and touch order decides who is who: the first pad touched is
 * player 1, the next distinct pad touched is player 2. USB slot order means
 * nothing, for the same virtual-device reasons as above.
 */
export type GamepadPairLatch = { indices: [number | null, number | null] };

export function createGamepadPairLatch(): GamepadPairLatch {
  return { indices: [null, null] };
}

export function pickStandardGamepads(
  latch: GamepadPairLatch,
  onSwitch?: (slot: 0 | 1) => void,
): [Gamepad | null, Gamepad | null] {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const held: [Gamepad | null, Gamepad | null] = [null, null];

  for (const slot of [0, 1] as const) {
    const index = latch.indices[slot];
    if (index === null) continue;
    const pad = pads[index];
    if (eligiblePad(pad)) {
      held[slot] = pad;
    } else {
      latch.indices[slot] = null;
      onSwitch?.(slot);
    }
  }

  let firstUnclaimed: Gamepad | null = null;
  for (const pad of pads) {
    if (!eligiblePad(pad)) continue;
    if (pad.index === latch.indices[0] || pad.index === latch.indices[1]) continue;
    firstUnclaimed ??= pad;
    if (!deliberatelyTouched(pad)) continue;
    const slot = latch.indices[0] === null ? 0 : latch.indices[1] === null ? 1 : null;
    if (slot === null) break;
    latch.indices[slot] = pad.index;
    held[slot] = pad;
    onSwitch?.(slot);
  }

  // Player 1 keeps the single-picker's idle fallback so a pad drives menus
  // without a touch first. Player 2 never gets one: an unclaimed phantom
  // device must not start steering team B unprompted.
  if (held[0] === null && latch.indices[0] === null) held[0] = firstUnclaimed;
  return held;
}

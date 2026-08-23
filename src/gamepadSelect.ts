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

export function pickStandardGamepad(latch: GamepadLatch, onSwitch?: () => void): Gamepad | null {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const eligible = (pad: Gamepad | null): pad is Gamepad =>
    !!pad && pad.connected && pad.mapping === 'standard';

  if (latch.index !== null) {
    const held = pads[latch.index];
    if (eligible(held)) return held;
    latch.index = null;
    onSwitch?.();
  }

  let firstStandard: Gamepad | null = null;
  for (const pad of pads) {
    if (!eligible(pad)) continue;
    firstStandard ??= pad;
    const touched = pad.buttons.some((button) => button?.pressed)
      || pad.axes.some((axis) => Math.abs(axis ?? 0) > ACTIVE_AXIS_THRESHOLD);
    if (!touched) continue;
    latch.index = pad.index;
    onSwitch?.();
    return pad;
  }
  return firstStandard;
}

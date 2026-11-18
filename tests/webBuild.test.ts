import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pickStandardGamepad, createGamepadLatch, readGamepads } from '../src/gamepadSelect';
import { hasDevServer, isWebBuild } from '../src/runtimeEnv';

/**
 * Static web builds (itch.io, Pages) have no dev server. Before the
 * PSL_WEB_BUILD flag, hasDevServer() was true on any non-Tauri page, so every
 * match on itch POSTed telemetry to /__telemetry and /__tuning on the CDN.
 */

const withGlobals = (globals: Record<string, unknown>, fn: () => void) => {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  try {
    fn();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  }
};

test('a plain browser page without the web flag still counts as the dev server', () => {
  withGlobals({ window: {} }, () => {
    assert.equal(isWebBuild(), false);
    assert.equal(hasDevServer(), true);
  });
});

test('a web build never talks to the dev-server routes', () => {
  withGlobals({ window: {}, __PSL_WEB_BUILD__: true }, () => {
    assert.equal(isWebBuild(), true);
    assert.equal(hasDevServer(), false);
  });
});

test('the desktop app never talks to the dev-server routes', () => {
  withGlobals({ window: { __TAURI_INTERNALS__: {} } }, () => {
    assert.equal(hasDevServer(), false);
  });
});

test('vite stamps the web flag from PSL_WEB_BUILD', () => {
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.match(config, /__PSL_WEB_BUILD__:\s*JSON\.stringify\(process\.env\.PSL_WEB_BUILD === '1'\)/);
});

test('a gamepad API that throws (iframe without allow="gamepad") reads as no pads', () => {
  const throwing = {
    getGamepads() {
      throw new DOMException('gamepad is not allowed', 'SecurityError');
    },
  };
  withGlobals({ navigator: throwing }, () => {
    assert.deepEqual([...readGamepads()], []);
    assert.equal(pickStandardGamepad(createGamepadLatch()), null);
  });
});

test('the splash and menu read pads only through the guarded helper', () => {
  const source = readFileSync(new URL('../src/components/RetroFootball.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /navigator\.getGamepads\(/);
});

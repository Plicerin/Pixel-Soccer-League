/**
 * Where is this bundle running?
 *
 * The Vite dev and preview servers host the `/__db`, `/__tuning` and
 * `/__telemetry` middleware that the debug tooling talks to (see
 * vite.config.ts). The packaged Tauri build serves the very same bundle from
 * the asset protocol, where those routes simply 404 — and a 404 does not
 * reject a fetch, so the callers' catch blocks never fire and the failure is
 * invisible. Anything that depends on those routes must be gated on
 * `hasDevServer()` so the shipped game does not do pointless work.
 *
 * Tauri injects `__TAURI_INTERNALS__` before any page script runs, so probing
 * for it is reliable and keeps dev *and* preview on the tooling path.
 *
 * Static web builds (itch.io, GitHub Pages) have no server at all, so they are
 * stamped at build time with `PSL_WEB_BUILD=1` (see vite.config.ts). Without
 * that flag every match on itch POSTed telemetry batches to the itch CDN.
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

/** True for a static web build (itch.io / Pages), stamped in by vite. */
export function isWebBuild(): boolean {
  // `__PSL_WEB_BUILD__` is undefined under the node test runner, so probe it.
  return typeof __PSL_WEB_BUILD__ !== 'undefined' && __PSL_WEB_BUILD__ === true;
}

/** True when the page is served by the PSL dev/preview server. */
export function hasDevServer(): boolean {
  return typeof window !== 'undefined' && !isDesktopApp() && !isWebBuild();
}

;/*
 * Pixel Soccer League infinite free-play helper.
 *
 * Load from the browser console while the game is open.
 * Paste exactly this one line, without quotes or markdown fences:
 *   ;var s=document.createElement("script");s.src="/infinite-game.js?cache="+Date.now();document.head.appendChild(s)
 *
 * API after loading:
 *   window.pslInfiniteGame.start()
 *   window.pslInfiniteGame.stop()
 *   window.pslInfiniteGame.status()
 */
(function () {
  const GLOBAL_KEY = '__pslInfiniteGame';
  const STYLE_ID = 'psl-infinite-game-style';
  const BADGE_ID = 'psl-infinite-game-badge';
  const INFINITE_HALF_SECONDS = Number.MAX_SAFE_INTEGER / 1000;
  const DEFAULT_OPTIONS = {
    cpuVsCpu: true,
    hideScoreboards: true,
    showBadge: true,
    restartDelayGoal: 0.8,
    restartDelayHalf: 1.2,
  };

  const existing = window[GLOBAL_KEY];
  if (existing && existing.start) {
    existing.start();
    return;
  }

  function findGame() {
    return window.__gameRef || window.pslGame || null;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForGame(timeoutMs = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const game = findGame();
      if (game && game.getMatchSnapshot && game.startKickoffPresentation) return game;
      await sleep(100);
    }
    throw new Error('PSL game engine was not found. Open the game first, then load /infinite-game.js.');
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '[data-psl-scoreboard="live"],',
      '[data-psl-scoreboard="engine-live"] {',
      '  display: none !important;',
      '}',
      '#psl-infinite-game-badge {',
      '  position: fixed;',
      '  right: 12px;',
      '  bottom: 12px;',
      '  z-index: 9999;',
      '  padding: 8px 10px;',
      '  border: 2px solid #111;',
      '  border-radius: 4px;',
      '  background: rgba(255,255,255,0.92);',
      '  color: #111;',
      '  font: 700 11px/1.25 Consolas, Monaco, monospace;',
      '  letter-spacing: .08em;',
      '  text-transform: uppercase;',
      '  pointer-events: none;',
      '  box-shadow: 0 4px 18px rgba(0,0,0,.35);',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function installBadge() {
    if (document.getElementById(BADGE_ID)) return;
    const badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.textContent = 'Infinite Free Play';
    document.body.appendChild(badge);
  }

  function removeBadge() {
    document.getElementById(BADGE_ID)?.remove();
  }

  function zeroScore(model) {
    if (!model) return;
    if (model.msm?.score) {
      model.msm.score.home = 0;
      model.msm.score.away = 0;
    }
    if (model.teamA) model.teamA.score = 0;
    if (model.teamB) model.teamB.score = 0;
    if (Array.isArray(model.goalLog)) model.goalLog.length = 0;
  }

  function forceNoTimeLimit(model) {
    if (!model?.msm?.clock) return;
    model.runtimeHalfDuration = INFINITE_HALF_SECONDS;
    model.matchClockScale = 1;
    model.msm.clock.halfDuration = INFINITE_HALF_SECONDS;
    model.msm.clock.stoppageTime = 0;
    if (model.msm.state?.kind === 'full_time') {
      model.msm.clock.half = 1;
      model.msm.clock.elapsedInHalf = Math.min(model.msm.clock.elapsedInHalf || 0, 45 * 60);
      model.msm.state = { kind: 'live_play', half: 1, startTick: 0 };
    }
  }

  function sanitizeSnapshot(snapshot) {
    if (!snapshot) return snapshot;
    const phase = snapshot.phase === 'FULL_TIME' ? 'LIVE_PLAY' : snapshot.phase;
    return {
      ...snapshot,
      scoreA: 0,
      scoreB: 0,
      phase,
      halfDuration: INFINITE_HALF_SECONDS,
      runtimeHalfDuration: INFINITE_HALF_SECONDS,
      matchClockScale: 1,
      goalLog: [],
    };
  }

  function sanitizeTelemetry(telemetry) {
    if (!telemetry) return telemetry;
    return {
      ...telemetry,
      halfDuration: INFINITE_HALF_SECONDS,
      runtimeHalfDuration: INFINITE_HALF_SECONDS,
      matchClockScale: 1,
      score: { a: 0, b: 0 },
    };
  }

  function sanitizeBundle(bundle) {
    if (!bundle) return bundle;
    return {
      ...bundle,
      teamA: bundle.teamA ? { ...bundle.teamA, score: 0 } : bundle.teamA,
      teamB: bundle.teamB ? { ...bundle.teamB, score: 0 } : bundle.teamB,
      goalLog: [],
      metadata: {
        ...(bundle.metadata || {}),
        halfDuration: INFINITE_HALF_SECONDS,
        runtimeHalfDuration: INFINITE_HALF_SECONDS,
        matchClockScale: 1,
        infiniteFreePlay: true,
      },
    };
  }

  function patchGame(game, state) {
    if (state.game === game && state.originals) return;
    state.game = game;
    state.originals = {
      step: game.model?.step?.bind(game.model) || null,
      getMatchSnapshot: game.getMatchSnapshot?.bind(game) || null,
      getLiveTelemetry: game.getLiveTelemetry?.bind(game) || null,
      getTuningBundle: game.getTuningBundle?.bind(game) || null,
    };

    const harden = () => {
      forceNoTimeLimit(game.model);
      zeroScore(game.model);
      game.setScoreBugVisible?.(false);
    };

    if (game.model && state.originals.step) {
      game.model.step = function patchedInfiniteStep(rawDt) {
        harden();
        const result = state.originals.step(rawDt);
        harden();
        return result;
      };
    }

    if (state.originals.getMatchSnapshot) {
      game.getMatchSnapshot = function patchedInfiniteSnapshot() {
        harden();
        return sanitizeSnapshot(state.originals.getMatchSnapshot());
      };
    }

    if (state.originals.getLiveTelemetry) {
      game.getLiveTelemetry = function patchedInfiniteTelemetry() {
        harden();
        return sanitizeTelemetry(state.originals.getLiveTelemetry());
      };
    }

    if (state.originals.getTuningBundle) {
      game.getTuningBundle = function patchedInfiniteBundle() {
        harden();
        return sanitizeBundle(state.originals.getTuningBundle());
      };
    }

    harden();
  }

  function restoreGame(state) {
    const game = state.game;
    const originals = state.originals;
    if (!game || !originals) return;
    if (game.model && originals.step) game.model.step = originals.step;
    if (originals.getMatchSnapshot) game.getMatchSnapshot = originals.getMatchSnapshot;
    if (originals.getLiveTelemetry) game.getLiveTelemetry = originals.getLiveTelemetry;
    if (originals.getTuningBundle) game.getTuningBundle = originals.getTuningBundle;
    state.originals = null;
  }

  const state = {
    running: false,
    startedAt: 0,
    options: { ...DEFAULT_OPTIONS },
    game: null,
    originals: null,
    guardTimer: 0,
  };

  async function start(options = {}) {
    state.options = { ...DEFAULT_OPTIONS, ...options };
    const game = await waitForGame();
    patchGame(game, state);

    if (state.options.hideScoreboards) installStyle();
    else removeStyle();
    if (state.options.showBadge) installBadge();
    else removeBadge();

    game.setSplashSceneMode?.(false);
    game.setMenuVisible?.(false);
    game.setPaused?.(false);
    game.setCpuVsCpu?.(state.options.cpuVsCpu);
    game.setSeriesSpeedMul?.(1);
    game.setRestartDelays?.(state.options.restartDelayGoal, state.options.restartDelayHalf);

    forceNoTimeLimit(game.model);
    game.resetMatch?.();
    forceNoTimeLimit(game.model);
    zeroScore(game.model);
    game.startKickoffPresentation?.(true);
    forceNoTimeLimit(game.model);
    zeroScore(game.model);

    window.clearInterval(state.guardTimer);
    state.guardTimer = window.setInterval(() => {
      const activeGame = findGame();
      if (activeGame && activeGame !== state.game) patchGame(activeGame, state);
      forceNoTimeLimit(state.game?.model);
      zeroScore(state.game?.model);
    }, 250);

    state.running = true;
    state.startedAt = Date.now();
    console.info('[PSL Infinite] running: no full time, scores locked at 0-0');
    return status();
  }

  function stop() {
    window.clearInterval(state.guardTimer);
    state.guardTimer = 0;
    restoreGame(state);
    removeStyle();
    removeBadge();
    state.running = false;
    console.info('[PSL Infinite] stopped');
    return status();
  }

  function status() {
    const snap = state.game?.getMatchSnapshot?.() || null;
    return {
      running: state.running,
      startedAt: state.startedAt,
      uptimeSeconds: state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0,
      phase: snap?.phase || null,
      half: snap?.half || null,
      elapsedInHalf: snap?.elapsedInHalf || null,
      scoreA: snap?.scoreA ?? null,
      scoreB: snap?.scoreB ?? null,
      halfDuration: snap?.halfDuration || null,
    };
  }

  const api = { start, stop, status };
  window[GLOBAL_KEY] = api;
  window.pslInfiniteGame = api;

  if (!new URLSearchParams(window.location.search).has('pslInfiniteManual')) {
    start().catch((error) => console.error('[PSL Infinite]', error));
  }
})();

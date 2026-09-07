(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NK = root.NK || {};
  root.NK.survivorLogic = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // Tuning constants.
  var START_WINDOW_MS = 1400; // window on wave 1
  var MIN_WINDOW_MS = 350;    // floor: never ask for a faster reaction than this
  var DECAY_PER_WAVE = 0.92;  // exponential decay factor applied per wave

  var DIRS = ['left', 'right', 'up', 'down'];
  var OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

  // windowMs(wave) — the time budget (ms) the player has to react on a given
  // wave. Decays exponentially from START_WINDOW_MS toward MIN_WINDOW_MS as
  // wave rises, clamped so it never drops below the floor. Wave numbers below
  // 1 (0, negative, fractional) are treated as "at least as easy as wave 1".
  function windowMs(wave) {
    var w = Number(wave);
    if (!Number.isFinite(w)) w = 1;
    if (w < 1) w = 1;
    var raw = START_WINDOW_MS * Math.pow(DECAY_PER_WAVE, w - 1);
    return Math.max(MIN_WINDOW_MS, raw);
  }

  // safeDir(dir) — the safe direction to move given an incoming attack from
  // `dir` (i.e. dodge away from it). Returns undefined for an unknown input.
  function safeDir(dir) {
    return OPPOSITE[dir];
  }

  return {
    MIN_WINDOW_MS: MIN_WINDOW_MS,
    START_WINDOW_MS: START_WINDOW_MS,
    DIRS: DIRS,
    windowMs: windowMs,
    safeDir: safeDir,
  };
});

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

  // Parry tuning. A parry only succeeds inside a tight window at the END of
  // the round's timing window (the last third, by default). Pressed earlier
  // it fails exactly like a wrong dodge — this keeps parry a risk/reward
  // alternative to dodging rather than a strictly-better input.
  var PARRY_TAIL_FRACTION = 1 / 3;

  // Combo tuning. A parry pays a bonus a plain dodge does not.
  var DODGE_COMBO_GAIN = 1;
  var PARRY_COMBO_GAIN = 2;

  // Difficulty-ramp tuning: the wave each mechanic first becomes possible.
  var DOUBLE_ATTACK_WAVE = 4;
  var FAKE_OUT_WAVE = 7;

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

  // parryResult(elapsedMs, windowMs) — classifies a parry attempt pressed
  // `elapsedMs` into a round with the given `windowMs` budget:
  //   'success' — inside the tail window (parry lands).
  //   'early'   — before the tail window (fails like a wrong dodge).
  //   'timeout' — at or after the window closes.
  function parryResult(elapsedMs, windowMs) {
    var e = Number(elapsedMs);
    var w = Number(windowMs);
    if (!Number.isFinite(e) || !Number.isFinite(w) || w <= 0) return 'timeout';
    if (e >= w) return 'timeout';
    var tailStart = w * (1 - PARRY_TAIL_FRACTION);
    if (e >= tailStart) return 'success';
    return 'early';
  }

  // comboGain(action) — how much combo a successful 'dodge' or 'parry' pays.
  // Unknown actions pay nothing.
  function comboGain(action) {
    if (action === 'parry') return PARRY_COMBO_GAIN;
    if (action === 'dodge') return DODGE_COMBO_GAIN;
    return 0;
  }

  // hasDoubleAttack(wave) / hasFakeOut(wave) — whether the difficulty ramp
  // has introduced each mechanic by the given wave.
  function hasDoubleAttack(wave) {
    return Number(wave) >= DOUBLE_ATTACK_WAVE;
  }

  function hasFakeOut(wave) {
    return Number(wave) >= FAKE_OUT_WAVE;
  }

  // roundSafeDirs(attackDirs, isFakeOut) — every input direction that counts
  // as a successful dodge for a round.
  //   - A plain single attack ([dir], isFakeOut=false): only the exact
  //     opposite of `dir` is safe. Identical to safeDir(dir) — unchanged from
  //     the original single-attack behavior.
  //   - A fake-out ([dir], isFakeOut=true): the telegraph is a feint, so
  //     moving INTO the telegraphed direction is the safe response instead.
  //   - A double-attack ([dirA, dirB], any two distinct directions): any
  //     direction not currently under attack is safe.
  function roundSafeDirs(attackDirs, isFakeOut) {
    var dirs = attackDirs || [];
    if (dirs.length <= 1) {
      var only = dirs[0];
      return [isFakeOut ? only : safeDir(only)];
    }
    return DIRS.filter(function (d) { return dirs.indexOf(d) === -1; });
  }

  // isSafeDodge(attackDirs, isFakeOut, inputDir) — whether `inputDir` dodges
  // (or parries-through) the round described by `attackDirs`/`isFakeOut`.
  function isSafeDodge(attackDirs, isFakeOut, inputDir) {
    if (inputDir === null || inputDir === undefined) return false;
    return roundSafeDirs(attackDirs, isFakeOut).indexOf(inputDir) !== -1;
  }

  return {
    MIN_WINDOW_MS: MIN_WINDOW_MS,
    START_WINDOW_MS: START_WINDOW_MS,
    DIRS: DIRS,
    windowMs: windowMs,
    safeDir: safeDir,
    PARRY_TAIL_FRACTION: PARRY_TAIL_FRACTION,
    DODGE_COMBO_GAIN: DODGE_COMBO_GAIN,
    PARRY_COMBO_GAIN: PARRY_COMBO_GAIN,
    DOUBLE_ATTACK_WAVE: DOUBLE_ATTACK_WAVE,
    FAKE_OUT_WAVE: FAKE_OUT_WAVE,
    parryResult: parryResult,
    comboGain: comboGain,
    hasDoubleAttack: hasDoubleAttack,
    hasFakeOut: hasFakeOut,
    roundSafeDirs: roundSafeDirs,
    isSafeDodge: isSafeDodge,
  };
});

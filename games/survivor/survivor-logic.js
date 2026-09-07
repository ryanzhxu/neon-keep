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
  //
  // `attackDirs` must be an array. A bare string has `.length > 1` (e.g.
  // 'left'.length === 4), so without a guard it falls through to the
  // double-attack branch and silently returns a plausible-looking but wrong
  // answer instead of failing loudly. A string is coerced to a one-element
  // array (the caller almost certainly meant "one direction"); any other
  // non-array value (number, object, null, undefined) has no sane
  // single-direction reading, so it is treated as no attack at all.
  //
  // With no valid attack direction at all (an empty array, or anything
  // normalized down to one above), this fails CLOSED: it returns `[]`, not
  // a one-element array holding `dirs[0]` (`undefined`). No attack means no
  // round, so nothing should read as a successful dodge — returning `[]`
  // here (rather than falling into the single-direction branch below, where
  // `only` would be `undefined`) is what makes that guarantee hold for any
  // caller, not just isSafeDodge's own separate null-check on its input.
  function roundSafeDirs(attackDirs, isFakeOut) {
    var dirs;
    if (Array.isArray(attackDirs)) {
      dirs = attackDirs;
    } else if (typeof attackDirs === 'string' && attackDirs) {
      dirs = [attackDirs];
    } else {
      dirs = [];
    }
    if (dirs.length === 0) return [];
    if (dirs.length === 1) {
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

  // ---- particle burst (juice) ----------------------------------------------
  // The canvas loop owns a small fixed-size particle pool; these are the pure
  // pieces of that pool's per-particle math, factored out so they are
  // testable without a browser. A "particle" is plain data:
  // { x, y, vx, vy, ageMs, lifeMs } (vx/vy in canvas px per ms).

  // updateParticle(p, dtMs) — advances one particle's position and age by
  // dtMs of elapsed time. Mutates and returns `p` in place (the canvas pool
  // is fixed-size and reused, so this never allocates a new object). A
  // missing/non-finite/negative dtMs is treated as 0 (no movement).
  function updateParticle(p, dtMs) {
    if (!p) return p;
    var dt = Number(dtMs);
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ageMs += dt;
    return p;
  }

  // particleAlive(p) — whether a particle is still within its lifetime.
  // A particle with lifeMs <= 0 (including an unspawned pool slot) is never
  // alive.
  function particleAlive(p) {
    return !!p && p.lifeMs > 0 && p.ageMs < p.lifeMs;
  }

  // particleAlpha(p) — opacity (0..1) for a particle given its age/life, so
  // it fades out smoothly instead of popping off abruptly. 0 for a dead (or
  // missing) particle.
  function particleAlpha(p) {
    if (!particleAlive(p)) return 0;
    var t = p.ageMs / p.lifeMs;
    return t <= 0 ? 1 : (1 - t);
  }

  // ---- rising audio tempo with intensity -------------------------------
  // As waves climb and the timing window shrinks, an ambient tempo tick
  // should speed up and sharpen. These two pure functions decide "how
  // intense" a wave is and "how fast the tick should be" from that
  // intensity; survivor.js just calls them from the existing loop and feeds
  // the result into NK.audio.play.

  // audioIntensity(wave) — 0 (calm, wave 1) to 1 (max intensity, the window
  // has decayed all the way to MIN_WINDOW_MS) scalar, derived directly from
  // the same windowMs() ramp that drives difficulty. Always in [0, 1].
  function audioIntensity(wave) {
    var span = START_WINDOW_MS - MIN_WINDOW_MS;
    if (span <= 0) return 1;
    var raw = (START_WINDOW_MS - windowMs(wave)) / span;
    if (raw < 0) return 0;
    if (raw > 1) return 1;
    return raw;
  }

  // Tempo tuning: ms between ambient ticks at minimum vs. maximum intensity.
  var TICK_INTERVAL_SLOW_MS = 900;
  var TICK_INTERVAL_FAST_MS = 260;

  // tickIntervalMs(intensity) — ms between ambient ticks at a given
  // intensity (see audioIntensity). Linearly interpolates from the slow
  // resting tempo at intensity 0 down to the fast tempo at intensity 1.
  // Out-of-range or non-finite intensity is clamped into [0, 1] first.
  function tickIntervalMs(intensity) {
    var i = Number(intensity);
    if (!Number.isFinite(i)) i = 0;
    if (i < 0) i = 0;
    if (i > 1) i = 1;
    return TICK_INTERVAL_SLOW_MS - (TICK_INTERVAL_SLOW_MS - TICK_INTERVAL_FAST_MS) * i;
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
    updateParticle: updateParticle,
    particleAlive: particleAlive,
    particleAlpha: particleAlpha,
    audioIntensity: audioIntensity,
    TICK_INTERVAL_SLOW_MS: TICK_INTERVAL_SLOW_MS,
    TICK_INTERVAL_FAST_MS: TICK_INTERVAL_FAST_MS,
    tickIntervalMs: tickIntervalMs,
  };
});

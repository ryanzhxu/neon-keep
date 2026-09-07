// tests/survivor-logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../games/survivor/survivor-logic.js');

test('windowMs shrinks as wave rises but never below the floor', () => {
  const early = S.windowMs(1);
  const late = S.windowMs(50);
  assert.ok(early > late, 'later waves are harder');
  assert.ok(late >= S.MIN_WINDOW_MS, 'never below floor');
});

test('safeDir returns the opposite of the attack direction', () => {
  assert.strictEqual(S.safeDir('left'), 'right');
  assert.strictEqual(S.safeDir('up'), 'down');
});

test('windowMs is monotonically non-increasing across a range of waves', () => {
  let prev = S.windowMs(1);
  for (let wave = 2; wave <= 100; wave++) {
    const cur = S.windowMs(wave);
    assert.ok(cur <= prev, `windowMs(${wave})=${cur} should be <= windowMs(${wave - 1})=${prev}`);
    prev = cur;
  }
});

test('windowMs clamps exactly at MIN_WINDOW_MS for very high waves', () => {
  assert.strictEqual(S.windowMs(1000), S.MIN_WINDOW_MS);
  assert.strictEqual(S.windowMs(10000), S.MIN_WINDOW_MS);
});

test('windowMs(0) behaves like an early wave and stays above the floor', () => {
  const w0 = S.windowMs(0);
  assert.ok(w0 > S.MIN_WINDOW_MS, 'wave 0 should still be well above the floor');
  assert.ok(w0 <= S.windowMs(1) + 1, 'wave 0 should not be harder than wave 1');
});

test('windowMs handles negative waves without going below the floor', () => {
  const wNeg = S.windowMs(-5);
  assert.ok(wNeg >= S.MIN_WINDOW_MS, 'negative wave stays at or above the floor');
  assert.ok(Number.isFinite(wNeg), 'negative wave produces a finite number');
});

test('windowMs handles non-integer waves without going below the floor', () => {
  const wFrac = S.windowMs(4.5);
  assert.ok(Number.isFinite(wFrac), 'fractional wave produces a finite number');
  assert.ok(wFrac >= S.MIN_WINDOW_MS, 'fractional wave stays at or above the floor');
  // Should sit between the neighboring integer waves (monotonic decay).
  assert.ok(wFrac <= S.windowMs(4) && wFrac >= S.windowMs(5));
});

test('safeDir maps all four directions to their opposite', () => {
  assert.strictEqual(S.safeDir('left'), 'right');
  assert.strictEqual(S.safeDir('right'), 'left');
  assert.strictEqual(S.safeDir('up'), 'down');
  assert.strictEqual(S.safeDir('down'), 'up');
});

test('safeDir returns undefined (or a safe fallback) for an unknown direction', () => {
  const result = S.safeDir('sideways');
  assert.ok(result === undefined || result === null, 'unknown direction has no defined opposite');
});

test('MIN_WINDOW_MS is exported as a positive number', () => {
  assert.strictEqual(typeof S.MIN_WINDOW_MS, 'number');
  assert.ok(S.MIN_WINDOW_MS > 0);
});

// windowMs(1) is the very first thing a player experiences. It must be exactly
// the documented start value, not just "close" or "less than wave 2".
test('windowMs(1) equals the documented start value exactly', () => {
  assert.strictEqual(S.windowMs(1), S.START_WINDOW_MS);
});

// The endpoints (early is bigger than late, late clamps at very high waves)
// are already covered above. This checks the ramp actually touches the floor
// within the normal wave range, and — once there — never creeps back up.
test('windowMs actually reaches the floor within 200 waves and stays there', () => {
  let floorWave = null;
  for (let wave = 1; wave <= 200; wave++) {
    if (S.windowMs(wave) === S.MIN_WINDOW_MS) { floorWave = wave; break; }
  }
  assert.ok(floorWave !== null, 'windowMs never reaches MIN_WINDOW_MS within 200 waves');
  for (let wave = floorWave; wave <= floorWave + 50; wave++) {
    assert.strictEqual(S.windowMs(wave), S.MIN_WINDOW_MS, `wave ${wave} should stay at the floor once reached`);
  }
});

// ---- parry ---------------------------------------------------------------
// A parry succeeds only inside a tight tail window at the END of the round's
// timing window. Too early: fails like a wrong dodge. Too late: a timeout.

test('PARRY_TAIL_FRACTION is exported as a fraction of the window', () => {
  assert.strictEqual(typeof S.PARRY_TAIL_FRACTION, 'number');
  assert.ok(S.PARRY_TAIL_FRACTION > 0 && S.PARRY_TAIL_FRACTION < 1);
});

test('parryResult succeeds inside the tail window', () => {
  const w = 900;
  const tailStart = w * (1 - S.PARRY_TAIL_FRACTION);
  assert.strictEqual(S.parryResult(tailStart, w), 'success', 'the tail boundary itself counts as a parry');
  assert.strictEqual(S.parryResult(w - 1, w), 'success', 'just before the window closes counts as a parry');
});

test('parryResult fails as an early miss before the tail window', () => {
  const w = 900;
  const tailStart = w * (1 - S.PARRY_TAIL_FRACTION);
  assert.strictEqual(S.parryResult(0, w), 'early');
  assert.strictEqual(S.parryResult(tailStart - 1, w), 'early');
});

test('parryResult times out at or after the window closes', () => {
  const w = 900;
  assert.strictEqual(S.parryResult(w, w), 'timeout');
  assert.strictEqual(S.parryResult(w + 500, w), 'timeout');
});

// ---- combo ----------------------------------------------------------------
// A parry pays a combo bonus a plain dodge does not.

test('comboGain rewards parry more than dodge', () => {
  const dodgeGain = S.comboGain('dodge');
  const parryGain = S.comboGain('parry');
  assert.strictEqual(typeof dodgeGain, 'number');
  assert.strictEqual(typeof parryGain, 'number');
  assert.ok(parryGain > dodgeGain, 'a parry must pay more combo than a dodge');
  assert.strictEqual(dodgeGain, S.DODGE_COMBO_GAIN);
  assert.strictEqual(parryGain, S.PARRY_COMBO_GAIN);
});

// ---- double-attacks and fake-outs -----------------------------------------
// Higher waves add double-attacks and fake-outs (spec, difficulty ramp).

test('hasDoubleAttack turns on at DOUBLE_ATTACK_WAVE and not before', () => {
  assert.strictEqual(S.hasDoubleAttack(S.DOUBLE_ATTACK_WAVE - 1), false);
  assert.strictEqual(S.hasDoubleAttack(S.DOUBLE_ATTACK_WAVE), true);
  assert.strictEqual(S.hasDoubleAttack(S.DOUBLE_ATTACK_WAVE + 10), true);
});

test('hasFakeOut turns on at FAKE_OUT_WAVE and not before', () => {
  assert.strictEqual(S.hasFakeOut(S.FAKE_OUT_WAVE - 1), false);
  assert.strictEqual(S.hasFakeOut(S.FAKE_OUT_WAVE), true);
  assert.strictEqual(S.hasFakeOut(S.FAKE_OUT_WAVE + 10), true);
});

test('fake-outs are introduced on a later wave than double-attacks', () => {
  assert.ok(S.FAKE_OUT_WAVE > S.DOUBLE_ATTACK_WAVE);
});

// ---- generalized safe-dodge check ------------------------------------------
// roundSafeDirs/isSafeDodge must generalize safeDir without changing its
// result for the plain single-attack, non-fake-out case that already ships.

test('isSafeDodge matches safeDir exactly for a plain single attack', () => {
  for (const d of S.DIRS) {
    const safe = S.safeDir(d);
    assert.strictEqual(S.isSafeDodge([d], false, safe), true, `${safe} should dodge a ${d} attack`);
    for (const wrong of S.DIRS) {
      if (wrong === safe) continue;
      assert.strictEqual(S.isSafeDodge([d], false, wrong), false, `${wrong} should not dodge a ${d} attack`);
    }
  }
});

test('isSafeDodge on a fake-out round requires moving into the telegraphed direction', () => {
  assert.strictEqual(S.isSafeDodge(['left'], true, 'left'), true);
  assert.strictEqual(S.isSafeDodge(['left'], true, S.safeDir('left')), false);
});

test('isSafeDodge on a double-attack round accepts any direction not under attack', () => {
  const attackDirs = ['left', 'up'];
  assert.strictEqual(S.isSafeDodge(attackDirs, false, 'right'), true);
  assert.strictEqual(S.isSafeDodge(attackDirs, false, 'down'), true);
  assert.strictEqual(S.isSafeDodge(attackDirs, false, 'left'), false);
  assert.strictEqual(S.isSafeDodge(attackDirs, false, 'up'), false);
});

test('isSafeDodge rejects a null or unmatched input', () => {
  assert.strictEqual(S.isSafeDodge(['left'], false, null), false);
  assert.strictEqual(S.isSafeDodge(['left'], false, 'sideways'), false);
});

// ---- roundSafeDirs input guard (regression) --------------------------------
// attackDirs must be an array. A bare string has `.length > 1` (e.g.
// 'left'.length === 4), so without a guard it silently falls through to the
// double-attack branch and returns a plausible-looking but wrong answer
// instead of failing loudly. See the CONTRACT: a single string must be read
// as one direction, matching the equivalent one-element array exactly.

test('roundSafeDirs treats a bare string attackDirs as a single direction, not a double-attack', () => {
  const fromArray = S.roundSafeDirs(['left'], false);
  assert.deepStrictEqual(fromArray, ['right']);
  const fromString = S.roundSafeDirs('left', false);
  assert.deepStrictEqual(fromString, ['right'],
    'a bare string must be coerced to a single direction, not fall through to the double-attack branch');
});

test('isSafeDodge never succeeds when attackDirs is a malformed non-array, non-string value', () => {
  assert.doesNotThrow(() => S.isSafeDodge(42, false, 'left'));
  for (const d of S.DIRS) {
    assert.strictEqual(S.isSafeDodge(42, false, d), false);
    assert.strictEqual(S.isSafeDodge({}, false, d), false);
  }
});

// roundSafeDirs must fail CLOSED when there is no valid attack direction at
// all: an empty array, or anything the guard above normalizes down to one
// (null, undefined, a non-string non-array, an empty string). "No attack"
// means "no round", so nothing should read as a successful dodge — the
// previous guard normalized `dirs` to `[]` correctly but then still fell
// into the single-direction branch, where `dirs[0]` is `undefined` and the
// function returned `[undefined]` (a one-element array holding a junk
// value) instead of `[]`. That is itself a silent-wrong-answer shape: a
// caller doing `.length` or `.includes(x)` on the result gets a lie, even
// though isSafeDodge happens to still reject it today via its own null
// check on inputDir.
test('roundSafeDirs returns an empty list (fails closed), never [undefined], when there is no valid attack', () => {
  const noAttackInputs = [[], null, undefined, 42, ''];
  for (const bad of noAttackInputs) {
    assert.deepStrictEqual(S.roundSafeDirs(bad, false), [],
      `roundSafeDirs(${JSON.stringify(bad)}, false) must be [], not a list containing undefined`);
  }
});

test('isSafeDodge rejects every direction when there is no valid attack to dodge', () => {
  const noAttackInputs = [[], null, undefined, 42, ''];
  for (const bad of noAttackInputs) {
    for (const d of S.DIRS) {
      assert.strictEqual(S.isSafeDodge(bad, false, d), false,
        `isSafeDodge(${JSON.stringify(bad)}, false, '${d}') must be false — no attack means no safe direction`);
    }
  }
});

// ---- particle burst (juice) -----------------------------------------------
// Pure per-particle math factored out of the canvas pool so it is testable
// without a browser. See survivor.js for how the fixed-size pool uses these.

test('updateParticle advances position by velocity * dt and ages the particle', () => {
  const p = { x: 10, y: 20, vx: 2, vy: -1, ageMs: 0, lifeMs: 100 };
  const result = S.updateParticle(p, 50);
  assert.strictEqual(result, p, 'mutates and returns the same object (no allocation)');
  assert.strictEqual(p.x, 110);
  assert.strictEqual(p.y, -30);
  assert.strictEqual(p.ageMs, 50);
});

test('updateParticle treats a missing, non-finite, or negative dt as zero movement', () => {
  const base = { x: 5, y: 5, vx: 3, vy: 3, ageMs: 0, lifeMs: 100 };
  for (const badDt of [undefined, NaN, -10]) {
    const p = { ...base };
    S.updateParticle(p, badDt);
    assert.strictEqual(p.x, 5, `dt=${badDt} must not move x`);
    assert.strictEqual(p.y, 5, `dt=${badDt} must not move y`);
    assert.strictEqual(p.ageMs, 0, `dt=${badDt} must not age the particle`);
  }
});

test('updateParticle on a null/undefined particle is a safe no-op', () => {
  assert.strictEqual(S.updateParticle(null, 16), null);
  assert.strictEqual(S.updateParticle(undefined, 16), undefined);
});

test('particleAlive is true only strictly within lifeMs and only for a spawned particle', () => {
  assert.strictEqual(S.particleAlive({ ageMs: 0, lifeMs: 100 }), true);
  assert.strictEqual(S.particleAlive({ ageMs: 99, lifeMs: 100 }), true);
  assert.strictEqual(S.particleAlive({ ageMs: 100, lifeMs: 100 }), false, 'age reaching lifeMs is dead');
  assert.strictEqual(S.particleAlive({ ageMs: 0, lifeMs: 0 }), false, 'an unspawned slot (lifeMs 0) is never alive');
  assert.strictEqual(S.particleAlive(null), false);
  assert.strictEqual(S.particleAlive(undefined), false);
});

test('particleAlpha starts at 1 and fades linearly to 0 over the lifetime', () => {
  assert.strictEqual(S.particleAlpha({ ageMs: 0, lifeMs: 100 }), 1);
  assert.strictEqual(S.particleAlpha({ ageMs: 50, lifeMs: 100 }), 0.5);
  assert.strictEqual(S.particleAlpha({ ageMs: 100, lifeMs: 100 }), 0, 'dead particle has no opacity');
  assert.strictEqual(S.particleAlpha(null), 0);
});

test('particleAlpha is monotonically non-increasing across a particle lifetime', () => {
  const lifeMs = 200;
  let prev = S.particleAlpha({ ageMs: 0, lifeMs });
  for (let age = 1; age < lifeMs; age++) {
    const cur = S.particleAlpha({ ageMs: age, lifeMs });
    assert.ok(cur <= prev, `alpha at age ${age} should be <= alpha at age ${age - 1}`);
    prev = cur;
  }
});

// ---- rising audio tempo with intensity -------------------------------------
// audioIntensity/tickIntervalMs decide how urgent the ambient tick sounds as
// waves climb and windowMs shrinks (spec: "rising audio tempo with
// intensity"). survivor.js just calls these from the existing loop.

test('audioIntensity is 0 at wave 1 (the calmest wave) and rises toward 1', () => {
  assert.strictEqual(S.audioIntensity(1), 0);
  assert.ok(S.audioIntensity(50) > S.audioIntensity(1));
});

test('audioIntensity stays within [0, 1] across a wide range of waves', () => {
  for (const wave of [0, 1, 2, 5, 10, 50, 200, 10000, -5, 4.5]) {
    const i = S.audioIntensity(wave);
    assert.ok(Number.isFinite(i), `audioIntensity(${wave}) must be finite`);
    assert.ok(i >= 0 && i <= 1, `audioIntensity(${wave})=${i} must be within [0, 1]`);
  }
});

test('audioIntensity is monotonically non-decreasing as wave rises, mirroring windowMs', () => {
  let prev = S.audioIntensity(1);
  for (let wave = 2; wave <= 100; wave++) {
    const cur = S.audioIntensity(wave);
    assert.ok(cur >= prev, `audioIntensity(${wave})=${cur} should be >= audioIntensity(${wave - 1})=${prev}`);
    prev = cur;
  }
});

test('audioIntensity reaches exactly 1 once windowMs bottoms out at the floor', () => {
  assert.strictEqual(S.audioIntensity(1000), 1);
});

test('tickIntervalMs interpolates from the slow tempo at intensity 0 to the fast tempo at intensity 1', () => {
  assert.strictEqual(S.tickIntervalMs(0), S.TICK_INTERVAL_SLOW_MS);
  assert.strictEqual(S.tickIntervalMs(1), S.TICK_INTERVAL_FAST_MS);
  assert.ok(S.TICK_INTERVAL_FAST_MS < S.TICK_INTERVAL_SLOW_MS, 'higher intensity must mean a faster (shorter) tick interval');
});

test('tickIntervalMs is monotonically non-increasing as intensity rises', () => {
  let prev = S.tickIntervalMs(0);
  for (let step = 1; step <= 20; step++) {
    const cur = S.tickIntervalMs(step / 20);
    assert.ok(cur <= prev, `tickIntervalMs should not rise as intensity increases`);
    prev = cur;
  }
});

test('tickIntervalMs clamps out-of-range or non-finite intensity into [0, 1]', () => {
  assert.strictEqual(S.tickIntervalMs(-5), S.TICK_INTERVAL_SLOW_MS);
  assert.strictEqual(S.tickIntervalMs(5), S.TICK_INTERVAL_FAST_MS);
  assert.strictEqual(S.tickIntervalMs(NaN), S.TICK_INTERVAL_SLOW_MS);
  assert.strictEqual(S.tickIntervalMs(undefined), S.TICK_INTERVAL_SLOW_MS);
});

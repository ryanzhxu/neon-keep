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

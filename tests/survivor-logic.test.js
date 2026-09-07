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

// tests/store.test.js
const test = require('node:test');
const assert = require('node:assert');
// jsdom-free: shim a minimal localStorage before requiring the module
const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
const store = require('../shared/store.js');

test('get returns fallback when key missing', () => {
  assert.strictEqual(store.get('nope', 42), 42);
});
test('set then get round-trips a value', () => {
  store.set('k', { a: 1 });
  assert.deepStrictEqual(store.get('k', null), { a: 1 });
});
test('get returns fallback on corrupt JSON', () => {
  mem['bad'] = '{not json';
  assert.strictEqual(store.get('bad', 'safe'), 'safe');
});
test('mute defaults to false and toggles via setMuted', () => {
  assert.strictEqual(store.isMuted(), false);
  store.setMuted(true);
  assert.strictEqual(store.isMuted(), true);
});

// --- Values that JSON round-trips lossily --------------------------------
// store.get/set is a thin JSON.stringify/parse wrapper. JSON cannot represent
// every JS value, so some values silently change shape (or disappear) across
// a round trip. These tests pin down that behavior so a regression is caught.

test('set(undefined) succeeds, but the value does not survive the round trip', () => {
  assert.strictEqual(store.set('undef', undefined), true, 'set should not throw or fail on undefined');
  // JSON.stringify(undefined) is the JS value `undefined`, not the string
  // "undefined" JSON text, so the stored text is not valid JSON and get()
  // falls back rather than returning undefined.
  assert.strictEqual(store.get('undef', 'fallback'), 'fallback');
});

test('set(NaN) round-trips to null, not NaN', () => {
  assert.strictEqual(store.set('nan', NaN), true);
  assert.strictEqual(store.get('nan', 'fallback'), null);
});

test('set(Infinity) round-trips to null, not Infinity', () => {
  assert.strictEqual(store.set('inf', Infinity), true);
  assert.strictEqual(store.get('inf', 'fallback'), null);
  assert.strictEqual(store.set('neginf', -Infinity), true);
  assert.strictEqual(store.get('neginf', 'fallback'), null);
});

test('a nested object round-trips plain data faithfully but drops/reshapes special members', () => {
  const original = {
    keep: { deep: [1, 2, { three: 3 }] },
    skip: undefined,
    fn: function unused() {},
    when: new Date('2020-01-01T00:00:00.000Z'),
  };
  assert.strictEqual(store.set('nested', original), true);
  const result = store.get('nested', null);

  assert.deepStrictEqual(result.keep, original.keep, 'plain nested data must survive intact');
  assert.strictEqual('skip' in result, false, 'an undefined-valued property is dropped by JSON');
  assert.strictEqual('fn' in result, false, 'a function-valued property is dropped by JSON');
  assert.strictEqual(typeof result.when, 'string', 'a Date comes back as a string, not a Date instance');
  assert.strictEqual(result.when, original.when.toISOString());
});

test('set returns false, not throws, when the value cannot be JSON-serialized (circular)', () => {
  const circular = { name: 'oops' };
  circular.self = circular;
  let result;
  assert.doesNotThrow(() => { result = store.set('circular', circular); });
  assert.strictEqual(result, false);
});

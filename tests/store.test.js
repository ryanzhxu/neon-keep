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

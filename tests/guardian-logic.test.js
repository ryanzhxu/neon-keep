// tests/guardian-logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../games/guardian/guardian-logic.js');

test('containsLetter is case-insensitive and correct', () => {
  assert.strictEqual(L.containsLetter('banana', 'A'), true);
  assert.strictEqual(L.containsLetter('banana', 'z'), false);
});

test('containsLetter handles a letter that appears more than once', () => {
  assert.strictEqual(L.containsLetter('banana', 'n'), true);
  assert.strictEqual(L.containsLetter('banana', 'a'), true);
});

test('length returns the word length', () => {
  assert.strictEqual(L.length('banana'), 6);
});

test('length works on a short 4-letter word', () => {
  assert.strictEqual(L.length('kiwi'), 4);
});

// Ruling: rhymeHint(word) = '.'.repeat(word.length - 3) + word.slice(-3).
// A six-letter word masks all but its trailing three letters.
test('rhymeHint masks all but the trailing three letters', () => {
  assert.strictEqual(L.rhymeHint('banana'), '...ana');
});

test('rhymeHint produces a short dot mask for a 4-letter word', () => {
  assert.strictEqual(L.rhymeHint('kiwi'), '.iwi');
});

test('checkGuess is case- and space-insensitive', () => {
  assert.strictEqual(L.checkGuess('  Banana ', 'banana'), true);
  assert.strictEqual(L.checkGuess('apple', 'banana'), false);
});

test('checkGuess rejects an empty or whitespace-only guess', () => {
  assert.strictEqual(L.checkGuess('', 'banana'), false);
  assert.strictEqual(L.checkGuess('   ', 'banana'), false);
});

test('checkGuess does not strip punctuation', () => {
  assert.strictEqual(L.checkGuess('banana!', 'banana'), false);
});

// Regression: rhymeHint must not throw for words shorter than 3 characters.
// '.'.repeat(word.length - 3) goes negative below 3 letters unless guarded.
// For a word too short to mask, return it whole and unmasked.
test('rhymeHint on a 3-letter word returns the whole word unmasked', () => {
  assert.strictEqual(L.rhymeHint('abc'), 'abc');
});

test('rhymeHint on a 2-letter word returns the whole word, not a crash', () => {
  assert.strictEqual(L.rhymeHint('ab'), 'ab');
});

test('rhymeHint on a 1-letter word returns the whole word, not a crash', () => {
  assert.strictEqual(L.rhymeHint('a'), 'a');
});

test('rhymeHint on an empty string returns an empty string, not a crash', () => {
  assert.strictEqual(L.rhymeHint(''), '');
});

// Sibling check: confirm containsLetter, length, checkGuess do not share
// rhymeHint's crash class on empty/null/undefined input.
test('containsLetter does not throw on empty, null, or undefined word', () => {
  assert.strictEqual(L.containsLetter('', 'a'), false);
  assert.doesNotThrow(() => L.containsLetter(null, 'a'));
  assert.doesNotThrow(() => L.containsLetter(undefined, 'a'));
});

test('length does not throw on empty, null, or undefined input', () => {
  assert.strictEqual(L.length(''), 0);
  assert.doesNotThrow(() => L.length(null));
  assert.doesNotThrow(() => L.length(undefined));
});

test('checkGuess does not throw on null or undefined input', () => {
  assert.doesNotThrow(() => L.checkGuess(null, 'banana'));
  assert.doesNotThrow(() => L.checkGuess(undefined, 'banana'));
});

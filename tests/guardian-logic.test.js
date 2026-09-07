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

// --- Hostile input: checkGuess -------------------------------------------

test('checkGuess treats internal whitespace as significant, not collapsed', () => {
  assert.strictEqual(L.checkGuess('ban ana', 'banana'), false);
  assert.strictEqual(L.checkGuess('banana', 'ban ana'), false);
});

test('checkGuess trims leading/trailing tabs and newlines like plain spaces', () => {
  assert.strictEqual(L.checkGuess('\tbanana\n', 'banana'), true);
});

test('checkGuess rejects internal tabs or newlines even though it trims the ends', () => {
  assert.strictEqual(L.checkGuess('ba\nnana', 'banana'), false);
  assert.strictEqual(L.checkGuess('ba\tnana', 'banana'), false);
});

test('checkGuess is case-insensitive for mixed case', () => {
  assert.strictEqual(L.checkGuess('BaNaNa', 'banana'), true);
});

test('checkGuess does not fold unicode accents ("banana" is not "bànana")', () => {
  assert.strictEqual(L.checkGuess('bànana', 'banana'), false);
});

test('checkGuess rejects a guess that is a strict substring of the word', () => {
  assert.strictEqual(L.checkGuess('banan', 'banana'), false);
});

test('checkGuess rejects a guess for which the word is only a substring (superstring guess)', () => {
  assert.strictEqual(L.checkGuess('bananas', 'banana'), false);
});

test('checkGuess coerces null, undefined, and numeric input to strings instead of throwing', () => {
  assert.strictEqual(L.checkGuess(null, 'banana'), false);
  assert.strictEqual(L.checkGuess(undefined, 'banana'), false);
  assert.strictEqual(L.checkGuess(123, 'banana'), false);
  // Gotcha: String(null) and String(undefined) are the literal words "null"
  // and "undefined", so guessing those strings against a null/undefined
  // secret "word" matches. Documents the coercion, does not endorse it.
  assert.strictEqual(L.checkGuess('null', null), true);
  assert.strictEqual(L.checkGuess('undefined', undefined), true);
});

// --- Hostile input: containsLetter ---------------------------------------

test('containsLetter accepts a multi-character substring, not just a single letter', () => {
  assert.strictEqual(L.containsLetter('banana', 'an'), true);
  assert.strictEqual(L.containsLetter('banana', 'xyz'), false);
});

test('containsLetter: an empty search string is trivially contained in any word', () => {
  assert.strictEqual(L.containsLetter('banana', ''), true);
});

test('containsLetter returns false for a non-letter character absent from the word', () => {
  assert.strictEqual(L.containsLetter('banana', '5'), false);
  assert.strictEqual(L.containsLetter('banana', '$'), false);
});

// This is the one that matters: a naive `new RegExp(letter).test(word)`
// implementation would treat '.' or '*' as a wildcard pattern and wrongly
// report every word as containing them. containsLetter must treat the query
// as literal text.
test('containsLetter treats regex metacharacters as literal text, not a pattern', () => {
  assert.strictEqual(L.containsLetter('banana', '.'), false);
  assert.strictEqual(L.containsLetter('banana', '*'), false);
  assert.strictEqual(L.containsLetter('banana', '('), false);
  assert.strictEqual(L.containsLetter('ba.ana', '.'), true, 'a literal dot in the word must still match a literal dot query');
});

// --- Property test: rhymeHint mask + tail always sums to the word length --

test('rhymeHint: masked prefix length plus visible tail length always equals word length, for lengths 0-12', () => {
  const ALPHABET = 'abcdefghijklmnop'; // 16 distinct letters, enough for length 12
  for (let n = 0; n <= 12; n++) {
    const word = ALPHABET.slice(0, n);
    assert.strictEqual(word.length, n, `test setup: expected a ${n}-letter word`);

    const hint = L.rhymeHint(word);
    const dotCount = (hint.match(/\./g) || []).length;
    const tailLength = hint.length - dotCount;

    assert.strictEqual(hint.length, word.length, `hint length must equal word length for len ${n}`);
    assert.strictEqual(dotCount + tailLength, word.length, `mask + tail must sum to word length for len ${n}`);
    assert.strictEqual(dotCount, Math.max(n - 3, 0), `dot count must be max(len-3, 0) for len ${n}`);

    const expectedTailLen = Math.min(n, 3);
    assert.strictEqual(
      hint.slice(hint.length - expectedTailLen),
      word.slice(word.length - expectedTailLen),
      `visible tail must be the word's real trailing characters for len ${n}`,
    );
  }
});

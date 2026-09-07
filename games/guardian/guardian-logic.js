(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NK = root.NK || {};
  root.NK.guardianLogic = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  function containsLetter(word, letter) {
    return String(word).toLowerCase().includes(String(letter).toLowerCase());
  }

  function length(word) {
    return String(word).length;
  }

  function rhymeHint(word) {
    const w = String(word);
    return '.'.repeat(Math.max(w.length - 3, 0)) + w.slice(-3);
  }

  function checkGuess(input, word) {
    return String(input).trim().toLowerCase() === String(word).trim().toLowerCase();
  }

  return { containsLetter, length, rhymeHint, checkGuess };
});

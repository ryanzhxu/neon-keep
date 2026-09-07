(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NK = root.NK || {};
  root.NK.survivorLogic = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  // Task C fills these in.
  return {};
});

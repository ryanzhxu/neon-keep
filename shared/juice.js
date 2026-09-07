// Neon Keep — juice stub. Real effect bodies land in Task A.
window.NK = window.NK || {};
window.NK.juice = (function () {
  'use strict';
  function shake(el, intensity, durationMs) { void el; void intensity; void durationMs; }
  function flash(color, durationMs) { void color; void durationMs; }
  function hitStop(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function typewriter(el, text, speedMs) {
    void speedMs;
    if (el) el.textContent = text;
    return Promise.resolve();
  }
  return { shake, flash, hitStop, typewriter };
})();

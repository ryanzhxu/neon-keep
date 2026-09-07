// Neon Keep — audio stub. Real WebAudio bodies land in Task A.
window.NK = window.NK || {};
window.NK.audio = (function () {
  'use strict';
  function init() {}
  function play(name) { void name; }
  function isMuted() { return window.NK.store ? window.NK.store.isMuted() : false; }
  function setMuted(b) { if (window.NK.store) window.NK.store.setMuted(b === true); }
  function toggleMuted() { setMuted(!isMuted()); }
  return { init, play, isMuted, setMuted, toggleMuted };
})();

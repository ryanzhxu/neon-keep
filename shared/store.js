(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NK = root.NK || {};
  root.NK.store = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  function get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function isMuted() { return get('nk.muted', false) === true; }
  function setMuted(b) { set('nk.muted', b === true); }
  return { get, set, isMuted, setMuted };
});

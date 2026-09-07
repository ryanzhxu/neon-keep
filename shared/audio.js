// Neon Keep — plays pre-generated SFX from assets/audio/*.mp3 through
// HTMLAudioElement. The files were generated once via the ElevenLabs
// sound-effects API and committed as static assets, so nothing here makes a
// network call at runtime — only a local file load, same as an <img> or
// <link>. HTMLAudioElement (not the Fetch API plus AudioContext's
// decodeAudioData) is deliberate: a Fetch request to a file:// URL is
// blocked by Chrome's CORS policy, which would silence every sound for
// anyone using the README's "open index.html directly" method instead of a
// local server.
window.NK = window.NK || {};
window.NK.audio = (function () {
  'use strict';

  // Resolve asset paths relative to this script's own file, not the page
  // that includes it — audio.js is shared by pages at different depths
  // (root index.html vs games/*/index.html).
  var scriptSrc = (window.document && window.document.currentScript) ? window.document.currentScript.src : '';
  var assetBase = scriptSrc.replace(/shared\/audio\.js(?:[?#].*)?$/, '') + 'assets/audio/';

  var SOUND_NAMES = ['click', 'win', 'lose', 'hit', 'dodge', 'levelup', 'tick'];

  var AudioCtor = window.Audio;
  var pool = {};
  if (AudioCtor) {
    SOUND_NAMES.forEach(function (name) {
      var el = new AudioCtor(assetBase + name + '.mp3');
      el.preload = 'auto';
      pool[name] = el;
    });
  }

  var unlocked = false;

  function isMuted() {
    return window.NK.store ? window.NK.store.isMuted() : false;
  }

  function setMuted(b) {
    if (window.NK.store) window.NK.store.setMuted(b === true);
  }

  function toggleMuted() {
    setMuted(!isMuted());
  }

  // init() unlocks HTMLAudioElement playback on browsers (notably iOS
  // Safari) that only allow .play() during a genuine user gesture the first
  // time; a muted play()+pause() on each sound during that gesture is enough
  // to let every later programmatic play() (including from a game-loop
  // timer, not a click) succeed.
  function init() {
    if (unlocked) return;
    unlocked = true;
    SOUND_NAMES.forEach(function (name) {
      var el = pool[name];
      if (!el) return;
      var p = el.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
      el.pause();
      el.currentTime = 0;
    });
  }

  // renderMuteButton(el) — sets a mute-toggle button's label and aria-pressed
  // from the current persisted mute state. Shared by bindMuteButton below and
  // by the click handler it attaches, so the label/emoji/aria logic lives in
  // exactly one place instead of once per page.
  function renderMuteButton(el) {
    var muted = isMuted();
    el.textContent = muted ? '🔇 Sound' : '🔊 Sound';
    el.setAttribute('aria-pressed', String(muted));
  }

  // bindMuteButton(el) — wires up a mute-toggle button: renders its label and
  // aria-pressed from the persisted state immediately, then on click calls
  // init(), flips the mute state via setMuted(), and re-renders. Tolerates a
  // null/missing element (a page with no such button keeps working).
  function bindMuteButton(el) {
    if (!el) return;
    renderMuteButton(el);
    el.addEventListener('click', function () {
      init();
      setMuted(!isMuted());
      renderMuteButton(el);
    });
  }

  // play(name, intensity) — intensity (0..1) is only used by 'tick', to keep
  // Reflex Survivor's "rising audio tempo with intensity" juice: it raises
  // tick's playback rate (with pitch preservation disabled, so it actually
  // raises pitch, not just speed) and volume as
  // NK.survivorLogic.audioIntensity rises. Every other sound ignores it.
  function play(name, intensity) {
    if (isMuted()) return;
    var template = pool[name];
    if (!template) return;
    var node = template.cloneNode();
    if (name === 'tick') {
      var i = typeof intensity === 'number' && Number.isFinite(intensity)
        ? Math.max(0, Math.min(1, intensity))
        : 0;
      node.preservesPitch = false;
      node.mozPreservesPitch = false;
      node.webkitPreservesPitch = false;
      node.playbackRate = 1 + i * 0.6;
      node.volume = 0.5 + i * 0.5;
    }
    var p = node.play();
    if (p && typeof p.catch === 'function') p.catch(function () {});
  }

  return { init, play, isMuted, setMuted, toggleMuted, bindMuteButton };
})();

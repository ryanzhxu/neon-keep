// Neon Keep — Reflex Survivor canvas loop.
// Plain browser script. Assumes shared/store.js, shared/audio.js,
// shared/juice.js and survivor-logic.js have already loaded (see index.html
// script order) so window.NK.store / .audio / .juice / .survivorLogic exist.
(function () {
  'use strict';

  var logic = window.NK.survivorLogic;
  var store = window.NK.store;
  var audio = window.NK.audio;
  var juice = window.NK.juice;

  var HIGH_WAVE_KEY = 'survivor.highWave';
  var SWIPE_THRESHOLD = 24; // px
  var HIT_STOP_MS = 200;

  var canvas = document.getElementById('survivor-canvas');
  var ctx = canvas.getContext('2d');
  var hpEl = document.getElementById('survivor-hp');
  var waveEl = document.getElementById('survivor-wave');
  var bestEl = document.getElementById('survivor-best');
  var overlay = document.getElementById('survivor-overlay');
  var overlayText = document.getElementById('survivor-overlay-text');
  var shareEl = document.getElementById('survivor-share');
  var startBtn = document.getElementById('survivor-start-btn');
  var muteBtn = document.getElementById('nk-mute-toggle');

  // ---- state ----------------------------------------------------------
  var state = 'idle'; // 'idle' | 'playing' | 'dead'
  var wave = 0;
  var combo = 0;
  var attackDir = null;
  var roundStart = 0;   // now() timestamp the current round began
  var roundWindow = 0;  // ms budget for the current round
  var resolved = false; // whether the current round has already been judged
  var rafId = null;
  var paused = false;
  var pausedElapsed = 0; // ms already spent in the round when paused

  var best = store ? store.get(HIGH_WAVE_KEY, 0) : 0;
  bestEl.textContent = best;

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function renderMuteLabel() {
    var muted = store && typeof store.isMuted === 'function' ? store.isMuted() : false;
    if (muteBtn) {
      muteBtn.textContent = muted ? '🔇 Sound' : '🔊 Sound';
      muteBtn.setAttribute('aria-pressed', String(muted));
    }
  }

  // ---- run lifecycle ----------------------------------------------------
  function startRun() {
    if (audio && audio.init) audio.init();
    state = 'playing';
    wave = 1;
    combo = 0;
    paused = false;
    waveEl.textContent = wave;
    overlay.hidden = true;
    startNewRound();
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function startNewRound() {
    var dirs = logic.DIRS;
    attackDir = dirs[Math.floor(Math.random() * dirs.length)];
    roundWindow = logic.windowMs(wave);
    roundStart = now();
    resolved = false;
  }

  function loop() {
    rafId = null;
    if (state !== 'playing') return;
    draw();
    var elapsed = now() - roundStart;
    if (!resolved && elapsed >= roundWindow) {
      resolveRound(null); // timeout
    }
    if (state === 'playing') {
      rafId = requestAnimationFrame(loop);
    }
  }

  function resolveRound(inputDir) {
    if (resolved || state !== 'playing') return;
    resolved = true;
    var safe = logic.safeDir(attackDir);
    if (inputDir !== null && inputDir === safe) {
      if (audio) audio.play('dodge');
      combo++;
      wave++;
      waveEl.textContent = wave;
      if (juice) juice.flash('#00f0ff', 120);
      startNewRound();
    } else {
      handleHit();
    }
  }

  function handleHit() {
    state = 'dead'; // stop the loop before any async work
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (audio) audio.play('hit');
    if (juice && juice.shake) juice.shake(canvas, 8, 300);
    var stop = (juice && juice.hitStop) ? juice.hitStop(HIT_STOP_MS) : Promise.resolve();
    stop.then(onDeath);
  }

  function onDeath() {
    var finalWave = wave;
    if (finalWave > best) {
      best = finalWave;
      if (store) store.set(HIGH_WAVE_KEY, best);
      bestEl.textContent = best;
    }
    overlayText.hidden = true;
    shareEl.textContent = 'I survived wave ' + finalWave;
    shareEl.hidden = false;
    startBtn.textContent = 'Restart';
    overlay.hidden = false;
    if (audio) audio.play('lose');
  }

  // ---- drawing ------------------------------------------------------------
  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var size = Math.max(1, Math.round(rect.width * dpr));
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    draw();
  }

  function draw() {
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#141424';
    ctx.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.05, 0, Math.PI * 2);
    ctx.fill();

    if (state === 'playing' && attackDir) {
      var size = Math.min(w, h) * 0.12;
      var pad = Math.min(w, h) * 0.08;
      ctx.fillStyle = '#ff3b3b';
      if (attackDir === 'left') ctx.fillRect(pad, cy - size / 2, size, size);
      else if (attackDir === 'right') ctx.fillRect(w - pad - size, cy - size / 2, size, size);
      else if (attackDir === 'up') ctx.fillRect(cx - size / 2, pad, size, size);
      else if (attackDir === 'down') ctx.fillRect(cx - size / 2, h - pad - size, size, size);

      var elapsed = now() - roundStart;
      var remaining = Math.max(0, roundWindow - elapsed);
      var pct = roundWindow > 0 ? remaining / roundWindow : 0;
      ctx.fillStyle = '#ff2fd0';
      ctx.fillRect(0, h - Math.max(4, h * 0.02), w * pct, Math.max(4, h * 0.02));
    }
  }

  // ---- input --------------------------------------------------------------
  var KEY_TO_DIR = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
  };

  function onKeyDown(e) {
    var dir = KEY_TO_DIR[e.key];
    if (!dir || state !== 'playing') return;
    e.preventDefault();
    resolveRound(dir);
  }

  var touchStartX = 0, touchStartY = 0, touchActive = false;

  function onTouchStart(e) {
    if (state !== 'playing') return;
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchActive = true;
  }

  function onTouchEnd(e) {
    if (!touchActive || state !== 'playing') return;
    touchActive = false;
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var dx = t.clientX - touchStartX;
    var dy = t.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    resolveRound(dir);
  }

  // ---- pause on tab hide ----------------------------------------------
  function onVisibilityChange() {
    if (document.hidden) {
      pauseLoop();
    } else {
      resumeLoop();
    }
  }

  function pauseLoop() {
    if (state !== 'playing' || paused) return;
    paused = true;
    pausedElapsed = now() - roundStart;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resumeLoop() {
    if (state !== 'playing' || !paused) return;
    paused = false;
    roundStart = now() - pausedElapsed;
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  // ---- wire up --------------------------------------------------------
  startBtn.addEventListener('click', startRun);
  document.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', resizeCanvas);

  if (muteBtn) {
    muteBtn.addEventListener('click', function () {
      if (audio && typeof audio.init === 'function') audio.init();
      var next = !(store && typeof store.isMuted === 'function' ? store.isMuted() : false);
      if (audio && typeof audio.setMuted === 'function') audio.setMuted(next);
      renderMuteLabel();
    });
  }

  renderMuteLabel();
  resizeCanvas();
})();

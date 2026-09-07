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
  var DEATH_SLOWMO_MS = 450;
  var DOUBLE_ATTACK_CHANCE = 0.35; // once double-attacks are unlocked
  var FAKE_OUT_CHANCE = 0.3;       // once fake-outs are unlocked

  // ---- particle burst (juice) ------------------------------------------
  // A small fixed-size pool, reused in place every frame: no per-frame
  // allocation, no unbounded growth. logic.updateParticle/particleAlive/
  // particleAlpha (pure, unit-tested) own the per-particle math; this file
  // only owns spawning (random) and canvas rendering (needs ctx).
  var PARTICLE_POOL_SIZE = 40;
  var PARTICLE_LIFE_MS = 380;
  var PARTICLE_SPEED_MIN = 0.15; // canvas px per ms
  var PARTICLE_SPEED_MAX = 0.42;
  var BURST_COUNT_DODGE = 10;
  var BURST_COUNT_DEATH = 26; // heavier burst on the killing hit
  var PARTICLE_COLOR_DODGE = '#00f0ff';
  var PARTICLE_COLOR_PARRY = '#ffe700';
  var PARTICLE_COLOR_DEATH = '#ff3b3b';
  // The killing-hit burst is rendered once, frozen for the hit-stop/slow-mo
  // beat (the main loop stops before another frame would draw). Pre-advance
  // it by this many virtual ms so that single frozen frame already shows the
  // particles mid-scatter instead of a single point.
  var DEATH_BURST_PRESPAWN_MS = 90;

  var particles = [];
  for (var pPoolIdx = 0; pPoolIdx < PARTICLE_POOL_SIZE; pPoolIdx++) {
    particles.push({ x: 0, y: 0, vx: 0, vy: 0, ageMs: 0, lifeMs: 0, color: PARTICLE_COLOR_DODGE, size: 2 });
  }
  var lastParticleFrameAt = 0; // now() at the last particle update, for per-frame dt

  // spawnBurst(cx, cy, count, color) — (re)activates up to `count` dead pool
  // slots as a radial burst from (cx, cy). Reuses slots only: the pool never
  // grows, so a burst while the pool is saturated just spawns fewer
  // particles instead of allocating more.
  function spawnBurst(cx, cy, count, color) {
    var spawned = 0;
    for (var i = 0; i < particles.length && spawned < count; i++) {
      var p = particles[i];
      if (logic.particleAlive(p)) continue;
      var angle = Math.random() * Math.PI * 2;
      var speed = PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.ageMs = 0;
      p.lifeMs = PARTICLE_LIFE_MS;
      p.color = color;
      p.size = 2 + Math.random() * 2;
      spawned++;
    }
  }

  // updateParticles(dtMs) — advances every live pool slot via the pure
  // logic.updateParticle step. Mutates in place; never allocates.
  function updateParticles(dtMs) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!logic.particleAlive(p)) continue;
      logic.updateParticle(p, dtMs);
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!logic.particleAlive(p)) continue;
      var alpha = logic.particleAlpha(p);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- rising audio tempo with intensity --------------------------------
  // An ambient tick plays on an interval that shortens as logic.audioIntensity
  // rises with wave/window decay (spec: "rising audio tempo with intensity").
  // Ticks only advance from inside loop(), which already only runs while
  // state === 'playing' and is paused/cancelled exactly like everything
  // else driven by rafId, so this needs no pause handling of its own beyond
  // the elapsed-time bookkeeping mirrored from the round timer below.
  var lastTickAt = 0;      // now() timestamp of the last ambient tick
  var pausedTickElapsed = 0; // ms already elapsed toward the next tick when paused

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
  var attackDirs = [];    // 1 direction normally, 2 on a double-attack round
  var isFakeOut = false;  // true when the telegraphed direction is a feint
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
    // A run always starts from a click on startBtn (or restart), and the
    // mute toggle can also hold focus. Either one holding focus would let a
    // later Space press activate the button instead of parrying, so drop
    // focus from both before play begins.
    if (startBtn && startBtn.blur) startBtn.blur();
    if (muteBtn && muteBtn.blur) muteBtn.blur();
    canvas.classList.remove('survivor-slowmo');
    state = 'playing';
    wave = 1;
    combo = 0;
    paused = false;
    waveEl.textContent = wave;
    overlay.hidden = true;
    lastTickAt = now();
    pausedTickElapsed = 0;
    startNewRound();
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function startNewRound() {
    var dirs = logic.DIRS;
    var primary = dirs[Math.floor(Math.random() * dirs.length)];
    var roll = Math.random();

    if (logic.hasDoubleAttack(wave) && roll < DOUBLE_ATTACK_CHANCE) {
      var second = primary;
      while (second === primary) second = dirs[Math.floor(Math.random() * dirs.length)];
      attackDirs = [primary, second];
      isFakeOut = false;
    } else if (logic.hasFakeOut(wave) && roll < DOUBLE_ATTACK_CHANCE + FAKE_OUT_CHANCE) {
      attackDirs = [primary];
      isFakeOut = true;
    } else {
      attackDirs = [primary];
      isFakeOut = false;
    }

    roundWindow = logic.windowMs(wave);
    roundStart = now();
    resolved = false;
  }

  function loop() {
    rafId = null;
    if (state !== 'playing') return;
    draw();
    tickAmbientTempo();
    var elapsed = now() - roundStart;
    if (!resolved && elapsed >= roundWindow) {
      resolveRound(null); // timeout
    }
    if (state === 'playing') {
      rafId = requestAnimationFrame(loop);
    }
  }

  // tickAmbientTempo() — plays the ambient tempo tick (rising audio tempo
  // with intensity) at an interval that shortens as logic.audioIntensity
  // rises with the wave/window ramp. Only called from loop(), so it only
  // ever runs while state === 'playing' and is naturally paused/resumed
  // alongside everything else driven by rafId.
  function tickAmbientTempo() {
    var interval = logic.tickIntervalMs(logic.audioIntensity(wave));
    var t = now();
    if (t - lastTickAt < interval) return;
    lastTickAt = t;
    if (audio) audio.play('tick', logic.audioIntensity(wave));
  }

  // resolveRound(inputDir, isParry) — judges a dodge (isParry falsy, the
  // original path, unchanged) or a parry (isParry true — attemptParry always
  // passes an input direction already known to be safe, so only the combo
  // reward differs).
  function resolveRound(inputDir, isParry) {
    if (resolved || state !== 'playing') return;
    resolved = true;
    var success = logic.isSafeDodge(attackDirs, isFakeOut, inputDir);
    if (success) {
      if (audio) audio.play('dodge');
      combo += logic.comboGain(isParry ? 'parry' : 'dodge');
      wave++;
      waveEl.textContent = wave;
      if (juice) juice.flash(isParry ? '#ffe700' : '#00f0ff', 120);
      spawnBurst(canvas.width / 2, canvas.height / 2, BURST_COUNT_DODGE,
        isParry ? PARTICLE_COLOR_PARRY : PARTICLE_COLOR_DODGE);
      startNewRound();
    } else {
      handleHit();
    }
  }

  // attemptParry() — the Space/tap path. Timing decides success, not
  // direction: on a good parry any attack direction is accepted, so this
  // feeds resolveRound a direction already known to be safe for the current
  // round. An early or late press resolves exactly like a wrong dodge.
  function attemptParry() {
    if (resolved || state !== 'playing') return;
    var elapsed = now() - roundStart;
    var result = logic.parryResult(elapsed, roundWindow);
    if (result === 'success') {
      var safe = logic.roundSafeDirs(attackDirs, isFakeOut)[0];
      resolveRound(safe, true);
    } else {
      resolveRound(null);
    }
  }

  function handleHit() {
    state = 'dead'; // stop the loop before any async work
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (audio) audio.play('hit');
    // The loop stops right here, so this burst gets exactly one frame to
    // render before the canvas freezes for the hit-stop/slow-mo beat.
    // Pre-advance it a bit so that frozen frame already reads as an
    // explosion in progress instead of a single point at the hero.
    spawnBurst(canvas.width / 2, canvas.height / 2, BURST_COUNT_DEATH, PARTICLE_COLOR_DEATH);
    updateParticles(DEATH_BURST_PRESPAWN_MS);
    draw();
    if (juice && juice.shake) juice.shake(canvas, 8, 300);
    var stop = (juice && juice.hitStop) ? juice.hitStop(HIT_STOP_MS) : Promise.resolve();
    stop.then(playDeathSlowMo).then(onDeath);
  }

  // playDeathSlowMo() — a brief, self-terminating visual beat between the
  // hit-stop freeze and the death screen. Pure CSS transition on the frozen
  // canvas, so it needs no animation frame of its own and cannot leak one.
  function playDeathSlowMo() {
    canvas.classList.add('survivor-slowmo');
    return new Promise(function (resolve) {
      setTimeout(resolve, DEATH_SLOWMO_MS);
    });
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
    var t = now();
    var particleDt = lastParticleFrameAt ? (t - lastParticleFrameAt) : 0;
    lastParticleFrameAt = t;
    updateParticles(particleDt);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#141424';
    ctx.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.05, 0, Math.PI * 2);
    ctx.fill();

    if (state === 'playing' && attackDirs.length) {
      var size = Math.min(w, h) * 0.12;
      var pad = Math.min(w, h) * 0.08;
      ctx.fillStyle = isFakeOut ? '#ffb020' : '#ff3b3b';
      for (var i = 0; i < attackDirs.length; i++) {
        var d = attackDirs[i];
        if (d === 'left') ctx.fillRect(pad, cy - size / 2, size, size);
        else if (d === 'right') ctx.fillRect(w - pad - size, cy - size / 2, size, size);
        else if (d === 'up') ctx.fillRect(cx - size / 2, pad, size, size);
        else if (d === 'down') ctx.fillRect(cx - size / 2, h - pad - size, size, size);
      }

      var elapsed = now() - roundStart;
      var remaining = Math.max(0, roundWindow - elapsed);
      var pct = roundWindow > 0 ? remaining / roundWindow : 0;
      var tailStart = roundWindow * (1 - logic.PARRY_TAIL_FRACTION);
      var inParryTail = elapsed >= tailStart && elapsed < roundWindow;
      ctx.fillStyle = inParryTail ? '#ffe700' : '#ff2fd0';
      ctx.fillRect(0, h - Math.max(4, h * 0.02), w * pct, Math.max(4, h * 0.02));
    }

    drawParticles();
  }

  // ---- input --------------------------------------------------------------
  var KEY_TO_DIR = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
  };

  function onKeyDown(e) {
    if (state !== 'playing') return;
    if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
      // Both game pages have a #nk-mute-toggle button, and Space activates
      // whichever button currently holds focus instead of reaching this
      // handler's default action. startRun() already blurs it, but as a
      // second guard: if focus somehow still sits on any button, let the
      // browser's native Space-activates-button behavior happen instead of
      // stealing the key for a parry.
      var active = document.activeElement;
      if (active && active.tagName === 'BUTTON') return;
      e.preventDefault();
      attemptParry();
      return;
    }
    var dir = KEY_TO_DIR[e.key];
    if (!dir) return;
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
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      attemptParry();
      return;
    }
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
    pausedTickElapsed = now() - lastTickAt;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resumeLoop() {
    if (state !== 'playing' || !paused) return;
    paused = false;
    roundStart = now() - pausedElapsed;
    lastTickAt = now() - pausedTickElapsed;
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

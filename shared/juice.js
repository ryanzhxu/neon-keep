// Neon Keep — DOM/util juice effects. Plain browser script, no dependencies.
window.NK = window.NK || {};
window.NK.juice = (function () {
  'use strict';

  let styleInjected = false;
  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.textContent = [
      '@keyframes nk-juice-shake-kf {',
      '  10%, 90% { transform: translate3d(calc(-1 * var(--nk-shake-intensity, 8px)), 0, 0); }',
      '  20%, 80% { transform: translate3d(var(--nk-shake-intensity, 8px), 0, 0); }',
      '  30%, 50%, 70% { transform: translate3d(calc(-1 * var(--nk-shake-intensity, 8px)), 0, 0); }',
      '  40%, 60% { transform: translate3d(var(--nk-shake-intensity, 8px), 0, 0); }',
      '}',
      '.nk-juice-shake { animation: nk-juice-shake-kf var(--nk-shake-duration, 300ms) ease-in-out; }',
      '.nk-juice-flash {',
      '  position: fixed; inset: 0; pointer-events: none; z-index: 99999;',
      '  opacity: 1; transition-property: opacity; transition-timing-function: ease-out;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function shake(el, intensity, durationMs) {
    if (!el) return;
    const i = typeof intensity === 'number' ? intensity : 8;
    const d = typeof durationMs === 'number' ? durationMs : 300;
    ensureStyle();
    el.style.setProperty('--nk-shake-intensity', i + 'px');
    el.style.setProperty('--nk-shake-duration', d + 'ms');
    el.classList.remove('nk-juice-shake');
    void el.offsetWidth; // restart animation if already running
    el.classList.add('nk-juice-shake');
    setTimeout(function () {
      el.classList.remove('nk-juice-shake');
    }, d);
  }

  function flash(color, durationMs) {
    const c = color || '#ffffff';
    const d = typeof durationMs === 'number' ? durationMs : 120;
    ensureStyle();
    const overlay = document.createElement('div');
    overlay.className = 'nk-juice-flash';
    overlay.style.background = c;
    overlay.style.transitionDuration = d + 'ms';
    document.body.appendChild(overlay);
    void overlay.offsetWidth; // force reflow so the opacity transition runs
    overlay.style.opacity = '0';
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, d + 20);
  }

  function hitStop(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function typewriter(el, text, speedMs) {
    const speed = typeof speedMs === 'number' ? speedMs : 25;
    if (!el) return Promise.resolve();
    const str = text == null ? '' : String(text);
    const runId = (el._nkTypewriterRunId = (el._nkTypewriterRunId || 0) + 1);
    el.textContent = '';
    return new Promise(function (resolve) {
      let i = 0;
      function step() {
        if (el._nkTypewriterRunId !== runId) { resolve(); return; }
        if (i >= str.length) { resolve(); return; }
        el.textContent += str.charAt(i);
        i++;
        setTimeout(step, speed);
      }
      step();
    });
  }

  return { shake, flash, hitStop, typewriter };
})();

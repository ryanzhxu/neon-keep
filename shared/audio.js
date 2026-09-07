// Neon Keep — WebAudio synth. No asset files, short oscillator blips only.
window.NK = window.NK || {};
window.NK.audio = (function () {
  'use strict';

  let ctx = null;

  function init() {
    if (ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }

  function isMuted() {
    return window.NK.store ? window.NK.store.isMuted() : false;
  }

  function setMuted(b) {
    if (window.NK.store) window.NK.store.setMuted(b === true);
  }

  function toggleMuted() {
    setMuted(!isMuted());
  }

  // Schedules one oscillator "note": a tone from startFreq to endFreq over
  // durationSec, with a short attack/decay gain envelope.
  function tone(startTime, durationSec, startFreq, endFreq, type, peakGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.linearRampToValueAtTime(endFreq, startTime + durationSec);
    }
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.015, durationSec / 4));
    gain.gain.linearRampToValueAtTime(0, startTime + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.02);
  }

  // Short burst of filtered noise, used for the "hit" blip.
  function noiseBurst(startTime, durationSec, peakGain) {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, startTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.linearRampToValueAtTime(0, startTime + durationSec);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
    src.stop(startTime + durationSec + 0.02);
  }

  const SOUNDS = {
    click: (t) => tone(t, 0.06, 440, 440, 'square', 0.15),
    win: (t) => {
      tone(t, 0.1, 523.25, 523.25, 'triangle', 0.2);
      tone(t + 0.1, 0.16, 783.99, 783.99, 'triangle', 0.2);
    },
    lose: (t) => tone(t, 0.35, 300, 120, 'sawtooth', 0.18),
    hit: (t) => noiseBurst(t, 0.12, 0.3),
    dodge: (t) => tone(t, 0.05, 1200, 1500, 'sine', 0.1),
    levelup: (t) => {
      tone(t, 0.08, 392, 392, 'square', 0.15);
      tone(t + 0.08, 0.08, 523.25, 523.25, 'square', 0.15);
      tone(t + 0.16, 0.14, 659.25, 659.25, 'square', 0.15);
    },
  };

  function play(name) {
    if (isMuted()) return;
    if (!ctx) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    if (ctx.state === 'suspended') ctx.resume();
    fn(ctx.currentTime);
  }

  return { init, play, isMuted, setMuted, toggleMuted };
})();

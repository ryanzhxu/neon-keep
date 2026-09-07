// tests/audio-mute-button.test.js
//
// shared/audio.js is a browser script, not requirable, so its source is
// evaluated against a fake `window`, exactly the way tests/integration.test.js
// already does for games/guardian/words.js via
// `new Function('window', src)(fakeWindow)`.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const AUDIO_SRC = fs.readFileSync(path.join(__dirname, '..', 'shared', 'audio.js'), 'utf8');

// Builds a fresh NK.audio for each test, backed by a fake NK.store whose
// mute state is controllable and observable, and a fake AudioContext so
// init() (called from the click handler) can be proven to run without a
// real browser.
function makeSandbox(initialMuted) {
  let muted = initialMuted === true;
  const setMutedCalls = [];
  const store = {
    isMuted: () => muted,
    setMuted: (b) => {
      setMutedCalls.push(b);
      muted = b === true;
    },
  };
  let audioContextInstances = 0;
  function FakeAudioContext() {
    audioContextInstances++;
    this.destination = {};
  }
  const fakeWindow = { NK: { store }, AudioContext: FakeAudioContext };
  new Function('window', AUDIO_SRC)(fakeWindow);
  return {
    audio: fakeWindow.NK.audio,
    store,
    setMutedCalls,
    audioContextInstances: () => audioContextInstances,
  };
}

function makeFakeButton() {
  const listeners = {};
  return {
    textContent: '',
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, handler) { listeners[type] = handler; },
    fireClick() { listeners.click(); },
  };
}

test('bindMuteButton renders the unmuted label and aria-pressed immediately', () => {
  const { audio } = makeSandbox(false);
  const btn = makeFakeButton();
  audio.bindMuteButton(btn);
  assert.strictEqual(btn.textContent, '🔊 Sound'); // 🔊 Sound
  assert.strictEqual(btn.attrs['aria-pressed'], 'false');
});

test('bindMuteButton renders the muted label and aria-pressed immediately', () => {
  const { audio } = makeSandbox(true);
  const btn = makeFakeButton();
  audio.bindMuteButton(btn);
  assert.strictEqual(btn.textContent, '🔇 Sound'); // 🔇 Sound
  assert.strictEqual(btn.attrs['aria-pressed'], 'true');
});

test('clicking the bound button calls init(), flips the mute state via setMuted, and re-renders', () => {
  const { audio, store, setMutedCalls, audioContextInstances } = makeSandbox(false);
  const btn = makeFakeButton();
  audio.bindMuteButton(btn);
  assert.strictEqual(btn.textContent, '🔊 Sound');
  assert.strictEqual(audioContextInstances(), 0, 'init() must not run until interaction');

  btn.fireClick();
  assert.strictEqual(audioContextInstances(), 1, 'click handler must call init()');
  assert.strictEqual(setMutedCalls.length, 1);
  assert.strictEqual(setMutedCalls[0], true, 'setMuted should be called with the flipped (muted) state');
  assert.strictEqual(store.isMuted(), true);
  assert.strictEqual(btn.textContent, '🔇 Sound');
  assert.strictEqual(btn.attrs['aria-pressed'], 'true');

  btn.fireClick();
  assert.strictEqual(setMutedCalls.length, 2);
  assert.strictEqual(setMutedCalls[1], false, 'a second click should flip back to unmuted');
  assert.strictEqual(store.isMuted(), false);
  assert.strictEqual(btn.textContent, '🔊 Sound');
  assert.strictEqual(btn.attrs['aria-pressed'], 'false');
});

test('bindMuteButton(null) and bindMuteButton(undefined) do not throw', () => {
  const { audio } = makeSandbox(false);
  assert.doesNotThrow(() => audio.bindMuteButton(null));
  assert.doesNotThrow(() => audio.bindMuteButton(undefined));
});

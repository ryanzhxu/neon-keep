// Cross-file integration invariants.
//
// Tasks A-D were built in parallel against a written contract, so the seams
// between them are where drift would appear: a relative path that resolves on
// one page but not another, a storage key spelled differently in the game that
// writes it and the hub that reads it, or a call to an NK.* method nothing
// defines. Unit tests cannot see any of that — each one only sees its own file.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const PAGES = ['index.html', 'games/guardian/index.html', 'games/survivor/index.html'];

const SCRIPTS = [
  'shared/store.js',
  'shared/audio.js',
  'shared/juice.js',
  'games/guardian/words.js',
  'games/guardian/guardian-logic.js',
  'games/guardian/guardian.js',
  'games/survivor/survivor-logic.js',
  'games/survivor/survivor.js',
];

// The Shared Interface Contract. Nothing may read or write a key outside this
// set, and every key here is owned by exactly one writer.
const CONTRACT_KEYS = new Set([
  'nk.muted',
  'guardian.levelsCleared',
  'guardian.bestQuestions',
  'survivor.highWave',
]);

// Every method the contract defines on the NK namespace.
const CONTRACT_API = new Set([
  'NK.store.get', 'NK.store.set', 'NK.store.isMuted', 'NK.store.setMuted',
  'NK.audio.init', 'NK.audio.play', 'NK.audio.isMuted', 'NK.audio.setMuted', 'NK.audio.toggleMuted',
  'NK.audio.bindMuteButton',
  'NK.juice.shake', 'NK.juice.flash', 'NK.juice.hitStop', 'NK.juice.typewriter',
]);

test('every local href and src on every page resolves to a real file', () => {
  const broken = [];
  for (const page of PAGES) {
    const dir = path.dirname(path.join(ROOT, page));
    for (const [, ref] of read(page).matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(https?:|#|data:|mailto:)/.test(ref)) continue;
      if (!fs.existsSync(path.resolve(dir, ref))) broken.push(`${page} -> ${ref}`);
    }
  }
  assert.deepStrictEqual(broken, [], `broken references:\n${broken.join('\n')}`);
});

// GitHub Pages serves 404.html for any unmatched path, at any depth, so this
// page alone must use root-absolute references — a relative path would break
// as soon as the missing URL was more than one level deep.
test('the 404 page exists, is themed, and can get back to the hub', () => {
  const p = path.join(ROOT, '404.html');
  assert.ok(fs.existsSync(p), '404.html is missing; unmatched URLs fall back to GitHub default page');
  const html = read('404.html');

  assert.match(html, /<meta charset="utf-8">/i, '404 page misses charset');
  assert.match(html, /name="viewport"/i, '404 page misses viewport');
  assert.match(html, /href="\/shared\/theme\.css"/, '404 page must load the shared theme by absolute path');
  assert.match(html, /class="nk-crt"/, '404 page misses the CRT overlay');
  assert.match(html, /href="\/"/, '404 page must link back to the hub');
  assert.match(html, /&larr; Keep|← Keep/, '404 page misses the "← Keep" label');

  // Its absolute references must still point at files that exist.
  const broken = [];
  for (const [, ref] of html.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
    const target = ref === '/' ? 'index.html' : ref.replace(/^\//, '');
    if (!fs.existsSync(path.join(ROOT, target))) broken.push(ref);
  }
  assert.deepStrictEqual(broken, [], `404.html points at missing files: ${broken.join(', ')}`);
});

test('every page can navigate back to the hub, and the hub reaches both games', () => {
  const hub = read('index.html');
  assert.match(hub, /href="games\/guardian\/index\.html"/, 'hub misses the Guardian tile link');
  assert.match(hub, /href="games\/survivor\/index\.html"/, 'hub misses the Survivor tile link');
  for (const page of PAGES.filter((p) => p !== 'index.html')) {
    assert.match(read(page), /href="\.\.\/\.\.\/index\.html"/, `${page} cannot get back to the hub`);
  }
});

test('no file reads or writes a storage key outside the contract', () => {
  // `guardian.css` and `survivor.js` match the same shape as a storage key, so
  // filenames are excluded by extension rather than by guessing at context.
  const FILE_EXT = /\.(css|js|html|png|svg|json|md)$/;
  const stray = [];
  for (const f of [...PAGES, ...SCRIPTS]) {
    for (const [, key] of read(f).matchAll(/['"]((?:nk|guardian|survivor)\.[A-Za-z]+)['"]/g)) {
      if (FILE_EXT.test(key)) continue;
      if (!CONTRACT_KEYS.has(key)) stray.push(`${f}: ${key}`);
    }
  }
  assert.deepStrictEqual(stray, [], `storage keys outside the contract:\n${stray.join('\n')}`);
});

test('the hub reads the same keys the games write', () => {
  const hub = read('index.html');
  assert.ok(hub.includes('guardian.levelsCleared'), 'hub does not read the Guardian score');
  assert.ok(hub.includes('survivor.highWave'), 'hub does not read the Survivor score');
  assert.ok(read('games/guardian/guardian.js').includes('guardian.levelsCleared'),
    'Guardian never writes the score the hub reads');
  assert.ok(read('games/survivor/survivor.js').includes('survivor.highWave'),
    'Survivor never writes the score the hub reads');
});

test('no file calls an NK method the contract does not define', () => {
  const stray = [];
  for (const f of [...PAGES, ...SCRIPTS]) {
    for (const [, call] of read(f).matchAll(/(NK\.(?:store|audio|juice)\.[A-Za-z]+)/g)) {
      if (!CONTRACT_API.has(call)) stray.push(`${f}: ${call}`);
    }
  }
  assert.deepStrictEqual(stray, [], `calls outside the contract:\n${stray.join('\n')}`);
});

test('the shared modules actually define every method the contract promises', () => {
  const store = require('../shared/store.js');
  for (const m of ['get', 'set', 'isMuted', 'setMuted']) {
    assert.strictEqual(typeof store[m], 'function', `NK.store.${m} is missing`);
  }
  // audio.js and juice.js are browser scripts, not requirable, so assert on source.
  const audio = read('shared/audio.js');
  for (const m of ['init', 'play', 'isMuted', 'setMuted', 'toggleMuted']) {
    assert.match(audio, new RegExp(`function ${m}\\b|${m}:`), `NK.audio.${m} is missing`);
  }
  const juice = read('shared/juice.js');
  for (const m of ['shake', 'flash', 'hitStop', 'typewriter']) {
    assert.match(juice, new RegExp(`function ${m}\\b|${m}:`), `NK.juice.${m} is missing`);
  }
});

test('the shipped site pulls in nothing from the network', () => {
  const offenders = [];
  for (const f of [...PAGES, ...SCRIPTS]) {
    const src = read(f);
    for (const [, url] of src.matchAll(/["'](https?:\/\/[^"']+)["']/g)) offenders.push(`${f}: ${url}`);
    for (const api of ['fetch(', 'XMLHttpRequest', 'importScripts(']) {
      if (src.includes(api)) offenders.push(`${f}: ${api}`);
    }
  }
  assert.deepStrictEqual(offenders, [], `the site must make no network calls:\n${offenders.join('\n')}`);
});

test('every level word is playable by the question menu', () => {
  // words.js is a browser global; evaluate it against a fake window.
  const sandbox = { window: {} };
  new Function('window', read('games/guardian/words.js'))(sandbox.window);
  const levels = sandbox.window.NK_LEVELS;

  assert.ok(Array.isArray(levels) && levels.length >= 3, 'need at least 3 levels');
  assert.ok(levels.length <= 5, 'the plan caps levels at 5');

  const L = require('../games/guardian/guardian-logic.js');
  const seen = new Set();
  for (const lv of levels) {
    assert.match(lv.word, /^[a-z]+$/, `word "${lv.word}" must be lowercase letters only`);
    assert.ok(lv.word.length >= 4 && lv.word.length <= 7, `word "${lv.word}" must be 4-7 letters`);
    assert.ok(typeof lv.theme === 'string' && lv.theme.length > 0, `level "${lv.word}" needs a theme`);
    assert.ok(Number.isInteger(lv.budget) && lv.budget > 0, `level "${lv.word}" needs a positive budget`);
    assert.ok(typeof lv.taunt === 'string' && lv.taunt.length > 0, `level "${lv.word}" needs a taunt`);
    assert.ok(!seen.has(lv.word), `duplicate word "${lv.word}"`);
    seen.add(lv.word);

    // The logic helpers must survive every shipped word, not just the tested ones.
    assert.doesNotThrow(() => L.rhymeHint(lv.word), `rhymeHint throws on "${lv.word}"`);
    assert.strictEqual(L.length(lv.word), lv.word.length);
    assert.strictEqual(L.checkGuess(` ${lv.word.toUpperCase()} `, lv.word), true,
      `checkGuess should accept a padded, uppercased "${lv.word}"`);
  }
});

test('budgets do not rise as levels get harder', () => {
  const sandbox = { window: {} };
  new Function('window', read('games/guardian/words.js'))(sandbox.window);
  const budgets = sandbox.window.NK_LEVELS.map((l) => l.budget);
  for (let i = 1; i < budgets.length; i++) {
    assert.ok(budgets[i] <= budgets[i - 1],
      `level ${i + 1} has a larger budget (${budgets[i]}) than level ${i} (${budgets[i - 1]})`);
  }
});

// Every level must be winnable in principle: a player who never repeats a
// question type still needs to be able to ask each one before running out of
// budget. The question-type count is read from the live page rather than
// hardcoded, since games/guardian/index.html is the source of truth for what
// question buttons exist and may change independently of this test.
test('every level budget is large enough to ask every distinct question type at least once', () => {
  const html = read('games/guardian/index.html');
  const questionButtonIds = [...html.matchAll(/id="(btn-[a-z]+)"/g)]
    .map((m) => m[1])
    .filter((id) => id !== 'btn-retry'); // retry is not a question, it restarts the level
  const questionTypeCount = questionButtonIds.length;
  assert.ok(questionTypeCount > 0, 'could not find any question buttons in games/guardian/index.html');

  const sandbox = { window: {} };
  new Function('window', read('games/guardian/words.js'))(sandbox.window);
  const levels = sandbox.window.NK_LEVELS;
  assert.ok(levels.length > 0, 'need at least one level to check');

  for (const lv of levels) {
    assert.ok(lv.budget >= questionTypeCount,
      `level "${lv.word}" has budget ${lv.budget}, too small to ask all ${questionTypeCount} question types ` +
      `(${questionButtonIds.join(', ')}) at least once`);
  }
});

// The README documents Survivor's tuning in prose. Prose drifts from code
// silently, so the numbers it states are asserted against the constants they
// describe. If the tuning is retuned, this fails until the README catches up.
test('the README describes the tuning the code actually ships', () => {
  const readme = read('README.md');
  const S = require('../games/survivor/survivor-logic.js');

  assert.match(readme, new RegExp(`wave ${S.DOUBLE_ATTACK_WAVE}\\b`),
    `README should say double-attacks start at wave ${S.DOUBLE_ATTACK_WAVE}`);
  assert.match(readme, new RegExp(`wave ${S.FAKE_OUT_WAVE}\\b`),
    `README should say fake-outs start at wave ${S.FAKE_OUT_WAVE}`);

  assert.strictEqual(S.PARRY_TAIL_FRACTION, 1 / 3,
    'README says a parry lands in the last third of the window; update both together');
  assert.match(readme, /last third/i, 'README should describe the parry window');

  assert.ok(S.PARRY_COMBO_GAIN === S.DODGE_COMBO_GAIN * 2,
    'README says a parry pays double combo; update both together');
  assert.match(readme, /double combo/i, 'README should state the parry combo bonus');

  for (const control of ['Arrow keys', 'Swipe', 'Space', 'Tap']) {
    assert.ok(readme.includes(control), `README should document the "${control}" control`);
  }
});

// Every page that can make a sound must offer a way to silence it. The spec
// requires the toggle in the hub AND each game, and it regressed once already
// by simply never being built on the game pages.
test('every page wires up a mute toggle', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /id="nk-mute-toggle"/, `${page} has no mute button`);
  }
  const wired = [
    ['index.html', read('index.html')],
    ['games/guardian/guardian.js', read('games/guardian/guardian.js')],
    ['games/survivor/survivor.js', read('games/survivor/survivor.js')],
  ];
  // Match the actual invocation (a dot, the method name, an open paren), not
  // a bare mention of the name — a comment describing the wiring must not be
  // able to satisfy this on its own if the real call is deleted.
  for (const [name, src] of wired) {
    assert.ok(src.includes('nk-mute-toggle'), `${name} never looks the mute button up`);
    assert.match(src, /\.bindMuteButton\(/,
      `${name} never calls NK.audio.bindMuteButton(...) to wire the mute button`);
  }
});

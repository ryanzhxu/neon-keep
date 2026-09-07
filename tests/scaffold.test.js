// Structural invariants for the Neon Keep scaffold.
// These guard the Global Constraints in the plan: the file layout, the
// script load order on every page, and the NK.store contract. They must keep
// passing as Tasks A-D fill the stubs in.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const PAGES = [
  { file: 'index.html', prefix: 'shared/', own: [] },
  {
    file: 'games/guardian/index.html',
    prefix: '../../shared/',
    own: ['words.js', 'guardian-logic.js', 'guardian.js'],
  },
  {
    file: 'games/survivor/index.html',
    prefix: '../../shared/',
    own: ['survivor-logic.js', 'survivor.js'],
  },
];

const REQUIRED_FILES = [
  'index.html',
  'shared/theme.css',
  'shared/store.js',
  'shared/audio.js',
  'shared/juice.js',
  'games/guardian/index.html',
  'games/guardian/guardian.css',
  'games/guardian/guardian-logic.js',
  'games/guardian/guardian.js',
  'games/guardian/words.js',
  'games/survivor/index.html',
  'games/survivor/survivor.css',
  'games/survivor/survivor-logic.js',
  'games/survivor/survivor.js',
];

test('every file the plan requires exists', () => {
  for (const f of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `missing ${f}`);
  }
});

test('the old Python project is gone', () => {
  for (const f of ['main.py', 'requirements.txt', 'game1_gargoyle', 'game2_dungeon', 'game3_trivia']) {
    assert.ok(!fs.existsSync(path.join(ROOT, f)), `${f} should have been removed`);
  }
});

// Global Constraint: store.js, audio.js, juice.js, then the page's own scripts.
test('every page loads the shared scripts in the required order', () => {
  for (const page of PAGES) {
    const html = read(page.file);
    const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    const expected = [
      `${page.prefix}store.js`,
      `${page.prefix}audio.js`,
      `${page.prefix}juice.js`,
      ...page.own,
    ];
    assert.deepStrictEqual(srcs, expected, `wrong script order in ${page.file}`);
  }
});

test('every page loads the shared theme', () => {
  for (const page of PAGES) {
    assert.match(read(page.file), /<link[^>]+href="[^"]*shared\/theme\.css"/, `${page.file} misses theme.css`);
  }
});

test('every page declares a charset and a mobile viewport', () => {
  for (const page of PAGES) {
    const html = read(page.file);
    assert.match(html, /<meta charset="utf-8">/i, `${page.file} misses charset`);
    assert.match(html, /name="viewport"/i, `${page.file} misses viewport`);
  }
});

// Navigation convention from the Shared Interface Contract.
test('each game page has a back link to the hub', () => {
  for (const page of PAGES.filter((p) => p.file !== 'index.html')) {
    const html = read(page.file);
    assert.match(html, /href="\.\.\/\.\.\/index\.html"/, `${page.file} misses the hub link`);
    assert.match(html, /&larr; Keep|← Keep/, `${page.file} misses the "← Keep" label`);
  }
});

test('theme.css defines every contract token on :root', () => {
  const css = read('shared/theme.css');
  const tokens = [
    '--nk-bg', '--nk-bg-panel', '--nk-neon', '--nk-neon-2', '--nk-danger',
    '--nk-text', '--nk-muted', '--nk-font-display', '--nk-font-body',
    '--nk-radius', '--nk-space',
  ];
  for (const t of tokens) {
    assert.ok(css.includes(`${t}:`), `theme.css misses ${t}`);
  }
});

test('theme.css defines every contract utility class', () => {
  const css = read('shared/theme.css');
  for (const c of ['.nk-btn', '.nk-panel', '.nk-title', '.nk-crt']) {
    assert.ok(css.includes(c), `theme.css misses ${c}`);
  }
});

// NK.store contract. localStorage is shimmed so the module loads under Node.
test('NK.store honours its contract', () => {
  const mem = {};
  global.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
  const store = require('../shared/store.js');

  assert.strictEqual(typeof store.get, 'function');
  assert.strictEqual(typeof store.set, 'function');
  assert.strictEqual(typeof store.isMuted, 'function');
  assert.strictEqual(typeof store.setMuted, 'function');

  assert.strictEqual(store.get('absent', 42), 42, 'missing key returns the fallback');
  assert.strictEqual(store.set('k', { a: 1 }), true, 'set reports success');
  assert.deepStrictEqual(store.get('k', null), { a: 1 }, 'value round-trips');

  mem['corrupt'] = '{not json';
  assert.strictEqual(store.get('corrupt', 'safe'), 'safe', 'corrupt JSON falls back');

  assert.strictEqual(store.isMuted(), false, 'mute defaults to false');
  store.setMuted(true);
  assert.strictEqual(store.isMuted(), true, 'setMuted persists');
});

test('NK.store survives a localStorage that throws', () => {
  global.localStorage = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
    removeItem: () => { throw new Error('denied'); },
  };
  delete require.cache[require.resolve('../shared/store.js')];
  const store = require('../shared/store.js');
  assert.strictEqual(store.get('anything', 'fallback'), 'fallback', 'read failure falls back');
  assert.strictEqual(store.set('anything', 1), false, 'write failure reports false');
});

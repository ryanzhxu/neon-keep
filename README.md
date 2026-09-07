# Neon Keep

Neon Keep is a static browser arcade. It needs no install and no server. It
has two neon-themed minigames.

Play the live site: https://neon-keep.ryanxu.dev/

## Games

- **Loophole Guardian** — Spot the loophole in each word before it slips past you.
- **Reflex Survivor** — Survive as many waves as you can against a rising threat.

## How to play

Choose one method.

1. Open `index.html` directly in a browser.
2. Or serve the folder and open it over HTTP:
   ```
   python3 -m http.server 8000
   ```
   Then visit `http://localhost:8000`.

## Tech

Neon Keep uses plain JavaScript. It has no framework, no dependency, and no
build step. It makes no network calls and needs no backend or AI service. It
saves scores and the mute setting in `localStorage`.

## Run the tests

Run this command from the project root:

```
node --test 'tests/**/*.test.js'
```

Quote the glob. The unquoted form `node --test tests/` fails on Node 24,
which resolves the directory as a module instead of a test glob.

## Deployment

Neon Keep is a static site. It deploys to any static host, such as GitHub
Pages. This copy deploys to GitHub Pages automatically from `main` on every
merge.

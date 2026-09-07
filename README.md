# Neon Keep

Neon Keep is a static browser arcade. It needs no install and no server. It
has two neon-themed minigames.

Play the live site: https://neon-keep.ryanxu.dev/

## Games

- **Loophole Guardian** — A snarky gargoyle guards a vault. You may not ask for
  the password, only oblique questions: does it contain this letter, what
  rhymes with it, how long is it. Spend your question budget, then guess.
- **Reflex Survivor** — One hit point. Attacks telegraph from a direction and
  the timing window shrinks every wave. Dodge the wrong way once and the run
  is over.

## Controls

**Loophole Guardian** is played entirely with the question menu and the guess
box. No keyboard shortcuts.

**Reflex Survivor** takes the same actions on either device.

| Action | Desktop | Touch |
|---|---|---|
| Dodge | Arrow keys | Swipe |
| Parry | Space | Tap |

A dodge moves away from the attack. A parry works against any direction, but
only in the last third of the timing window, and it pays double combo. Press
it early and it fails like a wrong dodge.

From wave 4 attacks can come in pairs, and any direction not under attack is
safe. From wave 7 an attack can be a feint: the telegraph lies, so the safe
answer is to move into it.

You have one hit point. One mistake ends the run.

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

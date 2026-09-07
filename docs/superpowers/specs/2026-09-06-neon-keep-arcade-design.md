# Neon Keep — Design Spec

Date: 2026-09-06

## Overview

Neon Keep is a static browser arcade. It holds two independent games under one
shared retro dark-fantasy theme. It needs no server, no build step, and no AI.
It runs as plain HTML, CSS, and JavaScript. It works on desktop and mobile.

This spec replaces the old "Local LLM Arcade" project. The old app used
Streamlit and a local Ollama model. All of that is removed.

## Goals

- Fun, juicy games that people want to play and share.
- Zero install. Open a URL and play at once.
- Runs on any phone or desktop browser.
- Free to host on GitHub Pages or any static host.

## Non-goals

- No AI or LLM.
- No accounts, login, or backend.
- No build tooling or framework.
- No online leaderboard. Scores stay local for now.

## Architecture

Static site. No server. File layout:

```
index.html              hub (game select)
shared/
  theme.css             shared neon + CRT theme and tokens
  juice.js              screen shake, flash, particles, hit-stop
  audio.js              sound effects and mute toggle
  store.js              localStorage high scores
games/
  guardian/
    index.html, guardian.css, guardian.js, words.js
  survivor/
    index.html, survivor.css, survivor.js
assets/                 small sound files, if used
```

Each game is its own page. The hub links to each game page. A "back to hub"
control returns to `index.html`. This keeps the games isolated and simple. No
router is needed.

Scripts load as classic `<script>` tags, not ES modules. This lets the site
also run from `file://` by double-click. Shared scripts attach small namespaced
globals: `NK.juice`, `NK.audio`, `NK.store`.

## Shared theme

- Dark background, neon accent palette, CRT scanline overlay, chunky display
  font.
- CSS custom properties define colors and spacing. Both games load `theme.css`.
- The theme is dark only. There is no light mode.
- The hub is themed but plain. It is not a game. It shows the title, two game
  tiles, saved high scores, and a sound toggle.

## Game 1: Loophole Guardian

Genre: word-deduction puzzle.

Fantasy: a snarky gargoyle guards a vault. The secret is a hidden word. The
player cannot ask for the word. The loophole is that the gargoyle must answer
oblique questions. The player spends a limited question budget to deduce the
word, then guesses.

Interaction: a question menu of buttons, not free text. Each question spends one
unit of the budget:

- Contains letter? The player picks a letter. The gargoyle says yes or no.
- Rhyme. The gargoyle gives a word that rhymes with the secret.
- Length. The gargoyle says the letter count.
- All-but-password. The gargoyle spells a snarky non-answer. Low information,
  high flavor.
- Themed hint. The gargoyle gives a category or clue.

Guess: a text input for the final word. A correct guess wins the level.

Levels: 3 to 5 levels. Each level defines a word, a theme, a question budget,
and gargoyle mood text. Harder levels give a smaller budget and longer or odder
words. The word list lives in `words.js`.

Win and lose:

- Win: the player guesses the word within budget. The vault opens. The game
  advances to the next level.
- Lose: the budget runs out with no correct guess. Show a retry option.

Juice: the gargoyle sprite changes mood as the budget shrinks. Snark text uses a
typewriter effect. The vault cracks open on a win.

State: the best score per level (fewest questions used) and level completion
persist in localStorage.

## Game 2: Reflex Survivor

Genre: reflex and timing action. Rendered on a canvas.

Fantasy: a hero at 1 HP. One hit ends the run.

Core loop:

1. An attack telegraphs from a direction (left, right, top, or bottom).
2. A timing window shrinks.
3. The player inputs the correct dodge before the window closes.
4. Correct input in the window: the dodge succeeds. Score and combo rise.
5. Wrong input or timeout: the hit lands. At 1 HP, the run ends.

Controls, same rules for both devices:

- Desktop: arrow keys dodge a direction. Space parries.
- Mobile: a swipe dodges a direction. A tap parries.
- An input layer maps keys and touch to the same actions.

Difficulty ramp: the window shrinks over time. The attack rate rises. Higher
waves add double-attacks and fake-outs. Exact tuning is an implementation
detail.

Score: time survived and wave reached. The best score persists in localStorage.

Juice: screen shake, hit-stop, particle burst, flash, a combo multiplier, a
death slow-motion, and rising audio tempo with intensity.

## Audio

- `audio.js` provides small sound effects. Use WebAudio blips or small asset
  files.
- A mute toggle sits in the hub and each game. The preference persists.
- Audio starts only after a user gesture, per browser autoplay rules.

## Error handling

- `store.js` wraps localStorage reads and writes in try/catch. If storage fails,
  the game still runs with no saved score.
- The canvas game uses `requestAnimationFrame`. It pauses on tab blur or hidden
  visibility to avoid runaway timers.
- There are no network calls, so there are no network errors.

## Testing and verification

The site is static and interactive. Verification is mostly manual play, plus a
few unit-testable pure functions.

Pure logic worth a light unit test:

- Guardian answer functions: contains-letter, rhyme lookup, length.
- `store.js` best-score tracking.
- Survivor difficulty-ramp function.

Manual test checklist:

- The hub loads. Each game loads and returns to the hub.
- Guardian win and lose paths both work.
- Survivor ends the run on the first miss.
- High scores persist across a reload.
- The mute preference persists.
- Mobile touch works. Desktop keys work.

Keep test tooling minimal. If tests are added, use a no-dependency approach that
matches the no-build principle.

## Removed from the old project

- `main.py`, `requirements.txt`.
- `game1_gargoyle/`, `game2_dungeon/`, `game3_trivia/` (all Python).
- The README is rewritten for Neon Keep.

## Scope

In scope: the hub, two games, the shared theme, juice, audio with mute, and
localStorage scores.

Out of scope for now: a daily seeded challenge, an online leaderboard, a third
game, a shared cross-game world or character, and build tooling.

## Decisions already made

- Name: Neon Keep.
- Guardian input: a question menu.
- Survivor controls: both keyboard and touch, phone-first.
- Theme: retro neon and CRT, dark, medieval-fantasy.
- The two games are independent. They share only the hub and the theme.

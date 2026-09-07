# Morning check

Neon Keep was built overnight with no browser available. 111 automated tests
cover the pure logic, the file structure, the cross-file contract and an
accessibility floor. **Nothing has been played.**

This is the five-minute pass that closes that gap. It is ordered by risk: the
first three items are the ones most likely to be wrong, because they are new,
timing-dependent, and unreachable by any test that cannot render.

Open <https://neon-keep.ryanxu.dev/>.

## 1. Survivor input — highest risk

Everything here shipped in the last few hours and none of it has ever run.

- [ ] Press **Start**. An attack telegraphs from one side and a timing bar shrinks.
- [ ] **Arrow key away** from the attack. The wave advances.
- [ ] **Space** in the last third of the bar. It parries, and the combo jumps by two rather than one.
- [ ] **Space early**, near the start of the bar. It should fail like a wrong dodge, not save you.
- [ ] Reach **wave 4**. Attacks start coming in pairs; any direction not under attack is safe.
- [ ] Reach **wave 7**. A telegraph sometimes lies — move *into* it to survive.
- [ ] Die once. There should be a slow-motion beat, a particle burst, and "I survived wave N".

The parry window is one third of the timing bar, double-attacks start at wave 4
and fake-outs at wave 7. Those numbers were reasoned, never played. **If the
game feels wrong, the tuning is the first thing to change** — the constants are
at the top of `games/survivor/survivor-logic.js`, and `tests/integration.test.js`
will fail until the README's numbers are updated to match, on purpose.

## 2. Sound and the mute toggle

The mute wiring was consolidated into one shared helper late in the night. It is
tested against a fake DOM, never a real one.

- [ ] Sound plays on the first click, not before it.
- [ ] Toggle mute on the **hub**. The label flips between 🔊 and 🔇.
- [ ] Open a game. It should already be muted — the preference is shared.
- [ ] Toggle it back inside the game, return to the hub, reload. It should have stuck.
- [ ] In Survivor, the ambient tick should speed up as waves climb.

## 3. Guardian

- [ ] Each of the five question buttons costs one budget and gives a sensible answer.
- [ ] The gargoyle's mood shifts as the budget drains.
- [ ] Guess correctly. The vault opens and the level advances.
- [ ] Spend the whole budget without guessing. **You should still get one final guess** — this was a deliberate ruling, not a bug. Then Retry appears.
- [ ] Reload. Levels cleared persisted.

## 4. Phone

- [ ] Survivor: swipe to dodge, tap to parry.
- [ ] Both games are playable in portrait without horizontal scrolling.
- [ ] Buttons are comfortable to hit.

## 5. Console

- [ ] Open devtools on all three pages. **There should be no errors.** This is the single check no automated test could stand in for, and the one most likely to surface something.

---

## What the tests already cover, so you can skip it

Storage round-trips and corruption fallback, the difficulty ramp's shape and
floor, every deduction helper against hostile input, the level data, all
internal links, the storage-key and `NK.*` contract across files, script load
order, that the site makes no network call, that the README's stated tuning
matches the code, and an accessibility floor.

## Known and deliberate

- **A parry pressed early fails.** It is a risk/reward alternative to dodging, not a safer option. Neither the spec nor the plan defined parry behaviour, so it was ruled.
- **The budget-exhausted final guess in Guardian** is intentional; losing the last question would otherwise end the level with no chance to answer.
- **The frozen death frame in Survivor** now shows the hero and the burst rather than the last attack telegraph, a side effect of drawing the killing-hit particles.
- **`shared/theme.css` uses `color-mix()`.** Widely supported since 2023, but it has never been seen rendered.

# Roadmap

Ordered so that **the game is playable and fun-testable as early as possible**, and so that the
riskiest assumptions get tested before we build on top of them.

---

## The two things most likely to sink this

Worth naming up front, because the milestone order is designed around them:

1. **Cheap dead-ending might be degenerate.** If the optimal line is "play a 2-letter dead-end, bank 2,
   repeat", the game is broken and the scoring needs rework. `rules-spec.md` §7 lists the fixes.
   → **M3 answers this**, before we build any polish on top of the current scoring.
2. **Tile input might be too slow for a 45-second clock.** If arranging letters eats the turn, the timer
   measures dexterity instead of vocabulary. `ui-ux.md` §1–2 is the mitigation (type-to-arrange).
   → **M2 answers this**, with a human in front of it.

Everything before M3 is deliberately ugly. Do not polish anything until both questions are answered.

---

## M0 — Dictionary spike ✅ **DONE**
*The foundation. Nothing works without it.*

- [x] Source ENABLE, commit the raw list. (`data/enable1.txt`, 172,823 words)
- [x] `scripts/build-dictionary.ts` — alphagram map + seed weight table → `public/dict.txt`.
      **`npm run build:dict`**
- [x] `game/alphagram.ts`, `game/dictionary.ts` — `isValid()`, `extensions()`, `possibleWords()`,
      `extensionsByLetter()`, `isDeadEnd()`. Pure TS, runs headless.
- [x] `scripts/verify-dictionary.ts` — the acceptance suite. **`npm run verify:dict`**
- [x] Prove the 26-lookup path is as fast as claimed.
- [x] Sanity-check the design doc's own example end-to-end.

**Results:** 152,405 words / 136,157 alphagrams. **408 KB gzipped** (budget was 500–600 KB).
`possibleWords()` runs in **10.2 µs** — ~1,600× cheaper than a frame. Load is ~230 ms, once, in the
loading screen.

**Three things it found that we didn't know:**
1. **`FIXT` is not a dead end.** The doc's own example was wrong: `FIXT` → `FIXIT` → `FIXITY`. Worth 6,
   not 4. (`open-questions.md` A8)
2. **`C`, `Q`, `V`, `Z` have no 2-letter words** — seeding them makes an *unplayable* round, not just a
   bad one. Uniform seeding would have dealt one ~15% of the time. Now weighted 0. (A9)
3. **The naive JSON format was 827 KB gzipped**, well over budget. Not storing the derivable alphagram
   keys halved it. (`dictionary.md` §3)

## M1 — Headless rules engine ✅ **DONE**
*The game, with no game on screen.*

- [x] `game/types.ts`, `rules.ts`, `rng.ts` (seeded, injectable — the sim must be replayable).
- [x] The state machine from `rules-spec.md` §8, as a pure reducer.
- [x] `scripts/verify-rules.ts` — **`npm run verify:rules`**. The `rules-spec.md` §4.1 claim-model trace
      runs verbatim as the headline test.
- [x] `Opponent` interface + `RandomAi` (with a `seekDeadEnds` flag — that's the degenerate bot M3 has to
      rule out).
- [x] **The four power hooks, stubbed** (`characters.md` §4). `applyMove` accepts an optional power
      activation, `powerUsed[]` is in the state and resets each round, and the +1 invariant is enforced
      relative to the **post-power** base — so "remove k, then add one" is already expressible.
- [x] `beasts/roster.ts` — all twelve, `implemented: false` on every power.

**Results:** 45 checks green. Two random AIs play a full match to 100 unattended.

**Two decisions the code forced** (both now in `open-questions.md`):
- **A10 — the win is checked after *any* scoring event**, not just at round end. Otherwise a player who
  crosses 100 on a mid-round timeout is stuck finishing a round they've already won. *This changes
  `rules-spec.md` §5.*
- **A11 — the clock is not in `GameState`.** A reducer that reads `Date.now()` can't be replayed by the
  balance sim. The presentation layer owns the timer and dispatches `{kind:"timeout"}`; Skip Turn
  dispatches the identical move.

**The `MEN → MET` test is the one to watch.** It's rejected as `wrong_length` — because `MET` doesn't
*grow* the word. That's the Rooster problem stated as a type error, and it's exactly why the hooks went
in now rather than in M6.

## M2 — Playable prototype ✅ **BUILT — awaiting playtest**
*A human can play it. Ugly. Answers risk #2.*

- [x] `GameScreen` — word tiles, letter input, timer, Possible Words counter, scores.
- [x] Type-to-arrange input (`ui-ux.md` §2), with drag as the secondary path.
- [x] Round end → new seed → match end.
- [x] **`CharacterSelectScreen`** — the 12 zodiac beasts as an emoji grid (`characters.md` §5). Selection
      is real and flows into `GameState`; powers are still stubs and the screen **says so** on each card.
- [x] Beasts appear on the game screen as emoji, flanking the board. No animation yet.
- [x] Placeholder everything else. No juice, no audio.

**Built:** `TitleScreen` → `CharacterSelectScreen` → `GameScreen`. `HumanOpponent` sits behind the same
`Opponent` interface as the AI, so the game loop still can't tell them apart. The clock lives in the screen
and dispatches `{kind:"timeout"}` — Skip Turn dispatches the identical move (A11).

**Also built, not originally in M2's scope** (both were pulled forward because the prototype was unplayable
without them):

- [x] **Three difficulty tiers** — Easy / Medium / Strong, chosen at Character Select. The unhandicapped
      bot knows all 152,405 ENABLE words and never runs out of clock, which made it feel unbeatable even
      though it plays at *random*. Tiers restrict the AI's **vocabulary** (`ai-opponent.md` §4 lever 1),
      which needed the frequency list that was M4's job. `npm run build:dict` now emits `public/vocab.txt`.
      **This mostly closes U3.**
- [x] **The Dragon's Eye** — a DEBUG tool (not a power) that lights up every letter making a real word.
      Labelled DEBUG everywhere it appears. It is the U2 assist mode; **it is not an answer to U2.**

**Done when:** Austin, Jakey and Joey have each played a full match to 100 and we have opinions.
**This is the first real playtest and the first honest read on whether the tile input survives the clock —
that question is still open, and only a human can close it.**

**What building it found:**
1. **Possible Words is ~10× smaller than `ui-ux.md` §5 assumes.** The "340 → 71, `▼ 269`" example doesn't
   exist: the real counter medians 23 at two letters and decays into single digits, and the doc's own `MEN`
   reads **14**. The colour bands had to be retuned on the spot or turn one was solid red, and "animate the
   drop" has almost nothing to animate. **This is a live design question about Pillar 2** —
   `open-questions.md` **A12**.
2. **The win can land with no round-end beat.** A10 checks the win after *any* scoring event, so crossing
   100 on a timeout payout jumps straight to MATCH_END with no round to end. Correct, but the screen has to
   handle a `MATCH_END` that carries no `lastRound` — worth knowing before someone "fixes" it.
3. **An invalid submission must never cost a turn**, so the screen validates *before* handing the move to
   the reducer. `applyMove` throwing at a human is a bug in the UI, not a rejection to show them.

## M3 — Balance simulator
*Answers risk #1. Before we build anything on top of the current scoring.*

- [ ] `scripts/balance-sim.ts` — headless AI-vs-AI, N matches, CSV out.
- [ ] Instrument: round length distribution, dead-end frequency by word length, points-per-round, how
      often a match actually reaches 100, how long a match takes.
- [ ] **Answer the dead-end question with data.** Is a cheap-dead-end bot beating an extending bot?
- [ ] Tune the seed weight table against real data.
- [ ] If degenerate: apply `rules-spec.md` §7 in order and re-run.

**Done when:** we know whether the scoring holds, and the seed table isn't producing dud rounds.
**Jakey owns this.**

## M4 — A real opponent
- [ ] Memoised minimax (`ai-opponent.md` §3, Hard tier). **This is the only part still missing** — every
      tier today is M1's random bot wearing a vocabulary handicap.
- [x] ~~Word-frequency data joined to ENABLE at build time.~~ **Done early, in M2** — `public/vocab.txt`,
      31,911 ranked words. ⚠️ It's CC BY-SA; see the licence note in the README.
- [x] ~~The three difficulty tiers, handicapped by **vocabulary** — not by randomness.~~ **Done early, in
      M2.** Measured: Easy beats Medium 0% of 200 matches; Medium beats Strong 0%. Strictly monotonic.
- [ ] Believable think-time (`ai-opponent.md` §5). *(A flat 0.8–2.4 s jitter is in; it doesn't yet scale
      with how hard the position actually is.)*

**Done when:** Easy is beatable by a casual player, Hard beats all of us, and neither feels like it's
cheating.

## M5 — Game feel
*Now it's allowed to be pretty.*

- [ ] The Possible Words meter as a character (`ui-ux.md` §5) — the drop animation, the delta, the colour.
- [ ] Tile juice: weight, squash, the invalid-shake, the pre-submit valid glow.
- [ ] Audio — the template's audio system is already wired.
- [ ] Round-end payoff: the word flies into the score.
- [ ] Timer tension under 10s.

## M6 — Powers
*The stubs from M1 finally do something.*

- [ ] **Design 3–4 powers properly.** Not twelve. Twelve balanced powers is an enormous amount of design
      and QA, and we'd be balancing them against a game we've only just finished tuning.
- [ ] Implement **Rooster / Peck** first — it's the one that stresses every hook (word shrinks, pot
      shrinks, dead ends reopen). If the engine survives Peck, it survives anything. `characters.md` §3.
- [ ] Teach the AI to use each power (`characters.md` §6 — it doesn't get this for free).
- [ ] Re-run the balance sim with powers on. Powers will break the M3 tuning; expect to re-tune.
- [ ] Remaining beasts stay cosmetic-only, and the select screen keeps saying so.

## M7 — Art & animation
- [ ] Art direction for the twelve zodiac beasts (currently undecided and unblocking — emoji hold).
- [ ] Five states each: idle / thinking / smug / panicking / triumphant.
- [ ] Wire the AI's think-time to the beast's thinking animation — it becomes the AI's tell.
- [ ] Power activation as a physical event — the Rooster *tears the tile out of the word*
      (`ui-ux.md` §6). Powers are public information by contract; the animation is how the opponent is
      told.
- [ ] Spine is already a dependency; this is an art problem, not a tech one.

---

## Explicitly not in the prototype

Naming these so nobody quietly starts building one.

- **Online multiplayer.** Out of scope. The `Opponent` seam means it's *possible* later; that is not the
  same as planned.
- **Hot-seat two-player.** Nearly free (`architecture.md` §4) but not the prototype's job. Add it when
  solo is good.
- **Word definitions.** High value (`dictionary.md` §5), cheap, but it's a polish item. M5+.
- **All twelve powers.** The roster ships at twelve and selectable from M2; the *powers* land 3–4 at a
  time from M6. Shipping eight cosmetic beasts alongside four powered ones is fine — **quietly shipping
  twelve identical beasts and hoping nobody notices is not.** `characters.md` §5.
- **Beast progression / evolution.** The name is pointing at something interesting (`ui-ux.md` §6).
  Not now.
- **Mobile / touch layout.** Don't paint into a corner; don't build it yet.
- **Assist mode** (per-letter counter breakdown). Design it properly or not at all.

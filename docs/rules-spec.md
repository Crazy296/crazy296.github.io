# Rules Specification

**This is the authoritative rules document.** Where it disagrees with the prose in `~design-doc.md`,
this wins. Build to this.

---

## 1. Definitions

| Term | Meaning |
|---|---|
| **Seed letter** | The single letter drawn at the start of a round. It is *not* a word. |
| **Word in play** | The current letters. Length 1 (the seed) at round start, growing by 1 each turn. |
| **Adder** | The player who most recently added a letter. |
| **Extension** | A valid dictionary word using every letter in play plus exactly one new letter, in any order. |
| **Possible Words** | The count of distinct valid extensions of the word in play. Public information. |
| **Dead end** | A word in play with zero extensions. |
| **Claimed** | A word whose points have already been paid out via a timeout. See §4. |

## 2. Round setup

1. Draw a **seed letter**. Not uniform A–Z — see §6.
2. `wordInPlay := seed`, `adder := null`, `claimed := false`.
3. Starting player alternates between rounds (whoever *didn't* start the last round starts this one).
4. Go to §3.

## 3. Turn sequence

At the start of every turn, in this order:

1. **Dead-end check.** Compute Possible Words for the word in play.
   If it is **0**, the round ends immediately — go to §5. *The active player never gets a turn they
   cannot possibly complete.* This is why a player who plays a dead-end word scores instantly rather
   than waiting for the opponent's clock to run out.
2. Reset the turn timer to **45 seconds** and start it.
3. The active player either **submits a word** (§3.1) or **times out** (§4).

### 3.1 Submission validity

A submitted word `W'` is legal if and only if **all** of:

- `W'` is in the dictionary.
- `length(W') == length(wordInPlay) + 1`.
- `multiset(W') == multiset(wordInPlay) + {one new letter}`.

  Formally: `W'` contains every letter of `wordInPlay` with at least its current multiplicity, and
  exactly one letter beyond that. Multiplicity matters — from `TOO` you may reach `TOOL` or `ROOT`,
  but `TOOO` only if it's a real word (it isn't).
- Order is unconstrained. Any arrangement is fine as long as the result is a word.

**On a legal submission:**
```
wordInPlay := W'
adder      := activePlayer
claimed    := false        // a fresh letter makes the word claimable again
activePlayer := opponent
```
Go to §3.

**On an illegal submission:** reject it, show why (not a word / wrong letters / wrong length), and
**do not stop the clock**. Bad guesses cost time. There is no penalty beyond that and no limit on
attempts.

## 4. Timeouts and Skip (the claim model)

The design doc's two worked examples encode a rule subtler than its prose. This is the reading that
reproduces **both examples exactly**, and it's what we're building.

> **A word can only be cashed once per letter added to it.**

Adding a letter makes the word **unclaimed**. A timeout **claims** it for the adder. A timeout on an
already-claimed word ends the round with no further payout.

**When the timer hits 0** (or the player presses **Skip Turn**, which is identical — it sets the
timer to 0):

- **If the word is unclaimed and `adder != null`:**
  - The **adder** scores `length(wordInPlay)` points.
  - `claimed := true`.
  - The word in play is **kept** — the round does *not* reset.
  - **Turn passes to the adder** (the player who just scored). They must now extend their own word.
  - Go to §3.
- **If the word is already claimed** (i.e. this is the second timeout in a row, with no letter added
  between them):
  - No points are awarded.
  - The round ends. Go to §5.
- **If `adder == null`** (the very first player of the round timed out on the seed letter):
  - No points are awarded — nobody has added anything to score for.
  - Turn passes to the opponent. The seed and the round continue.
  - *(If both players time out on the bare seed, the round ends and a new seed is drawn.)*

### 4.1 Worked example — the design doc's second example, traced

Seed `E`. P1 starts.

| Event | Word | Adder | Claimed | Score | Next turn |
|---|---|---|---|---|---|
| P1 plays `ME` | ME | P1 | no | — | P2 |
| **P2 times out** | ME | P1 | **yes** | **P1 +2** | **P1** |
| P1 plays `MEN` | MEN | P1 | no | — | P2 |
| **P2 times out** | MEN | P1 | **yes** | **P1 +3** | **P1** |
| **P1 times out** | MEN | P1 | already claimed | — | — |
| Round ends. New seed. | | | | | |

P1 finishes with 5. This matches the design doc line-for-line, including "*Player 1 is awarded the
total points of the final word (3), and a new round begins*" — P1 got the 3 from **P2's** timeout,
and P1's own subsequent timeout ends the round paying nothing. Without the claim rule, P1 would score
3 twice, and a player who simply refuses to play would be an infinite point printer for their
opponent.

### 4.2 Is Skip ever correct?

Yes, and this is a nice piece of emergent strategy worth protecting.

Skipping hands your opponent `length(wordInPlay)` points. But if every extension available to you
leaves them a word they can dead-end for *more* than that, conceding the smaller pot now is correct.
Skip is not just a "I'm stuck" escape hatch — it's a resignation with a price tag, and reading when
to pay it is a real skill.

Corollary: **repeatedly timing out is strictly self-harming.** Each timeout pays the opponent and
hands them the turn, and the word only grows. There is no stalling exploit. Good.

## 5. Round end and scoring

A round ends when either:

- **Dead end** (§3 step 1): the word in play has zero extensions.
  → The **adder** scores `length(wordInPlay)`.
  → *(If `adder == null` — a seed letter with no 2-letter extensions at all — nobody scores. This is
  preventable at seed time; see §6.)*
- **Double timeout** (§4): a timeout on an already-claimed word.
  → Nobody scores. The points were already paid on the first timeout.

> **"Nobody scores" describes the round-ending *event*, not the round.** Timeouts pay out mid-round, so
> a round that ends on a double timeout may still have paid a player 2, then 3 — the §4.1 trace is
> exactly that, and P1 walks away with 5. The round summary reports the **round total per player**
> (`GameState.roundPoints`, carried on `RoundResult.roundPoints`), which is what a player means when they
> ask what a round was worth. It reads "nobody scores" only when the round genuinely paid nothing.

Then:
1. Show the round summary (final word, who scored, running totals).
2. Start a new round (§2), with the *other* player starting.

### 5.1 The win check — AFTER ANY SCORING EVENT *(amended in M1; `open-questions.md` A10)*

This section used to put the win check at **round end**. That is wrong, and the engine does not do it.

A timeout pays out **mid-round** (§4), so a player can cross 100 without a round ending. Checking only at
round end would force them to keep playing out a round they have already won.

> **If any player is at ≥100 points, the match ends immediately — whether the points came from a dead end,
> or from a mid-round timeout payout.** That player wins.

A consequence worth knowing before someone "fixes" it: **a match can end with no round-end beat at all**,
because the round never ended. The presentation layer has to cope with a `MATCH_END` that carries no
`lastRound`.

**Scoring is always `length(finalWord)`** — no multipliers, no bonuses, no letter values. One point
per letter. Deliberately: the counter and the clock are already carrying enough cognitive load, and
a flat score keeps "how much is this pot worth?" instantly readable at a glance.

## 6. Seeding — MEASURED (M0)

**Do not draw uniformly from A–Z.** This was a hunch when the doc was written. M0 measured it, and the
truth is worse than the hunch.

**C, Q, V and Z have zero 2-letter words in ENABLE.** Not "a bad round" — an **unplayable** one. The
opening player has no legal move at all, so nobody can ever score. Uniform A–Z would deal one of these
**~15% of the time**, roughly one round in seven.

They are excluded (weight 0, recorded in `dict.meta.excludedSeeds`). **J** and **K** are nearly as thin
— exactly one 2-letter word each (`JO`, `KA`), so the opening move is forced — and the weights push them
right down rather than banning them.

The table is built by `scripts/build-dictionary.ts`. **Weight = the number of distinct 3-letter words
genuinely reachable from that seed** (seed → some valid 2-letter word → some valid 3-letter word). Not a
proxy for depth — the real thing, computed exactly, at build time, for free.

| | |
|---|---|
| Richest | `A` 12.6% · `E` 9.7% · `O` 9.4% · `I` 6.5% |
| Poorest drawable | `G` 2.1% · `X` 1.5% · `K` 0.7% · `J` 0.3% |
| Never drawn | `C` `Q` `V` `Z` |

The exact weights are a **tuning knob**, not a rule. Re-derive them against the M3 balance sim.

## 7. If dead-ending turns out to be degenerate

We are shipping the prototype with dead-ending unrestricted (see `~design-doc.md` §4). If playtesting
shows players just spam cheap 2- and 3-letter dead-ends and the game collapses, pull these levers **in
this order** — cheapest and least invasive first:

1. **Tune the seed table.** Bias toward letters with rich, extendable trees. May be sufficient alone.
2. **Minimum scoring length.** Words below N letters (N≈4) pay nothing. One rule to learn, kills cheap
   dead-ends outright.
3. **Superlinear scoring.** Points = `length²/2` or similar, so long words dwarf short ones and
   dead-ending early stops being worth the tempo. Preserves the tension, costs one line of code.
4. **Extendable-only rule.** You may only play a word that still has an extension. *We argue against
   this* — it means rounds can only ever end on timeouts, which guts the entire dead-end mechanic and
   makes the Possible Words counter nearly decorative. Listed for completeness, not recommended.

## 8. State machine

> **As built (M1), two boxes below are not phases.** `TURN_START` is *transient* — the dead-end check
> runs inside `applyMove`, so a state ever handed to a player is always one they can move in, and the
> engine's `Phase` is only `AWAIT_MOVE | ROUND_END | MATCH_END`. And there is **no `turnEndsAt` in the
> state**: the clock lives in the presentation layer, which dispatches `{kind:"timeout"}` when it expires
> (`open-questions.md` A11). The diagram is still the right way to *think* about a turn.

```
                    ┌──────────────┐
                    │  ROUND_START │  draw seed, adder=null, claimed=false
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
              ┌────▶│  TURN_START  │  compute PossibleWords
              │     └──────┬───────┘
              │            │
              │      PossibleWords == 0 ──────────────┐
              │            │                          │
              │            ▼ (>0)                     │
              │     ┌──────────────┐                  │
              │     │ AWAIT_MOVE   │  timer running   │
              │     └──┬────────┬──┘                  │
              │        │        │                     │
              │  legal │        │ timeout / skip      │
              │  submit│        │                     │
              │        │        ▼                     │
              │        │   claimed? ──yes──▶ ROUND_END (no payout)
              │        │        │ no                  │
              │        │        ▼                     │
              │        │   adder scores len           │
              │        │   claimed = true             │
              │        │   active = adder             │
              │        │        │                     │
              │        ▼        │                     ▼
              │   word grows    │              ┌────────────┐
              │   claimed=false │              │ ROUND_END  │ adder scores len
              │   swap active   │              └─────┬──────┘
              │        │        │                    │
              └────────┴────────┘                    ▼
                                              score >= 100?
                                              ├─ yes ─▶ MATCH_END
                                              └─ no ──▶ ROUND_START
```

## 9. Constants (all tunable)

| Constant | Value | Notes |
|---|---|---|
| `TURN_SECONDS` | 45 | Per the design doc. Suspect this is long once players are experienced — instrument it. |
| `TARGET_SCORE` | 100 | First to reach it wins. |
| `MIN_WORD_LENGTH` | 2 | The first submission of a round. |
| `SEED_WEIGHTS` | build-time table | See §6. |
| `SCORING` | `len(word)` | See §7 for alternatives if this proves degenerate. |

## 10. Open rules questions

Tracked in [open-questions.md](open-questions.md). The live ones as of this draft:

- Is 45s too long? It's dead air when there are 300 options and you knew your move in 4 seconds.
  Consider a shot-clock that shortens as Possible Words drops.
- Should Possible Words show a **per-letter breakdown** (e.g. `A:12  B:0  C:3…`)? It's a huge hint —
  possibly a difficulty setting rather than a default.
- Does a bad-guess spam penalty matter? Currently guessing costs only time. Probably fine; watch for
  players brute-forcing the validator.

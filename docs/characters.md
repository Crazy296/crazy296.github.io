# The Beasts — Characters & Powers

**Status: powers are PLACEHOLDERS.** The roster is fixed; the abilities are not. This doc exists to
lock down the *system* the powers plug into, so that designing them later is a content problem and not
an engine rewrite.

---

## 1. The roster

The twelve Chinese zodiac animals. Emoji placeholders for the prototype.

| # | Beast | Emoji | Power (PLACEHOLDER) |
|---|---|---|---|
| 1 | Rat | 🐀 | *TBD* |
| 2 | Ox | 🐂 | *TBD* |
| 3 | Tiger | 🐅 | *TBD* |
| 4 | Rabbit | 🐇 | *TBD* |
| 5 | Dragon | 🐉 | **Dragon's Eye** — ⚠️ **DEBUG TOOL, not a power.** Lights up every letter that makes a real word. Presentation-layer only; the engine still rejects it as an activation. `open-questions.md` U2 |
| 6 | Snake | 🐍 | *TBD* |
| 7 | Horse | 🐎 | *TBD* |
| 8 | Goat | 🐐 | *TBD* |
| 9 | Monkey | 🐒 | *TBD* |
| 10 | Rooster | 🐓 | **Peck** — once per round, remove one letter from the word before playing your letter. *(the worked example — see §3)* |
| 11 | Dog | 🐕 | *TBD* |
| 12 | Pig | 🐖 | *TBD* |

Twelve is a lot of characters to balance. Realistic expectation: **the prototype ships 12 selectable
beasts, of which maybe 2–3 have working powers.** The rest are cosmetic until they're designed. That's
fine and normal — but the select screen should be honest about it (§5).

## 2. Power contract

Every power, whatever it ends up being, must obey these. They're derived from what the rules engine
actually needs to stay coherent.

1. **Once per round.** Not per turn, not per match. Resets on new seed. (Matches the Rooster example.)
2. **Announced.** The opponent sees the power fire, and sees what it did. No hidden information — the
   game's whole strategic layer runs on the shared, public Possible Words counter (`~design-doc~.md`
   pillar 2). A power that secretly alters state poisons that.
3. **Cannot create an unresolvable position.** A power must never leave the board in a state where the
   active player has no legal move *and* the round can't cleanly end. The engine must re-run the
   dead-end check after any power resolves.
4. **Cannot be used to stall.** Powers resolve inside your turn, on your clock. No power pauses or
   extends the timer without that being a very deliberate, very scrutinised design choice.
5. **Deterministic where possible.** Randomness in powers makes the AI's search (`ai-opponent.md` §1)
   much messier and makes losses feel unfair. Prefer powers that are *choices*, not dice.

## 3. The Rooster problem (read this before designing any other power)

The worked example: word in play is `MEN`. Rooster pecks the `N`, leaving `ME`, then plays `T` → `MET`.

**Start: `MEN` (3 letters). End: `MET` (3 letters). The word did not grow.**

That single fact collides with four things:

- **The growth invariant.** `rules-spec.md` §3.1 requires `length(W') == length(wordInPlay) + 1`. Peck
  makes a turn net-zero. The rules engine must be taught that a turn is "remove *k*, then add one" where
  `k` is normally 0.
- **The pot.** Points are `length(finalWord)`. A power that shrinks the word **shrinks the prize**.
  That's actually a *great* mechanic — Peck is a defensive tool that deflates the pot your opponent is
  about to claim — but it needs to be an intentional design statement, not an accident.
- **Dead ends.** Peck can *reopen* a dead-ended word. `FIXT` has no extensions; peck the `T` and you're
  back at `FIX`, which has plenty. This means **a power can rescue a player from a position that would
  otherwise have ended the round and paid their opponent.** Big. Powerful. Needs a hard look.
- **Termination.** If a word can shrink, rounds are no longer guaranteed to end. Two beasts pecking at
  each other could in principle loop. **The once-per-round limit is what guarantees termination** — it's
  not a balance knob, it's a *correctness* requirement. Do not remove it without replacing it.

**None of this is a reason not to build Peck.** It's a genuinely interesting power. It's a reason to
build the engine so that "the word can change length in ways other than +1" is a first-class concept
from day one, rather than something we bolt on and break the state machine with.

## 4. Power hook points

Where a power is allowed to touch the game. Designing these now is the entire point of this doc.

```
TURN_START
  │
  ├── [HOOK: onTurnStart]        passive effects, e.g. "your timer is +10s"
  │
  ├── dead-end check ────────────── (must re-run after any hook that changes the word)
  │
AWAIT_MOVE
  │
  ├── [HOOK: beforeSubmit]       ← Peck lives here.
  │                                 mutate the word in play, then the player
  │                                 still owes a normal legal submission.
  │
  ├── player submits
  │
  ├── [HOOK: onValidate]         relax or tighten what counts as legal
  │                                 e.g. "you may add two letters this turn"
  │
  ├── [HOOK: onScore]            modify the payout
  │                                 e.g. "your pots are worth +2"
  │
TURN_END
```

Four hooks covers a very wide space of powers — offensive (mutate the word), defensive (escape a bad
position), economic (change the payout), and temporal (change the clock). Most powers anyone invents
will land in one of these. **Build the hooks; leave the powers empty.**

## 5. Character select screen

Sits between Mode Select and Game. See `ui-ux.md` §3 for where it lands in the flow.

```
┌──────────────────────────────────────────────────────────┐
│                  CHOOSE YOUR BEAST                        │
│                                                            │
│    🐀    🐂    🐅    🐇    🐉    🐍                        │
│    RAT   OX   TIGER RABBIT DRAGON SNAKE                   │
│                                                            │
│    🐎    🐐    🐒    🐓    🐕    🐖                        │
│   HORSE  GOAT MONKEY ROOSTER DOG  PIG                     │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🐓  ROOSTER                                        │  │
│  │  PECK — Once per round, remove a letter from the    │  │
│  │  word before playing your own.                      │  │
│  │  [ placeholder — not yet implemented ]              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│              [ CONFIRM ]                                   │
└──────────────────────────────────────────────────────────┘
```

- 3×4 or 6×2 grid of all twelve. All unlocked — no progression in the prototype.
- Hover/focus shows the detail panel: name, power, and — while powers are stubs — **an explicit
  "not yet implemented" tag.** Don't quietly ship 12 identical beasts and let playtesters wonder why
  the Dragon feels the same as the Pig. Being honest about the stub costs one line of text and saves
  a QA cycle.
- **The AI picks too**, and its choice should be visible before the match starts. Random is fine for now.
- Confirm → Game.

## 6. Open

- **Do both players' powers need to be different?** Mirror matches (Rooster vs Rooster) are the easy
  default; forcing distinct picks is a small rule with real consequences.
- **Is 12 too many?** Twelve balanced powers is a *lot* of design and QA. Consider designing 3–4 properly,
  playtesting those, and only then filling out the roster. The zodiac framing is strong enough that
  shipping cosmetic-only beasts alongside a few powered ones is defensible.
- **Do powers make the game unsolvable for the AI?** They expand the state space (the AI must now search
  over "should I peck?"), but since powers are once-per-round and deterministic, the state just gains a
  couple of flags: `(alphagram, sideToMove, p0PowerUsed, p1PowerUsed)`. Still very tractable.
  `ai-opponent.md` §1 holds.
- **Does the AI know how to *use* a power?** Not for free. Each power needs to be taught to the search.
  Another reason to design few powers, well.

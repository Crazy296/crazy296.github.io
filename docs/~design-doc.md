# Spelling Beasts

*A fast-paced letter-rearranging competition.*

**Team**
- Austin — Programming
- Joey — Game design and QA consultant
- Jakey — QA and data analytics consultant

**Status:** **Playable prototype (M2).** Dictionary, rules engine, and a playable game with an AI
opponent, character select and three difficulty tiers. Not yet playtested by humans — that is the next
thing that happens, and it is what M2 exists for. See [roadmap.md](roadmap.md).
**Platform:** HTML5 / PixiJS v8 (from the PixiJS Creation Template).

> **New here? Read this document, then [rules-spec.md](rules-spec.md).** Everything else is detail.

---

## 1. The pitch

A letter appears. You add one letter to it and rearrange the whole thing into a real word. Your
opponent does the same. Back and forth, the word grows — `F` → `IF` → `FIX` → `FIXT` → `FIXIT` →
`FIXITY` — until someone plays a word that *cannot be extended*.

Whoever added that last letter takes points equal to the length of the final word. Six, here.

First to 100 wins.

> *This is the original design doc's example, **corrected**. It claimed `FIXT` was a dead end worth 4;
> ENABLE disagrees — `FIXT` → `FIXIT` → `FIXITY`. See [dictionary.md](dictionary.md) §6. It's a better
> example now: after `FIX`, Possible Words reads **1** and stays there. A single-file corridor with one
> exit at every step — both players can see the end coming four moves out and neither can do a thing
> about it.*

## 2. Why it works

The game is **GHOST inverted**. In GHOST, completing a word loses. Here, being the last player
standing *wins* — and the pot is the length of the word you strand your opponent on.

That inversion creates the whole game in one line of tension:

> **Dead-end now for a small pot, or extend and risk handing the pot to your opponent?**

You could play a two-letter word with no extensions and instantly bank 2 points. It's legal.
It's also nearly worthless — you need 100. To score meaningfully you have to keep the word alive,
which means keeping it alive *for your opponent too*. Every letter you add is a letter they get
to use against you.

The **Possible Words counter** is what turns that tension into a readable decision instead of a
guess. It's public information: both players can see how many valid extensions remain. Watching it
fall — 340, 71, 12, 3 — as the word gets longer and the noose tightens is the core drama of a round.

## 3. Design pillars

**1. Easy in, deep down.**
The rules fit on an index card. Add a letter. Make a word. That's it. But knowing *which* letter
strands your opponent two moves from now is a skill ceiling you can climb for months.

**2. The counter is the game.**
Possible Words is not a HUD stat, it's the tension meter. It should be the second-largest thing
on screen after the word itself, and it should *react* — pulse when it drops hard, flash red when
it's low, go still and cold when it hits 1.

**3. Rearranging is the proof.**
You don't just pick a letter — you have to *show* you know the word. See §5.

**4. The clock is a real opponent.**
45 seconds is generous when there are 300 options and cruel when there are 3. The timer applies
the same pressure to both players and it never stops being scary.

## 4. Core rules (summary)

The complete, unambiguous specification — including every edge case and the exact timeout
semantics — lives in **[rules-spec.md](rules-spec.md)**. This is the index-card version.

- A **seed letter** is drawn. It is *not* a word — it's just a starting letter. (Not uniform A–Z; a
  `Q` seed is a dead round. Weighted by how extendable each letter is.)
- Players alternate turns. On your turn you must produce a word that uses **every letter currently
  in play, plus exactly one new letter**, in any order.
- Each submission must be a real word (see §6). The word grows by exactly one letter per turn.
- **45-second turn timer**, reset at the start of each turn. A **Skip Turn** button sets it to 0.
- **Round ends** when the word cannot be extended. The player who added the last letter scores
  points equal to the **length of the final word**.
- **On a timeout**, the last player to have added a letter scores the current word's length — but
  the round *continues* from the same word, and **the turn passes to the player who just scored**.
  Two timeouts in a row end the round.
- **First to 100 points wins the match.**

### The claim model

The original design doc's two worked examples encoded a subtler timeout rule than its prose stated.
The reading that reproduces **both examples exactly** — and closes an infinite-points exploit where a
player who simply never moves prints points forever for their opponent:

> **A word can only be cashed once per letter added to it.**

Adding a letter makes the word *unclaimed*. A timeout *claims* it for the last adder. A timeout on an
already-claimed word ends the round paying nothing. Full trace in [rules-spec.md](rules-spec.md) §4.1 —
**write that trace as a unit test on day one.**

### The dead-end question

Dead-ending is a legal and deliberately *unpatched* strategy. We considered a minimum word length
and a dead-end scoring penalty, and rejected both for the prototype: points scale with length, so
cheap dead-ends are self-limiting, and the race to 100 rewards players who extend. **We playtest
before we patch.** If it turns out to be degenerate, [rules-spec.md](rules-spec.md) §7 lists the levers
in the order we'd pull them.

### Skip is not just an escape hatch

Skipping hands your opponent `length(word)` points — but if every move available to you leaves them a
position they can dead-end for *more* than that, conceding the smaller pot is correct. Skip is a
resignation with a price tag, and reading when to pay it is real skill. Worth protecting.

## 5. The rearranging problem (important)

Here is a thing that is easy to miss and expensive to get wrong.

**Letter order does not matter mechanically.** Whether `MEN` + `A` is valid depends only on whether
*some* arrangement of `{A,E,M,N}` is a word — it is, several: `AMEN`, `MANE`, `MEAN`, `NAME`. A turn
is therefore *fully described by which letter you add*. Nothing else.

Which means: **if the UI arranges the letters for you, there is no game left.** You'd be picking
from 26 buttons with a green light on the legal ones. All skill evaporates.

So rearranging must be a **demonstration**, not a formality. The player has to physically produce
the arrangement, because doing so is the proof that they actually knew the word. This is the single
most important constraint on the interface.

But it collides with pillar 4: **a 45-second clock and drag-and-drop tiles are natural enemies.** If
producing `MANE` takes twenty seconds of fiddly mouse work, the timer measures *dexterity*, not
vocabulary. That's a different, worse game.

**The resolution: type to arrange, tiles to see.** The word renders as physical tiles — that's the
game's face — but the player can simply *type* the word they want, and the tiles fly into that
arrangement. Dragging remains available for people who think with their hands. Both paths are still a
demonstration; typing is just a faster input device for the same act. Full interaction design in
**[ui-ux.md](ui-ux.md)** §2.

> **Never build:** a shuffle-to-valid-word button, an auto-arrange, or an anagram helper. It feels
> helpful. It ends the game.

## 6. The dictionary

**ENABLE** (~172,000 words). Public domain, no licensing risk, and the same list behind Words With
Friends. Big enough that genuinely obscure plays like `FIXT` are valid, which the game needs — a
thin dictionary means shallow rounds and a Possible Words counter that's always near zero.

Everything — validation, the counter, and the AI — runs off one precomputed **alphagram map** (words
keyed by their sorted letters). Because the game asks *multiset* questions, not *prefix* questions,
this makes every query the game needs a fixed **26 hash lookups**, regardless of word length or
dictionary size. **Do not build a trie** — it's the natural instinct and it's the wrong tool.

Details, build pipeline, and payload budget (~500–600 KB gzipped) in **[dictionary.md](dictionary.md)**.

## 7. The Beasts

Before a match, you choose one of **twelve beasts — the Chinese zodiac animals** (Rat, Ox, Tiger,
Rabbit, Dragon, Snake, Horse, Goat, Monkey, Rooster, Dog, Pig). Each has a **power**, usable **once per
round**.

Example: the **Rooster** can *peck* — remove a letter from the word before adding its own. `MEN` →
peck the `N` → play `T` → `MET`.

**Powers are placeholders for now**, and deliberately so. But note what that Rooster example does: the
word went from three letters to three letters. It **didn't grow**. That breaks the one invariant the
entire rules engine is built on, and it cascades:

- a turn is really *"remove k letters, then add one"*, where k is normally 0;
- the pot can now **shrink** — Peck deflates the prize your opponent was about to claim;
- Peck can **reopen a dead end**, rescuing a player from a round they had already lost;
- words that can shrink mean rounds are **only guaranteed to terminate** by the once-per-round limit.
  That limit is a *correctness* requirement, not a balance knob.

So powers are not a feature layer — they reach into the state machine. **Build the hooks now, design
the powers later.** Four hooks (`onTurnStart` / `beforeSubmit` / `onValidate` / `onScore`) cover
offensive, defensive, economic and temporal abilities; stubbing them costs almost nothing now and
retrofitting them means rewriting the reducer.

Roster, power contract, hook points, and the character select screen: **[characters.md](characters.md)**.

## 8. Modes

**Prototype ships solo vs AI.** One person at the keyboard, which is what we need to tune the timer,
the scoring, and the difficulty curve. It's also where the interesting design work is: the AI's
word-picking is a genuine strategy problem, not a stub.

The rules engine is built **opponent-agnostic** from day one — an `Opponent` is anything that can
answer "what's your move?". Solo is `[Human, AI]`; hot-seat is `[Human, Human]` and costs us nothing;
**headless `[AI, AI]` is how we balance-test the whole game** (§10). Online multiplayer is explicitly
out of scope.

Worth knowing: **this game is solvable.** Perfect information, ~12 plies deep, and since order doesn't
matter the state is just `(alphagram, sideToMove, powersUsed)` — which transposes hard and memoises
beautifully. A perfect AI is achievable in milliseconds. So difficulty isn't "how strong can we make
it", it's **"how do we handicap it convincingly"** — and the answer is *vocabulary size*, not
randomness. Strong word-game players don't calculate deeper; they know more words. See
**[ai-opponent.md](ai-opponent.md)**.

## 9. Player flow

```
TITLE ──▶ MODE SELECT ──▶ CHARACTER SELECT ──▶ GAME ──▶ ROUND END ──▶ (loop) ──▶ MATCH END
                          pick 1 of 12 beasts             │
                                                          └──▶ new seed, other player starts
```

Layouts in **[ui-ux.md](ui-ux.md)**. Screen-to-module mapping in **[architecture.md](architecture.md)**.

## 10. The two risks that could sink this

Named here because the [roadmap](roadmap.md) is ordered around them, and because **nothing gets
polished until both are answered.**

**1. Cheap dead-ending might be degenerate.**
If the optimal line is "play a 2-letter dead-end, bank 2, repeat", the game is broken. Points scaling
with length *should* make it self-limiting — but nobody has checked.
→ **Answered by the headless AI-vs-AI balance sim (M3).** Which also tells us the thing nobody has
asked yet: *how long is a match?* If rounds average 4 points, first-to-100 is **25 rounds**. That could
be a 40-minute game. `TARGET_SCORE` may move.

**2. Tile input might be too slow for a 45-second clock.**
§5's mitigation should handle it, but only a human in front of the game can confirm it.
→ **Answered by the first playtest (M2).**

## 11. Document map

| Doc | What's in it |
|---|---|
| [rules-spec.md](rules-spec.md) | **The authoritative rules.** Every edge case, the state machine, the claim model. Build to this. |
| [characters.md](characters.md) | The twelve zodiac beasts, the power contract, the hook points, character select. |
| [dictionary.md](dictionary.md) | ENABLE, the alphagram map, the Possible Words counter, build pipeline, payload budget. |
| [ai-opponent.md](ai-opponent.md) | Difficulty tiers, search, and making the AI feel human. |
| [ui-ux.md](ui-ux.md) | Screens, the tile interaction, the counter, game feel, the beasts on screen. |
| [architecture.md](architecture.md) | How this maps onto the PixiJS template. Module layout. Why powers are engine-level. |
| [roadmap.md](roadmap.md) | M0–M7, risk-ordered. And what we're deliberately *not* building yet. |
| [open-questions.md](open-questions.md) | Decided, resolved, and unresolved. **Read before re-litigating a rule.** |

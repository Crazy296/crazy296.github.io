# Decided, Deferred, and Unresolved

Read this before re-litigating a rule. If something here is wrong, change it *here* and say why.

---

## Decided

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Word list | **ENABLE (~172k)** | Public domain, no licence risk, matches casual-player expectations, big enough for deep trees. `dictionary.md` §1 |
| D2 | Input method | **Tiles, with type-to-arrange as the fast path** | Tiles are the game's face; typing keeps the 45s clock strategic instead of a dexterity test. `ui-ux.md` §2 |
| D3 | Prototype scope | **Solo vs AI**, on an opponent-agnostic core | One person can playtest it; the AI is where the design work is. Hot-seat is then ~free. `architecture.md` §4 |
| D4 | Cheap dead-ending | **Leave it unpatched for now** | Points scale with length, so it's self-limiting in a race to 100. **Playtest before patching.** Levers listed in `rules-spec.md` §7 |
| D5 | Timeout semantics | **The claim model** — a word can only be cashed once per letter added | It's the only reading that reproduces *both* worked examples in the original design doc, and it closes an infinite-points exploit. `rules-spec.md` §4 |
| D6 | Data structure | **Alphagram map, not a trie** | The game is a multiset question, not a prefix question. Makes everything 26 hash lookups. `dictionary.md` §2 |
| D7 | Seeding | **Weighted by extension count**, not uniform A–Z | A `Q` seed is a dead round; a seed with no 2-letter words is a no-score round. `rules-spec.md` §6 |
| D8 | Characters | **12 zodiac beasts**, chosen at a Character Select screen, emoji placeholders | The name was promising something; now it delivers. `characters.md` |
| D9 | Powers | **Once per round. Build the hooks now, design the powers later.** | Peck breaks the growth invariant — powers are engine-level, not a feature layer. Retrofitting = rewriting the state machine. `architecture.md` §3.1 |

## Resolved ambiguities in the original design doc

Things the original prose left genuinely underdetermined. Flagged rather than silently assumed — if any
of these resolutions is wrong, they're cheap to change *now* and expensive later.

**A1 — Is the seed letter a word?**
No. It's a starting letter. The first submission is a 2-letter word containing it. (The doc's `F` example
confirms this — `F` isn't a word.)

**A2 — When is a dead end detected?**
At the **start** of a turn, not on submission. So a player who plays a dead-end word scores *immediately*;
the opponent never sits there burning 45 seconds on an impossible position. The doc's `FIXT` example is
ambiguous about this but immediate scoring is obviously the better game. `rules-spec.md` §3.

**A3 — After a timeout, whose turn is it?**
The **scorer's** — i.e. the player who did *not* time out extends their own word. This follows directly
from the doc's `ME → MEN` example ("*Player 1 ... gets to go again*"). It's unintuitive on first read but
it's what makes stalling self-harming rather than exploitable. `rules-spec.md` §4.

**A4 — Does a timeout end the round?**
**No.** The word persists and play continues. Only a *second consecutive* timeout ends it. This is the
core of the claim model (D5).

**A5 — Can you score twice off the same word?**
No — that's the whole point of `claimed`. Without it, a player who simply never moves would print
infinite points for their opponent.

**A6 — What if the very first player times out on the bare seed?**
Nobody scores — there's no adder to pay. Turn passes; the seed stands. The original doc doesn't cover
this. `rules-spec.md` §4.

**A7 — Do invalid guesses cost anything?**
Only time. No penalty, no attempt limit. Watch for players brute-forcing the validator; probably fine.

**A8 — `FIXT` is not a dead end.** *(found in M0 — the original design doc's worked example was wrong)*
ENABLE continues the line: `FIXT` → `FIXIT` → `FIXITY`, which *is* the dead end. So the example round is
worth **6 points, not 4**, and Player 1 would not have scored where the doc says they did. All docs now
use the corrected line. It's a better example anyway — after `FIX` the Possible Words counter reads 1 and
stays there, a single-file corridor with one exit at every step. See `dictionary.md` §6.
**Lesson: don't hand-author worked examples against a 172k-word dictionary. Check them.**

**A9 — Four letters cannot be seeded at all.** *(found in M0)*
`C`, `Q`, `V` and `Z` have **zero** 2-letter words in ENABLE. Seeding one doesn't make a bad round, it
makes an *unplayable* one — the opening player has no legal move. Uniform A–Z would have dealt one
~15% of the time. They're weighted 0 and never drawn. `rules-spec.md` §6.

**A10 — When is the win checked?** *(decided in M1)*
`rules-spec.md` §5 put the win check at **round end**. But a timeout pays out *mid-round* — so a player
could cross 100 on a timeout and then be forced to keep playing a round they've already won. The engine
checks after **any scoring event** and ends the match immediately. That's snappier, and it's what "first
to 100 wins" literally says. **This is a change to the spec; flagging it rather than burying it.**

**A11 — The clock is not in the game state.** *(decided in M1)*
`architecture.md` §3 originally had `turnEndsAt: number` in `GameState`. It's gone. A pure reducer that
reads `Date.now()` isn't pure, isn't testable, and can't be replayed by the balance sim — which is the
one tool that answers our biggest open risk. The clock lives in the presentation layer, which dispatches
`{kind:"timeout"}` when it expires. **Skip Turn dispatches the identical move** — which is exactly what
`rules-spec.md` §4 says they are.

**A12 — Possible Words is an order of magnitude smaller than we designed for.** *(found in M2)*
`ui-ux.md` §5 is written around a counter that falls **340 → 71** and shows `▼ 269`. Measured against the
real dictionary, no such number exists anywhere in the game. The doc's own example reads:

| | M | ME | MEN | MANE | MANES |
|---|---|---|---|---|---|
| Possible Words | 12 | 16 | **14** | 27 | 28 |

Over 400 random rounds, the median counter by word length is `1→12, 2→23, 3→14, 4→8, 5→5, 6→4, 7→3, 8→2`.
The all-time maximum observed was **103**. A fresh seed is a *median of 7* — and `J` and `K` seeds have
exactly **one** possible word.

Three consequences, none of them fatal but all of them load-bearing on Pillar 2:
1. **The colour bands were wrong** and painted turn one bright red. Retuned to a guess (red ≤ 12, amber ≤ 60);
   they need real data.
2. **"Animate the drop" has nothing to drop.** The counter *rises* from 1→2 letters, then trickles down in
   single digits. The tick-down animation is doing almost no work.
3. **The drama, if it exists, lives in the last two turns** — the 5 → 2 → 1 collapse — not in a long fall.

*This is a design question, not a bug: does the tension meter need a different scale (a proportion? a
"turns left" estimate?), or is a small integer counting down to 1 actually the more legible drama? Answer
with the M2 playtest and M3's sim.* **It changes `ui-ux.md` §5.**

## Unresolved — needs a decision or a playtest

**U1 — Is 45 seconds right?**
Suspect it's *long*. When there are 300 options you know your move in 4 seconds and then sit there. When
there are 3, 45s is agony in a good way. **Idea worth testing:** a shot-clock that scales with Possible
Words — more options, less time. Might be too clever. *Answer with: M2 playtest + M3 sim.*

**U2 — Should Possible Words show a per-letter breakdown?** (`A:12 B:0 C:3 …`)
It hands you the dead-end letters directly — an enormous hint. Probably an **assist/difficulty setting**,
definitely not the default. *Needs a design decision, not a playtest.*

> **It exists in M2, as a debug tool.** Pick the **Dragon** and its "Dragon's Eye" lights up every letter
> in the A–Z rack that makes a real word (`BARQUES` → `O` for BAROQUES, `U` for ARQUEBUS), with a count.
> It's `dictionary.extensionsByLetter()` painted onto the rack, recomputed each keystroke.
>
> **This is not an answer to U2 and it is not a power.** It's a development tool for checking the
> dictionary and the dead-end logic against a real board, and it is deliberately quarantined:
> - `roster.ts` marks it `debug: true` and leaves `implemented: false`, so **the reducer still rejects it
>   as a power activation.** It lives entirely in the presentation layer; the engine cannot tell the Dragon
>   apart from the other eleven stubs, and the AI never sees it.
> - Character Select says `[ DEBUG TOOL — not a real power. It shows you the answer. ]` in red, and the
>   in-match beast reads `Dragon's Eye [DEBUG]`. A playtester cannot be handed it by accident.
>
> Shipping it as a *real* assist mode is still the open design question — and it's a big one, because a
> move IS a letter choice (`~design-doc.md` §5), so this reveals the entire turn, dead ends included.
> **Do not promote it by deleting the debug tag.** If we want an assist mode, design it (U2), and give the
> Dragon a real power in M6.

**U3 — The obscure-word problem.** — **MOSTLY ANSWERED (M2).**
`ZA`, `QI`, `AALII` are all valid ENABLE words and losing to one feels like the game cheated. The best fix
is restricting *the AI's* vocabulary by frequency tier (`ai-opponent.md` §4), which conveniently doubles as
the difficulty system.

**Built.** `npm run build:dict` now joins a frequency list against ENABLE → `public/vocab.txt`, 31,911
ranked words. Easy knows the top 5,000, Medium the top 30,000, **Strong knows all 152,405 and is the only
one that can hit you with AALII.** So the obscure-word complaint is now a *property of the top tier*, which
is a defensible place for it to live.

What's still open: **Strong is the tier that feels like cheating**, and it's also the only tier with no
handicap. When the M4 minimax lands, Strong becomes both smarter *and* still fluent in AALII. We may want
the top tier capped at, say, 60,000 words and let the *search* be the difficulty instead. *Playtest first.*

**U4 — Where are the beasts?** — **ANSWERED.**
The twelve Chinese zodiac animals, chosen at a Character Select screen, each with a once-per-round power.
Emoji placeholders; powers TBD. See `characters.md`. Art direction still open but unblocking.

**U5 — Match length.**
Nobody has checked whether first-to-100 is a 5-minute game or a 40-minute game. If rounds average 4 points,
100 is **25 rounds** — that could be far too long. *M3's sim answers this immediately, and it may move
`TARGET_SCORE`.*

**U6 — Does the game need a mercy rule?**
If Hard AI is genuinely unbeatable (`ai-opponent.md` §1 — this game is solvable), a losing player grinding
to a 100–12 defeat is miserable. *Probably a scope question for later, but worth knowing it exists.*

**U7 — Is Peck too strong?**
It can *reopen a dead end* — i.e. rescue a player from a position that would otherwise have ended the round
and paid their opponent. That's not a small ability; it may be the single most powerful thing in the game.
It also *shrinks the pot*, which is a lovely defensive counterplay. Both instincts are good; the numbers are
unknown. *Answer with: the M3 sim, re-run with powers on. Peck is the first power to build precisely because
it stresses every hook.* `characters.md` §3.

**U8 — How many powers do we actually design?**
Twelve balanced powers is a *lot*. Recommendation: design 3–4 properly, playtest, then fill the roster.
Cosmetic-only beasts are fine as long as the select screen is honest about it. *Needs a call from Joey and
Austin.*

**U9 — Mirror matches?**
Can both players pick the Rooster? Easy default is yes. Forcing distinct picks is a one-line rule with real
consequences for how the AI's choice is presented. *Undecided.*

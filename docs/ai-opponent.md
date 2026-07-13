# The AI Opponent

---

## 1. The uncomfortable fact: this game is solvable

Spelling Beasts is a finite, perfect-information, deterministic combinatorial game. There is no
hidden state and no randomness after the seed is drawn. The word grows by exactly one letter per
turn, and ENABLE runs out around 12–15 letters, so a round is **at most ~12 plies deep**.

The state that matters is just **the alphagram of the word in play plus whose turn it is** — order is
irrelevant (`dictionary.md` §2), so `MEAN`, `NAME`, and `AMEN` are the *same node*. That collapses
the tree enormously. With memoisation on `(alphagram, sideToMove)`, a full minimax from any position
is not just feasible, it's fast.

**So we can build a perfect player.** Which means the AI's difficulty is not a question of *how strong
can we make it* — it's a question of **how do we handicap it so it's fun to play against.** That's a
much better problem to have, and it should shape how we write this: build the solver first, then
degrade it deliberately.

## 2. What the AI actually has to do

```
requestMove(state) → { letter, word } | SKIP
```

1. Enumerate every legal extension — 26 lookups (`dictionary.md` §2). Cheap.
2. Choose one, per the difficulty policy below.
3. Return it *after a believable delay* (§5).

Note it may also choose to **skip**, and at high difficulty it genuinely should — `rules-spec.md` §4.2
shows conceding a small pot is sometimes correct. An AI that never skips is leaving points on the table
and, worse, is failing to teach the player that skipping is an option.

## 3. Difficulty tiers

> **WHAT IS ACTUALLY BUILT (M2).** The three tiers below describe *search*. **None of that search exists
> yet** — the bot behind all three tiers is M1's `RandomAi`, which plays a uniformly random legal word.
> The tiers we ship differ by **vocabulary** (§4 lever 1) and **timeout rate** (§4 lever 3):
>
> | Tier | Knows | Times out | Stuck at 5 letters | Stuck at 7 |
> |---|---|---|---|---|
> | **Easy** | 5,000 words | 15% | **69%** of positions | 92% |
> | **Medium** | 30,000 words | 5% | 27% | 56% |
> | **Strong** | all 152,405 | 2% | **0%** | 0% |
>
> "Stuck" = it knows no legal word and must let the clock run, which **pays the pot to the player**. That
> is the entire handicap, and it is why Easy is beatable without ever playing a deliberately bad move.
> Measured head-to-head over 200 matches: **Easy beats Medium 0% of the time; Medium beats Strong 0%.**
> Strength is strictly monotonic in words known.
>
> The search tiers below are M4. When minimax lands, Strong gets a brain and this table gains a row.

### Easy — "plays words, not strategy"
- Pick a **random** legal extension, weighted toward **common/short** words.
- **Sometimes just time out** (~15% of turns), which hands the player points. This is the single most
  effective difficulty lever we have and it costs nothing.
- No lookahead whatsoever. Will happily hand the player a dead-end.

### Medium — "doesn't fall for it"
**1-ply lookahead.** For each candidate extension, ask: *does this hand my opponent a word they can
immediately dead-end for a big pot?*
- Reject any move where `PossibleWords(candidate) == 0` — that's playing a dead-end *into* the
  opponent's turn, which just gives them the points. (Careful: a move to a dead-end word means **the
  AI scores**, since the AI was the adder. So the AI should *seek* these, not avoid them. The thing to
  avoid is a move that leaves the *opponent* a position from which *they* can dead-end.)
- Prefer moves that keep the AI's own options open — high `PossibleWords`.
- Take an immediate dead-end when the pot is worth it.

This tier is where most players will live, and it should feel like a competent human.

### Hard — "solved"
**Full minimax with memoisation** on `(alphagram, sideToMove)`. Terminal value = the points paid out,
signed for the AI. Includes skip as a candidate move.

Because the state space is small and heavily transposed, this should search to the end of the round in
milliseconds. Cache the memo table across turns *within* a round — the tree only shrinks.

**Hard will beat every human.** That's fine and correct for a top tier, but it means the fun has to
come from somewhere else — see §4.

## 4. Handicapping honestly

The temptation with a solved AI is to make it *dumber*. Resist. A perfect player that occasionally
plays a random move feels **erratic and cheap**, not weaker — players notice the inconsistency and it
reads as the game cheating.

Better levers, roughly in order of how good they feel:

1. **Restrict the AI's vocabulary.** Give each tier a word-frequency cutoff. Easy AI knows 5,000 words;
   Medium knows 30,000; Hard knows all of ENABLE. This is *exactly how human skill actually varies* —
   strong word-game players don't calculate deeper, they **know more words**. It produces an AI that is
   beatable in a way that feels like beating a person, and it solves the obscure-word complaint from
   `dictionary.md` §5 at the same time. **This is the one to build.**
2. **Search depth cap.** Medium searches 2 plies, Hard searches to the end. Clean, but less flavourful
   than the vocabulary lever.
3. **Timeout rate.** Easy sometimes just runs out of clock. Very effective, very cheap, and it's
   *believable* — humans do this constantly.
4. **Suboptimal-but-reasonable selection.** Pick the 2nd- or 3rd-best move rather than a random one.
   Weaker without looking broken.

## 5. Making it feel like a person

The AI knows its move in under a millisecond. Do not let it play in under a millisecond.

- **Think time should scale with the position.** Long pause when Possible Words is low and the position
  is genuinely hard; quick play when there are 300 options. This is what a human does, and faking it
  makes the AI legible — the player *reads the AI's hesitation as information*, which is a small free
  gift of drama.
- **Never instant, never the full 45s** (unless it's deliberately timing out). Something like 3–12s,
  jittered.
- **Show it "thinking."** The beast animates, the tiles shuffle. See `ui-ux.md`.
- When the AI plays a word the player probably doesn't know, **that's the moment to show a definition**
  rather than at round end. Turns a frustration beat into a delight beat.

## 6. Interface

Kept deliberately narrow so hot-seat two-player is the same shape (`architecture.md`):

```ts
interface Opponent {
  requestMove(state: GameState, signal: AbortSignal): Promise<Move>;
}
```

- `AiOpponent` implements the above with a difficulty config.
- `HumanOpponent` resolves the promise when the player hits Submit.
- The game loop cannot tell them apart. Hot-seat is then free, and so is an AI-vs-AI mode — which,
  incidentally, is how we should **balance-test the scoring**: run 10,000 headless AI-vs-AI matches
  and look at round lengths, dead-end frequency, and whether cheap dead-ending is actually degenerate
  (`rules-spec.md` §7). Jakey — this is your data pipeline, and it falls out of the architecture for
  free.

## 7. Open

- ~~Do we need a word-frequency list for the vocabulary tiers?~~ **DONE (M2).** `data/en-frequency-50k.txt`
  (hermitdave/FrequencyWords, OpenSubtitles 2018), joined against ENABLE by `npm run build:dict` into
  `public/vocab.txt` — **31,911 ranked words, 118 KB gzipped.** A tier is a prefix of that list.
  **⚠️ LICENCE: that list is CC BY-SA 4.0 (share-alike).** ENABLE is public domain and D1 picked it partly
  *because* there was no licence risk. Fine for a prototype; **someone has to make a call before we ship**,
  and swapping the source is a one-line change in `build-dictionary.ts`.
- **Is Easy too easy?** It is stuck 69% of the time at five letters — it will hand a player pot after pot.
  That may be exactly right for a first-timer, or it may feel like the game is throwing the match.
  *Playtest it.*
- Should the AI's difficulty adapt mid-match if it's crushing the player? Auto-balancing is tempting
  and usually feels patronising. Default: no.

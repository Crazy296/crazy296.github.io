# Technical Architecture

How Spelling Beasts maps onto the PixiJS Creation Template already in this repo.

---

## 1. The one rule

**The game logic must not import Pixi.**

`src/game/` is pure TypeScript: dictionary, rules, AI. No `PIXI`, no DisplayObjects, no rendering. It
takes a state and a move and returns a new state.

This is not architectural purity for its own sake. It buys three concrete things:

1. **The rules are testable** without a renderer. Word-game rules are exactly the kind of thing that has
   nasty edge cases (the claim model in `rules-spec.md` §4 being the obvious one), and they need real
   tests.
2. **The AI can run headless.** Which means we can run 10,000 AI-vs-AI matches in a Node script to
   answer "is cheap dead-ending degenerate?" empirically instead of arguing about it
   (`ai-opponent.md` §6). Jakey's data pipeline depends on this line.
3. **The renderer becomes replaceable and the game becomes portable.** Not a goal, but it's free.

Presentation lives in `src/app/`, reads from game state, and sends moves in. One direction.

## 2. Layout

**As built through M2.** Items marked *(planned)* do not exist yet.

```
src/
  game/                    ← pure logic, zero Pixi
    alphagram.ts           the sort-letters primitive. Trivial, used everywhere.
    dictionary.ts          alphagram map — isValid(), extensions(), possibleWords(), isDeadEnd()
    vocabulary.ts          the frequency-ranked list. A difficulty tier is a prefix of it.
    rules.ts               GameState, the reducer, the state machine from rules-spec §8.
                           Also scoreFor() and drawSeed() — they were one-liners, so the
                           planned scoring.ts / seed.ts never earned their own files.
    rng.ts                 seeded mulberry32. Injected everywhere; the sim must replay.
    opponent.ts            the Opponent interface — the seam (§4)
    human.ts               HumanOpponent — resolves when the player hits Submit
    types.ts
    beasts/
      roster.ts            the 12 zodiac beasts — id, name, emoji, power
                           (the Dragon carries a DEBUG tool, not a power — open-questions U2)
      powers.ts            the Power interface + the four hooks (characters.md §4)
                           STUBS. The hooks are real; the powers aren't.
    ai/
      ai.ts                RandomAi — random legal word, optional vocabulary restriction
      difficulty.ts        Easy / Medium / Strong (ai-opponent.md §3)
      search.ts            (planned, M4) memoised minimax

  app/
    dictionary.ts          loads dict.txt + vocab.txt once, at boot (§5)
    match.ts               what Character Select hands to Game: beasts, difficulty, seed
    screens/
      TitleScreen.ts       (was the template's MainScreen)
      CharacterSelectScreen.ts   the 12-beast grid + difficulty (characters.md §5)
      LoadScreen.ts        (template's)
      game/
        GameScreen.ts      orchestrates: owns GameState, the clock, and the game loop
        Tile.ts            one letter tile
        TileRow.ts         a centred row of tiles that slides between arrangements
        InputRow.ts        the player's arrangement — drag to reorder
        LetterRack.ts      the unplaced letters + the A–Z picker
        PossibleWordsMeter.ts   the tension meter (ui-ux §5)
        TurnTimer.ts       the clock. It lives HERE, not in GameState (A11).
        BeastView.ts       (ui-ux §6)
        ScoreBar.ts
        EndOverlay.ts      round end & match end — a beat, not a screen (ui-ux §3)
    popups/                (template's Pause/Settings — kept)
    ui/                    (template's Button/Label/RoundedBox — reuse, don't reinvent)

  engine/                  ← template's engine. Do not touch.

scripts/
  build-dictionary.ts      ENABLE → alphagram map + seed weights → public/dict.txt
                           ENABLE ∩ frequency list → public/vocab.txt (the AI's vocabulary)
  verify-dictionary.ts     M0 acceptance — npm run verify:dict
  verify-rules.ts          M1 acceptance — npm run verify:rules
  balance-sim.ts           (planned, M3) headless AI-vs-AI, N matches, dumps CSV

data/                      committed inputs
  enable1.txt              the raw ENABLE word list (public domain)
  en-frequency-50k.txt     word frequencies (CC BY-SA 4.0 — see README)

public/
  dict.txt                 built artefact, NOT committed — run `npm run build:dict`
  vocab.txt                built artefact, NOT committed
```

**No `ModeSelectScreen`.** The flow in `ui-ux.md` §3 has one, but the prototype has exactly one mode, so
it would be a screen with a single button on it. Title goes straight to Character Select. It lands when
there is a second mode.

**No `RoundEndScreen`.** Round end is a *beat*, not a screen you dismiss (`ui-ux.md` §3) — it's an
overlay inside `GameScreen` that auto-advances.

## 3. Game state

```ts
type PlayerId = 0 | 1;

interface GameState {
  wordInPlay: string;        // the seed letter at round start; normally grows by 1/turn
  adder: PlayerId | null;    // who last added a letter — null at round start
  claimed: boolean;          // rules-spec §4 — has this word already been cashed?
  activePlayer: PlayerId;
  scores: [number, number];
  phase: 'AWAIT_MOVE' | 'ROUND_END' | 'MATCH_END';
  roundStarter: PlayerId;    // alternates each round

  beasts: [BeastId, BeastId];      // chosen at Character Select
  powerUsed: [boolean, boolean];   // once per ROUND — resets on new seed
}

type Move =
  | { kind: 'submit'; word: string; power?: PowerActivation }
  | { kind: 'timeout' };     // Skip and clock-expiry are the same move (rules-spec §4)
```

`claimed` is the field that will get deleted by someone who doesn't understand why it's there. It is
the entire timeout model. `rules-spec.md` §4.1 is the test case — write that trace as a unit test on
day one and it will defend itself.

`applyMove(state, move, dict) → GameState` is a pure function. The state machine in `rules-spec.md` §8 is
the implementation.

**Two things changed when this got built (M1):**

- **No `turnEndsAt`, and no `TURN_START` phase.** A reducer that reads `Date.now()` isn't pure, isn't
  testable, and can't be replayed by the balance sim — the one tool that answers our biggest open risk.
  The clock lives in the presentation layer, which dispatches `{kind:"timeout"}` when it expires; **Skip
  Turn dispatches the identical move**, which is precisely what `rules-spec.md` §4 says they are. And
  `TURN_START` is transient — the dead-end check resolves inside `applyMove`, so a state handed to a
  player is *always* one they can actually move in.
- **Randomness is injected** (`game/rng.ts`, seeded mulberry32). Not for security — for reproducibility.
  "The AI did something mad on seed 12345" has to be replayable.

### 3.1 Powers are not a feature layer — they're in the engine

The obvious instinct is to build the game first and bolt powers on later. **Don't.** The Rooster's Peck
(`characters.md` §3) takes `MEN` → `MET`: the word does not grow. That contradicts the growth invariant
(`length(W') == length(wordInPlay) + 1`) that `rules.ts` is otherwise built around, and it means:

- a turn is really *"remove k letters, then add one"*, where `k` is normally 0;
- the dead-end check must **re-run after a power resolves**, not just at turn start;
- a power can **reopen a dead end**, so "the round is over" is no longer a pure function of the word;
- the word can shrink, so **round termination is only guaranteed by the once-per-round limit.** That
  limit is a correctness requirement, not a balance knob.

Bolting that on afterwards means rewriting the state machine. Building `applyMove` to accept an optional
power activation from day one — with the four hooks stubbed out and doing nothing — costs almost nothing
now. **Do that.**

The AI's memo key gains the power flags: `(alphagram, sideToMove, p0PowerUsed, p1PowerUsed)`. Still very
tractable (`ai-opponent.md` §1).

## 4. The opponent seam

```ts
interface Opponent {
  requestMove(state: GameState, signal: AbortSignal): Promise<Move>;
}
```

- `AiOpponent` — thinks, waits a believable beat, resolves.
- `HumanOpponent` — resolves when the player hits Submit. The `AbortSignal` fires on timeout.

`GameScreen` holds two `Opponent`s and does not know or care which is which. Solo-vs-AI is
`[Human, Ai]`. Hot-seat is `[Human, Human]` and costs us nothing. Headless balance sim is `[Ai, Ai]`
with no `GameScreen` at all.

**Build this seam even though the prototype only ships solo-vs-AI.** It's an interface and two
implementations of a one-method contract — it is genuinely cheaper to do now than to retrofit, and it's
what makes the balance simulator possible.

## 5. Dictionary loading — BUILT (M2)

Two artefacts, fetched **in parallel, once, behind the `LoadScreen`** (`app/dictionary.ts`), then never
thought about again:

| Artefact | Size | What it's for |
|---|---|---|
| `public/dict.txt` | 408 KB gzipped | the alphagram map. **The rules.** |
| `public/vocab.txt` | 118 KB gzipped | frequency-ranked words. **The AI's difficulty only** — it never restricts the player. |

Parsed once into a `Map<string, string[]>` (~230 ms). Do not re-parse, do not lazy-load, do not stream.

They are **plain `fetch()`, not AssetPack**. AssetPack is for textures and audio; these are data files
that Pixi has no opinion about, and routing them through the bundle pipeline bought nothing. They're
gitignored build artefacts — **a fresh clone must run `npm run build:dict` before the game will start**,
and it fails with a message that says exactly that.

## 6. What we reuse from the template, untouched

- `engine/` — navigation, resize, audio, the whole thing. It works. Leave it alone.
- `app/ui/Button`, `Label`, `RoundedBox` — reuse these rather than building new ones.
- `app/popups/PausePopup`, `SettingsPopup` — keep as-is.
- Spine (already a dependency) for the Beasts, whenever art exists.

The template gives us a loading screen, a screen stack, audio, and resize handling for free. The only
genuinely new surface is `GameScreen` and its children.

### ⚠️ `motion` does NOT drive the tiles — and must not

The plan was to use `motion` (already a dependency) for the tile animation. **It was tried in M2 and
pulled back out**, because `motion` does not cancel a running tween when you start a new one on the same
object property. Every keystroke relayouts the tile row, so the tweens raced: tiles were left stranded
between slots, or dragged back to the slot they held one letter ago. It rendered as **letters overlapping
and the word growing rightward instead of staying centred**.

`TileRow.update()` now eases each tile toward exactly one target, driven by the Pixi ticker. A tile has
one destination; there is nothing to race. Same for the invalid-submission shake.

`motion` is still fine for one-shot, non-interruptible things (the load screen fade, popups). **Do not
reintroduce it into anything that re-lays out on input.**

## 7. Testing

- **Unit-test `rules.ts` hard.** Especially: the claim model (`rules-spec.md` §4.1 trace verbatim),
  multiplicity in submission validity (`TOO` → `TOOL` yes, `TOOO` no), the dead-end check firing at
  *turn start* rather than on submission, and `adder == null` timeouts on a bare seed.
- **Property-test the dictionary.** Every word in ENABLE should be `isValid()`. Every extension returned
  should be exactly one letter longer and a superset.
- **The balance sim is the real QA tool.** Round length distribution, dead-end frequency by word length,
  win rate by difficulty, how often a match actually reaches 100. Run it before we tune anything.

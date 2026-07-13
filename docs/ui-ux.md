# UI / UX & Game Feel

---

## 1. The central constraint

From `~design-doc.md` §5, restated because everything below depends on it:

> **A turn is fully described by which letter you add.** Order is mechanically irrelevant. Therefore
> **an interface that arranges the letters for you deletes the game.**

The player must *produce the arrangement themselves*. That act is the proof they knew the word. If we
ever "helpfully" auto-arrange, we've turned Spelling Beasts into a 26-button quiz show with the answers
lit up in green.

This cuts both ways, though, and here's the tension we have to design against:

> **A 45-second clock and drag-and-drop tiles are natural enemies.**

Dragging is slow. If producing `MANE` from `M`,`E`,`N`,`A` takes 20 seconds of fiddly mouse work, the
timer stops being a strategic pressure and becomes an *input-speed* test. That's a different, worse
game. The whole interaction design below is an attempt to keep the *demonstration* while killing the
*fiddling*.

## 2. The solution: type to arrange, tiles to see

**Typing is the fast path. Tiles are the representation.**

- The current word renders as a row of physical letter tiles. That's the game's face — chunky,
  satisfying, animated.
- The player can **just type the word they want.** `M-A-N-E`. The tiles *fly into that arrangement* as
  they type. It's fast, it's zero-friction, and — critically — **it is still a demonstration**, because
  the player had to know and produce `MANE`.
- The player can **also drag tiles** to reorder, and click a letter rack to add the new one. Slower, but
  it's there for people who think with their hands, and for touch devices where typing is worse.

Both paths converge on the same thing: an ordered arrangement the player chose. Neither one hands them
the answer. Typing is just a **faster input device for the same act**, the way a keyboard shortcut is a
faster path to the same menu item.

This is the recommendation. It gives you the tactile tile game you asked for without letting the input
method eat the clock.

### The one thing to never do

Do not add a "shuffle to a valid word" button, an auto-arrange, or an anagram helper. It feels helpful.
It ends the game. (An assist mode for kids/accessibility is a legitimate *separate* conversation — see
`open-questions.md`.)

## 3. Screen flow

```
TITLE ──▶ MODE SELECT ──▶ CHARACTER SELECT ──▶ GAME ──▶ ROUND END ──▶ (loop) ──▶ MATCH END ──▶ TITLE
                                                  │
                                                  └──▶ back to GAME with new seed
```

Maps onto the template's existing `navigation` system — each is a Screen. `MainScreen` becomes
`TitleScreen`; `GameScreen` is the new one and holds essentially all of the work.

**Character Select** — pick one of the twelve zodiac beasts before the match. Full layout and the
power system it fronts are in **[characters.md](characters.md)** §5.

**Round End** should be a *beat*, not a modal to dismiss. The final word lands, the pot counts up into
the winner's score, the beast reacts. 2–3 seconds, auto-advance, skippable.

## 4. Game screen layout

```
┌──────────────────────────────────────────────────────────┐
│  YOU  47                                    AI  38        │  scores
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░  (to 100)                              │
├──────────────────────────────────────────────────────────┤
│                                                            │
│                  ┌───┐┌───┐┌───┐                          │
│                  │ M ││ E ││ N │        ← word in play    │
│                  └───┘└───┘└───┘          (tiles)         │
│                                                            │
│              POSSIBLE WORDS                                │
│                    14                     ← the tension    │
│                    ▼ 9                      meter (§5 —    │
│                                             real numbers   │
│                                             are small!)    │
│                                                            │
│         ┌────────────────────────────┐                     │
│         │  ████████████░░░░░░  0:31  │   ← turn timer      │
│         └────────────────────────────┘                     │
│                                                            │
│   [ your input row / letter rack ]                         │
│                                                            │
│              [ SUBMIT ]      [ SKIP TURN ]                 │
└──────────────────────────────────────────────────────────┘
```

**Hierarchy, in order of size and weight:**
1. **The word in play.** Biggest thing on screen. It's what everyone is looking at.
2. **Possible Words.** Second biggest. Pillar 2 — this is the game's drama, not a footnote in a corner.
3. The timer.
4. Scores.

## 5. Possible Words: make it a character

Mechanically it's an integer. Treat it like a heart-rate monitor.

> ⚠️ **The numbers below are wrong, and M2 measured how wrong.** This section was written around a counter
> that falls 340 → 71. No such number exists in the game: the real counter medians **23** at two letters and
> decays to single digits, `MEN` reads **14**, and the largest value ever observed in 400 random rounds was
> **103**. See `open-questions.md` **A12** — the *principle* below still stands, but the scale, the bands and
> "animate the long fall" all need rethinking against real data. **Don't design to these figures.**

- **Big.** Second-largest element on screen.
- **Animate the drop.** Don't snap. Tick it down fast. The *speed of the fall* is the feeling.
  *(In practice the falls are small — the collapse from 5 → 2 → 1 at the end of a round is where the drama
  actually is.)*
- **Show the delta.** `▼ 9` under the number. The player who just made a move that gutted the tree did
  something *good* and should feel it.
- **Colour by danger.** Comfortable (green) → tightening (amber) → critical (red, pulsing) as it drops.
  *(M2 bands — red ≤ 12, amber ≤ 60 — are a guess. M3's sim has the data to set them.)*
- **At 1, go quiet.** Everything stops. One word left. The whole screen should hold its breath.
- **At 0 the round is already over** — the player never sees a live 0 on their own turn (`rules-spec.md`
  §3). The 0 they see is the round-end payoff.

## 6. The Beasts

The beasts are the **twelve Chinese zodiac animals**, chosen at Character Select, each with a power.
Roster, the power system, and the select screen live in **[characters.md](characters.md)** — that's the
source of truth. What belongs *here* is how they behave on the game screen.

- **Each player has a beast** flanking the board. The AI's beast is its face.
- **The beast reacts** — to a big word, to the counter dropping, to running low on clock, to winning a
  pot. Idle / thinking / smug / panicking / triumphant. Five states and a handful of animations buys an
  enormous amount of personality.
- **The beast is the AI's tell.** When the AI "thinks" (`ai-opponent.md` §5), the beast is what's
  thinking. Its hesitation reads as information.
- **Powers fire *from* the beast.** A power activating must be an unmissable, physical event — the
  Rooster lunges and the pecked tile is *torn out of the word*. Powers are public information by
  contract (`characters.md` §2), so the animation isn't decoration, it's how the opponent is *informed*.
- **Show the power as spent.** A beast whose once-per-round power is gone should look it — greyed
  charge, drooped posture. The player needs to read "do they still have it?" at a glance, because that's
  the whole strategic weight of a once-per-round ability.
- **Long-term hook:** beasts could *grow* or evolve with the length of words you play. Not for the
  prototype, but the name is pointing at something and we should notice.

**Prototype uses emoji placeholders** (🐀🐂🐅🐇🐉🐍🐎🐐🐒🐓🐕🐖) — they carry a startling amount of
personality for zero art cost, and they let us test the select screen and the power hooks immediately.
Art direction is undecided and deliberately not blocking. The template ships with Spine
(`@esotericsoftware/spine-pixi-v8`) already wired up, so animated beasts are a solved technical problem
whenever art exists.

## 7. Feel checklist

The difference between a prototype and a *game* is almost entirely here.

- Tiles land with weight — squash, a slight bounce, a `thunk`.
- Invalid submission: shake the row, red flash, **don't clear the input** (they were probably close, and
  the clock is running).
- Valid arrangement: the tiles *know* before you hit submit. Subtle glow when the current arrangement
  is a real word. This is a hint, but it's a hint about a word the player *already produced*, so it
  doesn't violate §1 — it just removes the "did I spell it right?" anxiety.
- Timer under 10s: audible tick, the whole board tightens.
- Scoring: the word tiles physically fly into the winner's score. The pot is *taken*.
- Dead end: the word slams shut. This is a *good* moment for whoever scored — sell it.

## 8. Open

- **Touch/mobile.** Typing is bad on phones; drag becomes the primary path and 45s gets tight. Probably
  a separate layout and a longer timer. Out of scope for the prototype, worth not painting into a corner.
- **Assist mode.** A per-letter Possible Words breakdown (`A:12 B:0 C:3…`) as an explicit easy-mode
  toggle. Big hint, legitimate accessibility feature, must not be default. See `open-questions.md`.
- **Colour-blind safety** on the counter — don't rely on green/amber/red alone; the number and the pulse
  carry it too.

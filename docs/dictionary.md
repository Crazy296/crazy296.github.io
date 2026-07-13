# Dictionary & The Possible Words Counter

---

## 1. The list

**ENABLE** — Enhanced North American Benchmark Lexicon. ~172,820 words.

- **Public domain.** No licence, no attribution, no risk. This is why we're not using TWL06 or
  SOWPODS, which are owned lists with murky terms for a public web game.
- It's the list behind Words With Friends, so its idea of "a word" matches what players expect from
  a casual word game.
- It's big enough. That matters more than it sounds: a thin dictionary means shallow trees, rounds
  that dead-end at 4 letters, and a Possible Words counter that sits near zero and stops being
  interesting. `FIXT` — from the design doc's own example — is *only* valid in a list this size.

**Cost of that size:** obscure words are valid. `AA`, `ZA`, `QI`, `XU` are all real ENABLE words and
a losing player will feel cheated the first time an AI plays one. That's a *presentation* problem,
not a dictionary problem — see §5 and `ai-opponent.md`.

Source: ENABLE is widely mirrored; grab a plain one-word-per-line file, lowercase, ASCII only.
Committed at `data/enable1.txt`.

### 1.1 The second data file, and its licence ⚠️

M2 added **`data/en-frequency-50k.txt`** — word frequencies, used to build the AI's vocabulary tiers
(`ai-opponent.md` §4). It is **not** the dictionary; the rules never consult it and the player is never
restricted by it.

| File | Source | Licence |
|---|---|---|
| `data/enable1.txt` | ENABLE | **Public domain** |
| `data/en-frequency-50k.txt` | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) `en_50k` (OpenSubtitles 2018) | **CC BY-SA 4.0** — attribution + share-alike |

**This is a decision someone has to make before shipping.** D1 chose ENABLE partly *because* it was
public domain and carried no licence risk, and we have now introduced a share-alike dependency to the
repo. It's fine for a prototype and it is attributed in the README, but if Spelling Beasts is ever
released commercially, either swap the list for a permissive one or accept the terms. Swapping it is a
one-line change in `scripts/build-dictionary.ts` — nothing else in the codebase knows where the ranking
came from.

## 2. The one data structure that makes this whole game cheap

Every question Spelling Beasts needs to ask is a question about **letter multisets, not strings.**
So we key everything on the **alphagram** — a word's letters, sorted.

```
MEAN → aemn
NAME → aemn
AMEN → aemn
MANE → aemn
```

Build a map from alphagram → the words that use exactly those letters:

```js
{ "aemn": ["AMEN", "MANE", "MEAN", "NAME"], ... }
```

That's it. That one map answers all three questions the game asks:

**Is `W'` a valid word?**
`map[alphagram(W')]?.includes(W')` — one hash lookup.

**What are the extensions of the word in play?**
For each of the 26 letters `L`: look up `map[alphagram(wordInPlay + L)]`. Every word in every hit is
a legal extension.
**26 hash lookups. Fixed cost, regardless of word length or dictionary size.**

**What is Possible Words?**
The total number of words across those 26 lookups.

```js
function extensions(wordInPlay) {
  const out = [];
  for (const L of ALPHABET) {
    const hits = map[alphagram(wordInPlay + L)];
    if (hits) out.push(...hits);
  }
  return out;                     // Possible Words === out.length
}
```

This is fast enough to call on every keystroke, every frame, for the AI's search at every node —
without ever thinking about performance again. **Do not build a trie.** A trie is the natural instinct
for word games and it is the wrong tool here, because a trie is indexed by *order* and this game
doesn't care about order.

### Multiplicity is free

Alphagrams handle repeated letters correctly with no special cases. `TOO` → `oot`. Adding `L` gives
`loot` → `{LOOT, TOOL}`. Adding another `O` gives `ooot` → no entry → not a word. Exactly right, and
we didn't have to write any code to get it.

## 3. Build pipeline — BUILT (M0)

`scripts/build-dictionary.ts` — a build-time script, not a runtime cost. `npm run build:dict`.

1. Read `data/enable1.txt` (committed — the raw ENABLE list, one lowercase word per line).
2. Filter: **length 2–12**. Words longer than 12 are unreachable in practice (a round would need 11
   consecutive turns) and dropping them trims the payload for free. *Keep 2-letter words — they're
   essential, every round passes through one.*
3. Uppercase, strip anything non-A–Z.
4. Group by alphagram.
5. Emit `public/dict.txt` — a generated artefact, **not committed**.
6. Also emit the **seed weight table** (`rules-spec.md` §6). Computed here because we already have the
   data in memory.
7. **(M2)** Join `data/en-frequency-50k.txt` against ENABLE and emit `public/vocab.txt` — every ENABLE
   word a real person actually uses, most-common-first. This is the AI's vocabulary, and therefore the
   difficulty system (`ai-opponent.md` §4). Also **not committed**.

**Actual output:**

```
read     172,824 lines from data/enable1.txt
kept     152,405 words (length 2–12)
grouped  136,157 distinct alphagrams
EXCLUDED C, Q, V, Z — zero 2-letter words, an unplayable seed
wrote    public/dict.txt  — 1,395 KB raw, 408 KB gzipped
wrote    public/vocab.txt — 31,911 ranked words, 118 KB gzipped
```

**Both artefacts are gitignored.** A fresh clone must run `npm run build:dict` once, or the game refuses
to start with a message telling it to.

### Payload — 408 KB gzipped, inside budget

The original estimate was 500–600 KB. A naive JSON alphagram map actually came out at **827 KB
gzipped** — well over. The fix was to stop storing information we already have:

**Don't store the alphagram keys.** They're derivable from any word in the bucket. Writing all 136,157
of them out cost ~450 KB gzipped to say precisely nothing. So the format is a JSON header line followed
by one line per bucket — just the words:

```
{"meta":{...},"seedWeights":{...}}
AMEN MANE MEAN NAME
LOOT TOOL
...
```

At load, the key is recomputed as `alphagram(words[0])`. That's 136k sorts of tiny strings and it costs
**~230 ms**, which happens once, inside the loading screen the template already has. Halving the
download for a quarter-second of startup is a trivially good trade.

| Form | Size |
|---|---|
| Raw ENABLE | 1.9 MB |
| JSON alphagram map (rejected) | 3.2 MB → **827 KB gzipped** |
| **Bucket lines, keys derived (shipped)** | 1.4 MB → **408 KB gzipped** |

**If we ever need it smaller** — front-coding the sorted word list would take another ~40% off. There is
no reason to do this now. Not a launch blocker; probably never a blocker.

## 4. The counter is a UI element, not a stat

Mechanically it's just `extensions(word).length`. But per `~design-doc.md` pillar 2, it's the tension
meter, so a few notes that belong here:

- It should be computed for the word in play at the **start of every turn** (which the rules require
  anyway for the dead-end check) and shown to **both** players. It's public information by design —
  hiding it would make the game a memory test instead of a strategy game.
- The interesting number is often the **delta**, not the value. Consider showing the drop.
  > ⚠️ **This section used to say "going from 340 → 71 in one move is the story". There is no 340.**
  > M2 measured the real counter: median **23** at two letters, single digits from five letters on, and
  > an all-time max of 103 over 400 rounds. The drama is the 5 → 2 → 1 collapse at the *end* of a round,
  > not a long fall. See `open-questions.md` **A12** — it's an open design question, not a bug.
- **Per-letter breakdown** (`A:12 B:0 C:3 …`) is a much bigger hint — it hands you the dead-end letters
  directly. This should be a **difficulty/assist setting**, not the default. See `open-questions.md` U2.
  *(It exists in M2 as a **debug tool** on the Dragon — labelled DEBUG on every screen, and explicitly
  not an answer to U2.)*

## 5. The obscure-word problem

`ZA` is valid. `AALII` is valid. When a player loses a round to a word they've never heard of, the
game feels broken even though it isn't.

Options:

- **Word info on round end.** Show the definition of the final word. Turns "what?" into "huh, neat."
  Needs a definitions dataset — cheap to add later, high value. *Still open. M5+.*
- **Two-tier list.** Validate against full ENABLE, but restrict *the AI* to a common-word subset so it
  never wins with garbage the player couldn't have known. This is the highest-value version of the fix
  and it costs one flag on the AI's candidate filter. See `ai-opponent.md`.
- Leave it. Scrabble players consider this a feature.

**BUILT in M2 — the two-tier list, and it doubles as the difficulty system.** `public/vocab.txt` ranks
the 31,911 ENABLE words that appear in a frequency list. **Easy knows 5,000 words, Medium 30,000, Strong
knows all 152,405** — so only the top tier can beat you with `AALII`, and the player is never restricted.
An AI that doesn't know a word here simply lets the clock run, which pays you the pot. `ai-opponent.md` §3.

The residue: **Strong is still the tier that plays garbage, and it's the tier with no handicap at all.**
That's now a deliberate property of the top tier rather than an accident. `open-questions.md` U3.

## 6. What M0 actually found

`npm run verify:dict` is the acceptance test. Three things it turned up that we didn't know:

### The design doc's own example was wrong

`FIXT` is **not** a dead end. The real line runs three moves longer:

```
F      Possible Words: 4     FA EF IF OF
IF                     14    FIB FID FIE IFF FIG KIF FIL FIN FIR RIF IFS FIT FIX FIZ
FIX                    1     FIXT          ← only one way out
FIXT                   1     FIXIT
FIXIT                  1     FIXITY
FIXITY                 0     ← the actual dead end. Worth 6 points, not 4.
```

The docs now use the corrected line. More importantly this is a *nice* line — the counter goes
4 → 14 → **1** → 1 → 1 → 0, i.e. `FIX` forces a single-file corridor with only one exit at every step.
Whoever is on turn when it dead-ends can see it coming four moves out and can do nothing about it. That's
exactly the drama pillar 2 promises, and it fell out of the dictionary for free.

### Four letters cannot be seeded at all

**C, Q, V and Z have zero 2-letter words in ENABLE.** Seed one and the opening player has no legal move
whatsoever — the round is unplayable by construction, not merely bad. Uniform A–Z would have dealt a dud
round **~15% of the time.** They're weighted 0 and recorded in `meta.excludedSeeds`.

Two more are nearly as bad: **J** and **K** have exactly one 2-letter word each (`JO`, `KA`), so those
seeds force the opening move. Playable, but the seed weights push them right down (J is 0.3% of draws).

### The performance claim holds, with room to spare

**10.2 µs** per `possibleWords()` call — about **1,600× cheaper than a 16 ms frame.** We can call it on
every keystroke and at every node of the AI's search without ever thinking about it again. The alphagram
map was the right call.

# Spelling Beasts 🐓

*A fast-paced letter-rearranging competition.* HTML5 / PixiJS v8.

A letter appears. You add one letter and rearrange the whole thing into a real word. Your opponent
does the same. The word grows — `F` → `IF` → `FIX` → `FIXT` — until someone plays a word that
**can't be extended**. Whoever added that last letter takes points equal to the word's length.

First to 100 wins.

---

## Status

**M0 — dictionary spike ✅** · 152,405 words, 408 KB gzipped, `possibleWords()` in 10 µs.
**M1 — headless rules engine ✅** · pure reducer, claim model, power hooks stubbed. Two AIs play a full
match to 100 unattended.
**M2 — playable prototype ✅ built** · Title → Character Select → Game. Type-to-arrange input, drag to
reorder, live turn clock, round-end and match-end beats, 12 selectable beasts, and three AI difficulty
tiers. **It needs playing** — that's what it's for.

Next: **playtest M2** (all three of us, a full match each), then **M3 — balance simulator**
([roadmap](docs/roadmap.md)).

### Two things M2 found that we didn't know

1. **Possible Words is ~10× smaller than we designed for.** `ui-ux.md` §5 is built around a counter
   falling `340 → 71`. No such number exists: the real counter medians **23** at two letters and decays to
   single digits, and the doc's own `MEN` example reads **14**, not 71. Pillar 2's presentation needs a
   rethink against real numbers. ([open-questions](docs/open-questions.md) **A12**)
2. **The AI isn't strong, it's just fluent.** It plays a *random* legal word — there's no search in it at
   all. What made it feel unbeatable is that it knows all 152,405 ENABLE words and never runs out of
   clock. So difficulty is a **vocabulary** lever, not a search one: Easy knows 5,000 words and is
   regularly stuck for a move. ([ai-opponent](docs/ai-opponent.md) §3)

## Start here

📖 **[docs/~design-doc.md](docs/~design-doc.md)** — read this first. Everything else is detail.

| Doc | What's in it |
|---|---|
| [~design-doc.md](docs/~design-doc.md) | **Start here.** The pitch, the pillars, and why the game works. |
| [rules-spec.md](docs/rules-spec.md) | **The authoritative rules.** Every edge case, the state machine, the claim model. Build to this. |
| [characters.md](docs/characters.md) | The twelve zodiac beasts, the power contract, the hook points, character select. |
| [dictionary.md](docs/dictionary.md) | ENABLE, the alphagram map, the Possible Words counter, build pipeline. |
| [ai-opponent.md](docs/ai-opponent.md) | Difficulty tiers, search, and making the AI feel human. |
| [ui-ux.md](docs/ui-ux.md) | Screens, the tile interaction, the counter, game feel. |
| [architecture.md](docs/architecture.md) | How this maps onto the PixiJS template. Module layout. |
| [roadmap.md](docs/roadmap.md) | M0–M7, risk-ordered. And what we're deliberately *not* building yet. |
| [open-questions.md](docs/open-questions.md) | Decided, resolved, unresolved. **Read before re-litigating a rule.** |

## Three things worth knowing before you touch the code

1. **Letter order is mechanically irrelevant.** A turn is fully described by *which letter you add* —
   validity is a multiset question. So an interface that arranges the letters for you deletes the
   entire game. Rearranging must be a *demonstration*. ([~design-doc](docs/~design-doc.md) §5)
2. **Don't build a trie.** The game asks multiset questions, not prefix questions. An **alphagram map**
   makes every query a fixed 26 hash lookups. ([dictionary](docs/dictionary.md) §2)
3. **Powers are engine-level, not a feature layer.** The Rooster's peck takes `MEN` → `MET` — the word
   *doesn't grow*, breaking the invariant the whole rules engine sits on. Build the hooks now.
   ([architecture](docs/architecture.md) §3.1)

## Running it

Built from the [PixiJS Creation Template](https://github.com/pixijs/create-pixi). Needs Node 20+.

```bash
npm install
npm run build:dict     # REQUIRED, ONCE. Builds public/dict.txt + public/vocab.txt.
npm run dev            # play it — http://localhost:8080
```

> ⚠️ **`npm run build:dict` is not optional on a fresh clone.** The dictionary and vocabulary are
> *generated artefacts* and are gitignored (they're derived from `data/`, and committing 1.4 MB of
> derivable text helps nobody). Skip this step and the game fails at the load screen with a message
> telling you to run it.

```bash
npm run build          # build:dict + lint + typecheck + production build
npm run lint
npm run verify:dict    # M0 acceptance — the dictionary
npm run verify:rules   # M1 acceptance — the rules, incl. the §4.1 claim-model trace
```

## Deploying (GitHub Pages)

Live at **https://crazy296.github.io/**. **Push to `main` and it deploys itself** —
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the game and publishes `dist/`.

**One-time setup:** repo *Settings → Pages → Build and deployment → Source =* **GitHub Actions**.
Without that the workflow runs green and nothing goes live.

### Why a workflow, and not just "deploy from a branch"

Because that doesn't work here, and it fails in a way that looks like the game is broken.

Pages can only serve a branch's **root** or its **`/docs`** folder — **it cannot be pointed at `dist/`.**
Our root holds the *source* `index.html`, which loads `/src/main.ts`; a browser served that gets
`404 /style.css`, `404 /favicon.png`, and refuses the TypeScript module outright
(*"Failed to load module script … MIME type video/mp2t"*). Blank page. And `/docs` is the design docs.

So CI builds it. `npm run build` (dict → lint → typecheck → bundle) runs on every push, which also means a
broken build is caught by the deploy rather than by the players.

### Three things that silently break the deploy — all handled, don't undo them

| | Why |
|---|---|
| **`base: "/"`** in `vite.config.ts` | `crazy296.github.io` is a **user site**, served from the domain root. If the game ever moves to a subdirectory (a project repo, or a folder of the user site), this **must** become `"/spelling-beasts/"` or every asset 404s. It works fine on localhost either way, which is what makes it nasty. |
| **`.nojekyll`** | Pages runs Jekyll by default, which skips files and folders it doesn't recognise. The empty `public/.nojekyll` is emitted into every build to turn that off. |
| **`build:dict` runs in CI** | `dict.txt` and `vocab.txt` are generated from `data/` and gitignored. Skip that step and the site loads, then dies at the load screen. |

`dist/` is committed too, but the **live site comes from the workflow's fresh build**, not from the
committed copy. If you'd rather not carry the build output in git, re-add `dist` to `.gitignore` — the
deploy doesn't need it.

## Data & licences

The game logic is ours; the two word lists are not.

| File | What | Source | Licence |
|---|---|---|---|
| `data/enable1.txt` | The dictionary. **The rules.** | ENABLE (Enhanced North American Benchmark Lexicon) | **Public domain** |
| `data/en-frequency-50k.txt` | Word frequencies. **The AI's difficulty only** — never restricts the player. | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) `en_50k`, from OpenSubtitles 2018 | **CC BY-SA 4.0** |

**Our code is [MIT](LICENSE).** The word lists are not ours and keep their own terms.

> ⚠️ **Unresolved: the frequency list is share-alike, and the code is MIT.** ENABLE was chosen partly
> *because* it was public domain and carried no licence risk ([open-questions](docs/open-questions.md) D1);
> M2 then added a CC BY-SA list to power the AI's vocabulary tiers. MIT code and a CC BY-SA data file can
> live in one repo — they're separately licensed works, and the attribution above is the obligation — but
> **the share-alike terms travel with `data/en-frequency-50k.txt` and anything derived from it**
> (including `public/vocab.txt`, which is built from it and shipped in `dist/`).
>
> Fine for a prototype. **A real decision before this is anything else.** Nothing in the codebase knows
> where the ranking came from, so swapping it for a permissively-licensed list is a one-line change in
> `scripts/build-dictionary.ts`.
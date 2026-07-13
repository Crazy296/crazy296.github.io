/**
 * Build-time: ENABLE word list → alphagram map + seed weight table,
 *             and ENABLE ∩ frequency list → the AI's vocabulary tiers.
 *
 * Run: npm run build:dict
 * In:  data/enable1.txt            (one lowercase word per line)
 *      data/en-frequency-50k.txt   ("word count", most common first)
 * Out: public/dict.txt             (generated artefact — not committed)
 *      public/vocab.txt            (generated artefact — not committed)
 *
 * See docs/dictionary.md §3 and docs/ai-opponent.md §4.
 */

import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

import { ALPHABET, alphagram, normalise } from "../src/game/alphagram.ts";
import type { DictionaryHeader } from "../src/game/dictionary.ts";

const SOURCE = "data/enable1.txt";
const OUT = "public/dict.txt";

/**
 * Word frequencies, most common first. This is the data `ai-opponent.md` §7 asks
 * for: it's what lets us handicap the AI by VOCABULARY rather than by making it
 * play badly (§4 lever 1 — "this is the one to build").
 *
 * Source: hermitdave/FrequencyWords, en_50k (OpenSubtitles 2018), CC BY-SA 4.0.
 * NOTE THE LICENCE: ENABLE is public domain and D1 chose it partly for that. This
 * list is share-alike. Fine for a prototype; a call to make before shipping.
 */
const FREQUENCY = "data/en-frequency-50k.txt";
const VOCAB_OUT = "public/vocab.txt";

/**
 * Words longer than 12 are unreachable in practice — a round would need eleven
 * consecutive turns to get there. Dropping them trims the payload for free.
 * 2-letter words are essential: every round passes through one.
 */
const MIN_LENGTH = 2;
const MAX_LENGTH = 12;

const raw = readFileSync(SOURCE, "utf8").split("\n");

// ── Group by alphagram ──────────────────────────────────────────────────────
const groups = new Map<string, string[]>();
let kept = 0;

for (const line of raw) {
  const word = normalise(line);
  if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) continue;

  const key = alphagram(word);
  const bucket = groups.get(key);
  if (bucket) bucket.push(word);
  else groups.set(key, [word]);
  kept++;
}

console.log(`  read     ${raw.length.toLocaleString()} lines from ${SOURCE}`);
console.log(
  `  kept     ${kept.toLocaleString()} words (length ${MIN_LENGTH}–${MAX_LENGTH})`,
);
console.log(`  grouped  ${groups.size.toLocaleString()} distinct alphagrams`);

// ── Seed weights ────────────────────────────────────────────────────────────
// A seed letter is only as good as the tree hanging off it. Uniform A–Z would
// deal Q, X and Z as often as E, and a Q round is a dead round.
//
// Weight = the number of distinct 3-letter words genuinely *reachable* from the
// seed, i.e. seed → some valid 2-letter word → some valid 3-letter word. That's
// a real measure of depth rather than a proxy for it, and it's cheap to compute
// exactly (26 × ~100 × 26 lookups).
//
// These are a TUNING KNOB, not a rule. Re-derive them against the M3 balance sim.
// See docs/rules-spec.md §6.
const lookup = (letters: string) => groups.get(alphagram(letters));

const seedWeights: Record<string, number> = {};
const seedReport: Array<{ letter: string; twos: number; threes: number }> = [];

for (const seed of ALPHABET) {
  const twos = new Set<string>();
  for (const L of ALPHABET) lookup(seed + L)?.forEach((w) => twos.add(w));

  const threes = new Set<string>();
  for (const two of twos) {
    for (const L of ALPHABET) lookup(two + L)?.forEach((w) => threes.add(w));
  }

  seedWeights[seed] = threes.size;
  seedReport.push({ letter: seed, twos: twos.size, threes: threes.size });
}

// A letter with no 2-letter words cannot be opened at all — the first player has
// no legal move and the round is unwinnable by construction. ENABLE has four of
// them. Weight 0 means never drawn.
const excludedSeeds = seedReport
  .filter((s) => s.twos === 0)
  .map((s) => s.letter);
if (excludedSeeds.length) {
  console.log(
    `  EXCLUDED ${excludedSeeds.join(", ")} — zero 2-letter words, an unplayable seed`,
  );
}

const ranked = [...seedReport].sort((a, b) => b.threes - a.threes);
console.log(
  `  seeds    richest: ${ranked
    .slice(0, 5)
    .map((s) => `${s.letter}(${s.threes})`)
    .join(" ")}`,
);
console.log(
  `           poorest: ${ranked
    .slice(-5)
    .map((s) => `${s.letter}(${s.threes})`)
    .join(" ")}`,
);

// ── Emit ────────────────────────────────────────────────────────────────────
// A JSON header line, then one line per bucket — just the words.
//
// The alphagram keys are NOT stored. They're derivable from any word in the
// bucket, and writing all 136k of them out cost ~450 KB gzipped to say nothing.
// Dropping them roughly halves the payload; the price is recomputing them at
// load, which is a few sorts of tiny strings and costs well under a frame.
const header: DictionaryHeader = {
  meta: {
    source: "ENABLE (enable1.txt) — public domain",
    wordCount: kept,
    alphagramCount: groups.size,
    minLength: MIN_LENGTH,
    maxLength: MAX_LENGTH,
    excludedSeeds,
  },
  seedWeights,
};

const body = [...groups.values()].map((list) => list.join(" ")).join("\n");
const text = `${JSON.stringify(header)}\n${body}\n`;
writeFileSync(OUT, text);

const rawKb = text.length / 1024;
const gzKb = gzipSync(text).length / 1024;
console.log(`\n  wrote    ${OUT}`);
console.log(
  `           ${rawKb.toFixed(0)} KB raw, ${gzKb.toFixed(0)} KB gzipped (what the player downloads)`,
);

// ── The AI's vocabulary ─────────────────────────────────────────────────────
// Every ENABLE word that a real person actually uses, ordered most-common-first.
// The AI's difficulty tiers are prefixes of this list: Easy knows the first 5,000,
// Medium the first 30,000, Strong knows all of ENABLE and needs no list at all.
//
// This is how human word-game skill actually varies — strong players don't
// calculate deeper, they KNOW MORE WORDS (ai-opponent.md §4). It also quietly
// fixes U3: a restricted AI can't beat you with AALII, because it has never heard
// of AALII either.
const inDictionary = new Set<string>();
for (const bucket of groups.values())
  for (const w of bucket) inDictionary.add(w);

const vocabulary: string[] = [];
const alreadyRanked = new Set<string>();

for (const line of readFileSync(FREQUENCY, "utf8").split("\n")) {
  const word = normalise(line.split(" ")[0] ?? "");
  if (!inDictionary.has(word) || alreadyRanked.has(word)) continue;
  alreadyRanked.add(word);
  vocabulary.push(word);
}

const vocabText = `${vocabulary.join("\n")}\n`;
writeFileSync(VOCAB_OUT, vocabText);

console.log(`\n  wrote    ${VOCAB_OUT}`);
console.log(
  `           ${vocabulary.length.toLocaleString()} ranked words (of ${kept.toLocaleString()} in ENABLE)` +
    ` — ${(gzipSync(vocabText).length / 1024).toFixed(0)} KB gzipped`,
);
console.log(`           rank 1: ${vocabulary.slice(0, 6).join(" ")}`);
console.log(
  `           rank 5,000: ${vocabulary.slice(4997, 5003).join(" ")} ← Easy stops knowing words about here`,
);

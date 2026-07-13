/**
 * M0 acceptance. Proves the dictionary spike does what docs/dictionary.md claims.
 *
 * Run: npm run verify:dict
 */

import { readFileSync } from "node:fs";

import { Dictionary } from "../src/game/dictionary.ts";
import { ALPHABET, normalise } from "../src/game/alphagram.ts";

const t0 = performance.now();
const dict = Dictionary.parse(readFileSync("public/dict.txt", "utf8"));
const loadMs = performance.now() - t0;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok  " : " FAIL "} ${label.padEnd(48)} ${
      ok
        ? JSON.stringify(actual)
        : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    }`,
  );
}

console.log(
  `\nLoaded ${dict.meta.wordCount.toLocaleString()} words / ${dict.meta.alphagramCount.toLocaleString()} alphagrams in ${loadMs.toFixed(0)}ms\n`,
);

// ── 1. The design doc's worked example — and its correction ─────────────────
// The doc claims Player 1 plays FIXT and scores 4 because "FIXT?" has no valid
// words. ENABLE disagrees: FIXT → FIXIT → FIXITY. The line is three moves longer
// than the doc thinks. See docs/open-questions.md A8.
console.log("The F → IF → FIX → FIXT line (~design-doc.md §1)");
check("IF is a word", dict.isValid("IF"), true);
check("FIX is a word", dict.isValid("FIX"), true);
check("FIXT is a word", dict.isValid("FIXT"), true);
check("F  →  IF is legal", dict.extensions("F").includes("IF"), true);
check("IF →  FIX is legal", dict.extensions("IF").includes("FIX"), true);
check("FIX → FIXT is legal", dict.extensions("FIX").includes("FIXT"), true);
check(
  "FIXT is NOT a dead end (the doc is wrong)",
  dict.isDeadEnd("FIXT"),
  false,
);
check("...because FIXT → FIXIT", dict.extensions("FIXT"), ["FIXIT"]);
check("...and FIXIT → FIXITY", dict.extensions("FIXIT"), ["FIXITY"]);
check("FIXITY is the real dead end", dict.isDeadEnd("FIXITY"), true);

// ── 2. The counter falling — the core drama ─────────────────────────────────
console.log("\nPossible Words as the noose tightens");
for (const w of ["F", "IF", "FIX", "FIXT", "FIXIT", "FIXITY"]) {
  console.log(`       ${w.padEnd(48)} ${dict.possibleWords(w)}`);
}

// ── 3. Order really is irrelevant ───────────────────────────────────────────
console.log("\nOrder is mechanically irrelevant (~design-doc.md §5)");
const menExt = dict.extensions("MEN");
for (const w of ["AMEN", "MANE", "MEAN", "NAME"]) {
  check(`MEN + A can be played as ${w}`, menExt.includes(w), true);
}
check(
  "MEN → MET (the Rooster case) is NOT legal",
  menExt.includes("MET"),
  false,
);

// ── 4. Multiplicity (architecture.md §7) ────────────────────────────────────
console.log("\nRepeated letters are handled by alphagrams for free");
const tooExt = dict.extensions("TOO");
check("TOO → TOOL", tooExt.includes("TOOL"), true);
check("TOO → ROOT", tooExt.includes("ROOT"), true);
check("TOO → TOOO is not a word", dict.isValid("TOOO"), false);
check("TOO → TOOO not offered", tooExt.includes("TOOO"), false);

// ── 5. Every extension is well-formed ───────────────────────────────────────
console.log("\nProperty: every extension is exactly +1 letter and a superset");
let malformed = 0;
for (const seed of ALPHABET) {
  for (const two of dict.extensions(seed)) {
    for (const three of dict.extensions(two)) {
      if (three.length !== two.length + 1) malformed++;
      const pool = three.split("");
      for (const ch of two) {
        const i = pool.indexOf(ch);
        if (i === -1) malformed++;
        else pool.splice(i, 1);
      }
      if (pool.length !== 1) malformed++;
    }
  }
}
check("malformed extensions across the 3-letter tree", malformed, 0);

// ── 6. The whole source list round-trips ────────────────────────────────────
console.log("\nProperty: the whole source list round-trips");
const source = readFileSync("data/enable1.txt", "utf8")
  .split("\n")
  .map(normalise);
const inRange = source.filter(
  (w) => w.length >= dict.meta.minLength && w.length <= dict.meta.maxLength,
);
const invalid = inRange.filter((w) => !dict.isValid(w));
check(
  `all ${inRange.length.toLocaleString()} in-range ENABLE words validate`,
  invalid.length,
  0,
);

// ── 7. Seeding — the unplayable letters ─────────────────────────────────────
// C, Q, V and Z have zero 2-letter words in ENABLE. Seed one and the first player
// has no legal move at all. Uniform A–Z would deal a dead round ~15% of the time.
console.log("\nSeeding (rules-spec.md §6)");
const dud = ALPHABET.filter((L) => dict.extensions(L).length === 0);
check("letters with NO 2-letter word", dud, ["C", "Q", "V", "Z"]);
check(
  "...are all weighted 0 (never drawn)",
  dud.every((L) => dict.seedWeights.get(L) === 0),
  true,
);
check("...and are recorded in meta", dict.meta.excludedSeeds, [
  "C",
  "Q",
  "V",
  "Z",
]);
check(
  "every drawable seed has a real tree",
  ALPHABET.filter((L) => (dict.seedWeights.get(L) ?? 0) > 0).every(
    (L) => dict.extensions(L).length > 0,
  ),
  true,
);

const weights = [...dict.seedWeights.entries()]
  .filter(([, w]) => w > 0)
  .sort((a, b) => b[1] - a[1]);
const total = weights.reduce((n, [, w]) => n + w, 0);
const pct = (w: number) => ((w / total) * 100).toFixed(1);
console.log(
  `       richest  ${weights
    .slice(0, 4)
    .map(([l, w]) => `${l} ${w} (${pct(w)}%)`)
    .join("   ")}`,
);
console.log(
  `       poorest  ${weights
    .slice(-4)
    .map(([l, w]) => `${l} ${w} (${pct(w)}%)`)
    .join("   ")}`,
);

// ── 8. Is the 26-lookup path actually fast? ─────────────────────────────────
console.log(
  '\nPerformance — the claim is "26 hash lookups, call it every frame"',
);
const sample: string[] = [];
for (const seed of ALPHABET) {
  for (const two of dict.extensions(seed).slice(0, 4)) {
    sample.push(two, ...dict.extensions(two).slice(0, 4));
  }
}
const ITER = 20_000;
const t1 = performance.now();
let sink = 0;
for (let i = 0; i < ITER; i++)
  sink += dict.possibleWords(sample[i % sample.length]);
const perCall = ((performance.now() - t1) / ITER) * 1000;
console.log(
  `       ${ITER.toLocaleString()} possibleWords() calls over ${sample.length} positions`.padEnd(
    55,
  ) + `${perCall.toFixed(1)}µs each`,
);
check("possibleWords() well under one frame (16,000µs)", perCall < 100, true);
if (sink < 0) console.log("unreachable");

// ── Verdict ─────────────────────────────────────────────────────────────────
console.log(
  failures === 0
    ? "\n✅  M0 PASSED — the dictionary spike holds.\n"
    : `\n❌  ${failures} FAILURE(S)\n`,
);
process.exit(failures === 0 ? 0 : 1);

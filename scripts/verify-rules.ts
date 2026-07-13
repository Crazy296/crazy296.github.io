/**
 * M1 acceptance. The rules engine, headless.
 *
 * Run: npm run verify:rules
 *
 * The headline test is the claim-model trace from docs/rules-spec.md §4.1, run
 * verbatim. If that ever goes red, someone has "simplified" GameState.claimed and
 * reopened the infinite-points exploit.
 */

import { readFileSync } from "node:fs";

import { Dictionary } from "../src/game/dictionary.ts";
import { RandomAi } from "../src/game/ai/ai.ts";
import { makeRng } from "../src/game/rng.ts";
import {
  applyMove,
  createMatch,
  drawSeed,
  isExtensionOf,
  nextRound,
  potAtStake,
  TARGET_SCORE,
} from "../src/game/rules.ts";
import {
  IllegalMoveError,
  type GameState,
  type Move,
  type PlayerId,
  type Rejection,
} from "../src/game/types.ts";

const dict = Dictionary.parse(readFileSync("public/dict.txt", "utf8"));

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok  " : " FAIL "} ${label.padEnd(52)} ${
      ok
        ? JSON.stringify(actual)
        : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    }`,
  );
}

/** Build a state directly, so tests don't depend on the seed draw. */
function stateAt(over: Partial<GameState>): GameState {
  return {
    phase: "AWAIT_MOVE",
    wordInPlay: "E",
    seed: "E",
    adder: null,
    claimed: false,
    activePlayer: 0,
    scores: [0, 0],
    roundPoints: [0, 0],
    beasts: ["rooster", "dragon"],
    powerUsed: [false, false],
    roundStarter: 0,
    roundNumber: 1,
    ...over,
  };
}

function rejectionOf(fn: () => unknown): Rejection["code"] | "no_error" {
  try {
    fn();
    return "no_error";
  } catch (e) {
    if (e instanceof IllegalMoveError) return e.rejection.code;
    throw e;
  }
}

const submit = (word: string): Move => ({ kind: "submit", word });
const timeout: Move = { kind: "timeout" };

// ════════════════════════════════════════════════════════════════════════════
// 1. THE CLAIM MODEL — rules-spec.md §4.1, traced verbatim
// ════════════════════════════════════════════════════════════════════════════
console.log("\nThe claim-model trace (rules-spec.md §4.1) — seed E, P1 starts");
console.log("       event            word  adder claimed  scores    next");

{
  let s = stateAt({ wordInPlay: "E", seed: "E", activePlayer: 0 });
  const row = (event: string) =>
    console.log(
      `       ${event.padEnd(16)} ${s.wordInPlay.padEnd(5)} ${String(s.adder).padEnd(5)} ${String(s.claimed).padEnd(8)} ${JSON.stringify(s.scores).padEnd(9)} ${s.phase === "AWAIT_MOVE" ? `P${s.activePlayer + 1}` : s.phase}`,
    );

  s = applyMove(s, submit("ME"), dict);
  row("P1 plays ME");
  check("  ME: adder is P1, unclaimed", [s.adder, s.claimed], [0, false]);
  check("  ME: turn passes to P2", s.activePlayer, 1);
  check("  ME: P2 risks the pot", potAtStake(s), 2);

  s = applyMove(s, timeout, dict);
  row("P2 times out");
  check("  P1 is paid 2 (the word's length)", s.scores, [2, 0]);
  check("  word is now CLAIMED", s.claimed, true);
  check("  word PERSISTS — round did not reset", s.wordInPlay, "ME");
  check("  turn goes to P1, the scorer", s.activePlayer, 0);

  s = applyMove(s, submit("MEN"), dict);
  row("P1 plays MEN");
  check("  a fresh letter makes it claimable again", s.claimed, false);

  s = applyMove(s, timeout, dict);
  row("P2 times out");
  check("  P1 is paid 3 — total 5", s.scores, [5, 0]);
  check("  turn goes to P1 again", s.activePlayer, 0);

  s = applyMove(s, timeout, dict);
  row("P1 times out");
  check("  ROUND ENDS on the double timeout", s.phase, "ROUND_END");
  check("  NOBODY is paid twice for MEN", s.scores, [5, 0]);
  check("  reason", s.lastRound?.reason, "double_timeout");
  check("  scorer", s.lastRound?.scorer, null);

  // The round-ENDING event paid nobody — but P1 banked 2 and then 3 on the way
  // here, and the round-end screen has to say so. Reporting only `scorer`/`points`
  // showed "nobody scores" on a round P1 took 5 from.
  check("  ...but the ROUND paid P1 five", s.lastRound?.roundPoints, [5, 0]);

  // This is the whole point of `claimed`.
  console.log(
    "\n       Without `claimed`, P1 would be paid 3 twice, and a player who simply\n" +
      "       never moves would print infinite points for their opponent.",
  );
  check("FINAL: P1 has exactly 5, per the design doc", s.scores[0], 5);
}

// ════════════════════════════════════════════════════════════════════════════
// 2. Dead ends
// ════════════════════════════════════════════════════════════════════════════
console.log(
  "\nDead ends fire at TURN START, not on submission (rules-spec §3)",
);
{
  // FIXIT → FIXITY is the real end of the doc's example line (dictionary.md §6).
  let s = stateAt({ wordInPlay: "FIXIT", adder: 1, activePlayer: 0 });
  s = applyMove(s, submit("FIXITY"), dict);
  check("P1 plays FIXITY (a dead end)", s.phase, "ROUND_END");
  check("  P1 scores IMMEDIATELY, 6 points", s.scores, [6, 0]);
  check("  ...not waiting out P2's clock", s.lastRound?.reason, "dead_end");
  check("  the pot is the word's length", s.lastRound?.points, 6);
  check(
    "  no timeouts, so the round total IS the pot",
    s.lastRound?.roundPoints,
    [6, 0],
  );
  check("  FIXITY really is a dead end", dict.isDeadEnd("FIXITY"), true);

  // Per ROUND, like powerUsed — a fresh seed starts both players back at zero,
  // while `scores` (the match total) carries the 6 forward.
  const next = nextRound(s, dict, makeRng(7));
  check("  next round resets the tally", next.roundPoints, [0, 0]);
  check("  ...but the match score carries", next.scores, [6, 0]);
}

// ════════════════════════════════════════════════════════════════════════════
// 3. Submission legality
// ════════════════════════════════════════════════════════════════════════════
console.log("\nSubmission legality (rules-spec §3.1)");
{
  const s = stateAt({ wordInPlay: "MEN", adder: 1, activePlayer: 0 });
  check(
    "MEN → NAME (rearranged)",
    applyMove(s, submit("NAME"), dict).wordInPlay,
    "NAME",
  );
  check(
    "MEN → AMEN (same letter, different word)",
    applyMove(s, submit("AMEN"), dict).wordInPlay,
    "AMEN",
  );
  check(
    "MEN → MEND is +1 and legal",
    applyMove(s, submit("MEND"), dict).wordInPlay,
    "MEND",
  );
  check(
    "MEN → MEAT (+1 but drops the N)",
    rejectionOf(() => applyMove(s, submit("MEAT"), dict)),
    "wrong_letters",
  );
  check(
    "MEN → MENDS (+2 letters)",
    rejectionOf(() => applyMove(s, submit("MENDS"), dict)),
    "wrong_length",
  );
  check(
    "MEN → MEN   (no growth)",
    rejectionOf(() => applyMove(s, submit("MEN"), dict)),
    "wrong_length",
  );
  check(
    "MEN → MENZ  (not a word)",
    rejectionOf(() => applyMove(s, submit("MENZ"), dict)),
    "not_a_word",
  );
  check(
    "lowercase input is normalised",
    applyMove(s, submit("name"), dict).wordInPlay,
    "NAME",
  );

  // MET is a real word and uses M and E — but it is the SAME LENGTH as MEN. The
  // engine rejects it on length, which is exactly the Rooster problem stated as a
  // type error: Peck's whole trick is making a turn net-zero, and the +1 invariant
  // forbids that outright. Only a beforeSubmit hook that shrinks the base can
  // legalise it. See docs/characters.md §3.
  check(
    "MEN → MET  (the Rooster case) is ILLEGAL...",
    rejectionOf(() => applyMove(s, submit("MET"), dict)),
    "wrong_length",
  );
  check(
    "...rejected on LENGTH — MET doesn't grow the word",
    "MET".length === "MEN".length,
    true,
  );
}

console.log("\nMultiplicity is handled by the letter pool, not by luck");
{
  const s = stateAt({ wordInPlay: "TOO", adder: 1, activePlayer: 0 });
  check("TOO → TOOL", applyMove(s, submit("TOOL"), dict).wordInPlay, "TOOL");
  check(
    "TOO → ROOT (rearranged)",
    applyMove(s, submit("ROOT"), dict).wordInPlay,
    "ROOT",
  );
  check(
    "TOO → TOOO",
    rejectionOf(() => applyMove(s, submit("TOOO"), dict)),
    "not_a_word",
  );
  check(
    "isExtensionOf(TOO, TOOO) is structurally true",
    isExtensionOf("TOO", "TOOO"),
    true,
  );
  check(
    "...so it's the DICTIONARY that rejects it",
    dict.isValid("TOOO"),
    false,
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 4. Timeout edge cases
// ════════════════════════════════════════════════════════════════════════════
console.log("\nTimeout on a bare seed — nobody to pay (rules-spec §4)");
{
  let s = stateAt({ wordInPlay: "E", adder: null, activePlayer: 0 });
  s = applyMove(s, timeout, dict);
  check("no adder → nobody scores", s.scores, [0, 0]);
  check("the seed stands", s.wordInPlay, "E");
  check("turn passes to P2", s.activePlayer, 1);
  check("round continues", s.phase, "AWAIT_MOVE");

  s = applyMove(s, timeout, dict);
  check("both whiff → round ends", s.phase, "ROUND_END");
  check("...still nobody scores", s.scores, [0, 0]);
  check("...scorer is null", s.lastRound?.scorer, null);
}

console.log("\nStalling is self-harming, not exploitable");
{
  // P2 refuses to ever play. Each timeout pays P1 and hands P1 the turn.
  let s = stateAt({ wordInPlay: "ME", adder: 0, activePlayer: 1 });
  s = applyMove(s, timeout, dict); // P2 whiffs → P1 +2, P1 to move
  check("P1 paid, P1 to move", [s.scores[0], s.activePlayer], [2, 0]);
  s = applyMove(s, submit("MEN"), dict); // P1 extends → P2 to move
  s = applyMove(s, timeout, dict); // P2 whiffs again → P1 +3
  check("P2's second whiff pays P1 again", s.scores, [5, 0]);
  check("P2 has scored nothing by stalling", s.scores[1], 0);
}

// ════════════════════════════════════════════════════════════════════════════
// 5. Power hooks — present, wired, and correctly refusing to do anything
// ════════════════════════════════════════════════════════════════════════════
console.log(
  "\nPower hooks exist in M1 but every power is a stub (characters.md)",
);
{
  const s = stateAt({
    wordInPlay: "MEN",
    adder: 1,
    activePlayer: 0,
    beasts: ["rooster", "dragon"],
  });
  const peck = (): GameState =>
    applyMove(
      s,
      {
        kind: "submit",
        word: "MET",
        power: { beast: "rooster", payload: { index: 2 } },
      },
      dict,
    );
  check(
    "Rooster's Peck is rejected — not implemented",
    rejectionOf(peck),
    "power_not_implemented",
  );

  const wrongBeast = () =>
    applyMove(
      s,
      { kind: "submit", word: "MEND", power: { beast: "pig" } },
      dict,
    );
  check(
    "you can't fire a beast you didn't pick",
    rejectionOf(wrongBeast),
    "power_unavailable",
  );

  const spent = stateAt({
    wordInPlay: "MEN",
    adder: 1,
    activePlayer: 0,
    powerUsed: [true, false],
  });
  const reuse = () =>
    applyMove(
      spent,
      { kind: "submit", word: "MEND", power: { beast: "rooster" } },
      dict,
    );
  check(
    "...or one you've already spent this round",
    rejectionOf(reuse),
    "power_unavailable",
  );
  check(
    "powerUsed resets on a new round",
    nextRound(
      stateAt({ phase: "ROUND_END", powerUsed: [true, true] }),
      dict,
      makeRng(1),
    ).powerUsed,
    [false, false],
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 6. Seeding
// ════════════════════════════════════════════════════════════════════════════
console.log("\nSeeding never deals an unplayable letter (rules-spec §6)");
{
  const rng = makeRng(20260711);
  const drawn = new Set<string>();
  for (let i = 0; i < 20_000; i++) drawn.add(drawSeed(dict, rng));
  const banned = ["C", "Q", "V", "Z"].filter((L) => drawn.has(L));
  check("C/Q/V/Z drawn in 20,000 draws", banned, []);
  check(
    "every drawn seed has a legal opening move",
    [...drawn].every((L) => dict.extensions(L).length > 0),
    true,
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 7. A whole match, unattended
// ════════════════════════════════════════════════════════════════════════════
console.log("\nTwo random AIs play a full match to 100");
{
  const rng = makeRng(42);
  const ai = [
    new RandomAi(rng, { name: "P1", timeoutChance: 0.1 }),
    new RandomAi(rng, { name: "P2", timeoutChance: 0.1 }),
  ];

  let s = createMatch(["rooster", "dragon"], dict, rng);
  let turns = 0;
  const roundLengths: number[] = [];
  const finalWords: string[] = [];

  while (s.phase !== "MATCH_END") {
    if (s.phase === "ROUND_END") {
      if (s.lastRound) {
        roundLengths.push(s.lastRound.finalWord.length);
        if (s.lastRound.scorer !== null) finalWords.push(s.lastRound.finalWord);
      }
      s = nextRound(s, dict, rng);
      continue;
    }
    const move = await ai[s.activePlayer].requestMove(s, dict);
    s = applyMove(s, move, dict);
    if (++turns > 100_000) throw new Error("match failed to terminate");
  }

  const rounds = s.roundNumber;
  const avg = roundLengths.reduce((a, b) => a + b, 0) / roundLengths.length;

  check("match reached MATCH_END", s.phase, "MATCH_END");
  check("there is a winner", s.winner !== undefined, true);
  check(
    "the winner is at or past 100",
    s.scores[s.winner as PlayerId] >= TARGET_SCORE,
    true,
  );
  console.log(
    `\n       final score      ${s.scores[0]} – ${s.scores[1]}  (P${(s.winner as number) + 1} wins)`,
  );
  console.log(`       rounds           ${rounds}`);
  console.log(`       turns            ${turns}`);
  console.log(`       avg final word   ${avg.toFixed(1)} letters`);
  console.log(`       sample words     ${finalWords.slice(-6).join(", ")}`);
  console.log(
    `\n       NOTE: random play, so these numbers mean nothing about balance —\n` +
      `       but ${rounds} rounds to reach 100 is the first hint at U5 (match length).\n` +
      `       M3's sim answers it properly.`,
  );
}

// ── Verdict ─────────────────────────────────────────────────────────────────
console.log(
  failures === 0
    ? "\n✅  M1 PASSED — the rules engine holds.\n"
    : `\n❌  ${failures} FAILURE(S)\n`,
);
process.exit(failures === 0 ? 0 : 1);

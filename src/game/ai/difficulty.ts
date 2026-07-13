/**
 * The three tiers.
 *
 * WHAT THESE ACTUALLY DO — read this before tuning them, because the naming is a
 * promise we haven't kept yet:
 *
 * `ai-opponent.md` §3 defines the tiers by SEARCH — Easy is random, Medium looks
 * one ply ahead, Hard is a full memoised minimax. **None of that exists.** The bot
 * behind all three tiers is M1's `RandomAi`, which picks a uniformly random legal
 * word. The search tiers land in M4.
 *
 * So these tiers are built from the two levers we *do* have, which happen to be
 * §4's best two anyway:
 *
 *   1. VOCABULARY (§4 lever 1, "the one to build") — how many words the AI knows,
 *      as a prefix of the frequency-ranked list. This is the big one. An AI that
 *      only knows 5,000 words regularly *cannot find a move at all*, and has to
 *      let the clock run — which hands you the pot. That is a real handicap that
 *      never looks like the game throwing the match.
 *   2. TIMEOUT RATE (§4 lever 3) — it sometimes just runs out of clock, the way
 *      people do.
 *
 * Strength is therefore monotonic in "words known", and STRONG is exactly the bot
 * we shipped in M2: all of ENABLE, 2% timeouts, no strategy whatsoever. When the
 * minimax lands in M4, Strong gets a brain and this file gains a fourth tier.
 */

export type DifficultyId = "easy" | "medium" | "strong";

export interface Difficulty {
  id: DifficultyId;
  label: string;
  /** How many of the most common English words the AI knows. Null = all of ENABLE. */
  vocabulary: number | null;
  /** Chance it simply lets the clock run out on any given turn. */
  timeoutChance: number;
  /** Shown on the character select screen. Say what it really is. */
  blurb: string;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: "easy",
    label: "EASY",
    vocabulary: 5_000,
    // §3: "sometimes just time out (~15% of turns) ... the single most effective
    // difficulty lever we have and it costs nothing."
    timeoutChance: 0.15,
    blurb:
      "Knows 5,000 common words. Often stuck for a word, and lets the clock run.",
  },
  {
    id: "medium",
    label: "MEDIUM",
    vocabulary: 30_000,
    timeoutChance: 0.05,
    blurb:
      "Knows 30,000 words. Rarely stuck. No strategy — it just plays a word.",
  },
  {
    id: "strong",
    label: "STRONG",
    vocabulary: null,
    timeoutChance: 0.02,
    blurb:
      "Knows all 152,405 ENABLE words, including ones nobody has ever said. Never stuck.",
  },
];

export const DEFAULT_DIFFICULTY: DifficultyId = "medium";

export function getDifficulty(id: DifficultyId): Difficulty {
  const found = DIFFICULTIES.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown difficulty: ${id}`);
  return found;
}

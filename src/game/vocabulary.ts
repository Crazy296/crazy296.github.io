/**
 * The AI's vocabulary — the honest difficulty lever.
 *
 * `ai-opponent.md` §4: the temptation with a strong AI is to make it *dumber*, and
 * you must resist, because an AI that plays deliberately bad moves reads as the
 * game cheating. Restrict what it KNOWS instead. That's how human skill actually
 * varies — strong word-game players don't calculate deeper, they know more words —
 * so an AI beaten this way feels like a person you out-played, not a difficulty
 * slider you turned down.
 *
 * A tier is just a prefix of the frequency-ranked list built by
 * scripts/build-dictionary.ts. Rank 1 is YOU; rank 5,000 is around APPLES; ENABLE's
 * long tail (AALII, ZA, QI) has no rank at all — nobody says those words, so only
 * the unrestricted AI ever plays them. That is also the fix for U3.
 */

import { normalise } from "./alphagram.ts";

export class Vocabulary {
  /** Most common first. Index 0 is the most frequent word in English. */
  private readonly ranked: readonly string[];

  private constructor(ranked: readonly string[]) {
    this.ranked = ranked;
  }

  static parse(text: string): Vocabulary {
    const words = text
      .split("\n")
      .map(normalise)
      .filter((w) => w.length > 0);
    return new Vocabulary(words);
  }

  get size(): number {
    return this.ranked.length;
  }

  /**
   * The `size` most common words. A tier bigger than the list is the whole list —
   * which is still far short of all of ENABLE, and deliberately so.
   */
  top(size: number): ReadonlySet<string> {
    return new Set(this.ranked.slice(0, size));
  }
}

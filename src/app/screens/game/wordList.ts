/**
 * The round-end reveal: the words that were still on the table.
 *
 * Pure and Pixi-free so it can be run headless by scripts/verify-rules.ts. It is
 * presentation, not rules — the engine neither knows nor cares that we print this.
 */

/** How many words we name before "+N more". */
export const MAX_LISTED = 12;

/**
 * The words that were still playable, as one line: "LIST, LOST, LUST, +9 more".
 *
 * Every extension of an n-letter word is n+1 letters, so there is no length to sort
 * by and no "show the short ones first" — alphabetical is the neutral order.
 *
 * Empty on a dead end, and that is not a bug: a round ends *because* the word has no
 * extensions left, so `dead_end` — the common ending — has nothing to list. The
 * caller says so in words rather than printing an empty line.
 */
export function formatWordList(words: readonly string[]): string {
  if (words.length === 0) return "";

  const sorted = [...words].sort();
  const shown = sorted.slice(0, MAX_LISTED);
  const rest = sorted.length - shown.length;

  return rest > 0 ? `${shown.join(", ")}, +${rest} more` : shown.join(", ");
}

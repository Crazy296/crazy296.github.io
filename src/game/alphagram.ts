/**
 * The alphagram: a word's letters, sorted.
 *
 *   MEAN → AEMN
 *   NAME → AEMN
 *   AMEN → AEMN
 *
 * This is the primitive the entire game rests on. Spelling Beasts asks *multiset*
 * questions ("do these letters, in any order, spell something?"), never *prefix*
 * questions — so a trie is the wrong tool and this is the right one.
 *
 * See docs/dictionary.md §2.
 */

/** Sort a word's letters. Assumes uppercase A–Z; see `normalise`. */
export function alphagram(word: string): string {
  return word.split("").sort().join("");
}

/** Uppercase and strip anything that isn't A–Z. */
export function normalise(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "");
}

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

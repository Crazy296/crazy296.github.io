/**
 * The dictionary. Pure TypeScript — no Pixi, no DOM, no fetch.
 *
 * Everything the game asks — "is this a word?", "what can this be extended to?",
 * "how many Possible Words are left?" — is answered by one alphagram map in a
 * fixed 26 hash lookups, regardless of word length or dictionary size.
 *
 * See docs/dictionary.md.
 */

import { ALPHABET, alphagram, normalise } from "./alphagram.ts";

export interface DictionaryMeta {
  source: string;
  wordCount: number;
  alphagramCount: number;
  minLength: number;
  maxLength: number;
  /** Letters with no 2-letter words — never drawn as a seed. See docs/rules-spec.md §6. */
  excludedSeeds: string[];
}

export interface DictionaryHeader {
  meta: DictionaryMeta;
  /** Letter → relative weight for the seed draw. Zero means never drawn. */
  seedWeights: Record<string, number>;
}

export class Dictionary {
  private readonly map: Map<string, string[]>;
  readonly seedWeights: ReadonlyMap<string, number>;
  readonly meta: DictionaryMeta;

  private constructor(
    header: DictionaryHeader,
    buckets: Map<string, string[]>,
  ) {
    this.meta = header.meta;
    this.map = buckets;
    this.seedWeights = new Map(Object.entries(header.seedWeights));
  }

  /**
   * Parse the artefact built by scripts/build-dictionary.ts.
   *
   * Format: a JSON header line, then one line per alphagram bucket —
   * just the words, space-separated:
   *
   *     {"meta":{...},"seedWeights":{...}}
   *     AMEN MANE MEAN NAME
   *     ...
   *
   * The alphagram keys aren't stored: they're derivable from any word in the
   * bucket, and storing 136k of them cost ~450 KB gzipped for zero information.
   */
  static parse(text: string): Dictionary {
    const newline = text.indexOf("\n");
    const header: DictionaryHeader = JSON.parse(text.slice(0, newline));

    const buckets = new Map<string, string[]>();
    let i = newline + 1;
    const len = text.length;

    while (i < len) {
      let end = text.indexOf("\n", i);
      if (end === -1) end = len;
      if (end > i) {
        const words = text.slice(i, end).split(" ");
        buckets.set(alphagram(words[0]), words);
      }
      i = end + 1;
    }

    return new Dictionary(header, buckets);
  }

  /** Is this a real word? One hash lookup. */
  isValid(word: string): boolean {
    const w = normalise(word);
    return this.map.get(alphagram(w))?.includes(w) ?? false;
  }

  /**
   * Every valid word made from `letters` plus exactly one new letter, in any order.
   * 26 hash lookups. This is the game's hot path and it is not hot at all.
   *
   * Each of the 26 candidate letters yields a distinct alphagram, so no word can
   * be returned twice — no dedupe needed.
   */
  extensions(letters: string): string[] {
    const base = normalise(letters);
    const out: string[] = [];
    for (const L of ALPHABET) {
      const hits = this.map.get(alphagram(base + L));
      if (hits) out.push(...hits);
    }
    return out;
  }

  /** Possible Words — the tension meter. See docs/~design-doc.md pillar 2. */
  possibleWords(letters: string): number {
    const base = normalise(letters);
    let n = 0;
    for (const L of ALPHABET) {
      n += this.map.get(alphagram(base + L))?.length ?? 0;
    }
    return n;
  }

  /**
   * Extensions grouped by the letter that was added.
   *
   * The AI needs this (a move *is* a letter choice). It is also exactly the
   * per-letter breakdown that would make a devastating assist mode — which is why
   * that's gated behind a difficulty setting and not shown by default.
   * See docs/open-questions.md U2.
   */
  extensionsByLetter(letters: string): Map<string, string[]> {
    const base = normalise(letters);
    const out = new Map<string, string[]>();
    for (const L of ALPHABET) {
      const hits = this.map.get(alphagram(base + L));
      if (hits) out.set(L, hits);
    }
    return out;
  }

  /** A word with no extensions ends the round. See docs/rules-spec.md §3. */
  isDeadEnd(letters: string): boolean {
    const base = normalise(letters);
    for (const L of ALPHABET) {
      if (this.map.has(alphagram(base + L))) return false;
    }
    return true;
  }
}

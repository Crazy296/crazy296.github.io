/**
 * A seeded PRNG, injected everywhere randomness is needed.
 *
 * Not for cryptography — for *reproducibility*. The balance sim (M3) has to be
 * able to replay a match exactly, and a bug report that says "the AI did something
 * mad on seed 12345" has to be reproducible. `Math.random()` gives us neither.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough, deterministic. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** Weighted draw. Entries with weight <= 0 can never be drawn. */
export function pickWeighted<T>(
  entries: ReadonlyArray<readonly [T, number]>,
  rng: Rng,
): T {
  const live = entries.filter(([, w]) => w > 0);
  const total = live.reduce((n, [, w]) => n + w, 0);
  let r = rng() * total;
  for (const [item, w] of live) {
    r -= w;
    if (r <= 0) return item;
  }
  return live[live.length - 1][0];
}

/**
 * M1's AI: plays a legal word, badly.
 *
 * This is a placeholder good enough to (a) prove the rules engine can run a whole
 * match unattended and (b) give the M3 balance sim something to drive. The real
 * opponent — vocabulary-tiered, memoised minimax — lands in M4.
 * See docs/ai-opponent.md.
 */

import type { Dictionary } from "../dictionary.ts";
import type { Opponent } from "../opponent.ts";
import { pick, type Rng } from "../rng.ts";
import type { GameState, Move } from "../types.ts";

export interface RandomAiOptions {
  /**
   * Chance of just letting the clock run out. The single cheapest and most
   * believable difficulty lever we have — humans do this constantly.
   * See docs/ai-opponent.md §4.
   */
  timeoutChance?: number;
  /**
   * "Dead-end greed": take an immediate dead-end when one is available, banking
   * the pot. Set true and this bot becomes the cheap-dead-end spammer whose
   * existence M3 has to rule out as degenerate. See docs/rules-spec.md §7.
   */
  seekDeadEnds?: boolean;
  /**
   * [min, max] ms to stall before answering, so the AI doesn't reply instantly on
   * a 45-second clock. Purely presentational — leave unset for the balance sim,
   * which wants the moves as fast as it can get them. The real think-time model
   * (the beast's tell) is M4, docs/ai-opponent.md §5.
   */
  thinkMs?: [number, number];
  /**
   * The only words this AI knows. Leave undefined and it knows all of ENABLE —
   * every obscurity in the long tail included, which is what makes the unhandicapped
   * bot feel unbeatable. See ai/difficulty.ts and docs/ai-opponent.md §4.
   */
  vocabulary?: ReadonlySet<string>;
  name?: string;
}

/** Resolves after `ms`, or rejects if the turn clock cancels us first. */
function think(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Move aborted"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Move aborted"));
      },
      { once: true },
    );
  });
}

export class RandomAi implements Opponent {
  readonly name: string;

  constructor(
    private readonly rng: Rng,
    private readonly opts: RandomAiOptions = {},
  ) {
    this.name = opts.name ?? "RandomAi";
  }

  async requestMove(
    state: GameState,
    dict: Dictionary,
    signal?: AbortSignal,
  ): Promise<Move> {
    const [lo, hi] = this.opts.thinkMs ?? [0, 0];
    if (hi > 0) await think(lo + this.rng() * (hi - lo), signal);

    if (this.rng() < (this.opts.timeoutChance ?? 0)) {
      return { kind: "timeout" };
    }

    const legal = dict.extensions(state.wordInPlay);
    // The engine never hands us a position with no legal move — the dead-end check
    // at the top of the turn would have ended the round first (rules-spec §3).
    if (legal.length === 0) {
      throw new Error(
        `AI asked to move in a dead-end position: ${state.wordInPlay}`,
      );
    }

    // ── The vocabulary handicap (docs/ai-opponent.md §4, lever 1) ─────────────
    // The position is never a dead end for the DICTIONARY — but it is regularly a
    // dead end for a player who only knows 5,000 words. When the AI knows no word
    // here, it does what a person does: nothing, until the clock runs out. That
    // hands the pot to the human, and it is the single most important reason Easy
    // is beatable. It is not the AI throwing the match — it genuinely doesn't know
    // a word.
    const vocabulary = this.opts.vocabulary;
    const moves = vocabulary
      ? legal.filter((word) => vocabulary.has(word))
      : legal;

    if (moves.length === 0) return { kind: "timeout" };

    if (this.opts.seekDeadEnds) {
      const kill = moves.filter((w) => dict.isDeadEnd(w));
      if (kill.length > 0) {
        // Take the biggest pot among the dead-ends.
        kill.sort((a, b) => b.length - a.length);
        return { kind: "submit", word: kill[0] };
      }
    }

    return { kind: "submit", word: pick(moves, this.rng) };
  }
}

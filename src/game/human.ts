/**
 * The human, behind the same one-method contract as the AI.
 *
 * GameScreen holds two Opponents and cannot tell them apart (docs/architecture.md
 * §4). This one simply parks its promise until the player presses Submit or Skip.
 *
 * The clock is NOT in here. The harness owns it, and cancels us via the signal —
 * at which point it dispatches `{kind:"timeout"}` itself. Skip Turn resolves the
 * identical move, because rules-spec §4 says they are the same thing.
 */

import type { Dictionary } from "./dictionary.ts";
import type { Opponent } from "./opponent.ts";
import type { GameState, Move } from "./types.ts";

/** Thrown into the harness when the turn clock cancels a pending human move. */
export class MoveAborted extends Error {
  constructor() {
    super("Move aborted");
    this.name = "MoveAborted";
  }
}

export class HumanOpponent implements Opponent {
  readonly name: string;

  private resolve: ((move: Move) => void) | null = null;
  private reject: ((err: Error) => void) | null = null;

  constructor(name = "You") {
    this.name = name;
  }

  /** Is the harness currently waiting on this player? */
  get isWaiting(): boolean {
    return this.resolve !== null;
  }

  requestMove(
    _state: GameState,
    _dict: Dictionary,
    signal?: AbortSignal,
  ): Promise<Move> {
    return new Promise<Move>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      signal?.addEventListener("abort", () => this.abort(), { once: true });
    });
  }

  /**
   * Play a word. The caller is expected to have already checked it is legal —
   * an invalid submission must not cost the player their turn (ui-ux §7), so the
   * UI screens it rather than letting the reducer throw.
   */
  play(word: string): void {
    this.settle()?.({ kind: "submit", word });
  }

  /** Skip Turn. Identical to letting the clock run out. */
  skip(): void {
    this.settle()?.({ kind: "timeout" });
  }

  private abort(): void {
    const reject = this.reject;
    this.resolve = null;
    this.reject = null;
    reject?.(new MoveAborted());
  }

  private settle(): ((move: Move) => void) | null {
    const resolve = this.resolve;
    this.resolve = null;
    this.reject = null;
    return resolve;
  }
}

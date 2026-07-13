/**
 * The opponent seam.
 *
 * The game loop holds two of these and cannot tell them apart:
 *
 *   solo vs AI   → [HumanOpponent, AiOpponent]
 *   hot-seat     → [HumanOpponent, HumanOpponent]     (free — we just don't ship it yet)
 *   balance sim  → [AiOpponent, AiOpponent]           (headless, no GameScreen at all)
 *
 * That third one is the reason this interface exists in M1 rather than whenever we
 * get around to multiplayer: it's how M3 answers "is cheap dead-ending degenerate?"
 * with data instead of an argument. See docs/architecture.md §4.
 */

import type { Dictionary } from "./dictionary.ts";
import type { GameState, Move } from "./types.ts";

export interface Opponent {
  readonly name: string;
  /**
   * Resolve with the move to play. The signal fires when the turn clock expires —
   * a human's promise is simply abandoned at that point and the harness dispatches
   * a timeout instead.
   */
  requestMove(
    state: GameState,
    dict: Dictionary,
    signal?: AbortSignal,
  ): Promise<Move>;
}

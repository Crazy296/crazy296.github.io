/**
 * The power system. THE HOOKS ARE REAL; THE POWERS ARE EMPTY.
 *
 * This file exists in M1 — long before any power is designed — because the
 * Rooster's Peck takes MEN → MET, which does not grow the word. That contradicts
 * the invariant the whole reducer is built on. Bolting it on later means rewriting
 * the state machine; carrying an empty hook table now costs nothing.
 *
 * See docs/characters.md §4 and docs/architecture.md §3.1.
 */

import type { Dictionary } from "../dictionary.ts";
import type {
  BeastId,
  GameState,
  PlayerId,
  PowerActivation,
} from "../types.ts";

export interface PowerContext {
  state: GameState;
  player: PlayerId;
  dict: Dictionary;
  activation: PowerActivation;
}

export interface Power {
  /** Passive, at the top of the turn. e.g. "your timer is +10s". */
  onTurnStart?(ctx: PowerContext): Partial<GameState>;

  /**
   * Mutate the word in play BEFORE the player submits. Peck lives here.
   *
   * Returns the new base. The player then still owes a normal legal submission —
   * exactly one letter longer than whatever this returns. That's how "remove k,
   * then add one" is expressed: the +1 invariant is relative to the POST-POWER
   * base, not the word at the start of the turn.
   *
   * The engine re-runs the dead-end check after this, because a power that shrinks
   * the word can REOPEN a dead end (FIXT is dead; peck the T and FIX is not).
   */
  beforeSubmit?(ctx: PowerContext): string;

  /** Relax or tighten legality. e.g. "you may add two letters this turn". */
  onValidate?(ctx: PowerContext, base: string, word: string): boolean;

  /** Modify a payout. e.g. "your pots are worth +2". */
  onScore?(ctx: PowerContext, points: number): number;
}

/**
 * Every beast's power implementation. All empty.
 *
 * Powers land in M6, 3–4 at a time, starting with Peck — precisely because it
 * stresses every hook. See docs/roadmap.md.
 */
export const POWERS: Partial<Record<BeastId, Power>> = {
  // rooster: { beforeSubmit: (ctx) => peck(ctx) },   ← M6
};

export function getPower(id: BeastId): Power | undefined {
  return POWERS[id];
}

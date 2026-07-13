/**
 * Core game types. Pure — no Pixi, no DOM.
 *
 * The authority for all of this is docs/rules-spec.md. If the two disagree, the
 * doc wins and this is a bug.
 */

export type PlayerId = 0 | 1;

export type BeastId =
  | "rat"
  | "ox"
  | "tiger"
  | "rabbit"
  | "dragon"
  | "snake"
  | "horse"
  | "goat"
  | "monkey"
  | "rooster"
  | "dog"
  | "pig";

/**
 * The engine never resolves a turn the active player cannot possibly complete, so
 * there is no phase for "thinking about an impossible position". A state handed to
 * a player is always AWAIT_MOVE.
 */
export type Phase = "AWAIT_MOVE" | "ROUND_END" | "MATCH_END";

export type RoundEndReason =
  /** The word in play has no extensions. The adder takes the pot. */
  | "dead_end"
  /** A timeout on an already-claimed word. Nobody scores. See rules-spec §4. */
  | "double_timeout";

/**
 * One turn, as it happened. The match transcript is built from these.
 *
 * `player` is who MOVED, which on a timeout is not who got paid: a timeout pays the
 * *adder* (rules-spec §4), i.e. the other player. That's why `paid` names its own
 * player rather than being assumed to be `player`.
 */
export interface TurnEntry {
  player: PlayerId;
  kind: "submit" | "timeout";
  /** submit: the word played. timeout: the word left standing on the board. */
  word: string;
  /** A mid-round timeout payout. Absent when the timeout paid nobody. */
  paid?: { player: PlayerId; points: number };
}

/** A round, start to finish. Archived into `GameState.rounds` when it ends. */
export interface RoundLog {
  roundNumber: number;
  seed: string;
  turns: TurnEntry[];
  finalWord: string;
  roundPoints: [number, number];
  /**
   * Absent when the match ended MID-round — a timeout payout can cross 100 and end
   * the match without the round ever ending (A10). The round still gets archived,
   * because it still happened; it just has no result.
   */
  result?: RoundResult;
}

export interface RoundResult {
  reason: RoundEndReason;
  finalWord: string;
  /**
   * The player paid by the round-ENDING event, and what it paid.
   *
   * This is NOT the round's total — timeouts pay out mid-round (§4), so a player
   * can bank points in a round that then ends on a double timeout paying nothing.
   * `scorer` is null exactly then, and on a bare seed nobody opened. For "what did
   * this round actually earn me", use `roundPoints`.
   */
  scorer: PlayerId | null;
  points: number;
  /** Everything each player earned this round, mid-round timeout payouts included. */
  roundPoints: [number, number];
}

/**
 * A power activation, offered alongside a submission.
 *
 * PLACEHOLDER SHAPE — no power is implemented yet (see beasts/powers.ts). The
 * engine carries this from day one because the Rooster's Peck breaks the growth
 * invariant, and retrofitting that means rewriting the reducer.
 * See docs/architecture.md §3.1.
 */
export interface PowerActivation {
  beast: BeastId;
  /** Power-specific. Peck would carry the index of the tile to tear out. */
  payload?: unknown;
}

export type Move =
  | { kind: "submit"; word: string; power?: PowerActivation }
  /** Skip Turn and clock-expiry are the same move. See rules-spec §4. */
  | { kind: "timeout" };

export interface GameState {
  phase: Phase;

  /** The seed letter at round start; normally grows by one letter per turn. */
  wordInPlay: string;
  /** The letter this round opened on. Kept for display. */
  seed: string;

  /** Who most recently added a letter. null until someone opens the round. */
  adder: PlayerId | null;
  /**
   * Has the current word already been cashed by a timeout?
   *
   * THIS FIELD IS THE ENTIRE TIMEOUT MODEL. Adding a letter clears it; a timeout
   * sets it; a timeout while it's already set ends the round paying nothing.
   * Delete it and a player who simply never moves prints infinite points for their
   * opponent. See docs/rules-spec.md §4 and the §4.1 trace.
   */
  claimed: boolean;

  activePlayer: PlayerId;
  scores: [number, number];
  /**
   * Points earned in the CURRENT round only. Resets on a new seed.
   *
   * Derived state, kept because it cannot be reconstructed at round end: a timeout
   * pays the adder immediately (§4) and the round then rolls on, so by the time the
   * round ends those points are indistinguishable from the rest of `scores`.
   */
  roundPoints: [number, number];

  beasts: [BeastId, BeastId];
  /** Once per ROUND, not per match. Resets on a new seed. */
  powerUsed: [boolean, boolean];

  /** Turns played in the CURRENT round, in order. Resets on a new seed. */
  roundTurns: TurnEntry[];
  /** Every round that has finished. The match transcript. */
  rounds: RoundLog[];

  /** Alternates every round. */
  roundStarter: PlayerId;
  roundNumber: number;

  /** Set when phase is ROUND_END or MATCH_END. */
  lastRound?: RoundResult;
  winner?: PlayerId;
}

/** A rejected submission, with a reason the UI can actually show the player. */
export type Rejection =
  | { code: "not_a_word"; word: string }
  | { code: "wrong_length"; word: string; expected: number }
  | { code: "wrong_letters"; word: string; base: string }
  | { code: "power_unavailable"; beast: BeastId }
  | { code: "power_not_implemented"; beast: BeastId }
  | { code: "not_awaiting_move" };

export class IllegalMoveError extends Error {
  constructor(readonly rejection: Rejection) {
    super(`Illegal move: ${rejection.code}`);
    this.name = "IllegalMoveError";
  }
}

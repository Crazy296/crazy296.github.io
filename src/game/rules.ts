/**
 * The rules engine. A pure reducer — no Pixi, no DOM, no clock, no randomness
 * except what you inject.
 *
 * Implements docs/rules-spec.md §8. Read that first; this is just the code.
 *
 * NOTE ON THE CLOCK: the state has no `turnEndsAt`. A pure reducer that reads
 * Date.now() isn't pure, isn't testable, and can't be replayed by the balance sim.
 * The clock lives in the presentation layer, which dispatches `{kind:"timeout"}`
 * when it expires. Skip Turn dispatches exactly the same move — which is precisely
 * what the rules say they are (rules-spec §4).
 */

import type { Dictionary } from "./dictionary.ts";
import { normalise } from "./alphagram.ts";
import { getPower } from "./beasts/powers.ts";
import { getBeast } from "./beasts/roster.ts";
import { pickWeighted, type Rng } from "./rng.ts";
import {
  IllegalMoveError,
  type BeastId,
  type GameState,
  type Move,
  type PlayerId,
  type PowerActivation,
  type RoundResult,
} from "./types.ts";

export const TARGET_SCORE = 100;
export const TURN_SECONDS = 45;

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

// ── Legality ────────────────────────────────────────────────────────────────

/**
 * Does `word` use every letter of `base` plus exactly one new one?
 *
 * Multiplicity matters and is handled by consuming from a pool: TOO → TOOL is
 * fine, TOO → TOOO is not (and isn't a word anyway).
 */
export function isExtensionOf(base: string, word: string): boolean {
  if (word.length !== base.length + 1) return false;
  const pool = word.split("");
  for (const ch of base) {
    const i = pool.indexOf(ch);
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  return pool.length === 1;
}

// ── Round setup ─────────────────────────────────────────────────────────────

export function drawSeed(dict: Dictionary, rng: Rng): string {
  return pickWeighted([...dict.seedWeights.entries()], rng);
}

export function createMatch(
  beasts: [BeastId, BeastId],
  dict: Dictionary,
  rng: Rng,
  starter: PlayerId = 0,
): GameState {
  const seed = drawSeed(dict, rng);
  return resolveTurnStart(
    {
      phase: "AWAIT_MOVE",
      wordInPlay: seed,
      seed,
      adder: null,
      claimed: false,
      activePlayer: starter,
      scores: [0, 0],
      roundPoints: [0, 0],
      beasts,
      powerUsed: [false, false],
      roundStarter: starter,
      roundNumber: 1,
    },
    dict,
  );
}

/** Begin the next round. Call when phase is ROUND_END. */
export function nextRound(
  state: GameState,
  dict: Dictionary,
  rng: Rng,
): GameState {
  const starter = other(state.roundStarter);
  const seed = drawSeed(dict, rng);
  return resolveTurnStart(
    {
      ...state,
      phase: "AWAIT_MOVE",
      wordInPlay: seed,
      seed,
      adder: null,
      claimed: false,
      activePlayer: starter,
      roundPoints: [0, 0], // like powerUsed: per ROUND, not per match
      powerUsed: [false, false], // once per ROUND
      roundStarter: starter,
      roundNumber: state.roundNumber + 1,
      lastRound: undefined,
    },
    dict,
  );
}

/**
 * The top of every turn: if the word cannot be extended, the round is already
 * over and the active player never gets a turn they cannot complete.
 *
 * This is why a player who plays a dead-end word scores IMMEDIATELY rather than
 * waiting out their opponent's clock. rules-spec §3 step 1.
 */
function resolveTurnStart(state: GameState, dict: Dictionary): GameState {
  if (dict.isDeadEnd(state.wordInPlay)) {
    return endRound(state, "dead_end");
  }
  return state;
}

// ── Scoring & round end ─────────────────────────────────────────────────────

/** Flat: one point per letter. The tuning knob is rules-spec §7. */
export function scoreFor(word: string): number {
  return word.length;
}

/** Pays `player`, both on the match scoreboard and on the round's running tally. */
function award(
  state: GameState,
  player: PlayerId,
  points: number,
): Pick<GameState, "scores" | "roundPoints"> {
  const scores: [number, number] = [...state.scores];
  const roundPoints: [number, number] = [...state.roundPoints];
  scores[player] += points;
  roundPoints[player] += points;
  return { scores, roundPoints };
}

function endRound(
  state: GameState,
  reason: "dead_end" | "double_timeout",
): GameState {
  let { scores, roundPoints } = state;
  let result: RoundResult;

  if (reason === "dead_end" && state.adder !== null) {
    const points = scoreFor(state.wordInPlay);
    ({ scores, roundPoints } = award(state, state.adder, points));
    result = {
      reason,
      finalWord: state.wordInPlay,
      scorer: state.adder,
      points,
      roundPoints: [...roundPoints],
    };
  } else {
    // Either a double timeout (already paid on the first one), or a dead-end seed
    // nobody ever opened — which seeding makes impossible (rules-spec §6), but the
    // engine must not assume the dictionary is well-behaved.
    //
    // The round-ending event pays nothing — but earlier timeouts in this round may
    // well have, so `roundPoints` is not necessarily [0, 0] here. That distinction
    // is the whole reason it exists.
    result = {
      reason,
      finalWord: state.wordInPlay,
      scorer: null,
      points: 0,
      roundPoints: [...roundPoints],
    };
  }

  return withWinCheck({
    ...state,
    phase: "ROUND_END",
    scores,
    roundPoints,
    lastRound: result,
  });
}

/**
 * "First to 100 wins" — checked after ANY scoring event, including a mid-round
 * timeout payout. The spec's §5 put the win check at round end only, which would
 * leave a player who crosses 100 on a timeout still grinding out the rest of a
 * round they've already won. Immediate is snappier and matches what the rule
 * actually says. See docs/open-questions.md A10.
 */
function withWinCheck(state: GameState): GameState {
  const [a, b] = state.scores;
  if (a < TARGET_SCORE && b < TARGET_SCORE) return state;
  const winner: PlayerId = a >= b ? 0 : 1;
  return { ...state, phase: "MATCH_END", winner };
}

// ── The reducer ─────────────────────────────────────────────────────────────

export function applyMove(
  state: GameState,
  move: Move,
  dict: Dictionary,
): GameState {
  if (state.phase !== "AWAIT_MOVE") {
    throw new IllegalMoveError({ code: "not_awaiting_move" });
  }
  return move.kind === "timeout"
    ? applyTimeout(state, dict)
    : applySubmit(state, move.word, dict, move.power);
}

/**
 * Timeout / Skip — the claim model (rules-spec §4).
 *
 * Adding a letter makes the word claimable. A timeout claims it for the adder and
 * hands them the turn. A timeout on an already-claimed word ends the round paying
 * nothing.
 */
function applyTimeout(state: GameState, dict: Dictionary): GameState {
  // Second timeout in a row, no letter added between. Round over, nobody paid.
  if (state.claimed) return endRound(state, "double_timeout");

  // Nobody has opened the round yet, so there is no adder to pay. Nobody scores;
  // the turn passes and the seed stands (rules-spec §4, the `adder == null` case).
  //
  // We still set `claimed`, which reads oddly — nothing was cashed. But it is the
  // right encoding: it means "this word has already been timed out on once", so a
  // second consecutive whiff falls into the double-timeout branch above and ends
  // the round instead of looping forever on a seed neither player will open.
  if (state.adder === null) {
    return {
      ...state,
      claimed: true,
      activePlayer: other(state.activePlayer),
    };
  }

  const points = scoreFor(state.wordInPlay);
  const { scores, roundPoints } = award(state, state.adder, points);

  return withWinCheck(
    resolveTurnStart(
      {
        ...state,
        scores,
        roundPoints,
        claimed: true,
        // The turn passes to the player who just scored — they must extend their
        // own word. This is what makes stalling self-harming rather than
        // exploitable. rules-spec §4, and the doc's own ME → MEN example.
        activePlayer: state.adder,
      },
      dict,
    ),
  );
}

function applySubmit(
  state: GameState,
  raw: string,
  dict: Dictionary,
  activation?: PowerActivation,
): GameState {
  const word = normalise(raw);
  const player = state.activePlayer;

  // ── HOOK: beforeSubmit ────────────────────────────────────────────────────
  // A power may change the word in play before the submission is judged. The +1
  // invariant then applies to the POST-POWER base — that's how "remove k, then add
  // one" works, and it's the whole reason this hook exists in M1.
  let base = state.wordInPlay;
  let powerUsed = state.powerUsed;

  if (activation) {
    base = applyBeforeSubmit(state, player, dict, activation);
    powerUsed = [...state.powerUsed] as [boolean, boolean];
    powerUsed[player] = true;
  }

  // ── Validate against the (possibly mutated) base ───────────────────────────
  if (word.length !== base.length + 1) {
    throw new IllegalMoveError({
      code: "wrong_length",
      word,
      expected: base.length + 1,
    });
  }
  if (!isExtensionOf(base, word)) {
    throw new IllegalMoveError({ code: "wrong_letters", word, base });
  }
  if (!dict.isValid(word)) {
    throw new IllegalMoveError({ code: "not_a_word", word });
  }

  // A fresh letter makes the word claimable again.
  return resolveTurnStart(
    {
      ...state,
      wordInPlay: word,
      adder: player,
      claimed: false,
      powerUsed,
      activePlayer: other(player),
    },
    dict,
  );
}

function applyBeforeSubmit(
  state: GameState,
  player: PlayerId,
  dict: Dictionary,
  activation: PowerActivation,
): string {
  const beast = getBeast(activation.beast);

  if (state.beasts[player] !== activation.beast || state.powerUsed[player]) {
    throw new IllegalMoveError({
      code: "power_unavailable",
      beast: activation.beast,
    });
  }
  if (!beast.power.implemented) {
    throw new IllegalMoveError({
      code: "power_not_implemented",
      beast: activation.beast,
    });
  }

  const power = getPower(activation.beast);
  if (!power?.beforeSubmit) {
    throw new IllegalMoveError({
      code: "power_not_implemented",
      beast: activation.beast,
    });
  }

  return power.beforeSubmit({ state, player, dict, activation });
}

// ── Convenience for the UI and the AI ───────────────────────────────────────

/** Every legal word the active player could submit right now. */
export function legalMoves(state: GameState, dict: Dictionary): string[] {
  return dict.extensions(state.wordInPlay);
}

/** The tension meter. */
export function possibleWords(state: GameState, dict: Dictionary): number {
  return dict.possibleWords(state.wordInPlay);
}

/** What the active player stands to lose if they let the clock run out. */
export function potAtStake(state: GameState): number {
  return state.adder === null || state.claimed ? 0 : scoreFor(state.wordInPlay);
}

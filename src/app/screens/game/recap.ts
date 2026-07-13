/**
 * The shareable match recap — the thing you paste into the group chat.
 *
 * Pure and Pixi-free, so scripts/verify-rules.ts can print one headless. It reads
 * the transcript the reducer keeps (`GameState.rounds`) and renders it; it derives
 * nothing about the rules on its own.
 *
 * Emoji, not words, because the whole point is that it survives a paste into
 * anything: 🟩 is YOU, 🟥 is the AI, ⏱ is a turn that ran out of clock.
 */

import type { GameState, PlayerId, RoundLog } from "../../../game/types";

const MARK: readonly [string, string] = ["🟩", "🟥"];

/** Long matches are real: 17+ rounds is normal. Keep the paste sane. */
const MAX_ROUNDS = 12;

export interface RecapOptions {
  names: readonly [string, string];
  /** e.g. "MEDIUM AI" — a playtest report needs to say which AI. */
  subtitle?: string;
  /** The match seed. Makes a bug report reproducible. */
  seed?: number;
}

function roundBlock(round: RoundLog, names: readonly [string, string]): string {
  const took = round.roundPoints
    .map((points, i) => ({ points, name: names[i as PlayerId] }))
    .filter((t) => t.points > 0)
    .map((t) => `${t.name} +${t.points}`);

  const header = [
    `ROUND ${round.roundNumber}`,
    round.result === undefined
      ? "match ended mid-round"
      : round.result.reason === "dead_end"
        ? "dead end"
        : "double timeout",
    took.length > 0 ? took.join(", ") : "nobody scores",
  ].join(" · ");

  const lines = round.turns.map((turn) => {
    const mark = MARK[turn.player];
    if (turn.kind === "submit") return `${mark} ${turn.word}`;

    // A timeout pays the ADDER — the other player — so name who got paid rather
    // than letting the square imply it.
    return turn.paid
      ? `${mark} ⏱ — ${names[turn.paid.player]} +${turn.paid.points}`
      : `${mark} ⏱`;
  });

  return [header, ...lines].join("\n");
}

export function buildRecap(state: GameState, opts: RecapOptions): string {
  const { names } = opts;
  const winner = state.winner ?? 0;

  const head = [
    "Spelling Beasts 🐓",
    `${names[0]} ${state.scores[0]} — ${state.scores[1]} ${names[1]}   (${names[winner]} wins)`,
    opts.subtitle ?? "",
    `${MARK[0]} ${names[0]}   ${MARK[1]} ${names[1]}   ⏱ timed out`,
  ].filter((line) => line !== "");

  const shown = state.rounds.slice(0, MAX_ROUNDS);
  const dropped = state.rounds.length - shown.length;

  const body = shown.map((round) => roundBlock(round, names));

  // Never silently truncate — a recap that quietly drops eight rounds reads as a
  // much shorter match than the one that was actually played.
  if (dropped > 0) {
    body.push(`… and ${dropped} more round${dropped === 1 ? "" : "s"}`);
  }

  const foot = opts.seed !== undefined ? [`seed ${opts.seed}`] : [];

  return [head.join("\n"), ...body, ...foot].join("\n\n");
}

/**
 * What Character Select hands to the Game screen.
 *
 * The template's navigation constructs screens with no arguments, so the setup
 * has to live somewhere both can see. Deliberately tiny — this is a handoff, not
 * a state store. GameState is the state store.
 */

import { DEFAULT_DIFFICULTY, type DifficultyId } from "../game/ai/difficulty";
import type { BeastId } from "../game/types";

export interface MatchSetup {
  /** [player, ai] — index is PlayerId. */
  beasts: [BeastId, BeastId];
  /** How many words the AI is allowed to know. See game/ai/difficulty.ts. */
  difficulty: DifficultyId;
  /** Seeded so a mad match can be replayed. See game/rng.ts. */
  seed: number;
}

let setup: MatchSetup = {
  beasts: ["rooster", "dragon"],
  difficulty: DEFAULT_DIFFICULTY,
  seed: 1,
};

export function setMatchSetup(next: MatchSetup): void {
  setup = next;
}

export function getMatchSetup(): MatchSetup {
  return setup;
}

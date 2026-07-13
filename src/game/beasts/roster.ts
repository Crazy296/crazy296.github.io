/**
 * The twelve Chinese zodiac beasts.
 *
 * Emoji are placeholders (docs/ui-ux.md §6). Powers are placeholders
 * (docs/characters.md §1) — `implemented: false` on all of them, and the character
 * select screen is required to SAY SO rather than quietly shipping twelve
 * identical beasts.
 */

import type { BeastId } from "../types.ts";

export interface Beast {
  id: BeastId;
  name: string;
  emoji: string;
  power: {
    name: string;
    description: string;
    /** When false, activating it is rejected. No real power is implemented yet. */
    implemented: boolean;
    /**
     * A DEVELOPMENT TOOL wearing a beast costume — not a game power, not balanced,
     * and not something a playtester should ever be handed by accident. It lives in
     * the presentation layer and cannot touch the reducer (`implemented` stays
     * false, so the engine still rejects it as an activation).
     *
     * Every screen that shows this beast is required to say DEBUG.
     */
    debug?: boolean;
  };
}

const TBD = {
  name: "???",
  description: "Power not yet designed.",
  implemented: false,
};

export const BEASTS: readonly Beast[] = [
  { id: "rat", name: "Rat", emoji: "🐀", power: { ...TBD } },
  { id: "ox", name: "Ox", emoji: "🐂", power: { ...TBD } },
  { id: "tiger", name: "Tiger", emoji: "🐅", power: { ...TBD } },
  { id: "rabbit", name: "Rabbit", emoji: "🐇", power: { ...TBD } },
  {
    id: "dragon",
    name: "Dragon",
    emoji: "🐉",
    power: {
      name: "Dragon's Eye",
      description: "Lights up every letter that would make a real word.",
      // NOT a power. A debug tool — and the assist mode open-questions.md U2 says
      // must never be the default (ui-ux.md §2: "the one thing to never do"). It
      // reads the dictionary and paints the rack; it never enters the reducer.
      implemented: false,
      debug: true,
    },
  },
  { id: "snake", name: "Snake", emoji: "🐍", power: { ...TBD } },
  { id: "horse", name: "Horse", emoji: "🐎", power: { ...TBD } },
  { id: "goat", name: "Goat", emoji: "🐐", power: { ...TBD } },
  { id: "monkey", name: "Monkey", emoji: "🐒", power: { ...TBD } },
  {
    id: "rooster",
    name: "Rooster",
    emoji: "🐓",
    power: {
      name: "Peck",
      description:
        "Once per round, remove a letter from the word before playing your own.",
      // The worked example, and the one that stresses every hook: it makes a turn
      // net-zero in length, shrinks the pot, and can reopen a dead end.
      // See docs/characters.md §3. Lands in M6.
      implemented: false,
    },
  },
  { id: "dog", name: "Dog", emoji: "🐕", power: { ...TBD } },
  { id: "pig", name: "Pig", emoji: "🐖", power: { ...TBD } },
];

export const BEAST_BY_ID: ReadonlyMap<BeastId, Beast> = new Map(
  BEASTS.map((b) => [b.id, b]),
);

export function getBeast(id: BeastId): Beast {
  const b = BEAST_BY_ID.get(id);
  if (!b) throw new Error(`Unknown beast: ${id}`);
  return b;
}

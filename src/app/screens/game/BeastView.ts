/**
 * A beast, flanking the board (ui-ux §6).
 *
 * Emoji placeholder — they carry a startling amount of personality for zero art
 * cost, and art direction is deliberately not blocking. Idle / thinking / smug /
 * panicking / triumphant and the Spine rig are M7; the only state M2 needs is
 * "whose turn is it".
 *
 * The power line says NOT IMPLEMENTED, on purpose. Twelve identical beasts that
 * quietly pretend otherwise would waste a playtest. characters.md §5.
 */

import { Container } from "pixi.js";

import { getBeast } from "../../../game/beasts/roster";
import type { BeastId } from "../../../game/types";
import { Label } from "../../ui/Label";

export const EMOJI_FONT =
  "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif";

export class BeastView extends Container {
  private readonly face: Label;
  private readonly nameLabel: Label;
  private readonly power: Label;
  private readonly turn: Label;

  constructor(id: BeastId, owner: string) {
    super();
    const beast = getBeast(id);

    this.face = new Label({
      text: beast.emoji,
      style: { fontFamily: EMOJI_FONT, fontSize: 96 },
    });

    this.nameLabel = new Label({
      text: `${owner} · ${beast.name.toUpperCase()}`,
      style: { fill: 0xf2e9de, fontSize: 18, letterSpacing: 1 },
    });
    this.nameLabel.y = 70;

    this.power = new Label({
      text: beast.power.debug
        ? `${beast.power.name} [DEBUG]`
        : `${beast.power.name} (stub)`,
      style: {
        fill: beast.power.debug ? 0xeb5757 : 0x777777,
        fontSize: 14,
      },
    });
    this.power.y = 94;

    this.turn = new Label({
      text: "",
      style: { fill: 0xf2c14e, fontSize: 16, letterSpacing: 2 },
    });
    this.turn.y = -80;

    this.addChild(this.face, this.nameLabel, this.power, this.turn);
    this.setActive(false);
  }

  setActive(active: boolean, label = ""): void {
    this.alpha = active ? 1 : 0.45;
    this.face.scale.set(active ? 1.1 : 1);
    this.turn.text = active ? label : "";
  }
}

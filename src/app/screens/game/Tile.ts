/**
 * One letter tile. The game's atom.
 *
 * M2 is deliberately ugly (docs/roadmap.md) — this is Graphics and Text, no
 * textures, no juice. The tile *states* are the part that matters, because they
 * are how the player reads their own arrangement back:
 *
 *   word     the word in play, up top. Reference, not interactive.
 *   base     a letter you took from the word in play.
 *   new      THE new letter. Exactly one of these is legal. Gold, so it's obvious
 *            which letter is the move — a turn is fully described by this tile
 *            (docs/~design-doc.md §5).
 *   surplus  a letter that isn't in the base and isn't your first new one. Red.
 *   valid    the whole arrangement is a real word and a legal extension.
 *   muted    a rack letter you can't use right now.
 */

import { Container, Graphics } from "pixi.js";

import { Label } from "../../ui/Label";

export type TileState = "word" | "base" | "new" | "surplus" | "valid" | "muted";

const FILL: Record<TileState, number> = {
  word: 0xf2e9de,
  base: 0xf2e9de,
  new: 0xf2c14e,
  surplus: 0xeb5757,
  valid: 0x6fcf97,
  muted: 0x3a3a3a,
};

const BORDER: Record<TileState, number> = {
  word: 0xbfae9b,
  base: 0xbfae9b,
  new: 0xc79a2f,
  surplus: 0xb03a3a,
  valid: 0x4aa76d,
  muted: 0x4a4a4a,
};

const TEXT: Record<TileState, number> = {
  word: 0x2b2b2b,
  base: 0x2b2b2b,
  new: 0x2b2b2b,
  surplus: 0xffffff,
  valid: 0x1f4030,
  muted: 0x8a8a8a,
};

export class Tile extends Container {
  readonly size: number;

  private readonly bg = new Graphics();
  private readonly glyph: Label;
  private _letter: string;
  private _state: TileState = "word";

  constructor(letter: string, size = 72, state: TileState = "word") {
    super();
    this.size = size;
    this._letter = letter;

    this.glyph = new Label({
      text: letter,
      style: { fill: TEXT[state], fontSize: Math.round(size * 0.55) },
    });

    this.addChild(this.bg, this.glyph);
    this.state = state;
  }

  get letter(): string {
    return this._letter;
  }

  set letter(value: string) {
    if (value === this._letter) return;
    this._letter = value;
    this.glyph.text = value;
  }

  get state(): TileState {
    return this._state;
  }

  set state(value: TileState) {
    this._state = value;
    this.glyph.style.fill = TEXT[value];

    const s = this.size;
    this.bg
      .clear()
      .roundRect(-s / 2, -s / 2, s, s, s * 0.15)
      .fill(FILL[value])
      .stroke({ width: 3, color: BORDER[value], alignment: 1 });
  }
}

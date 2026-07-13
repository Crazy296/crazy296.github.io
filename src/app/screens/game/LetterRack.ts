/**
 * The click-to-place path. Two racks:
 *
 *   PoolRack      the letters of the word in play you haven't placed yet.
 *   AlphabetRack  A–Z — where your ONE new letter comes from. Goes dead once
 *                 you've placed it, because a turn is exactly one new letter.
 *
 * Splitting them this way makes the rule visible in the furniture: everything on
 * the left you already had, and you get precisely one thing from the right.
 */

import { Container } from "pixi.js";

import { ALPHABET } from "../../../game/alphagram";
import { Label } from "../../ui/Label";

import { Tile } from "./Tile";
import { TileRow } from "./TileRow";

/** The letters of the word in play that are still waiting to be placed. */
export class PoolRack extends TileRow {
  onPick: (letter: string) => void = () => {};

  private readonly wired = new WeakSet<Tile>();
  private readonly caption: Label;

  constructor() {
    super(52, 26); // gap = half a tile, same clear air as the word rows

    this.caption = new Label({
      text: "letters left to place",
      style: { fill: 0x777777, fontSize: 15 },
    });
    this.caption.y = -34;
    this.addChild(this.caption);
  }

  setPool(letters: string[]): void {
    this.setLetters(
      letters,
      letters.map(() => "base" as const),
    );
    for (const tile of this.tiles) this.wire(tile);
    this.caption.visible = letters.length > 0;
  }

  private wire(tile: Tile): void {
    if (this.wired.has(tile)) return;
    this.wired.add(tile);
    tile.eventMode = "static";
    tile.cursor = "pointer";
    tile.on("pointertap", () => this.onPick(tile.letter));
  }
}

/** A–Z. The source of the one new letter. */
export class AlphabetRack extends Container {
  onPick: (letter: string) => void = () => {};

  private readonly tiles: Tile[] = [];
  private readonly caption: Label;
  private enabled = true;
  /** Dragon's Eye. Null when it's off, which is nearly always. */
  private hints: ReadonlySet<string> | null = null;

  constructor() {
    super();

    // One strip, not two rows: it reads as "the alphabet", and the vertical space
    // below the word is the scarcest thing on this screen. The tiles are smaller
    // than the word tiles so that 26 of them, each with a half-tile gap, still fit
    // across the 1024px design width (26 × 36 = 936).
    const size = 24;
    const gap = 12;
    const perRow = 26;

    ALPHABET.forEach((letter, i) => {
      const tile = new Tile(letter, size, "muted");
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      tile.position.set(
        (col - (perRow - 1) / 2) * (size + gap),
        row * (size + gap),
      );
      tile.eventMode = "static";
      tile.cursor = "pointer";
      tile.on("pointertap", () => {
        if (this.enabled) this.onPick(letter);
      });
      this.addChild(tile);
      this.tiles.push(tile);
    });

    this.caption = new Label({
      text: "…or click your new letter",
      style: { fill: 0x777777, fontSize: 15 },
    });
    this.caption.position.set(0, -28);
    this.addChild(this.caption);
  }

  /**
   * Live only while the player still owes a new letter. Once it's placed, the
   * rack greys out — you don't get a second one.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.render();
  }

  /**
   * DRAGON'S EYE — a DEBUG TOOL, not a power.
   *
   * Light up every letter that would make a real word (BARQUES → U for ARQUEBUS,
   * O for BAROQUES). Pass null to switch it off.
   *
   * This is the assist mode `open-questions.md` **U2** is about, and `ui-ux.md` §2
   * files it under "the one thing to never do" — it hands the player the dead-end
   * letters for free, which is the entire game. It exists so we can debug the
   * dictionary and the dead-end logic against a real board. **It must never become
   * the default**, and the beast that carries it says DEBUG on every screen it
   * appears on.
   */
  setHints(hints: ReadonlySet<string> | null): void {
    this.hints = hints;
    this.render();
  }

  private render(): void {
    for (const tile of this.tiles) {
      const playable = this.hints?.has(tile.letter) ?? false;

      tile.state = !this.enabled
        ? "muted"
        : this.hints
          ? playable
            ? "valid"
            : "muted"
          : "new";
      tile.cursor = this.enabled ? "pointer" : "default";
    }

    if (!this.enabled) {
      this.caption.text = "new letter placed";
      return;
    }

    this.caption.text = this.hints
      ? `DRAGON'S EYE [debug] — ${this.hints.size} letters make a word`
      : "…or click your new letter";
  }
}

/**
 * A centred row of tiles that slides between arrangements.
 *
 * Tiles are reused across `setLetters` calls, so when the player types M-A-N-E the
 * existing tiles *slide* into the new arrangement rather than blinking. That
 * sliding is the whole point of the tile layer: typing is the fast input path, but
 * the tiles are what make it read as an arrangement the player produced, rather
 * than a text box. See docs/ui-ux.md §2.
 *
 * THE SLIDE IS DRIVEN BY THE TICKER, NOT BY `motion`. It used to call
 * `animate(tile, {x})` per tile per layout. Every keystroke relayouts the row, and
 * motion does not cancel a running tween when you start a new one on the same
 * object property — so the tweens raced, and a tile could be left stranded between
 * two slots (or dragged back to the slot it held one letter ago) by whichever tween
 * happened to finish last. That renders as letters overlapping and a word that
 * grows to the right instead of staying centred.
 *
 * A tile has exactly one target — the slot it belongs in — and we ease it there.
 * There is nothing to race.
 */

import { Container } from "pixi.js";

import { Tile, type TileState } from "./Tile";

/** Fraction of the remaining distance to close per second. Snappy, not floaty. */
const EASE = 18;

export class TileRow extends Container {
  protected tiles: Tile[] = [];

  /** Where each tile is heading. Index-aligned with `tiles`. */
  private targets: number[] = [];

  /**
   * A tile that layout must not touch — it's under the player's finger. Without
   * this, the slide fights the drag.
   */
  protected frozen = -1;

  constructor(
    protected readonly tileSize = 72,
    protected readonly gap = 10,
  ) {
    super();
  }

  get length(): number {
    return this.tiles.length;
  }

  /** The x each slot sits at, with the whole row centred on this container. */
  protected slotX(index: number, count = this.tiles.length): number {
    const step = this.tileSize + this.gap;
    return (index - (count - 1) / 2) * step;
  }

  setLetters(letters: string[], states: TileState[], animated = true): void {
    // Grow / shrink the pool.
    while (this.tiles.length < letters.length) {
      const tile = new Tile("", this.tileSize);
      // A tile that has just appeared starts where it will live, so it pops rather
      // than sliding in from wherever the last tile in the pool happened to be.
      tile.position.set(this.slotX(this.tiles.length, letters.length), 0);
      this.addChild(tile);
      this.tiles.push(tile);
    }
    while (this.tiles.length > letters.length) {
      const tile = this.tiles.pop()!;
      this.removeChild(tile);
      tile.destroy();
    }

    this.tiles.forEach((tile, i) => {
      tile.letter = letters[i];
      tile.state = states[i];
    });

    this.layout(animated);
  }

  protected layout(animated = true): void {
    this.targets = this.tiles.map((_, i) => this.slotX(i));

    if (animated) return; // `update` will walk them there

    this.tiles.forEach((tile, i) => {
      if (i === this.frozen) return;
      tile.position.set(this.targets[i], 0);
    });
  }

  /** @param dt seconds since the last frame. Called by the screen's ticker. */
  update(dt: number): void {
    const k = Math.min(1, dt * EASE);

    this.tiles.forEach((tile, i) => {
      if (i === this.frozen) return; // being dragged

      const target = this.targets[i] ?? 0;
      const dx = target - tile.position.x;
      tile.position.x = Math.abs(dx) < 0.5 ? target : tile.position.x + dx * k;

      const dy = 0 - tile.position.y;
      tile.position.y = Math.abs(dy) < 0.5 ? 0 : tile.position.y + dy * k;
    });
  }

  clear(): void {
    this.setLetters([], [], false);
  }
}

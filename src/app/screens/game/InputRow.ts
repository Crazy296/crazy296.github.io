/**
 * The arrangement the player is building. Typing is the fast path; this adds the
 * slow one — drag a tile to move it (docs/ui-ux.md §2, "for people who think with
 * their hands").
 *
 * Both paths converge on the same thing: an ordered arrangement the player chose.
 * Neither hands them the answer, which is the constraint everything here exists to
 * protect (§1).
 */

import type { FederatedPointerEvent } from "pixi.js";

import type { Tile, TileState } from "./Tile";
import { TileRow } from "./TileRow";

export class InputRow extends TileRow {
  /** Fired on drop, with the new order. */
  onReorder: (letters: string[]) => void = () => {};

  private readonly wired = new WeakSet<Tile>();
  private letters: string[] = [];
  private dragIndex = -1;
  private grabOffset = 0;

  constructor(tileSize = 72, gap = 10) {
    super(tileSize, gap);
    this.sortableChildren = true;
  }

  override setLetters(
    letters: string[],
    states: TileState[],
    animated = true,
  ): void {
    this.letters = [...letters];
    super.setLetters(letters, states, animated);
    for (const tile of this.tiles) this.wire(tile);
  }

  private wire(tile: Tile): void {
    if (this.wired.has(tile)) return;
    this.wired.add(tile);

    tile.eventMode = "static";
    tile.cursor = "grab";
    tile.on("pointerdown", (e: FederatedPointerEvent) => this.grab(tile, e));
    tile.on("globalpointermove", (e: FederatedPointerEvent) => this.move(e));
    tile.on("pointerup", () => this.drop());
    tile.on("pointerupoutside", () => this.drop());
  }

  private grab(tile: Tile, e: FederatedPointerEvent): void {
    this.dragIndex = this.tiles.indexOf(tile);
    if (this.dragIndex === -1) return;

    this.frozen = this.dragIndex;
    this.grabOffset = tile.position.x - this.toLocal(e.global).x;
    tile.zIndex = 10;
    tile.cursor = "grabbing";
    tile.scale.set(1.08);
  }

  private move(e: FederatedPointerEvent): void {
    const tile = this.tiles[this.dragIndex];
    if (!tile) return;

    const x = this.toLocal(e.global).x + this.grabOffset;
    tile.position.x = x;

    // Which slot is the tile hovering over?
    const step = this.tileSize + this.gap;
    const target = Math.min(
      this.tiles.length - 1,
      Math.max(0, Math.round(x / step + (this.tiles.length - 1) / 2)),
    );

    if (target !== this.dragIndex) {
      this.tiles.splice(target, 0, ...this.tiles.splice(this.dragIndex, 1));
      this.letters.splice(target, 0, ...this.letters.splice(this.dragIndex, 1));
      this.dragIndex = target;
      this.frozen = target;
      this.layout(true); // the other tiles slide out of the way
    }
  }

  private drop(): void {
    const tile = this.tiles[this.dragIndex];
    if (!tile) return;

    tile.zIndex = 0;
    tile.cursor = "grab";
    tile.scale.set(1);
    this.dragIndex = -1;
    this.frozen = -1;

    this.layout(true);
    this.onReorder([...this.letters]);
  }
}

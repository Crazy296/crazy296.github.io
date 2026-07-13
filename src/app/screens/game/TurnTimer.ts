/**
 * The turn clock.
 *
 * It lives HERE, in the presentation layer, and not in GameState — a reducer that
 * reads the wall clock can't be replayed by the balance sim. When it expires the
 * screen dispatches `{kind:"timeout"}`, which is the exact move Skip Turn sends.
 * See docs/open-questions.md A11 and docs/rules-spec.md §4.
 */

import { Container, Graphics } from "pixi.js";

import { Label } from "../../ui/Label";

const WIDTH = 420;
const HEIGHT = 26;

export class TurnTimer extends Container {
  /** Fired once, when the clock hits zero. */
  onExpire: () => void = () => {};

  private readonly bar = new Graphics();
  private readonly readout: Label;

  private duration = 1;
  private remaining = 0;
  private running = false;

  constructor() {
    super();

    this.readout = new Label({
      text: "0:45",
      style: { fill: 0xf2e9de, fontSize: 22 },
    });
    this.readout.x = WIDTH / 2 + 40;

    this.addChild(this.bar, this.readout);
    this.render();
  }

  start(seconds: number): void {
    this.duration = seconds;
    this.remaining = seconds;
    this.running = true;
    this.render();
  }

  stop(): void {
    this.running = false;
  }

  /** Pick up where we left off — the pause popup doesn't cost the player time. */
  resume(): void {
    this.running = this.remaining > 0;
  }

  /** @param dt seconds since the last frame. */
  update(dt: number): void {
    if (!this.running) return;

    this.remaining = Math.max(0, this.remaining - dt);
    this.render();

    if (this.remaining === 0) {
      this.running = false;
      this.onExpire();
    }
  }

  private render(): void {
    const fraction = this.remaining / this.duration;
    // Under 10s the clock is the loudest thing in the room. The audible tick and
    // the board tightening are M5 (ui-ux §7); the colour is the cheap half of it.
    const colour = this.remaining <= 10 ? 0xeb5757 : 0x6fcf97;

    this.bar
      .clear()
      .roundRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, HEIGHT / 2)
      .fill(0x2b2b2b)
      .stroke({ width: 2, color: 0x4a4a4a });

    if (fraction > 0) {
      this.bar
        .roundRect(
          -WIDTH / 2,
          -HEIGHT / 2,
          Math.max(HEIGHT, WIDTH * fraction),
          HEIGHT,
          HEIGHT / 2,
        )
        .fill(colour);
    }

    const seconds = Math.ceil(this.remaining);
    this.readout.text = `0:${String(seconds).padStart(2, "0")}`;
    this.readout.style.fill = colour;
  }
}

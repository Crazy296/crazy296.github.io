/**
 * Possible Words — pillar 2, and the second-biggest thing on screen (ui-ux §5).
 *
 * The number is mechanically just an integer. The *fall* is the drama, so it ticks
 * rather than snaps, and it carries the delta: a player who took the tree from 340
 * to 71 did something good and should feel it.
 *
 * The full character treatment — the pulse, the hold-your-breath at 1 — is M5. What
 * is here is the tick, the delta and the colour, because without those the counter
 * is a footnote and the playtest can't tell us whether the tension lands.
 */

import { Container } from "pixi.js";

import { Label } from "../../ui/Label";

const GREEN = 0x6fcf97;
const AMBER = 0xf2c14e;
const RED = 0xeb5757;
const WHITE = 0xf2e9de;

export class PossibleWordsMeter extends Container {
  private readonly value: Label;
  private readonly delta: Label;

  private target = 0;
  private shown = 0;
  private previous = 0;

  constructor() {
    super();

    const caption = new Label({
      text: "POSSIBLE WORDS",
      style: { fill: 0x8a8a8a, fontSize: 18, letterSpacing: 2 },
    });
    caption.y = -46;

    this.value = new Label({
      text: "0",
      style: { fill: WHITE, fontSize: 64 },
    });

    this.delta = new Label({
      text: "",
      style: { fill: 0x8a8a8a, fontSize: 20 },
    });
    this.delta.y = 48;

    this.addChild(caption, this.value, this.delta);
  }

  /** New word in play. `animated` false on a fresh seed — there's nothing to fall from. */
  set(count: number, animated = true): void {
    this.previous = this.shown;
    this.target = count;

    if (!animated) {
      this.shown = count;
      this.previous = count;
    }

    const drop = this.previous - this.target;
    this.delta.text = animated && drop > 0 ? `▼ ${drop}` : "";
    this.render();
  }

  /** Tick toward the target — fast, but visible. */
  update(): void {
    if (this.shown === this.target) return;

    const gap = this.target - this.shown;
    const step = Math.sign(gap) * Math.max(1, Math.ceil(Math.abs(gap) * 0.25));
    this.shown = Math.abs(gap) <= 1 ? this.target : this.shown + step;

    this.render();
  }

  private render(): void {
    this.value.text = String(this.shown);
    this.value.style.fill = this.colour();
  }

  /**
   * Colour is a redundant channel, never the only one — the number and (in M5) the
   * pulse carry it too, for colour-blind safety. ui-ux §8.
   *
   * THESE THRESHOLDS ARE A GUESS AND THEY ARE PROBABLY WRONG. ui-ux §5 was written
   * against a "340 → 71" example, but the real counter is an order of magnitude
   * smaller than that on short words — a fresh seed is ~20, not ~340 — so the
   * original bands painted turn one bright red. The playtest and M3's sim have the
   * data to calibrate this properly; until then, treat it as a placeholder.
   */
  private colour(): number {
    if (this.shown <= 1) return WHITE;
    if (this.shown <= 12) return RED;
    if (this.shown <= 60) return AMBER;
    return GREEN;
  }
}

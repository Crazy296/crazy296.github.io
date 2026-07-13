/**
 * Scores, and how close either player is to 100. Fourth in the hierarchy
 * (ui-ux §4) — present, readable, quiet.
 */

import { Container, Graphics } from "pixi.js";

import { TARGET_SCORE } from "../../../game/rules";
import { Label } from "../../ui/Label";

const BAR_WIDTH = 260;
const BAR_HEIGHT = 12;

class ScoreSide extends Container {
  private readonly score: Label;
  private readonly bar = new Graphics();

  constructor(
    title: string,
    private readonly colour: number,
    align: -1 | 1,
  ) {
    super();

    // align -1 → hug the left end of the bar, +1 → hug the right end.
    const edge = (align * BAR_WIDTH) / 2;
    const anchorX = align === -1 ? 0 : 1;

    const name = new Label({
      text: title,
      style: { fill: 0x8a8a8a, fontSize: 18, letterSpacing: 2 },
    });
    name.anchor.set(anchorX, 0.5);
    name.x = edge;

    this.score = new Label({
      text: "0",
      style: { fill: 0xf2e9de, fontSize: 40 },
    });
    this.score.anchor.set(anchorX, 0.5);
    this.score.position.set(edge, 30);

    this.bar.y = 60;
    this.addChild(name, this.score, this.bar);
    this.set(0);
  }

  set(points: number): void {
    this.score.text = String(points);

    const fraction = Math.min(1, points / TARGET_SCORE);
    this.bar
      .clear()
      .roundRect(-BAR_WIDTH / 2, 0, BAR_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2)
      .fill(0x2b2b2b);

    if (fraction > 0) {
      this.bar
        .roundRect(
          -BAR_WIDTH / 2,
          0,
          BAR_WIDTH * fraction,
          BAR_HEIGHT,
          BAR_HEIGHT / 2,
        )
        .fill(this.colour);
    }
  }

  /** The active player's side lifts; the other recedes. */
  setActive(active: boolean): void {
    this.alpha = active ? 1 : 0.55;
  }
}

export class ScoreBar extends Container {
  private readonly you = new ScoreSide("YOU", 0x6fcf97, -1);
  private readonly them = new ScoreSide("AI", 0xeb5757, 1);

  constructor() {
    super();
    this.addChild(this.you, this.them);
  }

  set(scores: readonly [number, number], activePlayer: 0 | 1): void {
    this.you.set(scores[0]);
    this.them.set(scores[1]);
    this.you.setActive(activePlayer === 0);
    this.them.setActive(activePlayer === 1);
  }

  layout(width: number): void {
    const inset = Math.min(240, width * 0.2);
    this.you.x = inset;
    this.them.x = width - inset;
  }
}

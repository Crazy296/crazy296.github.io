/**
 * Round end and match end.
 *
 * Round end is a *beat*, not a modal to dismiss (ui-ux §3): the word lands, the pot
 * is taken, it auto-advances in a couple of seconds, and it's skippable for anyone
 * who's seen it a hundred times. The word physically flying into the score is M5.
 */

import { Container, Graphics } from "pixi.js";

import type { GameState, RoundResult } from "../../../game/types";
import { Button } from "../../ui/Button";
import { Label } from "../../ui/Label";

const ROUND_END_MS = 2600;

export class EndOverlay extends Container {
  private readonly dim = new Graphics();
  private readonly headline: Label;
  private readonly word: Label;
  private readonly detail: Label;
  private readonly hint: Label;
  private readonly button: Button;

  private readonly body = new Container();
  private resolve: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();

    this.headline = new Label({
      text: "",
      style: { fill: 0x8a8a8a, fontSize: 26, letterSpacing: 4 },
    });
    this.headline.y = -140;

    this.word = new Label({
      text: "",
      style: { fill: 0xf2e9de, fontSize: 84, letterSpacing: 8 },
    });

    this.detail = new Label({
      text: "",
      style: { fill: 0xf2c14e, fontSize: 34 },
    });
    this.detail.y = 80;

    this.hint = new Label({
      text: "click or press ENTER to continue",
      style: { fill: 0x666666, fontSize: 16 },
    });
    this.hint.y = 150;

    this.button = new Button({ text: "BACK TO TITLE", width: 300, height: 90 });
    this.button.y = 170;
    this.button.visible = false;
    this.button.onPress.connect(() => this.finish());

    this.body.addChild(
      this.headline,
      this.word,
      this.detail,
      this.hint,
      this.button,
    );
    this.addChild(this.dim, this.body);

    this.eventMode = "static";
    this.on("pointertap", () => {
      if (!this.button.visible) this.finish();
    });

    this.visible = false;
  }

  resize(width: number, height: number): void {
    this.dim
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: 0x000000, alpha: 0.93 });
    this.body.position.set(width / 2, height / 2);
  }

  /** The pot is taken. Auto-advances; skippable. */
  showRound(
    result: RoundResult,
    names: readonly [string, string],
  ): Promise<void> {
    this.headline.text =
      result.reason === "dead_end" ? "DEAD END" : "DOUBLE TIMEOUT";
    this.word.text = result.finalWord;

    this.detail.text =
      result.scorer === null
        ? "nobody scores"
        : `${names[result.scorer]} takes ${result.points}`;

    this.hint.visible = true;
    this.button.visible = false;

    return this.open(ROUND_END_MS);
  }

  /** First to 100. */
  showMatch(state: GameState, names: readonly [string, string]): Promise<void> {
    const winner = state.winner ?? 0;

    this.headline.text = "MATCH OVER";
    this.word.text = winner === 0 ? "YOU WIN" : "YOU LOSE";
    this.detail.text = `${state.scores[0]} — ${state.scores[1]}   (${names[winner]})`;

    this.hint.visible = false;
    this.button.visible = true;

    return this.open(null);
  }

  /** Enter / Space, forwarded from the screen's keyboard handler. */
  skip(): void {
    if (this.visible && !this.button.visible) this.finish();
  }

  private open(autoAdvanceMs: number | null): Promise<void> {
    this.visible = true;

    return new Promise<void>((resolve) => {
      this.resolve = resolve;
      if (autoAdvanceMs !== null) {
        this.timer = setTimeout(() => this.finish(), autoAdvanceMs);
      }
    });
  }

  private finish(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const resolve = this.resolve;
    this.resolve = null;
    this.visible = false;
    resolve?.();
  }
}

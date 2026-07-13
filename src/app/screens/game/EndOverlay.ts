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
import { formatWordList } from "./wordList";

const ROUND_END_MS = 2600;
/** Nobody reads twelve words in 2.6s. When there's a list, the beat holds longer. */
const ROUND_END_WITH_LIST_MS = 5000;

export class EndOverlay extends Container {
  private readonly dim = new Graphics();
  private readonly headline: Label;
  private readonly word: Label;
  private readonly detail: Label;
  private readonly missed: Label;
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

    // The words that were still there. Dimmer than the pot and smaller than the
    // word — it's a reveal to read if you want it, not a thing to stare at while a
    // 2.6-second beat runs out. Wraps; `resize` owns the wrap width.
    this.missed = new Label({
      text: "",
      style: {
        fill: 0x6f8f7a,
        fontSize: 19,
        lineHeight: 26,
        wordWrap: true,
        wordWrapWidth: 800,
      },
    });
    this.missed.y = 132;

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
      this.missed,
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

    // Never let the word list run to the edges on a wide monitor — a line you have
    // to sweep your eyes across is a line nobody reads in 2.6 seconds.
    this.missed.style.wordWrapWidth = Math.min(width - 80, 820);
    this.layoutBelowMissed();
  }

  /**
   * The pot is taken. Auto-advances; skippable.
   *
   * `stillPlayable` is every word that could still have been played on the final
   * word — `dict.extensions(result.finalWord)`. On a dead end it is empty by
   * definition (that is what ended the round), so pass it and let the overlay say
   * so; on a double timeout it's the list of what both players failed to see.
   */
  showRound(
    result: RoundResult,
    names: readonly [string, string],
    stillPlayable: readonly string[] = [],
  ): Promise<void> {
    this.headline.text =
      result.reason === "dead_end" ? "DEAD END" : "DOUBLE TIMEOUT";
    this.word.text = result.finalWord;

    // The round's TOTAL, not just the pot the final event paid. A timeout pays the
    // adder mid-round and the round rolls on, so a round can end on a double
    // timeout — which pays nothing, and used to read "nobody scores" — after a
    // player has already banked 7, then 8, from two earlier timeouts. They took 15.
    // Both players can score in one round, so this doesn't assume a single scorer.
    const takings = names
      .map((name, i) => ({ name, points: result.roundPoints[i] }))
      .filter((t) => t.points > 0)
      .map((t) => `${t.name} takes ${t.points}`);

    this.detail.text =
      takings.length === 0 ? "nobody scores" : takings.join("   ·   ");

    const list = formatWordList(stillPlayable);
    this.missed.text =
      list === ""
        ? "no words left — that's the dead end"
        : `still playable:  ${list}`;
    this.missed.visible = true;
    this.layoutBelowMissed();

    this.hint.visible = true;
    this.button.visible = false;

    return this.open(list === "" ? ROUND_END_MS : ROUND_END_WITH_LIST_MS);
  }

  /** The list wraps, so everything under it has to move when it does. */
  private layoutBelowMissed(): void {
    this.hint.y = this.missed.visible
      ? this.missed.y + this.missed.height / 2 + 28
      : 150;
  }

  /** First to 100. */
  showMatch(state: GameState, names: readonly [string, string]): Promise<void> {
    const winner = state.winner ?? 0;

    this.headline.text = "MATCH OVER";
    this.word.text = winner === 0 ? "YOU WIN" : "YOU LOSE";
    this.detail.text = `${state.scores[0]} — ${state.scores[1]}   (${names[winner]})`;

    this.missed.visible = false;
    this.layoutBelowMissed();

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

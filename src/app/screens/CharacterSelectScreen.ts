/**
 * CHOOSE YOUR BEAST — characters.md §5.
 *
 * The selection is REAL: it flows into GameState and the beast flanks the board.
 * The powers are NOT — every card says so, and the detail panel says it again.
 *
 * That honesty is the entire reason this screen exists in M2 rather than M6.
 * Quietly shipping twelve identical beasts and letting playtesters wonder why the
 * Dragon feels like the Pig burns a QA cycle to save one line of text.
 */

import { Container, Graphics } from "pixi.js";

import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  getDifficulty,
  type DifficultyId,
} from "../../game/ai/difficulty";
import { BEASTS, type Beast } from "../../game/beasts/roster";
import { pick, makeRng } from "../../game/rng";
import type { BeastId } from "../../game/types";
import { engine } from "../getEngine";
import { setMatchSetup } from "../match";
import { Button } from "../ui/Button";
import { Label } from "../ui/Label";

import { GameScreen } from "./game/GameScreen";
import { EMOJI_FONT } from "./game/BeastView";

const CARD_W = 120;
const CARD_H = 130;

class BeastCard extends Container {
  private readonly bg = new Graphics();

  constructor(readonly beast: Beast) {
    super();

    const face = new Label({
      text: beast.emoji,
      style: { fontFamily: EMOJI_FONT, fontSize: 56 },
    });
    face.y = -14;

    const name = new Label({
      text: beast.name.toUpperCase(),
      style: { fill: 0xf2e9de, fontSize: 15, letterSpacing: 1 },
    });
    name.y = 36;

    this.addChild(this.bg, face, name);

    this.eventMode = "static";
    this.cursor = "pointer";
    this.setSelected(false);
  }

  setSelected(selected: boolean): void {
    this.bg
      .clear()
      .roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14)
      .fill(selected ? 0x3a3428 : 0x262626)
      .stroke({ width: 3, color: selected ? 0xf2c14e : 0x3a3a3a });
  }
}

export class CharacterSelectScreen extends Container {
  public static assetBundles = ["main"];

  private readonly heading: Label;
  private readonly grid = new Container();
  private readonly cards: BeastCard[] = [];

  private readonly panel = new Graphics();
  private readonly panelName: Label;
  private readonly panelPower: Label;
  private readonly panelStub: Label;

  private readonly opponentLabel: Label;
  private readonly confirmButton: Button;

  private readonly difficultyHeading: Label;
  private readonly difficultyButtons: Button[] = [];
  private readonly difficultyBlurb: Label;

  private selected: BeastId = "rooster";
  private opponent: BeastId = "dragon";
  private difficulty: DifficultyId = DEFAULT_DIFFICULTY;

  constructor() {
    super();

    this.heading = new Label({
      text: "CHOOSE YOUR BEAST",
      style: { fill: 0xf2e9de, fontSize: 42, letterSpacing: 4 },
    });

    BEASTS.forEach((beast, i) => {
      const card = new BeastCard(beast);
      // 6 × 2, per characters.md §5.
      card.position.set(
        ((i % 6) - 2.5) * (CARD_W + 16),
        Math.floor(i / 6) * (CARD_H + 16),
      );
      card.on("pointertap", () => this.select(beast.id));
      card.on("pointerover", () => this.describe(beast));
      this.grid.addChild(card);
      this.cards.push(card);
    });

    this.panelName = new Label({
      text: "",
      style: { fill: 0xf2e9de, fontSize: 26, letterSpacing: 2 },
    });
    this.panelName.anchor.set(0, 0.5);

    this.panelPower = new Label({
      text: "",
      style: {
        fill: 0x8a8a8a,
        fontSize: 18,
        lineHeight: 26,
        wordWrap: true,
        wordWrapWidth: 620,
      },
    });
    this.panelPower.anchor.set(0, 0);

    this.panelStub = new Label({
      text: "",
      style: { fill: 0xf2c14e, fontSize: 15, letterSpacing: 1 },
    });
    this.panelStub.anchor.set(0, 0.5);

    this.opponentLabel = new Label({
      text: "",
      style: { fontFamily: EMOJI_FONT, fill: 0x8a8a8a, fontSize: 20 },
    });

    // Difficulty. The tiers differ by HOW MANY WORDS THE AI KNOWS, so the blurb
    // says exactly that — "hard mode" that just plays better is the thing
    // ai-opponent.md §4 tells us not to build.
    this.difficultyHeading = new Label({
      text: "DIFFICULTY",
      style: { fill: 0x8a8a8a, fontSize: 18, letterSpacing: 3 },
    });

    DIFFICULTIES.forEach((tier) => {
      const button = new Button({
        text: tier.label,
        width: 190,
        height: 70,
        fontSize: 22,
      });
      button.onPress.connect(() => this.chooseDifficulty(tier.id));
      this.difficultyButtons.push(button);
      this.addChild(button);
    });

    this.difficultyBlurb = new Label({
      text: "",
      style: {
        fill: 0x777777,
        fontSize: 16,
        wordWrap: true,
        wordWrapWidth: 680,
        align: "center",
      },
    });

    this.confirmButton = new Button({
      text: "CONFIRM",
      width: 280,
      height: 100,
    });
    this.confirmButton.onPress.connect(() => this.confirm());

    this.addChild(
      this.heading,
      this.grid,
      this.panel,
      this.panelName,
      this.panelPower,
      this.panelStub,
      this.opponentLabel,
      this.difficultyHeading,
      this.difficultyBlurb,
      this.confirmButton,
    );
  }

  public prepare(): void {
    // The AI picks too, and its choice is visible before the match starts.
    // Random is explicitly fine for now (characters.md §5).
    this.opponent = pick(BEASTS, makeRng(Date.now() >>> 0)).id;
    this.select(this.selected);
    this.chooseDifficulty(this.difficulty);
  }

  private chooseDifficulty(id: DifficultyId): void {
    this.difficulty = id;

    DIFFICULTIES.forEach((tier, i) => {
      const chosen = tier.id === id;
      this.difficultyButtons[i].alpha = chosen ? 1 : 0.45;
      this.difficultyButtons[i].scale.set(chosen ? 0.95 : 0.82);
    });

    this.difficultyBlurb.text = getDifficulty(id).blurb;
  }

  private select(id: BeastId): void {
    this.selected = id;
    for (const card of this.cards) {
      card.setSelected(card.beast.id === id);
    }
    this.describe(BEASTS.find((b) => b.id === id)!);
  }

  private describe(beast: Beast): void {
    this.panelName.text = `${beast.emoji}  ${beast.name.toUpperCase()}`;
    this.panelName.style.fontFamily = EMOJI_FONT;

    this.panelPower.text =
      beast.power.name === "???"
        ? "Power not yet designed."
        : `${beast.power.name.toUpperCase()} — ${beast.power.description}`;

    // Every beast, every time. No exceptions until a power actually works — and
    // the debug beast has to be even louder about it than the stubs are, because
    // it's the only one that actually DOES something.
    this.panelStub.text = beast.power.debug
      ? "[ DEBUG TOOL — not a real power. It shows you the answer. ]"
      : beast.power.implemented
        ? ""
        : "[ placeholder — not yet implemented ]";
    this.panelStub.style.fill = beast.power.debug ? 0xeb5757 : 0xf2c14e;

    const ai = BEASTS.find((b) => b.id === this.opponent)!;
    this.opponentLabel.text = `AI will play  ${ai.emoji} ${ai.name.toUpperCase()}`;
  }

  private confirm(): void {
    setMatchSetup({
      beasts: [this.selected, this.opponent],
      difficulty: this.difficulty,
      // Seeded so a mad match is replayable — the sim and a bug report need this.
      seed: Date.now() >>> 0,
    });
    engine().navigation.showScreen(GameScreen);
  }

  public resize(width: number, height: number): void {
    const cx = width / 2;

    this.heading.position.set(cx, height * 0.09);
    this.grid.position.set(cx, height * 0.235);

    const panelW = Math.min(700, width - 80);
    const panelH = 140;
    const panelX = cx - panelW / 2;
    const panelY = height * 0.5;

    this.panel
      .clear()
      .roundRect(panelX, panelY, panelW, panelH, 16)
      .fill(0x262626)
      .stroke({ width: 2, color: 0x3a3a3a });

    this.panelName.position.set(panelX + 28, panelY + 30);
    this.panelPower.position.set(panelX + 28, panelY + 54);
    this.panelStub.position.set(panelX + 28, panelY + panelH - 22);

    this.opponentLabel.position.set(cx, panelY + panelH + 28);

    const difficultyY = panelY + panelH + 70;
    this.difficultyHeading.position.set(cx, difficultyY);
    this.difficultyButtons.forEach((button, i) => {
      button.position.set(cx + (i - 1) * 200, difficultyY + 50);
    });
    this.difficultyBlurb.position.set(cx, difficultyY + 106);

    this.confirmButton.position.set(cx, height * 0.945);
  }
}

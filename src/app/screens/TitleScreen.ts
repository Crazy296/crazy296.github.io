/**
 * TITLE. (Was the template's MainScreen — ui-ux §3.)
 *
 * Mode Select is in the flow diagram but there is only one mode in the prototype,
 * so it would be a screen with one button on it. It lands when there is a second
 * mode to select. Title goes straight to Character Select.
 */

import { Container } from "pixi.js";

import { engine } from "../getEngine";
import { Button } from "../ui/Button";
import { Label } from "../ui/Label";

import { CharacterSelectScreen } from "./CharacterSelectScreen";
import { EMOJI_FONT } from "./game/BeastView";

export class TitleScreen extends Container {
  public static assetBundles = ["main"];

  private readonly title: Label;
  private readonly beasts: Label;
  private readonly pitch: Label;
  private readonly playButton: Button;
  private readonly build: Label;

  constructor() {
    super();

    this.beasts = new Label({
      text: "🐀🐂🐅🐇🐉🐍🐎🐐🐒🐓🐕🐖",
      style: { fontFamily: EMOJI_FONT, fontSize: 40 },
    });

    this.title = new Label({
      text: "SPELLING BEASTS",
      style: { fill: 0xf2e9de, fontSize: 68, letterSpacing: 6 },
    });

    this.pitch = new Label({
      text: "Add a letter. Rearrange the word.\nDead-end it and take the pot. First to 100.",
      style: { fill: 0x8a8a8a, fontSize: 22, lineHeight: 32 },
    });

    this.playButton = new Button({ text: "PLAY", width: 300, height: 110 });
    this.playButton.onPress.connect(() =>
      engine().navigation.showScreen(CharacterSelectScreen),
    );

    this.build = new Label({
      text: "M2 prototype — powers are stubs, the AI plays badly, nothing is pretty yet",
      style: { fill: 0x555555, fontSize: 14 },
    });

    this.addChild(
      this.beasts,
      this.title,
      this.pitch,
      this.playButton,
      this.build,
    );
  }

  public resize(width: number, height: number): void {
    const cx = width / 2;

    this.beasts.position.set(cx, height * 0.24);
    this.title.position.set(cx, height * 0.34);
    this.pitch.position.set(cx, height * 0.45);
    this.playButton.position.set(cx, height * 0.6);
    this.build.position.set(cx, height - 40);
  }
}

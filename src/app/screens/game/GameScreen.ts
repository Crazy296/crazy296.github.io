/**
 * The game.
 *
 * This screen orchestrates; it does not decide. Every rule lives in game/rules.ts
 * and this asks it questions. The two things this layer genuinely owns are the
 * things the reducer deliberately refuses to hold:
 *
 *   1. THE CLOCK. GameState has no `turnEndsAt` — a reducer that reads the wall
 *      clock can't be replayed by the balance sim. When the clock expires we
 *      dispatch `{kind:"timeout"}`, which is the identical move Skip Turn sends,
 *      because rules-spec §4 says they are the same thing. (open-questions A11)
 *
 *   2. THE ARRANGEMENT. Order is mechanically irrelevant — the reducer only cares
 *      which letter you added. The arrangement exists so that the player has to
 *      *demonstrate* the word. That is the entire game (~design-doc §5), and it is
 *      why nothing in here will ever arrange the letters for them.
 *
 * M2's job is to find out whether that demonstration survives a 45-second clock.
 * See docs/roadmap.md, risk #2.
 */

import type { FancyButton } from "@pixi/ui";
import { Container, Ticker } from "pixi.js";

import { RandomAi } from "../../../game/ai/ai";
import { getDifficulty } from "../../../game/ai/difficulty";
import { getBeast } from "../../../game/beasts/roster";
import type { Dictionary } from "../../../game/dictionary";
import { HumanOpponent } from "../../../game/human";
import type { Opponent } from "../../../game/opponent";
import { makeRng, type Rng } from "../../../game/rng";
import {
  applyMove,
  isExtensionOf,
  nextRound,
  possibleWords,
  potAtStake,
  createMatch,
  TURN_SECONDS,
} from "../../../game/rules";
import type { GameState, Move, PlayerId } from "../../../game/types";
import { getDictionary, getVocabulary } from "../../dictionary";
import { engine } from "../../getEngine";
import { getMatchSetup } from "../../match";
import { PausePopup } from "../../popups/PausePopup";
import { Button } from "../../ui/Button";
import { Label } from "../../ui/Label";

import { BeastView } from "./BeastView";
import { EndOverlay } from "./EndOverlay";
import { InputRow } from "./InputRow";
import { AlphabetRack, PoolRack } from "./LetterRack";
import { PossibleWordsMeter } from "./PossibleWordsMeter";
import { ScoreBar } from "./ScoreBar";
import type { TileState } from "./Tile";
import { TileRow } from "./TileRow";
import { TurnTimer } from "./TurnTimer";

const NAMES: readonly [string, string] = ["YOU", "AI"];

/** How long the invalid-submission shake lasts. */
const SHAKE_SECONDS = 0.28;

/**
 * How the player's arrangement reads back to them, tile by tile: letters taken
 * from the word in play, the ONE new letter, and anything beyond that.
 */
interface Arrangement {
  states: TileState[];
  /** Base letters not yet placed — what the pool rack offers. */
  unplaced: string[];
  /** Has the one new letter been placed? The A–Z rack goes dead when it has. */
  hasNewLetter: boolean;
  legal: boolean;
  /** Why not, in words the player can act on. Empty when incomplete or legal. */
  problem: string;
}

export class GameScreen extends Container {
  public static assetBundles = ["main"];

  private readonly scoreBar = new ScoreBar();
  // Gap is half a tile — 25% of a tile's width of clear air on each side, so
  // neighbouring letters never crowd or collide.
  private readonly wordRow = new TileRow(72, 36);
  private readonly meter = new PossibleWordsMeter();
  private readonly timer = new TurnTimer();
  private readonly inputRow = new InputRow(72, 36);
  private readonly poolRack = new PoolRack();
  private readonly alphabet = new AlphabetRack();
  private readonly overlay = new EndOverlay();

  private readonly status: Label;
  private readonly potLabel: Label;
  private readonly problem: Label;
  private readonly inputCaption: Label;
  private readonly difficultyBadge: Label;
  private readonly submitButton: Button;
  private readonly skipButton: Button;
  private readonly pauseButton: FancyButton;

  private beastViews: [BeastView, BeastView] | null = null;

  private dict!: Dictionary;
  private rng!: Rng;
  private state!: GameState;
  private opponents!: [Opponent, Opponent];
  private human!: HumanOpponent;

  /** The letters the player has placed, in the order they placed them. */
  private letters: string[] = [];
  private viewWidth = 1024;
  /** Where the centred rows live. The shake swings the input row around it. */
  private centreX = 512;
  private shakeLeft = 0;
  private turnAbort: AbortController | null = null;
  /** Set on hide/reset — the async match loop must not outlive the screen. */
  private stopped = false;
  private paused = false;

  constructor() {
    super();

    this.status = new Label({
      text: "",
      style: { fill: 0xf2e9de, fontSize: 22, letterSpacing: 2 },
    });

    this.potLabel = new Label({
      text: "",
      style: { fill: 0x8a8a8a, fontSize: 16 },
    });

    this.problem = new Label({
      text: "",
      style: { fill: 0xeb5757, fontSize: 20 },
    });

    this.submitButton = new Button({ text: "SUBMIT", width: 240, height: 80 });
    this.submitButton.onPress.connect(() => this.trySubmit());

    this.skipButton = new Button({ text: "SKIP TURN", width: 240, height: 80 });
    this.skipButton.onPress.connect(() => this.human.skip());

    this.pauseButton = new Button({ text: "II", width: 64, height: 64 });
    this.pauseButton.onPress.connect(() =>
      engine().navigation.presentPopup(PausePopup),
    );

    this.inputCaption = new Label({
      text: "YOUR WORD",
      style: { fill: 0x777777, fontSize: 15, letterSpacing: 2 },
    });

    // Which AI you're up against, on screen for the whole match. A playtester
    // reporting "the AI is unbeatable" has to be able to say which one.
    this.difficultyBadge = new Label({
      text: "",
      style: { fill: 0x8a8a8a, fontSize: 14, letterSpacing: 2 },
    });

    // Click a base letter to place it; click A–Z for your new one. The slow path,
    // kept because typing is worse for some people and on touch. ui-ux §2.
    this.poolRack.onPick = (letter) => this.place(letter);
    this.alphabet.onPick = (letter) => this.place(letter);
    this.inputRow.onReorder = (letters) => {
      this.letters = letters;
      this.refreshInput();
    };

    this.addChild(
      this.scoreBar,
      this.wordRow,
      this.meter,
      this.timer,
      this.potLabel,
      this.status,
      this.inputCaption,
      this.difficultyBadge,
      this.inputRow,
      this.problem,
      this.poolRack,
      this.alphabet,
      this.submitButton,
      this.skipButton,
      this.pauseButton,
      this.overlay,
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Screens are pooled and reused, so a match is set up here, not in the ctor. */
  public prepare(): void {
    const setup = getMatchSetup();

    const difficulty = getDifficulty(setup.difficulty);

    this.dict = getDictionary();
    this.rng = makeRng(setup.seed);
    this.human = new HumanOpponent("You");
    this.opponents = [
      this.human,
      // Still M1's random bot — the search tiers are M4. What the difficulty
      // actually changes is HOW MANY WORDS IT KNOWS (ai-opponent.md §4 lever 1):
      // an AI with a 5,000-word vocabulary is regularly stuck for a move and has
      // to let the clock run, which pays you the pot. The think-beat is so it
      // doesn't answer instantly on a 45-second clock.
      new RandomAi(makeRng(setup.seed ^ 0x5eed), {
        name: "AI",
        thinkMs: [800, 2400],
        timeoutChance: difficulty.timeoutChance,
        vocabulary: difficulty.vocabulary
          ? getVocabulary().top(difficulty.vocabulary)
          : undefined,
      }),
    ];
    this.difficultyBadge.text = `${difficulty.label} AI`;

    this.state = createMatch(setup.beasts, this.dict, this.rng);

    if (this.beastViews) {
      for (const view of this.beastViews) this.removeChild(view);
    }
    this.beastViews = [
      new BeastView(setup.beasts[0], "YOU"),
      new BeastView(setup.beasts[1], "AI"),
    ];
    this.addChild(...this.beastViews);
    // The beasts are added last, so they'd otherwise sit ON TOP of the round-end
    // dim. Put the overlay back on the roof.
    this.addChild(this.overlay);

    this.stopped = false;
    this.sync(false);
  }

  public async show(): Promise<void> {
    window.addEventListener("keydown", this.onKeyDown);
    this.runMatch();
  }

  public async hide(): Promise<void> {
    this.teardown();
  }

  public reset(): void {
    this.teardown();
  }

  private teardown(): void {
    this.stopped = true;
    this.timer.stop();
    this.turnAbort?.abort();
    window.removeEventListener("keydown", this.onKeyDown);
  }

  public async pause(): Promise<void> {
    this.paused = true;
    this.timer.stop();
  }

  public async resume(): Promise<void> {
    this.paused = false;
    this.timer.resume();
  }

  public update(ticker: Ticker): void {
    if (this.paused) return;

    const dt = ticker.deltaMS / 1000;

    this.timer.update(dt);
    this.meter.update();

    // The tiles slide here, on the ticker — see the note in TileRow.
    this.wordRow.update(dt);
    this.inputRow.update(dt);
    this.poolRack.update(dt);
    this.updateShake(dt);
  }

  /**
   * The invalid-submission shake (ui-ux §7). Driven here rather than by `motion`
   * for the same reason the tiles are: a tween that gets interrupted mid-flight
   * would leave the row parked off-centre for the rest of the turn.
   */
  private updateShake(dt: number): void {
    if (this.shakeLeft <= 0) return;

    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    const amplitude = 12 * (this.shakeLeft / SHAKE_SECONDS);
    this.inputRow.x = this.centreX + Math.sin(this.shakeLeft * 70) * amplitude;
  }

  // ── The match loop ────────────────────────────────────────────────────────

  private async runMatch(): Promise<void> {
    while (!this.stopped) {
      if (this.state.phase === "MATCH_END") {
        // A dead end that crosses 100 ends the round AND the match in one move —
        // the round still deserves its beat before the match end lands. (A10)
        if (this.state.lastRound) {
          await this.overlay.showRound(this.state.lastRound, NAMES);
        }
        if (this.stopped) return;
        await this.overlay.showMatch(this.state, NAMES);
        if (this.stopped) return;

        // Imported here rather than at the top: Title → CharacterSelect → Game →
        // Title is a module cycle, and this is the edge that closes it.
        const { TitleScreen } = await import("../TitleScreen");
        engine().navigation.showScreen(TitleScreen);
        return;
      }

      if (this.state.phase === "ROUND_END") {
        await this.overlay.showRound(this.state.lastRound!, NAMES);
        if (this.stopped) return;
        this.state = nextRound(this.state, this.dict, this.rng);
        this.sync(false); // fresh seed — the counter has nothing to fall from
        continue;
      }

      await this.playTurn();
    }
  }

  private async playTurn(): Promise<void> {
    const player = this.state.activePlayer;
    const controller = new AbortController();
    this.turnAbort = controller;

    this.beginTurn(player);
    this.timer.onExpire = () => controller.abort();
    this.timer.start(TURN_SECONDS);

    let move: Move;
    try {
      move = await this.opponents[player].requestMove(
        this.state,
        this.dict,
        controller.signal,
      );
    } catch {
      // The clock cancelled them. Skip Turn and clock-expiry are the same move.
      move = { kind: "timeout" };
    }

    this.timer.stop();
    this.turnAbort = null;
    if (this.stopped) return;

    this.state = applyMove(this.state, move, this.dict);
    this.sync(true);
  }

  private beginTurn(player: PlayerId): void {
    this.letters = [];
    this.problem.text = "";

    const human = player === 0;
    const beast = getBeast(this.state.beasts[player]);

    this.status.text = human
      ? "YOUR TURN — type the word, or click the letters"
      : `${beast.name.toUpperCase()} IS THINKING…`;

    this.submitButton.visible = human;
    this.skipButton.visible = human;
    this.inputRow.visible = human;
    this.inputCaption.visible = human;
    this.poolRack.visible = human;
    this.alphabet.visible = human;

    this.beastViews?.[0].setActive(player === 0, "YOUR TURN");
    this.beastViews?.[1].setActive(player === 1, "THINKING…");

    this.refreshInput();
  }

  // ── The arrangement ───────────────────────────────────────────────────────

  /**
   * Read the player's arrangement back to them. Each placed tile is either a letter
   * they took from the word in play, THE one new letter, or surplus — and a turn is
   * fully described by that one new letter (~design-doc §5), so it's worth making
   * it the loudest thing in the row.
   */
  private classify(): Arrangement {
    const base = this.state.wordInPlay;
    const pool = base.split("");
    const states: TileState[] = [];
    let extras = 0;

    for (const letter of this.letters) {
      const i = pool.indexOf(letter);
      if (i !== -1) {
        pool.splice(i, 1);
        states.push("base");
        continue;
      }
      extras += 1;
      states.push(extras === 1 ? "new" : "surplus");
    }

    const word = this.letters.join("");
    const complete = word.length === base.length + 1;
    const isExtension = complete && isExtensionOf(base, word);
    const real = isExtension && this.dict.isValid(word);

    let problem = "";
    if (complete && !isExtension) {
      problem = `Use every letter of ${base}, plus exactly one new one`;
    } else if (isExtension && !real) {
      problem = `${word} is not a word`;
    }

    return {
      // The whole row goes green when it's a legal, real word — the player is told
      // they got it BEFORE they submit, so the clock isn't measuring their nerve
      // about spelling. ui-ux §7: it's a hint about a word they already produced.
      states: real ? states.map(() => "valid" as const) : states,
      unplaced: pool,
      hasNewLetter: extras >= 1,
      legal: real,
      problem,
    };
  }

  private refreshInput(): void {
    const arrangement = this.classify();

    this.inputRow.setLetters(this.letters, arrangement.states);
    this.poolRack.setPool(arrangement.unplaced);
    this.alphabet.setEnabled(!arrangement.hasNewLetter);
    this.alphabet.setHints(this.dragonEye());
    this.submitButton.enabled = arrangement.legal;
    this.submitButton.alpha = arrangement.legal ? 1 : 0.5;
    this.fitRows();
  }

  /**
   * DRAGON'S EYE — the debug tool (see LetterRack.setHints). Which letters extend
   * the word in play into a real word?
   *
   * A move IS a letter choice, so this is the whole answer, handed over. It is
   * deliberately gated on picking the one beast that announces itself as DEBUG.
   * 26 hash lookups, so calling it on every keystroke costs nothing.
   */
  private dragonEye(): ReadonlySet<string> | null {
    if (getBeast(this.state.beasts[0]).power.debug !== true) return null;
    return new Set(this.dict.extensionsByLetter(this.state.wordInPlay).keys());
  }

  private place(letter: string): void {
    if (!this.human.isWaiting) return;
    // Exactly one letter longer than the word in play. There is no arrangement
    // longer than that which could ever be legal.
    if (this.letters.length >= this.state.wordInPlay.length + 1) return;

    this.letters.push(letter);
    this.problem.text = "";
    this.refreshInput();
  }

  private trySubmit(): void {
    if (!this.human.isWaiting) return;

    const arrangement = this.classify();
    if (arrangement.legal) {
      this.human.play(this.letters.join(""));
      return;
    }

    // Rejected — and the input is NOT cleared. They were probably close, and the
    // clock is running. ui-ux §7.
    this.problem.text =
      arrangement.problem ||
      `Play exactly ${this.state.wordInPlay.length + 1} letters`;
    this.shakeInput();
  }

  private shakeInput(): void {
    this.shakeLeft = SHAKE_SECONDS;
  }

  // ── State → screen ────────────────────────────────────────────────────────

  private sync(animated: boolean): void {
    const state = this.state;

    this.scoreBar.set(state.scores, state.activePlayer);
    this.wordRow.setLetters(
      state.wordInPlay.split(""),
      state.wordInPlay.split("").map(() => "word" as const),
      animated,
    );
    this.meter.set(possibleWords(state, this.dict), animated);
    this.fitRows();

    // What you lose by stalling. The pot goes to whoever last added a letter —
    // which is never you, on your own turn. That asymmetry IS the claim model,
    // and it's the rule playtesters most often haven't internalised (rules-spec §4).
    const pot = potAtStake(state);
    this.potLabel.text =
      pot > 0 && state.adder !== null
        ? `time out and ${NAMES[state.adder]} takes ${pot}`
        : "";

    if (state.phase !== "AWAIT_MOVE") {
      this.timer.stop();
      this.inputRow.visible = false;
      this.inputCaption.visible = false;
      this.poolRack.visible = false;
      this.alphabet.visible = false;
      this.submitButton.visible = false;
      this.skipButton.visible = false;
      this.status.text = "";
      // Nobody's turn any more — don't leave a beast saying YOUR TURN under the
      // match-over screen.
      this.beastViews?.[0].setActive(false);
      this.beastViews?.[1].setActive(false);
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  /**
   * Typing is the fast path, and the whole reason the game survives a 45-second
   * clock: the player just types M-A-N-E and the tiles fly into that arrangement.
   * It is still a demonstration — they had to know and produce MANE. ui-ux §2.
   */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.overlay.skip();
    }

    if (!this.human.isWaiting || this.paused) return;

    if (/^[a-zA-Z]$/.test(e.key)) {
      this.place(e.key.toUpperCase());
    } else if (e.key === "Backspace") {
      e.preventDefault();
      this.letters.pop();
      this.problem.text = "";
      this.refreshInput();
    } else if (e.key === "Escape") {
      this.letters = [];
      this.problem.text = "";
      this.refreshInput();
    } else if (e.key === "Enter") {
      this.trySubmit();
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  public resize(width: number, height: number): void {
    const cx = width / 2;
    this.viewWidth = width;
    this.centreX = cx;
    this.shakeLeft = 0;

    this.scoreBar.y = 60;
    this.scoreBar.layout(width);

    // Bottom-right: the top-right corner belongs to the AI's score.
    this.pauseButton.position.set(width - 56, height - 46);

    this.wordRow.position.set(cx, height * 0.2);
    this.meter.position.set(cx, height * 0.36);
    this.timer.position.set(cx - 40, height * 0.5);
    this.potLabel.position.set(cx, height * 0.55);
    this.status.position.set(cx, height * 0.575);

    // The rejection message sits ABOVE the arrangement, not below it. Below, it
    // collided with the pool rack's caption — and an error you can't read is worse
    // than no error, especially with the clock running.
    this.problem.position.set(cx, height * 0.612);

    this.inputCaption.position.set(cx, height * 0.645);
    this.inputRow.position.set(cx, height * 0.7);
    this.poolRack.position.set(cx, height * 0.79);
    this.alphabet.position.set(cx, height * 0.865);

    this.submitButton.position.set(cx - 140, height * 0.94);
    this.skipButton.position.set(cx + 140, height * 0.94);

    const beastY = height * 0.4;
    const aiX = Math.min(width - 120, width * 0.88);
    this.beastViews?.[0].position.set(Math.max(120, width * 0.12), beastY);
    this.beastViews?.[1].position.set(aiX, beastY);
    this.difficultyBadge.position.set(aiX, beastY + 118);

    this.fitRows();
    this.overlay.resize(width, height);
  }

  /**
   * A long word would run into the beasts. Scale the rows down to fit rather than
   * letting them collide — the word in play is the biggest thing on screen
   * (ui-ux §4), but not at any cost. Scaling the row scales the gaps with it, so
   * the tiles stay clear of each other however far it shrinks.
   */
  private fitRows(): void {
    const budget = this.viewWidth * 0.62;
    const step = 72 + 36; // tile + gap, must match the rows above

    const word = this.state?.wordInPlay.length ?? 1;
    this.wordRow.scale.set(Math.min(1, budget / (word * step)));

    const placed = Math.max(this.letters.length, 1);
    this.inputRow.scale.set(Math.min(1, budget / (placed * step)));
  }
}

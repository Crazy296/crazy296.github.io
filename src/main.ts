import { loadDictionary } from "./app/dictionary";
import { setEngine } from "./app/getEngine";
import { LoadScreen } from "./app/screens/LoadScreen";
import { TitleScreen } from "./app/screens/TitleScreen";
import { userSettings } from "./app/utils/userSettings";
import { CreationEngine } from "./engine/engine";

/**
 * Importing these modules will automatically register there plugins with the engine.
 */
import "@pixi/sound";
// import "@esotericsoftware/spine-pixi-v8";

// Create a new creation engine instance
const engine = new CreationEngine();
setEngine(engine);

/**
 * Boot failed. Almost always the same cause on a fresh clone: the dictionary is a
 * gitignored build artefact and nobody ran `npm run build:dict`.
 *
 * Say so ON THE PAGE. A blank canvas and a stack trace in the console is a rotten
 * welcome for the next person who clones this.
 */
function showBootError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const container = document.getElementById("pixi-container") ?? document.body;

  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px; padding: 24px;
    font-family: monospace; text-align: center; background: #1e1e1e;
    color: #f2e9de;`;
  panel.innerHTML = `
    <div style="font-size:22px;color:#eb5757">Spelling Beasts failed to start</div>
    <div style="font-size:15px;color:#8a8a8a;max-width:60ch">${message}</div>
    <div style="margin-top:8px;font-size:15px">
      On a fresh clone, run <code style="color:#f2c14e">npm run build:dict</code> once.
    </div>`;
  container.appendChild(panel);
}

(async () => {
  try {
    // Initialize the creation engine instance
    await engine.init({
      background: "#1E1E1E",
      // The game screen is a wide board with a beast on each flank, so the design
      // area is landscape. Touch/portrait is a separate layout — ui-ux.md §8.
      resizeOptions: { minWidth: 1024, minHeight: 900, letterbox: false },
    });

    // Initialize the user settings
    userSettings.init();

    // Show the load screen
    await engine.navigation.showScreen(LoadScreen);

    // dict.txt (~400 KB gz) and vocab.txt (~118 KB gz), once, behind the load
    // screen; the game never thinks about them again. docs/architecture.md §5.
    await loadDictionary();

    await engine.navigation.showScreen(TitleScreen);
  } catch (error) {
    console.error(error);
    showBootError(error);
  }
})();

/**
 * Browser-side dictionary load. Once, at boot, into the LoadScreen (see
 * docs/architecture.md §5) — after that the game never thinks about it again.
 *
 * public/dict.txt is a build artefact and is gitignored, so a fresh clone that
 * skipped `npm run build:dict` gets a clear error rather than a mystery 404.
 */

import { Dictionary } from "../game/dictionary";
import { Vocabulary } from "../game/vocabulary";

let loaded: Dictionary | null = null;
let vocabulary: Vocabulary | null = null;

const missing = (name: string, why: string) =>
  new Error(`Could not load ${name} — ${why}. Run: npm run build:dict`);

async function fetchArtefact(name: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}${name}`);
  if (!res.ok) throw missing(name, `HTTP ${res.status}`);

  const text = await res.text();

  // A dev server answers a missing file with index.html and a cheerful 200, so
  // `res.ok` proves nothing. Without this check the failure surfaces as a JSON
  // parse error, which tells the next person who clones this repo precisely
  // nothing about what they actually forgot to do.
  if (text.startsWith("<")) throw missing(name, "the file is not there");

  return text;
}

export async function loadDictionary(): Promise<Dictionary> {
  if (loaded) return loaded;

  // Both artefacts, in parallel. vocab.txt is the AI's difficulty (118 KB gzipped);
  // the player is never restricted by it. docs/ai-opponent.md §4.
  const [dictText, vocabText] = await Promise.all([
    fetchArtefact("dict.txt"),
    fetchArtefact("vocab.txt"),
  ]);

  loaded = Dictionary.parse(dictText);
  vocabulary = Vocabulary.parse(vocabText);
  return loaded;
}

export function getDictionary(): Dictionary {
  if (!loaded) throw new Error("Dictionary used before loadDictionary()");
  return loaded;
}

export function getVocabulary(): Vocabulary {
  if (!vocabulary) throw new Error("Vocabulary used before loadDictionary()");
  return vocabulary;
}

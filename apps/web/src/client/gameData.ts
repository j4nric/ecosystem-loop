import { buildGameData, DATA_FILES, type GameData, type RawData } from '@being-god/core';
import { parse } from 'yaml';

/** Die YAML-Dateien der Engine, zur Build-Zeit als Text eingebunden (kein Netzwerkzugriff zur Laufzeit). */
const FILES = import.meta.glob<string>('../../../../packages/core/data/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

let cached: GameData | null = null;

/** Baut die geprüften Spieldaten einmalig aus den eingebundenen YAML-Texten. */
export function loadGameData(): GameData {
  if (cached) return cached;
  const byName = new Map(Object.entries(FILES).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text]));
  const raw = Object.fromEntries(
    Object.entries(DATA_FILES).map(([key, file]) => {
      const text = byName.get(file);
      if (text === undefined) throw new Error(`Spieldatei fehlt im Build: ${file}`);
      return [key, parse(text) as unknown];
    }),
  ) as unknown as RawData;
  cached = buildGameData(raw);
  return cached;
}

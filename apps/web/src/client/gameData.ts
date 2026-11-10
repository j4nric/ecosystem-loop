import { buildData, DATA_FILES, type HerdeData, type RawData } from '@being-god/herde';
import { parse } from 'yaml';

/** Die YAML-Dateien der Engine, zur Build-Zeit als Text eingebunden (kein Netzwerkzugriff zur Laufzeit). */
const FILES = import.meta.glob<string>('../../../../packages/herde/data/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Rohdaten aus Dateitexten (Dateiname → YAML-Text); wirft, wenn eine Datei fehlt. */
export function rawDataFrom(files: Record<string, string>): RawData {
  const byName = new Map(Object.entries(files).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text]));
  return Object.fromEntries(
    Object.entries(DATA_FILES).map(([key, file]) => {
      const text = byName.get(file);
      if (text === undefined) throw new Error(`Spieldatei fehlt im Build: ${file}`);
      return [key, parse(text) as unknown];
    }),
  ) as unknown as RawData;
}

let cached: HerdeData | null = null;

/** Baut die geprüften Spieldaten einmalig aus den eingebundenen YAML-Texten (`buildData` der Engine). */
export function loadGameData(): HerdeData {
  cached ??= buildData(rawDataFrom(FILES));
  return cached;
}

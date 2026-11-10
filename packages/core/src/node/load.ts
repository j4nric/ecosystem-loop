/** Lädt die Spieldaten aus dem data/-Verzeichnis (nur Node). */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildGameData, DATA_FILES, type RawData } from '../data.ts';
import type { GameData } from '../schema/index.ts';

export const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');

/** Liest alle YAML-Dateien als Rohdaten (ungeprüft). */
export function readRawData(dir: string = DEFAULT_DATA_DIR): RawData {
  const entries = Object.entries(DATA_FILES).map(([key, file]) => [
    key,
    parse(readFileSync(join(dir, file), 'utf8')) as unknown,
  ]);
  return Object.fromEntries(entries) as unknown as RawData;
}

export function loadGameData(dir: string = DEFAULT_DATA_DIR): GameData {
  return buildGameData(readRawData(dir));
}

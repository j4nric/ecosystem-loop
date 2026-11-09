/** Lädt die Spieldaten aus dem data/-Verzeichnis (nur Node). */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildGameData } from '../core/data.ts';
import type { GameData } from '../core/schema.ts';

export const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');

export function loadGameData(dir: string = DEFAULT_DATA_DIR): GameData {
  const read = (f: string) => parse(readFileSync(join(dir, f), 'utf8')) as unknown;
  return buildGameData({
    config: read('config.yaml'),
    cards: read('cards.yaml'),
    animals: read('animals.yaml'),
    zones: read('zones.yaml'),
    scenarios: read('scenarios.yaml'),
  });
}

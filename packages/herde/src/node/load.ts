/** Lädt die Spieldaten der Herde aus dem data/-Verzeichnis (nur Node: Tests, Konsole, Absturz-Test). */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildData, DATA_FILES, type RawData } from '../data.ts';
import type { HerdeData } from '../schema.ts';

export const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');

/** Liest alle YAML-Dateien als Rohdaten (ungeprüft). */
export function readRawData(dir: string = DEFAULT_DATA_DIR): RawData {
  const entries = Object.entries(DATA_FILES).map(([key, file]) => [
    key,
    parse(readFileSync(join(dir, file), 'utf8')) as unknown,
  ]);
  return Object.fromEntries(entries) as unknown as RawData;
}

export function loadData(dir: string = DEFAULT_DATA_DIR): HerdeData {
  return buildData(readRawData(dir));
}

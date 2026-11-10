/**
 * Daten-Varianten für Vorher/Nachher-Messungen: Die YAML-Rohdaten werden im Speicher geändert, die Dateien in
 * packages/core/data bleiben unberührt. Schreibweise: `<datei>.<pfad>=<JSON-Wert>`, Listen-Elemente über ihre Id
 * in eckigen Klammern, z. B.
 *
 *   config.rules.life.food.perPrey=2
 *   geographies.geographies[mountains].rest.snow=2
 *   events.events[plague].effects[0].by=-2   (Zahl in Klammern = Index)
 *   +events.events[plague].scales=false      (+ = Schlüssel neu anlegen, sonst gilt ein Tippfehler als Fehler)
 */
import { buildGameData, type GameData, type RawData } from '@being-god/core';
import { readRawData } from '@being-god/core/node';

type Json = Record<string, unknown> | unknown[];

function child(node: unknown, seg: string): unknown {
  if (Array.isArray(node)) {
    if (/^\d+$/.test(seg)) return node[Number(seg)];
    return node.find((x) => typeof x === 'object' && x !== null && (x as { id?: unknown }).id === seg);
  }
  if (typeof node === 'object' && node !== null) return (node as Record<string, unknown>)[seg];
  return undefined;
}

/** Zerlegt `a.b[c].d` in [a, b, c, d]. */
export function pathOf(path: string): string[] {
  return path
    .replace(/\[([^\]]+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

/** Wendet eine Änderung auf die Rohdaten an (verändert `raw`). Wirft bei unbekanntem Pfad. */
export function applyTweak(raw: RawData, tweak: string): void {
  const eq = tweak.indexOf('=');
  if (eq < 0) throw new Error(`Änderung ohne "=": ${tweak}`);
  const create = tweak.startsWith('+');
  const segs = pathOf(tweak.slice(create ? 1 : 0, eq));
  const text = tweak.slice(eq + 1);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    value = text;
  }
  let node: unknown = raw;
  for (const seg of segs.slice(0, -1)) {
    node = child(node, seg);
    if (node === undefined || node === null) throw new Error(`Unbekannter Pfad in ${tweak} bei "${seg}"`);
  }
  const last = segs.at(-1)!;
  const parent = node as Json;
  if (Array.isArray(parent)) {
    const i = /^\d+$/.test(last) ? Number(last) : parent.findIndex((x) => (x as { id?: unknown }).id === last);
    if (i < 0) throw new Error(`Unbekanntes Listen-Element in ${tweak}: ${last}`);
    parent[i] = value;
  } else {
    if (!create && !(last in parent)) throw new Error(`Unbekannter Schlüssel in ${tweak}: ${last}`);
    parent[last] = value;
  }
}

/** Spieldaten mit Änderungen (leer = Originaldaten). */
export function gameDataWith(tweaks: readonly string[]): GameData {
  const raw = readRawData();
  for (const t of tweaks) applyTweak(raw, t);
  return buildGameData(raw);
}

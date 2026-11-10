/**
 * Baut aus rohen (z. B. YAML-)Objekten geprüfte GameData und kontrolliert alle Querverweise.
 * Plattformunabhängig: Das Lesen der Dateien übernimmt src/node/load.ts (Node) bzw. die App selbst.
 */
import type { z } from 'zod';
import { TEXT_KEYS } from './cards/text.ts';
import { RULES } from './rules/index.ts';
import {
  CardsFile,
  Config,
  CouplingsFile,
  GeographiesFile,
  HarmonyFile,
  MapFile,
  ScenariosFile,
  SeasonsFile,
  type Condition,
  type Effect,
  type FormRef,
  type GameData,
} from './schema/index.ts';

/** Rohdaten je Datei (geparstes YAML). */
export interface RawData {
  config: unknown;
  geographies: unknown;
  map: unknown;
  seasons: unknown;
  couplings: unknown;
  cards: unknown;
  harmony: unknown;
  scenarios: unknown;
}

/** Dateinamen in packages/core/data je Schlüssel von RawData. */
export const DATA_FILES: Readonly<Record<keyof RawData, string>> = {
  config: 'config.yaml',
  geographies: 'geographies.yaml',
  map: 'map.yaml',
  seasons: 'seasons.yaml',
  couplings: 'couplings.yaml',
  cards: 'cards.yaml',
  harmony: 'harmony.yaml',
  scenarios: 'scenarios.yaml',
};

export class DataError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Spieldaten fehlerhaft:\n  - ${problems.join('\n  - ')}`);
  }
}

export function buildGameData(raw: RawData): GameData {
  const problems: string[] = [];
  const parse = <T>(key: keyof RawData, schema: z.ZodType<T>): T | undefined => {
    const r = schema.safeParse(raw[key]);
    if (r.success) return r.data;
    for (const issue of r.error.issues) problems.push(`${DATA_FILES[key]}: ${issue.path.join('.')}: ${issue.message}`);
    return undefined;
  };

  const config = parse('config', Config);
  const geo = parse('geographies', GeographiesFile);
  const map = parse('map', MapFile);
  const seasons = parse('seasons', SeasonsFile);
  const couplings = parse('couplings', CouplingsFile);
  const cards = parse('cards', CardsFile);
  const harmony = parse('harmony', HarmonyFile);
  const scenarios = parse('scenarios', ScenariosFile);
  if (!config || !geo || !map || !seasons || !couplings || !cards || !harmony || !scenarios)
    throw new DataError(problems);

  const geographies = indexById('Geografie', geo.geographies, problems);
  const forms = new Map<string, FormRef>();
  for (const g of geo.geographies)
    for (const f of g.forms) {
      if (forms.has(f.id)) problems.push(`Form doppelt: ${f.id}`);
      forms.set(f.id, { geography: g.id, form: f });
    }

  const params: Record<string, unknown> = {};
  for (const [id, m] of RULES) {
    const r = m.params.safeParse(config.rules[id] ?? {});
    if (r.success) params[id] = r.data;
    else
      for (const issue of r.error.issues)
        problems.push(`config.yaml: rules.${id}.${issue.path.join('.')}: ${issue.message}`);
  }

  const data: GameData = {
    config,
    params,
    stats: indexById('Wert', geo.stats, problems),
    commonStats: geo.common,
    geographies,
    forms,
    zones: map.zones,
    seasons: seasons.seasons,
    startSeason: seasons.seasons.findIndex((s) => s.id === seasons.start),
    couplings: couplings.couplings,
    categories: indexById('Kategorie', cards.categories, problems),
    cards: indexById('Karte', cards.cards, problems),
    harmony,
    scenarios: indexById('Szenario', scenarios.scenarios, problems),
  };
  indexById('Jahreszeit', seasons.seasons, problems);
  indexById('Kopplung', couplings.couplings, problems);
  indexById('Zone', map.zones, problems);
  checkReferences(data, problems);
  if (problems.length) throw new DataError(problems);
  return data;
}

function indexById<T extends { id: string }>(label: string, items: T[], problems: string[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of items) {
    if (m.has(it.id)) problems.push(`${label} doppelt: ${it.id}`);
    m.set(it.id, it);
  }
  return m;
}

function checkReferences(d: GameData, p: string[]): void {
  const statOk = (where: string, s: string) => {
    if (!d.stats.has(s)) p.push(`${where}: unbekannter Wert ${s}`);
  };
  const checkCond = (where: string, cs: readonly Condition[]) => {
    for (const c of cs) {
      if ('stat' in c) statOk(where, c.stat);
      if ('hasStat' in c) statOk(where, c.hasStat);
      if ('geography' in c && !d.geographies.has(c.geography)) p.push(`${where}: unbekannte Geografie ${c.geography}`);
      if ('form' in c && !d.forms.has(c.form)) p.push(`${where}: unbekannte Form ${c.form}`);
      if ('season' in c && !d.seasons.some((s) => s.id === c.season))
        p.push(`${where}: unbekannte Jahreszeit ${c.season}`);
      if ('anyNeighbor' in c) checkCond(where, c.anyNeighbor);
      if ('not' in c) checkCond(where, c.not);
      if ('any' in c) checkCond(where, c.any);
    }
  };
  /** Prüft Effekte; `names` sind die gebundenen Zonen-Namen (Slots bzw. self/source). */
  const checkEffects = (where: string, es: readonly Effect[], names: ReadonlySet<string>) => {
    for (const e of es) {
      if ('adjust' in e) statOk(where, e.adjust);
      if ('set' in e) statOk(where, e.set);
      if ('restore' in e && e.restore !== 'all') statOk(where, e.restore);
      if ('transfer' in e) {
        statOk(where, e.transfer);
        statOk(where, e.into);
        if (!names.has(e.from)) p.push(`${where}: transfer from=${e.from} ist keine gebundene Zone`);
      }
      if ('at' in e && !names.has(e.at) && !('scope' in e && e.scope === 'all'))
        p.push(`${where}: Effektziel ${e.at} ist keine gebundene Zone`);
    }
  };

  // Werte und Geografien
  for (const s of d.commonStats) statOk('geographies.yaml common', s);
  for (const g of d.geographies.values()) {
    const where = `Geografie ${g.id}`;
    statOk(where, g.special);
    if (d.commonStats.includes(g.special)) p.push(`${where}: Sonderwert ${g.special} ist schon gemeinsam`);
    const own = new Set([...d.commonStats, g.special]);
    for (const s of own) if (g.rest[s] === undefined) p.push(`${where}: Ruhewert für ${s} fehlt`);
    for (const s of Object.keys(g.rest)) if (!own.has(s)) p.push(`${where}: Ruhewert für fremden Wert ${s}`);
    for (const f of g.forms) {
      checkCond(`${where} Form ${f.id}`, f.when);
      for (const c of f.when)
        if ('stat' in c && !own.has(c.stat)) p.push(`${where} Form ${f.id}: Wert ${c.stat} gibt es hier nicht`);
    }
    if (g.forms[g.forms.length - 1]!.when.length > 0)
      p.push(`${where}: letzte Form muss ohne Bedingungen sein („sonst“)`);
  }
  const scale = d.config.scale;
  const inScale = (where: string, v: number) => {
    if (v < scale.min || v > scale.max) p.push(`${where}: ${v} außerhalb ${scale.min}–${scale.max}`);
  };
  for (const g of d.geographies.values())
    for (const [s, v] of Object.entries(g.rest)) inScale(`Ruhewert ${g.id}.${s}`, v);

  // Karte der Insel
  const zoneIds = new Set(d.zones.map((z) => z.id));
  for (const z of d.zones) {
    const where = `Zone ${z.id}`;
    const g = d.geographies.get(z.geography);
    if (!g) p.push(`${where}: unbekannte Geografie ${z.geography}`);
    for (const [s, v] of Object.entries(z.start)) {
      if (g && s !== g.special && !d.commonStats.includes(s)) p.push(`${where}: Startwert für fremden Wert ${s}`);
      inScale(`${where}.${s}`, v);
    }
    for (const n of z.neighbors) {
      if (n === z.id) p.push(`${where}: Nachbar von sich selbst`);
      else if (!zoneIds.has(n)) p.push(`${where}: unbekannter Nachbar ${n}`);
      else if (!d.zones.find((o) => o.id === n)!.neighbors.includes(z.id))
        p.push(`${where}: Nachbarschaft zu ${n} nicht beidseitig`);
    }
  }

  // Jahreszeiten und Kopplungen
  if (d.startSeason < 0) p.push('seasons.yaml: unbekannte Start-Jahreszeit');
  const self = new Set(['self']);
  for (const s of d.seasons)
    for (const r of s.rules) {
      const where = `Jahreszeit ${s.id}`;
      for (const g of r.geographies) if (!d.geographies.has(g)) p.push(`${where}: unbekannte Geografie ${g}`);
      checkCond(where, r.when);
      checkEffects(where, r.effects, self);
    }
  for (const c of d.couplings) {
    const where = `Kopplung ${c.id}`;
    for (const s of c.seasons) if (!d.seasons.some((x) => x.id === s)) p.push(`${where}: unbekannte Jahreszeit ${s}`);
    if (!d.geographies.has(c.from.geography)) p.push(`${where}: unbekannte Geografie ${c.from.geography}`);
    if (c.to.geography !== undefined && !d.geographies.has(c.to.geography))
      p.push(`${where}: unbekannte Geografie ${c.to.geography}`);
    checkCond(where, c.from.when);
    checkCond(where, c.to.when);
    checkEffects(where, c.effects, new Set(['self', 'source']));
  }

  // Karten
  for (const card of d.cards.values()) {
    const where = `Karte ${card.id}`;
    if (!d.categories.has(card.category)) p.push(`${where}: unbekannte Kategorie ${card.category}`);
    const slots = new Set<string>();
    for (const s of card.slots) {
      if (slots.has(s.id)) p.push(`${where}: Slot doppelt ${s.id}`);
      if (s.kind === 'neighbor' && !slots.has(s.of))
        p.push(`${where}: Slot ${s.id} verweist auf unbekannten/späteren Slot ${s.of}`);
      checkCond(where, s.when);
      slots.add(s.id);
    }
    checkEffects(where, card.effects, slots);
    for (const t of card.triggers) {
      if (!slots.has(t.at)) p.push(`${where}: Schwelle ${t.id} at=${t.at} ist kein Slot`);
      checkCond(`${where} Schwelle ${t.id}`, t.when);
      checkEffects(`${where} Schwelle ${t.id}`, t.effects, slots);
    }
  }

  // Szenarien
  for (const s of d.scenarios.values()) {
    const where = `Szenario ${s.id}`;
    for (const st of Object.keys(s.adjust)) statOk(where, st);
    for (const [zid, o] of Object.entries(s.zones)) {
      if (!zoneIds.has(zid)) p.push(`${where}: unbekannte Zone ${zid}`);
      for (const st of Object.keys(o.stats)) statOk(where, st);
    }
  }
  if (!d.scenarios.has('standard')) p.push('Szenario "standard" fehlt');

  // Konfiguration
  for (const id of d.config.pipeline) if (!RULES.has(id)) p.push(`config.yaml pipeline: unbekanntes Modul ${id}`);
  for (const id of Object.keys(d.config.rules))
    if (!RULES.has(id)) p.push(`config.yaml rules: unbekanntes Modul ${id}`);
  for (const k of TEXT_KEYS) if (!d.config.texts[k]) p.push(`config.yaml texts: Baustein ${k} fehlt`);
  for (const c of d.config.starterDeck) if (!d.cards.has(c)) p.push(`starterDeck: unbekannte Karte ${c}`);
  const n = d.config.starterDeck.length;
  if (n < d.config.deck.minSize || n > d.config.deck.maxSize)
    p.push(`starterDeck: ${n} Karten, erlaubt ${d.config.deck.minSize}–${d.config.deck.maxSize}`);
}

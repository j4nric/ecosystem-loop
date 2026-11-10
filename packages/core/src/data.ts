/**
 * Baut aus rohen (z. B. YAML-)Objekten geprüfte GameData und kontrolliert alle Querverweise.
 * Plattformunabhängig: Das Lesen der Dateien übernimmt src/node/load.ts (Node) bzw. die App selbst.
 */
import type { z } from 'zod';
import { LOG_KEYS, TEXT_KEYS } from './cards/text.ts';
import { lifeParams } from './population.ts';
import { breathParams } from './rules/breath.ts';
import { evolutionParams } from './rules/evolution.ts';
import { RULES } from './rules/index.ts';
import { idealTargetOf } from './targets.ts';
import {
  CardsFile,
  Config,
  CouplingsFile,
  EventsFile,
  GeographiesFile,
  HarmonyFile,
  MapFile,
  MetaFile,
  ScenariosFile,
  SeasonsFile,
  SpeciesFile,
  type Card,
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
  species: unknown;
  scenarios: unknown;
  events: unknown;
  meta: unknown;
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
  species: 'species.yaml',
  scenarios: 'scenarios.yaml',
  events: 'events.yaml',
  meta: 'meta.yaml',
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
  const species = parse('species', SpeciesFile);
  const scenarios = parse('scenarios', ScenariosFile);
  const events = parse('events', EventsFile);
  const meta = parse('meta', MetaFile);
  if (
    !config ||
    !geo ||
    !map ||
    !seasons ||
    !couplings ||
    !cards ||
    !harmony ||
    !species ||
    !scenarios ||
    !events ||
    !meta
  )
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
    species: indexById('Art', species.species, problems),
    harmony,
    scenarios: indexById('Szenario', scenarios.scenarios, problems),
    events: indexById('Ereignis', events.events, problems),
    meta,
    ideals: new Map(),
  };
  for (const g of geo.geographies) {
    const ideal = idealTargetOf(g, config.scale);
    if (ideal) data.ideals.set(g.id, ideal);
  }
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
      if ('population' in c && !d.species.has(c.population)) p.push(`${where}: unbekannte Art ${c.population}`);
      if ('season' in c && !d.seasons.some((s) => s.id === c.season))
        p.push(`${where}: unbekannte Jahreszeit ${c.season}`);
      if ('anyNeighbor' in c) checkCond(where, c.anyNeighbor);
      if ('not' in c) checkCond(where, c.not);
      if ('any' in c) checkCond(where, c.any);
    }
  };
  /**
   * Prüft Effekte; `names` sind die gebundenen Zonen-Namen (Slots bzw. self/source),
   * `speciesSlots` die Art-Slots einer Karte.
   */
  const checkEffects = (
    where: string,
    es: readonly Effect[],
    names: ReadonlySet<string>,
    speciesSlots: ReadonlySet<string> = new Set(),
  ) => {
    const speciesOk = (ref: string) => {
      if (!speciesSlots.has(ref) && !d.species.has(ref)) p.push(`${where}: unbekannte Art ${ref}`);
    };
    for (const e of es) {
      if ('population' in e) speciesOk(e.population);
      if ('move' in e) {
        speciesOk(e.move);
        if (!names.has(e.from)) p.push(`${where}: move from=${e.from} ist keine gebundene Zone`);
      }
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
    const ideals = g.forms.filter((f) => f.kind === 'ideal').length;
    if (ideals !== 1) p.push(`${where}: genau eine Idealform nötig (gefunden ${ideals})`);
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
    const { zones: slots, species: speciesSlots } = checkSlots(d, card, where, p);
    for (const s of card.slots) {
      if ('when' in s) checkCond(where, s.when);
      if (s.kind === 'choice')
        for (const o of s.options) checkEffects(`${where} Option ${o.id}`, o.effects, slots, speciesSlots);
    }
    checkEffects(where, card.effects, slots, speciesSlots);
    for (const t of card.triggers) {
      if (!slots.has(t.at)) p.push(`${where}: Schwelle ${t.id} at=${t.at} ist kein Zonen-Slot`);
      checkCond(`${where} Schwelle ${t.id}`, t.when);
      checkEffects(`${where} Schwelle ${t.id}`, t.effects, slots, speciesSlots);
    }
  }

  // Arten
  checkSpecies(d, p, checkCond);

  // Ereignisse
  for (const e of d.events.values()) {
    const where = `Ereignis ${e.id}`;
    const names = new Set(e.target ? ['target'] : []);
    const speciesSlots = new Set(e.target?.pick === 'densest' ? ['species'] : []);
    if (e.target) checkCond(where, e.target.when);
    for (const r of e.rules) {
      for (const g of r.geographies) if (!d.geographies.has(g)) p.push(`${where}: unbekannte Geografie ${g}`);
      checkCond(where, r.when);
      checkEffects(where, r.effects, new Set([...names, 'self']), speciesSlots);
    }
    checkEffects(where, e.effects, names, speciesSlots);
    if (e.card !== undefined) {
      const card = d.cards.get(e.card);
      if (!card) p.push(`${where}: unbekannte Karte ${e.card}`);
      else if (card.slots.length !== 1 || card.slots[0]!.kind !== 'zone')
        p.push(`${where}: Karte ${e.card} braucht genau einen Zonen-Slot`);
      if (e.target?.pick !== 'random') p.push(`${where}: Karte braucht target.pick: random`);
    }
  }

  // Meta-Progression
  const known = (where: string, c: string) => {
    if (!d.cards.has(c)) p.push(`${where}: unbekannte Karte ${c}`);
  };
  for (const c of d.meta.basePool) known('meta.yaml basePool', c);
  indexById('Meilenstein', d.meta.milestones, p);
  for (const m of d.meta.milestones) for (const c of m.unlocks) known(`Meilenstein ${m.id}`, c);
  for (const c of d.config.starterDeck)
    if (d.cards.has(c) && !d.meta.basePool.includes(c)) p.push(`starterDeck: ${c} ist nicht im Grundpool (meta.yaml)`);
  const life = d.params.life !== undefined ? lifeParams(d) : null;
  if (life)
    for (const [stat, effects] of Object.entries(life.overuse)) {
      statOk('config.yaml rules.life.overuse', stat);
      checkEffects(`config.yaml rules.life.overuse.${stat}`, effects, self);
    }
  if (d.params.evolution !== undefined)
    checkCond('config.yaml rules.evolution.pressure', evolutionParams(d).pressure.when);

  // Szenarien
  const breathMax = d.params.breath !== undefined ? breathParams(d).max : null;
  for (const s of d.scenarios.values()) {
    const where = `Szenario ${s.id}`;
    for (const st of Object.keys(s.adjust)) statOk(where, st);
    for (const [zid, o] of Object.entries(s.zones)) {
      const mz = d.zones.find((z) => z.id === zid);
      if (!mz) p.push(`${where}: unbekannte Zone ${zid}`);
      const g = mz && d.geographies.get(mz.geography);
      for (const [st, v] of Object.entries(o.stats)) {
        statOk(where, st);
        if (g && d.stats.has(st) && st !== g.special && !d.commonStats.includes(st))
          p.push(`${where}: Zone ${zid} hat keinen Wert ${st}`);
        inScale(`${where} ${zid}.${st}`, v);
      }
    }
    if (s.harmony !== undefined && (s.harmony <= d.harmony.collapseAt || s.harmony > d.harmony.max))
      p.push(`${where}: Harmonie ${s.harmony} außerhalb ${d.harmony.collapseAt + 1}–${d.harmony.max}`);
    if (s.breath !== undefined && breathMax !== null && s.breath > breathMax)
      p.push(`${where}: Odem ${s.breath} außerhalb 0–${breathMax}`);
    for (const [zid, pops] of Object.entries(s.populations)) {
      if (!zoneIds.has(zid)) p.push(`${where}: unbekannte Zone ${zid}`);
      for (const [sp, n] of Object.entries(pops)) {
        if (!d.species.has(sp)) p.push(`${where}: unbekannte Art ${sp}`);
        if (life && (n < 0 || n > life.max)) p.push(`${where}: Bestand ${zid}.${sp}=${n} außerhalb 0–${life.max}`);
      }
    }
  }
  if (!d.scenarios.has('standard')) p.push('Szenario "standard" fehlt');

  // Konfiguration
  for (const id of d.config.pipeline) if (!RULES.has(id)) p.push(`config.yaml pipeline: unbekanntes Modul ${id}`);
  for (const id of Object.keys(d.config.rules))
    if (!RULES.has(id)) p.push(`config.yaml rules: unbekanntes Modul ${id}`);
  for (const k of [...TEXT_KEYS, ...LOG_KEYS]) if (!d.config.texts[k]) p.push(`config.yaml texts: Baustein ${k} fehlt`);
  for (const c of d.config.starterDeck) if (!d.cards.has(c)) p.push(`starterDeck: unbekannte Karte ${c}`);
  const n = d.config.starterDeck.length;
  if (n < d.config.deck.minSize || n > d.config.deck.maxSize)
    p.push(`starterDeck: ${n} Karten, erlaubt ${d.config.deck.minSize}–${d.config.deck.maxSize}`);
  for (const c of new Set(d.config.starterDeck)) {
    const copies = d.config.starterDeck.filter((x) => x === c).length;
    if (copies > d.config.deck.maxCopies) p.push(`starterDeck: ${c} ${copies}×, erlaubt ${d.config.deck.maxCopies}`);
  }
}

/** Slots einer Karte: Reihenfolge, Verweise, Art-Filter. Liefert die Zonen- und Art-Slots. */
function checkSlots(d: GameData, card: Card, where: string, p: string[]) {
  const zones = new Set<string>();
  const species = new Set<string>();
  for (const s of card.slots) {
    if (zones.has(s.id) || species.has(s.id)) p.push(`${where}: Slot doppelt ${s.id}`);
    if (d.species.has(s.id)) p.push(`${where}: Slot-Id ${s.id} ist schon eine Art`);
    if (s.kind === 'neighbor' && !zones.has(s.of))
      p.push(`${where}: Slot ${s.id} verweist auf unbekannten/späteren Slot ${s.of}`);
    if (s.kind === 'species') {
      if (!zones.has(s.in)) p.push(`${where}: Slot ${s.id} verweist auf unbekannten/späteren Slot ${s.in}`);
      if (s.eats !== undefined && !d.stats.has(s.eats) && !d.species.has(s.eats))
        p.push(`${where}: Slot ${s.id} eats=${s.eats} ist weder Wert noch Art`);
      for (const x of s.species ?? []) if (!d.species.has(x)) p.push(`${where}: unbekannte Art ${x}`);
      species.add(s.id);
    } else if (s.kind === 'choice') {
      const ids = new Set<string>();
      for (const o of s.options) {
        if (ids.has(o.id)) p.push(`${where}: Option doppelt ${o.id}`);
        ids.add(o.id);
      }
    } else zones.add(s.id);
  }
  return { zones, species };
}

/** Stammbaum: Vorfahren, Lebensräume, Nahrung, Gaben, Jagd. */
function checkSpecies(d: GameData, p: string[], checkCond: (where: string, cs: readonly Condition[]) => void): void {
  for (const sp of d.species.values()) {
    const where = `Art ${sp.id}`;
    if (d.stats.has(sp.id)) p.push(`${where}: Id ist schon ein Wert`);
    if (sp.ancestor !== null) {
      const a = d.species.get(sp.ancestor);
      if (!a) p.push(`${where}: unbekannter Vorfahr ${sp.ancestor}`);
      else if (a.tier >= sp.tier) p.push(`${where}: Vorfahr ${a.id} hat keine niedrigere Stufe`);
    }
    for (const f of sp.habitat) if (!d.forms.has(f)) p.push(`${where}: unbekannte Form ${f}`);
    for (const f of sp.diet)
      if (!d.stats.has(f) && !d.species.has(f)) p.push(`${where}: Nahrung ${f} ist weder Wert noch Art`);
    for (const c of sp.gift) if (!d.cards.has(c)) p.push(`${where}: unbekannte Gabe ${c}`);
    for (const h of sp.hunts) if (!d.species.has(h)) p.push(`${where}: jagt unbekannte Art ${h}`);
    checkCond(where, sp.evolve);
  }
}

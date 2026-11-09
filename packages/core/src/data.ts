/**
 * Baut aus rohen (z. B. YAML-)Objekten geprüfte GameData und kontrolliert Querverweise.
 * Plattformunabhängig – das Lesen der Dateien übernimmt src/node/load.ts.
 */
import type { Condition } from './schema.ts';
import { Animal, Card, Config, Scenario, ZonesFile, type Effect, type GameData } from './schema.ts';
import { z } from 'zod';

export interface RawData {
  config: unknown;
  cards: unknown;
  animals: unknown;
  zones: unknown;
  scenarios: unknown;
}

export class DataError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Spieldaten fehlerhaft:\n  - ${problems.join('\n  - ')}`);
  }
}

export function buildGameData(raw: RawData): GameData {
  const problems: string[] = [];
  const parse = <T>(label: string, schema: z.ZodType<T>, value: unknown): T | undefined => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const issue of r.error.issues) problems.push(`${label}: ${issue.path.join('.')}: ${issue.message}`);
    return undefined;
  };

  const config = parse('config.yaml', Config, raw.config);
  const cards = parse('cards.yaml', z.strictObject({ cards: z.array(Card) }), raw.cards)?.cards;
  const animals = parse('animals.yaml', z.strictObject({ animals: z.array(Animal) }), raw.animals)?.animals;
  const zones = parse('zones.yaml', ZonesFile, raw.zones);
  const scenarios = parse('scenarios.yaml', z.strictObject({ scenarios: z.array(Scenario) }), raw.scenarios)?.scenarios;
  if (!config || !cards || !animals || !zones || !scenarios) throw new DataError(problems);

  const data: GameData = {
    config,
    cards: indexById('Karte', cards, problems),
    animals: indexById('Tier', animals, problems),
    zoneTypes: indexById('Zonentyp', zones.zoneTypes, problems),
    mapZones: zones.map.zones,
    scenarios: indexById('Szenario', scenarios, problems),
  };
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
  const checkCond = (where: string, cs: readonly Condition[]) => {
    for (const c of cs) {
      if ('animal' in c && !d.animals.has(c.animal)) p.push(`${where}: unbekanntes Tier ${c.animal}`);
      if ('noAnimal' in c && !d.animals.has(c.noAnimal)) p.push(`${where}: unbekanntes Tier ${c.noAnimal}`);
      if ('cardPlayed' in c && !d.cards.has(c.cardPlayed)) p.push(`${where}: unbekannte Karte ${c.cardPlayed}`);
      if ('zoneType' in c && !d.zoneTypes.has(c.zoneType)) p.push(`${where}: unbekannter Zonentyp ${c.zoneType}`);
      if ('anyNeighbor' in c) checkCond(where, c.anyNeighbor);
      if ('not' in c) checkCond(where, c.not);
      if ('any' in c) checkCond(where, c.any);
    }
  };

  // Karten
  for (const card of d.cards.values()) {
    const where = `Karte ${card.id}`;
    const slots = new Map<string, string>();
    for (const s of card.slots) {
      if (slots.has(s.id)) p.push(`${where}: Slot doppelt ${s.id}`);
      const ref = 'of' in s ? s.of : 'in' in s ? s.in : null;
      if (ref !== null) {
        const k = slots.get(ref);
        if (!k) p.push(`${where}: Slot ${s.id} verweist auf unbekannten/späteren Slot ${ref}`);
        else if (!['zone', 'neighbor', 'otherZone'].includes(k)) p.push(`${where}: Slot ${ref} ist keine Zone`);
      }
      if ('when' in s) checkCond(where, s.when);
      slots.set(s.id, s.kind);
    }
    const isZoneSlot = (id: string) => ['zone', 'neighbor', 'otherZone'].includes(slots.get(id) ?? '');
    const checkEffects = (es: readonly Effect[]) => {
      for (const e of es) {
        if ('at' in e && !isZoneSlot(e.at)) p.push(`${where}: Effektziel ${e.at} ist kein Zonen-Slot`);
        if ('discard' in e && slots.get(e.discard) !== 'handCard')
          p.push(`${where}: discard braucht einen handCard-Slot (${e.discard})`);
        if ('moveAnimal' in e) {
          if (slots.get(e.moveAnimal) !== 'animal') p.push(`${where}: moveAnimal braucht einen animal-Slot`);
          if (!isZoneSlot(e.from) || !isZoneSlot(e.to)) p.push(`${where}: moveAnimal from/to müssen Zonen-Slots sein`);
        }
        if ('connect' in e && !e.connect.every(isZoneSlot)) p.push(`${where}: connect braucht Zonen-Slots`);
        if ('include' in e) {
          const inc = d.cards.get(e.include);
          if (!inc) p.push(`${where}: include unbekannte Karte ${e.include}`);
          else
            for (const s of inc.slots) if (!slots.has(s.id)) p.push(`${where}: include ${inc.id} braucht Slot ${s.id}`);
        }
      }
    };
    checkEffects(card.effects);
    for (const t of card.triggers) {
      if (!isZoneSlot(t.at)) p.push(`${where}: Schwelle ${t.id} at=${t.at} ist kein Zonen-Slot`);
      checkCond(where, t.when);
      checkEffects(t.effects);
    }
  }

  // Tiere
  for (const a of d.animals.values()) {
    const where = `Tier ${a.id}`;
    if (!d.cards.has(a.card)) p.push(`${where}: unbekannte Karte ${a.card}`);
    for (const prey of a.eats) if (!d.animals.has(prey)) p.push(`${where}: frisst unbekanntes Tier ${prey}`);
    checkCond(where, a.conditions);
  }

  // Zonen
  for (const t of d.zoneTypes.values())
    for (const tr of t.transitions) {
      if (!d.zoneTypes.has(tr.to)) p.push(`Zonentyp ${t.id}: Wechsel zu unbekanntem Typ ${tr.to}`);
      checkCond(`Zonentyp ${t.id}`, tr.when);
    }
  const zoneIds = new Set(d.mapZones.map((z) => z.id));
  for (const z of d.mapZones) {
    if (!d.zoneTypes.has(z.type)) p.push(`Zone ${z.id}: unbekannter Typ ${z.type}`);
    for (const n of z.neighbors) {
      if (!zoneIds.has(n)) p.push(`Zone ${z.id}: unbekannter Nachbar ${n}`);
      else if (!d.mapZones.find((o) => o.id === n)!.neighbors.includes(z.id))
        p.push(`Zone ${z.id}: Nachbarschaft zu ${n} nicht beidseitig`);
    }
  }
  for (const s of d.scenarios.values())
    for (const [zid, o] of Object.entries(s.zones)) {
      if (!zoneIds.has(zid)) p.push(`Szenario ${s.id}: unbekannte Zone ${zid}`);
      if (o.type && !d.zoneTypes.has(o.type)) p.push(`Szenario ${s.id}: unbekannter Typ ${o.type}`);
    }
  if (!d.scenarios.has('standard')) p.push('Szenario "standard" fehlt');

  // Startdeck
  for (const c of d.config.starterDeck) if (!d.cards.has(c)) p.push(`starterDeck: unbekannte Karte ${c}`);
  const n = d.config.starterDeck.length;
  if (n < d.config.deck.minSize || n > d.config.deck.maxSize)
    p.push(`starterDeck: ${n} Karten, erlaubt ${d.config.deck.minSize}–${d.config.deck.maxSize}`);
}

/**
 * Baut aus rohen (z. B. YAML-)Objekten geprüfte HerdeData und kontrolliert alle Querverweise.
 * Plattformunabhängig: Das Lesen der Dateien übernimmt src/node/load.ts (Node) bzw. die App selbst.
 */
import type { z } from 'zod';
import {
  CardsFile,
  IslandsFile,
  LandscapesFile,
  Params,
  SeasonsFile,
  StagesFile,
  TraitsFile,
  type SeasonSet,
  type HerdeData,
  type Island,
} from './schema.ts';

/** Rohdaten je Datei (geparstes YAML). */
export interface RawData {
  landscapes: unknown;
  cards: unknown;
  seasons: unknown;
  stages: unknown;
  traits: unknown;
  params: unknown;
  islands: unknown;
}

/** Dateinamen in packages/herde/data je Schlüssel von RawData. */
export const DATA_FILES: Readonly<Record<keyof RawData, string>> = {
  landscapes: 'landscapes.yaml',
  cards: 'cards.yaml',
  seasons: 'seasons.yaml',
  stages: 'stages.yaml',
  traits: 'traits.yaml',
  params: 'params.yaml',
  islands: 'islands.yaml',
};

export class DataError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Spieldaten (herde) fehlerhaft:\n  - ${problems.join('\n  - ')}`);
    this.name = 'DataError';
  }
}

function byId<T extends { id: string }>(items: T[], file: string, problems: string[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) problems.push(`${file}: Id ${item.id} doppelt`);
    map.set(item.id, item);
  }
  return map;
}

export function buildData(raw: RawData): HerdeData {
  const problems: string[] = [];
  const parse = <T>(key: keyof RawData, schema: z.ZodType<T>): T | undefined => {
    const r = schema.safeParse(raw[key]);
    if (r.success) return r.data;
    for (const issue of r.error.issues) problems.push(`${DATA_FILES[key]}: ${issue.path.join('.')}: ${issue.message}`);
    return undefined;
  };
  const landscapesFile = parse('landscapes', LandscapesFile);
  const cardsFile = parse('cards', CardsFile);
  const seasonsFile = parse('seasons', SeasonsFile);
  const stagesFile = parse('stages', StagesFile);
  const traitsFile = parse('traits', TraitsFile);
  const params = parse('params', Params);
  const islandsFile = parse('islands', IslandsFile);
  if (!landscapesFile || !cardsFile || !seasonsFile || !stagesFile || !traitsFile || !params || !islandsFile)
    throw new DataError(problems);

  const landscapes = byId(landscapesFile.landscapes, DATA_FILES.landscapes, problems);
  const cards = byId(cardsFile.cards, DATA_FILES.cards, problems);
  const stages = byId(stagesFile.stages, DATA_FILES.stages, problems);
  const experiences = byId(traitsFile.experiences, DATA_FILES.traits, problems);
  const traits = byId(traitsFile.traits, DATA_FILES.traits, problems);
  const seasonIds = seasonsFile.seasons.map((s) => s.id);
  if (new Set(seasonIds).size !== seasonIds.length) problems.push(`${DATA_FILES.seasons}: Jahreszeit doppelt`);
  const yearLength = seasonIds.length * seasonsFile.monthsPerSeason;

  const land = (file: string, where: string, id: string | undefined) => {
    if (id !== undefined && !landscapes.has(id)) problems.push(`${file}: ${where}: unbekannte Landschaft ${id}`);
  };

  // Landschaften
  for (const l of landscapes.values()) {
    const where = `Landschaft ${l.id}`;
    const keys = Object.keys(l.grow);
    if (keys.length !== seasonIds.length || seasonIds.some((s) => !(s in l.grow)))
      problems.push(`${DATA_FILES.landscapes}: ${where}: grow braucht genau die Jahreszeiten ${seasonIds.join(', ')}`);
    land(DATA_FILES.landscapes, `${where} → succession`, l.succession?.to);
    land(DATA_FILES.landscapes, `${where} → burnsTo`, l.burnsTo);
    if (l.succession?.to === l.id) problems.push(`${DATA_FILES.landscapes}: ${where}: Sukzession auf sich selbst`);
    if (l.fireChance > 0 && !l.burnsTo)
      problems.push(`${DATA_FILES.landscapes}: ${where}: fireChance ohne burnsTo (nicht brennbar)`);
    const burnt = l.burnsTo ? landscapes.get(l.burnsTo) : undefined;
    if (burnt?.burnsTo)
      problems.push(`${DATA_FILES.landscapes}: ${where}: Brandfläche ${burnt.id} ist selbst brennbar`);
    if (l.den && !l.wood) problems.push(`${DATA_FILES.landscapes}: ${where}: den nur für Gehölz (wood)`);
  }

  // Karten
  for (const c of cards.values()) {
    const where = `Karte ${c.id}`;
    for (const id of c.on) land(DATA_FILES.cards, `${where} → on`, id);
    if (c.effect.type === 'transform') {
      land(DATA_FILES.cards, `${where} → effect.to`, c.effect.to);
      if (c.on.includes(c.effect.to)) problems.push(`${DATA_FILES.cards}: ${where}: Ziel ${c.effect.to} in on`);
    }
    if (c.effect.type === 'ignite')
      for (const id of c.on)
        if (landscapes.has(id) && !landscapes.get(id)!.burnsTo)
          problems.push(`${DATA_FILES.cards}: ${where}: ${id} ist nicht brennbar`);
    if (c.global && c.effect.type !== 'grow')
      problems.push(`${DATA_FILES.cards}: ${where}: global geht nur mit effect grow`);
  }

  // Jahreskreis
  if (seasonsFile.months.length !== yearLength)
    problems.push(`${DATA_FILES.seasons}: ${seasonsFile.months.length} Monatsnamen statt ${yearLength}`);

  // Stufen
  const seasonsOk = (where: string, set: SeasonSet) => {
    if (set === 'all') return;
    for (const id of set)
      if (!seasonIds.includes(id)) problems.push(`${DATA_FILES.stages}: ${where}: unbekannte Jahreszeit ${id}`);
  };
  for (const s of stages.values()) {
    const where = `Stufe ${s.id}`;
    for (const key of ['eats', 'water', 'shelter', 'blocked'] as const)
      for (const id of s[key]) land(DATA_FILES.stages, `${where} → ${key}`, id);
    seasonsOk(`${where} → needs.water`, s.needs.water);
    seasonsOk(`${where} → needs.shelter`, s.needs.shelter);
    for (const [id, f] of Object.entries(s.forage)) {
      land(DATA_FILES.stages, `${where} → forage`, id);
      if (Object.keys(f.grow).length !== seasonIds.length || seasonIds.some((x) => !(x in f.grow)))
        problems.push(
          `${DATA_FILES.stages}: ${where} → forage ${id}: grow braucht genau die Jahreszeiten ${seasonIds.join(', ')}`,
        );
    }
    if (s.next !== undefined) {
      if (!stages.has(s.next)) problems.push(`${DATA_FILES.stages}: ${where} → next: unbekannte Stufe ${s.next}`);
      if (!s.mature) problems.push(`${DATA_FILES.stages}: ${where}: next ohne mature`);
    } else if (s.mature) problems.push(`${DATA_FILES.stages}: ${where}: mature ohne next`);
    for (const id of s.mature?.oneOf ?? [])
      if (!traits.has(id)) problems.push(`${DATA_FILES.stages}: ${where} → mature.oneOf: unbekanntes Merkmal ${id}`);
    if (s.mature && s.mature.traits > traits.size)
      problems.push(`${DATA_FILES.stages}: ${where}: mature.traits ${s.mature.traits} > Zahl der Merkmale`);
    if (s.preyFood > 0 !== s.huntKill > 0)
      problems.push(`${DATA_FILES.stages}: ${where}: preyFood und huntKill nur gemeinsam (Jagd)`);
    if (s.camp) {
      for (const id of s.camp.on) {
        land(DATA_FILES.stages, `${where} → camp.on`, id);
        if (landscapes.has(id) && !landscapes.get(id)!.walk)
          problems.push(`${DATA_FILES.stages}: ${where}: camp.on ${id} ist nicht begehbar`);
        if (s.blocked.includes(id))
          problems.push(`${DATA_FILES.stages}: ${where}: camp.on ${id} ist für diese Stufe ein Hindernis`);
      }
      s.camp.near.forEach((group, i) => {
        for (const id of group) land(DATA_FILES.stages, `${where} → camp.near.${i}`, id);
      });
      const clear = s.camp.clear;
      if (clear) {
        for (const id of clear.lands) land(DATA_FILES.stages, `${where} → camp.clear.lands`, id);
        land(DATA_FILES.stages, `${where} → camp.clear.to`, clear.to);
        if (landscapes.has(clear.to) && !landscapes.get(clear.to)!.walk)
          problems.push(`${DATA_FILES.stages}: ${where}: camp.clear.to ${clear.to} ist nicht begehbar`);
        if (clear.lands.includes(clear.to))
          problems.push(`${DATA_FILES.stages}: ${where}: camp.clear.to ${clear.to} in camp.clear.lands`);
        if (clear.month >= yearLength)
          problems.push(`${DATA_FILES.stages}: ${where}: camp.clear.month ${clear.month} ≥ Jahreslänge ${yearLength}`);
      }
    }
  }
  // Fester Weg: Von jeder Stufe aus führt `next` nie im Kreis.
  for (const s of stages.values()) {
    const seen = new Set<string>([s.id]);
    for (let n = s.next; n !== undefined; n = stages.get(n)?.next) {
      if (seen.has(n)) {
        problems.push(`${DATA_FILES.stages}: Stufe ${s.id}: next führt im Kreis`);
        break;
      }
      seen.add(n);
    }
  }

  // Erfahrungen und Merkmale
  for (const e of experiences.values())
    if (e.when.type === 'ate' || e.when.type === 'on')
      for (const id of e.when.lands) land(DATA_FILES.traits, `Erfahrung ${e.id} → when.lands`, id);
  for (const t of traits.values()) {
    if (!experiences.has(t.from))
      problems.push(`${DATA_FILES.traits}: Merkmal ${t.id} → from: unbekannte Erfahrung ${t.from}`);
  }

  // Parameter
  if (!stages.has(params.herd.stage))
    problems.push(`${DATA_FILES.params}: herd.stage: unbekannte Stufe ${params.herd.stage}`);
  // Wild: Stufe auf dem festen Weg ab der Startstufe, Landschaften bekannt und begehbar
  const path: string[] = [];
  for (
    let id: string | undefined = params.herd.stage;
    id !== undefined && !path.includes(id);
    id = stages.get(id)?.next
  )
    path.push(id);
  if (!path.includes(params.prey.from))
    problems.push(`${DATA_FILES.params}: prey.from: Stufe ${params.prey.from} liegt nicht auf dem Weg ab herd.stage`);
  for (const id of params.prey.lands) {
    land(DATA_FILES.params, 'prey.lands', id);
    if (landscapes.has(id) && !landscapes.get(id)!.walk)
      problems.push(`${DATA_FILES.params}: prey.lands: ${id} ist nicht begehbar`);
  }
  for (const id of params.prey.eats) land(DATA_FILES.params, 'prey.eats', id);
  if (params.prey.spawnSize > params.prey.maxSize) problems.push(`${DATA_FILES.params}: prey.spawnSize > prey.maxSize`);
  if (params.ice.wildAfter >= params.wild.max)
    problems.push(`${DATA_FILES.params}: ice.wildAfter muss kleiner als wild.max sein`);
  if (params.herd.birthMonth >= yearLength)
    problems.push(`${DATA_FILES.params}: herd.birthMonth ${params.herd.birthMonth} ≥ Jahreslänge ${yearLength}`);
  if (!seasonIds.includes(params.ice.season))
    problems.push(`${DATA_FILES.params}: ice.season: unbekannte Jahreszeit ${params.ice.season}`);
  if (params.cards.startHand > params.cards.handMax) problems.push(`${DATA_FILES.params}: cards.startHand > handMax`);
  // Sonst verkümmert ein Rudel nach dem ersten Mal jeden Monat (der Hunger stünde schon wieder auf der Schwelle).
  if (params.wolves.starveReset >= params.wolves.starveAfter)
    problems.push(`${DATA_FILES.params}: wolves.starveReset muss kleiner als starveAfter sein`);

  // Inseln
  const islands = new Map<string, Island>();
  for (const raw of islandsFile.islands) {
    const where = `Insel ${raw.id}`;
    if (islands.has(raw.id)) problems.push(`${DATA_FILES.islands}: Id ${raw.id} doppelt`);
    for (const [ch, id] of Object.entries(raw.legend)) land(DATA_FILES.islands, `${where} → legend ${ch}`, id);
    const width = raw.rows[0]!.length;
    const cells: string[] = [];
    raw.rows.forEach((row, y) => {
      const chars = [...row];
      if (chars.length !== width)
        problems.push(`${DATA_FILES.islands}: ${where}: Zeile ${y} hat ${chars.length} statt ${width} Felder`);
      chars.forEach((ch, x) => {
        const id = raw.legend[ch];
        if (id === undefined)
          problems.push(`${DATA_FILES.islands}: ${where}: Zeichen „${ch}“ (${x},${y}) fehlt in legend`);
        cells.push(id ?? '');
      });
    });
    const height = raw.rows.length;
    const at = (x: number, y: number) =>
      x < width && y < height ? landscapes.get(cells[y * width + x] ?? '') : undefined;
    const h = at(raw.herd.x, raw.herd.y);
    if (!h?.walk)
      problems.push(`${DATA_FILES.islands}: ${where}: Herde (${raw.herd.x},${raw.herd.y}) nicht auf begehbarem Feld`);
    const seen = new Set<string>();
    for (const p of raw.packs) {
      if (!at(p.x, p.y)?.wood) problems.push(`${DATA_FILES.islands}: ${where}: Rudel (${p.x},${p.y}) nicht im Gehölz`);
      if (seen.has(`${p.x},${p.y}`)) problems.push(`${DATA_FILES.islands}: ${where}: zwei Rudel auf (${p.x},${p.y})`);
      seen.add(`${p.x},${p.y}`);
      if (p.size > params.wolves.maxSize)
        problems.push(`${DATA_FILES.islands}: ${where}: Rudel (${p.x},${p.y}) stärker als wolves.maxSize`);
    }
    islands.set(raw.id, {
      id: raw.id,
      name: raw.name,
      width,
      height,
      cells,
      herd: { ...raw.herd },
      packs: raw.packs.map((p) => ({ ...p })),
    });
  }

  if (problems.length > 0) throw new DataError(problems);
  return {
    landscapes,
    cards,
    seasons: seasonsFile.seasons,
    monthsPerSeason: seasonsFile.monthsPerSeason,
    months: seasonsFile.months,
    stages,
    experiences,
    traits,
    offerSize: traitsFile.offerSize,
    params,
    islands,
  };
}

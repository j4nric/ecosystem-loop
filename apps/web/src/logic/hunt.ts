/**
 * Anzeige zu Wild, Jagd, Lager, Eiszeiten und Partie-Ende (rein, ohne DOM). Die Regeln rechnet die Engine
 * (`view.prey`, `view.campSites`, `view.iceAges`, `evolution.stage.camp` …); hier wird nur gezählt und benannt.
 */
import type { CellView, HerdeData, HerdeView, Pos, StageNeedsView } from '@being-god/herde';
import type { HuntRules, Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';
import { landName, stageName, textOf } from './format.ts';

/** Zahl der Wild-Tiere auf der Insel (Summe der Bestände). */
export const preyAnimals = (view: Pick<HerdeView, 'prey'>): number => view.prey.reduce((a, p) => a + p.size, 0);

/** Position einer Stufe auf dem festen Weg (Reihenfolge in stages.yaml); −1, wenn unbekannt. */
export const stageIndex = (data: HerdeData, id: string): number => [...data.stages.keys()].indexOf(id);

/**
 * Wild-Zähler in der Statusleiste: sobald Wild auf der Insel ist oder die Herde die Stufe erreicht hat, ab der Wild
 * einwandert (`params.prey.from`). Davor wäre er immer 0 und nur verwirrend.
 */
export function showPreyCounter(data: HerdeData, view: Pick<HerdeView, 'prey' | 'herd'>): boolean {
  if (view.prey.length > 0) return true;
  const from = stageIndex(data, data.params.prey.from);
  return from >= 0 && stageIndex(data, view.herd.stage) >= from;
}

/** Felder im Umkreis `r` (Chebyshev, nur innerhalb der Insel) – derselbe Umkreis wie in der Engine. */
export function cellsAround(view: Pick<HerdeView, 'cells' | 'width' | 'height'>, pos: Pos, r: number): CellView[] {
  const out: CellView[] = [];
  for (let y = pos.y - r; y <= pos.y + r; y++)
    for (let x = pos.x - r; x <= pos.x + r; x++) {
      if (x < 0 || y < 0 || x >= view.width || y >= view.height) continue;
      const cell = view.cells[y * view.width + x];
      if (cell) out.push(cell);
    }
  return out;
}

const groupName = (data: HerdeData, locale: Locale, group: readonly string[], or: string) =>
  group.map((id) => landName(data, locale, id)).join(or);

/** Gruppen aus `camp.near` als Namen: „Fluss“, „Wiese“, „Wald oder Altwald“. */
export function campGroupNames(data: HerdeData, locale: Locale, camp: { near: string[][] }): string[] {
  const or = locale === 'de' ? ' oder ' : ' or ';
  return camp.near.map((g) => groupName(data, locale, g, or));
}

/** Hinweis zum Lager: Plätze stehen zur Wahl, Eiszeit (keine Gründung) oder kein Platz in Zugweite. */
export type CampBanner = { kind: 'choose'; sites: number } | { kind: 'ice' } | { kind: 'none' } | null;

export function campBanner(view: Pick<HerdeView, 'evolution' | 'camp' | 'campSites' | 'ice' | 'over'>): CampBanner {
  if (view.over || view.camp || !view.evolution.stage.camp) return null;
  if (view.campSites.length > 0) return { kind: 'choose', sites: view.campSites.length };
  if (view.ice.active) return { kind: 'ice' };
  return { kind: 'none' };
}

export const isCampSite = (view: Pick<HerdeView, 'campSites'>, pos: Pos | null): boolean =>
  !!pos && view.campSites.some((p) => p.x === pos.x && p.y === pos.y);

/** Erster Lagerplatz für den Hinweis: das Feld der Herde, sonst der erste der Engine (Zeile für Zeile). */
export function firstCampSite(view: Pick<HerdeView, 'campSites' | 'herd'>): Pos | null {
  return view.campSites.find((p) => p.x === view.herd.x && p.y === view.herd.y) ?? view.campSites[0] ?? null;
}

export interface CampPreview {
  pos: Pos;
  radius: number;
  /** je Gruppe aus `camp.near`: Name („Wald oder Altwald“), Kurzname („Wald/Altwald“) und Felder im Umkreis */
  groups: { name: string; short: string; count: number }[];
  /** Umkreis, aus dem die Herde am Lager frisst, trinkt und Schutz sucht (`reach` der Stufe) */
  reach: number;
  food: number;
  shelter: number;
  /** Wildbestände im Umkreis `reach` */
  prey: number;
  /** die Herde zieht dafür auf ein anderes Feld */
  moves: boolean;
  /** Rodung aus den Daten (`stages.yaml → camp.clear`); `fields`: solche Felder jetzt im Umkreis `radius` */
  clear: { lands: string[]; to: string; month: string; fields: number } | null;
}

/** Vorschau eines Lagerplatzes: was im Umkreis liegt und was das Lager dort bedeutet. */
export function campPreview(
  data: HerdeData,
  locale: Locale,
  view: Pick<HerdeView, 'cells' | 'width' | 'height' | 'evolution' | 'prey' | 'herd'>,
  pos: Pos,
): CampPreview | null {
  const stage = view.evolution.stage;
  const camp = stage.camp;
  if (!camp) return null;
  const near = cellsAround(view, pos, camp.radius);
  const reach = cellsAround(view, pos, stage.reach);
  const names = campGroupNames(data, locale, camp);
  const clear = data.stages.get(stage.id)?.camp?.clear;
  return {
    pos,
    radius: camp.radius,
    groups: camp.near.map((group, i) => ({
      name: names[i] ?? '',
      short: groupName(data, locale, group, '/'),
      count: near.filter((c) => group.includes(c.land)).length,
    })),
    reach: stage.reach,
    food: reach.filter((c) => stage.eats.includes(c.land)).length,
    shelter: reach.filter((c) => stage.shelter.includes(c.land)).length,
    prey: view.prey.filter((p) => Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y)) <= stage.reach).length,
    moves: pos.x !== view.herd.x || pos.y !== view.herd.y,
    clear: clear
      ? {
          lands: clear.lands.map((id) => landName(data, locale, id)),
          to: landName(data, locale, clear.to),
          month: textOf(data.months[clear.month % data.months.length], locale, String(clear.month + 1)),
          fields: near.filter((c) => clear.lands.includes(c.land)).length,
        }
      : null,
  };
}

/** Die Vorschau als Zeilen (Umkreis, Futter, Schutz, Wild; danach Folgen). */
export function campPreviewLines(t: Strings, p: CampPreview): { around: string[]; effects: string[] } {
  return {
    around: [
      ...p.groups.map((g) => t.campGroup(g.name, g.count)),
      t.campFood(p.food, p.reach),
      t.campShelter(p.shelter),
      t.campPrey(p.prey),
    ],
    effects: [
      t.campSettled,
      ...(p.moves ? [t.campMoves] : []),
      ...(p.clear ? [t.campClear(p.clear.lands, p.clear.to, p.clear.month, p.radius, p.clear.fields)] : []),
    ],
  };
}

/** Ein Wert der kompakten Vorschau (Chip): Bezeichnung, Zahl, fehlt. */
export interface CampChip {
  label: string;
  value: number;
  bad: boolean;
}

/**
 * Kompakte Vorschau im Dock: `near` je Gruppe die Felder im Umkreis des Lagerplatzes (`camp.radius`), `reach`
 * Futter, Schutz und Wild im Umkreis, aus dem die Herde am Lager lebt (`reach` der Stufe).
 */
export function campChips(t: Strings, p: CampPreview): { near: CampChip[]; reach: CampChip[] } {
  return {
    near: p.groups.map((g) => ({ label: g.short, value: g.count, bad: g.count === 0 })),
    reach: [
      { label: t.campChipFood, value: p.food, bad: p.food === 0 },
      { label: t.campChipShelter, value: p.shelter, bad: p.shelter === 0 },
      { label: t.campChipPrey, value: p.prey, bad: false },
    ],
  };
}

/** Ein Satz zu den Folgen für das Dock (die Bestätigung nennt sie ausführlich). */
export const campShort = (t: Strings, p: CampPreview): string =>
  t.campShort(p.clear ? { lands: p.clear.lands, month: p.clear.month, fields: p.clear.fields } : null);

/**
 * Mögliche Lagerplätze auf der ganzen Insel (begehbar, je eine Landschaft jeder Gruppe im Umkreis), ohne Zugweite –
 * für die Vorschau der nächsten Stufe, für die die Engine noch keine Plätze liefert.
 */
export function campSpotsOnIsland(
  view: Pick<HerdeView, 'cells' | 'width' | 'height'>,
  camp: NonNullable<StageNeedsView['camp']>,
): number {
  return view.cells.filter((c) => {
    if (!c.walkable) return false;
    const lands = cellsAround(view, c, camp.radius).map((q) => q.land);
    return camp.near.every((group) => group.some((id) => lands.includes(id)));
  }).length;
}

/**
 * Hinweis zur Beute der nächsten Stufe: wie viel Wild auf der Insel ist bzw. wann es einwandert (Lebensraum und
 * Mindestzahl aus `params.prey`). null, wenn die Stufe nicht jagt.
 */
export function preyHint(
  t: Strings,
  data: HerdeData,
  locale: Locale,
  view: Pick<HerdeView, 'cells' | 'prey' | 'herd'>,
  needs: StageNeedsView,
): string | null {
  if (!needs.prey) return null;
  const name = stageName(data, locale, needs.id);
  if (view.prey.length > 0) return t.preyHintSome(name, view.prey.length, preyAnimals(view));
  const p = data.params.prey;
  const habitat = view.cells.filter((c) => p.lands.includes(c.land)).length;
  const reached = stageIndex(data, view.herd.stage) >= stageIndex(data, p.from);
  return t.preyHintNone(
    name,
    p.lands.map((id) => landName(data, locale, id)),
    habitat,
    p.spawnMinLand,
    reached ? null : stageName(data, locale, p.from),
  );
}

/** Zeilen zu Wild und Lager für die Feld-Info. */
export function preyFieldLines(
  t: Strings,
  data: HerdeData,
  view: Pick<HerdeView, 'prey' | 'herd' | 'evolution'>,
  cell: CellView,
): string[] {
  const lines: string[] = [];
  if (cell.camp) lines.push(t.infoCamp);
  const prey = cell.prey === null || cell.prey === undefined ? undefined : view.prey.find((p) => p.id === cell.prey);
  if (prey) {
    lines.push(t.infoPrey(prey.size, data.params.prey.maxSize, prey.hungry));
    const reach = view.evolution.stage.reach;
    if (view.evolution.stage.prey && Math.max(Math.abs(prey.x - view.herd.x), Math.abs(prey.y - view.herd.y)) <= reach)
      lines.push(t.infoPreyReach);
  } else if (data.params.prey.lands.includes(cell.land) && showPreyCounter(data, view)) lines.push(t.infoPreyLand);
  return lines;
}

/** Eiszeit am Jahreskreis: die laufende bzw. nächste (ab 1) und die letzte Prüfung. */
export function iceAgeNumber(view: Pick<HerdeView, 'iceAges'>): { n: number; max: number | null } {
  const max = view.iceAges.max;
  const n = view.iceAges.survived + 1;
  return { n: max === null ? n : Math.min(n, max), max };
}

/** Regeln zu Wild, Jagd, Feuer, Lager für die Hilfe – alle Zahlen aus den Daten. */
export function huntRules(data: HerdeData, locale: Locale): HuntRules {
  const p = data.params;
  const stages = [...data.stages.values()];
  const name = (id: string) => stageName(data, locale, id);
  const or = locale === 'de' ? ' oder ' : ' or ';
  const campStage = stages.find((s) => s.camp);
  const camp = campStage?.camp;
  return {
    preyFrom: name(p.prey.from),
    preyLands: p.prey.lands.map((id) => landName(data, locale, id)),
    preyMax: p.prey.maxSize,
    spawnMinLand: p.prey.spawnMinLand,
    spawnSize: p.prey.spawnSize,
    hunters: stages
      .filter((s) => s.preyFood > 0)
      .map((s) => ({ name: name(s.id), food: s.preyFood, kill: s.huntKill, fire: s.fireHunt })),
    rivals: stages.filter((s) => s.wolves === 'rival').map((s) => name(s.id)),
    fresh: p.fire.fresh,
    camp:
      campStage && camp
        ? {
            stage: name(campStage.id),
            radius: camp.radius,
            near: camp.near.map((g) => groupName(data, locale, g, or)),
            clear: camp.clear
              ? {
                  lands: camp.clear.lands.map((id) => landName(data, locale, id)),
                  to: landName(data, locale, camp.clear.to),
                  month: textOf(data.months[camp.clear.month % data.months.length], locale),
                }
              : null,
          }
        : null,
  };
}

/** Bilanz am Ende: Art des Ausgangs, Überlebende, Dauer, erreichte Stufe, Merkmale, Eiszeiten. */
export interface EndSummary {
  /** won · extinct: ausgestorben · lastIce: letzte Eiszeit überstanden, aber nicht als Mensch mit Lager */
  kind: 'won' | 'extinct' | 'lastIce';
  survivors: number;
  years: number;
  months: number;
  stage: string;
  /** die Herde stand auf der letzten Stufe (ohne Folgestufe) */
  lastStage: boolean;
  traits: string[];
  iceAges: { survived: number; max: number | null };
}

/**
 * Ausgang aus der View: Die Engine nennt die Ursache (`gameLost.cause`) nur im Ereignis, die View kennt nur
 * `over`. Eine lebende Herde bei verlorener Partie hat die letzte Eiszeit überstanden (`lastIce`), sonst ist sie
 * ausgestorben.
 */
export function endSummary(
  data: HerdeData,
  view: Pick<HerdeView, 'over' | 'herd' | 'month' | 'evolution' | 'iceAges'>,
): EndSummary | null {
  if (!view.over) return null;
  const year = data.months.length;
  return {
    kind: view.over === 'won' ? 'won' : view.herd.size > 0 ? 'lastIce' : 'extinct',
    survivors: view.herd.size,
    years: Math.floor(view.month / year),
    months: view.month % year,
    stage: view.herd.stage,
    lastStage: view.evolution.next === null,
    traits: [...view.evolution.traits],
    iceAges: { ...view.iceAges },
  };
}

/**
 * Anzeige zu Wild, Jagd, Lager, Eiszeiten und Partie-Ende (rein, ohne DOM). Die Regeln rechnet die Engine
 * (`view.prey` mit `inReach`, `view.campSites`, `campPreview`, `evolution.stage.camp` mit `spots`, `view.overCause` …);
 * hier wird nur benannt.
 */
import type { CampPreviewView, CellView, HerdeData, HerdeView, Pos, StageNeedsView } from '@being-god/herde';
import type { HuntRules, Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';
import { landName, stageName, textOf } from './format.ts';

const monthName = (data: HerdeData, locale: Locale, month: number) =>
  textOf(data.months[month % data.months.length], locale, String(month + 1));

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

/**
 * Vorschau eines Lagerplatzes für die Anzeige: die Zahlen rechnet die Engine (`campPreview`), hier werden nur Namen
 * eingesetzt.
 */
export function campPreviewText(data: HerdeData, locale: Locale, p: CampPreviewView): CampPreview {
  const or = locale === 'de' ? ' oder ' : ' or ';
  return {
    pos: { x: p.x, y: p.y },
    radius: p.radius,
    groups: p.near.map((g) => ({
      name: groupName(data, locale, g.lands, or),
      short: groupName(data, locale, g.lands, '/'),
      count: g.count,
    })),
    reach: p.reach,
    food: p.food,
    shelter: p.shelter,
    prey: p.prey,
    moves: p.moves,
    clear: p.clear
      ? {
          lands: p.clear.lands.map((id) => landName(data, locale, id)),
          to: landName(data, locale, p.clear.to),
          month: monthName(data, locale, p.clear.month),
          fields: p.clear.fields,
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
    if (prey.inReach) lines.push(t.infoPreyReach);
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
            notOn: [...data.landscapes.values()]
              .filter((l) => l.walk && !camp.on.includes(l.id))
              .map((l) => landName(data, locale, l.id)),
            clear: camp.clear
              ? {
                  lands: camp.clear.lands.map((id) => landName(data, locale, id)),
                  to: landName(data, locale, camp.clear.to),
                  month: monthName(data, locale, camp.clear.month),
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

/** Ausgang aus der View: gewonnen oder die Ursache der Niederlage (`overCause` der Engine). */
export function endSummary(
  data: HerdeData,
  view: Pick<HerdeView, 'over' | 'overCause' | 'herd' | 'month' | 'evolution' | 'iceAges'>,
): EndSummary | null {
  if (!view.over) return null;
  const year = data.months.length;
  return {
    kind: view.over === 'won' ? 'won' : (view.overCause ?? 'extinct'),
    survivors: view.herd.size,
    years: Math.floor(view.month / year),
    months: view.month % year,
    stage: view.herd.stage,
    lastStage: view.evolution.next === null,
    traits: [...view.evolution.traits],
    iceAges: { ...view.iceAges },
  };
}

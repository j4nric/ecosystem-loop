/**
 * Reine Text- und Rechenhilfen für die Oberfläche (ohne DOM): Pfeile, Absicht, Jahreszeit, Feld-Prognose.
 * Namen kommen aus den Spieldaten, Sätze aus `src/i18n`.
 */
import type { CellView, HandCardView, HerdeData, HerdeView, IntentView, StageNeedsView, Text } from '@being-god/herde';
import type { RuleNumbers, SeasonSet, Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';

const ARROWS: Record<string, string> = {
  '-1,-1': '↖',
  '0,-1': '↑',
  '1,-1': '↗',
  '-1,0': '←',
  '1,0': '→',
  '-1,1': '↙',
  '0,1': '↓',
  '1,1': '↘',
};

/** Richtungspfeil eines Schritts (Norden = oben); leer, wenn die Herde bleibt. */
export function arrowOf(dx: number, dy: number): string {
  return ARROWS[`${Math.sign(dx)},${Math.sign(dy)}`] ?? '';
}

export const textOf = (text: Text | undefined, locale: Locale, fallback = ''): string => text?.[locale] ?? fallback;

export function landName(data: HerdeData, locale: Locale, id: string): string {
  return textOf(data.landscapes.get(id)?.name, locale, id);
}

export function cardName(data: HerdeData, locale: Locale, id: string): string {
  return textOf(data.cards.get(id)?.name, locale, id);
}

export function traitName(data: HerdeData, locale: Locale, id: string): string {
  return textOf(data.traits.get(id)?.name, locale, id);
}

export function stageName(data: HerdeData, locale: Locale, id: string): string {
  return textOf(data.stages.get(id)?.name, locale, id);
}

export function seasonName(data: HerdeData, locale: Locale, id: string): string {
  return textOf(data.seasons.find((s) => s.id === id)?.name, locale, id);
}

/** „Die Herde sucht Wasser ↘“ bzw. „… grast hier weiter (bleibt)“. */
export function intentText(t: Strings, intent: IntentView): string {
  const reason = t.intent[intent.reason] ?? intent.reason;
  return `${t.intentLine(reason)} ${intent.stays ? t.stays : arrowOf(intent.dx, intent.dy)}`;
}

export const sameIntent = (a: IntentView | null, b: IntentView | null): boolean =>
  a?.x === b?.x && a?.y === b?.y && a?.reason === b?.reason;

/** Monate bis zum Beginn der nächsten Jahreszeit (1 … monthsPerSeason). */
export function monthsToNextSeason(data: HerdeData, month: number): number {
  return data.monthsPerSeason - (month % data.monthsPerSeason);
}

/** Jahreszeiten-Ids als Namen; `all`, wenn jede Jahreszeit dabei ist. */
export function seasonSet(data: HerdeData, locale: Locale, ids: readonly string[]): SeasonSet {
  return {
    names: data.seasons.filter((s) => ids.includes(s.id)).map((s) => textOf(s.name, locale, s.id)),
    all: data.seasons.length > 0 && data.seasons.every((s) => ids.includes(s.id)),
  };
}

/** Was eine Stufe für die Texte braucht (aus `view.evolution.stage`). */
export type StageRules = Pick<StageNeedsView, 'move' | 'reach' | 'waterSeasons' | 'shelterSeasons'>;

/**
 * Regelzahlen für Texte aus den Parametern der Daten und der aktuellen Stufe (Umkreis und Schritte aus
 * `evolution.stage`, Wasser- und Schutzzeiten als Namen).
 */
export function ruleNumbers(data: HerdeData, locale: Locale, stage: StageRules): RuleNumbers {
  const p = data.params;
  const season = data.seasons[Math.floor(p.herd.birthMonth / data.monthsPerSeason) % data.seasons.length];
  return {
    birthSeason: season?.id ?? '',
    birthMonth: (p.herd.birthMonth % data.monthsPerSeason) + 1,
    wildMax: p.wild.max,
    iceMonths: p.ice.months,
    handMax: p.cards.handMax,
    neighbors: (2 * stage.reach + 1) ** 2 - 1,
    move: stage.move,
    water: seasonSet(data, locale, stage.waterSeasons),
    shelter: seasonSet(data, locale, stage.shelterSeasons),
    iceAges: p.ice.ages ?? null,
    wildAfter: p.ice.wildAfter,
  };
}

/** Kurzer Hinweis zur Jahreszeit mit den Bedürfnissen der aktuellen Stufe; in der Eiszeit die Restmonate. */
export function seasonHint(t: Strings, data: HerdeData, locale: Locale, view: HerdeView): string {
  if (view.ice.active) return t.iceHint(view.ice.monthsLeft);
  const stage = view.evolution.stage;
  const needs = {
    water: stage.waterSeasons.includes(view.season),
    shelter: stage.shelterSeasons.includes(view.season),
    fire: data.seasons.find((s) => s.id === view.season)?.fire === true,
  };
  return t.seasonHint(view.season, ruleNumbers(data, locale, stage), needs) ?? t.seasonHintFallback;
}

/** Lässt sich die Karte gerade spielen? Globale Karten immer, sonst nur mit mindestens einem gültigen Ziel. */
export const isPlayable = (card: Pick<HandCardView, 'global' | 'targets'>): boolean =>
  card.global || card.targets.length > 0;

/** Summe der Rudelstärken. */
export const wolvesTotal = (view: HerdeView): number => view.packs.reduce((a, p) => a + p.size, 0);

/** Für die Prognose der Verbuschung: erst ab so wenigen Monaten wird die Zahl genannt. */
export const UNGRAZED_WARN_MONTHS = 3;

/**
 * Was geschieht auf dem Feld von selbst, und was bedeutet es für die Herde? Zeilen für die Feld-Info: Sukzession
 * (bei der Beweidungs-Uhr erst ab ≤ 3 Monaten mit Zahl, sonst „bleibt …, solange beweidet“), Feuer, Wasser und
 * Schutz der aktuellen Stufe (mit Jahreszeiten), Wölfe, unpassierbar (allgemein oder für die Stufe), kein Futter für
 * die Stufe, karg.
 */
export function forecastLines(
  t: Strings,
  data: HerdeData,
  locale: Locale,
  cell: CellView,
  stage: StageNeedsView,
): string[] {
  const lines: string[] = [];
  const f = cell.forecast;
  if (f) {
    const to = landName(data, locale, f.to);
    if (f.clock === 'ungrazed')
      lines.push(
        f.inMonths <= UNGRAZED_WARN_MONTHS
          ? t.forecastUngrazedSoon(to, f.inMonths)
          : t.forecastUngrazedHold(landName(data, locale, cell.land)),
      );
    else lines.push(t.forecastAge(to, f.inMonths, f.fertile));
  }
  if (cell.wildfire) lines.push(t.infoWildfire);
  const name = stageName(data, locale, stage.id);
  if (stage.water.includes(cell.land)) lines.push(t.infoWater(seasonSet(data, locale, stage.waterSeasons)));
  if (stage.shelter.includes(cell.land)) lines.push(t.infoShelter(seasonSet(data, locale, stage.shelterSeasons)));
  if (data.landscapes.get(cell.land)?.wood) lines.push(t.infoWolves);
  if (!cell.walkable) lines.push(t.infoBlocked);
  else if (cell.blocked) lines.push(t.infoStageBlocked(name));
  else if (cell.maxFood > 0 && !stage.eats.includes(cell.land)) lines.push(t.infoNoFood(name));
  else if (!f && cell.maxFood > 0 && cell.maxFood <= 1) lines.push(t.infoSparse);
  return lines;
}

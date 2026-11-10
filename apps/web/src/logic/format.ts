/**
 * Reine Text- und Rechenhilfen für die Oberfläche (ohne DOM): Pfeile, Absicht, Jahreszeit, Feld-Prognose.
 * Namen kommen aus den Spieldaten, Sätze aus `src/i18n`.
 */
import type { CellView, HandCardView, HerdeData, HerdeView, IntentView, Text } from '@being-god/herde';
import type { RuleNumbers, Strings } from '../i18n/de.ts';
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

/**
 * Die Herde frisst im Umkreis 1 (Engine: `herd.ts`, `around` ohne Radius). Der Umkreis ist kein Datenparameter;
 * die Zahl der Nachbarfelder folgt aus ihm.
 */
const HERD_REACH = 1;

/** Regelzahlen für Texte aus den Parametern der Daten. */
export function ruleNumbers(data: HerdeData): RuleNumbers {
  const p = data.params;
  const season = data.seasons[Math.floor(p.herd.birthMonth / data.monthsPerSeason) % data.seasons.length];
  return {
    birthSeason: season?.id ?? '',
    birthMonth: (p.herd.birthMonth % data.monthsPerSeason) + 1,
    wildMax: p.wild.max,
    iceMonths: p.ice.months,
    handMax: p.cards.handMax,
    neighbors: (2 * HERD_REACH + 1) ** 2 - 1,
  };
}

/** Kurzer Hinweis zur Jahreszeit; in der Eiszeit die Restmonate. */
export function seasonHint(t: Strings, data: HerdeData, view: HerdeView): string {
  if (view.ice.active) return t.iceHint(view.ice.monthsLeft);
  return t.seasonHint(view.season, ruleNumbers(data)) ?? t.seasonHintFallback;
}

/** Lässt sich die Karte gerade spielen? Globale Karten immer, sonst nur mit mindestens einem gültigen Ziel. */
export const isPlayable = (card: Pick<HandCardView, 'global' | 'targets'>): boolean =>
  card.global || card.targets.length > 0;

/** Summe der Rudelstärken. */
export const wolvesTotal = (view: HerdeView): number => view.packs.reduce((a, p) => a + p.size, 0);

/** Für die Prognose der Verbuschung: erst ab so wenigen Monaten wird die Zahl genannt. */
export const UNGRAZED_WARN_MONTHS = 3;

/**
 * Was geschieht auf dem Feld von selbst? Zeilen für die Feld-Info: Sukzession (bei der Beweidungs-Uhr erst ab
 * ≤ 3 Monaten mit Zahl, sonst „bleibt …, solange beweidet“), Feuer, Wasser, Schutz, unpassierbar, karg.
 */
export function forecastLines(t: Strings, data: HerdeData, locale: Locale, cell: CellView, stage: string): string[] {
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
  const needs = data.stages.get(stage);
  if (needs?.water.includes(cell.land)) lines.push(t.infoWater);
  if (needs?.shelter.includes(cell.land)) lines.push(t.infoShelter);
  if (!cell.walkable) lines.push(t.infoBlocked);
  else if (!f && cell.maxFood > 0 && cell.maxFood <= 1) lines.push(t.infoSparse);
  return lines;
}

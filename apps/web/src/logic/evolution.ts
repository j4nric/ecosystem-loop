/**
 * Anzeige der Entwicklung (rein, ohne DOM): Bedürfnisse einer Stufe mit dem, was die Insel heute bietet, gewählte
 * und angebotene Merkmale, Erfahrungsfortschritt, Reife und die Aktionen dazu. Regeln rechnet die Engine
 * (`view().evolution`); hier wird nur gezählt und benannt.
 */
import type { Action, EvolutionView, HerdeData, HerdeView, StageNeedsView } from '@being-god/herde';
import type { Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';
import { landName, seasonSet, stageName, textOf, traitName } from './format.ts';

/** Wie eine Zeile zu lesen ist: vorhanden, fehlt, Warnung (z. B. Hindernis auf der Insel) oder nur Hinweis. */
export type NeedTone = 'ok' | 'missing' | 'warn' | 'info';

export interface NeedRow {
  kind: 'food' | 'water' | 'shelter' | 'blocked' | 'move' | 'lost';
  label: string;
  /** Landschaften (und Jahreszeiten) bzw. Schrittweite */
  text: string;
  /** Felder auf der Insel (null bei Schrittweite) */
  count: number | null;
  /** „3 Felder auf der Insel“, „fehlt auf der Insel“ … */
  island: string;
  tone: NeedTone;
}

/** Zahl der Felder je Landschaft auf der Insel (aus der View). */
export function landCounts(view: Pick<HerdeView, 'cells'>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of view.cells) counts.set(c.land, (counts.get(c.land) ?? 0) + 1);
  return counts;
}

/** Felder, deren Landschaft in `lands` liegt. */
export const countLands = (counts: ReadonlyMap<string, number>, lands: readonly string[]): number =>
  lands.reduce((sum, land) => sum + (counts.get(land) ?? 0), 0);

const names = (data: HerdeData, locale: Locale, lands: readonly string[]) =>
  lands.map((id) => landName(data, locale, id)).join(', ');

/**
 * Bedürfnisse einer Stufe als Zeilen mit der Zahl passender Felder auf der Insel. Mit `from` (der aktuellen Stufe)
 * kommt eine Zeile dazu, welche bisherigen Futter-Landschaften nicht mehr zählen – für die Vorschau.
 */
export function needRows(
  t: Strings,
  data: HerdeData,
  locale: Locale,
  view: Pick<HerdeView, 'cells'>,
  needs: StageNeedsView,
  from?: StageNeedsView,
): NeedRow[] {
  const counts = landCounts(view);
  const have = (lands: readonly string[]) => countLands(counts, lands);
  const rows: NeedRow[] = [];
  const food = have(needs.eats);
  rows.push({
    kind: 'food',
    label: t.needFood,
    text:
      needs.eats.length === 0
        ? t.needNone
        : needs.eats.map((id) => `${landName(data, locale, id)} (${needs.food[id] ?? 0})`).join(', '),
    count: food,
    island: t.onIsland(food),
    tone: food > 0 ? 'ok' : 'missing',
  });
  const water = have(needs.water);
  rows.push({
    kind: 'water',
    label: t.needWater,
    text: t.needSeason(names(data, locale, needs.water) || t.needNone, seasonSet(data, locale, needs.waterSeasons)),
    count: water,
    island: t.onIsland(water),
    tone: water > 0 || needs.waterSeasons.length === 0 ? 'ok' : 'missing',
  });
  const shelter = have(needs.shelter);
  rows.push({
    kind: 'shelter',
    label: t.needShelter,
    text: t.needSeason(names(data, locale, needs.shelter) || t.needNone, seasonSet(data, locale, needs.shelterSeasons)),
    count: shelter,
    island: t.onIsland(shelter),
    tone: shelter > 0 || needs.shelterSeasons.length === 0 ? 'ok' : 'missing',
  });
  if (needs.blocked.length > 0) {
    const blocked = have(needs.blocked);
    rows.push({
      kind: 'blocked',
      label: t.needBlocked,
      text: names(data, locale, needs.blocked),
      count: blocked,
      island: t.blockedOnIsland(blocked),
      tone: blocked > 0 ? 'warn' : 'info',
    });
  }
  if (from) {
    const lost = from.eats.filter((id) => !needs.eats.includes(id));
    if (lost.length > 0) {
      const n = have(lost);
      rows.push({
        kind: 'lost',
        label: t.needLost,
        text: names(data, locale, lost),
        count: n,
        island: t.onIsland(n),
        tone: n > 0 ? 'warn' : 'info',
      });
    }
  }
  rows.push({
    kind: 'move',
    label: t.needMove,
    text: t.needMoveText(needs.move, needs.reach),
    count: null,
    island: '',
    tone: 'info',
  });
  return rows;
}

/** Was der nächsten Stufe auf der Insel heute ganz fehlt (Futter, Wasser, Schutz ohne ein einziges Feld). */
export function missingOnIsland(rows: readonly NeedRow[]): string[] {
  return rows.filter((r) => r.tone === 'missing').map((r) => r.label);
}

export interface TraitInfo {
  id: string;
  name: string;
  icon: string;
  /** Wirkung (Text aus den Daten) */
  effect: string;
  /** Erfahrung, aus der es entsteht, und Schwelle */
  experience: string;
  at: number;
  /** zählt für die fehlende Reife („darunter eines von …“) */
  forMaturity: boolean;
}

/** Name, Icon und Wirkung eines Merkmals aus `data.traits`. */
export function traitInfo(data: HerdeData, locale: Locale, id: string, evo?: EvolutionView): TraitInfo {
  const def = data.traits.get(id);
  return {
    id,
    name: traitName(data, locale, id),
    icon: def?.icon ?? '✨',
    effect: textOf(def?.text, locale),
    experience: def ? textOf(data.experiences.get(def.from)?.name, locale, def.from) : '',
    at: def?.at ?? 0,
    forMaturity: evo?.missing?.oneOf?.includes(id) ?? false,
  };
}

export interface ExperienceRow {
  id: string;
  name: string;
  value: number;
  /** Schwelle des nächsten Merkmals (null: alle Merkmale dieser Erfahrung erreicht oder gewählt) */
  at: number | null;
  trait: TraitInfo | null;
  /** Fortschritt 0 … 1 bis zur Schwelle */
  share: number;
  /** das Merkmal ist schon verfügbar (wird angeboten bzw. zur nächsten Jahreszeit) */
  available: boolean;
}

/** Erfahrungen mit Fortschritt zum nächsten Merkmal; was zur Reife fehlt, steht zuerst. */
export function experienceRows(data: HerdeData, locale: Locale, evo: EvolutionView): ExperienceRow[] {
  const waiting = [...evo.offer, ...evo.available];
  const rows = evo.experience.map((e) => {
    // Schwelle erreicht, Merkmal aber noch nicht gewählt: es steht zur Wahl (bzw. kommt zur nächsten Jahreszeit).
    const reached = waiting.find((id) => data.traits.get(id)?.from === e.id);
    if (reached) {
      const trait = traitInfo(data, locale, reached, evo);
      return {
        id: e.id,
        name: textOf(data.experiences.get(e.id)?.name, locale, e.id),
        value: e.value,
        at: trait.at,
        trait,
        share: 1,
        available: true,
      };
    }
    const trait = e.next ? traitInfo(data, locale, e.next.trait, evo) : null;
    return {
      id: e.id,
      name: textOf(data.experiences.get(e.id)?.name, locale, e.id),
      value: e.value,
      at: e.next?.at ?? null,
      trait,
      share: e.next ? Math.min(1, e.value / Math.max(1, e.next.at)) : 1,
      available: false,
    };
  });
  const rank = (r: ExperienceRow) => (r.trait?.forMaturity ? 0 : r.trait ? 1 : 2);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map(({ r }) => r);
}

/** Was zur Reife fehlt, als Satz; null auf der letzten Stufe. */
export function missingText(t: Strings, data: HerdeData, locale: Locale, evo: EvolutionView): string | null {
  if (!evo.missing || !evo.next) return null;
  if (evo.mature) return t.evoMature(stageName(data, locale, evo.next.id));
  const oneOf = evo.missing.oneOf?.map((id) => traitName(data, locale, id)) ?? null;
  return t.evoMissing(evo.missing.traits, oneOf);
}

/** Hinweis an der Herde: Angebot liegt vor, Herde ist reif, oder nichts. */
export type EvolutionBadge = { kind: 'offer'; count: number } | { kind: 'mature'; next: string } | null;

export function evolutionBadge(view: Pick<HerdeView, 'evolution' | 'over'>): EvolutionBadge {
  if (view.over) return null;
  const evo = view.evolution;
  if (evo.offer.length > 0) return { kind: 'offer', count: evo.offer.length };
  if (evo.mature && evo.next) return { kind: 'mature', next: evo.next.id };
  return null;
}

/** Die Aktionen der Entwicklung, die gerade möglich sind (Merkmal wählen, springen) – wie `legalActions`. */
export function evolutionActions(view: Pick<HerdeView, 'evolution' | 'over'>): Action[] {
  if (view.over) return [];
  const actions: Action[] = view.evolution.offer.map((trait) => ({ type: 'pickTrait', trait }));
  if (view.evolution.mature) actions.push({ type: 'evolve' });
  return actions;
}

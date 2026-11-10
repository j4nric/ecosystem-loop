/**
 * Anzeige der Entwicklung (rein, ohne DOM): Bedürfnisse einer Stufe mit dem, was die Insel heute bietet, gewählte
 * und angebotene Merkmale, Erfahrungsfortschritt und Reife. Regeln rechnet die Engine (`view().evolution`); hier wird
 * nur gezählt und benannt. Aktionen (`pickTrait`, `evolve`) kommen aus der Engine bzw. der View.
 */
import type { EvolutionView, HerdeData, HerdeView, StageNeedsView } from '@being-god/herde';
import type { Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';
import { landName, seasonSet, stageName, textOf, traitName } from './format.ts';
import { campGroupNames, preyAnimals } from './hunt.ts';

/** Wie eine Zeile zu lesen ist: vorhanden, fehlt, Warnung (z. B. Hindernis auf der Insel) oder nur Hinweis. */
export type NeedTone = 'ok' | 'missing' | 'warn' | 'info';

export interface NeedRow {
  kind: 'food' | 'prey' | 'water' | 'shelter' | 'wolves' | 'blocked' | 'lost' | 'camp' | 'move';
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

/** Was `needRows` aus der View liest; Wild, Rudel und Lager sind optional (ältere Test-Literale). */
export type NeedsSource = Pick<HerdeView, 'cells'> & Partial<Pick<HerdeView, 'prey' | 'packs' | 'camp' | 'campSites'>>;

/**
 * Bedürfnisse einer Stufe als Zeilen mit dem, was die Insel heute bietet: Futter, Beute (Wild), Wasser, Schutz,
 * Wölfe (Feinde oder Konkurrenten), Hindernis, Lager, Wege. Mit `from` (der aktuellen Stufe) ist es die Vorschau der
 * nächsten Stufe: Dazu kommt, welche bisherigen Futter-Landschaften nicht mehr zählen, und beim Lager zählen die
 * möglichen Plätze auf der ganzen Insel (`camp.spots` der Engine, ohne Zugweite).
 */
export function needRows(
  t: Strings,
  data: HerdeData,
  locale: Locale,
  view: NeedsSource,
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
    tone: food > 0 || needs.prey !== null ? 'ok' : 'missing',
  });
  if (needs.prey) {
    const prey = view.prey ?? [];
    rows.push({
      kind: 'prey',
      label: t.needPrey,
      text: t.needPreyText(needs.prey.food, needs.prey.kill, needs.prey.fire),
      count: prey.length,
      island: t.preyOnIsland(prey.length, preyAnimals({ prey })),
      tone: prey.length > 0 ? 'ok' : 'missing',
    });
  }
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
  const packs = view.packs ?? [];
  rows.push({
    kind: 'wolves',
    label: t.needWolves,
    text: needs.wolves === 'rival' ? t.wolvesRival : t.wolvesEnemy,
    count: packs.length,
    island: t.packsOnIsland(packs.length),
    tone: needs.wolves === 'enemy' && packs.length > 0 ? 'warn' : 'info',
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
  if (needs.camp) {
    const text = t.needCampText(campGroupNames(data, locale, needs.camp), needs.camp.radius);
    if (!from && view.camp) {
      rows.push({ kind: 'camp', label: t.needCamp, text, count: 1, island: t.campStanding, tone: 'ok' });
    } else if (!from) {
      const n = view.campSites?.length ?? 0;
      rows.push({
        kind: 'camp',
        label: t.needCamp,
        text,
        count: n,
        island: t.campSitesInReach(n),
        tone: n > 0 ? 'ok' : 'warn',
      });
    } else {
      const n = needs.camp.spots;
      rows.push({
        kind: 'camp',
        label: t.needCamp,
        text,
        count: n,
        island: t.campSpotsOnIsland(n),
        tone: n > 0 ? 'ok' : 'missing',
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

/**
 * Stand eines erreichten Merkmals: `offer` steht jetzt im Angebot, `later` ist erreicht und kommt in einem späteren
 * Angebot (das Angebot rotiert), null noch nicht erreicht.
 */
export type TraitStatus = 'offer' | 'later' | null;

export function traitStatus(evo: Pick<EvolutionView, 'offer' | 'available'>, id: string): TraitStatus {
  if (evo.offer.includes(id)) return 'offer';
  return evo.available.includes(id) ? 'later' : null;
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
  /** das Merkmal ist erreicht: im Angebot (`offer`) oder in einem späteren Angebot (`later`); sonst null */
  status: TraitStatus;
}

/** Erfahrungen mit Fortschritt zum nächsten Merkmal; was zur Reife fehlt, steht zuerst. */
export function experienceRows(data: HerdeData, locale: Locale, evo: EvolutionView): ExperienceRow[] {
  const waiting = [...evo.offer, ...evo.available];
  const rows = evo.experience.map((e) => {
    // Schwelle erreicht, Merkmal aber noch nicht gewählt: im Angebot oder in einem späteren Angebot.
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
        status: traitStatus(evo, reached),
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
      status: null,
    };
  });
  const rank = (r: ExperienceRow) => (r.trait?.forMaturity ? 0 : r.trait ? 1 : 2);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Gewählte Merkmale mit ihrer Rolle für die Reife: `counted` zählt auf dieser Stufe, `earlier` stammt aus einer
 * früheren Stufe (wirkt, zählt aber nicht); auf der letzten Stufe gibt es keine Reife (`none`).
 */
export interface OwnedTrait extends TraitInfo {
  role: 'counted' | 'earlier' | 'none';
}

export function ownedTraits(data: HerdeData, locale: Locale, evo: EvolutionView): OwnedTrait[] {
  return evo.traits.map((id) => ({
    ...traitInfo(data, locale, id, evo),
    role: evo.missing === null ? 'none' : evo.counted.includes(id) ? 'counted' : 'earlier',
  }));
}

/** Wie viele Merkmale auf dieser Stufe schon für die Reife zählen; null auf der letzten Stufe. */
export function countedText(t: Strings, evo: EvolutionView): string | null {
  if (!evo.missing) return null;
  return t.evoCounted(evo.counted.length, evo.missing.required);
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

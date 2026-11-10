/**
 * Weltkarten (Konzept 6.2, Variante C): Wetter und Naturkräfte wirken ohne Zielwahl auf alle Zonen,
 * je Geografie unterschiedlich (`byGeography`). Die bearbeitete Zone ist als "self" gebunden.
 *
 * Ablauf (`resolveWorldCard`), so dass die Reihenfolge der Zonen das Ergebnis nicht entscheidet:
 * 1. Schwellen mit check "before" werden in jeder Zone gegen den Zustand VOR der Karte geprüft.
 * 2. Grundwirkung: Jede Zone wendet ihre Effekte an (`effects`, dann `byGeography[Geografie]`, dann die gewählte
 *    Option). Effekte auf die Zone selbst (scope self) wirken sofort und nur dort. Ausstrahlungen
 *    (scope neighbors/area/all) wirken gleichzeitig: Änderungen von Werten und Beständen werden je Zone
 *    addiert und erst danach einmal angewendet (und begrenzt), Störungen einmal je Zone.
 *    Zonenlose Effekte (Ziehen, Odem, Ereignis) wirken danach genau einmal.
 * 3. Schwellen mit check "after" werden in jeder Zone gegen den Zustand NACH der Grundwirkung geprüft.
 * 4. Folgen der Schwellen: je Schwelle (Datenreihenfolge) in allen Zonen, in denen sie auslöst; Ausstrahlungen
 *    und Odem wieder gleichzeitig.
 *
 * AUSLEGUNG: Zonen werden in Kartenreihenfolge (map.yaml) abgearbeitet; die Datenprüfung erlaubt für
 * Ausstrahlungen nur reihenfolgefeste Effekte (adjust, population, disturb), so dass diese Reihenfolge nur die
 * Reihenfolge der Ereignisse im Log bestimmt, nicht das Ergebnis.
 */
import type { Targets } from '../api.ts';
import { holdsAll } from '../conditions.ts';
import { populationOf, setPopulation } from '../population.ts';
import { breathMax } from '../rules/breath.ts';
import { WORLD_ZONE, type Card, type Effect, type GameData, type Trigger } from '../schema/index.ts';
import type { GameEvent, GameState, ZoneState } from '../state.ts';
import { clamp, getZone, markDisturbance } from '../world.ts';
import { applyEffect, setStat, zonesFor, type EffectContext } from './effects.ts';

/** Fehlt `reach`, gilt "zone". */
export function isWorldCard(card: Pick<Card, 'reach'>): boolean {
  return card.reach === 'world';
}

/** Effekt mit Zonen-Bezug (hat `at`); sonst wirkt er unabhängig von Zonen (Ziehen, Odem, Ereignis). */
export function isZonal(e: Effect): boolean {
  return 'at' in e;
}

/** Effekte der gewählten Option(en) eines choice-Slots. */
function chosenEffects(card: Card, bound: Targets): Effect[] {
  return card.slots.flatMap((s) =>
    s.kind === 'choice' ? (s.options.find((o) => o.id === bound[s.id])?.effects ?? []) : [],
  );
}

/** Zonenbezogene Effekte einer Weltkarte für eine Zone dieser Geografie, in Anwendungsreihenfolge. */
export function worldZoneEffects(card: Card, geography: string, bound: Targets = {}): Effect[] {
  return [...card.effects, ...(card.byGeography[geography] ?? []), ...chosenEffects(card, bound)].filter(isZonal);
}

/** Zonenlose Effekte einer Weltkarte (wirken einmal je Ausspielen). */
export function worldGlobalEffects(card: Card, bound: Targets = {}): Effect[] {
  return [...card.effects, ...chosenEffects(card, bound)].filter((e) => !isZonal(e));
}

/** Schwellen, die in einer Zone zum Zeitpunkt `check` auslösen (Weltkarte, Zone als "self"). */
export function worldTriggersAt(
  data: GameData,
  state: GameState,
  card: Card,
  zone: ZoneState,
  check: Trigger['check'],
): Trigger[] {
  return card.triggers.filter((t) => t.check === check && holdsAll(t.when, { data, state, zone }));
}

/**
 * Gleichzeitige Wirkung: sammelt Ausstrahlungen und Odem, wendet sie mit `flush` gesammelt an.
 * Effekte auf die eigene Zone wirken sofort.
 */
class Simultaneous {
  private readonly stats = new Map<string, Map<string, number>>();
  private readonly pops = new Map<string, Map<string, number>>();
  private readonly disturbed = new Set<string>();
  private breath = 0;

  constructor(
    private readonly data: GameData,
    private readonly state: GameState,
    private readonly emit: (e: GameEvent) => void,
    private readonly cause: string,
  ) {}

  private add(map: Map<string, Map<string, number>>, zone: string, key: string, by: number): void {
    const m = map.get(zone) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + by);
    map.set(zone, m);
  }

  apply(ctx: EffectContext, e: Effect): void {
    const scope = 'scope' in e ? e.scope : 'self';
    if ('breath' in e) this.breath += e.breath;
    else if (scope === 'self') applyEffect(ctx, e);
    else if ('adjust' in e) {
      for (const z of zonesFor(ctx, e.at, scope)) if (e.adjust in z.stats) this.add(this.stats, z.id, e.adjust, e.by);
    } else if ('population' in e) {
      const species = ctx.bind[e.population] ?? e.population;
      for (const z of zonesFor(ctx, e.at, scope)) this.add(this.pops, z.id, species, e.by);
    } else if ('disturb' in e) {
      for (const z of zonesFor(ctx, e.at, scope)) this.disturbed.add(z.id);
    }
    // Andere Effekte mit Ausstrahlung sind nicht reihenfolgefest; die Datenprüfung lässt sie nicht zu.
    else applyEffect(ctx, e);
  }

  /** Wendet das Gesammelte in Kartenreihenfolge der Zonen an. */
  flush(): void {
    const { data, state, emit, cause } = this;
    for (const z of state.zones) {
      for (const [stat, by] of this.stats.get(z.id) ?? [])
        if (by !== 0) setStat(data, z, stat, z.stats[stat]! + by, emit, cause);
      for (const [species, by] of this.pops.get(z.id) ?? [])
        if (by !== 0) setPopulation(data, state, z, species, populationOf(z, species) + by, emit, cause);
      if (this.disturbed.has(z.id)) markDisturbance(state, z, cause, emit);
    }
    if (this.breath !== 0) {
      const from = state.breath;
      const to = clamp(from + this.breath, 0, breathMax(data));
      if (to !== from) {
        state.breath = to;
        emit({ type: 'breathChanged', from, to, cause });
      }
    }
  }
}

/**
 * Wendet eine Weltkarte an (ohne Kosten, Hand und Ablage). `bound` enthält nur die Wahl eines choice-Slots.
 * `zones` begrenzt die Wirkung (Ereignis mit Zielzone); Standard: alle Zonen.
 */
export function resolveWorldCard(
  data: GameData,
  state: GameState,
  card: Card,
  bound: Targets,
  emit: (e: GameEvent) => void,
  cause = `card:${card.id}`,
  zones: readonly string[] = state.zones.map((z) => z.id),
): void {
  const ctxFor = (zid: string, c: string): EffectContext => ({
    data,
    state,
    emit,
    bind: { ...bound, [WORLD_ZONE]: zid },
    cause: c,
  });
  const fired = new Map<string, Set<string>>(card.triggers.map((t) => [t.id, new Set<string>()]));
  const check = (when: Trigger['check']) => {
    for (const zid of zones)
      for (const t of worldTriggersAt(data, state, card, getZone(state, zid), when)) fired.get(t.id)!.add(zid);
  };

  check('before');
  const base = new Simultaneous(data, state, emit, cause);
  for (const zid of zones)
    for (const e of worldZoneEffects(card, getZone(state, zid).geography, bound)) base.apply(ctxFor(zid, cause), e);
  base.flush();
  for (const e of worldGlobalEffects(card, bound)) applyEffect({ data, state, emit, bind: { ...bound }, cause }, e);
  check('after');

  for (const t of card.triggers) {
    const tcause = `trigger:${card.id}.${t.id}`;
    const batch = new Simultaneous(data, state, emit, tcause);
    // Zonen in Kartenreihenfolge, unabhängig davon, ob die Schwelle vor oder nach der Grundwirkung auslöste.
    for (const zid of zones) {
      if (!fired.get(t.id)!.has(zid)) continue;
      const zone = getZone(state, zid);
      emit({ type: 'triggered', card: card.id, trigger: t.id, zone: zid, disturbance: t.disturbance });
      if (t.disturbance) markDisturbance(state, zone, tcause, emit);
      for (const e of t.effects) batch.apply(ctxFor(zid, tcause), e);
    }
    batch.flush();
  }
}

/**
 * Schwellen einer Weltkarte je Zone, die beim Ausspielen jetzt auslösen würden (für Warnungen):
 * "before" gegen den Zustand, "after" gegen eine Kopie nach der Grundwirkung (ohne Wahl-Optionen).
 */
export function worldWarnings(data: GameData, state: GameState, card: Card): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>(state.zones.map((z) => [z.id, new Set<string>()]));
  for (const z of state.zones)
    for (const t of worldTriggersAt(data, state, card, z, 'before')) out.get(z.id)!.add(t.id);
  if (card.triggers.some((t) => t.check === 'after')) {
    const sim = structuredClone(state);
    const base = new Simultaneous(data, sim, () => {}, 'warning');
    for (const z of sim.zones)
      for (const e of worldZoneEffects(card, z.geography))
        base.apply({ data, state: sim, emit: () => {}, bind: { [WORLD_ZONE]: z.id }, cause: 'warning' }, e);
    base.flush();
    for (const z of sim.zones) for (const t of worldTriggersAt(data, sim, card, z, 'after')) out.get(z.id)!.add(t.id);
  }
  return out;
}

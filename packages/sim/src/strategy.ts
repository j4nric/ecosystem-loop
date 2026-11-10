/**
 * Strategie-Bots (Phase 6): bewerten jeden legalen Zug, indem sie die Karte über `step` ausspielen (wie die
 * Vorschau, nur mit vollem Zustand) und den Zustand danach mit einer Stellungsbewertung vergleichen.
 *
 * Die Bewertung schaut eine Natur-Phase voraus, aber nur mit dem, was ein Spieler sieht und aus den Regeln
 * kennt: Jahreszeit, angekündigtes Ereignis (samt ausgeloster Zone), Kopplungen und Selbstheilung. Leben,
 * Evolution und künftiger Zufall werden NICHT simuliert (kein Klonen des RNG-Zustands, kein runNature).
 *
 * Die Strategien unterscheiden sich nur in ihren Gewichten (`Profile`):
 * - gardener:  hält Zonen nahe der Idealform, spart Odem, wehrt angekündigte Ereignisse ab.
 * - evolver:   hält Bestände und Zonenstufen, setzt Störungen gezielt für den Selektionsdruck.
 * - disruptor: spielt Naturgewalten aggressiv, Störungen sind ihm willkommen.
 */
import {
  formFor,
  holdsAll,
  isWorldCard,
  legalPlays,
  step,
  type Action,
  type Condition,
  type Effect,
  type GameData,
  type GameState,
  type Play,
  type ZoneState,
  worldZoneEffects,
} from '@being-god/core';

export interface Profile {
  /** Beitrag je Zone nach Art der vorausgesagten Form. */
  form: { ideal: number; normal: number; degraded: number; disturbance: number };
  /** Abzug je Schritt Abstand zur Idealform. */
  distance: number;
  /** Wert einer Störung in dieser Runde (Harmonie-Einbruch; negativ = schlecht). */
  disturbance: number;
  /** Wert je Zonenstufe, die durch Abstieg verloren ginge. */
  level: number;
  /** Wert eines vollen Fortschritts zur nächsten Zonenstufe. */
  progress: number;
  /** Abzug je Tier außerhalb seines Lebensraums. */
  habitat: number;
  /** Abzug je Art, die in einer Zone hungern würde. */
  hunger: number;
  /** Wert je Art und Zone, die wachsen kann (satt, im Lebensraum, unter dem Höchstbestand). */
  growth: number;
  /** Wert je Evolutions-Bedingung, die (weiter) erfüllt ist, multipliziert mit der Stufe der neuen Art. */
  evolution: number;
  /** Wert, wenn eine Zone mit möglichem Evolutionsschritt ab Stufe 4 Selektionsdruck hat. */
  pressure: number;
  /** Wert je lebender Art, zusätzlich je Stufe. */
  species: number;
  speciesTier: number;
  /** Wert je Odem bis zur Reserve (darüber ein Fünftel), sofern er nicht an der Obergrenze verfällt. */
  breath: number;
  reserve: number;
  /** Gewicht der zweiten vorausgesagten Runde (Formen nach dem nächsten Jahreszeitwechsel). */
  lookahead: number;
  /** Wert einer vorab gespielten Stille (nächstes ausgelostes Ereignis entfällt). */
  shield: number;
  /** Zusatzwert je gespielter Naturgewalt (Störer). */
  force: number;
  /** Wert, eine Karte loszuwerden: Jede gespielte Karte macht Platz für eine neue beim Nachziehen. */
  cycle: number;
  /** Ein Zug wird nur gespielt, wenn er mindestens so viel bringt (außer bei Kartenzwang). */
  threshold: number;
}

const BASE: Profile = {
  form: { ideal: 2, normal: 0, degraded: -3, disturbance: -2 },
  distance: 0.25,
  disturbance: -2,
  level: 1,
  progress: 0.3,
  habitat: 0.15,
  hunger: 1.2,
  growth: 0.2,
  evolution: 0.1,
  pressure: 0,
  species: 1,
  speciesTier: 0.2,
  breath: 0.35,
  reserve: 3,
  lookahead: 0.6,
  shield: 1,
  force: 0,
  cycle: 0.4,
  threshold: 0.05,
};

export const PROFILES = {
  gardener: { ...BASE, distance: 0.35, breath: 0.6, reserve: 5, shield: 1.5, threshold: 0.2 },
  evolver: {
    ...BASE,
    form: { ideal: 2.5, normal: 0, degraded: -3, disturbance: -2 },
    level: 2.5,
    progress: 0.8,
    growth: 0.4,
    evolution: 0.5,
    pressure: 3,
    speciesTier: 0.5,
    breath: 0.3,
    reserve: 3,
  },
  disruptor: {
    ...BASE,
    distance: 0.1,
    disturbance: 0.5,
    level: 0.3,
    progress: 0.1,
    breath: 0.5,
    reserve: 1,
    force: 0.6,
    threshold: -0.5,
  },
} satisfies Record<string, Profile>;

export type StrategyName = keyof typeof PROFILES;

interface LevelParams {
  idealFrom: number;
  min: number;
}
interface EvolutionParams {
  minAncestor: number;
  levelGap: number;
  pressure: { fromTier: number; when: Condition[] };
}
interface LifeParams {
  max: number;
  food: { perStat: number; perPrey: number; huntNeighbors: boolean };
}
interface BreathParams {
  base: number;
  harmonyStep: number;
  speciesBonus: number;
  speciesBonusFrom: number;
  max: number;
}
interface HealingParams {
  interval: number;
  step: number;
}

/** Regelparameter aus den Daten (geprüft von der Engine, hier nur gelesen). */
export function paramsOf<T>(data: GameData, id: string): T {
  return data.params[id] as T;
}

const seasonAt = (data: GameData, round: number) => data.seasons[(data.startSeason + round - 1) % data.seasons.length]!;

export const yearAt = (data: GameData, round: number) =>
  Math.floor((data.startSeason + Math.max(round, 1) - 1) / data.seasons.length) + 1;

const kindOf = (data: GameData, form: string) => data.forms.get(form)?.form.kind ?? 'normal';

/** Odem-Zufluss nach der Formel aus Konzept 6.1 (ohne die Harmonie-Änderung dieser Runde). */
export function expectedIncome(data: GameData, state: GameState): number {
  const p = paramsOf<BreathParams>(data, 'breath');
  const alive = new Set<string>();
  for (const z of state.zones) for (const [s, n] of Object.entries(z.populations)) if (n > 0) alive.add(s);
  return p.base + Math.floor(state.harmony / p.harmonyStep) + (alive.size >= p.speciesBonusFrom ? p.speciesBonus : 0);
}

// ---------------------------------------------------------------------------------------------------------------
// Vorausschau der Natur-Phase (nur sichtbare, regelhafte Teile: Jahreszeit, Ereignis, Kopplungen, Heilung, Formen)
// ---------------------------------------------------------------------------------------------------------------

function setStat(data: GameData, zone: ZoneState, stat: string, v: number): void {
  if (!(stat in zone.stats)) return;
  zone.stats[stat] = Math.min(data.config.scale.max, Math.max(data.config.scale.min, v));
}

function zonesAt(state: GameState, bind: Record<string, string>, at: string, scope: string): ZoneState[] {
  const base = state.zones.find((z) => z.id === bind[at]);
  if (scope === 'all') return state.zones;
  if (!base) return [];
  const neighbors = state.zones.filter((z) => base.neighbors.includes(z.id));
  if (scope === 'neighbors') return neighbors;
  if (scope === 'area') return [base, ...neighbors];
  return [base];
}

/** Wendet die wert- und störungsbezogenen Teile eines Effekts an (Bestände nur für Ereignisse wie die Seuche). */
function applyLite(data: GameData, state: GameState, e: Effect, bind: Record<string, string>, strength = 1): void {
  const scope = 'scope' in e ? e.scope : 'self';
  const at = 'at' in e ? e.at : 'self';
  if ('adjust' in e) {
    const by =
      strength === 1 || e.by === 0 ? e.by : Math.sign(e.by) * Math.max(1, Math.round(Math.abs(e.by) * strength));
    for (const z of zonesAt(state, bind, at, scope)) setStat(data, z, e.adjust, (z.stats[e.adjust] ?? 0) + by);
  } else if ('set' in e) {
    for (const z of zonesAt(state, bind, at, scope)) setStat(data, z, e.set, e.value);
  } else if ('transfer' in e) {
    const src = state.zones.find((z) => z.id === bind[e.from]);
    if (!src) return;
    for (const z of zonesAt(state, bind, at, 'self')) {
      const moved = Math.min(e.amount, src.stats[e.transfer] ?? 0);
      if (!(e.into in z.stats) || moved <= 0) continue;
      setStat(data, src, e.transfer, (src.stats[e.transfer] ?? 0) - moved);
      setStat(data, z, e.into, (z.stats[e.into] ?? 0) + moved);
    }
  } else if ('restore' in e) {
    for (const z of zonesAt(state, bind, at, scope)) {
      const rest = data.geographies.get(z.geography)!.rest;
      for (const s of e.restore === 'all' ? Object.keys(z.stats) : [e.restore]) {
        const v = z.stats[s];
        const r = rest[s];
        if (v === undefined || r === undefined) continue;
        const d = r - v;
        setStat(data, z, s, v + (e.steps === undefined ? d : Math.sign(d) * Math.min(Math.abs(d), e.steps)));
      }
    }
  } else if ('disturb' in e) {
    for (const z of zonesAt(state, bind, at, scope)) z.lastDisturbance = state.round;
  } else if ('setLevel' in e) {
    for (const z of zonesAt(state, bind, at, scope)) z.level = Math.max(1, e.setLevel);
  } else if ('population' in e) {
    const sp = bind[e.population] ?? e.population;
    for (const z of zonesAt(state, bind, at, scope)) {
      const n = (z.populations[sp] ?? 0) + Math.sign(e.by) * Math.max(1, Math.round(Math.abs(e.by) * strength));
      if (n <= 0) delete z.populations[sp];
      else z.populations[sp] = Math.min(9, n);
    }
  }
}

/** Das angekündigte Ereignis, so wie es der Spieler aus Ankündigung und Regeln ableiten kann. */
function projectEvent(data: GameData, state: GameState): void {
  const f = state.forecast;
  if (!f) return;
  const def = data.events.get(f.event);
  if (!def) return;
  const strength = f.strength;
  const bind: Record<string, string> = {};
  if (f.zone) bind.target = f.zone;
  if (def.target?.pick === 'densest') {
    let best: { zone: string; species: string; n: number } | null = null;
    for (const z of state.zones)
      for (const [sp, n] of Object.entries(z.populations))
        if (n > 0 && (!best || n > best.n)) best = { zone: z.id, species: sp, n };
    if (!best) return;
    bind.target = best.zone;
    bind.species = best.species;
  }
  for (const rule of def.rules) {
    const zones = state.zones.filter(
      (z) =>
        (rule.geographies.length === 0 || rule.geographies.includes(z.geography)) &&
        holdsAll(rule.when, { data, state, zone: z }),
    );
    for (const z of zones) for (const e of rule.effects) applyLite(data, state, e, { ...bind, self: z.id }, strength);
  }
  for (const e of def.effects) applyLite(data, state, e, bind, strength);
  if (def.card && bind.target) {
    const card = data.cards.get(def.card)!;
    const zone = state.zones.find((z) => z.id === bind.target)!;
    // Weltkarte als Ereigniskarte: wirkt nur auf die Zielzone, je nach deren Geografie (Zone als "self").
    const world = isWorldCard(card);
    const cb = world ? { self: bind.target } : { [card.slots[0]!.id]: bind.target };
    const effects = world ? worldZoneEffects(card, zone.geography) : card.effects;
    const firing = card.triggers.filter((t) => t.check === 'before' && holdsAll(t.when, { data, state, zone }));
    for (const e of effects) applyLite(data, state, e, cb);
    for (const t of firing) {
      for (const e of t.effects) applyLite(data, state, e, cb);
      if (t.disturbance) zone.lastDisturbance = state.round;
    }
  }
}

/**
 * Zustand nach der sichtbaren Natur-Phase dieser Runde (ohne Leben und Zufall). Liefert eine Kopie;
 * `formSince` markiert Formwechsel (Zonenstufe), `lastDisturbance` Störungen dieser Runde.
 */
export function projectNature(data: GameData, state: GameState): GameState {
  const sim: GameState = { ...state, zones: structuredClone(state.zones) };
  const season = seasonAt(data, state.round);
  for (const rule of season.rules) {
    const zones = sim.zones.filter(
      (z) =>
        (rule.geographies.length === 0 || rule.geographies.includes(z.geography)) &&
        holdsAll(rule.when, { data, state: sim, zone: z }),
    );
    for (const z of zones) for (const e of rule.effects) applyLite(data, sim, e, { self: z.id });
  }
  projectEvent(data, sim);
  for (const c of data.couplings) {
    if (c.seasons.length > 0 && !c.seasons.includes(season.id)) continue;
    const pairs: [string, string][] = [];
    for (const src of sim.zones) {
      if (src.geography !== c.from.geography || !holdsAll(c.from.when, { data, state: sim, zone: src })) continue;
      for (const n of src.neighbors) {
        const t = sim.zones.find((z) => z.id === n)!;
        if (c.to.geography !== undefined && t.geography !== c.to.geography) continue;
        if (holdsAll(c.to.when, { data, state: sim, zone: t })) pairs.push([src.id, t.id]);
      }
    }
    for (const [from, to] of pairs) for (const e of c.effects) applyLite(data, sim, e, { self: to, source: from });
  }
  const heal = paramsOf<HealingParams>(data, 'healing');
  if (state.round % heal.interval === 0)
    for (const z of sim.zones)
      applyLite(data, sim, { restore: 'all', steps: heal.step, at: 'self', scope: 'self' }, { self: z.id });
  for (const z of sim.zones) {
    const form = formFor(data, sim, z);
    if (form.id !== z.form) {
      z.form = form.id;
      z.formSince = state.round;
    }
    if (form.kind === 'disturbance') z.lastDisturbance = state.round;
  }
  return sim;
}

// ---------------------------------------------------------------------------------------------------------------
// Stellungsbewertung
// ---------------------------------------------------------------------------------------------------------------

/** Abstand der Werte zur Idealform der Geografie (Summe der fehlenden Schritte über alle stat-Bedingungen). */
export function idealDistance(data: GameData, zone: ZoneState): number {
  const ideal = data.geographies.get(zone.geography)!.forms.find((f) => f.kind === 'ideal');
  if (!ideal) return 0;
  let d = 0;
  for (const c of ideal.when) {
    if (!('stat' in c)) continue;
    const v = zone.stats[c.stat] ?? 0;
    if (c.eq !== undefined) d += Math.abs(v - c.eq);
    if (c.gte !== undefined && v < c.gte) d += c.gte - v;
    if (c.lte !== undefined && v > c.lte) d += v - c.lte;
  }
  return d;
}

/** Wer würde in dieser Runde hungern? Nachbau der Fressregel (Zone für Zone, niedrige Stufen zuerst). */
export function hungryOf(data: GameData, state: GameState): Map<string, string[]> {
  const p = paramsOf<LifeParams>(data, 'life');
  const left = new Map<string, number>();
  const hungry = new Map<string, string[]>();
  for (const zone of state.zones)
    for (const sp of data.species.values()) {
      let need = zone.populations[sp.id] ?? 0;
      if (need === 0) continue;
      for (const food of sp.diet) {
        const isPrey = data.species.has(food);
        const zones = isPrey && p.food.huntNeighbors ? [zone.id, ...zone.neighbors] : [zone.id];
        for (const zid of zones) {
          if (need === 0) break;
          const z = state.zones.find((x) => x.id === zid)!;
          const key = `${zid}|${food}`;
          if (!left.has(key))
            left.set(key, isPrey ? (z.populations[food] ?? 0) * p.food.perPrey : (z.stats[food] ?? 0) * p.food.perStat);
          const take = Math.min(need, left.get(key)!);
          left.set(key, left.get(key)! - take);
          need -= take;
        }
      }
      if (need > 0) hungry.set(zone.id, [...(hungry.get(zone.id) ?? []), sp.id]);
    }
  return hungry;
}

/** Stellungswert eines Zustands vor der Natur-Phase (höher = besser für das Profil). */
export function evaluate(data: GameData, state: GameState, w: Profile): number {
  const sim = projectNature(data, state);
  const lv = paramsOf<LevelParams>(data, 'levels');
  const evo = paramsOf<EvolutionParams>(data, 'evolution');
  const life = paramsOf<LifeParams>(data, 'life');
  const winter = seasonAt(data, state.round).pausesGrowth;
  const hungry = hungryOf(data, sim);
  // Zweite Runde voraus (nächste Jahreszeit, ohne Ereignis): Formen sollen auch nach dem Jahreszeitwechsel halten.
  const sim2 = projectNature(data, { ...sim, round: sim.round + 1, forecast: null });
  let v = 0;
  for (const z of sim2.zones) {
    v += w.lookahead * (w.form[kindOf(data, z.form)] - w.distance * idealDistance(data, z));
  }
  sim.zones.forEach((z, i) => {
    const before = state.zones[i]!;
    const kind = kindOf(data, z.form);
    v += w.form[kind];
    v -= w.distance * idealDistance(data, z);
    const disturbed = z.lastDisturbance === state.round;
    if (disturbed) v += w.disturbance;
    // Zonenstufe: Abstieg bei Störung, Verödung oder Formwechsel kostet die Stufe und den Fortschritt.
    const falls = disturbed || kind === 'degraded' || z.form !== before.form;
    if (falls) v -= w.level * (before.level > lv.min ? 1 : 0) + w.progress * (before.levelProgress / 3);
    else
      v +=
        w.progress * ((before.levelProgress + 1) / 3) * (before.level + 1 >= lv.idealFrom && kind !== 'ideal' ? 0 : 1);
    v += 0.2 * w.level * z.level;
    const hz = hungry.get(z.id) ?? [];
    if (hz.length > 0) v -= w.hunger * (1 + 0.5 * hz.length);
    for (const [sid, n] of Object.entries(z.populations)) {
      if (n <= 0) continue;
      const sp = data.species.get(sid)!;
      if (!sp.habitat.includes(z.form)) v -= w.habitat * n * (kind === 'degraded' ? 2 : 1);
      else if (!hz.includes(sid) && !winter && n < life.max) v += w.growth;
    }
  });
  // Arten: Leben ist Wertung und Harmonie; knappe Bestände sind gefährdet.
  const totals = new Map<string, number>();
  for (const z of state.zones)
    for (const [s, n] of Object.entries(z.populations)) totals.set(s, (totals.get(s) ?? 0) + n);
  for (const [sid, n] of totals) {
    if (n <= 0) continue;
    const tier = data.species.get(sid)!.tier;
    v += (w.species + w.speciesTier * tier) * Math.min(1, n / 3);
  }
  // Evolution: Bedingungen, die in dieser Runde (weiter) gelten, und Selektionsdruck für höhere Arten.
  for (const z of sim.zones)
    for (const sp of data.species.values()) {
      if (sp.ancestor === null || (z.populations[sp.ancestor] ?? 0) < evo.minAncestor - 1) continue;
      const ctx = { data, state: sim, zone: z };
      if (!holdsAll(sp.evolve, ctx)) continue;
      const fits = (t: ZoneState) =>
        sp.habitat.includes(t.form) && (t.populations[sp.id] ?? 0) < life.max && t.level >= sp.tier - evo.levelGap;
      const settle = fits(z) || z.neighbors.some((n) => fits(sim.zones.find((x) => x.id === n)!));
      const fresh0 = !(sp.id in state.species) ? 2 : 1;
      if (!settle) {
        // Vorbereitung: Lebensraum für die neue Art in der Zone oder nebenan, Zonenstufe fehlt noch.
        const habitat = (t: ZoneState) => sp.habitat.includes(t.form);
        if (habitat(z) || z.neighbors.some((n) => habitat(sim.zones.find((x) => x.id === n)!)))
          v += 0.3 * w.evolution * sp.tier * fresh0;
        continue;
      }
      const ready = (z.populations[sp.ancestor] ?? 0) >= evo.minAncestor;
      const fresh = fresh0;
      if (sp.tier >= evo.pressure.fromTier) {
        const now = holdsAll(evo.pressure.when, ctx);
        const next = holdsAll(evo.pressure.when, { ...ctx, state: { ...sim, round: sim.round + 1 } });
        v += w.pressure * fresh * ((now ? 0.5 : 0) + (next ? 0.5 : 0));
        if (!now) continue;
      }
      if (ready)
        v += w.evolution * sp.tier * fresh * (1 + (state.zones.find((x) => x.id === z.id)!.evolution[sp.id] ?? 0));
    }
  // Odem: eine Reserve ist viel wert, darüber wenig; was an der Obergrenze verfällt, nichts.
  const bp = paramsOf<BreathParams>(data, 'breath');
  const usable = Math.min(state.breath, Math.max(0, bp.max - expectedIncome(data, state)));
  v += w.breath * (Math.min(usable, w.reserve) + 0.2 * Math.max(0, usable - w.reserve));
  v += w.shield * Math.min(1, state.eventShield);
  return v;
}

/** Wert eines Zugs: Stellung danach minus Stellung davor (+ Platz auf der Hand, Vorliebe für Naturgewalten). */
export function playValue(data: GameData, state: GameState, p: Play, w: Profile, base?: number): number {
  const after = step(data, state, { type: 'play', uid: p.uid, targets: p.targets }).state;
  const card = data.cards.get(p.card)!;
  return (
    evaluate(data, after, w) - (base ?? evaluate(data, state, w)) + (card.category === 'force' ? w.force : 0) + w.cycle
  );
}

/** Bester Zug nach Profil; endTurn, wenn sich nichts lohnt und kein Kartenzwang herrscht. */
export function chooseByProfile(data: GameData, state: GameState, w: Profile): Action {
  const plays = legalPlays(data, state);
  if (plays.length === 0) return { type: 'endTurn' };
  const base = evaluate(data, state, w);
  let best: Play | null = null;
  let bestValue = -Infinity;
  for (const p of plays) {
    const v = playValue(data, state, p, w, base);
    if (v > bestValue) [best, bestValue] = [p, v];
  }
  const mustPlay = state.playsThisTurn < data.config.turn.minPlays;
  if (best && (mustPlay || bestValue > w.threshold)) return { type: 'play', uid: best.uid, targets: best.targets };
  return { type: 'endTurn' };
}

/** Stufen des Evolutions-Trichters: Wie weit kommt eine Art in diesem Zustand auf dem Weg zur Entstehung? */
export const FUNNEL = ['ancestor', 'special', 'habitat', 'level', 'pressure'] as const;

/**
 * Für jede Art mit Vorfahr: höchste erfüllte Stufe des Trichters (0 = kein Vorfahr mit genug Bestand, 5 = alle
 * Bedingungen in einer Zone erfüllt). Nachbau der Evolutionsregel für die Auswertung.
 */
export function evolutionFunnel(data: GameData, state: GameState): Record<string, number> {
  const evo = paramsOf<EvolutionParams>(data, 'evolution');
  const life = paramsOf<LifeParams>(data, 'life');
  const out: Record<string, number> = {};
  for (const sp of data.species.values()) {
    if (sp.ancestor === null) continue;
    let best = 0;
    for (const z of state.zones) {
      if ((z.populations[sp.ancestor] ?? 0) < evo.minAncestor) continue;
      let stage = 1;
      const ctx = { data, state, zone: z };
      if (holdsAll(sp.evolve, ctx)) {
        stage = 2;
        const area = [z, ...z.neighbors.map((n) => state.zones.find((x) => x.id === n)!)];
        const habitat = area.filter((t) => sp.habitat.includes(t.form) && (t.populations[sp.id] ?? 0) < life.max);
        if (habitat.length > 0) {
          stage = 3;
          if (habitat.some((t) => t.level >= sp.tier - evo.levelGap)) {
            stage = 4;
            if (sp.tier < evo.pressure.fromTier || holdsAll(evo.pressure.when, ctx)) stage = 5;
          }
        }
      }
      best = Math.max(best, stage);
    }
    out[sp.id] = best;
  }
  return out;
}

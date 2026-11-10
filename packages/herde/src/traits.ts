/**
 * Entwicklung der Herde (Konzept 9.1, 9.2): Erfahrungen zählen, Merkmale anbieten und wählen, Reife und Sprung
 * zur nächsten Stufe. Ohne Zufall.
 */
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeEvent, HerdeState } from './state.ts';
import { baseStageOf, cellAt, cheb, maxFood, near, needsNow, RuleError, stageOf } from './world.ts';

/** Merkmale, deren Erfahrung die Schwelle erreicht hat und die die Herde noch nicht hat (Reihenfolge der Daten). */
export function availableTraits(data: HerdeData, s: HerdeState): string[] {
  const out: string[] = [];
  for (const t of data.traits.values())
    if (!s.herd.traits.includes(t.id) && (s.herd.experience[t.from] ?? 0) >= t.at) out.push(t.id);
  return out;
}

export interface Maturity {
  /** Folgestufe oder null (letzte Stufe) */
  next: string | null;
  /** reif: `evolve` ist erlaubt */
  mature: boolean;
  /** so viele Merkmale fehlen noch (insgesamt) */
  missingTraits: number;
  /** eines dieser Merkmale fehlt noch; null, wenn erfüllt oder nicht verlangt */
  missingOneOf: string[] | null;
}

/** Reife für die nächste Stufe: genug Merkmale insgesamt und (falls verlangt) eines aus `mature.oneOf`. */
export function maturityOf(data: HerdeData, s: HerdeState): Maturity {
  const stage = baseStageOf(data, s);
  if (stage.next === undefined || !stage.mature)
    return { next: null, mature: false, missingTraits: 0, missingOneOf: null };
  // AUSLEGUNG: Es zählen alle Merkmale der Herde, auch die aus früheren Stufen (Merkmale bleiben über den Sprung).
  const owned = s.herd.traits;
  const missingTraits = Math.max(0, stage.mature.traits - owned.length);
  const oneOf = stage.mature.oneOf;
  const missingOneOf = oneOf && !oneOf.some((id) => owned.includes(id)) ? [...oneOf] : null;
  return { next: stage.next, mature: missingTraits === 0 && missingOneOf === null, missingTraits, missingOneOf };
}

function emitMatured(data: HerdeData, s: HerdeState, wasMature: boolean, emit: Emit): void {
  const m = maturityOf(data, s);
  if (m.mature && !wasMature) emit({ type: 'matured', stage: s.herd.stage, next: m.next! });
}

/**
 * Zu Beginn einer Jahreszeit: Angebot aus bis zu `offerSize` verfügbaren Merkmalen. Ein nicht angenommenes Angebot
 * wird erneuert; das Ereignis kommt nur, wenn sich das Angebot ändert.
 */
export function refreshOffer(data: HerdeData, s: HerdeState, emit: Emit): void {
  // AUSLEGUNG: Angebot zu Beginn jeder Jahreszeit (Konzept: „z. B. einmal pro Jahreszeit“), ohne Zufall die ersten
  // verfügbaren Merkmale in Daten-Reihenfolge – so bleibt der Zufallsstrom der Partie unberührt.
  const offer = availableTraits(data, s).slice(0, data.offerSize);
  const same = offer.length === s.herd.offer.length && offer.every((id, i) => s.herd.offer[i] === id);
  s.herd.offer = offer;
  if (!same && offer.length > 0) emit({ type: 'traitOffered', traits: [...offer] });
}

/** Ein angebotenes Merkmal wählen; das Angebot ist damit verbraucht (höchstens ein Merkmal je Jahreszeit). */
export function pickTrait(data: HerdeData, s: HerdeState, trait: string, emit: Emit): void {
  if (!s.herd.offer.includes(trait)) throw new RuleError(`Merkmal ${trait} wird nicht angeboten.`);
  const wasMature = maturityOf(data, s).mature;
  s.herd.traits.push(trait);
  s.herd.offer = [];
  emit({ type: 'traitPicked', trait });
  emitMatured(data, s, wasMature, emit);
}

/** Sprung zur nächsten Stufe – nur wenn reif, ohne Rückweg. */
export function evolve(data: HerdeData, s: HerdeState, emit: Emit): void {
  const m = maturityOf(data, s);
  if (!m.mature || m.next === null) throw new RuleError('Die Herde ist noch nicht reif für die nächste Stufe.');
  const from = s.herd.stage;
  s.herd.stage = m.next;
  // AUSLEGUNG: Werte, die an der Stufe hängen, sofort an die neue Stufe anpassen (Spurlänge, Vorratsdeckel,
  // Futter-Maximum aus forage) – sonst wäre der Zustand bis zum nächsten Monat ungültig bzw. widersprüchlich.
  const stage = stageOf(data, s);
  while (s.herd.trail.length > stage.trail) s.herd.trail.shift();
  s.herd.fat = Math.min(s.herd.fat, s.herd.size * stage.fatCap);
  for (const c of s.cells) c.food = Math.min(c.food, maxFood(data, s, c));
  emit({ type: 'herdEvolved', from, to: m.next });
  emitMatured(data, s, false, emit);
}

/**
 * Erfahrungen des Monats fortschreiben (nach Fressen, Durst, Kälte und Wölfen, nur wenn die Herde lebt).
 * `events` sind die Ereignisse dieses Monats bis hierher.
 */
export function gainExperience(data: HerdeData, s: HerdeState, events: readonly HerdeEvent[]): void {
  const h = s.herd;
  if (h.size <= 0) return;
  const stage = stageOf(data, s);
  const moved = events.find((e) => e.type === 'herdMoved');
  const from = moved?.from ?? { x: h.x, y: h.y };
  const here = cellAt(data, s, h.x, h.y).land;
  const ate = events.some((e) => e.type === 'herdAte' && e.eaten > 0);
  for (const exp of data.experiences.values()) {
    const w = exp.when;
    let gain = 0;
    switch (w.type) {
      case 'sheltered':
        gain = needsNow(data, s, 'shelter') && near(data, s, h.x, h.y, stage.shelter, stage.reach) ? 1 : 0;
        break;
      case 'watered':
        gain = needsNow(data, s, 'water') && near(data, s, h.x, h.y, stage.water, stage.reach) ? 1 : 0;
        break;
      case 'hunted':
        gain = events.some((e) => e.type === 'wolvesHunted') ? 1 : 0;
        break;
      case 'fire':
        // Waldbrände laufen vor dem Zug der Herde: maßgeblich ist das Feld, auf dem sie da stand.
        gain = events.some((e) => e.type === 'fire' && e.cells.some((c) => cheb(c, from) <= 1)) ? 1 : 0;
        break;
      case 'ate':
        gain = ate && w.lands.includes(here) ? 1 : 0;
        break;
      case 'on':
        gain = w.lands.includes(here) ? 1 : 0;
        break;
      case 'moved':
        gain = cheb(from, h);
        break;
    }
    if (gain > 0) h.experience[exp.id] = (h.experience[exp.id] ?? 0) + gain;
  }
}

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
  /** Merkmale, die für die Reife zählen (Reihenfolge der Wahl); bei `scope: stage` nur die dieser Stufe */
  counted: string[];
  /** so viele zählende Merkmale braucht die Reife (0 auf der letzten Stufe) */
  required: number;
  /** so viele zählende Merkmale fehlen noch */
  missingTraits: number;
  /** eines dieser Merkmale fehlt noch (nur noch wählbare); null, wenn erfüllt oder nicht verlangt */
  missingOneOf: string[] | null;
}

/** Merkmale, die auf der aktuellen Stufe für die Reife zählen (`mature.scope`, Standard `stage`). */
export function countedTraits(data: HerdeData, s: HerdeState): string[] {
  const scope = baseStageOf(data, s).mature?.scope ?? 'stage';
  return scope === 'all' ? [...s.herd.traits] : s.herd.traits.slice(s.herd.traitsAtStage);
}

/**
 * Reife für die nächste Stufe: genug zählende Merkmale und (falls verlangt) eines aus `mature.oneOf`. Bei
 * `scope: stage` zählen nur Merkmale, die auf dieser Stufe gewählt wurden; die Wirkung früherer Merkmale bleibt.
 */
export function maturityOf(data: HerdeData, s: HerdeState): Maturity {
  const stage = baseStageOf(data, s);
  const counted = countedTraits(data, s);
  if (stage.next === undefined || !stage.mature)
    return { next: null, mature: false, counted, required: 0, missingTraits: 0, missingOneOf: null };
  const owned = s.herd.traits;
  // AUSLEGUNG: Eine Bedingung, die nicht mehr erfüllbar ist, weil alle passenden Merkmale schon auf früheren Stufen
  // gewählt wurden, gilt als erfüllt – sonst säße die Herde auf dieser Stufe fest. Die Zahl wird auf das gekappt,
  // was noch wählbar ist; aus `oneOf` zählt dann auch ein früher gewähltes Merkmal.
  const open = data.traits.size - owned.length;
  const required = Math.min(stage.mature.traits, counted.length + open);
  const missingTraits = Math.max(0, required - counted.length);
  const oneOf = stage.mature.oneOf;
  let missingOneOf: string[] | null = null;
  if (oneOf && !oneOf.some((id) => counted.includes(id))) {
    const pickable = oneOf.filter((id) => !owned.includes(id));
    missingOneOf = pickable.length > 0 ? pickable : null;
  }
  return {
    next: stage.next,
    mature: missingTraits === 0 && missingOneOf === null,
    counted,
    required,
    missingTraits,
    missingOneOf,
  };
}

function emitMatured(data: HerdeData, s: HerdeState, wasMature: boolean, emit: Emit): void {
  const m = maturityOf(data, s);
  if (m.mature && !wasMature) emit({ type: 'matured', stage: s.herd.stage, next: m.next! });
}

/**
 * Das Angebot, das die Engine jetzt machen würde: bis zu `offerSize` verfügbare Merkmale, zuerst die aus
 * `mature.oneOf` der aktuellen Stufe (Reife-Merkmale), dann die übrigen (je in Daten-Reihenfolge). Gibt es mehr
 * verfügbare Merkmale als Plätze, rotiert mindestens ein Platz mit `herd.offerTurn` weiter (ohne Zufall): Die
 * vorderen Reife-Merkmale bleiben stehen (höchstens `offerSize − 1`), die übrigen Plätze wandern durch den Rest.
 */
export function offerOf(data: HerdeData, s: HerdeState): string[] {
  const size = data.offerSize;
  const oneOf = baseStageOf(data, s).mature?.oneOf ?? [];
  const available = availableTraits(data, s);
  const first = available.filter((id) => oneOf.includes(id));
  const ordered = [...first, ...available.filter((id) => !oneOf.includes(id))];
  if (ordered.length <= size) return ordered;
  const fixed = Math.min(first.length, size - 1);
  const pool = ordered.slice(fixed);
  const slots = size - fixed;
  const start = (s.herd.offerTurn * slots) % pool.length;
  const out = ordered.slice(0, fixed);
  for (let i = 0; i < slots; i++) out.push(pool[(start + i) % pool.length]!);
  return out;
}

/**
 * Zu Beginn einer Jahreszeit: neues Angebot (`offerOf`). Ist ein Angebot liegen geblieben, rotiert es weiter, damit
 * andere verfügbare Merkmale drankommen; das Ereignis kommt nur, wenn sich das Angebot ändert.
 */
export function refreshOffer(data: HerdeData, s: HerdeState, emit: Emit): void {
  // AUSLEGUNG: Angebot zu Beginn jeder Jahreszeit (Konzept: „z. B. einmal pro Jahreszeit“), ohne Zufall – so bleibt
  // der Zufallsstrom der Partie unberührt.
  if (s.herd.offer.length > 0) s.herd.offerTurn++;
  const offer = offerOf(data, s);
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
  s.herd.offerTurn = 0;
  emit({ type: 'traitPicked', trait });
  emitMatured(data, s, wasMature, emit);
}

/**
 * Sprung zur nächsten Stufe – nur wenn reif, ohne Rückweg. Alle Merkmale behalten ihre Wirkung (`stageOf` wendet
 * sie weiter an); für die Reife der neuen Stufe zählen bei `scope: stage` nur Merkmale, die ab jetzt gewählt werden.
 */
export function evolve(data: HerdeData, s: HerdeState, emit: Emit): void {
  const m = maturityOf(data, s);
  if (!m.mature || m.next === null) throw new RuleError('Die Herde ist noch nicht reif für die nächste Stufe.');
  const from = s.herd.stage;
  s.herd.stage = m.next;
  s.herd.traitsAtStage = s.herd.traits.length;
  s.herd.offerTurn = 0;
  // AUSLEGUNG: Ein stehendes Angebot wird sofort nach den Reife-Merkmalen der neuen Stufe geordnet (dieselbe
  // Jahreszeit, also weiterhin höchstens eine Wahl); ein schon genutztes Angebot bleibt leer.
  const offer = s.herd.offer.length > 0 ? offerOf(data, s) : [];
  const changed = offer.some((id, i) => s.herd.offer[i] !== id);
  s.herd.offer = offer;
  // AUSLEGUNG: Werte, die an der Stufe hängen, sofort an die neue Stufe anpassen (Spurlänge, Vorratsdeckel,
  // Futter-Maximum aus forage) – sonst wäre der Zustand bis zum nächsten Monat ungültig bzw. widersprüchlich.
  const stage = stageOf(data, s);
  while (s.herd.trail.length > stage.trail) s.herd.trail.shift();
  s.herd.fat = Math.min(s.herd.fat, s.herd.size * stage.fatCap);
  for (const c of s.cells) c.food = Math.min(c.food, maxFood(data, s, c));
  emit({ type: 'herdEvolved', from, to: m.next });
  if (changed) emit({ type: 'traitOffered', traits: [...offer] });
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
        // AUSLEGUNG: Nur ein Waldbrand zählt, kein Feuer durch die Blitz-Karte – sonst ließe sich das Merkmal mit der
        // eigenen Karte „farmen“. (Kartenzüge liegen ohnehin nicht in den Ereignissen des Monats.)
        gain = events.some(
          (e) => e.type === 'fire' && e.cause === 'wildfire' && e.cells.some((c) => cheb(c, from) <= 1),
        )
          ? 1
          : 0;
        break;
      case 'ate':
        // AUSLEGUNG: großzügig – es genügt, dass die Herde in diesem Monat überhaupt gefressen hat und auf einer der
        // Landschaften steht; woher das Futter im Umkreis kam, wird nicht geprüft.
        gain = ate && w.lands.includes(here) ? 1 : 0;
        break;
      case 'on':
        gain = w.lands.includes(here) ? 1 : 0;
        break;
      case 'moved':
        // AUSLEGUNG: Luftlinie (Felder nach Chebyshev zwischen Start und Ziel des Monats), nicht der gegangene Weg.
        gain = cheb(from, h);
        break;
    }
    if (gain > 0) h.experience[exp.id] = (h.experience[exp.id] ?? 0) + gain;
  }
}

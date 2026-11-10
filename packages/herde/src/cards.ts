/** Karten (Konzept 7): Ziehen, gültige Ziele, Ausspielen. */
import { startFire } from './nature.ts';
import { nextFloat } from './rng.ts';
import type { Card, HerdeData } from './schema.ts';
import type { Emit, HerdeState, Pos } from './state.ts';
import { cellAt, inside, islandOf, maxFood, RuleError, samePos, stageOf, transform } from './world.ts';

export function getCard(data: HerdeData, id: string): Card {
  const card = data.cards.get(id);
  if (!card) throw new RuleError(`Unbekannte Karte: ${id}`);
  return card;
}

/** Eine Karte nach Ziehgewicht (Reihenfolge wie in cards.yaml). */
export function drawCard(data: HerdeData, s: HerdeState): string {
  const cards = [...data.cards.values()];
  const total = cards.reduce((a, c) => a + c.weight, 0);
  let r = nextFloat(s) * total;
  for (const c of cards) {
    r -= c.weight;
    if (r < 0) return c.id;
  }
  return cards[0]!.id;
}

/** Zu Beginn einer Jahreszeit drawPerSeason Karten ziehen, solange die Hand nicht voll ist. Kein Ablegen. */
export function drawSeason(data: HerdeData, s: HerdeState, emit: Emit): void {
  const { drawPerSeason, handMax } = data.params.cards;
  const drawn: string[] = [];
  for (let i = 0; i < drawPerSeason; i++)
    if (s.hand.length < handMax) {
      const id = drawCard(data, s);
      s.hand.push(id);
      drawn.push(id);
    }
  if (drawn.length > 0) emit({ type: 'cardsDrawn', cards: drawn });
}

/**
 * Darf die Karte auf dieses Feld? Die Landschaft muss in `on` stehen; eine Karte, die das Feld unbetretbar macht
 * (z. B. Fels), nie auf die Herde.
 */
export function canTarget(data: HerdeData, s: HerdeState, card: Card, pos: Pos): boolean {
  if (card.global || !inside(islandOf(data, s), pos.x, pos.y)) return false;
  if (!card.on.includes(cellAt(data, s, pos.x, pos.y).land)) return false;
  // AUSLEGUNG: Der Prototyp sperrt nur „Fels auf die Herde“; hier folgt das allgemein aus den Daten:
  // Wird das Ziel unbetretbar, darf die Herde nicht darauf stehen.
  if (card.effect.type === 'transform' && !data.landscapes.get(card.effect.to)!.walk && samePos(pos, s.herd))
    return false;
  // Das Lagerfeld darf keine Landschaft werden, auf der kein Lager stehen kann (z. B. Quelle → Fluss).
  const camp = stageOf(data, s).camp;
  if (card.effect.type === 'transform' && s.camp && camp && samePos(pos, s.camp) && !camp.on.includes(card.effect.to))
    return false;
  return true;
}

/** Alle gültigen Zielfelder einer Karte (Zeile für Zeile); leer für globale Karten. */
export function targetsOf(data: HerdeData, s: HerdeState, card: Card): Pos[] {
  if (card.global) return [];
  const island = islandOf(data, s);
  const out: Pos[] = [];
  for (let y = 0; y < island.height; y++)
    for (let x = 0; x < island.width; x++) if (canTarget(data, s, card, { x, y })) out.push({ x, y });
  return out;
}

/** Karte aus der Hand ausspielen: Wirkung, Wildnis steigt um die Kosten der Karte. */
export function playCard(data: HerdeData, s: HerdeState, hand: number, pos: Partial<Pos>, emit: Emit): void {
  const id = s.hand[hand];
  if (id === undefined) throw new RuleError(`Keine Karte an Handposition ${hand}.`);
  const card = getCard(data, id);
  let target: Pos | undefined;
  if (!card.global) {
    if (pos.x === undefined || pos.y === undefined) throw new RuleError(`${card.id} braucht ein Zielfeld.`);
    target = { x: pos.x, y: pos.y };
    if (!canTarget(data, s, card, target)) throw new RuleError(`${card.id} darf nicht auf (${target.x},${target.y}).`);
  }
  s.hand.splice(hand, 1);
  s.wild += card.wild;
  emit({ type: 'cardPlayed', card: card.id, hand, ...(target ?? {}), wild: card.wild });

  const effect = card.effect;
  switch (effect.type) {
    case 'transform':
      transform(data, s, target!, effect.to, { food: effect.food, cause: 'card' }, emit);
      break;
    case 'ignite':
      startFire(data, s, target!, 'lightning', emit);
      break;
    case 'grow': {
      let cells = 0;
      const apply = (i: number) => {
        const c = s.cells[i]!;
        if (!card.on.includes(c.land)) return;
        c.food = Math.min(maxFood(data, s, c), c.food + effect.amount);
        cells++;
      };
      if (target) apply(target.y * islandOf(data, s).width + target.x);
      else s.cells.forEach((_, i) => apply(i));
      emit({ type: 'grassGrew', card: card.id, amount: effect.amount, cells });
      break;
    }
  }
}

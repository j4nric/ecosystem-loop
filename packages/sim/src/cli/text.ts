/**
 * Deutsche Texte für Konsole: Kartentexte und Steckbriefe werden aus den Daten erzeugt,
 * Ereignisse aus dem Log in Sätze übersetzt.
 */
import {
  getZone,
  type Card,
  type Condition,
  type Effect,
  type GameData,
  type Slot,
  type Stat,
  type ExpeditionState,
  type GameEvent,
} from '@being-god/core';

export const STAT_LABEL: Record<Stat, string> = {
  light: 'Licht',
  moisture: 'Feuchte',
  density: 'Dichte',
  deadwood: 'Totholz',
};

const TAG_LABEL: Record<string, string> = {
  nest: 'Baumhöhle',
  flowers: 'Blütenwiese',
  fireproof: 'Horst (brennt nie)',
  fruit: 'Früchte',
  carrion: 'Kadaver',
};

const END_LABEL = { voluntary: 'freiwillig beendet', deckEmpty: 'Nachziehstapel leer', maxTurns: 'Zuglimit erreicht' };

export const tag = (t: string) => TAG_LABEL[t] ?? t;
export const cardName = (d: GameData, id: string) => d.cards.get(id)?.name.de ?? id;
export const animalName = (d: GameData, id: string) => d.animals.get(id)?.name.de ?? id;
export const typeName = (d: GameData, id: string) => d.zoneTypes.get(id)?.name.de ?? id;
export const endLabel = (r: keyof typeof END_LABEL) => END_LABEL[r];

export function zoneLabel(d: GameData, s: ExpeditionState, id: string): string {
  return `${id.toUpperCase()} ${typeName(d, getZone(s, id).type)}`;
}

export function describeCondition(d: GameData, c: Condition): string {
  if ('stat' in c) {
    const parts: string[] = [];
    if (c.eq !== undefined) parts.push(`= ${c.eq}`);
    if (c.gte !== undefined) parts.push(`≥ ${c.gte}`);
    if (c.lte !== undefined) parts.push(`≤ ${c.lte}`);
    return `${STAT_LABEL[c.stat]} ${parts.join(' und ')}`;
  }
  if ('animal' in c) return `${animalName(d, c.animal)} vorhanden`;
  if ('noAnimal' in c) return `kein(e) ${animalName(d, c.noAnimal)}`;
  if ('tag' in c) return `${tag(c.tag)} vorhanden`;
  if ('noTag' in c) return `kein(e) ${tag(c.noTag)}`;
  if ('zoneType' in c) return `Zone ist ${typeName(d, c.zoneType)}`;
  if ('anyNeighbor' in c) return `Nachbarzone mit ${c.anyNeighbor.map((x) => describeCondition(d, x)).join(', ')}`;
  if ('cardPlayed' in c) return `${cardName(d, c.cardPlayed)} ${c.gte}× gespielt`;
  if ('calmTurns' in c) return `${c.calmTurns} Züge keine Störung`;
  if ('hasAnimals' in c) return c.hasAnimals ? 'Zone hat Tiere' : 'Zone ohne Tiere';
  if ('not' in c) return `nicht (${c.not.map((x) => describeCondition(d, x)).join(', ')})`;
  return `eins von (${c.any.map((x) => describeCondition(d, x)).join(' | ')})`;
}

function slotLabel(card: Card, id: string): string {
  const s = card.slots.find((x) => x.id === id);
  if (!s || s === card.slots[0]) return '';
  return s.kind === 'neighbor' ? ' (Nachbarzone)' : ` (${id})`;
}

export function describeEffect(d: GameData, card: Card, e: Effect): string {
  const where = (at: string, scope: 'self' | 'neighbors') =>
    scope === 'neighbors' ? ' auf allen Nachbarzonen' : slotLabel(card, at);
  if ('adjust' in e) return `${STAT_LABEL[e.adjust]} ${e.by >= 0 ? '+' : ''}${e.by}${where(e.at, e.scope)}`;
  if ('set' in e) return `${STAT_LABEL[e.set]} auf ${e.value}${where(e.at, e.scope)}`;
  if ('addTag' in e) return `wird ${tag(e.addTag)}${where(e.at, e.scope)}`;
  if ('removeTag' in e) return `verliert ${tag(e.removeTag)}${where(e.at, e.scope)}`;
  if ('draw' in e) return `ziehe ${e.draw} Karte(n)`;
  if ('discard' in e) return 'wirf eine Handkarte ab';
  if ('moveAnimal' in e) return 'ein Tier zieht in eine Nachbarzone um';
  if ('connect' in e) return 'verbindet zwei Zonen dauerhaft';
  return `wie ${cardName(d, e.include)}`;
}

export function describeCard(d: GameData, card: Card): string {
  const parts = card.effects.map((e) => describeEffect(d, card, e));
  for (const t of card.triggers) {
    const when = t.when.map((c) => describeCondition(d, c)).join(', ');
    const fx = t.effects.map((e) => describeEffect(d, card, e)).join(', ');
    parts.push(`wenn ${when}: ${t.icon ?? ''}${t.name.de} – ${fx}`);
  }
  return parts.join('; ');
}

export function slotPrompt(slot: Slot): string {
  switch (slot.kind) {
    case 'zone':
      return 'Zone';
    case 'neighbor':
      return 'Nachbarzone';
    case 'otherZone':
      return 'Zielzone (kein Nachbar)';
    case 'animal':
      return 'Tier';
    case 'handCard':
      return 'Handkarte';
  }
}

export function describeEvent(d: GameData, s: ExpeditionState, e: GameEvent): string | null {
  const z = (id: string) => zoneLabel(d, s, id);
  switch (e.type) {
    case 'turnStarted':
      return null;
    case 'cardDrawn':
      return null;
    case 'cardPlayed':
      return `▶ ${cardName(d, e.card)} → ${Object.values(e.choices).map((v) => (d.animals.has(v) ? animalName(d, v) : z(v))).join(', ')}`;
    case 'triggered': {
      const t = d.cards.get(e.card)?.triggers.find((x) => x.id === e.trigger);
      return `  ${t?.icon ?? '!'} ${t?.name.de ?? e.trigger} in ${z(e.zone)}${e.disturbance ? ' (Störung)' : ''}`;
    }
    case 'valueChanged':
      return `  ${z(e.zone)}: ${STAT_LABEL[e.stat]} ${e.from} → ${e.to}`;
    case 'tagAdded':
      return `  ${z(e.zone)}: ${tag(e.tag)}`;
    case 'tagRemoved':
      return `  ${z(e.zone)}: ${tag(e.tag)} verschwindet`;
    case 'zonesConnected':
      return `  Pfad zwischen ${z(e.a)} und ${z(e.b)}`;
    case 'animalMoved':
      return `  ${animalName(d, e.animal)} zieht von ${z(e.from)} nach ${z(e.to)}`;
    case 'cardDiscarded':
      return `  ${cardName(d, e.card)} abgeworfen`;
    case 'zoneTypeChanged':
      return `◆ ${e.zone.toUpperCase()}: ${typeName(d, e.from)} wird zu ${typeName(d, e.to)}`;
    case 'animalEaten':
      return `✖ ${animalName(d, e.prey)} in ${z(e.zone)} wurde von ${e.predators.map((p) => animalName(d, p)).join(', ')} gefressen`;
    case 'animalLeft':
      return `← ${animalName(d, e.animal)} verlässt ${z(e.zone)}`;
    case 'animalArrived':
      return `→ ${animalName(d, e.animal)} zieht in ${z(e.zone)} ein${e.cardAdded ? ` (+ Karte ${cardName(d, e.cardAdded)})` : ''}`;
    case 'expeditionEnded':
      return `■ Expedition beendet: ${endLabel(e.reason)}`;
  }
}

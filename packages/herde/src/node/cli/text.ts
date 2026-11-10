/** Deutsche Konsolentexte zu Gründen und Ereignissen (nur Konsole; die App hat eigene Texte). */
import type { HerdeData, HerdeEvent, ReasonId } from '../../index.ts';

export const REASON: Record<ReasonId, string> = {
  avoidWolves: 'weicht den Wölfen aus',
  seekWater: 'sucht Wasser',
  seekShelter: 'sucht Schutz vor der Kälte',
  freshGrass: 'zieht zu frischem Gras',
  stay: 'grast hier weiter',
};

export const ARROW: Record<string, string> = {
  '-1,-1': '↖',
  '0,-1': '↑',
  '1,-1': '↗',
  '-1,0': '←',
  '0,0': '·',
  '1,0': '→',
  '-1,1': '↙',
  '0,1': '↓',
  '1,1': '↘',
};

export function describe(data: HerdeData, e: HerdeEvent): string | null {
  const land = (id: string) => data.landscapes.get(id)?.name.de ?? id;
  const card = (id: string) => data.cards.get(id)?.name.de ?? id;
  const trait = (id: string) => data.traits.get(id)?.name.de ?? id;
  const stage = (id: string) => data.stages.get(id)?.name.de ?? id;
  switch (e.type) {
    case 'cardPlayed':
      return `${card(e.card)} gelegt${e.x !== undefined ? ` auf (${e.x},${e.y})` : ''} · Wildnis +${e.wild}`;
    case 'cardsDrawn':
      return `Neue Karten: ${e.cards.map(card).join(', ')}`;
    case 'cellChanged':
      return e.cause === 'fire' ? null : `(${e.x},${e.y}) ${land(e.from)} → ${land(e.to)}`;
    case 'grassGrew':
      return `${card(e.card)}: Gras +${e.amount} auf ${e.cells} Feldern`;
    case 'fire':
      return `${e.cause === 'lightning' ? 'Blitz' : 'Waldbrand'}: ${e.cells.length} Feld(er) brennen nieder`;
    case 'herdMoved':
      return e.from.x === e.to.x && e.from.y === e.to.y ? null : `Die Herde zieht nach (${e.to.x},${e.to.y})`;
    case 'herdAte':
      return null;
    case 'herdStarved':
      return `Hunger: −${e.dead}`;
    case 'herdThirsted':
      return `Durst: −${e.dead}`;
    case 'herdFroze':
      return `Kälte ohne Schutz: −${e.dead}`;
    case 'herdBurned':
      return `Das Feuer erfasst die Herde: −${e.dead}`;
    case 'herdBorn':
      return `Nachwuchs: +${e.born}`;
    case 'wolvesHunted':
      return `Wölfe reißen ${e.killed}`;
    case 'packMoved':
      return null;
    case 'packGrew':
      return `Ein Rudel wächst auf Stärke ${e.size}`;
    case 'packFounded':
      return 'Ein neues Wolfsrudel gründet sich';
    case 'packStarved':
      return e.size > 0 ? `Ein Rudel hungert (Stärke ${e.size})` : null;
    case 'packGone':
      return {
        starved: 'Ein Wolfsrudel ist verhungert',
        fire: 'Ein Rudel stirbt im Feuer',
        driven: 'Ein Rudel ist vertrieben',
      }[e.cause];
    case 'packImmigrated':
      return 'Wölfe wandern in die Wälder ein';
    case 'seasonBegan':
      return `— ${data.seasons.find((s) => s.id === e.season)?.name.de ?? e.season}, Jahr ${e.year} —`;
    case 'iceAgeBegan':
      return `Die Eiszeit beginnt: ${e.months} Monate Winter`;
    case 'iceAgeEnded':
      return 'Die Eiszeit ist vorbei';
    case 'gameWon':
      return `Geschafft: ${e.survivors} Tiere haben überlebt`;
    case 'gameLost':
      return 'Die Herde ist ausgestorben';
    case 'traitOffered':
      return `Merkmale im Angebot: ${e.traits.map(trait).join(', ')}`;
    case 'traitPicked':
      return `Neues Merkmal: ${trait(e.trait)}`;
    case 'matured':
      return `Die Herde ist reif für die nächste Stufe: ${stage(e.next)}`;
    case 'herdEvolved':
      return `Die Herde wird zu: ${stage(e.to)}`;
  }
}

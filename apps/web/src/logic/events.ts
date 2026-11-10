/**
 * Übersetzt die Ereignisse eines Engine-Schritts in Meldungen (Toasts und Protokoll) und Effekte für die Szene.
 * Rein und ohne DOM: Die Engine liefert nur Ids und Zahlen, Namen kommen aus den Daten, Sätze aus `src/i18n`.
 */
import type { HerdeData, HerdeEvent, Pos } from '@being-god/herde';
import type { Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';
import { arrowOf, cardName, landName, seasonName, stageName, textOf, traitName } from './format.ts';

/** „🧥 Dichtes Fell“ */
const traitLabel = (data: HerdeData, locale: Locale, id: string) =>
  `${data.traits.get(id)?.icon ?? ''} ${traitName(data, locale, id)}`.trim();

export type Tone = 'good' | 'bad' | 'info';

/** Eine Meldung: `toast` = auch kurz einblenden, sonst nur im Protokoll. */
export interface Notice {
  text: string;
  tone: Tone;
  toast: boolean;
  /** gehört schon zum nächsten Monat (Beginn einer Jahreszeit, gezogene Karten) */
  next?: boolean;
}

/** Kurze Effekte auf der Insel (der Zug der Herde selbst wird aus dem Zustand animiert). */
export type Fx =
  | { type: 'fire'; cells: Pos[] }
  | { type: 'change'; x: number; y: number; to: string }
  | { type: 'hunt'; x: number; y: number; packs: Pos[] }
  | { type: 'born'; x: number; y: number }
  | { type: 'loss'; x: number; y: number }
  /** `cells`: Felder mit mehr Futter (für das ruhige Einfärben bei reduzierter Bewegung) */
  | { type: 'rain'; cells: Pos[] }
  /** Sprung zur nächsten Stufe, an der Herde */
  | { type: 'evolve'; x: number; y: number; stage: string }
  /** die Herde jagt Wild auf diesem Feld; `fire`: Feuer hat es aufgetrieben */
  | { type: 'preyHunted'; x: number; y: number; fire: boolean; from: Pos }
  /** ein Rudel reißt Wild auf diesem Feld */
  | { type: 'packAtePrey'; x: number; y: number }
  /** Wild wandert ein */
  | { type: 'preyArrived'; x: number; y: number }
  /** Rodung am Lager: ein Baum fällt */
  | { type: 'cleared'; x: number; y: number }
  /** Lager gegründet */
  | { type: 'camp'; x: number; y: number };

export interface Described {
  notices: Notice[];
  fx: Fx[];
}

/**
 * @param herdAt Position der Herde nach dem Schritt (für Effekte an der Herde)
 * @param packsAt Positionen der Rudel vor dem Schritt (Id → Feld), um reißende Rudel zu zeigen
 * @param grown Felder, deren Futter im Schritt gewachsen ist (für den Regen-Effekt)
 * @param preyAt Positionen der Wildbestände vor dem Schritt (Id → Feld), für Jagd-Effekte
 */
export function describeEvents(
  data: HerdeData,
  locale: Locale,
  t: Strings,
  events: readonly HerdeEvent[],
  herdAt: Pos,
  packsAt: ReadonlyMap<number, Pos> = new Map(),
  grown: readonly Pos[] = [],
  preyAt: ReadonlyMap<number, Pos> = new Map(),
): Described {
  const notices: Notice[] = [];
  const fx: Fx[] = [];
  const say = (text: string, tone: Tone, toast = true, next = false) =>
    notices.push(next ? { text, tone, toast, next } : { text, tone, toast });
  const land = (id: string) => landName(data, locale, id);
  // Sukzession je Monat zusammenfassen: „Wiese wird zu Busch (2 Felder)“.
  const succession = new Map<string, { from: string; to: string; n: number }>();
  const hunters: Pos[] = [];
  let killed = 0;

  for (const e of events) {
    switch (e.type) {
      case 'cardPlayed': {
        const card = data.cards.get(e.card);
        // Blitz und Regen melden ihre Wirkung selbst (fire, grassGrew).
        if (card?.effect.type === 'transform')
          say(t.evCardPlayed(`${card.icon} ${cardName(data, locale, e.card)}`.trim()), 'info');
        break;
      }
      case 'cardsDrawn':
        say(t.evCardsDrawn(e.cards.map((id) => cardName(data, locale, id)).join(', ')), 'info', true, true);
        break;
      case 'cellChanged':
        // Rodung hat einen eigenen Effekt (fieldCleared)
        if (e.cause !== 'clearing') fx.push({ type: 'change', x: e.x, y: e.y, to: e.to });
        if (e.cause === 'succession') {
          const key = `${e.from}>${e.to}`;
          const entry = succession.get(key) ?? { from: e.from, to: e.to, n: 0 };
          entry.n++;
          succession.set(key, entry);
        }
        break;
      case 'grassGrew':
        say(t.evRain(e.cells), 'good');
        fx.push({ type: 'rain', cells: [...grown] });
        break;
      case 'fire':
        say(e.cause === 'lightning' ? t.evLightning(e.cells.length) : t.evWildfire(e.cells.length), 'bad');
        fx.push({ type: 'fire', cells: e.cells });
        break;
      case 'herdMoved': {
        const dx = e.to.x - e.from.x;
        const dy = e.to.y - e.from.y;
        const moved = dx !== 0 || dy !== 0;
        say(t.evHerdMoved(t.intent[e.reason] ?? e.reason, moved ? arrowOf(dx, dy) : t.stays), 'info', false);
        break;
      }
      case 'herdAte':
        if (e.eaten < e.need) say(t.evHerdHungry(e.eaten, e.need), 'info', false);
        break;
      case 'herdStarved':
        say(t.evStarved(e.dead), 'bad');
        fx.push({ type: 'loss', ...herdAt });
        break;
      case 'herdThirsted':
        say(t.evThirsted(e.dead), 'bad');
        fx.push({ type: 'loss', ...herdAt });
        break;
      case 'herdFroze':
        say(t.evFroze(e.dead), 'bad');
        fx.push({ type: 'loss', ...herdAt });
        break;
      case 'herdBurned':
        say(t.evBurned(e.dead), 'bad');
        break;
      case 'herdBorn':
        say(t.evBorn(e.born), 'good');
        fx.push({ type: 'born', ...herdAt });
        break;
      case 'wolvesHunted': {
        killed += e.killed;
        const at = packsAt.get(e.pack);
        if (at) hunters.push(at);
        break;
      }
      case 'packMoved':
        say(t.evPackMoved, 'bad', false);
        break;
      case 'packGrew':
        say(t.evPackGrew(e.size), 'bad');
        break;
      case 'packFounded':
        say(t.evPackFounded, 'bad');
        break;
      case 'packStarved':
        if (e.size > 0) say(t.evPackStarved, 'good');
        break;
      case 'packGone':
        say(t.evPackGone[e.cause] ?? t.evPackGone['driven']!, 'good');
        break;
      case 'packImmigrated':
        say(t.evPackImmigrated, 'bad');
        break;
      case 'seasonBegan':
        say(t.evSeason(seasonName(data, locale, e.season), e.year), 'info', true, true);
        break;
      case 'iceAgeBegan':
        say(t.evIceBegan(e.months), 'bad');
        break;
      case 'iceAgeEnded':
        say(t.evIceEnded(e.survivors), 'good');
        // Prüfung unterwegs: Geht die Partie weiter, sagt das eine eigene Meldung.
        if (!events.some((x) => x.type === 'gameWon' || x.type === 'gameLost')) say(t.evIceSurvived(e.count), 'info');
        break;
      case 'gameWon':
        break; // iceAgeEnded erzählt es schon
      case 'gameLost':
        say(e.cause === 'lastIce' ? t.evLostLastIce : t.evLost, 'bad');
        break;
      // Wild und Lager (H3b): vorläufige, schlichte Meldungen; die eigentliche Oberfläche folgt.
      case 'preyGrew':
        say(t.evPreyGrew, 'info', false);
        break;
      case 'preyFounded':
        say(t.evPreyFounded, 'info', false);
        break;
      case 'preyMoved':
        break;
      case 'preyStarved':
        say(t.evPreyStarved(e.size <= 0), 'info', false);
        break;
      case 'preyGone':
        say(t.evPreyGone, 'info', false);
        break;
      case 'preyImmigrated':
        say(t.evPreyImmigrated, 'good');
        fx.push({ type: 'preyArrived', x: e.x, y: e.y });
        break;
      case 'preyHunted': {
        // Jagd im Feuer ist selten und gewollt: auch als Toast
        say(t.evPreyHunted(e.killed, e.fire), 'good', e.fire);
        const at = preyAt.get(e.prey);
        if (at) fx.push({ type: 'preyHunted', ...at, fire: e.fire, from: herdAt });
        break;
      }
      case 'packAtePrey': {
        say(t.evPackAtePrey, 'info', false);
        const at = preyAt.get(e.prey);
        if (at) fx.push({ type: 'packAtePrey', ...at });
        break;
      }
      case 'campFounded':
        say(t.evCampFounded, 'good');
        fx.push({ type: 'camp', x: e.x, y: e.y });
        break;
      case 'fieldCleared':
        say(t.evFieldCleared(land(e.from), land(e.to)), 'info');
        fx.push({ type: 'cleared', x: e.x, y: e.y });
        break;
      // Entwicklung: Angebot (Hinweis an der Herde, Auswahl im Spiel), Wahl mit Wirkung, Reife, Sprung mit Effekt.
      case 'traitOffered':
        say(t.evTraitOffered(e.traits.map((id) => traitLabel(data, locale, id)).join(', ')), 'info', true, true);
        break;
      case 'traitPicked':
        say(t.evTraitPicked(traitName(data, locale, e.trait), textOf(data.traits.get(e.trait)?.text, locale)), 'good');
        break;
      case 'matured':
        say(t.evMatured(stageName(data, locale, e.next)), 'good');
        break;
      case 'herdEvolved':
        say(t.evEvolved(stageName(data, locale, e.from), stageName(data, locale, e.to)), 'good');
        fx.push({ type: 'evolve', ...herdAt, stage: e.to });
        break;
    }
  }
  if (killed > 0) {
    say(t.evHunted(killed), 'bad');
    fx.push({ type: 'hunt', ...herdAt, packs: hunters });
  }
  for (const s of succession.values()) say(t.evSuccession(land(s.from), land(s.to), s.n), 'info');
  return { notices, fx };
}

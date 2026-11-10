/**
 * Lokalisierte Kurztexte für wichtige Spielereignisse und die Ereignis-Ankündigung. Textbausteine stehen in
 * config.yaml → texts (log.*, forecast.*), damit Oberflächen nicht selbst übersetzen müssen.
 */
import type { GameView, Locale } from './api.ts';
import { tpl } from './cards/text.ts';
import type { GameData } from './schema/index.ts';
import type { GameEvent, GameState } from './state.ts';

function zoneName(data: GameData, id: string, locale: Locale): string {
  const geo = data.zones.find((z) => z.id === id)?.geography;
  return (geo && data.geographies.get(geo)?.name[locale]) ?? id;
}

const name = (m: ReadonlyMap<string, { name: { de: string; en: string } }>, id: string, locale: Locale) =>
  m.get(id)?.name[locale] ?? id;

/** Zahl in der Schreibweise der Sprache (1,5 bzw. 1.5), höchstens zwei Nachkommastellen. */
function num(n: number, locale: Locale): string {
  const s = String(Math.round(n * 100) / 100);
  return locale === 'de' ? s.replace('.', ',') : s;
}

/**
 * Kurztext zu einem Spielereignis oder null für Details, die Oberflächen nicht einzeln melden
 * (Wertänderungen, gezogene Karten, Punkte …).
 */
export function describeEvent(data: GameData, event: GameEvent, locale: Locale): string | null {
  const zone = (id: string) => zoneName(data, id, locale);
  const species = (id: string) => name(data.species, id, locale);
  const ev = (id: string) => name(data.events, id, locale);
  const icon = (id: string) => data.events.get(id)?.icon ?? '⚡';
  switch (event.type) {
    case 'roundStarted':
      return tpl(data, 'log.roundStarted', locale, {
        round: event.round,
        season: data.seasons.find((s) => s.id === event.season)?.name[locale] ?? event.season,
      });
    case 'deckReshuffled':
      return tpl(data, 'log.deckReshuffled', locale, { n: event.cards });
    case 'cardPlayed':
      return tpl(data, 'log.cardPlayed', locale, { card: name(data.cards, event.card, locale) });
    case 'triggered': {
      const t = data.cards.get(event.card)?.triggers.find((x) => x.id === event.trigger);
      return tpl(data, 'log.triggered', locale, {
        icon: t?.icon ?? '⚡',
        name: t?.name[locale] ?? event.trigger,
        zone: zone(event.zone),
      });
    }
    case 'formChanged':
      return tpl(data, 'log.formChanged', locale, {
        zone: zone(event.zone),
        form: data.forms.get(event.to)?.form.name[locale] ?? event.to,
      });
    case 'levelChanged':
      return tpl(data, event.to > event.from ? 'log.levelRose' : 'log.levelFell', locale, {
        zone: zone(event.zone),
        n: event.to,
      });
    case 'speciesEmerged':
      return tpl(data, event.first ? 'log.speciesEmergedFirst' : 'log.speciesEmerged', locale, {
        species: species(event.species),
        zone: zone(event.zone),
      });
    case 'speciesExtinct':
      return tpl(data, 'log.speciesExtinct', locale, { species: species(event.species) });
    case 'giftAdded':
      return tpl(data, 'log.giftAdded', locale, { card: name(data.cards, event.card, locale) });
    case 'hunger':
      return tpl(data, 'log.hunger', locale, { species: species(event.species), zone: zone(event.zone) });
    case 'overpopulation':
      return tpl(data, 'log.overpopulation', locale, {
        zone: zone(event.zone),
        food: data.stats.get(event.food)?.name[locale] ?? species(event.food),
      });
    case 'migrated':
      return tpl(data, 'log.migrated', locale, {
        n: event.count,
        species: species(event.species),
        from: zone(event.from),
        to: zone(event.to),
      });
    case 'collapsed':
      return tpl(data, 'log.collapsed', locale, { round: event.round });
    case 'eventForecast':
      return event.zone === null
        ? tpl(data, 'log.eventForecast', locale, { icon: icon(event.event), event: ev(event.event) })
        : tpl(data, 'log.eventForecastZone', locale, {
            icon: icon(event.event),
            event: ev(event.event),
            zone: zone(event.zone),
          });
    case 'eventOccurred':
      return event.zone === null
        ? tpl(data, 'log.eventOccurred', locale, { icon: icon(event.event), event: ev(event.event) })
        : tpl(data, 'log.eventOccurredZone', locale, {
            icon: icon(event.event),
            event: ev(event.event),
            zone: zone(event.zone),
          });
    case 'eventCancelled':
      return tpl(data, 'log.eventCancelled', locale, { event: ev(event.event) });
    case 'eventDelayed':
      return tpl(data, 'log.eventDelayed', locale, { event: ev(event.event), round: event.round });
    case 'breathChanged':
    case 'cardDrawn':
    case 'couplingApplied':
    case 'disturbance':
    case 'gameOver': // Der Kollaps ist schon gemeldet; Endstand zeigt die Oberfläche selbst.
    case 'harmonyChanged':
    case 'populationChanged':
    case 'scored':
    case 'seasonApplied':
    case 'statChanged':
    case 'turnEnded':
      return null;
  }
}

/** Ankündigung für GameView.forecast (Konzept 3, Phase „Vorschau“). */
export function forecastView(data: GameData, state: GameState, locale: Locale): GameView['forecast'] {
  const f = state.forecast;
  const def = f && data.events.get(f.event);
  if (!f || !def) return null;
  let text = def.description[locale];
  if (f.zone !== null) text = tpl(data, 'forecast.zone', locale, { text, zone: zoneName(data, f.zone, locale) });
  if (f.strength !== 1) text = tpl(data, 'forecast.strength', locale, { text, n: num(f.strength, locale) });
  return {
    id: def.id,
    name: def.name[locale],
    text,
    icon: def.icon,
    zone: f.zone,
    zoneName: f.zone === null ? null : zoneName(data, f.zone, locale),
    strength: f.strength,
    inRounds: f.round - state.round,
  };
}

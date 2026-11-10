/**
 * Erzeugt lesbare, lokalisierte Texte aus den Daten: Kartentext aus Effekten und Schwellen,
 * Bedingungen. Textbausteine stehen in config.yaml → texts (Platzhalter in {Klammern}).
 */
import type { Locale } from '../api.ts';
import type { Card, Condition, Effect, GameData, Text } from '../schema/index.ts';

/** Alle Textbausteine, die die Engine braucht (die Datenprüfung verlangt sie). */
export const TEXT_KEYS = [
  'effect.adjust',
  'effect.set',
  'effect.restoreAll',
  'effect.restoreAllSteps',
  'effect.restoreStat',
  'effect.restoreStatSteps',
  'effect.transfer',
  'effect.draw',
  'effect.breath',
  'effect.population',
  'effect.move',
  'effect.disturb',
  'effect.setLevel',
  'effect.eventCancel',
  'effect.eventDelay',
  'choice',
  'choice.option',
  'forecast.strength',
  'forecast.zone',
  'scope.neighbors',
  'scope.area',
  'scope.all',
  'at.slot',
  'cond.gte',
  'cond.lte',
  'cond.eq',
  'cond.range',
  'cond.hasStat',
  'cond.geography',
  'cond.form',
  'cond.formKind',
  'cond.season',
  'cond.disturbedWithin',
  'cond.minLevel',
  'cond.anyNeighbor',
  'cond.not',
  'join.and',
  'join.or',
  'join.list',
  'trigger',
  'trigger.disturbance',
  'slot.when',
  'slot.zone',
  'slot.neighbor',
  'slot.species',
  'slot.choice',
  'kind.ideal',
  'kind.normal',
  'kind.degraded',
  'kind.disturbance',
] as const;

/** Textbausteine für Ereignis-Meldungen (`describeEvent`), Schlüssel log.<Ereignistyp>[.<Variante>]. */
export const LOG_KEYS = [
  'log.roundStarted',
  'log.deckReshuffled',
  'log.cardPlayed',
  'log.triggered',
  'log.formChanged',
  'log.levelRose',
  'log.levelFell',
  'log.speciesEmerged',
  'log.speciesEmergedFirst',
  'log.speciesExtinct',
  'log.giftAdded',
  'log.hunger',
  'log.overpopulation',
  'log.migrated',
  'log.collapsed',
  'log.eventForecast',
  'log.eventForecastZone',
  'log.eventOccurred',
  'log.eventOccurredZone',
  'log.eventCancelled',
  'log.eventDelayed',
] as const;
export type TextKey = (typeof TEXT_KEYS)[number] | (typeof LOG_KEYS)[number];

export function localize(text: Text, locale: Locale): string {
  return text[locale];
}

/** Füllt einen Textbaustein. Unbekannte Platzhalter bleiben stehen. */
export function tpl(data: GameData, key: TextKey, locale: Locale, vars: Record<string, string | number> = {}): string {
  const t = data.config.texts[key];
  if (!t) throw new Error(`Textbaustein fehlt: ${key}`);
  return t[locale].replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

function statName(data: GameData, id: string, locale: Locale): string {
  const s = data.stats.get(id);
  return s ? s.name[locale] : id;
}

function speciesName(data: GameData, id: string, locale: Locale): string {
  const s = data.species.get(id);
  return s ? s.name[locale] : id;
}

/** Name einer Art im Kartentext: Art-Slot der Karte (dessen Bezeichnung) oder Art-Id. */
function speciesRefName(data: GameData, card: Card | null, ref: string, locale: Locale): string {
  const slot = card?.slots.find((s) => s.id === ref);
  return slot ? slotLabel(data, slot, locale) : speciesName(data, ref, locale);
}

function rangeText(data: GameData, c: { gte?: number; lte?: number; eq?: number }, stat: string, locale: Locale) {
  if (c.eq !== undefined) return tpl(data, 'cond.eq', locale, { stat, n: c.eq });
  if (c.gte !== undefined && c.lte !== undefined) return tpl(data, 'cond.range', locale, { stat, a: c.gte, b: c.lte });
  if (c.gte !== undefined) return tpl(data, 'cond.gte', locale, { stat, n: c.gte });
  return tpl(data, 'cond.lte', locale, { stat, n: c.lte! });
}

export function describeCondition(data: GameData, c: Condition, locale: Locale): string {
  const list = (cs: readonly Condition[], join: 'join.and' | 'join.or') =>
    cs.map((x) => describeCondition(data, x, locale)).join(tpl(data, join, locale));
  if ('stat' in c) return rangeText(data, c, statName(data, c.stat, locale), locale);
  if ('population' in c) return rangeText(data, c, speciesName(data, c.population, locale), locale);
  if ('minLevel' in c) return tpl(data, 'cond.minLevel', locale, { n: c.minLevel });
  if ('hasStat' in c) return tpl(data, 'cond.hasStat', locale, { stat: statName(data, c.hasStat, locale) });
  if ('geography' in c)
    return tpl(data, 'cond.geography', locale, {
      geo: data.geographies.get(c.geography)?.name[locale] ?? c.geography,
    });
  if ('form' in c) return tpl(data, 'cond.form', locale, { form: data.forms.get(c.form)?.form.name[locale] ?? c.form });
  if ('formKind' in c) return tpl(data, 'cond.formKind', locale, { kind: tpl(data, `kind.${c.formKind}`, locale) });
  if ('season' in c)
    return tpl(data, 'cond.season', locale, {
      season: data.seasons.find((s) => s.id === c.season)?.name[locale] ?? c.season,
    });
  if ('disturbedWithin' in c) return tpl(data, 'cond.disturbedWithin', locale, { n: c.disturbedWithin });
  if ('anyNeighbor' in c) return tpl(data, 'cond.anyNeighbor', locale, { conds: list(c.anyNeighbor, 'join.and') });
  if ('not' in c) return tpl(data, 'cond.not', locale, { conds: list(c.not, 'join.and') });
  return `(${list(c.any, 'join.or')})`;
}

export function describeEffect(data: GameData, card: Card | null, e: Effect, locale: Locale): string {
  let text: string;
  if ('adjust' in e)
    text = tpl(data, 'effect.adjust', locale, { stat: statName(data, e.adjust, locale), n: signed(e.by) });
  else if ('set' in e) text = tpl(data, 'effect.set', locale, { stat: statName(data, e.set, locale), n: e.value });
  else if ('restore' in e) {
    const all = e.restore === 'all';
    const key = all
      ? e.steps === undefined
        ? 'effect.restoreAll'
        : 'effect.restoreAllSteps'
      : e.steps === undefined
        ? 'effect.restoreStat'
        : 'effect.restoreStatSteps';
    text = tpl(data, key, locale, { stat: all ? '' : statName(data, e.restore, locale), n: e.steps ?? 0 });
  } else if ('transfer' in e)
    text = tpl(data, 'effect.transfer', locale, {
      stat: statName(data, e.transfer, locale),
      into: statName(data, e.into, locale),
      n: e.amount,
    });
  else if ('population' in e)
    text = tpl(data, 'effect.population', locale, {
      species: speciesRefName(data, card, e.population, locale),
      n: signed(e.by),
    });
  else if ('move' in e)
    text = tpl(data, 'effect.move', locale, { species: speciesRefName(data, card, e.move, locale), n: e.amount });
  else if ('disturb' in e) text = tpl(data, 'effect.disturb', locale);
  else if ('setLevel' in e) text = tpl(data, 'effect.setLevel', locale, { n: e.setLevel });
  else if ('event' in e)
    return e.event === 'cancel'
      ? tpl(data, 'effect.eventCancel', locale)
      : tpl(data, 'effect.eventDelay', locale, { n: e.rounds });
  else if ('draw' in e) return tpl(data, 'effect.draw', locale, { n: e.draw });
  else return tpl(data, 'effect.breath', locale, { n: signed(e.breath) });

  const scope = 'scope' in e ? e.scope : 'self';
  if (scope !== 'self') return tpl(data, `scope.${scope}`, locale, { text });
  // Effekte auf einen weiteren Slot (z. B. Nachbarzone) werden benannt, der erste Slot nicht.
  const slot = card?.slots.find((s) => s.id === e.at);
  if (card && slot && slot !== card.slots[0])
    return tpl(data, 'at.slot', locale, { text, slot: slotLabel(data, slot, locale) });
  return text;
}

export function slotLabel(data: GameData, slot: Card['slots'][number], locale: Locale): string {
  return slot.label ? slot.label[locale] : tpl(data, `slot.${slot.kind}`, locale);
}

/** Kartentext: Grundeffekte, dann je Schwelle „Wenn …: Folge“. */
export function cardText(data: GameData, card: Card, locale: Locale): string {
  const sep = tpl(data, 'join.list', locale);
  const parts = card.effects.map((e) => describeEffect(data, card, e, locale));
  for (const slot of card.slots)
    if (slot.kind === 'choice') {
      const options = slot.options.map((o) =>
        tpl(data, 'choice.option', locale, {
          label: o.label[locale],
          effects: o.effects.map((e) => describeEffect(data, card, e, locale)).join(', '),
        }),
      );
      parts.push(tpl(data, 'choice', locale, { options: options.join(tpl(data, 'join.or', locale)) }));
    }
  for (const t of card.triggers) {
    let line = tpl(data, 'trigger', locale, {
      conds: t.when.map((c) => describeCondition(data, c, locale)).join(tpl(data, 'join.and', locale)),
      icon: t.icon,
      name: t.name[locale],
      effects: t.effects.map((e) => describeEffect(data, card, e, locale)).join(', '),
    });
    if (t.disturbance) line = tpl(data, 'trigger.disturbance', locale, { text: line });
    parts.push(line);
  }
  const text = parts.join(sep);
  const when = card.slots.flatMap((s) => ('when' in s ? s.when : []));
  if (when.length === 0) return text;
  const conds = when.map((c) => describeCondition(data, c, locale)).join(tpl(data, 'join.and', locale));
  return tpl(data, 'slot.when', locale, { conds, text });
}

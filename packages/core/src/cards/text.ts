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
  'join.effects',
  'join.req',
  'sentence',
  'trigger',
  'trigger.always',
  'trigger.disturbance',
  'at.neighbor',
  'req',
  'req.on',
  'req.where',
  'req.lives',
  'req.nextTo',
  'req.nextToWhere',
  'req.slot',
  'short.scope.neighbors',
  'short.scope.area',
  'short.scope.all',
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

/**
 * Text eines Effekts. short = knappe Fassung für die Handkarte (Reichweite als ein Wort: nebenan, ringsum, überall).
 */
export function describeEffect(data: GameData, card: Card | null, e: Effect, locale: Locale, short = false): string {
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
  if (scope !== 'self') return tpl(data, short ? `short.scope.${scope}` : `scope.${scope}`, locale, { text });
  // Effekte auf einen weiteren Slot werden benannt (Nachbarzone: „nebenan“), der erste Slot nicht.
  const slot = card?.slots.find((s) => s.id === e.at);
  if (card && slot && slot !== card.slots[0])
    return slot.kind === 'neighbor'
      ? tpl(data, 'at.neighbor', locale, { text })
      : tpl(data, 'at.slot', locale, { text, slot: slotLabel(data, slot, locale) });
  return text;
}

export function slotLabel(data: GameData, slot: Card['slots'][number], locale: Locale): string {
  return slot.label ? slot.label[locale] : tpl(data, `slot.${slot.kind}`, locale);
}

/** Erster Buchstabe groß (Satzanfang); Symbole am Anfang bleiben unverändert. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Länge in Zeichen (Emoji zählt als eins). */
const charCount = (s: string) => [...s].length;

/**
 * Geografien, auf die eine Bedingung beschränkt (Sonderwert, Geografie, „oder“ daraus), sonst null.
 * Ein gemeinsamer Wert (jede Zone hat ihn) beschränkt nicht: alle Geografien.
 */
function geographiesOf(data: GameData, c: Condition): Set<string> | null {
  const all = [...data.geographies.keys()];
  if ('hasStat' in c)
    return new Set(
      data.commonStats.includes(c.hasStat) ? all : all.filter((g) => data.geographies.get(g)!.special === c.hasStat),
    );
  if ('geography' in c) return new Set([c.geography]);
  if ('any' in c) {
    const parts = c.any.map((x) => geographiesOf(data, x));
    if (parts.some((p) => p === null)) return null;
    return new Set(parts.flatMap((p) => [...p!]));
  }
  return null;
}

/**
 * Kurze, natürliche Bedingung eines Ziel-Slots: „auf Fluss oder Küste“, „wo Fisch lebt“, „neben Flachland“,
 * sonst „wo Vegetation ≥ 1“. Leer, wenn der Slot nichts verlangt.
 */
function slotRequirement(data: GameData, card: Card, slot: Card['slots'][number], locale: Locale): string[] {
  if (slot.kind !== 'zone' && slot.kind !== 'neighbor') return [];
  if (slot.when.length === 0) return [];
  // Geografie-Bedingungen werden geschnitten (alle müssen gelten), der Rest wird als Wert beschrieben.
  const rest: Condition[] = [];
  const geoSets: Set<string>[] = [];
  for (const c of slot.when) {
    const g = geographiesOf(data, c);
    if (g === null) rest.push(c);
    else geoSets.push(g);
  }
  const geos =
    geoSets.length === 0 ? null : new Set([...data.geographies.keys()].filter((id) => geoSets.every((s) => s.has(id))));
  const or = tpl(data, 'join.or', locale);
  const and = tpl(data, 'join.and', locale);
  const geoNames =
    geos !== null && geos.size > 0 && geos.size < data.geographies.size
      ? [...data.geographies.values()]
          .filter((g) => geos.has(g.id))
          .map((g) => g.name[locale])
          .join(or)
      : null;
  const out: string[] = [];
  if (slot.kind === 'neighbor') {
    if (geoNames !== null) out.push(tpl(data, 'req.nextTo', locale, { geos: geoNames }));
    if (rest.length > 0)
      out.push(
        tpl(data, 'req.nextToWhere', locale, { conds: rest.map((c) => describeCondition(data, c, locale)).join(and) }),
      );
    return out;
  }
  if (geoNames !== null) out.push(tpl(data, 'req.on', locale, { geos: geoNames }));
  // „wo Fisch lebt“ für die häufige Bedingung „Bestand ≥ 1“, sonst die Bedingung als Wert.
  const lives = rest.filter((c) => 'population' in c && c.gte === 1 && c.lte === undefined && c.eq === undefined);
  for (const c of lives)
    if ('population' in c)
      out.push(tpl(data, 'req.lives', locale, { species: speciesName(data, c.population, locale) }));
  const other = rest.filter((c) => !lives.includes(c));
  if (other.length > 0)
    out.push(tpl(data, 'req.where', locale, { conds: other.map((c) => describeCondition(data, c, locale)).join(and) }));
  if (slot === card.slots[0] || out.length === 0) return out;
  return [tpl(data, 'req.slot', locale, { slot: slotLabel(data, slot, locale), req: out.join(' ') })];
}

/** Bedingungen einer Schwelle, die nicht schon der Ziel-Slot garantiert (gleiche Bedingung, vor dem Effekt geprüft). */
function triggerConditions(card: Card, t: Card['triggers'][number]): Condition[] {
  if (t.check !== 'before') return t.when;
  const slot = card.slots.find((s) => s.id === t.at);
  const given = slot && 'when' in slot ? slot.when.map((c) => JSON.stringify(c)) : [];
  return t.when.filter((c) => !given.includes(JSON.stringify(c)));
}

function triggerText(data: GameData, card: Card, t: Card['triggers'][number], locale: Locale): string {
  const effects = t.effects.map((e) => describeEffect(data, card, e, locale)).join(tpl(data, 'join.effects', locale));
  const conds = triggerConditions(card, t);
  let line =
    conds.length === 0
      ? tpl(data, 'trigger.always', locale, { icon: t.icon, name: t.name[locale], effects })
      : tpl(data, 'trigger', locale, {
          conds: conds.map((c) => describeCondition(data, c, locale)).join(tpl(data, 'join.and', locale)),
          icon: t.icon,
          name: t.name[locale],
          effects,
        });
  if (t.disturbance) line = tpl(data, 'trigger.disturbance', locale, { text: line });
  return line;
}

/**
 * Kartentext für eine kleine Handkarte: zuerst die Wirkungen, dann Wahl und Schwellen, zuletzt die Bedingung
 * als kurzer Zusatz („Nur auf Fluss oder Küste.“). Jeder Teil ist ein eigener Satz.
 */
export function cardText(data: GameData, card: Card, locale: Locale): string {
  const sentences: string[] = [];
  const joinEffects = tpl(data, 'join.effects', locale);
  if (card.effects.length > 0)
    sentences.push(card.effects.map((e) => describeEffect(data, card, e, locale)).join(joinEffects));
  for (const slot of card.slots)
    if (slot.kind === 'choice') {
      const options = slot.options.map((o) =>
        tpl(data, 'choice.option', locale, {
          label: o.label[locale],
          effects: o.effects.map((e) => describeEffect(data, card, e, locale)).join(joinEffects),
        }),
      );
      sentences.push(tpl(data, 'choice', locale, { options: options.join(tpl(data, 'join.or', locale)) }));
    }
  for (const t of card.triggers) sentences.push(triggerText(data, card, t, locale));
  const req = card.slots.flatMap((s) => slotRequirement(data, card, s, locale));
  if (req.length > 0) sentences.push(tpl(data, 'req', locale, { req: req.join(tpl(data, 'join.req', locale)) }));
  return sentences
    .map((s) => tpl(data, 'sentence', locale, { text: capitalize(s) }))
    .join(tpl(data, 'join.list', locale));
}

/** Höchstlänge des Kurztexts (CardView.short) in Zeichen. */
export const SHORT_MAX = 40;

/**
 * Kurztext für die Handkarte (höchstens SHORT_MAX Zeichen): Hauptwirkung(en) in knapper Fassung und die
 * Symbole der Schwellen; ohne Grundeffekt die Wahl bzw. die erste Schwelle. Zu Langes wird mit „…“ gekürzt.
 */
export function cardShort(data: GameData, card: Card, locale: Locale): string {
  const joinEffects = tpl(data, 'join.effects', locale);
  const effects = card.effects.map((e) => describeEffect(data, card, e, locale, true));
  const choice = card.slots.find((s) => s.kind === 'choice');
  let text: string;
  if (effects.length > 0) {
    text = effects[0]!;
    for (const e of effects.slice(1)) {
      const next = text + joinEffects + e;
      if (charCount(next) > SHORT_MAX) break;
      text = next;
    }
    const icons = card.triggers.map((t) => t.icon).join(' ');
    if (icons && charCount(`${text} ${icons}`) <= SHORT_MAX) text = `${text} ${icons}`;
  } else if (choice?.kind === 'choice')
    text = tpl(data, 'choice', locale, {
      options: choice.options.map((o) => o.label[locale]).join(tpl(data, 'join.or', locale)),
    });
  else if (card.triggers.length > 0) text = `${card.triggers[0]!.icon} ${card.triggers[0]!.name[locale]}`;
  else text = card.name[locale];
  text = capitalize(text);
  return charCount(text) > SHORT_MAX ? `${[...text].slice(0, SHORT_MAX - 1).join('')}…` : text;
}

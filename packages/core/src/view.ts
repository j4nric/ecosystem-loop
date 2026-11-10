/** Lesemodell für Oberflächen: GameView mit lokalisierten Texten aus den Daten. */
import type { CardView, GameView, Locale, StatView, ZoneView } from './api.ts';
import { applyEffect } from './cards/effects.ts';
import { firingTriggers, getCard } from './cards/play.ts';
import { cardShort, cardText, slotLabel } from './cards/text.ts';
import { forecastView } from './describe.ts';
import { idealDistance, targetStatus } from './targets.ts';
import { canEndTurn, legalPlays } from './turn.ts';
import { runNature } from './nature.ts';
import { populationOf } from './population.ts';
import { breathParams } from './rules/breath.ts';
import { levelProgress } from './rules/levels.ts';
import type { Card, GameData } from './schema/index.ts';
import type { GameState, ZoneState } from './state.ts';
import { geographyOf, seasonOf, statsOf, yearOf } from './world.ts';

/**
 * Sichtbare Gefahren: Schwellen von Handkarten, die mit dieser Zone als erstem Ziel auslösen würden.
 * check "before" gegen den Zustand, check "after" gegen eine Kopie mit angewandten Grundeffekten
 * (nur Effekte auf den ersten Slot oder alle Zonen – weitere Slots sind hier noch nicht gewählt).
 */
function warnings(data: GameData, state: GameState, zone: ZoneState, locale: Locale): ZoneView['warnings'] {
  const out: ZoneView['warnings'] = [];
  const seen = new Set<string>();
  const push = (card: Card, ids: Set<string>) => {
    for (const t of card.triggers)
      if (ids.has(t.id)) out.push({ card: card.id, trigger: t.id, name: t.name[locale], icon: t.icon });
  };
  for (const inst of state.hand) {
    if (seen.has(inst.card)) continue;
    seen.add(inst.card);
    const card = getCard(data, inst.card);
    const first = card.slots[0];
    if (!first || first.kind !== 'zone') continue;
    const bound = { [first.id]: zone.id };
    const firing = new Set(
      firingTriggers(data, state, card, bound, 'before')
        .filter((t) => t.at === first.id)
        .map((t) => t.id),
    );
    if (card.triggers.some((t) => t.check === 'after' && t.at === first.id)) {
      const sim = structuredClone(state);
      const ctx = { data, state: sim, emit: () => {}, bind: bound, cause: 'warning' };
      for (const e of card.effects)
        if (!('at' in e) || e.at === first.id || ('scope' in e && e.scope === 'all')) applyEffect(ctx, e);
      for (const t of firingTriggers(data, sim, card, bound, 'after')) if (t.at === first.id) firing.add(t.id);
    }
    push(card, firing);
  }
  return out;
}

/**
 * Tatsächlicher Odem-Zufluss der nächsten Bilanz: Die Natur-Phase läuft auf einer Kopie (mit kopiertem
 * Zufall), damit Harmonie-Änderung, Arten-Bonus und Obergrenze genau so eingehen wie beim Rundenende.
 */
export function nextBreathIncome(data: GameData, state: GameState): number {
  if (state.phase !== 'play') return 0;
  const sim = structuredClone(state);
  runNature(data, sim, () => {});
  return sim.phase === 'play' ? sim.breath - state.breath : 0;
}

function zoneView(data: GameData, state: GameState, zone: ZoneState, locale: Locale): ZoneView {
  const geo = geographyOf(data, zone);
  const form = data.forms.get(zone.form)?.form;
  const ideal = data.ideals.get(geo.id);
  return {
    id: zone.id,
    geography: geo.id,
    geographyName: geo.name[locale],
    stats: statsOf(data, geo).map((id) => {
      const stat: StatView = {
        id,
        name: data.stats.get(id)!.name[locale],
        value: zone.stats[id]!,
        max: data.config.scale.max,
      };
      const range = ideal?.ranges[id];
      if (range) stat.target = { ...range, status: targetStatus(range, stat.value) };
      return stat;
    }),
    form: { id: zone.form, name: form ? form.name[locale] : zone.form, kind: form?.kind ?? 'normal' },
    ...(ideal && {
      ideal: {
        id: ideal.form,
        name: data.forms.get(ideal.form)!.form.name[locale],
        distance: idealDistance(ideal, zone.stats),
      },
    }),
    level: zone.level,
    levelProgress: levelProgress(data, zone),
    neighbors: [...zone.neighbors],
    tags: [...zone.tags],
    populations: [...data.species.values()]
      .filter((sp) => populationOf(zone, sp.id) > 0)
      .map((sp) => ({
        species: sp.id,
        name: sp.name[locale],
        tier: sp.tier,
        count: populationOf(zone, sp.id),
        group: sp.group,
      })),
    warnings: warnings(data, state, zone, locale),
  };
}

export function view(data: GameData, state: GameState, locale: Locale = 'de'): GameView {
  const season = seasonOf(data, state.round);
  const playable = new Set(legalPlays(data, state).map((p) => p.uid));
  const hand: CardView[] = state.hand.map((inst) => {
    const card = getCard(data, inst.card);
    return {
      uid: inst.uid,
      card: card.id,
      name: card.name[locale],
      category: card.category,
      cost: card.cost,
      text: cardText(data, card, locale),
      short: cardShort(data, card, locale),
      playable: playable.has(inst.uid),
      slots: card.slots.map((s) => {
        const slot: CardView['slots'][number] = { id: s.id, kind: s.kind, label: slotLabel(data, s, locale) };
        if (s.kind === 'neighbor') slot.of = s.of;
        if (s.kind === 'species') slot.of = s.in;
        if (s.kind === 'choice') slot.options = s.options.map((o) => ({ id: o.id, label: o.label[locale] }));
        return slot;
      }),
    };
  });
  const tiers = Object.keys(state.species).map((id) => data.species.get(id)?.tier ?? 0);
  return {
    locale,
    round: state.round,
    year: yearOf(data, state.round),
    season: { id: season.id, name: season.name[locale] },
    phase: state.phase,
    harmony: { value: state.harmony, max: data.harmony.max, trend: state.harmonyTrend },
    breath: { value: state.breath, max: breathParams(data).max, nextIncome: nextBreathIncome(data, state) },
    score: state.score,
    zones: state.zones.map((z) => zoneView(data, state, z, locale)),
    hand,
    drawPile: state.drawPile.length,
    discardPile: state.discardPile.length,
    playsThisTurn: state.playsThisTurn,
    minPlays: data.config.turn.minPlays,
    canEndTurn: canEndTurn(data, state),
    forecast: forecastView(data, state, locale),
    eventShield: state.eventShield,
    highestTier: Math.max(0, ...tiers),
  };
}

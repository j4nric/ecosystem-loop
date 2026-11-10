/** Lesemodell für Oberflächen: GameView mit lokalisierten Texten aus den Daten. */
import type { CardView, GameView, Locale, ZoneView } from './api.ts';
import { firingTriggers, getCard } from './cards/play.ts';
import { cardText, slotLabel } from './cards/text.ts';
import { canEndTurn, legalPlays } from './turn.ts';
import { breathIncome, breathParams } from './rules/breath.ts';
import { levelProgress } from './rules/levels.ts';
import type { GameData } from './schema/index.ts';
import type { GameState, ZoneState } from './state.ts';
import { geographyOf, seasonOf, statsOf, yearOf } from './world.ts';

/** Sichtbare Gefahren: Schwellen (check "before") von Handkarten, die auf dieser Zone auslösen würden. */
function warnings(data: GameData, state: GameState, zone: ZoneState, locale: Locale): ZoneView['warnings'] {
  const out: ZoneView['warnings'] = [];
  const seen = new Set<string>();
  for (const inst of state.hand) {
    if (seen.has(inst.card)) continue;
    seen.add(inst.card);
    const card = getCard(data, inst.card);
    const first = card.slots[0];
    if (!first) continue;
    for (const t of firingTriggers(data, state, card, { [first.id]: zone.id }, 'before'))
      if (t.at === first.id) out.push({ card: card.id, trigger: t.id, name: t.name[locale], icon: t.icon });
  }
  return out;
}

function zoneView(data: GameData, state: GameState, zone: ZoneState, locale: Locale): ZoneView {
  const geo = geographyOf(data, zone);
  const form = data.forms.get(zone.form)?.form;
  return {
    id: zone.id,
    geography: geo.id,
    geographyName: geo.name[locale],
    stats: statsOf(data, geo).map((id) => ({
      id,
      name: data.stats.get(id)!.name[locale],
      value: zone.stats[id]!,
      max: data.config.scale.max,
    })),
    form: { id: zone.form, name: form ? form.name[locale] : zone.form, kind: form?.kind ?? 'normal' },
    level: zone.level,
    levelProgress: levelProgress(data, zone),
    neighbors: [...zone.neighbors],
    tags: [...zone.tags],
    populations: [],
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
      playable: playable.has(inst.uid),
      slots: card.slots.map((s) => ({ id: s.id, kind: s.kind, label: slotLabel(data, s, locale) })),
    };
  });
  return {
    locale,
    round: state.round,
    year: yearOf(data, state.round),
    season: { id: season.id, name: season.name[locale] },
    phase: state.phase,
    harmony: { value: state.harmony, max: data.harmony.max, trend: state.harmonyTrend },
    breath: { value: state.breath, max: breathParams(data).max, nextIncome: breathIncome(data, state) },
    score: 0,
    zones: state.zones.map((z) => zoneView(data, state, z, locale)),
    hand,
    drawPile: state.drawPile.length,
    discardPile: state.discardPile.length,
    playsThisTurn: state.playsThisTurn,
    minPlays: data.config.turn.minPlays,
    canEndTurn: canEndTurn(data, state),
    forecast: null,
    highestTier: 0,
  };
}

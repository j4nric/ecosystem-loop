/** Konzept 9 (und 3, 6.2, 8): Ereignisse, Ankündigung, Skalierung, Wirkung, Störung und Gegenkarten. */
import { describe, expect, it } from 'vitest';
import { holdsAll } from '../src/conditions.ts';
import { describeEvent, newGame, preview, slotOptions, view } from '../src/game.ts';
import { densest, occur, scaleEffect } from '../src/rules/event.ts';
import { evolutionParams } from '../src/rules/evolution.ts';
import { drawForecast, eligibleEvents, eventChance, eventStrength } from '../src/rules/forecast.ts';
import { rngOf } from '../src/rng.ts';
import type { GameEvent, GameState } from '../src/state.ts';
import { bare, data, dataWith, endTurn, game, play, runRules, setPops, setStats, uidOf, zone } from './helpers.ts';

/** Daten, in denen jede Runde sicher ein Ereignis angekündigt wird (optional nur aus `only`). */
function always(only?: string[]) {
  return dataWith((r) => {
    r.config.rules.forecast.chance = { base: 1, perYear: 0, max: 1 };
    if (only) r.events.events = r.events.events.filter((e: { id: string }) => only.includes(e.id));
  });
}

function announce(s: GameState, event: string, zoneId: string | null = null, strength = 1, round = s.round): void {
  s.forecast = { event, round, strength, zone: zoneId };
}

function happen(s: GameState, event: string, zoneId: string | null = null, strength = 1): GameEvent[] {
  const events: GameEvent[] = [];
  occur(data, s, { event, round: s.round, strength, zone: zoneId }, (e) => events.push(e));
  return events;
}

describe('Ereignispool (Konzept 9)', () => {
  it('enthält die sieben Ereignisse aus dem Konzept, Meteorit erst ab Jahr 8', () => {
    expect([...data.events.keys()]).toEqual([
      'heatwave',
      'cold_snap',
      'lightning',
      'plague',
      'storm_surge',
      'locusts',
      'meteor',
    ]);
    const s = game();
    expect(eligibleEvents(data, s, 7).map((e) => e.id)).not.toContain('meteor');
    expect(eligibleEvents(data, s, 8).map((e) => e.id)).toContain('meteor');
  });

  it('Wahrscheinlichkeit und Stärke steigen mit den Jahren (Parameter in config.yaml)', () => {
    expect(eventChance(data, 1)).toBeCloseTo(0.3);
    expect(eventChance(data, 3)).toBeCloseTo(0.5);
    expect(eventChance(data, 20)).toBeCloseTo(0.9);
    expect(eventStrength(data, 1)).toBe(1);
    expect(eventStrength(data, 5)).toBe(2);
    expect(eventStrength(data, 30)).toBe(3);
    const d = dataWith((r) => (r.config.rules.forecast.chance = { base: 2, perYear: 0, max: 5 }));
    expect(eventChance(d, 1)).toBe(1);
  });

  it('Skalierung: by wird mit der Stärke multipliziert (gerundet, mindestens 1), sonst unverändert', () => {
    expect(scaleEffect({ adjust: 'moisture', by: -1, at: 'self', scope: 'self' }, 2)).toMatchObject({ by: -2 });
    expect(scaleEffect({ adjust: 'moisture', by: -1, at: 'self', scope: 'self' }, 1.25)).toMatchObject({ by: -1 });
    expect(scaleEffect({ population: 'x', by: -3, at: 'self', scope: 'self' }, 1.5)).toMatchObject({ by: -5 });
    const set = { set: 'moisture', value: 1, at: 'self', scope: 'self' } as const;
    expect(scaleEffect(set, 3)).toBe(set);
  });

  it('Ziehen ist deterministisch über den RNG im Zustand', () => {
    const d = always();
    const draw = (seed: string) => {
      const s: GameState = game({ d, seed });
      const events: GameEvent[] = [];
      drawForecast(d, s, 2, rngOf(s), (e) => events.push(e));
      return { forecast: s.forecast, events, rng: s.rng };
    };
    expect(draw('a')).toEqual(draw('a'));
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => draw(x).forecast!.event));
    expect(seen.size).toBeGreaterThan(1);
    const { forecast, events } = draw('a');
    expect(events).toEqual([{ type: 'eventForecast', ...forecast! }]);
  });

  it('ohne Glück kein Ereignis; Ereignisse ohne mögliche Zielzone fallen aus dem Pool', () => {
    const none = dataWith((r) => (r.config.rules.forecast.chance = { base: 0, perYear: 0, max: 0 }));
    const s = game({ d: none });
    drawForecast(none, s, 2, rngOf(s), () => {});
    expect(s.forecast).toBeNull();
    const plagueOnly = always(['plague']);
    const empty = bare(1, plagueOnly);
    expect(eligibleEvents(plagueOnly, empty, 1)).toEqual([]);
    drawForecast(plagueOnly, empty, 2, rngOf(empty), () => {});
    expect(empty.forecast).toBeNull();
  });

  it('die Stärke wird beim Ankündigen aus dem Jahr der Runde bestimmt (Meteorit skaliert nicht)', () => {
    const d = always(['heatwave']);
    const s = game({ d });
    drawForecast(d, s, 17, rngOf(s), () => {}); // Runde 17 = Jahr 5
    expect(s.forecast).toMatchObject({ event: 'heatwave', round: 17, strength: 2, zone: null });
    const m = always(['meteor']);
    const t = game({ d: m });
    drawForecast(m, t, 29, rngOf(t), () => {}); // Jahr 8
    expect(t.forecast).toMatchObject({ event: 'meteor', strength: 1 });
    expect(t.forecast!.zone).not.toBeNull();
  });
});

describe('Ankündigung und Eintritt im Rundenablauf (Konzept 3)', () => {
  it('newGame kündigt bereits das Ereignis der ersten Runde an (wenn die Pipeline forecast enthält)', () => {
    const d = always();
    const s = newGame(d, { seed: 'x' });
    expect(s.forecast).toMatchObject({ round: 1 });
    const off = dataWith((r) => (r.config.pipeline = r.config.pipeline.filter((m: string) => m !== 'forecast')));
    expect(newGame(off, { seed: 'x' }).forecast).toBeNull();
  });

  it('forecast kündigt am Rundenende für die nächste Runde an; event lässt es dort nach der Jahreszeit eintreten', () => {
    const d = always(['heatwave']);
    const s = game({ d, hand: ['rain', 'rain'] });
    const first = endTurn(play(s, 'rain', {}, d).state, d);
    expect(first.events).toContainEqual({
      type: 'eventForecast',
      event: 'heatwave',
      round: 2,
      zone: null,
      strength: 1,
    });
    expect(first.state.forecast).toMatchObject({ event: 'heatwave', round: 2 });
    const types = (es: GameEvent[]) => es.map((e) => e.type);
    expect(types(first.events)).not.toContain('eventOccurred');

    const second = endTurn(play(first.state, 'rain', {}, d).state, d);
    const t = types(second.events);
    expect(t.indexOf('seasonApplied')).toBeLessThan(t.indexOf('eventOccurred'));
    expect(t.indexOf('eventOccurred')).toBeLessThan(t.lastIndexOf('eventForecast'));
    expect(second.events).toContainEqual(
      expect.objectContaining({ type: 'statChanged', zone: 'forest', stat: 'moisture', cause: 'event:heatwave' }),
    );
    expect(second.state.eventsOccurred).toBe(1);
  });

  it('view().forecast zeigt Name, Text, Zielzone, Stärke und wann es eintritt', () => {
    const s = game();
    expect(view(data, s).forecast).toBeNull();
    announce(s, 'lightning', 'forest');
    expect(view(data, s, 'de').forecast).toEqual({
      id: 'lightning',
      name: 'Blitzschlag',
      text: 'Gewitter auf einer zufälligen Zone (kann Feuer auslösen) – trifft Wald',
      icon: '⚡',
      zone: 'forest',
      zoneName: 'Wald',
      strength: 1,
      inRounds: 0,
    });
    announce(s, 'heatwave', null, 1.5, s.round + 1);
    expect(view(data, s, 'en').forecast).toMatchObject({
      text: 'All zones moisture −1 (strength ×1.5)',
      inRounds: 1,
      zone: null,
      zoneName: null,
    });
    expect(view(data, s, 'de').forecast!.text).toBe('Alle Zonen Feuchte −1 (Stärke ×1,5)');
  });
});

describe('Wirkung der Ereignisse (Konzept 9)', () => {
  it('Hitzesommer: alle Zonen Feuchte −1 (mit Stärke 2: −2)', () => {
    const s = game();
    const before = s.zones.map((z) => z.stats.moisture!);
    happen(s, 'heatwave');
    expect(s.zones.map((z) => z.stats.moisture)).toEqual(before.map((m) => Math.max(0, m - 1)));
    const t = game();
    happen(t, 'heatwave', null, 2);
    expect(t.zones.map((z) => z.stats.moisture)).toEqual(before.map((m) => Math.max(0, m - 2)));
  });

  it('Kälteeinbruch: Berge Schnee +2, alle Zonen Vegetation −1, keine Störung', () => {
    const s = game();
    const snow = zone(s, 'mountains').stats.snow!;
    const veg = s.zones.map((z) => z.stats.vegetation!);
    const events = happen(s, 'cold_snap');
    expect(zone(s, 'mountains').stats.snow).toBe(Math.min(5, snow + 2));
    expect(s.zones.map((z) => z.stats.vegetation)).toEqual(veg.map((v) => Math.max(0, v - 1)));
    expect(events.some((e) => e.type === 'disturbance')).toBe(false);
  });

  it('Blitzschlag: Gewitter auf der Zielzone, auf trockener Zone mit Feuer (Störung)', () => {
    const s = game();
    setStats(s, 'forest', { moisture: 1, vegetation: 4 });
    const events = happen(s, 'lightning', 'forest');
    expect(events[0]).toEqual({ type: 'eventOccurred', event: 'lightning', zone: 'forest', strength: 1 });
    expect(events).toContainEqual({
      type: 'triggered',
      card: 'thunderstorm',
      trigger: 'fire',
      zone: 'forest',
      disturbance: true,
    });
    expect(zone(s, 'forest').stats.vegetation).toBe(0);
    expect(zone(s, 'forest').lastDisturbance).toBe(s.round);
    expect(events).toContainEqual({ type: 'disturbance', zone: 'forest', cause: 'trigger:thunderstorm.fire' });
  });

  it('Seuche: die dichteste Population −3, die Zone ist gestört', () => {
    const s = bare(2);
    setPops(s, 'forest', { beetle: 4 });
    setPops(s, 'plains', { beetle: 6, bee: 6 });
    expect(densest(data, s, data.events.get('plague')!)).toEqual({ zone: 'plains', species: 'beetle', count: 6 });
    const events = happen(s, 'plague');
    expect(events[0]).toEqual({ type: 'eventOccurred', event: 'plague', zone: 'plains', strength: 1 });
    expect(zone(s, 'plains').populations).toEqual({ beetle: 3, bee: 6 });
    expect(zone(s, 'plains').lastDisturbance).toBe(2);
    expect(events).toContainEqual({ type: 'disturbance', zone: 'plains', cause: 'event:plague' });
  });

  it('Seuche ohne Leben verpufft', () => {
    const s = bare();
    const events = happen(s, 'plague');
    expect(events).toEqual([{ type: 'eventOccurred', event: 'plague', zone: null, strength: 1 }]);
  });

  it('Sturmflut: Küste Salz +2 (Störung), Flachland Feuchte +1', () => {
    const s = game();
    setStats(s, 'coast', { salt: 2 });
    setStats(s, 'plains', { moisture: 2 });
    happen(s, 'storm_surge');
    expect(zone(s, 'coast').stats.salt).toBe(4);
    expect(zone(s, 'plains').stats.moisture).toBe(3);
    expect(zone(s, 'coast').lastDisturbance).toBe(s.round);
    expect(zone(s, 'plains').lastDisturbance).toBeNull();
  });

  it('Heuschrecken: Flachland Vegetation −2 (Störung)', () => {
    const s = game();
    setStats(s, 'plains', { vegetation: 4 });
    happen(s, 'locusts');
    expect(zone(s, 'plains').stats.vegetation).toBe(2);
    expect(zone(s, 'plains').lastDisturbance).toBe(s.round);
  });

  it('Meteorit: Zone fällt auf Stufe 1, sie und ihre Nachbarn sind gestört', () => {
    const s = game();
    zone(s, 'forest').level = 4;
    zone(s, 'forest').levelProgress = 2;
    const events = happen(s, 'meteor', 'forest');
    expect(zone(s, 'forest')).toMatchObject({ level: 1, levelProgress: 0, lastDisturbance: s.round });
    expect(events).toContainEqual({ type: 'levelChanged', zone: 'forest', from: 4, to: 1, reason: 'effect' });
    for (const n of ['mountains', 'river', 'plains']) expect(zone(s, n).lastDisturbance).toBe(s.round);
    expect(zone(s, 'coast').lastDisturbance).toBeNull();
  });

  it('Störungen durch Ereignisse zählen für den Selektionsdruck (auch nebenan)', () => {
    const s = bare(5);
    setPops(s, 'plains', { beetle: 6 });
    const pressure = evolutionParams(data).pressure.when;
    const ok = (id: string) => holdsAll(pressure, { data, state: s, zone: zone(s, id) });
    expect(ok('plains')).toBe(false);
    happen(s, 'plague');
    expect(ok('plains')).toBe(true);
    expect(ok('coast')).toBe(true); // Nachbar
    expect(ok('mountains')).toBe(false);
  });

  it('unbekanntes Ereignis ist ein Regelfehler', () => {
    expect(() => happen(game(), 'dragon')).toThrow(/Unbekanntes Ereignis/);
  });
});

describe('Gegenkarten (Konzept 6.2, 8, 9)', () => {
  it('Stille: das angekündigte Ereignis entfällt', () => {
    const s = game({ hand: ['silence'], breath: 5 });
    announce(s, 'heatwave');
    const { state, events } = play(s, 'silence');
    expect(state.forecast).toBeNull();
    expect(events).toContainEqual({ type: 'eventCancelled', event: 'heatwave', cause: 'card:silence' });
    const after = endTurn(state);
    expect(after.events.some((e) => e.type === 'eventOccurred')).toBe(false);
  });

  it('Stille ohne Ankündigung: das nächste ausgeloste Ereignis entfällt', () => {
    const d = always(['heatwave']);
    const s = game({ d, hand: ['silence'], breath: 5 });
    const a = play(s, 'silence', {}, d);
    expect(a.state.eventShield).toBe(1);
    expect(view(d, a.state).eventShield).toBe(1);
    const b = endTurn(a.state, d);
    expect(b.events).toContainEqual({ type: 'eventCancelled', event: 'heatwave', cause: 'shield' });
    expect(b.state.forecast).toBeNull();
    expect(b.state.eventShield).toBe(0);
  });

  it('Späherblick: Wahl-Slot mit Abwenden oder Verschieben', () => {
    const s = game({ hand: ['scout_eye'], breath: 5 });
    announce(s, 'locusts');
    const uid = uidOf(s, 'scout_eye');
    expect(slotOptions(data, s, uid, {})).toEqual(['avert', 'delay']);
    const card = view(data, s, 'de').hand[0]!;
    expect(card.slots).toEqual([
      {
        id: 'mode',
        kind: 'choice',
        label: 'Späherblick',
        options: [
          { id: 'avert', label: 'Abwenden' },
          { id: 'delay', label: 'Verschieben' },
        ],
      },
    ]);
    expect(card.text).toBe(
      'Wähle: Abwenden (nächstes Ereignis entfällt) oder Verschieben (nächstes Ereignis 1 Runde später).',
    );
    const averted = play(s, 'scout_eye', { mode: 'avert' });
    expect(averted.state.forecast).toBeNull();
    expect(averted.events).toContainEqual({ type: 'eventCancelled', event: 'locusts', cause: 'card:scout_eye' });
    expect(() => play(s, 'scout_eye', { mode: 'later' })).toThrow(/Ungültiges Ziel/);
  });

  it('Späherblick „Verschieben“: das Ereignis tritt eine Runde später ein, ohne neue Ankündigung dazwischen', () => {
    const d = always(['heatwave', 'locusts']);
    const s = game({ d, hand: ['scout_eye', 'rain'], breath: 5 });
    announce(s, 'locusts');
    setStats(s, 'plains', { vegetation: 4 });
    const a = play(s, 'scout_eye', { mode: 'delay' }, d);
    expect(a.events).toContainEqual({ type: 'eventDelayed', event: 'locusts', round: 2, cause: 'card:scout_eye' });
    expect(view(d, a.state).forecast).toMatchObject({ id: 'locusts', inRounds: 1 });
    const b = endTurn(a.state, d);
    expect(b.events.some((e) => e.type === 'eventOccurred' || e.type === 'eventForecast')).toBe(false);
    expect(b.state.forecast).toMatchObject({ event: 'locusts', round: 2 });
    const c = endTurn(play(b.state, 'rain', {}, d).state, d);
    expect(c.events).toContainEqual({ type: 'eventOccurred', event: 'locusts', zone: null, strength: 1 });
  });

  it('Verschieben ohne Ankündigung bleibt wirkungslos', () => {
    const s = game({ hand: ['scout_eye'], breath: 5 });
    const { state, events } = play(s, 'scout_eye', { mode: 'delay' });
    expect(state.forecast).toBeNull();
    expect(state.eventShield).toBe(0);
    expect(events.some((e) => e.type === 'eventDelayed')).toBe(false);
  });

  it('Arche: Bestand +2 einer Art in einer Zone, in der sie lebt', () => {
    const s = game({ hand: ['ark'], breath: 5, life: false });
    setPops(s, 'forest', { deer: 1 });
    const uid = uidOf(s, 'ark');
    expect(slotOptions(data, s, uid, {})).toEqual(['forest']);
    expect(slotOptions(data, s, uid, { zone: 'forest' })).toEqual(['deer']);
    const p = preview(data, s, { uid, targets: { zone: 'forest', species: 'deer' } }, 'de');
    expect(p.populationChanges).toEqual([
      { zone: 'forest', zoneName: 'Wald', species: 'deer', speciesName: 'Hirsch', from: 1, to: 3 },
    ]);
    const { state } = play(s, 'ark', { zone: 'forest', species: 'deer' });
    expect(zone(state, 'forest').populations.deer).toBe(3);
    expect(state.breath).toBe(1);
  });

  it('Vorschau zeigt die Wirkung auf das angekündigte Ereignis', () => {
    const s = game({ hand: ['silence', 'scout_eye'], breath: 9 });
    const shield = preview(data, s, { uid: uidOf(s, 'silence'), targets: {} }, 'de');
    expect(shield.eventChanges).toEqual([{ event: null, name: null, change: 'shielded' }]);
    announce(s, 'heatwave');
    const cancel = preview(data, s, { uid: uidOf(s, 'silence'), targets: {} }, 'de');
    expect(cancel.eventChanges).toEqual([{ event: 'heatwave', name: 'Hitzesommer', change: 'cancelled' }]);
    const delay = preview(data, s, { uid: uidOf(s, 'scout_eye'), targets: { mode: 'delay' } }, 'en');
    expect(delay.eventChanges).toEqual([{ event: 'heatwave', name: 'Heatwave', change: 'delayed', round: 2 }]);
  });
});

describe('describeEvent', () => {
  it('liefert lokalisierte Kurztexte für wichtige Ereignisse, null für Details', () => {
    const de = (e: GameEvent) => describeEvent(data, e, 'de');
    const en = (e: GameEvent) => describeEvent(data, e, 'en');
    expect(de({ type: 'eventForecast', event: 'lightning', round: 2, zone: 'forest', strength: 1 })).toBe(
      'Angekündigt: ⚡ Blitzschlag in Wald',
    );
    expect(en({ type: 'eventForecast', event: 'heatwave', round: 2, zone: null, strength: 1 })).toBe(
      'Forecast: ☀️ Heatwave',
    );
    expect(de({ type: 'eventOccurred', event: 'plague', zone: 'plains', strength: 1 })).toBe('🦠 Seuche in Flachland');
    expect(de({ type: 'eventOccurred', event: 'heatwave', zone: null, strength: 1 })).toBe('☀️ Hitzesommer');
    expect(de({ type: 'eventCancelled', event: 'heatwave', cause: 'shield' })).toBe('Hitzesommer bleibt aus');
    expect(en({ type: 'eventDelayed', event: 'locusts', round: 4, cause: 'card:scout_eye' })).toBe(
      'Locusts delayed to round 4',
    );
    expect(de({ type: 'roundStarted', round: 2, season: 'summer' })).toBe('Runde 2: Sommer');
    expect(de({ type: 'deckReshuffled', cards: 7 })).toBe('Ablage gemischt (7 Karten)');
    expect(de({ type: 'cardPlayed', uid: 1, card: 'rain', targets: {}, cost: 1 })).toBe('Regen gespielt');
    expect(de({ type: 'triggered', card: 'thunderstorm', trigger: 'fire', zone: 'forest', disturbance: true })).toBe(
      '🔥 Feuer in Wald',
    );
    expect(de({ type: 'formChanged', zone: 'forest', from: 'mixed_forest', to: 'burnt_land' })).toBe(
      'Wald wird Brandfläche',
    );
    expect(de({ type: 'levelChanged', zone: 'river', from: 1, to: 2, reason: 'rise' })).toBe(
      'Fluss steigt auf Stufe 2',
    );
    expect(en({ type: 'levelChanged', zone: 'river', from: 2, to: 1, reason: 'disturbance' })).toBe(
      'River falls to level 1',
    );
    expect(
      de({ type: 'speciesEmerged', species: 'fish', ancestor: 'plankton', from: 'river', zone: 'river', first: true }),
    ).toBe('Neue Art: Fisch in Fluss');
    expect(
      de({ type: 'speciesEmerged', species: 'fish', ancestor: 'plankton', from: 'river', zone: 'river', first: false }),
    ).toBe('Fisch entsteht in Fluss');
    expect(de({ type: 'speciesExtinct', species: 'deer' })).toBe('Hirsch ist ausgestorben');
    expect(de({ type: 'giftAdded', species: 'fish', card: 'spawning_run', uid: 3 })).toBe(
      'Neue Karte im Deck: Laichzug',
    );
    expect(de({ type: 'hunger', zone: 'plains', species: 'deer' })).toBe('Hunger: Hirsch in Flachland');
    expect(de({ type: 'overpopulation', zone: 'plains', food: 'vegetation' })).toBe(
      'Überpopulation in Flachland: Vegetation leergefressen',
    );
    expect(de({ type: 'overpopulation', zone: 'plains', food: 'deer' })).toBe(
      'Überpopulation in Flachland: Hirsch leergefressen',
    );
    expect(de({ type: 'migrated', species: 'deer', from: 'plains', to: 'forest', count: 1 })).toBe(
      '1 Hirsch wandert von Flachland nach Wald',
    );
    expect(en({ type: 'collapsed', round: 9 })).toBe('The world collapses (round 9)');
    expect(de({ type: 'statChanged', zone: 'forest', stat: 'light', from: 1, to: 2, cause: 'x' })).toBeNull();
    expect(de({ type: 'scored', points: 2, total: 2, doubled: false })).toBeNull();
    // Unbekannte Ids bleiben als Id stehen.
    expect(de({ type: 'speciesExtinct', species: 'dragon' })).toBe('dragon ist ausgestorben');
    expect(de({ type: 'hunger', zone: 'moon', species: 'deer' })).toBe('Hunger: Hirsch in moon');
    expect(de({ type: 'triggered', card: 'x', trigger: 'y', zone: 'forest', disturbance: false })).toBe('⚡ y in Wald');
  });
});

describe('Pipeline-Module direkt', () => {
  it('event tut nichts ohne passende Ankündigung; forecast ersetzt eine abgelaufene Ankündigung', () => {
    const d = always(['heatwave']);
    const s = game({ d });
    announce(s, 'locusts', null, 1, s.round + 1);
    expect(runRules(s, ['event'], d)).toEqual([]);
    expect(runRules(s, ['forecast'], d)).toEqual([]); // verschoben: bleibt stehen
    announce(s, 'locusts', null, 1, s.round - 1);
    const events = runRules(s, ['forecast'], d);
    expect(events).toEqual([{ type: 'eventForecast', event: 'heatwave', round: s.round + 1, zone: null, strength: 1 }]);
  });
});

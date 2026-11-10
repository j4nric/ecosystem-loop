/** Konzept 6.2: Karten, Kosten, Schwellen (Grenzfälle), Ziele und Effekte. */
import { describe, expect, it } from 'vitest';
import { applyEffect } from '../src/cards/effects.ts';
import { cardText } from '../src/cards/text.ts';
import { legalPlays, view } from '../src/game.ts';
import type { GameEvent } from '../src/state.ts';
import { data, dataWith, game, play, rest, setPops, setStats, zone } from './helpers.ts';

const triggered = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'triggered' ? [e.trigger] : []));

describe('Kosten in Odem (Konzept 6.1/6.2)', () => {
  it('Karten kosten laut Kategorie: Naturgewalten 0, Gaben 1–2, Wunder 3–5, Arten und Menschen 0–2', () => {
    const range = { force: [0, 0], gift: [1, 2], miracle: [3, 5], species: [0, 2], human: [0, 2] } as const;
    for (const c of data.cards.values()) {
      const [lo, hi] = range[c.category as keyof typeof range];
      expect(c.cost, c.id).toBeGreaterThanOrEqual(lo);
      expect(c.cost, c.id).toBeLessThanOrEqual(hi);
    }
  });

  it('Ausspielen zieht die Kosten ab; nicht bezahlbare Karten sind keine legalen Züge', () => {
    const s = game({ hand: ['healing', 'rain'], breath: 4 });
    expect(new Set(legalPlays(data, s).map((p) => p.card))).toEqual(new Set(['healing', 'rain']));
    const { state, events } = play(s, 'healing', { zone: 'forest' });
    expect(state.breath).toBe(0);
    expect(events).toContainEqual({ type: 'breathChanged', from: 4, to: 0, cause: 'card:healing' });
    expect(legalPlays(data, state)).toEqual([]);
  });

  it('gespielte Karten landen auf der Ablage und werden gezählt', () => {
    const s = game({ hand: ['rain'], breath: 1 });
    const { state } = play(s, 'rain', { zone: 'coast' });
    expect(state.hand).toEqual([]);
    expect(state.discardPile.map((c) => c.card)).toEqual(['rain']);
    expect(state.cardPlays).toEqual({ rain: 1 });
    expect(state.playsThisTurn).toBe(1);
  });
});

describe('Gewitter: Feuer und Flut', () => {
  it('Feuer bei Feuchte ≤ 1 (Grenze 1) mit Vegetation: Vegetation 0, Totholz +3, Störung', () => {
    const s = game({ hand: ['thunderstorm'] });
    s.round = 4;
    setStats(s, 'forest', { moisture: 1, vegetation: 4, deadwood: 1 });
    const { state, events } = play(s, 'thunderstorm', { zone: 'forest' });
    expect(zone(state, 'forest').stats).toMatchObject({ moisture: 3, vegetation: 0, deadwood: 4 });
    expect(triggered(events)).toEqual(['fire']);
    expect(zone(state, 'forest').lastDisturbance).toBe(4);
    expect(events).toContainEqual({ type: 'disturbance', zone: 'forest', cause: 'trigger:thunderstorm.fire' });
  });

  it('kein Feuer bei Feuchte 2 oder ohne Vegetation', () => {
    const s = game({ hand: ['thunderstorm', 'thunderstorm'] });
    setStats(s, 'forest', { moisture: 2 });
    setStats(s, 'plains', { moisture: 0, vegetation: 0 });
    const a = play(s, 'thunderstorm', { zone: 'forest' });
    expect(triggered(a.events)).toEqual([]);
    expect(zone(a.state, 'forest').stats.moisture).toBe(4);
    const b = play(a.state, 'thunderstorm', { zone: 'plains' });
    expect(triggered(b.events)).toEqual([]);
    expect(zone(b.state, 'plains').lastDisturbance).toBeNull();
  });

  it('Flut bei Feuchte ≥ 4 (Grenze 4, nicht 3): Vegetation −1, Nachbarn Feuchte +1', () => {
    const s = game({ hand: ['thunderstorm', 'thunderstorm'] });
    setStats(s, 'plains', { moisture: 4, vegetation: 3 });
    const { state, events } = play(s, 'thunderstorm', { zone: 'plains' });
    expect(triggered(events)).toEqual(['deluge']);
    expect(zone(state, 'plains').stats).toMatchObject({ moisture: 5, vegetation: 2 });
    expect(zone(state, 'coast').stats.moisture).toBe(rest('coast').moisture! + 1);
    expect(zone(state, 'forest').stats.moisture).toBe(rest('forest').moisture! + 1);
    expect(zone(state, 'mountains').stats.moisture).toBe(rest('mountains').moisture);

    setStats(state, 'coast', { moisture: 3 });
    expect(triggered(play(state, 'thunderstorm', { zone: 'coast' }).events)).toEqual([]);
  });

  it('Reihenfolge zählt: Dürre → Gewitter brennt, Gewitter → Dürre nicht', () => {
    const a = game({ hand: ['drought', 'thunderstorm'] });
    setStats(a, 'forest', { moisture: 3, vegetation: 4 });
    const a2 = play(play(a, 'drought', { zone: 'forest' }).state, 'thunderstorm', { zone: 'forest' });
    expect(zone(a2.state, 'forest').stats.vegetation).toBe(0);

    const b = game({ hand: ['drought', 'thunderstorm'] });
    setStats(b, 'forest', { moisture: 3, vegetation: 4 });
    const b2 = play(play(b, 'thunderstorm', { zone: 'forest' }).state, 'drought', { zone: 'forest' });
    expect(zone(b2.state, 'forest').stats.vegetation).toBe(4);
  });
});

describe('Dürre, Sturm, Frost', () => {
  it('Dürre: Feuchte −2, Wasserstand −1 (nur am Fluss); Welke wird NACH dem Effekt geprüft', () => {
    const s = game({ hand: ['drought', 'drought'] });
    const a = play(s, 'drought', { zone: 'river' });
    expect(zone(a.state, 'river').stats).toMatchObject({ moisture: 3, water: 2 });
    expect(triggered(a.events)).toEqual([]);
    setStats(a.state, 'plains', { moisture: 2, vegetation: 3 });
    const b = play(a.state, 'drought', { zone: 'plains' });
    expect(triggered(b.events)).toEqual(['wilting']);
    expect(zone(b.state, 'plains').stats).toMatchObject({ moisture: 0, vegetation: 2 });
  });

  it('Sturm: Baumsturz bei Vegetation ≥ 4 (nicht 3) trifft die gewählte Nachbarzone', () => {
    const s = game({ hand: ['storm', 'storm'] });
    s.round = 2;
    setStats(s, 'forest', { vegetation: 4, light: 2, deadwood: 2 });
    setStats(s, 'plains', { vegetation: 3 });
    const { state, events } = play(s, 'storm', { zone: 'forest', fall: 'plains' });
    expect(triggered(events)).toEqual(['windthrow']);
    expect(zone(state, 'forest').stats).toMatchObject({ vegetation: 3, light: 4, deadwood: 3 });
    expect(zone(state, 'plains').stats.vegetation).toBe(2);
    expect(zone(state, 'forest').lastDisturbance).toBe(2);

    const b = play(state, 'storm', { zone: 'forest', fall: 'river' });
    expect(triggered(b.events)).toEqual([]);
  });

  it('Sturm verlangt eine echte Nachbarzone', () => {
    const s = game({ hand: ['storm'] });
    expect(() => play(s, 'storm', { zone: 'mountains', fall: 'coast' })).toThrow(/Ungültiges Ziel/);
    const targets = legalPlays(data, s).map((p) => p.targets);
    expect(targets).toContainEqual({ zone: 'mountains', fall: 'river' });
    expect(targets).toHaveLength(2 + 3 + 3 + 4 + 2);
  });

  it('Frost: Vegetation −1, Schnee +1; Eisbruch bei Feuchte ≥ 4', () => {
    const s = game({ hand: ['frost', 'frost'] });
    const a = play(s, 'frost', { zone: 'mountains' });
    expect(zone(a.state, 'mountains').stats).toMatchObject({ vegetation: 0, snow: 4 });
    expect(triggered(a.events)).toEqual([]);
    setStats(a.state, 'forest', { moisture: 4, vegetation: 5, deadwood: 2 });
    const b = play(a.state, 'frost', { zone: 'forest' });
    expect(triggered(b.events)).toEqual(['ice_break']);
    expect(zone(b.state, 'forest').stats).toMatchObject({ vegetation: 3, deadwood: 3 });
    expect(zone(b.state, 'forest').lastDisturbance).toBeNull();
  });
});

describe('Gaben und Wunder', () => {
  it('Gaben ändern genau einen Wert um 1', () => {
    const cases: [string, string, string, number][] = [
      ['rain', 'forest', 'moisture', 1],
      ['dry_wind', 'forest', 'moisture', -1],
      ['sun', 'forest', 'light', 1],
      ['shade', 'forest', 'light', -1],
      ['seeds', 'forest', 'vegetation', 1],
      ['fertilizer', 'plains', 'soil', 1],
      ['snowfall', 'mountains', 'snow', 1],
      ['spring_water', 'river', 'water', 1],
      ['low_tide', 'coast', 'salt', -1],
      ['leaf_fall', 'forest', 'deadwood', 1],
    ];
    for (const [card, zid, stat, by] of cases) {
      const s = game({ hand: [card], breath: 5 });
      const { state, events } = play(s, card, { zone: zid });
      expect(zone(state, zid).stats[stat], card).toBe(rest(zone(s, zid).geography)[stat]! + by);
      expect(
        events.filter((e) => e.type === 'statChanged'),
        card,
      ).toHaveLength(1);
    }
  });

  it('Gaben für Sonderwerte zielen nur auf Zonen mit diesem Wert', () => {
    const s = game({ hand: ['fertilizer', 'snowfall'], breath: 5 });
    const zones = (card: string) =>
      legalPlays(data, s)
        .filter((p) => p.card === card)
        .map((p) => p.targets.zone);
    expect(zones('fertilizer')).toEqual(['plains']);
    expect(zones('snowfall')).toEqual(['mountains']);
    expect(() => play(s, 'fertilizer', { zone: 'forest' })).toThrow(/Ungültiges Ziel/);
  });

  it('Heilung setzt die Zone auf ihre Ruhewerte', () => {
    const s = game({ hand: ['healing'], breath: 4 });
    setStats(s, 'coast', { light: 0, moisture: 0, vegetation: 5, salt: 5 });
    expect(zone(play(s, 'healing', { zone: 'coast' }).state, 'coast').stats).toEqual(rest('coast'));
  });

  it('Ausgleich bewegt Zone und Nachbarn um 1 zum Ruhewert', () => {
    const s = game({ hand: ['balance'], breath: 3 });
    setStats(s, 'coast', { light: 0 });
    setStats(s, 'river', { water: 5 });
    setStats(s, 'mountains', { snow: 0 });
    const { state } = play(s, 'balance', { zone: 'coast' });
    expect(zone(state, 'coast').stats.light).toBe(1);
    expect(zone(state, 'river').stats.water).toBe(4);
    expect(zone(state, 'mountains').stats.snow).toBe(0);
  });

  it('Eingebung zieht 2 Karten (mischt die Ablage, wenn nötig)', () => {
    const s = game({ hand: ['inspiration'], draw: ['rain'], breath: 3 });
    s.discardPile = [{ uid: 1, card: 'sun' }];
    const { state, events } = play(s, 'inspiration');
    expect(state.hand.map((c) => c.card).sort()).toEqual(['rain', 'sun']);
    expect(events.some((e) => e.type === 'deckReshuffled')).toBe(true);
  });

  it('Segen: Vegetation +1 auf allen Zonen', () => {
    const s = game({ hand: ['blessing'], breath: 5 });
    const { state } = play(s, 'blessing');
    for (const z of state.zones) expect(z.stats.vegetation).toBe(rest(z.geography).vegetation! + 1);
  });
});

describe('Effektsprache', () => {
  const ctx = (s = game()) => ({
    data,
    state: s,
    emit: () => {},
    bind: { self: 'forest', source: 'river' },
    cause: 't',
  });

  it('set, restore eines Werts in Schritten, Wert fehlt ⇒ nichts', () => {
    const c = ctx();
    applyEffect(c, { set: 'light', value: 9, at: 'self', scope: 'self' });
    expect(zone(c.state, 'forest').stats.light).toBe(5);
    applyEffect(c, { restore: 'light', steps: 2, at: 'self', scope: 'self' });
    expect(zone(c.state, 'forest').stats.light).toBe(3);
    applyEffect(c, { restore: 'light', at: 'self', scope: 'self' });
    expect(zone(c.state, 'forest').stats.light).toBe(2);
    applyEffect(c, { adjust: 'salt', by: 1, at: 'self', scope: 'self' });
    applyEffect(c, { restore: 'salt', at: 'self', scope: 'self' });
    expect(zone(c.state, 'forest').stats.salt).toBeUndefined();
  });

  it('transfer verschiebt höchstens, was die Quelle hat; ohne Zielwert nichts', () => {
    const c = ctx();
    setStats(c.state, 'river', { water: 1 });
    applyEffect(c, { transfer: 'water', into: 'deadwood', amount: 3, from: 'source', at: 'self' });
    expect(zone(c.state, 'river').stats.water).toBe(0);
    expect(zone(c.state, 'forest').stats.deadwood).toBe(3);
    applyEffect(c, { transfer: 'water', into: 'salt', amount: 3, from: 'source', at: 'self' });
    expect(zone(c.state, 'forest').stats.salt).toBeUndefined();
  });

  it('breath-Effekt: Odem bis zur Obergrenze', () => {
    const c = ctx();
    c.state.breath = 9;
    applyEffect(c, { breath: 5 });
    expect(c.state.breath).toBe(10);
    applyEffect(c, { breath: 0 });
    expect(c.state.breath).toBe(10);
  });

  it('ungebundenes Ziel ist ein Fehler', () => {
    expect(() => applyEffect(ctx(), { adjust: 'light', by: 1, at: 'nope', scope: 'self' })).toThrow(/nicht gebunden/);
  });
});

describe('Gaben der Arten und Menschenkarten (Konzept 5.3, 5.4)', () => {
  const targetsOf = (s: ReturnType<typeof game>, card: string, d = data) =>
    legalPlays(d, s)
      .filter((p) => p.card === card)
      .map((p) => p.targets);

  it('Jagd: Art-Slot bietet nur Pflanzenfresser, die in der Zone leben; Bestand −2', () => {
    const s = game({ hand: ['hunt'], breath: 5, life: false });
    setPops(s, 'forest', { deer: 3, beetle: 4, wolf: 1 });
    expect(targetsOf(s, 'hunt')).toEqual([{ zone: 'forest', prey: 'deer' }]);
    const { state, events } = play(s, 'hunt', { zone: 'forest', prey: 'deer' });
    expect(zone(state, 'forest').populations.deer).toBe(1);
    expect(events).toContainEqual({
      type: 'populationChanged',
      zone: 'forest',
      species: 'deer',
      from: 3,
      to: 1,
      cause: 'card:hunt',
    });
    expect(() => play(s, 'hunt', { zone: 'forest', prey: 'beetle' })).toThrow(/Ungültiges Ziel/);
    const v = view(data, s, 'de').hand[0]!;
    expect(v.slots).toEqual([
      { id: 'zone', kind: 'zone', label: 'Zone' },
      { id: 'prey', kind: 'species', label: 'Pflanzenfresser' },
    ]);
    expect(v.text).toBe('Bestand Pflanzenfresser −2');
  });

  it('Art-Slot mit Nahrungsfilter (eats)', () => {
    const d = dataWith((r) => {
      const hunt = r.cards.cards.find((c: { id: string }) => c.id === 'hunt');
      hunt.slots[1] = { id: 'prey', kind: 'species', in: 'zone', eats: 'plankton' };
    });
    const s = game({ hand: ['hunt'], breath: 5, life: false, d });
    setPops(s, 'river', { plankton: 3, fish: 2 });
    expect(targetsOf(s, 'hunt', d)).toEqual([{ zone: 'river', prey: 'fish' }]);
    expect(cardText(d, d.cards.get('hunt')!, 'en')).toBe('Species population −2');
  });

  it('Laichzug: 1 Fisch wandert in eine Nachbarzone mit Wasser', () => {
    const s = game({ hand: ['spawning_run'], breath: 1, life: false });
    setPops(s, 'river', { fish: 3 });
    expect(targetsOf(s, 'spawning_run')).toEqual([{ zone: 'river', target: 'coast' }]);
    const { state, events } = play(s, 'spawning_run', { zone: 'river', target: 'coast' });
    expect(zone(state, 'river').populations.fish).toBe(2);
    expect(zone(state, 'coast').populations.fish).toBe(1);
    expect(events).toContainEqual({ type: 'migrated', species: 'fish', from: 'river', to: 'coast', count: 1 });
    expect(cardText(data, data.cards.get('spawning_run')!, 'de')).toBe(
      'Nur Fisch ≥ 1 und (Zone mit Wasserstand oder Zone mit Salz): 1 Fisch wandert (Wohin)',
    );
  });

  it('Siedlung nur, wo Menschen leben: Mensch-Bestand +2', () => {
    const s = game({ hand: ['settlement'], breath: 2, life: false });
    expect(targetsOf(s, 'settlement')).toEqual([]);
    setPops(s, 'plains', { human: 2 });
    expect(targetsOf(s, 'settlement')).toEqual([{ zone: 'plains' }]);
    const { state } = play(s, 'settlement', { zone: 'plains' });
    expect(zone(state, 'plains').populations.human).toBe(4);
    expect(state.species.human).toEqual({ since: 0, extinct: null });
  });

  it('Feuer: Brandrodung (Störung), Ackerbau: Boden −1, Vegetation +2', () => {
    const s = game({ hand: ['fire', 'farming'], breath: 1, life: false });
    const fired = play(s, 'fire', { zone: 'plains' });
    expect(zone(fired.state, 'plains').stats).toMatchObject({ vegetation: 0, soil: 4 });
    expect(zone(fired.state, 'plains').lastDisturbance).toBe(1);
    expect(fired.events).toContainEqual({ type: 'disturbance', zone: 'plains', cause: 'trigger:fire.slash_and_burn' });
    const farmed = play(fired.state, 'farming', { zone: 'plains' });
    expect(zone(farmed.state, 'plains').stats).toMatchObject({ vegetation: 2, soil: 3 });
    expect(targetsOf(farmed.state, 'fire').map((t) => t.zone)).not.toContain('plains'); // nichts mehr zu brennen
  });

  it('Bestände per Effekt bleiben in 0–9; Wandern ohne Tiere bewirkt nichts', () => {
    const s = game({ life: false });
    const events: GameEvent[] = [];
    const ctx = {
      data,
      state: s,
      emit: (e: GameEvent) => events.push(e),
      bind: { a: 'river', b: 'coast' },
      cause: 't',
    };
    applyEffect(ctx, { population: 'fish', by: 12, at: 'a', scope: 'self' });
    expect(zone(s, 'river').populations.fish).toBe(9);
    applyEffect(ctx, { population: 'fish', by: -12, at: 'a', scope: 'self' });
    expect(zone(s, 'river').populations.fish).toBeUndefined();
    applyEffect(ctx, { move: 'fish', amount: 2, from: 'a', at: 'b' });
    expect(events.filter((e) => e.type === 'migrated')).toEqual([]);
    expect(() => applyEffect(ctx, { population: 'dragon', by: 1, at: 'a', scope: 'self' })).toThrow(/Unbekannte Art/);
  });
});

/** Konzept 6.2: Karten, Kosten, Schwellen (Grenzfälle), Ziele und Effekte. */
import { describe, expect, it } from 'vitest';
import { applyEffect } from '../src/cards/effects.ts';
import { cardText } from '../src/cards/text.ts';
import { legalPlays, view } from '../src/game.ts';
import type { GameEvent } from '../src/state.ts';
import { data, dataWith, game, play, rest, setPops, setStats, zone } from './helpers.ts';

describe('Kosten in Odem (Konzept 6.1/6.2)', () => {
  it('Karten kosten laut Kategorie: Wetter 0–2, Gaben 1–2, Wunder 3–5, Arten und Menschen 0–2', () => {
    const range = {
      weather: [0, 2],
      gift: [1, 2],
      miracle: [3, 5],
      species: [0, 2],
      human: [0, 2],
    } as const;
    for (const c of data.cards.values()) {
      const [lo, hi] = range[c.category as keyof typeof range];
      expect(c.cost, c.id).toBeGreaterThanOrEqual(lo);
      expect(c.cost, c.id).toBeLessThanOrEqual(hi);
    }
    expect([...data.categories.keys()]).toEqual(['weather', 'gift', 'miracle', 'species', 'human']);
  });

  it('Naturgewalten sind kostenloses Wetter, Wettergaben kosten 1–2 Odem; alles Wetter wirkt auf die Welt', () => {
    const weather = [...data.cards.values()].filter((c) => c.category === 'weather');
    expect(weather.map((c) => c.id).sort()).toEqual(
      ['dry_wind', 'drought', 'frost', 'rain', 'snowfall', 'storm', 'sun', 'thunderstorm'].sort(),
    );
    for (const c of weather) expect(c.reach, c.id).toBe('world');
    for (const id of ['thunderstorm', 'drought', 'storm', 'frost']) expect(data.cards.get(id)!.cost, id).toBe(0);
    for (const id of ['rain', 'dry_wind', 'sun', 'snowfall']) {
      expect(data.cards.get(id)!.cost, id).toBeGreaterThanOrEqual(1);
      expect(data.cards.get(id)!.cost, id).toBeLessThanOrEqual(2);
    }
    // Örtliche Gaben bleiben gezielt.
    for (const id of ['shade', 'spring_water']) expect(data.cards.get(id)!.reach, id).toBe('zone');
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
    const { state } = play(s, 'rain', {});
    expect(state.hand).toEqual([]);
    expect(state.discardPile.map((c) => c.card)).toEqual(['rain']);
    expect(state.cardPlays).toEqual({ rain: 1 });
    expect(state.playsThisTurn).toBe(1);
  });
});

/** Auslösungen als „Schwelle@Zone“. */
const firedAt = (events: GameEvent[]) =>
  events.flatMap((e) => (e.type === 'triggered' ? [`${e.trigger}@${e.zone}`] : []));

describe('Gewitter (Weltkarte): Feuer und Flut je Zone', () => {
  it('Feuer im Wald bei Feuchte ≤ 1 (Grenze 1) mit Vegetation: Vegetation 0, Totholz +3, Störung', () => {
    const s = game({ hand: ['thunderstorm'] });
    s.round = 4;
    setStats(s, 'forest', { moisture: 1, vegetation: 4, deadwood: 1 });
    const { state, events } = play(s, 'thunderstorm');
    expect(zone(state, 'forest').stats).toMatchObject({ moisture: 3, vegetation: 0, deadwood: 4 });
    expect(firedAt(events)).toEqual(['fire@forest']);
    expect(zone(state, 'forest').lastDisturbance).toBe(4);
    expect(events).toContainEqual({ type: 'disturbance', zone: 'forest', cause: 'trigger:thunderstorm.fire' });
    // Grundwirkung überall: Feuchte +2, der Fluss schwillt an.
    expect(zone(state, 'plains').stats.moisture).toBe(rest('plains').moisture! + 2);
    expect(zone(state, 'river').stats.water).toBe(rest('river').water! + 1);
  });

  it('Feuer auch im Flachland; nicht bei Feuchte 2, ohne Vegetation oder in Bergen, Fluss und Küste', () => {
    const s = game({ hand: ['thunderstorm', 'thunderstorm'] });
    setStats(s, 'plains', { moisture: 0, vegetation: 3 });
    expect(firedAt(play(s, 'thunderstorm').events)).toEqual(['fire@plains']);

    setStats(s, 'plains', { moisture: 2, vegetation: 3 });
    setStats(s, 'forest', { moisture: 0, vegetation: 0 });
    for (const z of ['mountains', 'river', 'coast']) setStats(s, z, { moisture: 0, vegetation: 3 });
    const { state, events } = play(s, 'thunderstorm');
    expect(firedAt(events)).toEqual([]);
    for (const z of state.zones) expect(z.lastDisturbance, z.id).toBeNull();
  });

  it('Flut bei Feuchte ≥ 4 (Grenze 4, nicht 3) nur in Bergen und Flachland: Vegetation −1, Nachbarn Feuchte +1', () => {
    const s = game({ hand: ['thunderstorm', 'thunderstorm'] });
    setStats(s, 'plains', { moisture: 4, vegetation: 3 });
    setStats(s, 'coast', { moisture: 0 });
    setStats(s, 'mountains', { moisture: 0 });
    setStats(s, 'forest', { moisture: 4 }); // nasser Wald: keine Flut
    const { state, events } = play(s, 'thunderstorm');
    // Fluss (Feuchte 5) und Wald lösen nicht aus.
    expect(firedAt(events)).toEqual(['deluge@plains']);
    expect(zone(state, 'plains').stats).toMatchObject({ moisture: 5, vegetation: 2 });
    // Küste: +2 Gewitter, +1 Flut aus dem Flachland; Berge sind kein Nachbar: nur +2.
    expect(zone(state, 'coast').stats.moisture).toBe(3);
    expect(zone(state, 'mountains').stats.moisture).toBe(2);
    expect(zone(state, 'plains').lastDisturbance).toBe(state.round);

    const b = game({ hand: ['thunderstorm'] });
    setStats(b, 'plains', { moisture: 3 });
    setStats(b, 'mountains', { moisture: 4, vegetation: 2 });
    expect(firedAt(play(b, 'thunderstorm').events)).toEqual(['deluge@mountains']);
  });

  it('Reihenfolge zählt: Dürre → Gewitter brennt, Gewitter → Dürre nicht', () => {
    const a = game({ hand: ['drought', 'thunderstorm'] });
    setStats(a, 'forest', { moisture: 2, vegetation: 4 });
    const a2 = play(play(a, 'drought').state, 'thunderstorm');
    expect(zone(a2.state, 'forest').stats.vegetation).toBe(0);

    const b = game({ hand: ['drought', 'thunderstorm'] });
    setStats(b, 'forest', { moisture: 2, vegetation: 4 });
    const b2 = play(play(b, 'thunderstorm').state, 'drought');
    expect(zone(b2.state, 'forest').stats.vegetation).toBe(4);
  });
});

describe('Dürre, Sturm, Frost (Weltkarten)', () => {
  it('Dürre: überall Feuchte −1, je Geografie Schnee, Totholz, Wasserstand, Salz; Welke NACH dem Effekt', () => {
    const s = game({ hand: ['drought', 'drought'] });
    const a = play(s, 'drought');
    expect(zone(a.state, 'river').stats).toMatchObject({ moisture: 4, water: 2 });
    expect(zone(a.state, 'forest').stats).toMatchObject({ moisture: 2, deadwood: 3 });
    expect(zone(a.state, 'coast').stats).toMatchObject({ moisture: 2, salt: 4 });
    expect(zone(a.state, 'mountains').stats).toMatchObject({ moisture: 1, snow: 2 });
    expect(firedAt(a.events)).toEqual([]);
    setStats(a.state, 'plains', { moisture: 1, vegetation: 3 });
    const b = play(a.state, 'drought');
    // Berge (1 → 0) und Flachland (1 → 0) welken, sonst niemand.
    expect(firedAt(b.events)).toEqual(['wilting@mountains', 'wilting@plains']);
    expect(zone(b.state, 'plains').stats).toMatchObject({ moisture: 0, vegetation: 2 });
  });

  it('Sturm: Wald Vegetation −1 und Totholz +1, Küste Salz +1, Berge Schnee −1; Baumsturz bei Vegetation ≥ 5', () => {
    const s = game({ hand: ['storm', 'storm'] });
    s.round = 2;
    setStats(s, 'forest', { vegetation: 5, light: 2, deadwood: 2 });
    setStats(s, 'plains', { vegetation: 5 }); // Buschland: kein Baumsturz
    const { state, events } = play(s, 'storm');
    expect(firedAt(events)).toEqual(['windthrow@forest']);
    expect(zone(state, 'forest').stats).toMatchObject({ vegetation: 4, light: 4, deadwood: 4 });
    expect(zone(state, 'forest').lastDisturbance).toBe(2);
    expect(zone(state, 'plains').stats.vegetation).toBe(5);
    expect(zone(state, 'coast').stats.salt).toBe(rest('coast').salt! + 1);
    expect(zone(state, 'mountains').stats.snow).toBe(rest('mountains').snow! - 1);

    // Wald mit Vegetation 4 (Grenze): kein Baumsturz; Bergwald mit Vegetation 5 dagegen schon.
    setStats(state, 'mountains', { vegetation: 5 });
    expect(firedAt(play(state, 'storm').events)).toEqual(['windthrow@mountains']);
  });

  it('Frost: Berge Schnee +1, Flachland Vegetation −1 und Boden +1, Fluss −1; Eisbruch nur im nassen Wald', () => {
    const s = game({ hand: ['frost', 'frost'] });
    const a = play(s, 'frost');
    expect(zone(a.state, 'mountains').stats).toMatchObject({ vegetation: 1, snow: 4 });
    expect(zone(a.state, 'plains').stats).toMatchObject({ vegetation: 2, soil: 4 });
    expect(zone(a.state, 'river').stats.water).toBe(2);
    expect(zone(a.state, 'forest').stats).toEqual(rest('forest'));
    // Fluss hat Feuchte 5: trotzdem kein Eisbruch dort.
    expect(firedAt(a.events)).toEqual([]);
    setStats(a.state, 'forest', { moisture: 4, vegetation: 5, deadwood: 2 });
    const b = play(a.state, 'frost');
    expect(firedAt(b.events)).toEqual(['ice_break@forest']);
    expect(zone(b.state, 'forest').stats).toMatchObject({ vegetation: 4, deadwood: 3 });
    expect(zone(b.state, 'forest').lastDisturbance).toBeNull();
  });
});

describe('Gaben und Wunder', () => {
  it('Gaben ändern genau einen Wert um 1', () => {
    const cases: [string, string, string, number][] = [
      ['shade', 'forest', 'light', -1],
      ['seeds', 'forest', 'vegetation', 1],
      ['fertilizer', 'plains', 'soil', 1],
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
    const s = game({ hand: ['fertilizer', 'spring_water'], breath: 5 });
    const zones = (card: string) =>
      legalPlays(data, s)
        .filter((p) => p.card === card)
        .map((p) => p.targets.zone);
    expect(zones('fertilizer')).toEqual(['plains']);
    expect(zones('spring_water')).toEqual(['river']);
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
      { id: 'prey', kind: 'species', label: 'Pflanzenfresser', of: 'zone' },
    ]);
    expect(v.text).toBe('Bestand Pflanzenfresser −2.');
  });

  it('Art-Slot mit Nahrungsfilter (eats)', () => {
    const d = dataWith((r) => {
      const hunt = r.cards.cards.find((c: { id: string }) => c.id === 'hunt');
      hunt.slots[1] = { id: 'prey', kind: 'species', in: 'zone', eats: 'plankton' };
    });
    const s = game({ hand: ['hunt'], breath: 5, life: false, d });
    setPops(s, 'river', { plankton: 3, fish: 2 });
    expect(targetsOf(s, 'hunt', d)).toEqual([{ zone: 'river', prey: 'fish' }]);
    expect(cardText(d, d.cards.get('hunt')!, 'en')).toBe('Species population −2.');
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
      '1 Fisch wandert nebenan. Nur wo Fisch lebt, mit Nachbarzone Fluss oder Küste.',
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

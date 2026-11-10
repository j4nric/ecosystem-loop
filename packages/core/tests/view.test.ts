/** GameView, Vorschau, Warnungen und erzeugte Texte. */
import { describe, expect, it } from 'vitest';
import { cardText, describeCondition, describeEffect } from '../src/cards/text.ts';
import { holds } from '../src/conditions.ts';
import { preview, view } from '../src/game.ts';
import type { Condition } from '../src/schema/index.ts';
import { data, dataWith, endTurn, game, play, setStats, uidOf, zone } from './helpers.ts';

describe('view', () => {
  it('liefert alle Felder von GameView (Phase-3-Felder leer)', () => {
    const s = game({ hand: ['thunderstorm', 'healing'], draw: ['rain'], breath: 3 });
    const v = view(data, s, 'de');
    expect(v).toMatchObject({
      locale: 'de',
      round: 1,
      year: 1,
      season: { id: 'spring', name: 'Frühling' },
      phase: 'play',
      harmony: { value: 60, max: 100, trend: 0 },
      breath: { value: 3, max: 10, nextIncome: 3 },
      score: 0,
      drawPile: 1,
      discardPile: 0,
      playsThisTurn: 0,
      minPlays: 1,
      canEndTurn: false,
      forecast: null,
      highestTier: 1,
    });
    expect(v.zones).toHaveLength(5);
    const forest = v.zones.find((z) => z.id === 'forest')!;
    expect(forest).toMatchObject({
      geography: 'forest',
      geographyName: 'Wald',
      form: { id: 'mixed_forest', name: 'Mischwald', kind: 'normal' },
      level: 1,
      levelProgress: 0,
      populations: [{ species: 'beetle', name: 'Käfer', tier: 1, count: 3 }],
      tags: [],
    });
    expect(v.zones.find((z) => z.id === 'mountains')!.populations).toEqual([]);
    expect(forest.stats.map((x) => x.id)).toEqual(['light', 'moisture', 'vegetation', 'deadwood']);
    expect(forest.stats[3]).toEqual({
      id: 'deadwood',
      name: 'Totholz',
      value: 2,
      max: 5,
      target: { min: 2, max: 3, status: 'ok' },
    });
    expect(forest.neighbors).toEqual(['mountains', 'river', 'plains']);
    expect(v.hand.map((c) => [c.card, c.category, c.cost, c.playable])).toEqual([
      ['thunderstorm', 'force', 0, true],
      ['healing', 'miracle', 4, false],
    ]);
    expect(v.hand[0]!.slots).toEqual([{ id: 'zone', kind: 'zone', label: 'Zone' }]);
  });

  it('Texte sind lokalisiert (de/en)', () => {
    const s = game({ hand: ['storm'] });
    const de = view(data, s, 'de');
    const en = view(data, s, 'en');
    expect(en.locale).toBe('en');
    expect(en.season.name).toBe('Spring');
    expect(en.zones[0]!.geographyName).toBe('Mountains');
    expect(en.zones[0]!.form.name).toBe('Rock');
    expect(de.hand[0]!.text).toContain('Baumsturz');
    expect(en.hand[0]!.text).toContain('Windthrow');
    expect(en.hand[0]!.slots[1]!.label).toBe('Direction of fall');
    expect(view(data, s).locale).toBe('de');
  });

  it('Stufenfortschritt und Jahr', () => {
    const s = game();
    s.round = 5;
    zone(s, 'forest').levelProgress = 1;
    const v = view(data, s);
    expect(v.year).toBe(2);
    expect(v.season.id).toBe('spring');
    expect(v.zones.find((z) => z.id === 'forest')!.levelProgress).toBeCloseTo(1 / 2);
    zone(s, 'forest').level = 3; // normale Form: Stufe 4 unerreichbar
    expect(view(data, s).zones.find((z) => z.id === 'forest')!.levelProgress).toBe(0);
  });

  it('Gefahren werden sichtbar: 🔥 auf trockenen Zonen, wenn Gewitter auf der Hand ist', () => {
    const s = game({ hand: ['thunderstorm', 'thunderstorm', 'rain'] });
    setStats(s, 'forest', { moisture: 1 });
    const v = view(data, s, 'de');
    expect(v.zones.find((z) => z.id === 'forest')!.warnings).toEqual([
      { card: 'thunderstorm', trigger: 'fire', name: 'Feuer', icon: '🔥' },
    ]);
    expect(v.zones.find((z) => z.id === 'river')!.warnings.map((w) => w.trigger)).toEqual(['deluge']);
    expect(v.zones.find((z) => z.id === 'plains')!.warnings).toEqual([]);
    // Welke prüft erst nach dem Effekt – kein Feld mit Feuchte ≤ 2 ⇒ keine Warnung
    const t = game({ hand: ['drought', 'inspiration'] });
    setStats(t, 'mountains', { moisture: 3 });
    expect(view(data, t).zones.every((z) => z.warnings.length === 0)).toBe(true);
  });

  it('Schwellen mit check "after" warnen anhand der Grundeffekte: Dürre auf Feuchte 2 ⇒ Welke', () => {
    const s = game({ hand: ['drought'] });
    setStats(s, 'plains', { moisture: 2 });
    setStats(s, 'forest', { moisture: 3 });
    const before = structuredClone(s);
    const v = view(data, s, 'de');
    expect(s).toEqual(before);
    expect(v.zones.find((z) => z.id === 'plains')!.warnings).toEqual([
      { card: 'drought', trigger: 'wilting', name: 'Welke', icon: '🥀' },
    ]);
    expect(v.zones.find((z) => z.id === 'forest')!.warnings).toEqual([]);
    // Sturm: Grundeffekte auf den zweiten Slot (Fallrichtung) bleiben bei der Warnung außen vor
    const t = game({ hand: ['storm'] });
    expect(() => view(data, t)).not.toThrow();
  });

  it('Formen ohne Daten werden mit ihrer Id angezeigt', () => {
    const s = game();
    zone(s, 'forest').form = 'mystery';
    expect(view(data, s).zones.find((z) => z.id === 'forest')!.form).toEqual({
      id: 'mystery',
      name: 'mystery',
      kind: 'normal',
    });
  });
});

describe('view: nächster Odem-Zufluss', () => {
  it('rechnet die Harmonie-Bilanz der Natur-Phase ein', () => {
    const s = game({ life: false });
    s.harmony = 74; // vor der Bilanz: 1 + ⌊74/25⌋ = 3
    // Frühling: Schneeschmelze und Wachstum machen die Berge zur Alm (ideal +2) ⇒ 76 ⇒ 4
    expect(view(data, s).breath.nextIncome).toBe(4);
    setStats(s, 'plains', { vegetation: 0, moisture: 0 }); // Ödland −3 ⇒ 73 ⇒ 3
    expect(view(data, s).breath.nextIncome).toBe(3);
  });

  it('ist auf max − aktueller Odem gekappt und 0 nach dem Kollaps', () => {
    const s = game({ life: false });
    s.breath = 9;
    expect(view(data, s).breath.nextIncome).toBe(1);
    s.breath = 10;
    expect(view(data, s).breath.nextIncome).toBe(0);
    s.breath = 0;
    s.harmony = 1;
    setStats(s, 'plains', { vegetation: 0, moisture: 0 }); // Ödland −3, Alm +2 ⇒ Kollaps, kein Zufluss
    expect(view(data, s).breath.nextIncome).toBe(0);
    s.phase = 'over';
    expect(view(data, s).breath.nextIncome).toBe(0);
  });

  it('stimmt mit dem tatsächlichen Zufluss beim Rundenende überein', () => {
    let s = game({ hand: ['thunderstorm'] });
    for (let i = 0; i < 12; i++) {
      s.hand = [];
      const expected = view(data, s).breath.nextIncome;
      const before = s.breath;
      s = endTurn(s).state;
      expect(s.breath - before, `Runde ${i + 1}`).toBe(expected);
    }
  });
});

describe('preview', () => {
  it('zeigt Wertänderungen, Schwellen und Formwechsel, ohne den Zustand zu verändern', () => {
    const s = game({ hand: ['thunderstorm'] });
    setStats(s, 'forest', { moisture: 1, vegetation: 4, deadwood: 1 });
    const before = structuredClone(s);
    const p = preview(data, s, { uid: uidOf(s, 'thunderstorm'), targets: { zone: 'forest' } }, 'en');
    expect(s).toEqual(before);
    expect(p.cost).toBe(0);
    expect(p.affordable).toBe(true);
    expect(p.triggers).toEqual([{ zone: 'forest', trigger: 'fire', name: 'Fire', icon: '🔥', zoneName: 'Forest' }]);
    expect(p.changes).toEqual([
      { zone: 'forest', stat: 'moisture', from: 1, to: 3, zoneName: 'Forest', statName: 'Moisture', toward: 'better' },
      {
        zone: 'forest',
        stat: 'vegetation',
        from: 4,
        to: 0,
        zoneName: 'Forest',
        statName: 'Vegetation',
        toward: 'worse',
      },
      // Totholz springt über den Zielbereich 2–3 hinweg: vorher 1 zu wenig, nachher 1 zu viel.
      { zone: 'forest', stat: 'deadwood', from: 1, to: 4, zoneName: 'Forest', statName: 'Deadwood', toward: 'neutral' },
    ]);
    // Urwald: Vegetation ≥4, Feuchte ≥4, Totholz 2–3 → vorher 0+3+1, nachher 4+1+1.
    expect(p.idealDistance).toEqual([{ zone: 'forest', before: 4, after: 6 }]);
    expect(p.populationChanges).toEqual([]);
    expect(p.eventChanges).toEqual([]);
    expect(p.formChanges).toEqual([
      {
        zone: 'forest',
        from: 'mixed_forest',
        to: 'burnt_land',
        zoneName: 'Forest',
        fromName: 'Mixed forest',
        toName: 'Burnt land',
        kind: 'degraded',
      },
    ]); // Form im Zustand: erst die Natur-Phase bestimmt sie neu
  });

  it('Vorschau auch für nicht bezahlbare Karten; Netto-Änderungen ohne Null-Wechsel', () => {
    const s = game({ hand: ['healing'], breath: 0 });
    setStats(s, 'coast', { salt: 5 });
    const p = preview(data, s, { uid: uidOf(s, 'healing'), targets: { zone: 'coast' } });
    expect(p.affordable).toBe(false);
    expect(p.cost).toBe(4);
    expect(p.changes).toEqual([
      { zone: 'coast', stat: 'salt', from: 5, to: 3, zoneName: 'Küste', statName: 'Salz', toward: 'better' },
    ]);
    expect(() => preview(data, s, { uid: 42, targets: {} })).toThrow(/nicht auf der Hand/);
  });
});

describe('Bedingungen und Texte', () => {
  const s = game();
  s.round = 2;
  zone(s, 'river').lastDisturbance = 1;
  const ctx = (id: string) => ({ data, state: s, zone: zone(s, id) });
  const cases: [Condition, string, boolean][] = [
    [{ stat: 'water', gte: 3, lte: 3 }, 'river', true],
    [{ stat: 'water', eq: 3 }, 'forest', false],
    [{ hasStat: 'water' }, 'river', true],
    [{ geography: 'river' }, 'forest', false],
    [{ form: 'stream' }, 'river', true],
    [{ formKind: 'normal' }, 'coast', true],
    [{ season: 'summer' }, 'coast', true],
    [{ disturbedWithin: 2 }, 'river', true],
    [{ disturbedWithin: 1 }, 'river', false],
    [{ disturbedWithin: 4 }, 'forest', false],
    [{ anyNeighbor: [{ geography: 'coast' }] }, 'plains', true],
    [{ anyNeighbor: [{ geography: 'coast' }] }, 'forest', false],
    [{ not: [{ geography: 'coast' }] }, 'forest', true],
    [{ any: [{ geography: 'coast' }, { geography: 'forest' }] }, 'forest', true],
  ];
  it.each(cases)('%j auf %s ⇒ %s', (c, id, expected) => {
    expect(holds(c, ctx(id))).toBe(expected);
  });

  it('jede Bedingung hat einen Text in beiden Sprachen', () => {
    for (const [c] of cases)
      for (const locale of ['de', 'en'] as const)
        expect(describeCondition(data, c, locale)).not.toMatch(/\{|undefined/);
    expect(describeCondition(data, { stat: 'water', gte: 3, lte: 4 }, 'de')).toBe('Wasserstand 3–4');
    expect(describeCondition(data, { any: [{ season: 'winter' }, { form: 'reef' }] }, 'en')).toBe(
      '(in Winter or form Reef)',
    );
    expect(describeCondition(data, { formKind: 'degraded' }, 'de')).toBe('Form verödet');
  });

  it('Effekttexte decken alle Effektarten ab', () => {
    const t = (e: Parameters<typeof describeEffect>[2]) => describeEffect(data, null, e, 'de');
    expect(t({ set: 'light', value: 2, at: 'self', scope: 'self' })).toBe('Licht auf 2');
    expect(t({ restore: 'salt', at: 'self', scope: 'self' })).toBe('Salz zurück zum Ruhewert');
    expect(t({ restore: 'salt', steps: 1, at: 'self', scope: 'self' })).toBe('Salz 1 Schritt zum Ruhewert');
    expect(t({ transfer: 'snow', into: 'water', amount: 1, from: 'source', at: 'self' })).toContain('Wasserstand');
    expect(t({ breath: 2 })).toBe('Odem +2');
    expect(t({ breath: -1 })).toBe('Odem −1');
    expect(t({ adjust: 'light', by: 0, at: 'self', scope: 'neighbors' })).toBe('Licht ±0 auf allen Nachbarzonen');
  });

  it('Kartentexte enthalten keine offenen Platzhalter', () => {
    for (const c of data.cards.values())
      for (const locale of ['de', 'en'] as const) expect(cardText(data, c, locale), c.id).not.toMatch(/\{\w+\}/);
  });

  it('fehlender Textbaustein ist ein Fehler, unbekannte Platzhalter bleiben stehen', () => {
    const d = dataWith((r) => {
      r.config.texts['effect.draw'] = { de: 'ziehe {x}', en: 'draw {x}' };
    });
    expect(cardText(d, d.cards.get('inspiration')!, 'de')).toBe('Ziehe {x}.');
    const broken = { ...data, config: { ...data.config, texts: {} } };
    expect(() => cardText(broken, data.cards.get('rain')!, 'de')).toThrow(/Textbaustein fehlt/);
  });

  it('Ereignis-Ursachen sind im Log nachvollziehbar', () => {
    const g = game({ hand: ['rain'], breath: 1 });
    const { events } = play(g, 'rain', { zone: 'forest' });
    expect(events).toContainEqual({
      type: 'statChanged',
      zone: 'forest',
      stat: 'moisture',
      from: 3,
      to: 4,
      cause: 'card:rain',
    });
  });
});

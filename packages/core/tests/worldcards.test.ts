/**
 * Konzept 6.2 (Variante C): Weltkarten – Wetter und Naturkräfte wirken ohne Zielwahl auf alle Zonen,
 * je Geografie unterschiedlich. Schema, Datenprüfung, Ausspielen, Schwellen je Zone, Reihenfolge der Zonen,
 * legalPlays/slotOptions/preview/view, Kartentext und Ereignisse.
 */
import { describe, expect, it } from 'vitest';
import { cardShort, cardText, SHORT_MAX } from '../src/cards/text.ts';
import { isWorldCard, worldGlobalEffects, worldZoneEffects } from '../src/cards/worldcard.ts';
import { legalPlays, newGame, preview, slotOptions, validateState, view } from '../src/game.ts';
import { occur } from '../src/rules/event.ts';
import { Card } from '../src/schema/index.ts';
import type { GameData } from '../src/schema/index.ts';
import type { GameEvent, GameState } from '../src/state.ts';
import { data, dataWith, game, play, setStats, uidOf, zone } from './helpers.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Rohdaten der Tests sind bewusst lose.
type Loose = any;

const name = { de: 'Testkarte', en: 'Test card' };

/** Daten mit zusätzlichen Karten (roh, wie in cards.yaml). */
function withCards(...cards: Loose[]): GameData {
  return dataWith((r) => r.cards.cards.push(...cards.map((c) => ({ name, category: 'weather', cost: 0, ...c }))));
}

/** Prüft, dass die Datenprüfung mit `msg` scheitert. */
function rejects(card: Loose, msg: RegExp, patch: (r: Loose) => void = () => {}) {
  expect(() =>
    dataWith((r) => {
      r.cards.cards.push({ id: 'bad', name, category: 'weather', cost: 0, ...card });
      patch(r);
    }),
  ).toThrow(msg);
}

/** Werte aller Zonen als Zone → Werte. */
const statsById = (s: GameState) => Object.fromEntries(s.zones.map((z) => [z.id, { ...z.stats }]));

describe('Schema: Reichweite', () => {
  it('reach ist standardmäßig zone, byGeography leer', () => {
    const c = Card.parse({ id: 'x', name, category: 'gift', cost: 1, effects: [] });
    expect(c.reach).toBe('zone');
    expect(c.byGeography).toEqual({});
    expect(isWorldCard(c)).toBe(false);
    expect(isWorldCard({ reach: 'world' })).toBe(true);
  });

  it('Weltkarte: Effekte und Schwellen binden die Zone als "self" (Standard)', () => {
    const c = Card.parse({
      id: 'x',
      name,
      category: 'weather',
      cost: 0,
      reach: 'world',
      effects: [{ adjust: 'light', by: 1 }, { draw: 1 }],
      byGeography: { forest: [{ adjust: 'moisture', by: 1 }] },
      triggers: [{ id: 't', name, icon: '!', when: [{ stat: 'light', gte: 5 }], effects: [{ disturb: true }] }],
    });
    expect(c.effects[0]).toMatchObject({ at: 'self', scope: 'self' });
    expect(c.triggers[0]!.at).toBe('self');
    expect(worldZoneEffects(c, 'forest')).toEqual([
      { adjust: 'light', by: 1, at: 'self', scope: 'self' },
      { adjust: 'moisture', by: 1, at: 'self', scope: 'self' },
    ]);
    expect(worldZoneEffects(c, 'coast')).toHaveLength(1);
    expect(worldGlobalEffects(c)).toEqual([{ draw: 1 }]);
    expect(() => Card.parse({ ...c, reach: 'island' })).toThrow();
    expect(() => Card.parse({ ...c, byGeography: { forest: [] } })).toThrow();
  });

  it('Regen ist eine Weltkarte der Kategorie Wetter', () => {
    const rain = data.cards.get('rain')!;
    expect(rain).toMatchObject({ reach: 'world', category: 'weather', slots: [] });
    expect(data.categories.get('weather')!.name).toEqual({ de: 'Wetter', en: 'Weather' });
    expect(Object.keys(rain.byGeography).sort()).toEqual(['coast', 'forest', 'mountains', 'plains', 'river']);
  });
});

describe('Datenprüfung für Weltkarten', () => {
  it('gültige Weltkarte mit Wahl, gemeinsamen Effekten, Ausstrahlung und Schwelle', () => {
    const d = withCards({
      id: 'ok',
      reach: 'world',
      slots: [
        {
          id: 'mode',
          kind: 'choice',
          options: [
            { id: 'a', label: name, effects: [{ adjust: 'light', by: 1 }] },
            { id: 'b', label: name, effects: [{ breath: 1 }] },
          ],
        },
      ],
      effects: [{ adjust: 'vegetation', by: 1 }, { draw: 1 }],
      byGeography: { mountains: [{ adjust: 'water', by: 1, scope: 'neighbors' }] },
      triggers: [
        { id: 't', name, icon: '!', when: [{ geography: 'forest' }], effects: [{ set: 'deadwood', value: 0 }] },
      ],
    });
    expect(d.cards.get('ok')!.reach).toBe('world');
  });

  it.each([
    ['Zonen-Slot', { slots: [{ id: 'zone', kind: 'zone' }] }, /Weltkarte darf keinen zone-Slot haben/],
    [
      'Wahl-Slot "self"',
      {
        slots: [
          {
            id: 'self',
            kind: 'choice',
            options: [1, 2].map((i) => ({ id: `o${i}`, label: name, effects: [{ draw: 1 }] })),
          },
        ],
      },
      /Slot-Id self ist für die Zone reserviert/,
    ],
    ['unbekannte Geografie', { byGeography: { desert: [{ adjust: 'light', by: 1 }] } }, /unbekannte Geografie desert/],
    [
      'Wert fehlt in der Geografie',
      { byGeography: { forest: [{ adjust: 'snow', by: 1 }] } },
      /Wert snow gibt es nicht in forest/,
    ],
    [
      'Sonderwert als gemeinsamer Effekt',
      { effects: [{ adjust: 'salt', by: -1 }] },
      /Wert salt gibt es nicht in mountains/,
    ],
    ['unbekannter Wert', { byGeography: { forest: [{ adjust: 'lava', by: 1 }] } }, /unbekannter Wert lava/],
    [
      'Ausstrahlung erreicht den Wert nicht',
      { byGeography: { mountains: [{ adjust: 'salt', by: 1, scope: 'neighbors' }] } },
      /Wert salt erreicht keine Zone/,
    ],
    [
      'nicht reihenfolgefeste Ausstrahlung',
      { byGeography: { forest: [{ set: 'moisture', value: 1, scope: 'neighbors' }] } },
      /set mit scope neighbors ist auf Weltkarten nicht reihenfolgefest/,
    ],
    [
      'nicht reihenfolgefeste Ausstrahlung einer Schwelle',
      {
        triggers: [
          { id: 't', name, icon: '!', when: [{ stat: 'light', gte: 1 }], effects: [{ restore: 'all', scope: 'all' }] },
        ],
      },
      /Schwelle t: restore mit scope all ist auf Weltkarten nicht reihenfolgefest/,
    ],
    [
      'zonenloser Effekt je Geografie',
      { byGeography: { forest: [{ draw: 1 }] } },
      /gehört in effects, nicht byGeography/,
    ],
    [
      'Effektziel ist ein Slot',
      { effects: [{ adjust: 'light', by: 1, at: 'zone' }] },
      /Effektziel zone ist keine gebundene Zone/,
    ],
    [
      'Schwelle mit Slot',
      {
        triggers: [
          { id: 't', name, icon: '!', at: 'zone', when: [{ stat: 'light', gte: 1 }], effects: [{ disturb: true }] },
        ],
      },
      /Schwellen von Weltkarten gelten je Zone/,
    ],
  ])('%s', (_label, card, msg) => rejects({ reach: 'world', ...card }, msg));

  it('byGeography nur auf Weltkarten', () => {
    rejects(
      { slots: [{ id: 'zone', kind: 'zone' }], effects: [], byGeography: { forest: [{ adjust: 'light', by: 1 }] } },
      /byGeography gibt es nur für Weltkarten/,
    );
  });

  it('Ereignis mit Weltkarte: ohne Wahl, Ziel nur zufällig oder keins', () => {
    const choice = {
      id: 'mode',
      kind: 'choice',
      options: [1, 2].map((i) => ({ id: `o${i}`, label: name, effects: [{ draw: 1 }] })),
    };
    rejects({ reach: 'world', slots: [choice] }, /Weltkarte bad darf keine Wahl haben/, (r) => {
      r.events.events[0].card = 'bad';
    });
    rejects({ reach: 'world' }, /Weltkarte braucht target.pick: random oder kein target/, (r) => {
      const plague = r.events.events.find((e: Loose) => e.id === 'plague');
      plague.card = 'bad';
    });
  });
});

describe('Ausspielen einer Weltkarte (Regen)', () => {
  it('wirkt in allen Zonen je Geografie, ohne Ziele; Kosten wie gewohnt', () => {
    const s = game({ hand: ['rain'], breath: 2, life: false });
    const before = statsById(s);
    const { state, events } = play(s, 'rain');
    const after = statsById(state);
    expect(after.mountains!.snow).toBe(before.mountains!.snow! + 1);
    expect(after.forest!.moisture).toBe(before.forest!.moisture! + 1);
    expect(after.plains!.moisture).toBe(before.plains!.moisture! + 1);
    expect(after.river!.water).toBe(before.river!.water! + 1);
    expect(after.coast!.salt).toBe(before.coast!.salt! - 1);
    // Andere Werte bleiben unverändert.
    expect(after.river!.moisture).toBe(before.river!.moisture);
    expect(after.mountains!.moisture).toBe(before.mountains!.moisture);
    expect(state.breath).toBe(1);
    expect(events[0]).toMatchObject({ type: 'cardPlayed', card: 'rain', targets: {}, cost: 1 });
    const changed = events.filter((e) => e.type === 'statChanged');
    expect(changed.map((e) => e.type === 'statChanged' && `${e.zone}.${e.stat}`)).toEqual([
      'mountains.snow',
      'forest.moisture',
      'plains.moisture',
      'river.water',
      'coast.salt',
    ]);
    expect(changed.every((e) => e.type === 'statChanged' && e.cause === 'card:rain')).toBe(true);
  });

  it('alte Ziele werden ignoriert (Kompatibilität)', () => {
    const s = game({ hand: ['rain'], breath: 2 });
    expect(statsById(play(s, 'rain', { zone: 'coast' }).state)).toEqual(statsById(play(s, 'rain').state));
  });

  it('Werte bleiben auf der Skala', () => {
    const s = game({ hand: ['rain'], breath: 2 });
    setStats(s, 'coast', { salt: 0 });
    setStats(s, 'river', { water: 5 });
    const { state, events } = play(s, 'rain');
    expect(zone(state, 'coast').stats.salt).toBe(0);
    expect(zone(state, 'river').stats.water).toBe(5);
    expect(events.some((e) => e.type === 'statChanged' && (e.zone === 'coast' || e.zone === 'river'))).toBe(false);
  });

  it('gemeinsame Effekte wirken in jeder Zone, zonenlose genau einmal', () => {
    const d = withCards({
      id: 'gust',
      reach: 'world',
      effects: [{ adjust: 'light', by: -1 }, { draw: 1 }],
      byGeography: { forest: [{ adjust: 'deadwood', by: 1 }] },
    });
    const s = game({ d, hand: ['gust'], draw: ['sun', 'sun', 'sun'] });
    const { state } = play(s, 'gust', {}, d);
    for (const z of s.zones) expect(zone(state, z.id).stats.light).toBe(z.stats.light! - 1);
    expect(zone(state, 'forest').stats.deadwood).toBe(zone(s, 'forest').stats.deadwood! + 1);
    expect(state.hand).toHaveLength(1);
    expect(state.drawPile).toHaveLength(2);
  });

  it('Wahl-Slot: die gewählte Option wirkt in jeder Zone', () => {
    const d = withCards({
      id: 'mood',
      reach: 'world',
      slots: [
        {
          id: 'mode',
          kind: 'choice',
          options: [
            { id: 'bright', label: name, effects: [{ adjust: 'light', by: 1 }] },
            { id: 'dark', label: name, effects: [{ adjust: 'light', by: -1 }, { breath: 2 }] },
          ],
        },
      ],
    });
    const s = game({ d, hand: ['mood'], breath: 0 });
    expect(legalPlays(d, s).map((p) => p.targets)).toEqual([{ mode: 'bright' }, { mode: 'dark' }]);
    expect(slotOptions(d, s, uidOf(s, 'mood'), {})).toEqual(['bright', 'dark']);
    const { state } = play(s, 'mood', { mode: 'dark' }, d);
    for (const z of s.zones) expect(zone(state, z.id).stats.light).toBe(Math.max(0, z.stats.light! - 1));
    expect(state.breath).toBe(2);
  });
});

describe('legalPlays, slotOptions und view mit reach', () => {
  it('Weltkarte = genau ein Zug ohne Ziele, sofern bezahlbar', () => {
    const s = game({ hand: ['rain', 'sun'], breath: 1 });
    const plays = legalPlays(data, s);
    expect(plays.filter((p) => p.card === 'rain')).toEqual([{ uid: uidOf(s, 'rain'), card: 'rain', targets: {} }]);
    expect(plays.filter((p) => p.card === 'sun').length).toBeGreaterThan(1);
    expect(slotOptions(data, s, uidOf(s, 'rain'), {})).toEqual([]);
    s.breath = 0;
    expect(legalPlays(data, s).filter((p) => p.card === 'rain')).toEqual([]);
  });

  it('CardView.reach: world ohne Slots, sonst zone', () => {
    const s = game({ hand: ['rain', 'sun'], breath: 1 });
    const v = view(data, s, 'de');
    expect(v.hand.find((c) => c.card === 'rain')).toMatchObject({
      reach: 'world',
      category: 'weather',
      slots: [],
      playable: true,
    });
    expect(v.hand.find((c) => c.card === 'sun')).toMatchObject({ reach: 'zone' });
  });
});

describe('Schwellen je Zone', () => {
  /** Sturzregen: after = in jeder Zone mit Feuchte 5 nach dem Regen Hochwasser; before = Frost auf Schnee. */
  const d = withCards({
    id: 'downpour',
    reach: 'world',
    effects: [{ adjust: 'moisture', by: 1 }],
    triggers: [
      {
        id: 'flood',
        name: { de: 'Flut', en: 'Flood' },
        icon: '🌊',
        check: 'after',
        when: [{ stat: 'moisture', gte: 5 }],
        disturbance: true,
        effects: [{ adjust: 'vegetation', by: -1 }],
      },
      {
        id: 'ice',
        name: { de: 'Eis', en: 'Ice' },
        icon: '🧊',
        when: [{ stat: 'moisture', lte: 1 }, { geography: 'mountains' }],
        effects: [{ adjust: 'snow', by: 1 }],
      },
    ],
  });

  it('lösen nur in den Zonen aus, deren Bedingung gilt (before vor, after nach der Grundwirkung)', () => {
    const s = game({ d, hand: ['downpour'], life: false });
    setStats(s, 'forest', { moisture: 4, vegetation: 3 });
    setStats(s, 'plains', { moisture: 2, vegetation: 3 });
    setStats(s, 'mountains', { moisture: 1, snow: 2 });
    // Fluss hat schon Feuchte 5 (bleibt 5, Schwelle prüft danach trotzdem)
    setStats(s, 'river', { moisture: 5, vegetation: 2 });
    setStats(s, 'coast', { moisture: 3 });
    const { state, events } = play(s, 'downpour', {}, d);
    const fired = events
      .filter((e) => e.type === 'triggered')
      .map((e) => e.type === 'triggered' && `${e.trigger}@${e.zone}`);
    expect(fired).toEqual(['flood@forest', 'flood@river', 'ice@mountains']);
    expect(zone(state, 'forest').stats.vegetation).toBe(2);
    expect(zone(state, 'river').stats.vegetation).toBe(1);
    expect(zone(state, 'plains').stats.vegetation).toBe(3);
    // Eis: geprüft vor dem Regen (Feuchte 1), obwohl die Berge danach Feuchte 2 haben.
    expect(zone(state, 'mountains').stats.snow).toBe(3);
    expect(zone(state, 'forest').lastDisturbance).toBe(state.round);
    expect(zone(state, 'plains').lastDisturbance).toBeNull();
    expect(events).toContainEqual({ type: 'disturbance', zone: 'river', cause: 'trigger:downpour.flood' });
  });

  it('Warnungen: Schwelle wird bei jeder Zone angezeigt, in der sie auslösen würde', () => {
    const s = game({ d, hand: ['downpour', 'rain'] });
    setStats(s, 'forest', { moisture: 4 });
    setStats(s, 'plains', { moisture: 2 });
    setStats(s, 'mountains', { moisture: 1 });
    setStats(s, 'river', { moisture: 3 });
    setStats(s, 'coast', { moisture: 4 });
    const v = view(d, s, 'de');
    const w = (id: string) => v.zones.find((z) => z.id === id)!.warnings.map((x) => x.trigger);
    expect(w('forest')).toEqual(['flood']);
    expect(w('coast')).toEqual(['flood']);
    expect(w('plains')).toEqual([]);
    expect(w('river')).toEqual([]);
    expect(w('mountains')).toEqual(['ice']);
    expect(v.zones.find((z) => z.id === 'forest')!.warnings[0]).toEqual({
      card: 'downpour',
      trigger: 'flood',
      name: 'Flut',
      icon: '🌊',
    });
  });

  it('Vorschau: Änderungen, Schwellen, Formwechsel und Abstand für alle betroffenen Zonen', () => {
    const s = game({ d, hand: ['downpour'], life: false });
    setStats(s, 'forest', { moisture: 4 });
    const p = preview(d, s, { uid: uidOf(s, 'downpour'), targets: {} }, 'de');
    const zones = new Set(p.changes.map((c) => c.zone));
    // Der Fluss hat schon Feuchte 5 (Ruhewert): keine Feuchte-Änderung, aber die Flut senkt seine Vegetation.
    expect(zones).toEqual(new Set(['mountains', 'forest', 'plains', 'river', 'coast']));
    expect(p.changes.some((c) => c.zone === 'river' && c.stat === 'moisture')).toBe(false);
    expect(p.changes).toContainEqual(expect.objectContaining({ zone: 'river', stat: 'vegetation', to: 1 }));
    expect(p.triggers).toContainEqual({ zone: 'forest', trigger: 'flood', name: 'Flut', icon: '🌊', zoneName: 'Wald' });
    expect(p.idealDistance!.map((x) => x.zone).sort()).toEqual([...zones].sort());
    for (const c of p.changes) expect(['better', 'worse', 'neutral']).toContain(c.toward);
  });
});

describe('Ausstrahlungen und Odem wirken gleichzeitig', () => {
  it('Bestände und Störungen der Nachbarn, Odem aus Schwellen summiert und einmal begrenzt', () => {
    const d = withCards({
      id: 'swarm',
      reach: 'world',
      byGeography: {
        river: [
          { population: 'beetle', by: 2, scope: 'neighbors' },
          { transfer: 'water', into: 'moisture', amount: 1, from: 'self' },
        ],
        coast: [{ disturb: true, scope: 'neighbors' }],
        mountains: [{ restore: 'snow' }],
      },
      triggers: [
        { id: 'gift', name, icon: '✨', when: [{ hasStat: 'moisture' }], effects: [{ breath: 1 }] },
        { id: 'drain', name, icon: '💧', when: [{ geography: 'coast' }], effects: [{ breath: -9 }] },
      ],
    });
    const s = game({ d, hand: ['swarm'], life: false, breath: 4 });
    setStats(s, 'mountains', { snow: 5 });
    const { state, events } = play(s, 'swarm', {}, d);
    for (const z of ['mountains', 'forest', 'plains', 'coast']) expect(zone(state, z).populations.beetle).toBe(2);
    expect(zone(state, 'river').populations.beetle).toBeUndefined();
    expect(zone(state, 'river').lastDisturbance).toBe(state.round);
    expect(zone(state, 'plains').lastDisturbance).toBe(state.round);
    expect(zone(state, 'forest').lastDisturbance).toBeNull();
    expect(zone(state, 'mountains').stats.snow).toBe(data.geographies.get('mountains')!.rest.snow);
    expect(zone(state, 'river').stats.water).toBe(zone(s, 'river').stats.water! - 1);
    // Je Schwelle gesammelt: fünf Zonen × +1, danach die Küste −9 (begrenzt auf 0).
    expect(state.breath).toBe(0);
    expect(events.filter((e) => e.type === 'breathChanged')).toEqual([
      { type: 'breathChanged', from: 4, to: 9, cause: 'trigger:swarm.gift' },
      { type: 'breathChanged', from: 9, to: 0, cause: 'trigger:swarm.drain' },
    ]);
  });
});

describe('Reihenfolge der Zonen entscheidet nichts', () => {
  /**
   * Wald trocknet seine Nachbarn aus (−2), der Fluss befeuchtet sie (+2). Das Flachland ist Nachbar von beiden:
   * nacheinander angewendet hinge das Ergebnis an der Skala von der Reihenfolge ab, gleichzeitig nicht.
   */
  const card = {
    id: 'tides',
    reach: 'world',
    byGeography: {
      forest: [{ adjust: 'moisture', by: -2, scope: 'neighbors' }],
      river: [{ adjust: 'moisture', by: 2, scope: 'neighbors' }],
      plains: [{ adjust: 'vegetation', by: 1 }],
    },
    triggers: [
      {
        id: 'bloom',
        name,
        icon: '🌸',
        check: 'after',
        when: [{ stat: 'moisture', gte: 5 }],
        effects: [{ adjust: 'light', by: -1, scope: 'area' }],
      },
    ],
  };
  const normal = withCards(card);
  const reversed = dataWith((r) => {
    r.cards.cards.push({ name, category: 'weather', cost: 0, ...card });
    r.map.zones.reverse();
  });

  const run = (d: GameData) => {
    const s = game({ d, hand: ['tides'], life: false });
    setStats(s, 'plains', { moisture: 5, vegetation: 2 });
    setStats(s, 'coast', { moisture: 5 });
    setStats(s, 'mountains', { moisture: 0 });
    return play(s, 'tides', {}, d);
  };

  it('gleiches Ergebnis bei umgekehrter Kartenreihenfolge der Zonen', () => {
    const a = run(normal);
    const b = run(reversed);
    expect(a.state.zones.map((z) => z.id)).not.toEqual(b.state.zones.map((z) => z.id));
    expect(statsById(a.state)).toEqual(statsById(b.state));
    // Flachland: −2 und +2 heben sich auf (bliebe nacheinander je nach Reihenfolge 3 oder 5).
    expect(zone(a.state, 'plains').stats.moisture).toBe(5);
    expect(zone(a.state, 'plains').stats.vegetation).toBe(3);
    const fired = (es: GameEvent[]) =>
      es
        .filter((e) => e.type === 'triggered')
        .map((e) => e.type === 'triggered' && e.zone)
        .sort();
    expect(fired(a.events)).toEqual(fired(b.events));
  });
});

describe('Kartentext von Weltkarten', () => {
  const rain = data.cards.get('rain')!;

  it('nennt alle Zonen und die Wirkung je Geografie', () => {
    expect(cardText(data, rain, 'de')).toBe(
      'Alle Zonen: Berge Schnee +1 · Wald Feuchte +1 · Flachland Feuchte +1 · Fluss Wasserstand +1 · Küste Salz −1.',
    );
    expect(cardText(data, rain, 'en')).toMatch(/^All zones: Mountains Snow \+1 · Forest Moisture \+1/);
  });

  it('Kurztext mit Pfeilen, jede Wirkung einmal, höchstens SHORT_MAX Zeichen', () => {
    expect(cardShort(data, rain, 'de')).toBe('🌍 Schnee↑, Feuchte↑, Wasserstand↑, Salz↓');
    expect(cardShort(data, rain, 'en')).toBe('🌍 Snow↑, Moisture↑, Water level↑, Salt↓');
    const v = view(data, game({ hand: ['rain'] }), 'de');
    expect(v.hand[0]!.short).toBe(cardShort(data, rain, 'de'));
  });

  it('gemeinsame Effekte, Ausstrahlung, Schwellen, Wahl und zonenlose Effekte', () => {
    const d = withCards(
      {
        id: 'mix',
        reach: 'world',
        effects: [{ adjust: 'light', by: 2 }, { draw: 1 }],
        byGeography: { river: [{ adjust: 'moisture', by: -1, scope: 'neighbors' }] },
        triggers: [
          {
            id: 't',
            name: { de: 'Glut', en: 'Embers' },
            icon: '🔥',
            when: [{ geography: 'forest' }],
            effects: [{ disturb: true }],
          },
        ],
      },
      {
        id: 'pick',
        reach: 'world',
        slots: [
          {
            id: 'mode',
            kind: 'choice',
            options: [
              { id: 'a', label: { de: 'Hell', en: 'Bright' }, effects: [{ adjust: 'light', by: 1 }] },
              { id: 'b', label: { de: 'Dunkel', en: 'Dark' }, effects: [{ adjust: 'light', by: -1 }] },
            ],
          },
        ],
      },
      {
        id: 'long',
        reach: 'world',
        byGeography: Object.fromEntries(
          ['mountains', 'forest', 'plains', 'river', 'coast'].map((g, i) => [
            g,
            [
              { adjust: 'vegetation', by: i + 1 },
              { adjust: 'light', by: -(i + 1) },
            ],
          ]),
        ),
      },
    );
    const mix = d.cards.get('mix')!;
    expect(cardText(d, mix, 'de')).toBe(
      'Alle Zonen: Licht +2 · Fluss Feuchte −1 auf allen Nachbarzonen. Ziehe 1 Karten. 🔥 Glut bei Wald: Störung.',
    );
    // Zu lang mit allen Wirkungen: so viele wie passen, dann „…“ und die Symbole der Schwellen.
    expect(cardShort(d, mix, 'de')).toBe('🌍 Licht↑↑, ziehe 1 Karten … 🔥');
    const pick = d.cards.get('pick')!;
    expect(cardText(d, pick, 'de')).toBe('Wähle: Hell (Licht +1) oder Dunkel (Licht −1).');
    expect(cardShort(d, pick, 'de')).toBe('🌍 Wähle: Hell oder Dunkel');
    const long = cardShort(d, d.cards.get('long')!, 'de');
    expect([...long].length).toBeLessThanOrEqual(SHORT_MAX);
    expect(long).toMatch(/^🌍 Vegetation↑, Licht↓, .* …$/);
  });
});

describe('Ereignisse mit Weltkarten', () => {
  const happen = (d: GameData, s: GameState, zoneId: string | null) => {
    const events: GameEvent[] = [];
    occur(d, s, { event: 'squall_event', round: s.round, strength: 2, zone: zoneId }, (e) => events.push(e));
    return events;
  };
  const withEvent = (target: Loose) =>
    dataWith((r) => {
      r.cards.cards.push({
        id: 'squall',
        name,
        category: 'weather',
        cost: 0,
        reach: 'world',
        byGeography: { forest: [{ adjust: 'deadwood', by: 1 }], coast: [{ adjust: 'salt', by: 1 }] },
        effects: [{ adjust: 'light', by: -1 }],
      });
      r.events.events.push({
        id: 'squall_event',
        name,
        description: name,
        icon: '🌬',
        weight: 1,
        card: 'squall',
        ...(target && { target }),
      });
    });

  it('mit Zielzone nur dort (je Geografie), Karten werden nicht skaliert', () => {
    const de = withEvent({ pick: 'random' });
    const s = game({ d: de, life: false });
    const before = statsById(s);
    const events = happen(de, s, 'forest');
    expect(zone(s, 'forest').stats.deadwood).toBe(before.forest!.deadwood! + 1);
    expect(zone(s, 'forest').stats.light).toBe(before.forest!.light! - 1);
    expect(zone(s, 'coast').stats).toEqual(before.coast);
    expect(
      events
        .filter((e) => e.type === 'statChanged')
        .every((e) => e.type === 'statChanged' && e.cause === 'event:squall_event'),
    ).toBe(true);
  });

  it('ohne Zielzone auf allen Zonen', () => {
    const de = withEvent(null);
    const s = game({ d: de, life: false });
    const before = statsById(s);
    happen(de, s, null);
    for (const z of s.zones) expect(z.stats.light).toBe(before[z.id]!.light! - 1);
    expect(zone(s, 'coast').stats.salt).toBe(before.coast!.salt! + 1);
  });
});

describe('Spielstände', () => {
  it('Kartenänderungen in den Daten ändern das Zustandsformat nicht: alter Stand mit Regen bleibt gültig', () => {
    const s = newGame(data, { seed: 3 });
    s.hand = [{ uid: s.nextUid++, card: 'rain' }];
    s.breath = 2;
    const saved = JSON.parse(JSON.stringify(s));
    expect(validateState(data, saved)).toEqual({ ok: true });
    const { state } = play(saved, 'rain', { zone: 'forest' });
    expect(validateState(data, JSON.parse(JSON.stringify(state)))).toEqual({ ok: true });
  });
});

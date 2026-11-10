/** Idealform in der App: Zielbereiche, Einfärbung der Zielwahl, Effekt-Zeilen und Vorschau-Daten – ohne DOM. */
import { describe, expect, it } from 'vitest';
import type { ZoneView } from '@core/api';
import type { Notice, PreviewView } from '../src/client/GameClient.ts';
import { MockClient } from '../src/client/MockClient.ts';
import {
  barCells,
  classifyPreview,
  completesCard,
  isWorldCard,
  rangeLabel,
  targetDistance,
  targetStatus,
  towardFromDistance,
  towardOf,
  worldBalance,
  worldTints,
  zoneEffects,
  zoneTints,
} from '../src/logic/ideal.ts';
import { fxLines, NATURE_LINES } from '../src/logic/fx.ts';

function preview(partial: Partial<PreviewView>): PreviewView {
  return {
    cost: 0,
    affordable: true,
    changes: [],
    triggers: [],
    formChanges: [],
    populationChanges: [],
    eventChanges: [],
    ...partial,
  };
}

const change = (toward?: 'better' | 'worse' | 'neutral') => ({
  zone: 'z',
  zoneName: 'Z',
  stat: 's',
  statName: 'S',
  from: 1,
  to: 2,
  ...(toward ? { toward } : {}),
});

describe('Zielbereich', () => {
  const water = { min: 3, max: 3 };
  it('misst den Abstand außerhalb des Bereichs', () => {
    expect(targetDistance(3, water)).toBe(0);
    expect(targetDistance(5, water)).toBe(2);
    expect(targetDistance(1, { min: 2, max: 4 })).toBe(1);
  });
  it('bestimmt die Lage', () => {
    expect(targetStatus(2, water)).toBe('low');
    expect(targetStatus(3, water)).toBe('ok');
    expect(targetStatus(4, water)).toBe('high');
  });
  it('senken ist besser, wenn der Wert zu hoch ist', () => {
    expect(towardOf(5, 4, water)).toBe('better');
    expect(towardOf(3, 4, water)).toBe('worse');
    expect(towardOf(4, 5, { min: 4, max: 5 })).toBe('neutral');
    expect(towardOf(1, 5, undefined)).toBe('neutral');
  });
  it('Richtung aus Abständen', () => {
    expect(towardFromDistance(2, 1)).toBe('better');
    expect(towardFromDistance(1, 2)).toBe('worse');
    expect(towardFromDistance(1, 1)).toBe('neutral');
  });
  it('markiert die Zellen des Zielbereichs', () => {
    const cells = barCells(4, 5, { min: 2, max: 3 });
    expect(cells.map((c) => c.on)).toEqual([true, true, true, true, false]);
    expect(cells.map((c) => c.target)).toEqual([false, true, true, false, false]);
    expect(barCells(2, 5).every((c) => !c.target)).toBe(true);
  });
  it('beschriftet Bereiche kurz', () => {
    expect(rangeLabel({ min: 3, max: 3 }, 5)).toBe('3');
    expect(rangeLabel({ min: 2, max: 3 }, 5)).toBe('2–3');
    expect(rangeLabel({ min: 4, max: 5 }, 5)).toBe('≥ 4');
    expect(rangeLabel({ min: 0, max: 1 }, 5)).toBe('≤ 1');
  });
});

describe('Einfärbung der Zielwahl', () => {
  it('nutzt idealDistance: Summe über alle betroffenen Zonen', () => {
    expect(classifyPreview(preview({ idealDistance: [{ zone: 'a', before: 2, after: 1 }] }))).toBe('better');
    expect(classifyPreview(preview({ idealDistance: [{ zone: 'a', before: 0, after: 1 }] }))).toBe('worse');
    expect(
      classifyPreview(
        preview({
          idealDistance: [
            { zone: 'a', before: 2, after: 1 },
            { zone: 'b', before: 0, after: 1 },
          ],
        }),
      ),
    ).toBe('neutral');
  });
  it('fällt ohne idealDistance auf toward zurück', () => {
    expect(classifyPreview(preview({ changes: [change('better'), change('better'), change('worse')] }))).toBe('better');
    expect(classifyPreview(preview({ changes: [change('worse')] }))).toBe('worse');
    expect(classifyPreview(preview({ changes: [change()] }))).toBe('neutral');
  });
  it('färbt nichts ohne Vorschau', () => {
    expect(classifyPreview(null)).toBeNull();
    const tints = zoneTints(['a', 'b'], (z) =>
      z === 'a' ? preview({ idealDistance: [{ zone: 'a', before: 1, after: 0 }] }) : null,
    );
    expect([...tints]).toEqual([['a', 'better']]);
  });
  it('bewertet Kandidaten nur für den letzten Slot', () => {
    const card = {
      uid: 1,
      card: 'storm',
      name: 'Sturm',
      category: 'force',
      cost: 0,
      text: '',
      playable: true,
      slots: [
        { id: 'zone', kind: 'zone', label: 'Zone' },
        { id: 'fall', kind: 'neighbor', label: 'Nachbar' },
      ],
    };
    expect(completesCard(card, 'zone')).toBe(false);
    expect(completesCard(card, 'fall')).toBe(true);
  });
});

describe('Weltkarten: Färbung und Bilanz über mehrere Zonen', () => {
  const zones = [
    { id: 'mountains', geographyName: 'Berge' },
    { id: 'forest', geographyName: 'Wald' },
    { id: 'river', geographyName: 'Fluss' },
    { id: 'coast', geographyName: 'Küste' },
  ];
  const c = (zone: string, stat: string, from: number, to: number, toward?: 'better' | 'worse' | 'neutral') => ({
    zone,
    zoneName: zone,
    stat,
    statName: stat,
    from,
    to,
    ...(toward ? { toward } : {}),
  });

  it('färbt jede Zone nach ihrem eigenen Abstand – grün, rot, gelb zugleich', () => {
    const p = preview({
      changes: [
        c('coast', 'salt', 3, 2, 'neutral'),
        c('forest', 'moisture', 3, 4, 'better'),
        c('mountains', 'snow', 2, 3, 'worse'),
      ],
      idealDistance: [
        { zone: 'coast', before: 3, after: 3 },
        { zone: 'forest', before: 1, after: 0 },
        { zone: 'mountains', before: 0, after: 1 },
      ],
    });
    const effects = zoneEffects(p, zones);
    // Reihenfolge der Insel, nicht der Vorschau
    expect(effects.map((e) => e.zone)).toEqual(['mountains', 'forest', 'coast']);
    expect(effects.map((e) => e.zoneName)).toEqual(['mountains', 'forest', 'coast']);
    expect(Object.fromEntries(worldTints(effects))).toEqual({ mountains: 'worse', forest: 'better', coast: 'neutral' });
    expect(effects[1]!.distance).toEqual({ before: 1, after: 0 });
    expect(worldBalance(effects)).toEqual({ better: 1, worse: 1, neutral: 1 });
    // Gesamtwirkung über alle Zonen wäre „gleich“ – die Bilanz zeigt trotzdem jede Richtung einzeln.
    expect(classifyPreview(p)).toBe('neutral');
  });

  it('Zonen ohne Wirkung bleiben ungefärbt, auch wenn die Engine ihren Abstand mitliefert', () => {
    const p = preview({
      changes: [c('forest', 'moisture', 3, 4, 'better'), c('river', 'water', 5, 5)],
      idealDistance: [
        { zone: 'forest', before: 1, after: 0 },
        { zone: 'river', before: 2, after: 2 },
        { zone: 'coast', before: 3, after: 3 },
      ],
    });
    const effects = zoneEffects(p, zones);
    expect(effects.map((e) => e.zone)).toEqual(['forest']);
    expect(worldBalance(effects)).toEqual({ better: 1, worse: 0, neutral: 0 });
  });

  it('Schwellen und Formwechsel machen eine Zone betroffen; Namen aus der Vorschau oder den Zonen', () => {
    const p = preview({
      triggers: [{ zone: 'river', zoneName: 'Fluss (Vorschau)', name: 'Flut', icon: '🌊' }],
      formChanges: [{ zone: 'coast', zoneName: 'Küste', from: 'Strand', to: 'Salzwüste', kind: 'degraded' }],
      idealDistance: [{ zone: 'coast', before: 1, after: 2 }],
    });
    const effects = zoneEffects(p, zones);
    expect(effects.map((e) => [e.zone, e.zoneName, e.toward])).toEqual([
      ['river', 'Fluss (Vorschau)', 'neutral'],
      ['coast', 'Küste', 'worse'],
    ]);
    expect(effects[0]!.triggers).toHaveLength(1);
    expect(effects[1]!.formChanges).toHaveLength(1);
  });

  it('ohne idealDistance entscheidet je Zone die Mehrheit der Richtungen', () => {
    const p = preview({
      changes: [
        c('forest', 'moisture', 3, 4, 'better'),
        c('forest', 'vegetation', 3, 4, 'better'),
        c('forest', 'deadwood', 2, 4, 'worse'),
        c('coast', 'salt', 2, 3, 'worse'),
        c('mountains', 'light', 2, 3),
      ],
    });
    const tints = worldTints(zoneEffects(p, zones));
    expect(Object.fromEntries(tints)).toEqual({ forest: 'better', coast: 'worse', mountains: 'neutral' });
    expect(zoneEffects(p, zones).every((e) => e.distance === null)).toBe(true);
  });

  it('keine Vorschau ⇒ keine Zonen, leere Bilanz', () => {
    expect(zoneEffects(null)).toEqual([]);
    expect(worldBalance([])).toEqual({ better: 0, worse: 0, neutral: 0 });
  });

  it('erkennt Weltkarten nur an reach "world"', () => {
    expect(isWorldCard({ reach: 'world' })).toBe(true);
    expect(isWorldCard({ reach: 'zone' })).toBe(false);
    expect(isWorldCard({})).toBe(false);
  });
});

describe('Effekt-Zeilen', () => {
  const zones = [
    {
      id: 'river',
      stats: [{ id: 'water', name: 'Wasserstand', value: 4, max: 5, target: { min: 3, max: 3, status: 'high' } }],
    },
  ] as unknown as ZoneView[];

  it('färbt Wertänderungen nach dem Zielbereich und zeigt Formwechsel', () => {
    const notices: Notice[] = [
      {
        type: 'statShift',
        zone: 'river',
        cause: 'card',
        changes: [{ stat: 'water', statName: 'Wasserstand', from: 5, to: 4 }],
      },
      { type: 'form', zoneId: 'river', zone: 'Fluss', from: 'Hochwasser', to: 'Aue', kind: 'ideal' },
    ];
    const lines = fxLines(notices, zones);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ kind: 'form', name: 'Aue', tone: 'better', index: 0 });
    expect(lines[1]).toMatchObject({ kind: 'stat', delta: -1, tone: 'better', index: 1, cause: 'card' });
  });

  it('fasst die Natur-Phase je Zone zusammen', () => {
    const changes = Array.from({ length: NATURE_LINES + 2 }, (_, i) => ({
      stat: `s${i}`,
      statName: `S${i}`,
      from: 1,
      to: 2,
    }));
    const lines = fxLines([{ type: 'statShift', zone: 'river', cause: 'nature', changes }], zones);
    expect(lines.filter((l) => l.kind === 'stat')).toHaveLength(NATURE_LINES);
    expect(lines.at(-1)).toMatchObject({ kind: 'more', count: 2 });
  });
});

describe('MockClient liefert die Idealform-Felder', () => {
  it('Zielbereiche, Abstand und Richtung', () => {
    const client = new MockClient('de');
    const view = client.getView();
    const river = view.zones.find((z) => z.id === 'river')!;
    expect(river.ideal).toMatchObject({ name: 'Aue' });
    expect(river.ideal!.distance).toBeGreaterThan(0);
    const water = river.stats.find((s) => s.id === 'water')!;
    expect(water.target).toEqual({ min: 3, max: 3, status: 'high' });

    const seeds = view.hand.find((c) => c.card === 'seeds')!;
    const plains = client.preview(seeds.uid, { zone: 'plains' })!;
    expect(plains.changes[0]).toMatchObject({ stat: 'vegetation', from: 0, to: 1, toward: 'better' });
    expect(classifyPreview(plains)).toBe('better');
    const mountains = client.preview(seeds.uid, { zone: 'mountains' })!;
    expect(classifyPreview(mountains)).toBe('neutral');
  });

  it('meldet Wertänderungen eines gezielten Zugs für die Effekte', () => {
    const client = new MockClient('de');
    const notices: Notice[][] = [];
    client.subscribeNotices((n) => notices.push(n));
    const seeds = client.getView().hand.find((c) => c.card === 'seeds')!;
    client.dispatch({ type: 'play', uid: seeds.uid, targets: { zone: 'forest' } });
    const shifts = notices.flat().filter((n) => n.type === 'statShift');
    expect(shifts).toEqual([expect.objectContaining({ zone: 'forest', cause: 'card' })]);
  });
});

describe('MockClient: Wetter wirkt überall', () => {
  it('Wetterkarten sind Weltkarten ohne Zonen-Slots, Gaben und Wunder bleiben gezielt', () => {
    const hand = new MockClient('de').getView().hand;
    const rain = hand.find((c) => c.card === 'rain')!;
    expect(rain).toMatchObject({ category: 'weather', reach: 'world', slots: [] });
    expect(isWorldCard(rain)).toBe(true);
    expect(rain.text).toContain('Küste: Salz −1');
    for (const id of ['seeds', 'healing']) {
      const card = hand.find((c) => c.card === id)!;
      expect(isWorldCard(card)).toBe(false);
      expect(card.slots[0]?.kind).toBe('zone');
    }
  });

  it('Vorschau ohne Ziele für alle betroffenen Zonen, je Geografie verschieden', () => {
    const client = new MockClient('de');
    const view = client.getView();
    const rain = view.hand.find((c) => c.card === 'rain')!;
    expect(client.legalTargets(rain.uid, {})).toEqual([]);
    const p = client.preview(rain.uid, {})!;
    expect(p).not.toBeNull();
    const effects = zoneEffects(p, view.zones);
    // Fluss steht schon auf Wasserstand 5: Regen ändert dort nichts, die Zone bleibt ungefärbt.
    expect(effects.map((e) => e.zone)).toEqual(['mountains', 'forest', 'plains', 'coast']);
    expect(Object.fromEntries(worldTints(effects))).toEqual({
      forest: 'better',
      mountains: 'worse',
      plains: 'neutral',
      coast: 'neutral',
    });
    expect(effects.find((e) => e.zone === 'coast')!.changes).toEqual([
      expect.objectContaining({ stat: 'salt', from: 3, to: 2 }),
    ]);
    expect(worldBalance(effects)).toEqual({ better: 1, worse: 1, neutral: 2 });
  });

  it('bildet alle sechs Wetterkarten nach, je Geografie verschieden (Frost lässt die Küste unberührt)', () => {
    const pool = new MockClient('de').deckSetup().pool;
    const weather = pool.filter((c) => c.category === 'weather').map((c) => c.id);
    expect(weather.sort()).toEqual(['drought', 'dry_wind', 'frost', 'rain', 'storm', 'thunderstorm']);
    const frost = pool.find((c) => c.id === 'frost')!;
    expect(frost.text).toContain('Berge: Schnee +1');
    expect(frost.text).not.toContain('Küste');
  });

  it('Ausspielen ohne Ziele ändert alle betroffenen Zonen und meldet je Zone die Werte', () => {
    const client = new MockClient('de');
    const notices: Notice[][] = [];
    client.subscribeNotices((n) => notices.push(n));
    const rain = client.getView().hand.find((c) => c.card === 'rain')!;
    client.dispatch({ type: 'play', uid: rain.uid, targets: {} });
    const shifts = notices.flat().filter((n) => n.type === 'statShift');
    expect(shifts.map((n) => n.type === 'statShift' && n.zone)).toEqual(['mountains', 'forest', 'plains', 'coast']);
    expect(shifts.every((n) => n.type === 'statShift' && n.cause === 'card')).toBe(true);
    const coast = client.getView().zones.find((z) => z.id === 'coast')!;
    expect(coast.stats.find((s) => s.id === 'salt')!.value).toBe(2);
  });

  it('Gewitter zeigt die Feuer-Schwelle nur dort, wo es trocken ist', () => {
    const client = new MockClient('de');
    const storm = client.getView().hand.find((c) => c.card === 'thunderstorm')!;
    // Start: keine trockene Zone mit Vegetation ⇒ keine Schwelle
    expect(client.preview(storm.uid, {})!.triggers).toEqual([]);
  });
});

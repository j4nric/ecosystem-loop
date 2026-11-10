/** Idealform in der App: Zielbereiche, Einfärbung der Zielwahl, Effekt-Zeilen und Vorschau-Daten – ohne DOM. */
import { describe, expect, it } from 'vitest';
import type { ZoneView } from '@core/api';
import type { Notice, PreviewView } from '../src/client/GameClient.ts';
import { MockClient } from '../src/client/MockClient.ts';
import {
  barCells,
  classifyPreview,
  completesCard,
  rangeLabel,
  targetDistance,
  targetStatus,
  towardFromDistance,
  towardOf,
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

    const rain = view.hand.find((c) => c.card === 'rain')!;
    const forest = client.preview(rain.uid, { zone: 'forest' })!;
    expect(forest.changes[0]).toMatchObject({ stat: 'moisture', toward: 'better' });
    expect(classifyPreview(forest)).toBe('better');

    const storm = view.hand.find((c) => c.card === 'storm')!;
    const worse = client.preview(storm.uid, { zone: 'forest', fall: 'river' })!;
    expect(classifyPreview(worse)).toBe('worse');
  });

  it('meldet Wertänderungen eines Zugs für die Effekte', () => {
    const client = new MockClient('de');
    const notices: Notice[][] = [];
    client.subscribeNotices((n) => notices.push(n));
    const rain = client.getView().hand.find((c) => c.card === 'rain')!;
    client.dispatch({ type: 'play', uid: rain.uid, targets: { zone: 'forest' } });
    const shift = notices.flat().find((n) => n.type === 'statShift');
    expect(shift).toMatchObject({ zone: 'forest', cause: 'card' });
  });
});

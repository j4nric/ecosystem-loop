import { describe, expect, it } from 'vitest';
import { preview, view } from '../src/game.ts';
import { formFor } from '../src/rules/forms.ts';
import { idealDistance, idealTargetOf, rangesOf, statDistance, targetStatus } from '../src/targets.ts';
import { data, dataWith, game, setStats, uidOf, zone } from './helpers.ts';

const scale = { min: 0, max: 5 };

describe('Zielbereiche der Idealform (Konzept 4.2)', () => {
  it('werden für alle fünf Geografien aus den echten Daten abgeleitet', () => {
    const ranges = Object.fromEntries([...data.ideals].map(([g, t]) => [g, t]));
    expect(ranges).toEqual({
      mountains: {
        form: 'alpine_meadow',
        ranges: { vegetation: { min: 2, max: 3 }, snow: { min: 1, max: 2 }, light: { min: 3, max: 5 } },
      },
      forest: {
        form: 'primeval_forest',
        ranges: { vegetation: { min: 4, max: 5 }, moisture: { min: 4, max: 5 }, deadwood: { min: 2, max: 3 } },
      },
      plains: {
        form: 'flower_meadow',
        ranges: {
          vegetation: { min: 2, max: 4 },
          soil: { min: 4, max: 5 },
          light: { min: 3, max: 5 },
          moisture: { min: 0, max: 3 },
        },
      },
      river: { form: 'floodplain', ranges: { water: { min: 3, max: 3 }, vegetation: { min: 3, max: 5 } } },
      coast: {
        form: 'mangrove',
        ranges: { vegetation: { min: 3, max: 5 }, salt: { min: 2, max: 3 }, moisture: { min: 4, max: 5 } },
      },
    });
  });

  it('eq, nur gte, nur lte, Schnitt mehrerer Bedingungen; Nicht-stat-Bedingungen zählen nicht', () => {
    expect(
      rangesOf(
        [
          { stat: 'water', eq: 3 },
          { stat: 'light', gte: 2 },
          { stat: 'snow', lte: 1 },
          { stat: 'salt', gte: 1 },
          { stat: 'salt', lte: 3 },
          { season: 'summer' },
          { any: [{ stat: 'moisture', gte: 4 }] },
        ],
        scale,
      ),
    ).toEqual({
      water: { min: 3, max: 3 },
      light: { min: 2, max: 5 },
      snow: { min: 0, max: 1 },
      salt: { min: 1, max: 3 },
    });
  });

  it('Geografie ohne Idealform hat kein Ziel; die Datenprüfung verlangt genau eine', () => {
    const geo = structuredClone(data.geographies.get('river')!);
    geo.forms = geo.forms.filter((f) => f.kind !== 'ideal');
    expect(idealTargetOf(geo, scale)).toBeNull();
    expect(() =>
      dataWith((r) => {
        const river = r.geographies.geographies.find((g: { id: string }) => g.id === 'river');
        river.forms.find((f: { id: string }) => f.id === 'brook').kind = 'ideal';
      }),
    ).toThrow(/river: genau eine Idealform nötig \(gefunden 2\)/);
    expect(() =>
      dataWith((r) => {
        const river = r.geographies.geographies.find((g: { id: string }) => g.id === 'river');
        river.forms.find((f: { id: string }) => f.id === 'floodplain').kind = 'normal';
      }),
    ).toThrow(/river: genau eine Idealform nötig \(gefunden 0\)/);
  });

  it('Abstand 0 ⇔ Idealform: im ganzen Zielbereich greift keine frühere Form', () => {
    const { min, max } = data.config.scale;
    for (const g of data.geographies.values()) {
      const zid = data.zones.find((z) => z.geography === g.id)!.id;
      const stats = [...data.commonStats, g.special];
      const target = data.ideals.get(g.id)!;
      const total = (max - min + 1) ** stats.length;
      for (let n = 0; n < total; n++) {
        const v: Record<string, number> = {};
        let k = n;
        for (const st of stats) {
          v[st] = min + (k % (max - min + 1));
          k = Math.floor(k / (max - min + 1));
        }
        const s = game();
        setStats(s, zid, v);
        const isIdeal = formFor(data, s, zone(s, zid)).id === target.form;
        expect(isIdeal, `${g.id} ${JSON.stringify(v)}`).toBe(idealDistance(target, v) === 0);
      }
    }
  });

  it('Datenprüfung: frühere Form darf den Zielbereich nicht überdecken', () => {
    expect(() =>
      dataWith((r) => {
        const plains = r.geographies.geographies.find((g: { id: string }) => g.id === 'plains');
        const meadow = plains.forms.find((f: { id: string }) => f.id === 'flower_meadow');
        meadow.when = meadow.when.filter((c: { stat?: string }) => c.stat !== 'moisture');
      }),
    ).toThrow(/plains: Form bog steht vor der Idealform/);
  });

  it('Status low/ok/high und Abstand an den Grenzen', () => {
    const r = { min: 2, max: 3 };
    expect([1, 2, 3, 4].map((v) => targetStatus(r, v))).toEqual(['low', 'ok', 'ok', 'high']);
    expect([0, 1, 2, 3, 4, 5].map((v) => statDistance(r, v))).toEqual([2, 1, 0, 0, 1, 2]);
    const eq = { min: 3, max: 3 };
    expect([2, 3, 4].map((v) => targetStatus(eq, v))).toEqual(['low', 'ok', 'high']);
  });

  it('Abstand zur Idealform = Summe über die eingeschränkten Werte', () => {
    const river = data.ideals.get('river')!;
    expect(idealDistance(river, { water: 3, vegetation: 4, light: 0 })).toBe(0);
    expect(idealDistance(river, { water: 5, vegetation: 1, light: 0 })).toBe(2 + 2);
    expect(idealDistance(river, { light: 2 })).toBe(0); // fehlende Werte zählen nicht
  });
});

describe('Ansicht: Zielbereiche und Ideal', () => {
  it('stats[].target mit Status und zone.ideal mit Abstand', () => {
    const s = game({ hand: ['rain'] });
    setStats(s, 'river', { water: 5, vegetation: 4, light: 1, moisture: 3 });
    const v = view(data, s, 'de');
    const river = v.zones.find((z) => z.id === 'river')!;
    const stat = (id: string) => river.stats.find((x) => x.id === id)!;
    expect(stat('water').target).toEqual({ min: 3, max: 3, status: 'high' });
    expect(stat('vegetation').target).toEqual({ min: 3, max: 5, status: 'ok' });
    expect(stat('light').target).toBeUndefined();
    expect(river.ideal).toEqual({ id: 'floodplain', name: 'Aue', distance: 2 });
    setStats(s, 'river', { water: 0, vegetation: 1 });
    const low = view(data, s, 'en').zones.find((z) => z.id === 'river')!;
    expect(low.stats.find((x) => x.id === 'water')!.target!.status).toBe('low');
    expect(low.ideal).toMatchObject({ id: 'floodplain', distance: 3 + 2 });
    expect(low.ideal!.name).toBe(data.forms.get('floodplain')!.form.name.en);
  });
});

describe('Vorschau: Richtung zum Ideal', () => {
  it('toward better/worse/neutral und idealDistance vorher/nachher', () => {
    const s = game({ hand: ['rain', 'dry_wind', 'sun'] });
    setStats(s, 'coast', { moisture: 3 });
    setStats(s, 'forest', { moisture: 5 });
    const before = structuredClone(s);

    const better = preview(data, s, { uid: uidOf(s, 'rain'), targets: { zone: 'coast' } });
    expect(better.changes).toEqual([expect.objectContaining({ zone: 'coast', stat: 'moisture', toward: 'better' })]);
    const coastDist = idealDistance(data.ideals.get('coast')!, s.zones.find((z) => z.id === 'coast')!.stats);
    expect(better.idealDistance).toEqual([{ zone: 'coast', before: coastDist, after: coastDist - 1 }]);

    const worse = preview(data, s, { uid: uidOf(s, 'dry_wind'), targets: { zone: 'forest' } });
    expect(worse.changes[0]).toMatchObject({ zone: 'forest', stat: 'moisture', from: 5, to: 4, toward: 'neutral' });
    setStats(s, 'forest', { moisture: 4 });
    const worse2 = preview(data, s, { uid: uidOf(s, 'dry_wind'), targets: { zone: 'forest' } });
    expect(worse2.changes[0]).toMatchObject({ to: 3, toward: 'worse' });
    const d = worse2.idealDistance![0]!;
    expect(d.after - d.before).toBe(1);

    // Licht schränkt die Aue nicht ein: neutral, Abstand unverändert.
    const neutral = preview(data, s, { uid: uidOf(s, 'sun'), targets: { zone: 'river' } });
    expect(neutral.changes[0]).toMatchObject({ zone: 'river', stat: 'light', toward: 'neutral' });
    expect(neutral.idealDistance![0]!.before).toBe(neutral.idealDistance![0]!.after);

    // Vorschau bleibt rein.
    setStats(s, 'forest', { moisture: 5 });
    expect(s).toEqual(before);
  });

  it('Karte ohne Wertänderung: keine Abstände', () => {
    const s = game({ hand: ['silence'] });
    const p = preview(data, s, { uid: uidOf(s, 'silence'), targets: {} });
    expect(p.changes).toEqual([]);
    expect(p.idealDistance).toEqual([]);
  });
});

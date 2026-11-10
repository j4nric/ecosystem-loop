/** Konzept 4.2: Formen je Geografie – jede Form ist erreichbar, die erste passende gilt. */
import { describe, expect, it } from 'vitest';
import { formFor } from '../src/rules/forms.ts';
import { data, game, runRules, setStats, zone } from './helpers.ts';

/** Alle Wertkombinationen einer Geografie (Skala 0–5). */
function* combos(stats: string[]): Generator<Record<string, number>> {
  const { min, max } = data.config.scale;
  const v: Record<string, number> = Object.fromEntries(stats.map((s) => [s, min]));
  for (;;) {
    yield { ...v };
    let i = 0;
    while (i < stats.length && v[stats[i]!] === max) v[stats[i++]!] = min;
    if (i === stats.length) return;
    v[stats[i]!]!++;
  }
}

describe('Formen (Konzept 4.2)', () => {
  const zoneOf = (geo: string) => data.zones.find((z) => z.geography === geo)!.id;

  it('jede Form jeder Geografie ist über die Natur-Phase erreichbar', () => {
    const reached: string[] = [];
    for (const geo of data.geographies.values()) {
      const zid = zoneOf(geo.id);
      const stats = [...data.commonStats, geo.special];
      for (const form of geo.forms) {
        // Einen Zustand suchen, in dem genau diese Form die erste passende ist …
        let found: Record<string, number> | null = null;
        for (const v of combos(stats)) {
          const s = game();
          setStats(s, zid, v);
          if (formFor(data, s, zone(s, zid)).id === form.id) {
            found = v;
            break;
          }
        }
        expect(found, `${geo.id}/${form.id} unerreichbar`).not.toBeNull();
        // … und prüfen, dass das Formen-Modul sie dort auch setzt.
        const s = game();
        setStats(s, zid, found!);
        runRules(s, ['forms']);
        expect(zone(s, zid).form).toBe(form.id);
        reached.push(form.id);
      }
    }
    expect(reached).toHaveLength(data.forms.size);
    expect(data.forms.size).toBe(26);
  });

  it('jede Geografie hat genau eine Idealform und mindestens eine verödete Form', () => {
    for (const g of data.geographies.values()) {
      expect(g.forms.filter((f) => f.kind === 'ideal')).toHaveLength(1);
      expect(g.forms.some((f) => f.kind === 'degraded')).toBe(true);
    }
  });

  const cases: [string, Record<string, number>, string][] = [
    // Berge
    ['mountains', { snow: 5, vegetation: 0 }, 'glacier'], // Gletscher vor Geröll
    ['mountains', { vegetation: 0, snow: 1 }, 'scree'],
    ['mountains', { vegetation: 2, snow: 2, light: 3 }, 'alpine_meadow'],
    ['mountains', { vegetation: 3, snow: 1, light: 2 }, 'rock'], // zu wenig Licht für die Alm
    ['mountains', { vegetation: 4, snow: 3 }, 'mountain_forest'],
    // Wald
    ['forest', { vegetation: 1, deadwood: 3 }, 'burnt_land'],
    ['forest', { moisture: 1, vegetation: 5, deadwood: 2 }, 'dry_forest'], // Trockenwald vor Urwald
    ['forest', { vegetation: 5, moisture: 4, deadwood: 3 }, 'primeval_forest'],
    ['forest', { vegetation: 5, moisture: 4, deadwood: 4 }, 'mixed_forest'], // Totholz zu hoch
    ['forest', { light: 3, vegetation: 2, moisture: 3, deadwood: 2 }, 'open_forest'],
    // Flachland
    ['plains', { vegetation: 0, moisture: 1 }, 'wasteland'],
    ['plains', { moisture: 4, soil: 5, vegetation: 3, light: 5 }, 'bog'], // Moor vor Blumenwiese
    ['plains', { moisture: 3, soil: 4, vegetation: 4, light: 3 }, 'flower_meadow'],
    ['plains', { moisture: 2, soil: 2 }, 'steppe'],
    ['plains', { moisture: 3, vegetation: 5 }, 'shrubland'],
    ['plains', { moisture: 3, vegetation: 3, soil: 3 }, 'meadow'],
    // Fluss
    ['river', { water: 0 }, 'dry_riverbed'],
    ['river', { water: 5 }, 'flood'],
    ['river', { water: 2 }, 'brook'],
    ['river', { water: 3, vegetation: 4 }, 'floodplain'],
    ['river', { water: 4, vegetation: 4 }, 'stream'],
    // Küste
    ['coast', { salt: 5, moisture: 2 }, 'salt_flat'],
    ['coast', { salt: 3, moisture: 4, vegetation: 4, light: 4 }, 'mangrove'], // Mangrove vor Riff
    ['coast', { light: 4, salt: 3, vegetation: 1 }, 'reef'],
    ['coast', { light: 3, moisture: 4, vegetation: 2, salt: 1 }, 'mudflat'],
    ['coast', { light: 3, moisture: 3, salt: 1 }, 'beach'],
  ];
  it.each(cases)('%s mit %j → %s', (geo, stats, expected) => {
    const s = game();
    const zid = zoneOf(geo);
    setStats(s, zid, stats);
    expect(formFor(data, s, zone(s, zid)).id).toBe(expected);
  });

  it('Ruhewerte ergeben normale Formen (Startwelt ist weder ideal noch verödet)', () => {
    const s = game();
    for (const z of s.zones) expect(data.forms.get(z.form)!.form.kind).toBe('normal');
  });

  it('Formwechsel wird gemeldet und merkt sich die Runde', () => {
    const s = game();
    s.round = 7;
    setStats(s, 'river', { water: 0 });
    const events = runRules(s, ['forms']);
    expect(events).toContainEqual({ type: 'formChanged', zone: 'river', from: 'stream', to: 'dry_riverbed' });
    expect(zone(s, 'river').formSince).toBe(7);
    expect(runRules(s, ['forms'])).toEqual([]);
  });

  it('Hochwasser ist eine Störungsform und stört die Flusszone', () => {
    const s = game();
    s.round = 3;
    setStats(s, 'river', { water: 5 });
    const events = runRules(s, ['forms']);
    expect(zone(s, 'river').form).toBe('flood');
    expect(zone(s, 'river').lastDisturbance).toBe(3);
    expect(events).toContainEqual({ type: 'disturbance', zone: 'river', cause: 'form:flood' });
  });
});

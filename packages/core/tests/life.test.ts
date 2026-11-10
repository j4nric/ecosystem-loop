/** Konzept 5.1, 5.4, 7, 10: Bestände, Fressen, Hunger, Überpopulation, Wanderung, Aussterben, Mensch, Wertung. */
import { describe, expect, it } from 'vitest';
import { view } from '../src/game.ts';
import { breathIncome } from '../src/rules/breath.ts';
import { harmonyParts } from '../src/rules/harmony.ts';
import { feed } from '../src/rules/life.ts';
import { lifeParams } from '../src/population.ts';
import { bare, data, dataWith, endTurn, game, runRules, setPops, setStats, shape, zone } from './helpers.ts';

const pops = (s: ReturnType<typeof bare>, id: string) => zone(s, id).populations;

describe('Startleben (Konzept 5.3)', () => {
  it('Plankton im Wasser, Käfer an Land – in jedem Szenario', () => {
    for (const scenario of data.scenarios.keys()) {
      const s = game({ scenario });
      expect(pops(s, 'river').plankton, scenario).toBeGreaterThan(0);
      expect(pops(s, 'coast').plankton, scenario).toBeGreaterThan(0);
      expect(pops(s, 'forest').beetle, scenario).toBeGreaterThan(0);
      expect(pops(s, 'plains').beetle, scenario).toBeGreaterThan(0);
      expect(s.species).toEqual({ plankton: { since: 0, extinct: null }, beetle: { since: 0, extinct: null } });
    }
  });
});

describe('Fressen, Wachstum, Hunger (Konzept 5.1)', () => {
  /** Ohne Wanderung, damit die Bestände einer Zone allein betrachtet werden. */
  const d = dataWith((r) => {
    r.config.rules.life.migration.from = 10;
  });
  const life = (s: ReturnType<typeof bare>) => runRules(s, ['life'], d);
  it('genug Nahrung und passende Form: Bestand +1', () => {
    const s = bare(1, d);
    setPops(s, 'river', { plankton: 3 }); // Licht 3 ernährt 6
    const events = life(s);
    expect(pops(s, 'river').plankton).toBe(4);
    expect(events).toContainEqual({
      type: 'populationChanged',
      zone: 'river',
      species: 'plankton',
      from: 3,
      to: 4,
      cause: 'growth',
    });
    expect(zone(s, 'river').lastHunger).toBeNull();
  });

  it('zu wenig Nahrung: Hunger −1, Zone zählt für die Harmonie', () => {
    const s = bare(1, d);
    setPops(s, 'river', { plankton: 9 });
    const events = life(s);
    expect(pops(s, 'river').plankton).toBe(8);
    expect(events).toContainEqual({ type: 'hunger', zone: 'river', species: 'plankton' });
    expect(zone(s, 'river').lastHunger).toBe(1);
    expect(harmonyParts(data, s)).toContainEqual({ source: 'hunger', zone: 'river', amount: -1 });
  });

  it('der Bestand bleibt in 0–9', () => {
    const s = bare(1, d);
    setPops(s, 'coast', { plankton: 9 });
    setStats(s, 'coast', { light: 5 }); // ernährt 10
    life(s);
    expect(pops(s, 'coast').plankton).toBe(9);
    expect(lifeParams(data).max).toBe(9);
  });

  it('Fresskette: Fische fressen Plankton', () => {
    const s = bare(1, d);
    setPops(s, 'river', { plankton: 5, fish: 3 });
    life(s);
    expect(pops(s, 'river')).toEqual({ plankton: 6, fish: 4 });
  });

  it('zu viele Räuber: Hunger und die Beute wird dezimiert', () => {
    const s = bare(1, d);
    shape(s, 'coast', { light: 3, salt: 1 }, d);
    setPops(s, 'river', { plankton: 2, fish: 6 });
    const events = life(s);
    // Plankton wächst (2 → 3) und wird dann leergefressen (−1); Fische hungern (6 → 5)
    expect(pops(s, 'river')).toEqual({ plankton: 2, fish: 5 });
    expect(events).toContainEqual({ type: 'overpopulation', zone: 'river', food: 'plankton' });
    expect(events).toContainEqual({
      type: 'populationChanged',
      zone: 'river',
      species: 'plankton',
      from: 3,
      to: 2,
      cause: 'overhunted',
    });
  });

  it('Räuber jagen auch in Nachbarzonen (abschaltbar)', () => {
    const s = bare(1, d);
    setPops(s, 'mountains', { lizard: 2 }); // Fels: Lebensraum der Echse, aber keine Käfer
    setPops(s, 'forest', { beetle: 4 });
    life(s);
    expect(pops(s, 'mountains').lizard).toBe(3);

    const own = dataWith((r) => {
      r.config.rules.life.food.huntNeighbors = false;
    });
    const t = bare(1, own);
    setPops(t, 'mountains', { lizard: 2 });
    setPops(t, 'forest', { beetle: 4 });
    runRules(t, ['life'], own);
    expect(pops(t, 'mountains').lizard).toBe(1);
  });

  it('Konkurrenz: niedrige Stufen fressen zuerst, Speiseplan der Reihe nach', () => {
    const s = bare(1, d);
    setPops(s, 'plains', { bee: 4, deer: 4 }); // Vegetation 3 ernährt 6
    const f = feed(d, s, lifeParams(d));
    expect(f.hungry.get('plains')).toEqual(['deer']);
    expect(f.exhausted.get('plains')).toEqual(['vegetation']);
    setPops(s, 'forest', { beetle: 6 }); // Totholz 2 ernährt 4, der Rest frisst Vegetation
    expect(feed(d, s, lifeParams(d)).hungry.has('forest')).toBe(false);
  });

  it('Überweidung senkt Vegetation und Boden', () => {
    const s = bare(1, d);
    setPops(s, 'plains', { deer: 9 });
    const events = life(s);
    expect(pops(s, 'plains').deer).toBe(8);
    expect(zone(s, 'plains').stats).toMatchObject({ vegetation: 2, soil: 2 });
    expect(events).toContainEqual({ type: 'overpopulation', zone: 'plains', food: 'vegetation' });
    expect(events).toContainEqual({
      type: 'statChanged',
      zone: 'plains',
      stat: 'soil',
      from: 3,
      to: 2,
      cause: 'overpopulation',
    });
    expect(zone(s, 'plains').lastHunger).toBe(1);
  });

  it('Winter pausiert das Wachstum, Hunger wirkt weiter', () => {
    const s = bare(4, d);
    expect(data.seasons[3]!.pausesGrowth).toBe(true);
    setPops(s, 'river', { plankton: 3 });
    setPops(s, 'coast', { plankton: 9 });
    setStats(s, 'coast', { light: 2 });
    life(s);
    expect(pops(s, 'river').plankton).toBe(3);
    expect(pops(s, 'coast').plankton).toBe(8);
  });

  it('außerhalb des Lebensraums: kein Wachstum; in verödeter Form −1', () => {
    const s = bare(1, d);
    setPops(s, 'forest', { deer: 2 }); // Mischwald ist kein Hirsch-Lebensraum
    shape(s, 'mountains', { vegetation: 0, snow: 0 }, d); // Geröll (verödet)
    setPops(s, 'mountains', { plankton: 3 });
    const events = life(s);
    expect(pops(s, 'forest').deer).toBe(2);
    expect(pops(s, 'mountains').plankton).toBe(2);
    expect(events).toContainEqual({
      type: 'populationChanged',
      zone: 'mountains',
      species: 'plankton',
      from: 3,
      to: 2,
      cause: 'degraded',
    });
  });

  it('Brandfläche ist trotz Verödung Lebensraum der Käfer', () => {
    const s = bare(1, d);
    shape(s, 'forest', { vegetation: 0, deadwood: 4 }, d);
    expect(zone(s, 'forest').form).toBe('burnt_land');
    setPops(s, 'forest', { beetle: 3 });
    life(s);
    expect(pops(s, 'forest').beetle).toBe(4);
  });
});

describe('Wanderung (Konzept 5.1)', () => {
  it('ab Bestand 4 (nach dem Wachstum) wandert 1 Tier in eine passende Nachbarzone', () => {
    const s = bare();
    setPops(s, 'river', { plankton: 4 });
    const events = runRules(s, ['life']);
    expect(pops(s, 'river').plankton).toBe(4); // 4 → 5, dann 1 zur Küste
    expect(pops(s, 'coast').plankton).toBe(1); // Riff passt; Berge, Wald, Flachland nicht
    expect(events).toContainEqual({ type: 'migrated', species: 'plankton', from: 'river', to: 'coast', count: 1 });
  });

  it('keine Wanderung ohne passende Nachbarzone oder in eine volle Zone', () => {
    const s = bare();
    shape(s, 'coast', { light: 3, salt: 1 }); // Strand
    setPops(s, 'river', { plankton: 5 });
    runRules(s, ['life']);
    expect(pops(s, 'river').plankton).toBe(6);
    expect(pops(s, 'coast').plankton).toBeUndefined();

    const t = bare();
    setPops(t, 'river', { plankton: 5 });
    setPops(t, 'coast', { plankton: 9 });
    setStats(t, 'coast', { light: 5 });
    const events = runRules(t, ['life']);
    expect(events.some((e) => e.type === 'migrated' && e.to === 'coast')).toBe(false);
  });
});

describe('Aussterben (Konzept 5.1, 7)', () => {
  it('Bestand 0 in allen Zonen ⇒ Ereignis und einmalig Harmonie −10', () => {
    const s = bare();
    setPops(s, 'forest', { beetle: 1 });
    setStats(s, 'forest', { deadwood: 0, vegetation: 0 });
    const events = runRules(s, ['life']);
    expect(events).toContainEqual({ type: 'speciesExtinct', species: 'beetle' });
    expect(s.species.beetle).toEqual({ since: 0, extinct: 1 });
    expect(harmonyParts(data, s)).toContainEqual({ source: 'extinction:beetle', zone: null, amount: -10 });
    s.round = 2;
    expect(runRules(s, ['life']).some((e) => e.type === 'speciesExtinct')).toBe(false);
    expect(harmonyParts(data, s).some((p) => p.source.startsWith('extinction'))).toBe(false);
  });

  it('lebt die Art noch in einer anderen Zone, stirbt sie nicht aus', () => {
    const s = bare();
    setPops(s, 'forest', { beetle: 1 });
    setPops(s, 'plains', { beetle: 2 });
    setStats(s, 'forest', { deadwood: 0, vegetation: 0 });
    expect(runRules(s, ['life']).some((e) => e.type === 'speciesExtinct')).toBe(false);
  });
});

describe('Der Mensch (Konzept 5.4)', () => {
  it('jagt Pflanzenfresser, kostet Harmonie je Tier und verdoppelt die Wertung', () => {
    const s = bare();
    setPops(s, 'plains', { human: 2, deer: 3, small_mammal: 2 });
    const events = runRules(s, ['life']);
    // Wachstum: Kleinsäuger 3, Hirsch 4, Mensch 3 – dann jagen die Menschen: Kleinsäuger 2, Hirsch 3
    expect(pops(s, 'plains')).toEqual({ human: 3, deer: 3, small_mammal: 2 });
    expect(events).toContainEqual({
      type: 'populationChanged',
      zone: 'plains',
      species: 'deer',
      from: 4,
      to: 3,
      cause: 'hunted',
    });
    expect(harmonyParts(data, s)).toContainEqual({ source: 'humans', zone: null, amount: -1.5 });
    const scored = runRules(s, ['score']);
    expect(scored).toEqual([{ type: 'scored', points: (5 + 6 + 7) * 2, total: 36, doubled: true }]);
  });
});

describe('Harmonie und Odem mit Leben (Konzept 6.1, 7)', () => {
  it('+0,5 je lebender Art', () => {
    const s = bare();
    setPops(s, 'river', { plankton: 2, fish: 1 });
    setPops(s, 'forest', { beetle: 2 });
    expect(harmonyParts(data, s)).toContainEqual({ source: 'species', zone: null, amount: 1.5 });
  });

  it('Odem-Bonus ab 6 lebenden Arten', () => {
    const s = bare();
    setPops(s, 'river', { plankton: 2, fish: 1, frog: 1 });
    setPops(s, 'forest', { beetle: 2, bee: 1 });
    expect(breathIncome(data, s)).toBe(3);
    setPops(s, 'mountains', { lizard: 1 });
    expect(breathIncome(data, s)).toBe(4);
  });
});

describe('Wertung (Konzept 10)', () => {
  it('Summe der Stufen lebender Arten je Runde, kumuliert', () => {
    const s = bare();
    setPops(s, 'river', { plankton: 2, fish: 1 });
    expect(runRules(s, ['score'])).toEqual([{ type: 'scored', points: 3, total: 3, doubled: false }]);
    runRules(s, ['score']);
    expect(s.score).toBe(6);
    expect(view(data, s).score).toBe(6);
  });

  it('läuft in der Natur-Phase und zählt auch Ausgestorbene nicht', () => {
    let s = game();
    s.hand = [];
    s.drawPile = [];
    s = endTurn(s).state;
    expect(s.score).toBe(2); // Plankton + Käfer
  });
});

describe('Ansicht mit Leben', () => {
  it('populations in Daten-Reihenfolge, highestTier aus allen je gelebten Arten', () => {
    const s = bare();
    setPops(s, 'river', { fish: 2, plankton: 3 });
    s.species.deer = { since: 3, extinct: 5 };
    const v = view(data, s, 'en');
    expect(v.zones.find((z) => z.id === 'river')!.populations).toEqual([
      { species: 'plankton', name: 'Plankton', tier: 1, count: 3, group: 'water' },
      { species: 'fish', name: 'Fish', tier: 2, count: 2, group: 'water' },
    ]);
    expect(v.highestTier).toBe(6);
    expect(view(data, bare()).highestTier).toBe(0);
  });
});

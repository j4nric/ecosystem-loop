/** Konzept 5.2, 5.3, 4.4: Evolution entlang des Stammbaums, Zonenstufe, Selektionsdruck, Gaben. */
import { describe, expect, it } from 'vitest';
import { evolutionTarget } from '../src/rules/evolution.ts';
import type { GameEvent, GameState } from '../src/state.ts';
import { bare, data, dataWith, endTurn, game, runRules, setPops, shape, zone } from './helpers.ts';

/** Lässt nur das Evolutions-Modul n Runden ab Runde `from` laufen. */
function evolve(s: GameState, n: number, from = 1, d = data): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    s.round = from + i;
    events.push(...runRules(s, ['evolution'], d));
  }
  return events;
}

interface Setup {
  /** Zone mit dem Vorfahren. */
  zone: string;
  /** Werte, aus denen die Form der Zone (und ggf. von Nachbarn) bestimmt wird. */
  shape?: Record<string, Record<string, number>>;
  pops: Record<string, number>;
  level: number;
  /** Störung in dieser Zone in Runde 1 (Selektionsdruck). */
  disturbed?: boolean;
  /** Erwartete Zone der neuen Art. */
  settles: string;
}

const URWALD = { vegetation: 5, moisture: 4, deadwood: 2 };

/** Ein konstruiertes Szenario je Art (Abnahme Phase 2: jede Art entsteht). */
const TREE: Record<string, Setup> = {
  fish: { zone: 'river', pops: { plankton: 5 }, level: 1, settles: 'river' },
  bee: { zone: 'forest', shape: { forest: URWALD }, pops: { beetle: 5 }, level: 1, settles: 'forest' },
  frog: {
    zone: 'river',
    shape: { river: { water: 3, vegetation: 4 } }, // Aue
    pops: { fish: 5 },
    level: 1,
    settles: 'river',
  },
  lizard: {
    zone: 'plains',
    shape: { plains: { moisture: 4 }, forest: { moisture: 1, vegetation: 3 } }, // Moor, daneben Trockenwald
    pops: { frog: 5 },
    level: 2,
    disturbed: true,
    settles: 'forest',
  },
  small_mammal: {
    zone: 'plains',
    shape: { plains: { moisture: 2 } }, // Steppe: Echse und Kleinsäuger, kein Vogel
    pops: { lizard: 5 },
    level: 3,
    disturbed: true,
    settles: 'plains',
  },
  bird: {
    zone: 'mountains', // Fels: Echse; Vogel nur im Lichten Wald nebenan
    shape: { forest: { light: 3, vegetation: 3 } },
    pops: { lizard: 5 },
    level: 3,
    disturbed: true,
    settles: 'forest',
  },
  deer: {
    zone: 'plains',
    shape: { plains: { soil: 4 } }, // Blumenwiese
    pops: { small_mammal: 5 },
    level: 4,
    disturbed: true,
    settles: 'plains',
  },
  wolf: {
    zone: 'forest',
    shape: { forest: URWALD },
    pops: { small_mammal: 9, deer: 1 }, // Hirsch, Wolf und Primat entstehen zugleich
    level: 4,
    disturbed: true,
    settles: 'forest',
  },
  raptor: {
    zone: 'forest',
    shape: { forest: URWALD }, // Vogel im Urwald, Greifvogel auf dem Fels der Berge
    pops: { bird: 5 },
    level: 4,
    disturbed: true,
    settles: 'mountains',
  },
  primate: {
    zone: 'forest',
    shape: { forest: URWALD },
    pops: { small_mammal: 9 }, // im Urwald entsteht zuerst der Hirsch (Daten-Reihenfolge)
    level: 4,
    disturbed: true,
    settles: 'forest',
  },
  human: {
    zone: 'forest',
    shape: { forest: URWALD }, // Urwald Stufe 5 am Fluss; Menschen siedeln auf der Wiese nebenan
    pops: { primate: 5 },
    level: 5,
    disturbed: true,
    settles: 'plains',
  },
};

function build(setup: Setup, d = data): GameState {
  const s = bare(1, d);
  for (const [id, v] of Object.entries(setup.shape ?? {})) shape(s, id, v, d);
  setPops(s, setup.zone, setup.pops);
  zone(s, setup.zone).level = setup.level;
  // Die Zonenstufe gilt für die Zielzone (Konzept 4.4); bei „Landgang“ braucht auch sie die Stufe.
  zone(s, setup.settles).level = setup.level;
  if (setup.disturbed) zone(s, setup.zone).lastDisturbance = 1;
  return s;
}

describe('Stammbaum (Konzept 5.3)', () => {
  it('enthält alle 13 Arten mit Stufe und Vorfahr', () => {
    expect([...data.species.values()].map((s) => [s.id, s.tier, s.ancestor])).toEqual([
      ['plankton', 1, null],
      ['beetle', 1, null],
      ['fish', 2, 'plankton'],
      ['bee', 2, 'beetle'],
      ['frog', 3, 'fish'],
      ['lizard', 4, 'frog'],
      ['small_mammal', 5, 'lizard'],
      ['bird', 5, 'lizard'],
      ['deer', 6, 'small_mammal'],
      ['wolf', 6, 'small_mammal'],
      ['raptor', 6, 'bird'],
      ['primate', 6, 'small_mammal'],
      ['human', 7, 'primate'],
    ]);
    for (const sp of data.species.values()) for (const c of sp.gift) expect(data.cards.has(c), c).toBe(true);
    expect(data.species.get('human')!.gift).toEqual(['fire', 'farming', 'settlement']);
  });

  it.each(Object.entries(TREE))('%s entsteht in einem konstruierten Szenario', (species, setup) => {
    const s = build(setup);
    const ancestor = data.species.get(species)!.ancestor!;
    const drawBefore = s.drawPile.length;
    expect(evolve(s, 2).some((e) => e.type === 'speciesEmerged')).toBe(false);
    expect(zone(s, setup.zone).evolution[species]).toBe(2);
    const events = evolve(s, 1, 3);
    expect(events).toContainEqual({
      type: 'speciesEmerged',
      species,
      ancestor,
      from: setup.zone,
      zone: setup.settles,
      first: true,
    });
    expect(zone(s, setup.settles).populations[species]).toBe((setup.pops[species] ?? 0) + 2);
    expect(zone(s, setup.zone).populations[ancestor] ?? 0).toBeLessThanOrEqual(setup.pops[ancestor]! - 2);
    expect(s.species[species]).toEqual({ since: 3, extinct: null });
    // Die Gabe kommt in den Nachziehstapel
    const gifts = data.species.get(species)!.gift;
    expect(s.drawPile.length).toBeGreaterThanOrEqual(drawBefore + gifts.length);
    expect(s.drawPile.map((c) => c.card)).toEqual(expect.arrayContaining(gifts));
    const added = events.flatMap((e) => (e.type === 'giftAdded' && e.species === species ? [e.card] : []));
    expect(added).toEqual(gifts);
  });
});

describe('Evolutionsbedingungen (Konzept 5.2, 4.4)', () => {
  it('Vorfahr braucht Bestand ≥ 4', () => {
    const s = build({ ...TREE.fish!, pops: { plankton: 3 } });
    expect(evolve(s, 5).some((e) => e.type === 'speciesEmerged')).toBe(false);
    const t = build({ ...TREE.fish!, pops: { plankton: 4 } });
    expect(evolve(t, 3).some((e) => e.type === 'speciesEmerged' && e.species === 'fish')).toBe(true);
  });

  it('Bedingungen müssen 3 Runden am Stück gelten – eine Unterbrechung setzt zurück', () => {
    const s = build(TREE.fish!);
    evolve(s, 2);
    zone(s, 'river').populations.plankton = 3;
    evolve(s, 1, 3);
    expect(zone(s, 'river').evolution.fish).toBeUndefined();
    zone(s, 'river').populations.plankton = 5;
    expect(evolve(s, 2, 4).some((e) => e.type === 'speciesEmerged')).toBe(false);
    expect(evolve(s, 1, 6).some((e) => e.type === 'speciesEmerged')).toBe(true);
  });

  it('die Form muss für die neue Art passen (in der Zone oder einer Nachbarzone)', () => {
    // Bienen leben weder im Mischwald noch in dessen Nachbarn (Fels, Strom, Wiese)
    const s = build({ ...TREE.bee!, shape: {} });
    expect(evolutionTarget(data, s, zone(s, 'forest'), data.species.get('bee')!)).toBeNull();
    shape(s, 'mountains', { vegetation: 2, snow: 2 }); // Alm nebenan
    expect(evolutionTarget(data, s, zone(s, 'forest'), data.species.get('bee')!)?.id).toBe('mountains');
  });

  it('Zonenstufe ≥ Stufe − 3', () => {
    const s = build({ ...TREE.deer!, level: 2 });
    expect(evolve(s, 3).some((e) => e.type === 'speciesEmerged')).toBe(false);
    zone(s, 'plains').level = 3;
    zone(s, 'plains').lastDisturbance = 4;
    expect(evolve(s, 3, 4).some((e) => e.type === 'speciesEmerged' && e.species === 'deer')).toBe(true);
  });

  it('Zonenstufe zählt an der Zielzone: Landgang nur in eine Nachbarzone mit ausreichender Stufe', () => {
    // Echse auf dem Fels (Berge, Stufe 3), der Vogel (Stufe 5) kann nur im Lichten Wald nebenan leben.
    const s = build(TREE.bird!);
    zone(s, 'forest').level = 1;
    expect(evolutionTarget(data, s, zone(s, 'mountains'), data.species.get('bird')!)).toBeNull();
    expect(evolve(s, 3).some((e) => e.type === 'speciesEmerged')).toBe(false);
    zone(s, 'forest').level = 2;
    zone(s, 'mountains').lastDisturbance = 4;
    expect(evolutionTarget(data, s, zone(s, 'mountains'), data.species.get('bird')!)?.id).toBe('forest');
    expect(evolve(s, 3, 4).some((e) => e.type === 'speciesEmerged' && e.species === 'bird')).toBe(true);
  });

  it('Echse (Stufe 4) entsteht schon in einer Zone der Stufe 1 (Stufe − 3)', () => {
    const s = build({ ...TREE.lizard!, level: 1 });
    expect(evolutionTarget(data, s, zone(s, 'plains'), data.species.get('lizard')!)?.id).toBe('forest');
  });

  it('Selektionsdruck ab Stufe 4: ohne Störung keine Evolution, mit Störung (auch nebenan) schon', () => {
    const s = build({ ...TREE.lizard!, disturbed: false });
    expect(evolve(s, 4).some((e) => e.type === 'speciesEmerged')).toBe(false);
    zone(s, 'river').lastDisturbance = 5; // Nachbarzone
    expect(evolve(s, 3, 5).some((e) => e.type === 'speciesEmerged' && e.species === 'lizard')).toBe(true);
  });

  it('die Störung zählt nur 4 Runden lang', () => {
    const s = build(TREE.small_mammal!); // Störung in Runde 1
    expect(evolve(s, 2, 4).some((e) => e.type === 'speciesEmerged')).toBe(false); // Runde 4 ok, Runde 5 nicht mehr
    expect(zone(s, 'plains').evolution.small_mammal).toBeUndefined();
  });

  it('unter Stufe 4 kein Selektionsdruck nötig', () => {
    const s = build(TREE.frog!);
    expect(s.zones.every((z) => z.lastDisturbance === null)).toBe(true);
    expect(evolve(s, 3).some((e) => e.type === 'speciesEmerged' && e.species === 'frog')).toBe(true);
  });

  it('Wolf braucht Hirsche', () => {
    const s = build({ ...TREE.wolf!, pops: { small_mammal: 5 } });
    expect(evolve(s, 3).some((e) => e.type === 'speciesEmerged' && e.species === 'wolf')).toBe(false);
  });

  it('Primat nur im Urwald (nicht über eine Nachbarzone)', () => {
    const s = build({ ...TREE.primate!, zone: 'plains', shape: { plains: { soil: 4 }, forest: URWALD } });
    expect(evolve(s, 3).some((e) => e.type === 'speciesEmerged' && e.species === 'primate')).toBe(false);
  });

  it('Mensch nur aus einer Zone mit Stufe ≥ 5', () => {
    const s = build({ ...TREE.human!, level: 4 });
    expect(evolve(s, 3).some((e) => e.type === 'speciesEmerged' && e.species === 'human')).toBe(false);
  });

  it('Mensch nur am Fluss', () => {
    const d = dataWith((r) => {
      // Insel ohne Fluss-Nachbarschaft für den Wald
      const zones = r.map.zones as { id: string; neighbors: string[] }[];
      zones.find((z) => z.id === 'forest')!.neighbors = ['mountains', 'plains'];
      zones.find((z) => z.id === 'river')!.neighbors = ['mountains', 'plains', 'coast'];
    });
    const s = build(TREE.human!, d);
    expect(evolve(s, 3, 1, d).some((e) => e.type === 'speciesEmerged' && e.species === 'human')).toBe(false);
  });

  it('erneute Entstehung nach dem Aussterben: Ereignis ohne neue Gabe', () => {
    const s = build(TREE.fish!);
    s.species.fish = { since: 2, extinct: 3 };
    const drawBefore = s.drawPile.length;
    const events = evolve(s, 3);
    expect(events).toContainEqual(expect.objectContaining({ type: 'speciesEmerged', species: 'fish', first: false }));
    expect(s.species.fish).toEqual({ since: 2, extinct: null });
    expect(s.drawPile).toHaveLength(drawBefore);
  });

  it('Gaben werden in den Nachziehstapel gemischt (deterministisch je Seed)', () => {
    const run = (seed: string) => {
      const s = game({ hand: [], draw: ['rain', 'sun', 'seeds', 'frost', 'storm', 'drought'], life: false, seed });
      setPops(s, 'river', { plankton: 5 });
      evolve(s, 3);
      return s.drawPile.map((c) => c.card).indexOf('spawning_run');
    };
    expect(run('a')).toBe(run('a'));
    const positions = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(run));
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('Leben in der Partie', () => {
  it('aus dem Startleben entstehen in einer Partie neue Arten (Natur-Phase komplett)', () => {
    let s = game();
    const emerged: string[] = [];
    for (let i = 0; i < 8; i++) {
      s.hand = [];
      const r = endTurn(s);
      for (const e of r.events) if (e.type === 'speciesEmerged') emerged.push(e.species);
      s = r.state;
    }
    expect(emerged).toContain('fish');
    expect(s.score).toBeGreaterThan(0);
  });
});

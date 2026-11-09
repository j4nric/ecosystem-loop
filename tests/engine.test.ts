import { describe, expect, it } from 'vitest';
import { getZone } from '../src/core/conditions.ts';
import {
  canEndExpedition,
  createExpedition,
  endExpedition,
  endTurn,
  legalPlays,
  playCard,
  report,
  RuleError,
  warnings,
} from '../src/core/engine.ts';
import { addAnimal, animalsIn, data, neutralForest, setValues, setup, uidOf, withConfig } from './helpers.ts';

describe('Karten und Schwellen', () => {
  it('Gewitter auf trockener Zone löst Feuer aus (Störung)', () => {
    const s = setup({ hand: ['thunderstorm'] });
    setValues(s, 'b', { moisture: 1, density: 3, deadwood: 0 });
    playCard(data, s, uidOf(s, 'thunderstorm'), { zone: 'b' });
    expect(getZone(s, 'b').values).toMatchObject({ moisture: 3, density: 0, deadwood: 3 });
    expect(getZone(s, 'b').lastDisturbanceTurn).toBe(1);
    expect(s.log.some((e) => e.type === 'triggered' && e.trigger === 'fire')).toBe(true);
  });

  it('Gewitter auf feuchter Zone ist nur Regen', () => {
    const s = setup({ hand: ['thunderstorm'] });
    setValues(s, 'c', { moisture: 2, density: 3 });
    playCard(data, s, uidOf(s, 'thunderstorm'), { zone: 'c' });
    expect(getZone(s, 'c').values).toMatchObject({ moisture: 4, density: 3 });
    expect(s.log.some((e) => e.type === 'triggered')).toBe(false);
  });

  it('Reihenfolge zählt: Dürre → Gewitter brennt, Gewitter → Dürre nicht', () => {
    const a = setup({ hand: ['drought', 'thunderstorm'] });
    setValues(a, 'b', { moisture: 3, density: 2 });
    playCard(data, a, uidOf(a, 'drought'), { zone: 'b' });
    playCard(data, a, uidOf(a, 'thunderstorm'), { zone: 'b' });
    expect(getZone(a, 'b').values.density).toBe(0);

    const b = setup({ hand: ['drought', 'thunderstorm'] });
    setValues(b, 'b', { moisture: 3, density: 2 });
    playCard(data, b, uidOf(b, 'thunderstorm'), { zone: 'b' });
    playCard(data, b, uidOf(b, 'drought'), { zone: 'b' });
    expect(getZone(b, 'b').values.density).toBe(2);
  });

  it('Horst macht eine Zone feuerfest', () => {
    const s = setup({ hand: ['aerie', 'thunderstorm'] });
    setValues(s, 'b', { moisture: 0, density: 3 });
    playCard(data, s, uidOf(s, 'aerie'), { zone: 'b' });
    playCard(data, s, uidOf(s, 'thunderstorm'), { zone: 'b' });
    expect(getZone(s, 'b').values.density).toBe(3);
  });

  it('Sturm auf dichter Zone: Baumsturz hellt die gewählte Nachbarzone auf', () => {
    const s = setup({ hand: ['storm'] });
    setValues(s, 'c', { density: 4 });
    setValues(s, 'b', { light: 1 });
    playCard(data, s, uidOf(s, 'storm'), { zone: 'c', fall: 'b' });
    expect(getZone(s, 'c').values).toMatchObject({ density: 3 });
    expect(getZone(s, 'b').values.light).toBe(3);
  });

  it('Sturm verlangt eine echte Nachbarzone', () => {
    const s = setup({ hand: ['storm'] });
    expect(() => playCard(data, s, uidOf(s, 'storm'), { zone: 'c', fall: 'a' })).toThrow(RuleError);
  });

  it('Werte werden auf 0–5 begrenzt', () => {
    const s = setup({ hand: ['thunderstorm'] });
    setValues(s, 'e', { moisture: 5 });
    playCard(data, s, uidOf(s, 'thunderstorm'), { zone: 'e' });
    expect(getZone(s, 'e').values.moisture).toBe(5);
  });

  it('Fruchtregen wirkt wie Samenflug inkl. Schwelle', () => {
    const s = setup({ hand: ['fruit_rain'] });
    setValues(s, 'b', { light: 4, density: 1 });
    playCard(data, s, uidOf(s, 'fruit_rain'), { zone: 'b' });
    const b = getZone(s, 'b');
    expect(b.values.density).toBe(2);
    expect(b.tags).toContain('flowers');
    expect(getZone(s, 'a').tags).toContain('fruit');
  });

  it('Trampelpfad verbindet zwei Zonen dauerhaft', () => {
    const s = setup({ hand: ['trail'] });
    playCard(data, s, uidOf(s, 'trail'), { zone: 'a', other: 'c' });
    expect(getZone(s, 'a').neighbors).toContain('c');
    expect(getZone(s, 'c').neighbors).toContain('a');
  });

  it('Scheu ist nur auf Zonen mit Tieren spielbar und bewegt das Tier', () => {
    const s = setup({ hand: ['shy'] });
    expect(legalPlays(data, s)).toHaveLength(0);
    addAnimal(s, 'a', 'frog');
    playCard(data, s, uidOf(s, 'shy'), { zone: 'a', animal: 'frog', to: 'e' });
    expect(animalsIn(s, 'a')).toEqual([]);
    expect(animalsIn(s, 'e')).toEqual(['frog']);
  });

  it('Warnung 🔥 erscheint für trockene Zonen, wenn Gewitter auf der Hand ist', () => {
    const s = setup({ hand: ['thunderstorm'] });
    neutralForest(s);
    setValues(s, 'b', { moisture: 1 });
    expect(warnings(data, s).filter((w) => w.trigger === 'fire').map((w) => w.zone)).toEqual(['b']);
  });
});

describe('Zugablauf', () => {
  it('Kartenzwang: Zug kann nicht ohne Karte beendet werden', () => {
    const s = setup({ hand: ['seeds'] });
    expect(() => endTurn(data, s)).toThrow(RuleError);
  });

  it('Mehrere Karten pro Zug, danach wird auf Handgröße nachgezogen', () => {
    const s = setup({ hand: ['seeds', 'seeds', 'drought'], draw: ['storm', 'storm', 'storm', 'storm', 'storm'] });
    neutralForest(s);
    playCard(data, s, uidOf(s, 'seeds'), { zone: 'a' });
    playCard(data, s, uidOf(s, 'seeds'), { zone: 'a' });
    endTurn(data, s);
    expect(s.turn).toBe(2);
    expect(s.hand).toHaveLength(data.config.hand.size);
    expect(s.drawPile).toHaveLength(2);
  });

  it('Leerer Nachziehstapel beendet die Expedition', () => {
    const s = setup({ hand: ['seeds'], draw: [] });
    neutralForest(s);
    playCard(data, s, uidOf(s, 'seeds'), { zone: 'a' });
    endTurn(data, s);
    expect(s.phase).toBe('ended');
    expect(s.endReason).toBe('deckEmpty');
  });

  it('Aussteigen geht nur zu Zugbeginn', () => {
    const s = setup({ hand: ['seeds', 'seeds'] });
    neutralForest(s);
    expect(canEndExpedition(s)).toBe(true);
    playCard(data, s, uidOf(s, 'seeds'), { zone: 'a' });
    expect(() => endExpedition(s)).toThrow(RuleError);
    endTurn(data, s);
    endExpedition(s);
    expect(s.endReason).toBe('voluntary');
  });

  it('maxPlaysPerTurn begrenzt die Karten pro Zug', () => {
    const d = withConfig((c) => (c.hand.maxPlaysPerTurn = 1));
    const s = setup({ hand: ['seeds', 'seeds'], d });
    playCard(d, s, uidOf(s, 'seeds'), { zone: 'a' });
    expect(legalPlays(d, s)).toHaveLength(0);
  });

  it('Gleicher Seed → gleicher Verlauf', () => {
    const run = () => {
      const s = createExpedition(data, { deck: data.config.starterDeck, seed: 42 });
      for (let i = 0; i < 3 && s.phase === 'play'; i++) {
        const p = legalPlays(data, s)[0]!;
        playCard(data, s, p.uid, p.choices);
        endTurn(data, s);
      }
      return s.log;
    };
    expect(run()).toEqual(run());
  });
});

describe('Ökosystem am Zugende', () => {
  it('Tier zieht ein, wenn sein Steckbrief erfüllt ist, und bringt seine Karte', () => {
    const s = setup({ hand: ['storm'] });
    neutralForest(s);
    setValues(s, 'c', { deadwood: 1, density: 3 });
    playCard(data, s, uidOf(s, 'storm'), { zone: 'c', fall: 'b' }); // Totholz 1 → 2
    endTurn(data, s);
    expect(animalsIn(s, 'c')).toEqual(['beetle']);
    expect([...s.hand, ...s.drawPile].some((c) => c.card === 'decomposition')).toBe(true);
    expect(s.arrivedSpecies).toEqual(['beetle']);
  });

  it('Tier zieht aus, wenn sein Steckbrief verletzt ist', () => {
    const s = setup({ hand: ['decomposition'] });
    neutralForest(s);
    setValues(s, 'c', { deadwood: 2 });
    addAnimal(s, 'c', 'beetle');
    playCard(data, s, uidOf(s, 'decomposition'), { zone: 'c' });
    endTurn(data, s);
    expect(animalsIn(s, 'c')).toEqual([]);
  });

  it('Pro Zone zieht höchstens ein Tier je Zug ein', () => {
    const s = setup({ hand: ['seeds'] });
    neutralForest(s);
    setValues(s, 'a', { deadwood: 3, moisture: 5 }); // Käfer und Frosch möglich
    playCard(data, s, uidOf(s, 'seeds'), { zone: 'b' });
    endTurn(data, s);
    expect(animalsIn(s, 'a')).toHaveLength(1);
  });

  it('Einzugsverzögerung wird berücksichtigt', () => {
    const d = withConfig((c) => (c.arrival.delayTurns = 1));
    const s = setup({ hand: ['seeds'], d, draw: ['seeds', 'seeds', 'seeds', 'seeds', 'seeds'] });
    neutralForest(s);
    setValues(s, 'c', { deadwood: 3 });
    playCard(d, s, uidOf(s, 'seeds'), { zone: 'b' });
    endTurn(d, s);
    expect(animalsIn(s, 'c')).toEqual([]);
    playCard(d, s, s.hand[0]!.uid, { zone: 'b' });
    endTurn(d, s);
    expect(animalsIn(s, 'c')).toEqual(['beetle']);
  });

  it('Fresser: Specht frisst Käfer nach 3 Zügen und zieht dann selbst aus', () => {
    const s = setup({ hand: [], draw: Array(20).fill('seeds') });
    neutralForest(s);
    setValues(s, 'c', { deadwood: 3, density: 3 });
    addAnimal(s, 'c', 'beetle');
    addAnimal(s, 'c', 'woodpecker');
    // Andere Käfer-Zonen ausschließen; Samenflug auf a, das niemanden interessiert.
    const turn = () => {
      s.hand = s.hand.length ? s.hand : [{ uid: 9000 + s.turn, card: 'seeds' }];
      playCard(data, s, s.hand[0]!.uid, { zone: 'a' });
      setValues(s, 'a', { density: 2 });
      endTurn(data, s);
    };
    turn();
    turn();
    expect(animalsIn(s, 'c')).toContain('beetle');
    turn();
    // Käfer gefressen, Specht ohne Käfer → zieht aus; Käfer kann (Totholz 3) neu einziehen.
    expect(s.log.some((e) => e.type === 'animalEaten' && e.prey === 'beetle')).toBe(true);
    expect(s.log.some((e) => e.type === 'animalLeft' && e.animal === 'woodpecker')).toBe(true);
  });

  it('Sumpf wird bei Feuchte 0 zur Lichtung', () => {
    const s = setup({ hand: ['drought'] });
    setValues(s, 'e', { moisture: 2 });
    playCard(data, s, uidOf(s, 'drought'), { zone: 'e' });
    endTurn(data, s);
    expect(getZone(s, 'e').type).toBe('clearing');
  });

  it('Jaguar braucht drei ruhige Züge in Zone und Nachbarschaft', () => {
    const s = setup({ hand: [], draw: Array(20).fill('seeds') });
    neutralForest(s);
    // Ufer (a) als Wasserschwein-Wiese, Nachbar e dicht.
    setValues(s, 'a', { moisture: 3, light: 3, density: 2 });
    setValues(s, 'e', { density: 4 });
    addAnimal(s, 'a', 'capybara');
    getZone(s, 'e').lastDisturbanceTurn = 1; // Störung im Nachbarn in Zug 1
    const turn = () => {
      s.hand = s.hand.length ? s.hand : [{ uid: 9100 + s.turn, card: 'seeds' }];
      playCard(data, s, s.hand[0]!.uid, { zone: 'c' });
      setValues(s, 'c', { density: 2 });
      endTurn(data, s);
    };
    turn(); // Ende Zug 1: 0 ruhige Züge
    turn(); // Ende Zug 2: 1
    turn(); // Ende Zug 3: 2
    expect(animalsIn(s, 'a')).not.toContain('jaguar');
    turn(); // Ende Zug 4: 3
    expect(animalsIn(s, 'a')).toContain('jaguar');
  });

  it('Papagei braucht zweimal gespielte Bestäubung', () => {
    const s = setup({ hand: ['pollination', 'pollination'] });
    neutralForest(s);
    setValues(s, 'd', { density: 4 });
    getZone(s, 'd').tags.push('nest');
    playCard(data, s, uidOf(s, 'pollination'), { zone: 'c', target: 'b' });
    playCard(data, s, uidOf(s, 'pollination'), { zone: 'c', target: 'b' });
    endTurn(data, s);
    expect(animalsIn(s, 'd')).toContain('parrot');
  });

  it('Wertung zählt jede anwesende Art einmal mit ihrer Stufe', () => {
    const s = setup();
    addAnimal(s, 'a', 'frog');
    addAnimal(s, 'e', 'frog');
    addAnimal(s, 'a', 'capybara');
    expect(report(data, s)).toMatchObject({ points: 4, highestTier: 3, individuals: 3 });
  });
});

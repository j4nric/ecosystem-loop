/** Reine Logik der Oberfläche: Meldungen aus Ereignissen, Texte, Prognose, Vorschau, Inselmodell. */
import { describe, expect, it } from 'vitest';
import { newGame, step, view, type CellView, type HerdeEvent, type HerdeState } from '@being-god/herde';
import { loadData } from '@being-god/herde/node';
import { de } from '../src/i18n/de.ts';
import { en } from '../src/i18n/en.ts';
import { describeEvents } from '../src/logic/events.ts';
import {
  arrowOf,
  forecastLines,
  intentText,
  isPlayable,
  monthsToNextSeason,
  ruleNumbers,
  seasonHint,
  wolvesTotal,
} from '../src/logic/format.ts';
import { previewPlay } from '../src/logic/preview.ts';
import { buildIsland, cellCenter, jitter } from '../src/scene/islandModel.ts';
import { landStyle, mix } from '../src/scene/palette.ts';

const data = loadData();
const at = { x: 2, y: 3 };

/** Kopie der Daten mit geänderten Parametern. */
function tweaked(fn: (d: typeof data) => void): typeof data {
  const d = structuredClone(data);
  fn(d);
  return d;
}

const describeDe = (events: HerdeEvent[], packs = new Map<number, { x: number; y: number }>()) =>
  describeEvents(data, 'de', de, events, at, packs);

/** Zustand mit gezielt gesetzten Feldern: alles Steppe, einzelne Felder überschrieben. */
function constructed(cells: Record<string, string> = {}, edit?: (s: HerdeState) => void): HerdeState {
  const s = newGame(data, { seed: 'test' });
  const w = data.islands.get(s.island)!.width;
  s.cells.forEach((c, i) => {
    const key = `${i % w},${Math.floor(i / w)}`;
    c.land = cells[key] ?? (c.land === 'sea' ? 'sea' : 'steppe');
    c.food = c.land === 'steppe' ? 1 : 0;
    c.age = 0;
    c.grazed = 0;
    c.fertile = 0;
  });
  s.packs = [];
  edit?.(s);
  return s;
}

describe('describeEvents', () => {
  it('übersetzt Verluste, Nachwuchs und Wölfe in Meldungen mit Ton und Effekten', () => {
    const { notices, fx } = describeDe(
      [
        { type: 'herdStarved', dead: 2 },
        { type: 'herdThirsted', dead: 1 },
        { type: 'herdFroze', dead: 3 },
        { type: 'herdBurned', dead: 1 },
        { type: 'herdBorn', born: 4 },
        { type: 'wolvesHunted', pack: 1, killed: 2 },
        { type: 'wolvesHunted', pack: 2, killed: 1 },
      ],
      new Map([[1, { x: 3, y: 3 }]]),
    );
    expect(notices.map((n) => n.text)).toEqual([
      'Hunger: −2 Tiere.',
      'Durst: −1 Tier.',
      'Kälte ohne Schutz: −3 Tiere.',
      'Das Feuer erfasst die Herde: −1.',
      'Nachwuchs: 4 Kälber geboren.',
      'Wölfe reißen 3 Tiere.',
    ]);
    expect(notices.map((n) => n.tone)).toEqual(['bad', 'bad', 'bad', 'bad', 'good', 'bad']);
    expect(fx).toContainEqual({ type: 'hunt', x: 2, y: 3, packs: [{ x: 3, y: 3 }] });
    expect(fx).toContainEqual({ type: 'born', x: 2, y: 3 });
    expect(fx.filter((f) => f.type === 'loss')).toHaveLength(3);
  });

  it('fasst Sukzession zusammen und nennt Landschaften mit Namen aus den Daten', () => {
    const { notices, fx } = describeDe([
      { type: 'cellChanged', x: 1, y: 1, from: 'meadow', to: 'bush', cause: 'succession' },
      { type: 'cellChanged', x: 2, y: 1, from: 'meadow', to: 'bush', cause: 'succession' },
      { type: 'cellChanged', x: 3, y: 1, from: 'bush', to: 'forest', cause: 'succession' },
    ]);
    expect(notices.map((n) => n.text)).toEqual(['Wiese wird zu Busch (2 Felder).', 'Busch wird zu Wald.']);
    expect(fx).toHaveLength(3);
  });

  it('meldet Feuer, Regen, Karten, Jahreszeit, Eiszeit und Ende', () => {
    const { notices, fx } = describeDe([
      { type: 'cardPlayed', card: 'seed', hand: 0, x: 1, y: 1, wild: 2 },
      { type: 'cardPlayed', card: 'lightning', hand: 0, x: 1, y: 1, wild: 1 },
      { type: 'fire', cause: 'lightning', x: 1, y: 1, cells: [{ x: 1, y: 1 }] },
      {
        type: 'fire',
        cause: 'wildfire',
        x: 4,
        y: 1,
        cells: [
          { x: 4, y: 1 },
          { x: 5, y: 1 },
        ],
      },
      { type: 'grassGrew', card: 'rain', amount: 2, cells: 12 },
      { type: 'cardsDrawn', cards: ['seed', 'rain'] },
      { type: 'seasonBegan', season: 'summer', month: 3, year: 1 },
      { type: 'iceAgeBegan', months: 6 },
      { type: 'iceAgeEnded', survivors: 7 },
      { type: 'gameWon', survivors: 7 },
      { type: 'gameLost', month: 40 },
    ]);
    expect(notices.map((n) => n.text)).toEqual([
      '🌱 Wiese säen gelegt.',
      'Blitz: 1 Feld brennt nieder.',
      'Waldbrand! 2 Felder brennen.',
      'Regen: Das Gras wächst auf 12 Feldern.',
      'Neue Karten: Wiese säen, Regen.',
      'Sommer im Jahr 1.',
      'Die Eiszeit beginnt: 6 Monate Winter.',
      'Die Eiszeit ist vorbei. 7 Tiere haben überlebt.',
      'Die Herde ist ausgestorben.',
    ]);
    expect(fx.map((f) => f.type)).toEqual(['fire', 'fire', 'rain']);
    expect(notices.filter((n) => n.next).map((n) => n.text)).toEqual([
      'Neue Karten: Wiese säen, Regen.',
      'Sommer im Jahr 1.',
    ]);
  });

  it('hält Zug, Fressen und wandernde Rudel aus den Toasts heraus (nur Protokoll)', () => {
    const { notices } = describeDe([
      { type: 'herdMoved', from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, reason: 'seekWater' },
      { type: 'herdMoved', from: { x: 1, y: 1 }, to: { x: 1, y: 1 }, reason: 'stay' },
      { type: 'herdAte', eaten: 5, need: 10, fat: 0 },
      { type: 'herdAte', eaten: 12, need: 10, fat: 2 },
      { type: 'packMoved', pack: 1, from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ]);
    expect(notices.map((n) => n.text)).toEqual([
      'Die Herde sucht Wasser ↘',
      'Die Herde grast hier weiter (bleibt)',
      'Zu wenig Futter (5 von 10), der Vorrat schwindet.',
      'Ein hungriges Rudel zieht durchs Gehölz zur Herde.',
    ]);
    expect(notices.every((n) => !n.toast)).toBe(true);
  });

  it('meldet das Leben der Rudel', () => {
    const { notices } = describeDe([
      { type: 'packGrew', pack: 1, size: 2 },
      { type: 'packFounded', pack: 2, parent: 1, x: 1, y: 1 },
      { type: 'packStarved', pack: 1, size: 1 },
      { type: 'packStarved', pack: 1, size: 0 },
      { type: 'packGone', pack: 1, x: 1, y: 1, cause: 'starved' },
      { type: 'packGone', pack: 2, x: 1, y: 1, cause: 'fire' },
      { type: 'packGone', pack: 3, x: 1, y: 1, cause: 'driven' },
      { type: 'packImmigrated', pack: 4, x: 1, y: 1 },
    ]);
    expect(notices.map((n) => n.text)).toEqual([
      'Ein Wolfsrudel wird stärker (2).',
      'Ein neues Wolfsrudel gründet sich.',
      'Ein Wolfsrudel hungert und wird schwächer.',
      'Ein Wolfsrudel ist verhungert.',
      'Das Feuer vertreibt ein Wolfsrudel.',
      'Ein Wolfsrudel hat seinen Lebensraum verloren.',
      'Wölfe wandern in die Wälder ein.',
    ]);
  });

  it('kennt jede Ereignisart einer echten Partie in beiden Sprachen', () => {
    let s = newGame(data, { seed: 'alle' });
    for (let i = 0; i < 40 && !s.over; i++) {
      const r = step(data, s, { type: 'advance' });
      s = r.state;
      for (const strings of [de, en]) {
        const out = describeEvents(data, 'de', strings, r.events, s.herd);
        expect(out.notices.every((n) => n.text.length > 0 && !n.text.includes('undefined'))).toBe(true);
      }
    }
  });
});

describe('Texte', () => {
  it('Pfeile nach Himmelsrichtung, Norden oben', () => {
    expect(arrowOf(1, 1)).toBe('↘');
    expect(arrowOf(-1, 0)).toBe('←');
    expect(arrowOf(0, -1)).toBe('↑');
    expect(arrowOf(0, 0)).toBe('');
  });

  it('Absichtszeile', () => {
    expect(intentText(de, { x: 2, y: 2, dx: 1, dy: 1, stays: false, reason: 'seekWater' })).toBe(
      'Die Herde sucht Wasser ↘',
    );
    expect(intentText(en, { x: 2, y: 2, dx: 0, dy: 0, stays: true, reason: 'stay' })).toBe(
      'The herd keeps grazing here (stays)',
    );
  });

  it('Monate bis zur nächsten Jahreszeit', () => {
    expect(monthsToNextSeason(data, 0)).toBe(3);
    expect(monthsToNextSeason(data, 2)).toBe(1);
    expect(monthsToNextSeason(data, 3)).toBe(3);
  });

  it('Hinweis zur Jahreszeit, in der Eiszeit mit Restmonaten', () => {
    const d = tweaked((x) => {
      x.params.herd.birthMonth = 1;
    });
    const v = view(d, newGame(d, { seed: 1 }));
    expect(seasonHint(de, d, v)).toBe('Gras wächst, Nachwuchs im 2. Monat');
    expect(seasonHint(en, d, v)).toBe('Grass grows, calves in the 2nd month');
    expect(seasonHint(de, d, { ...v, season: 'summer' })).toBe('Die Herde braucht Wasser, Altwald kann brennen');
    expect(seasonHint(de, data, { ...v, ice: { active: true, monthsLeft: 4, months: 6 } })).toBe(
      'Eiszeit: noch 4 Monate Winter',
    );
    expect(seasonHint(de, data, { ...v, season: 'unbekannt' })).toBe(de.seasonHintFallback);
    expect(wolvesTotal(v)).toBe(v.packs.reduce((a, p) => a + p.size, 0));
  });
});

describe('Karte ohne Ziel', () => {
  it('ist nur mit gültigem Ziel oder als globale Karte spielbar', () => {
    expect(isPlayable({ global: false, targets: [] })).toBe(false);
    expect(isPlayable({ global: false, targets: [{ x: 1, y: 1 }] })).toBe(true);
    expect(isPlayable({ global: true, targets: [] })).toBe(true);
  });
});

describe('Regelzahlen in Texten kommen aus den Daten', () => {
  it('ruleNumbers liest die Parameter', () => {
    const p = data.params;
    expect(ruleNumbers(data)).toEqual({
      birthSeason: data.seasons[Math.floor(p.herd.birthMonth / data.monthsPerSeason)]!.id,
      birthMonth: (p.herd.birthMonth % data.monthsPerSeason) + 1,
      wildMax: p.wild.max,
      iceMonths: p.ice.months,
      handMax: p.cards.handMax,
      neighbors: 8,
    });
  });

  it('geänderte Parameter ändern Hilfe, Einführung und Jahreszeit-Hinweis', () => {
    const d = tweaked((x) => {
      x.params.wild.max = 77;
      x.params.ice.months = 4;
      x.params.cards.handMax = 7;
      x.params.herd.birthMonth = 2; // dritter Monat des Frühlings
    });
    const r = ruleNumbers(d);
    for (const t of [de, en]) {
      expect(t.helpGoalText(r)).toContain('77');
      expect(t.helpCardsText(r)).toContain('7');
      expect(t.helpHerdText(r)).toContain('8');
      const ice = t.tutorial(r).find((c) => c.icon === '❄️')!.text;
      expect(ice).toContain('77');
      expect(ice).toMatch(/4 mon/i);
    }
    const v = view(d, newGame(d, { seed: 1 }));
    expect(seasonHint(de, d, v)).toBe('Gras wächst, Nachwuchs im 3. Monat');
    expect(seasonHint(en, d, v)).toBe('Grass grows, calves in the 3rd month');
  });

  it('Nachwuchs in einer anderen Jahreszeit wandert im Hinweis mit', () => {
    const d = tweaked((x) => {
      x.params.herd.birthMonth = 3; // erster Monat des Sommers
    });
    const v = view(d, newGame(d, { seed: 1 }));
    expect(seasonHint(de, d, v)).toBe('Gras wächst');
    expect(seasonHint(de, d, { ...v, season: 'summer' })).toBe(
      'Die Herde braucht Wasser, Altwald kann brennen, Nachwuchs im 1. Monat',
    );
  });
});

describe('Prognose in der Feld-Info', () => {
  const cell = (patch: Partial<CellView>): CellView => ({
    x: 0,
    y: 0,
    land: 'meadow',
    food: 3,
    maxFood: 6,
    fertile: false,
    walkable: true,
    forecast: null,
    wildfire: false,
    herd: false,
    pack: null,
    ...patch,
  });
  const lines = (c: CellView) => forecastLines(de, data, 'de', c, 'herd');

  it('nennt die Verbuschung erst ab höchstens 3 Monaten', () => {
    expect(lines(cell({ forecast: { to: 'bush', inMonths: 3, clock: 'ungrazed', fertile: false } }))).toEqual([
      'Wird in 3 Monaten zu Busch, wenn die Herde hier nicht grast.',
    ]);
    expect(lines(cell({ forecast: { to: 'bush', inMonths: 1, clock: 'ungrazed', fertile: false } }))[0]).toContain(
      'in 1 Monat zu',
    );
    expect(lines(cell({ forecast: { to: 'bush', inMonths: 4, clock: 'ungrazed', fertile: false } }))).toEqual([
      'Bleibt Wiese, solange die Herde hier grast.',
    ]);
  });

  it('Sukzession nach Alter, Feuer, Wasser, Schutz, Fels, Steppe', () => {
    expect(
      lines(
        cell({
          land: 'burnt',
          maxFood: 0,
          food: 0,
          forecast: { to: 'meadow', inMonths: 2, clock: 'age', fertile: true },
        }),
      ),
    ).toEqual(['Wird in 2 Monaten zu fruchtbarer Wiese.']);
    expect(lines(cell({ land: 'old', maxFood: 0, wildfire: true }))).toEqual([de.infoWildfire, de.infoShelter]);
    expect(lines(cell({ land: 'river', maxFood: 0 }))).toEqual([de.infoWater]);
    expect(lines(cell({ land: 'rock', maxFood: 0, walkable: false }))).toEqual([de.infoBlocked]);
    expect(lines(cell({ land: 'steppe', maxFood: 1 }))).toEqual([de.infoSparse]);
  });
});

describe('Vorschau', () => {
  it('zeigt das Zielfeld vorher/nachher und ob sich die Absicht der Herde ändert', () => {
    // Herde auf (1,5) in karger Steppe; eine Quelle daneben ändert im Frühling nichts an der Absicht.
    const s = constructed({ '3,5': 'meadow' }, (st) => {
      st.cells[5 * 7 + 3]!.food = 6;
      st.hand = ['seed', 'rock', 'spring'];
    });
    const seed = previewPlay(data, s, { type: 'play', hand: 0, x: 2, y: 5 })!;
    expect(seed.cell!.before.land).toBe('steppe');
    expect(seed.cell!.after.land).toBe('meadow');
    expect(seed.wildAfter).toBeGreaterThan(seed.wildBefore);
    expect(seed.intentBefore).not.toBeNull();
    expect(typeof seed.intentChanged).toBe('boolean');

    // Fels auf das Feld, zu dem die Herde will, ändert ihre Absicht.
    const want = view(data, s).intent!;
    const rock = previewPlay(data, s, { type: 'play', hand: 1, x: want.x, y: want.y });
    if (!want.stays) {
      expect(rock!.intentChanged).toBe(true);
      expect(rock!.intentAfter).not.toEqual(want);
    }
    expect(s.hand).toEqual(['seed', 'rock', 'spring']);
  });

  it('globale Karte: Felder mit mehr Gras; ungültige Züge ergeben keine Vorschau', () => {
    const s = constructed({ '3,5': 'meadow' }, (st) => {
      st.hand = ['rain', 'rock'];
    });
    const rain = previewPlay(data, s, { type: 'play', hand: 0 })!;
    expect(rain.cell).toBeNull();
    expect(rain.grown.length).toBeGreaterThan(0);
    expect(previewPlay(data, s, { type: 'play', hand: 1, x: 0, y: 0 })).toBeNull(); // Meer
    expect(previewPlay(data, s, { type: 'play', hand: 7 })).toBeNull();
    expect(previewPlay(data, s, { type: 'advance' })).toBeNull();
  });

  it('Blitz: Feuer und vertriebenes Rudel', () => {
    const s = constructed({ '5,2': 'forest' }, (st) => {
      st.hand = ['lightning'];
      st.packs = [{ id: 1, x: 5, y: 2, size: 1, fed: 0, hungry: 0 }];
      st.nextPackId = 2;
    });
    const p = previewPlay(data, s, { type: 'play', hand: 0, x: 5, y: 2 })!;
    expect(p.ignites).toBe(true);
    expect(p.packGone).toBe(true);
    expect(p.cell!.after.land).toBe('burnt');
  });
});

describe('Inselmodell', () => {
  it('ein Plättchen und eine Erdsäule je Feld, Gras nach Futter, Bewuchs je Landschaft', () => {
    const s = constructed({ '1,1': 'forest', '2,1': 'old', '3,1': 'bush', '4,1': 'rock', '5,1': 'burnt' });
    s.cells[2 * 7 + 1]!.land = 'meadow';
    s.cells[2 * 7 + 1]!.food = 6;
    const v = view(data, s);
    const model = buildIsland({ width: v.width, height: v.height }, v.cells, { eats: ['steppe', 'meadow'], snow: 0 });
    expect(model.tops).toHaveLength(v.cells.length);
    expect(model.earth).toHaveLength(v.cells.length);
    expect(model.topY).toHaveLength(v.cells.length);
    expect(model.crowns).toHaveLength(3 + 5);
    expect(model.shrubs).toHaveLength(4);
    expect(model.boulders).toHaveLength(3);
    expect(model.trunks).toHaveLength(3 + 5 + 3);
    const steppe = v.cells.filter((c) => c.land === 'steppe' && c.food > 0).length;
    expect(model.tufts).toHaveLength(steppe + 6);
    // Fels liegt höher als Wiese, Meer am tiefsten
    expect(model.topY[1 * 7 + 4]!).toBeGreaterThan(model.topY[2 * 7 + 1]!);
    expect(model.topY[0]!).toBeLessThan(0);
    // stabil: gleiche View, gleiche Instanzen
    expect(buildIsland(v, v.cells, { eats: ['steppe', 'meadow'], snow: 0 })).toEqual(model);
  });

  it('Schnee im Winter hellt das Land auf, Wasser bleibt', () => {
    const v = view(data, newGame(data, { seed: 1 }));
    const summer = buildIsland(v, v.cells, { eats: [], snow: 0 });
    const winter = buildIsland(v, v.cells, { eats: [], snow: 0.6 });
    const seaIndex = v.cells.findIndex((c) => c.land === 'sea');
    const landIndex = v.cells.findIndex((c) => c.land === 'steppe');
    expect(winter.tops[seaIndex]!.color).toBe(summer.tops[seaIndex]!.color);
    expect(winter.tops[landIndex]!.color).not.toBe(summer.tops[landIndex]!.color);
  });

  it('Hilfen: Feldmitte, Zufall, Farbmischung, Stil unbekannter Landschaften', () => {
    expect(cellCenter({ width: 7, height: 9 }, 3, 4)).toEqual([0, 0]);
    expect(cellCenter({ width: 7, height: 9 }, 0, 0)).toEqual([-3, -4]);
    expect(jitter(3, 4)).toBe(jitter(3, 4));
    expect(jitter(3, 4)).toBeGreaterThanOrEqual(0);
    expect(jitter(3, 4)).toBeLessThan(1);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.3)).toBe('#102030');
    expect(landStyle('lava', { walk: false, wood: false }).boulders).toBeGreaterThan(0);
    expect(landStyle('hain', { walk: true, wood: true }).trees).toBeDefined();
    expect(landStyle('heide').top).toBeGreaterThan(0);
  });
});

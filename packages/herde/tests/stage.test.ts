/** Konzept 9.2: Die Bedürfnisse der Herde kommen aus der Stufe (stages.yaml), nicht aus dem Code. */
import { describe, expect, it } from 'vitest';
import { step, view } from '../src/index.ts';
import { blank, data, ofType, put, season, tweak } from './helpers.ts';

/** Eine zweite, absichtlich „verdrehte“ Stufe: frisst nur Wald, trinkt am Altwald, sucht Schutz am Fluss, ignoriert Wölfe. */
const d = tweak((x) => {
  const herd = x.stages.get('herd')!;
  x.stages.set('odd', {
    ...structuredClone(herd),
    id: 'odd',
    eats: ['forest'],
    water: ['old'],
    shelter: ['river'],
    choice: { ...herd.choice, wolves: 0 },
  });
});
const odd = <S extends ReturnType<typeof blank>>(s: S): S => {
  s.herd.stage = 'odd';
  return s;
};
const intent = (s: ReturnType<typeof blank>) => view(d, s).intent!;
const advance = (s: ReturnType<typeof blank>) => step(d, s, { type: 'advance' });

describe('Stufe bestimmt die Bedürfnisse', () => {
  it('Futter: nur Landschaften aus stage.eats zählen', () => {
    const s = odd(season(blank(), 2));
    put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
    expect(intent(s)).toMatchObject({ stays: true });
    put(s, 1, 3, 'forest', { food: 1 });
    expect(intent(s)).toMatchObject({ x: 2, reason: 'freshGrass' });
    // Gegenprobe mit der echten Stufe: die Wiese lockt.
    const herd = season(blank(), 2);
    put(herd, 5, 3, 'meadow', { food: 6, grazed: herd.month });
    expect(view(data, herd).intent).toMatchObject({ x: 4 });
  });

  it('Wasser und Schutz: Landschaften aus stage.water und stage.shelter', () => {
    const summer = odd(season(blank(), 1));
    put(summer, 5, 3, 'old');
    expect(intent(summer)).toMatchObject({ x: 4, reason: 'seekWater' });
    const winter = odd(season(blank(), 3));
    put(winter, 5, 3, 'river');
    expect(intent(winter)).toMatchObject({ x: 4, reason: 'seekShelter' });
  });

  it('Kälte: Schutz zählt nur nach der Stufe', () => {
    const s = odd(season(blank(), 3));
    s.herd.fat = 20;
    put(s, 3, 3, 'bush', { food: 0 });
    expect(ofType(advance(s).events, 'herdFroze')).toHaveLength(1);
  });

  it('Wölfe meiden: Gewicht aus stage.choice', () => {
    const s = odd(season(blank(), 2));
    put(s, 2, 3, 'bush', { food: 0 });
    s.packs.push({ id: s.nextPackId++, x: 2, y: 3, size: 1, fed: 0, hungry: 0 });
    expect(intent(s)).toMatchObject({ stays: true });
  });
});

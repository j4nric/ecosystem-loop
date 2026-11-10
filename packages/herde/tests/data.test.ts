/** Datenprüfung: Schema und Querverweise der YAML-Dateien. */
import { describe, expect, it } from 'vitest';
import { buildData, DataError, type RawData } from '../src/index.ts';
import { readRawData } from '../src/node/load.ts';

/* eslint-disable @typescript-eslint/no-explicit-any -- Rohdaten werden gezielt beschädigt */
const raw = readRawData();
const problems = (fn: (r: any) => void): string[] => {
  const r = structuredClone(raw) as any;
  fn(r);
  try {
    buildData(r as RawData);
    return [];
  } catch (e) {
    if (e instanceof DataError) return e.problems;
    throw e;
  }
};
const land = (r: any, id: string) => r.landscapes.landscapes.find((l: any) => l.id === id);
const card = (r: any, id: string) => r.cards.cards.find((c: any) => c.id === id);
const stage = (r: any, id: string) => r.stages.stages.find((x: any) => x.id === id);
const trait = (r: any, id: string) => r.traits.traits.find((x: any) => x.id === id);

describe('Spieldaten', () => {
  it('die mitgelieferten Daten sind gültig', () => {
    const d = buildData(raw);
    expect([...d.landscapes.keys()]).toEqual([
      'sea',
      'steppe',
      'meadow',
      'bush',
      'forest',
      'old',
      'burnt',
      'river',
      'rock',
    ]);
    expect([...d.cards.keys()]).toEqual(['seed', 'trees', 'spring', 'rock', 'lightning', 'rain']);
    expect(d.seasons.map((s) => s.id)).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(d.months).toHaveLength(12);
    expect(d.islands.get('start')).toMatchObject({ width: 7, height: 9, herd: { x: 1, y: 5 } });
    expect(d.stages.get('herd')!.water).toEqual(['river']);
    expect([...d.stages.keys()]).toEqual(['herd', 'gatherer', 'wanderer']);
    expect(d.stages.get('herd')).toMatchObject({ next: 'gatherer', move: 1, reach: 1, wolfGuard: 0, forage: {} });
    expect(d.stages.get('wanderer')).toMatchObject({ blocked: ['old'], move: 2 });
    expect(d.stages.get('wanderer')!.next).toBeUndefined();
    expect([...d.traits.keys()]).toEqual([
      'thick_fur',
      'vigilant',
      'frugal',
      'fire_wary',
      'forest_wise',
      'far_sight',
      'endurance',
    ]);
    expect(d.offerSize).toBe(3);
  });

  it.each<[string, (r: any) => void, RegExp]>([
    ['Schemafehler', (r) => (land(r, 'meadow').food = -1), /landscapes.yaml: landscapes.2.food/],
    ['Id doppelt', (r) => r.cards.cards.push(card(r, 'rain')), /Id rain doppelt/],
    ['grow ohne Jahreszeit', (r) => delete land(r, 'meadow').grow.winter, /grow braucht genau/],
    ['Sukzession ins Leere', (r) => (land(r, 'bush').succession.to = 'jungle'), /unbekannte Landschaft jungle/],
    ['Sukzession auf sich selbst', (r) => (land(r, 'bush').succession.to = 'bush'), /auf sich selbst/],
    ['Brand ins Leere', (r) => (land(r, 'old').burnsTo = 'ash'), /unbekannte Landschaft ash/],
    ['Feuer ohne Brennbarkeit', (r) => (land(r, 'river').fireChance = 0.1), /fireChance ohne burnsTo/],
    ['Brandfläche brennt', (r) => (land(r, 'burnt').burnsTo = 'burnt'), /selbst brennbar/],
    ['Revier ohne Gehölz', (r) => (land(r, 'steppe').den = true), /den nur für Gehölz/],
    ['Karte auf Unbekanntes', (r) => card(r, 'seed').on.push('lava'), /Karte seed → on: unbekannte Landschaft lava/],
    ['Kartenziel unbekannt', (r) => (card(r, 'trees').effect.to = 'jungle'), /effect.to: unbekannte Landschaft/],
    ['Kartenziel in on', (r) => card(r, 'trees').on.push('bush'), /Ziel bush in on/],
    ['Blitz auf Unbrennbares', (r) => card(r, 'lightning').on.push('river'), /river ist nicht brennbar/],
    ['global ohne grow', (r) => (card(r, 'seed').global = true), /global geht nur/],
    ['Monatsnamen', (r) => r.seasons.months.pop(), /11 Monatsnamen statt 12/],
    ['Jahreszeit doppelt', (r) => r.seasons.seasons.push(r.seasons.seasons[0]), /Jahreszeit doppelt/],
    ['Stufe mit unbekanntem Wasser', (r) => r.stages.stages[0].water.push('lake'), /Stufe herd → water/],
    ['Startstufe', (r) => (r.params.herd.stage = 'human'), /unbekannte Stufe human/],
    ['Stufe: Hindernis unbekannt', (r) => stage(r, 'wanderer').blocked.push('lava'), /wanderer → blocked/],
    ['Stufe: Jahreszeit unbekannt', (r) => (stage(r, 'herd').needs.water = ['monsoon']), /needs.water: unbekannte/],
    ['Stufe: forage auf Unbekanntes', (r) => (stage(r, 'gatherer').forage.lava = { food: 1, grow: {} }), /forage/],
    ['Stufe: forage ohne Jahreszeit', (r) => delete stage(r, 'gatherer').forage.bush.grow.winter, /forage bush: grow/],
    ['Stufe: next unbekannt', (r) => (stage(r, 'gatherer').next = 'hunter'), /next: unbekannte Stufe hunter/],
    ['Stufe: next ohne mature', (r) => delete stage(r, 'herd').mature, /next ohne mature/],
    ['Stufe: mature ohne next', (r) => (stage(r, 'wanderer').mature = { traits: 1 }), /mature ohne next/],
    ['Stufe: oneOf unbekannt', (r) => stage(r, 'herd').mature.oneOf.push('wings'), /unbekanntes Merkmal wings/],
    ['Stufe: zu viele Merkmale', (r) => (stage(r, 'herd').mature.traits = 99), /mature.traits 99/],
    ['Stufe: Kreis', (r) => Object.assign(stage(r, 'wanderer'), { next: 'herd', mature: { traits: 1 } }), /im Kreis/],
    ['Merkmal: Erfahrung unbekannt', (r) => (trait(r, 'vigilant').from = 'flight'), /unbekannte Erfahrung flight/],
    ['Merkmal: Wirkung ohne Zahl', (r) => (trait(r, 'vigilant').effects = [{ stat: 'coldLoss' }]), /mul oder add/],
    ['Merkmal: unbekannter Wert', (r) => (trait(r, 'vigilant').effects[0].stat = 'eats'), /traits.yaml: traits/],
    ['Merkmal doppelt', (r) => r.traits.traits.push(trait(r, 'vigilant')), /Id vigilant doppelt/],
    [
      'Erfahrung: Landschaft unbekannt',
      (r) => r.traits.experiences.find((e: any) => e.id === 'open').when.lands.push('lava'),
      /Erfahrung open → when.lands/,
    ],
    ['Geburtsmonat', (r) => (r.params.herd.birthMonth = 12), /birthMonth 12/],
    ['Eiszeit-Jahreszeit', (r) => (r.params.ice.season = 'monsoon'), /unbekannte Jahreszeit monsoon/],
    ['Starthand', (r) => (r.params.cards.startHand = 6), /startHand > handMax/],
    [
      'Hunger-Rücksetzung',
      (r) => (r.params.wolves.starveReset = r.params.wolves.starveAfter),
      /starveReset muss kleiner/,
    ],
    ['Legende', (r) => (r.islands.islands[0].legend.W = 'lava'), /legend W: unbekannte Landschaft/],
    ['Zeichen fehlt', (r) => (r.islands.islands[0].rows[0] = '~..Q..~'), /Zeichen „Q“/],
    ['Zeilenlänge', (r) => (r.islands.islands[0].rows[1] = '.WW.FF'), /Zeile 1 hat 6 statt 7/],
    ['Herde im Meer', (r) => (r.islands.islands[0].herd = { x: 0, y: 0 }), /Herde \(0,0\) nicht auf begehbarem/],
    ['Herde außerhalb', (r) => (r.islands.islands[0].herd = { x: 9, y: 0 }), /Herde \(9,0\)/],
    ['Rudel auf Steppe', (r) => (r.islands.islands[0].packs[0] = { x: 1, y: 0, size: 1 }), /nicht im Gehölz/],
    ['Rudel doppelt', (r) => r.islands.islands[0].packs.push({ x: 5, y: 2, size: 1 }), /zwei Rudel/],
    ['Rudel zu stark', (r) => (r.islands.islands[0].packs[0].size = 4), /stärker als/],
    ['Insel doppelt', (r) => r.islands.islands.push(r.islands.islands[0]), /Id start doppelt/],
  ])('erkennt: %s', (_, fn, pattern) => {
    expect(problems(fn).join('\n')).toMatch(pattern);
  });

  it('fehlende Datei ist ein Schemafehler mit Dateinamen', () => {
    expect(problems((r) => delete r.params)[0]).toMatch(/^params.yaml: /);
  });
});

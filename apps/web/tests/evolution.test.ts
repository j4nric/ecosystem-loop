/** Entwicklung in der Oberfläche: Zählen aus der View, Texte, Hinweis an der Herde, Meldungen, alte Spielstände. */
import { describe, expect, it, vi } from 'vitest';
import { legalActions, newGame, step, view, type CellView, type HerdeState, type HerdeView } from '@being-god/herde';
import { loadData } from '@being-god/herde/node';
import { HerdeClient } from '../src/client/HerdeClient.ts';
import { MemorySaveStore } from '../src/client/SaveStore.ts';
import { de } from '../src/i18n/de.ts';
import { en } from '../src/i18n/en.ts';
import {
  countedText,
  countLands,
  evolutionBadge,
  experienceRows,
  landCounts,
  missingOnIsland,
  missingText,
  needRows,
  ownedTraits,
  traitInfo,
  traitStatus,
} from '../src/logic/evolution.ts';
import { describeEvents } from '../src/logic/events.ts';
import { forecastLines, ruleNumbers, seasonHint } from '../src/logic/format.ts';
import { stageLook, STAGE_FALLBACK, STAGE_LOOK } from '../src/scene/palette.ts';

const data = loadData();

/** Partie mit gezielt gesetzten Landschaften (alles Steppe außer Meer und den angegebenen Feldern). */
function constructed(cells: Record<string, string> = {}, edit?: (s: HerdeState) => void): HerdeState {
  const s = newGame(data, { seed: 'evo' });
  const w = data.islands.get(s.island)!.width;
  s.cells.forEach((c, i) => {
    const key = `${i % w},${Math.floor(i / w)}`;
    c.land = cells[key] ?? (c.land === 'sea' ? 'sea' : 'steppe');
    c.food = 0;
    c.age = 0;
    c.grazed = 0;
    c.fertile = 0;
  });
  s.packs = [];
  edit?.(s);
  return s;
}

const viewOf = (s: HerdeState): HerdeView => view(data, s);

describe('Zählen aus der View', () => {
  it('zählt Felder je Landschaft', () => {
    const v = viewOf(constructed({ '1,1': 'forest', '2,1': 'forest', '3,1': 'river' }));
    const counts = landCounts(v);
    expect(counts.get('forest')).toBe(2);
    expect(counts.get('river')).toBe(1);
    expect(countLands(counts, ['forest', 'river', 'gibt_es_nicht'])).toBe(3);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(v.cells.length);
  });

  it('Bedürfnisse der aktuellen Stufe mit Feldern auf der Insel', () => {
    const v = viewOf(constructed({ '1,1': 'bush', '2,2': 'river' }));
    const rows = needRows(de, data, 'de', v, v.evolution.stage);
    expect(rows.map((r) => r.kind)).toEqual(['food', 'water', 'shelter', 'wolves', 'move']);
    const food = rows.find((r) => r.kind === 'food')!;
    const steppe = v.cells.filter((c) => c.land === 'steppe').length;
    expect(food.count).toBe(steppe + 1);
    expect(food.text).toContain('Steppe (1)');
    const water = rows.find((r) => r.kind === 'water')!;
    expect(water).toMatchObject({ count: 1, island: '1 Feld auf der Insel', tone: 'ok' });
    expect(water.text).toBe('Fluss · im Sommer');
    expect(rows.find((r) => r.kind === 'shelter')!.text).toContain('im Winter');
    expect(rows.find((r) => r.kind === 'move')!.text).toBe('1 Feld je Monat, Umkreis 1');
  });

  it('Vorschau der nächsten Stufe: Waldsammler brauchen Gehölz und Wasser das ganze Jahr', () => {
    const bare = viewOf(constructed());
    expect(bare.evolution.next?.id).toBe('gatherer');
    const rows = needRows(de, data, 'de', bare, bare.evolution.next!, bare.evolution.stage);
    expect(rows.find((r) => r.kind === 'food')).toMatchObject({
      count: 0,
      island: 'fehlt auf der Insel',
      tone: 'missing',
    });
    expect(rows.find((r) => r.kind === 'food')!.text).toBe('Busch (3), Wald (4), Altwald (3)');
    expect(rows.find((r) => r.kind === 'water')!.text).toBe('Fluss · das ganze Jahr');
    // Wiese und Steppe zählen nicht mehr als Futter
    const lost = rows.find((r) => r.kind === 'lost')!;
    expect(lost.text).toBe('Steppe, Wiese');
    expect(lost.tone).toBe('warn');
    expect(missingOnIsland(rows)).toEqual(['Futter', 'Wasser', 'Schutz']);
    expect(de.evoNextMissing(missingOnIsland(rows))).toBe('Bereite die Insel vor: Es fehlt Futter, Wasser und Schutz.');

    const forest = viewOf(constructed({ '1,1': 'forest', '2,1': 'forest', '3,1': 'forest', '2,2': 'river' }));
    const ready = needRows(de, data, 'de', forest, forest.evolution.next!, forest.evolution.stage);
    expect(ready.find((r) => r.kind === 'food')).toMatchObject({
      count: 3,
      island: '3 Felder auf der Insel',
      tone: 'ok',
    });
    expect(missingOnIsland(ready)).toEqual([]);
  });

  it('Wanderer: Altwald wird Hindernis, 2 Felder je Monat', () => {
    const v = viewOf(
      constructed({ '1,1': 'old', '2,1': 'old', '2,2': 'river' }, (s) => {
        s.herd.stage = 'gatherer';
      }),
    );
    expect(v.evolution.next?.id).toBe('wanderer');
    const rows = needRows(en, data, 'en', v, v.evolution.next!, v.evolution.stage);
    expect(rows.find((r) => r.kind === 'blocked')).toMatchObject({
      text: 'Old forest',
      count: 2,
      island: '2 fields impassable',
      tone: 'warn',
    });
    expect(rows.find((r) => r.kind === 'move')!.text).toBe('2 fields per month, radius 1');
    expect(rows.find((r) => r.kind === 'water')!.text).toBe('River · all year');
  });
});

describe('Merkmale, Erfahrung und Reife', () => {
  it('Merkmal aus den Daten: Name, Icon, Wirkung, Erfahrung und Schwelle', () => {
    const s = constructed();
    const info = traitInfo(data, 'de', 'forest_wise', view(data, s).evolution);
    expect(info).toEqual({
      id: 'forest_wise',
      name: 'Waldkundig',
      icon: '🌲',
      effect: 'Größerer Vorrat.',
      experience: 'Monate im Gehölz gefressen',
      at: 4,
      forMaturity: true,
    });
    expect(traitInfo(data, 'en', 'thick_fur').forMaturity).toBe(false);
  });

  it('Erfahrungsfortschritt: Wert gegen Schwelle, Reife-Merkmale zuerst, erreichte markiert', () => {
    const s = constructed({}, (st) => {
      st.herd.experience = { ...st.herd.experience, forest: 2, sheltered: 3 };
    });
    const rows = experienceRows(data, 'de', view(data, s).evolution);
    expect(rows[0]).toMatchObject({ id: 'forest', value: 2, at: 4, share: 0.5, status: null });
    expect(rows[0]!.trait?.forMaturity).toBe(true);
    const sheltered = rows.find((r) => r.id === 'sheltered')!;
    // Erreicht, aber (noch) kein Angebot: kommt in einem späteren Angebot.
    expect(sheltered).toMatchObject({ value: 3, at: 3, share: 1, status: 'later' });
    expect(sheltered.trait?.name).toBe('Dichtes Fell');
    expect(rows).toHaveLength(data.experiences.size);
  });

  it('zwei Zustände: im Angebot oder erreicht und in einem späteren Angebot (Rotation der Engine)', () => {
    // Vier erreichte Merkmale, das Angebot der Engine fasst drei: eines wartet auf ein späteres Angebot.
    let s = constructed({}, (st) => {
      st.herd.experience = { ...st.herd.experience, forest: 4, sheltered: 3, hunted: 2, watered: 4 };
      st.month = 2; // letzter Monat des Frühlings: der nächste Schritt beginnt den Sommer
      st.herd.fat = 20;
    });
    s = step(data, s, { type: 'advance' }).state;
    const evo = view(data, s).evolution;
    expect(evo.offer).toEqual(['forest_wise', 'thick_fur', 'vigilant']);
    expect(evo.available).toEqual(['thick_fur', 'vigilant', 'frugal', 'forest_wise']);
    expect(traitStatus(evo, 'forest_wise')).toBe('offer');
    expect(traitStatus(evo, 'frugal')).toBe('later');
    expect(traitStatus(evo, 'endurance')).toBeNull();
    const rows = experienceRows(data, 'de', evo);
    expect(rows.find((r) => r.id === 'watered')).toMatchObject({ status: 'later' });
    expect(rows.find((r) => r.id === 'hunted')).toMatchObject({ status: 'offer' });
    expect(de.evoInOffer).toBe('im Angebot');
    expect(de.evoLater).toBe('erreicht – kommt in einem späteren Angebot');
    expect(de.offerLeave).toContain('andere erreichte Merkmale');
    expect(en.offerLeave).toContain('other reached traits');
  });

  it('Merkmale dieser Stufe zählen für die Reife, frühere wirken nur', () => {
    const s = constructed({}, (st) => {
      st.herd.stage = 'gatherer';
      st.herd.traits = ['thick_fur', 'forest_wise', 'vigilant'];
      st.herd.traitsAtStage = 2;
    });
    const evo = view(data, s).evolution;
    expect(evo.counted).toEqual(['vigilant']);
    expect(ownedTraits(data, 'de', evo).map((i) => [i.id, i.role])).toEqual([
      ['thick_fur', 'earlier'],
      ['forest_wise', 'earlier'],
      ['vigilant', 'counted'],
    ]);
    expect(countedText(de, evo)).toBe(
      'Auf dieser Stufe gewählt: 1 von 3 Merkmalen. Frühere Merkmale wirken weiter, zählen aber nicht.',
    );
    expect(countedText(en, evo)).toBe(
      'Picked on this stage: 1 of 3 traits. Earlier traits keep working but do not count.',
    );
    expect(missingText(de, data, 'de', evo)).toBe(
      'Zur Reife fehlen auf dieser Stufe noch 2 Merkmale, darunter Weitblick oder Ausdauer.',
    );
    // Letzte Stufe: keine Reife, keine Rolle.
    const last = view(
      data,
      constructed({}, (st) => {
        st.herd.stage = 'human';
        st.herd.traits = ['thick_fur'];
      }),
    ).evolution;
    expect(ownedTraits(data, 'de', last)[0]!.role).toBe('none');
    expect(countedText(de, last)).toBeNull();
  });

  it('Merkmal gewählt: Erfahrung ohne weiteres Merkmal zeigt „alles erreicht“', () => {
    const s = constructed({}, (st) => {
      st.herd.experience = { ...st.herd.experience, sheltered: 5 };
      // Kälte-Erfahrung trägt zwei Merkmale (Dichtes Fell, Wetterfest); beide gewählt
      st.herd.traits = ['thick_fur', 'weathered'];
    });
    const row = experienceRows(data, 'de', view(data, s).evolution).find((r) => r.id === 'sheltered')!;
    expect(row).toMatchObject({ at: null, trait: null, share: 1, status: null });
  });

  it('was zur Reife fehlt, als Satz; reif; letzte Stufe', () => {
    const start = view(data, constructed()).evolution;
    expect(missingText(de, data, 'de', start)).toBe(
      'Zur Reife fehlen auf dieser Stufe noch 2 Merkmale, darunter Waldkundig.',
    );
    expect(missingText(en, data, 'en', start)).toBe(
      'Still needed for maturity on this stage: 2 more traits, including Forest-wise.',
    );
    const gatherer = view(
      data,
      constructed({}, (s) => {
        s.herd.stage = 'gatherer';
        s.herd.traits = ['thick_fur', 'forest_wise'];
      }),
    ).evolution;
    expect(missingText(de, data, 'de', gatherer)).toBe(
      'Zur Reife fehlen auf dieser Stufe noch 1 Merkmal, darunter Weitblick oder Ausdauer.',
    );
    const mature = view(
      data,
      constructed({}, (s) => {
        s.herd.traits = ['thick_fur', 'forest_wise'];
      }),
    ).evolution;
    expect(mature.mature).toBe(true);
    expect(missingText(de, data, 'de', mature)).toBe('Reif! Die Herde kann zu Waldsammler werden.');
    const last = view(
      data,
      constructed({}, (s) => {
        s.herd.stage = 'human';
      }),
    ).evolution;
    expect(missingText(de, data, 'de', last)).toBeNull();
    expect(last.next).toBeNull();
  });
});

describe('Hinweis an der Herde', () => {
  const engineEvolution = (s: HerdeState) =>
    legalActions(data, s).filter((a) => a.type === 'pickTrait' || a.type === 'evolve');

  it('Angebot: Badge mit Zahl; die Engine bietet pickTrait je Angebot', () => {
    const s = constructed({}, (st) => {
      st.herd.experience = { ...st.herd.experience, sheltered: 3, hunted: 2 };
      st.herd.offer = ['thick_fur', 'vigilant'];
    });
    const v = view(data, s);
    expect(evolutionBadge(v)).toEqual({ kind: 'offer', count: 2 });
    expect(engineEvolution(s)).toEqual(v.evolution.offer.map((trait) => ({ type: 'pickTrait', trait })));
    // Die Wahl geht durch die Engine: Angebot verbraucht, Merkmal gewählt.
    const after = step(data, s, { type: 'pickTrait', trait: 'thick_fur' }).state;
    expect(view(data, after).evolution.traits).toEqual(['thick_fur']);
    expect(view(data, after).evolution.offer).toEqual([]);
  });

  it('Reife: Badge mit Folgestufe; nach dem Sprung neue Stufe, Reife beginnt neu', () => {
    const s = constructed({}, (st) => {
      st.herd.traits = ['thick_fur', 'forest_wise'];
    });
    const v = view(data, s);
    expect(evolutionBadge(v)).toEqual({ kind: 'mature', next: 'gatherer' });
    expect(engineEvolution(s)).toEqual([{ type: 'evolve' }]);
    const after = view(data, step(data, s, { type: 'evolve' }).state);
    expect(after.herd.stage).toBe('gatherer');
    expect(after.evolution.counted).toEqual([]);
    expect(evolutionBadge(after)).toBeNull();
  });

  it('nichts zu tun: kein Badge; nach dem Ende auch nicht', () => {
    const s = constructed();
    expect(evolutionBadge(view(data, s))).toBeNull();
    const over = constructed({}, (st) => {
      st.herd.traits = ['thick_fur', 'forest_wise'];
      st.herd.offer = ['vigilant'];
      st.over = 'lost';
    });
    expect(evolutionBadge(view(data, over))).toBeNull();
    expect(engineEvolution(over)).toEqual([]);
  });
});

describe('Meldungen der Entwicklung', () => {
  it('Angebot, Wahl mit Wirkung, Reife und Sprung mit Effekt an der Herde', () => {
    const { notices, fx } = describeEvents(
      data,
      'de',
      de,
      [
        { type: 'traitOffered', traits: ['thick_fur', 'vigilant'] },
        { type: 'traitPicked', trait: 'forest_wise' },
        { type: 'matured', stage: 'herd', next: 'gatherer' },
        { type: 'herdEvolved', from: 'herd', to: 'gatherer' },
      ],
      { x: 3, y: 4 },
    );
    expect(notices.map((n) => n.text)).toEqual([
      'Merkmale zur Wahl: 🧥 Dichtes Fell, 👁 Wachsamkeit.',
      'Die Herde entwickelt Waldkundig: Größerer Vorrat.',
      'Die Herde ist reif für den Sprung: Waldsammler.',
      'Neue Stufe: Waldsammler (bisher Grasende Herde).',
    ]);
    expect(notices.map((n) => n.tone)).toEqual(['info', 'good', 'good', 'good']);
    expect(notices.every((n) => n.toast)).toBe(true);
    expect(notices[0]!.next).toBe(true);
    expect(fx).toEqual([{ type: 'evolve', x: 3, y: 4, stage: 'gatherer' }]);
    const english = describeEvents(data, 'en', en, [{ type: 'herdEvolved', from: 'gatherer', to: 'wanderer' }], {
      x: 0,
      y: 0,
    });
    expect(english.notices[0]!.text).toBe('New stage: Wanderers of the open land (was Forest gatherers).');
  });

  it('Titel des Sprung-Dialogs', () => {
    expect(de.evolveTitle('Waldsammler')).toBe('Weiterentwickeln zur Stufe Waldsammler?');
    expect(en.evolveTitle('Forest gatherers')).toBe('Evolve to the stage Forest gatherers?');
  });
});

describe('Texte hängen von der Stufe ab', () => {
  const stageView = (stage: string) =>
    view(
      data,
      constructed({}, (s) => {
        s.herd.stage = stage;
      }),
    );

  it('Jahreszeit-Hinweis liest Wasser- und Schutzzeiten der Stufe', () => {
    const herd = stageView('herd');
    expect(seasonHint(de, data, 'de', { ...herd, season: 'autumn' })).toBe(
      'Das Gras wächst langsamer, Vorrat anfressen',
    );
    expect(seasonHint(de, data, 'de', { ...herd, season: 'winter' })).toBe('Kein Gras, die Herde braucht Schutz');
    const gatherer = stageView('gatherer');
    expect(seasonHint(de, data, 'de', { ...gatherer, season: 'autumn' })).toBe(
      'Das Gras wächst langsamer, Vorrat anfressen, die Herde braucht Wasser',
    );
    expect(seasonHint(de, data, 'de', { ...gatherer, season: 'winter' })).toBe(
      'Kein Gras, die Herde braucht Wasser und Schutz',
    );
    expect(seasonHint(en, data, 'en', { ...gatherer, season: 'winter' })).toBe(
      'No grass, the herd needs water and shelter',
    );
  });

  it('Regelzahlen: Schritte und Nachbarfelder aus der Stufe, Jahreszeiten als Namen', () => {
    const wanderer = stageView('wanderer').evolution.stage;
    const r = ruleNumbers(data, 'de', wanderer);
    expect(r.move).toBe(2);
    expect(r.neighbors).toBe(8);
    expect(r.water).toEqual({ names: ['Frühling', 'Sommer', 'Herbst', 'Winter'], all: true });
    expect(ruleNumbers(data, 'de', { ...wanderer, reach: 2 }).neighbors).toBe(24);
    expect(de.helpHerdText(r)).toContain('höchstens 2 Felder');
    expect(de.helpHerdText(r)).toContain('Das ganze Jahr: Durst');
    expect(en.tutorial(r)[0]!.text).toContain('at most 2 fields');
    expect(en.tutorial(r)[0]!.text).toContain('to water all year');
    expect(de.tutorial(r).some((c) => c.title === 'Die Herde entwickelt sich')).toBe(true);
    expect(en.tutorial(r).some((c) => c.title === 'The herd evolves')).toBe(true);
  });

  it('Feld-Info: für die Stufe unpassierbar, kein Futter für die Stufe', () => {
    const wanderer = viewOf(
      constructed({ '1,1': 'old' }, (s) => {
        s.herd.stage = 'wanderer';
      }),
    );
    const old = wanderer.cells.find((c) => c.land === 'old')!;
    expect(old.blocked).toBe(true);
    expect(forecastLines(de, data, 'de', old, wanderer.evolution.stage)).toContain(
      'Für diese Stufe unpassierbar (Wanderer der offenen Landschaft).',
    );
    const gatherer = viewOf(
      constructed({ '1,1': 'meadow' }, (s) => {
        s.herd.stage = 'gatherer';
      }),
    );
    const meadow: CellView = gatherer.cells.find((c) => c.land === 'meadow')!;
    expect(forecastLines(de, data, 'de', meadow, gatherer.evolution.stage)).toContain(
      'Kein Futter für die Stufe Waldsammler.',
    );
  });

  it('jede Stufe hat ein eigenes Aussehen; unbekannte Stufen einen Ersatz', () => {
    for (const id of data.stages.keys()) expect(STAGE_LOOK[id]).toBeDefined();
    // Figur und Farbe zusammen unterscheiden die Stufen (Jäger und Mensch haben vorläufig noch keine eigene Figur).
    const looks = [...data.stages.keys()].map((id) => `${stageLook(id).figure}/${stageLook(id).body}`);
    expect(new Set(looks).size).toBe(data.stages.size);
    expect(stageLook('mensch')).toBe(STAGE_FALLBACK);
  });
});

describe('Speicherstand einer früheren Version', () => {
  it('Stand mit Version 1 wird verworfen; neue Partie mit eigenem Hinweis', () => {
    const state = newGame(data, { seed: 'alt' }) as unknown as Record<string, unknown>;
    state['version'] = 1;
    const store = new MemorySaveStore();
    store.save({ version: 2, seed: 'alt', savedAt: 0, state: state as unknown as HerdeState, log: [] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = new HerdeClient({ data, locale: 'de', strings: de, store, randomSeed: () => 'neu' });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
    expect(client.takeStartupNotice()).toBe('outdated');
    expect(client.takeStartupNotice()).toBeNull();
    expect(client.getSeed()).toBe('neu');
    expect(client.getView().month).toBe(0);
    const saved = store.load();
    expect(saved.kind === 'game' && saved.game.seed).toBe('neu');
    expect(de.outdatedText.length).toBeGreaterThan(0);
    expect(en.outdatedTitle.length).toBeGreaterThan(0);
  });

  it('Merkmal wählen und springen über den Client', () => {
    const store = new MemorySaveStore();
    const s = constructed({}, (st) => {
      st.herd.experience = { ...st.herd.experience, forest: 4 };
      st.herd.traits = ['thick_fur'];
      st.herd.offer = ['forest_wise'];
    });
    store.save({ version: 2, seed: 'evo', savedAt: 0, state: s, log: [] });
    const client = new HerdeClient({ data, locale: 'de', strings: de, store });
    const reports: string[][] = [];
    client.subscribeReports((r) => reports.push(r.fx.map((f) => f.type)));
    expect(client.dispatch({ type: 'pickTrait', trait: 'forest_wise' })).toBe(true);
    expect(client.getView().evolution.mature).toBe(true);
    expect(client.getLog()[0]!.text).toBe('Die Herde ist reif für den Sprung: Waldsammler.');
    expect(client.dispatch({ type: 'evolve' })).toBe(true);
    expect(client.getView().herd.stage).toBe('gatherer');
    expect(reports.at(-1)).toEqual(['evolve']);
  });
});

/** Wild, Jagd, Lager, Eiszeiten und Ende in der Oberfläche: Auswahl, Vorschau, Panel-Zeilen, Bilanz, Texte. */
import { describe, expect, it } from 'vitest';
import { newGame, step, view, type HerdeEvent, type HerdeState, type HerdeView } from '@being-god/herde';
import { loadData } from '@being-god/herde/node';
import { HerdeClient } from '../src/client/HerdeClient.ts';
import { MemorySaveStore } from '../src/client/SaveStore.ts';
import { de } from '../src/i18n/de.ts';
import { en } from '../src/i18n/en.ts';
import { missingOnIsland, needRows } from '../src/logic/evolution.ts';
import { describeEvents } from '../src/logic/events.ts';
import { ruleNumbers } from '../src/logic/format.ts';
import {
  campBanner,
  campChips,
  campPreview,
  campPreviewLines,
  campShort,
  campSpotsOnIsland,
  cellsAround,
  endSummary,
  firstCampSite,
  huntRules,
  iceAgeNumber,
  isCampSite,
  preyAnimals,
  preyFieldLines,
  preyHint,
  showPreyCounter,
  stageIndex,
} from '../src/logic/hunt.ts';

const data = loadData();

/**
 * Startinsel (7 × 9, Herde auf 1,5), alles Steppe außer Meer und den angegebenen Feldern; keine Rudel, kein Wild.
 * Standard: Fluss östlich, Wiese südlich, Wald westlich der Herde – Lagerplätze sind dann (1,5) und (1,6).
 */
const CAMP_LANDS = { '2,5': 'river', '1,6': 'meadow', '0,5': 'forest' };
function constructed(
  stage: string,
  cells: Record<string, string> = CAMP_LANDS,
  edit?: (s: HerdeState) => void,
): HerdeState {
  const s = newGame(data, { seed: 'h3b' });
  const w = data.islands.get(s.island)!.width;
  s.cells.forEach((c, i) => {
    const key = `${i % w},${Math.floor(i / w)}`;
    c.land = cells[key] ?? (c.land === 'sea' ? 'sea' : 'steppe');
    c.food = 0;
    c.age = 0;
    c.grazed = 0;
    c.fertile = 0;
  });
  s.herd.stage = stage;
  s.packs = [];
  s.prey = [];
  edit?.(s);
  return s;
}

const addPrey = (s: HerdeState, x: number, y: number, size: number, hungry = 0) => {
  s.prey.push({ id: s.nextPreyId++, x, y, size, fed: 0, hungry });
};

const viewOf = (s: HerdeState): HerdeView => view(data, s);

describe('Wild in der Statusleiste', () => {
  it('zählt Tiere und zeigt den Zähler erst ab der Stufe, mit der Wild einwandert (oder wenn Wild da ist)', () => {
    const from = data.params.prey.from;
    expect(stageIndex(data, from)).toBeGreaterThan(0);
    expect(showPreyCounter(data, viewOf(constructed('herd')))).toBe(false);
    expect(showPreyCounter(data, viewOf(constructed(from)))).toBe(true);
    expect(showPreyCounter(data, viewOf(constructed('hunter')))).toBe(true);
    const withPrey = viewOf(constructed('herd', CAMP_LANDS, (s) => addPrey(s, 1, 6, 2)));
    expect(showPreyCounter(data, withPrey)).toBe(true);
    expect(preyAnimals(withPrey)).toBe(2);
    expect(de.preyLabel(1, 2)).toBe('Wild: 1 Bestand, 2 Tiere');
    expect(en.preyLabel(0, 0)).toBe('No game on the island');
  });
});

describe('Lager gründen', () => {
  it('Hinweis: nur auf der Stufe mit Lager, solange keins steht; in der Eiszeit und ohne Platz eigene Hinweise', () => {
    expect(campBanner(viewOf(constructed('hunter')))).toBeNull();
    const human = viewOf(constructed('human'));
    expect(human.campSites).toEqual([
      { x: 1, y: 5 },
      { x: 1, y: 6 },
    ]);
    expect(campBanner(human)).toEqual({ kind: 'choose', sites: 2 });
    // Eiszeit: Die Engine liefert keine Plätze
    const ice = viewOf(constructed('human', CAMP_LANDS, (s) => (s.ice = 3)));
    expect(ice.campSites).toEqual([]);
    expect(campBanner(ice)).toEqual({ kind: 'ice' });
    // kein Platz in Zugweite
    expect(campBanner(viewOf(constructed('human', {})))).toEqual({ kind: 'none' });
    // Lager steht / Partie vorbei
    expect(campBanner(viewOf(constructed('human', CAMP_LANDS, (s) => (s.camp = { x: 1, y: 5 }))))).toBeNull();
    expect(campBanner({ ...human, over: 'lost' })).toBeNull();
    expect(de.campBannerNone(['Fluss', 'Wiese'], 1)).toBe(
      'Kein Lagerplatz in Zugweite. Gesucht: Fluss und Wiese im Umkreis 1.',
    );
  });

  it('erster Platz ist das Feld der Herde, sonst der erste der Engine; nur Plätze der Engine gelten', () => {
    const v = viewOf(constructed('human'));
    expect(firstCampSite(v)).toEqual({ x: 1, y: 5 });
    expect(firstCampSite({ ...v, herd: { ...v.herd, x: 4, y: 4 } })).toEqual({ x: 1, y: 5 });
    expect(firstCampSite({ ...v, campSites: [] })).toBeNull();
    expect(isCampSite(v, { x: 1, y: 6 })).toBe(true);
    expect(isCampSite(v, { x: 2, y: 6 })).toBe(false);
    expect(isCampSite(v, null)).toBe(false);
  });

  it('Vorschau: Wasser, Wiese, Wald im Umkreis, Futter, Schutz, Wild und die Rodung aus den Daten', () => {
    const s = constructed('human', { ...CAMP_LANDS, '0,6': 'old', '0,4': 'forest' }, (x) => addPrey(x, 3, 6, 2));
    const v = viewOf(s);
    const p = campPreview(data, 'de', v, { x: 1, y: 6 })!;
    const camp = data.stages.get('human')!.camp!;
    expect(p.radius).toBe(camp.radius);
    expect(p.groups.map((g) => g.name)).toEqual(['Fluss', 'Wiese', 'Wald oder Altwald']);
    // Umkreis 1 um (1,6): Fluss (2,5), Wiese (1,6), Wald (0,5) und Altwald (0,6)
    expect(p.groups.map((g) => g.count)).toEqual([1, 1, 2]);
    const reach = cellsAround(v, { x: 1, y: 6 }, v.evolution.stage.reach);
    expect(p.food).toBe(reach.filter((c) => v.evolution.stage.eats.includes(c.land)).length);
    expect(p.shelter).toBe(3); // Wald, Altwald, Wald (0,4) im Umkreis 2
    expect(p.prey).toBe(1);
    expect(p.moves).toBe(true);
    expect(p.clear).toMatchObject({ to: 'Wiese', fields: 2 });
    expect(p.clear!.month).toBe(data.months[camp.clear!.month]!.de);
    const lines = campPreviewLines(de, p);
    expect(lines.around).toContain('Fluss: 1 Feld');
    expect(lines.around).toContain('Wild in Jagdweite: 1 Bestand');
    expect(lines.effects[0]).toBe(de.campSettled);
    expect(lines.effects).toContain(de.campMoves);
    expect(lines.effects.at(-1)).toMatch(
      /rodet das Lager ein Feld Altwald oder Wald im Umkreis 1 zu Wiese – hier 2 Felder/,
    );
    // eigenes Feld: kein Umzug; andere Stufe: keine Vorschau
    expect(campPreviewLines(de, campPreview(data, 'de', v, { x: 1, y: 5 })!).effects).not.toContain(de.campMoves);
    expect(campPreview(data, 'de', viewOf(constructed('hunter')), { x: 1, y: 5 })).toBeNull();
    const chips = campChips(de, p);
    expect([...chips.near, ...chips.reach].map((c) => `${c.value} ${c.label}`)).toEqual([
      '1 Fluss',
      '1 Wiese',
      '2 Wald/Altwald',
      `${p.food} Futter`,
      '3 Schutz',
      '1 Wild',
    ]);
    expect(campShort(de, p)).toBe(
      'Die Herde wird hier sesshaft. Rodet jedes Jahr im Mai ein Feld Altwald oder Wald (hier 2 Felder).'.replace(
        'Mai',
        p.clear!.month,
      ),
    );
    expect(campChips(de, { ...p, groups: [{ name: 'Fluss', short: 'Fluss', count: 0 }] }).near[0]!.bad).toBe(true);
    expect(campShort(en, { ...p, clear: null })).toBe('The herd settles here for good.');
    expect(campPreviewLines(en, campPreview(data, 'en', v, { x: 1, y: 6 })!).effects.at(-1)).toMatch(
      /clears one field of old forest or forest/i,
    );
  });

  it('jeder Platz der Engine erfüllt in der Vorschau alle Gruppen; die Inselzählung umfasst sie', () => {
    const v = viewOf(constructed('human', { ...CAMP_LANDS, '4,2': 'river', '5,2': 'meadow', '4,3': 'forest' }));
    for (const site of v.campSites) {
      const p = campPreview(data, 'de', v, site)!;
      expect(p.groups.every((g) => g.count > 0)).toBe(true);
    }
    const spots = campSpotsOnIsland(v, v.evolution.stage.camp!);
    expect(spots).toBeGreaterThanOrEqual(v.campSites.length);
    expect(spots).toBeGreaterThan(2); // auch Plätze außer Reichweite
    expect(campSpotsOnIsland(viewOf(constructed('human', {})), v.evolution.stage.camp!)).toBe(0);
  });

  it('settle über den Client: Lager steht, Herde bleibt, Meldung und Effekt', () => {
    const state = constructed('human');
    const c = new HerdeClient({
      data,
      locale: 'de',
      strings: de,
      store: new MemorySaveStore({ kind: 'game', game: { version: 2, seed: 'h3b', savedAt: 0, state, log: [] } }),
    });
    const reports: { fx: { type: string }[] }[] = [];
    c.subscribeReports((r) => reports.push(r));
    expect(c.dispatch({ type: 'settle', x: 1, y: 6 })).toBe(true);
    const v = c.getView();
    expect(v.camp).toEqual({ x: 1, y: 6 });
    expect(v.herd).toMatchObject({ x: 1, y: 6 });
    expect(v.campSites).toEqual([]);
    expect(campBanner(v)).toBeNull();
    expect(c.getLog()[0]!.text).toBe(de.evCampFounded);
    expect(reports[0]!.fx).toEqual([{ type: 'camp', x: 1, y: 6 }]);
    const rows = needRows(de, data, 'de', v, v.evolution.stage);
    expect(rows.find((r) => r.kind === 'camp')).toMatchObject({ island: 'Lager steht', tone: 'ok' });
    expect(v.intent?.reason).toBe('settled');
  });
});

describe('Panel: Beute, Wölfe, Lager', () => {
  it('Jäger: Beute als Bedürfnis, Wölfe als Konkurrenten', () => {
    const v = viewOf(constructed('hunter', CAMP_LANDS, (s) => addPrey(s, 1, 6, 3)));
    const rows = needRows(de, data, 'de', v, v.evolution.stage);
    expect(rows.map((r) => r.kind)).toEqual(['food', 'prey', 'water', 'shelter', 'wolves', 'move']);
    const hunter = data.stages.get('hunter')!;
    expect(rows.find((r) => r.kind === 'prey')).toMatchObject({
      label: 'Beute',
      text: `Wild: ${hunter.preyFood} Futter je Tier, bis ${hunter.huntKill} Tiere je Monat, im Feuer +${hunter.fireHunt}`,
      count: 1,
      island: '1 Bestand (3 Tiere) auf der Insel',
      tone: 'ok',
    });
    expect(rows.find((r) => r.kind === 'wolves')).toMatchObject({
      text: 'Konkurrenten – jagen dasselbe Wild',
      tone: 'info',
    });
    // Stufe 1: Wölfe sind Feinde, mit Rudel eine Warnung
    const herd = viewOf(
      constructed('herd', CAMP_LANDS, (s) => s.packs.push({ id: 9, x: 0, y: 5, size: 2, fed: 0, hungry: 0 })),
    );
    expect(needRows(de, data, 'de', herd, herd.evolution.stage).find((r) => r.kind === 'wolves')).toMatchObject({
      text: 'Feinde – reißen Tiere der Herde',
      island: '1 Rudel auf der Insel',
      tone: 'warn',
    });
  });

  it('Vorschau der nächsten Stufe: fehlendes Wild und Lagerplätze auf der Insel', () => {
    const wanderer = viewOf(constructed('wanderer', {}));
    expect(wanderer.evolution.next?.id).toBe('hunter');
    const rows = needRows(de, data, 'de', wanderer, wanderer.evolution.next!, wanderer.evolution.stage);
    expect(rows.find((r) => r.kind === 'prey')).toMatchObject({ island: 'kein Wild auf der Insel', tone: 'missing' });
    expect(missingOnIsland(rows)).toContain('Beute');
    // Jäger → Mensch: Lager mit den möglichen Plätzen auf der ganzen Insel
    const hunter = viewOf(constructed('hunter'));
    const next = needRows(de, data, 'de', hunter, hunter.evolution.next!, hunter.evolution.stage);
    expect(next.find((r) => r.kind === 'camp')).toMatchObject({
      text: 'Fluss, Wiese und Wald oder Altwald im Umkreis 1',
      island: '2 mögliche Plätze auf der Insel',
      tone: 'ok',
    });
    const bare = viewOf(constructed('hunter', {}));
    const none = needRows(de, data, 'de', bare, bare.evolution.next!, bare.evolution.stage);
    expect(none.find((r) => r.kind === 'camp')).toMatchObject({ tone: 'missing' });
    expect(missingOnIsland(none)).toContain('Lager');
    // Mensch ohne Lager: Plätze in Zugweite
    const human = viewOf(constructed('human'));
    expect(needRows(de, data, 'de', human, human.evolution.stage).find((r) => r.kind === 'camp')).toMatchObject({
      island: '2 Plätze in Zugweite',
      tone: 'ok',
    });
  });

  it('Hinweis zur Beute der nächsten Stufe', () => {
    const p = data.params.prey;
    const some = viewOf(constructed('wanderer', CAMP_LANDS, (s) => addPrey(s, 1, 6, 2)));
    expect(preyHint(de, data, 'de', some, some.evolution.next!)).toBe(
      'Die Stufe Jäger und Sammler braucht Wild: zurzeit 1 Bestand auf der Insel (2 Tiere).',
    );
    const none = viewOf(constructed('wanderer'));
    const habitat = none.cells.filter((c) => p.lands.includes(c.land)).length;
    expect(preyHint(de, data, 'de', none, none.evolution.next!)).toBe(
      `Die Stufe Jäger und Sammler braucht Wild: zurzeit keines auf der Insel. Es wandert ein, wenn mindestens ${p.spawnMinLand} Felder Wiese oder Busch da sind (zurzeit ${habitat}).`,
    );
    // vor der Stufe, ab der Wild einwandert, nennt der Hinweis sie
    const early = viewOf(constructed('herd'));
    const hunterNeeds = viewOf(constructed('hunter')).evolution.stage;
    expect(preyHint(de, data, 'de', early, hunterNeeds)).toContain('ab der Stufe Wanderer');
    expect(preyHint(en, data, 'en', early, hunterNeeds)).toContain('from the stage');
    expect(preyHint(de, data, 'de', early, early.evolution.stage)).toBeNull();
  });
});

describe('Feld-Info', () => {
  it('Wild mit Größe, Hunger und Jagdweite; Lebensraum; Lager', () => {
    const v = viewOf(
      constructed('hunter', CAMP_LANDS, (s) => {
        addPrey(s, 1, 6, 2, 1);
        addPrey(s, 5, 1, 1);
        s.camp = null;
      }),
    );
    const cell = (x: number, y: number) => v.cells[y * v.width + x]!;
    const max = data.params.prey.maxSize;
    expect(preyFieldLines(de, data, v, cell(1, 6))).toEqual([
      `Wild: 2 von ${max} Tieren – hungrig, zieht weiter und schrumpft bald.`,
      'In Jagdweite der Herde.',
    ]);
    expect(preyFieldLines(de, data, v, cell(5, 1))).toEqual([`Wild: 1 von ${max} Tieren.`]);
    // leeres Wiesenfeld: Lebensraum (ab der Stufe mit Wild)
    const meadow = viewOf(constructed('hunter', { ...CAMP_LANDS, '4,4': 'meadow' }));
    expect(preyFieldLines(de, data, meadow, meadow.cells[4 * meadow.width + 4]!)).toEqual(['Lebensraum des Wilds.']);
    const early = viewOf(constructed('herd', { ...CAMP_LANDS, '4,4': 'meadow' }));
    expect(preyFieldLines(de, data, early, early.cells[4 * early.width + 4]!)).toEqual([]);
    const camped = viewOf(constructed('human', CAMP_LANDS, (s) => (s.camp = { x: 1, y: 5 })));
    expect(preyFieldLines(de, data, camped, camped.cells[5 * camped.width + 1]!)).toContain(de.infoCamp);
  });
});

describe('Ereignisse: Jagd, Rudel, Einwandern, Rodung, Lager', () => {
  const herdAt = { x: 1, y: 5 };
  const preyAt = new Map([[4, { x: 2, y: 6 }]]);
  const run = (events: HerdeEvent[]) => describeEvents(data, 'de', de, events, herdAt, new Map(), [], preyAt);

  it('Jagd mit und ohne Feuer, Rudel reißt Wild, Wild wandert ein', () => {
    const plain = run([{ type: 'preyHunted', prey: 4, killed: 2, size: 1, fire: false }]);
    expect(plain.notices).toEqual([{ text: 'Jagd: 2 Wild erlegt.', tone: 'good', toast: false }]);
    expect(plain.fx).toEqual([{ type: 'preyHunted', x: 2, y: 6, fire: false, from: herdAt }]);
    const fire = run([{ type: 'preyHunted', prey: 4, killed: 3, size: 0, fire: true }]);
    expect(fire.notices[0]).toMatchObject({
      text: 'Jagd: 3 Wild erlegt – das Feuer hat es aufgetrieben.',
      toast: true,
    });
    expect(fire.fx[0]).toMatchObject({ type: 'preyHunted', fire: true });
    expect(run([{ type: 'packAtePrey', pack: 1, prey: 4, killed: 1, size: 1 }]).fx).toEqual([
      { type: 'packAtePrey', x: 2, y: 6 },
    ]);
    // unbekanntes Wild (z. B. alter Stand): Meldung ohne Effekt
    expect(run([{ type: 'packAtePrey', pack: 1, prey: 99, killed: 1, size: 1 }]).fx).toEqual([]);
    expect(run([{ type: 'preyImmigrated', prey: 5, x: 4, y: 4, size: 2 }]).fx).toEqual([
      { type: 'preyArrived', x: 4, y: 4 },
    ]);
  });

  it('Rodung hat einen eigenen Effekt statt des Landschaftswechsels; Lager gegründet', () => {
    const out = run([
      { type: 'fieldCleared', x: 0, y: 5, from: 'forest', to: 'meadow' },
      { type: 'cellChanged', x: 0, y: 5, from: 'forest', to: 'meadow', cause: 'clearing' },
    ]);
    expect(out.fx).toEqual([{ type: 'cleared', x: 0, y: 5 }]);
    expect(out.notices.map((n) => n.text)).toEqual(['Rodung am Lager: Wald wird Wiese.']);
    expect(run([{ type: 'campFounded', x: 1, y: 5 }]).fx).toEqual([{ type: 'camp', x: 1, y: 5 }]);
  });

  it('der Client gibt die Wild-Positionen vor dem Schritt weiter (Jagd aus einem echten Schritt)', () => {
    // Jäger mit Wild im Umkreis: ein Monat bringt eine Jagd
    const state = constructed('hunter', CAMP_LANDS, (s) => {
      addPrey(s, 2, 6, 3);
      s.herd.fat = 0;
    });
    const events = step(data, state, { type: 'advance' }).events;
    const hunted = events.find((e) => e.type === 'preyHunted');
    expect(hunted).toBeDefined();
    const c = new HerdeClient({
      data,
      locale: 'de',
      strings: de,
      store: new MemorySaveStore({ kind: 'game', game: { version: 2, seed: 'h3b', savedAt: 0, state, log: [] } }),
    });
    const fx: { type: string }[] = [];
    c.subscribeReports((r) => fx.push(...r.fx));
    c.dispatch({ type: 'advance' });
    expect(fx.some((f) => f.type === 'preyHunted')).toBe(true);
  });
});

describe('Eiszeiten und Ende', () => {
  it('Nummer der Eiszeit: laufende bzw. nächste, höchstens die letzte', () => {
    const v = viewOf(constructed('herd'));
    const max = data.params.ice.ages ?? null;
    expect(iceAgeNumber(v)).toEqual({ n: 1, max });
    expect(iceAgeNumber({ iceAges: { survived: 2, max: 3 } })).toEqual({ n: 3, max: 3 });
    expect(iceAgeNumber({ iceAges: { survived: 3, max: 3 } })).toEqual({ n: 3, max: 3 });
    expect(iceAgeNumber({ iceAges: { survived: 4, max: null } })).toEqual({ n: 5, max: null });
    expect(de.iceAgeOf(1, 3)).toBe('Eiszeit 1 von 3');
    expect(de.iceAgeChip(1, 3)).toBe('❄ 1/3');
    expect(de.iceAgeNext(3, 3)).toBe('Nächste Prüfung: Eiszeit 3 von 3 – die letzte');
    expect(en.iceAgeOf(2, null)).toBe('2nd ice age');
  });

  it('Bilanz: Sieg, ausgestorben, letzte Eiszeit ohne Lager als Mensch', () => {
    const base = viewOf(
      constructed('human', CAMP_LANDS, (s) => {
        s.month = 2 * data.months.length + 5;
        s.herd.traits = ['thick_fur'].filter((id) => data.traits.has(id));
        s.iceAges = 3;
        s.camp = { x: 1, y: 5 };
      }),
    );
    expect(endSummary(data, base)).toBeNull();
    const won = endSummary(data, { ...base, over: 'won' })!;
    expect(won).toMatchObject({
      kind: 'won',
      survivors: base.herd.size,
      years: 2,
      months: 5,
      stage: 'human',
      lastStage: true,
      iceAges: { survived: 3, max: data.params.ice.ages ?? null },
    });
    expect(won.traits).toEqual(base.evolution.traits);
    expect(endSummary(data, { ...base, over: 'lost', herd: { ...base.herd, size: 0 } })!.kind).toBe('extinct');
    const lastIce = endSummary(data, { ...base, over: 'lost' })!;
    expect(lastIce.kind).toBe('lastIce');
    const hunter = viewOf(constructed('hunter'));
    expect(endSummary(data, { ...hunter, over: 'lost' })).toMatchObject({ kind: 'lastIce', lastStage: false });
    // Texte
    expect(de.wonText(4)).toBe(
      'Die Herde ist Mensch geworden, hat ein Lager gegründet und die letzte Eiszeit überstanden. 4 Menschen haben überlebt.',
    );
    expect(de.lostIceText(true, 'Mensch')).toContain('ohne Lager');
    expect(de.lostIceText(false, 'Jäger und Sammler')).toContain('zuletzt: Jäger und Sammler');
    expect(en.lostIceText(false, 'Hunter-gatherers')).toContain('never became human');
    expect(de.iceAgesValue(2, 3)).toBe('2 von 3');
    expect(en.iceAgesValue(1, null)).toBe('1');
  });
});

describe('Hilfe und Einführung: Zahlen aus den Daten', () => {
  it('huntRules liest Wild, Jagd, Feuer und Lager aus den Daten', () => {
    const h = huntRules(data, 'de');
    const p = data.params.prey;
    expect(h).toMatchObject({
      preyMax: p.maxSize,
      spawnMinLand: p.spawnMinLand,
      spawnSize: p.spawnSize,
      fresh: data.params.fire.fresh,
    });
    expect(h.preyFrom).toBe(data.stages.get(p.from)!.name.de);
    expect(h.hunters.map((x) => x.name)).toEqual([
      data.stages.get('hunter')!.name.de,
      data.stages.get('human')!.name.de,
    ]);
    expect(h.rivals).toEqual(h.hunters.map((x) => x.name));
    expect(h.camp).toMatchObject({ radius: 1, near: ['Fluss', 'Wiese', 'Wald oder Altwald'] });
    expect(h.camp!.clear!.lands).toEqual(['Altwald', 'Wald']);
  });

  it('geänderte Daten ändern die Hilfe-Texte (de/en)', () => {
    const d = structuredClone(data);
    d.params.prey.spawnMinLand = 9;
    d.params.prey.maxSize = 7;
    d.params.ice.ages = 5;
    d.params.ice.wildAfter = 33;
    d.params.fire.fresh = 2;
    d.stages.get('hunter')!.huntKill = 6;
    d.stages.get('hunter')!.fireHunt = 4;
    d.stages.get('human')!.camp!.radius = 2;
    for (const [t, locale] of [
      [de, 'de'],
      [en, 'en'],
    ] as const) {
      const h = huntRules(d, locale);
      const r = ruleNumbers(d, locale, viewOf(constructed('herd')).evolution.stage);
      expect(t.helpPreyText(h)).toContain('9');
      expect(t.helpPreyText(h)).toContain('7');
      expect(t.helpPreyText(h)).toContain('6');
      expect(t.helpFireText(h)).toContain('4');
      expect(t.helpFireText(h)).toMatch(/3/);
      expect(t.helpCampText(h)).toContain('2');
      expect(t.helpIceText(r)).toContain('33');
      expect(t.helpIceText(r)).toContain('5');
      expect(t.helpGoalText(r)).toContain('5');
      expect(t.tutorial(r).find((c) => c.icon === '❄️')!.text).toContain('5');
    }
    // ohne letzte Prüfung: keine Zahl
    const u = structuredClone(data);
    delete u.params.ice.ages;
    const r = ruleNumbers(u, 'de', viewOf(constructed('herd')).evolution.stage);
    expect(r.iceAges).toBeNull();
    expect(de.helpIceText(r)).not.toContain('letzte Prüfung');
    expect(de.helpCampText({ ...huntRules(data, 'de'), camp: null })).toBe('Keine Stufe gründet ein Lager.');
  });

  it('Einführung bleibt kurz: ein Satz zum Ziel', () => {
    const r = ruleNumbers(data, 'de', viewOf(constructed('herd')).evolution.stage);
    const ice = de.tutorial(r).find((c) => c.icon === '❄️')!.text;
    expect(ice).toContain('Ziel: Werde Mensch und übersteh mit einem Lager die letzte, die 3. Eiszeit.');
    expect(de.tutorial(r)).toHaveLength(6);
  });
});

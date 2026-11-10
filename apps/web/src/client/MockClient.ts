import type { Action, CardView, FormKind, GameView, Locale, Targets, ZoneView } from '@core/api';
import type { BookView, GameClient, GameResult, Notice, PreviewView } from './GameClient.ts';

/**
 * Vorschau-Implementierung ohne Engine: liefert eine realistische GameView und simuliert Aktionen grob
 * (Karte verschwindet, Odem sinkt, Runde zählt hoch). Keine Spielregeln – die gehören in die Engine.
 */

type L = Record<Locale, string>;

interface CardDef {
  card: string;
  name: L;
  category: string;
  cost: number;
  text: L;
  slots: { id: string; kind: string; label: L }[];
  /** Grobe Wirkung auf die Zielzone: Index des Werts (0 Licht, 1 Feuchte, 2 Vegetation, 3 Sonderwert) → Änderung. */
  effect: Partial<Record<0 | 1 | 2 | 3, number>>;
}

const ZONE_SLOT = { id: 'zone', kind: 'zone', label: { de: 'Zone', en: 'Zone' } };
const NEIGHBOR_SLOT = { id: 'fall', kind: 'neighbor', label: { de: 'Nachbarzone', en: 'Neighbouring zone' } };

const CARDS: CardDef[] = [
  {
    card: 'thunderstorm',
    name: { de: 'Gewitter', en: 'Thunderstorm' },
    category: 'force',
    cost: 0,
    text: { de: 'Feuchte +2. Auf trockener Zone: 🔥 Feuer.', en: 'Moisture +2. On a dry zone: 🔥 fire.' },
    slots: [ZONE_SLOT],
    effect: { 1: 2 },
  },
  {
    card: 'rain',
    name: { de: 'Regen', en: 'Rain' },
    category: 'gift',
    cost: 1,
    text: { de: 'Feuchte +1.', en: 'Moisture +1.' },
    slots: [ZONE_SLOT],
    effect: { 1: 1 },
  },
  {
    card: 'sun',
    name: { de: 'Sonne', en: 'Sun' },
    category: 'gift',
    cost: 1,
    text: { de: 'Licht +1.', en: 'Light +1.' },
    slots: [ZONE_SLOT],
    effect: { 0: 1 },
  },
  {
    card: 'seeds',
    name: { de: 'Samen', en: 'Seeds' },
    category: 'gift',
    cost: 2,
    text: { de: 'Vegetation +1.', en: 'Vegetation +1.' },
    slots: [ZONE_SLOT],
    effect: { 2: 1 },
  },
  {
    card: 'storm',
    name: { de: 'Sturm', en: 'Storm' },
    category: 'force',
    cost: 0,
    text: {
      de: 'Vegetation −1. Auf dichter Zone: Baumsturz in die Nachbarzone.',
      en: 'Vegetation −1. On a dense zone: windthrow into the neighbour.',
    },
    slots: [ZONE_SLOT, NEIGHBOR_SLOT],
    effect: { 2: -1 },
  },
  {
    card: 'drought',
    name: { de: 'Dürre', en: 'Drought' },
    category: 'force',
    cost: 0,
    text: { de: 'Feuchte −2, Licht +1.', en: 'Moisture −2, light +1.' },
    slots: [ZONE_SLOT],
    effect: { 0: 1, 1: -2 },
  },
  {
    card: 'healing',
    name: { de: 'Heilung', en: 'Healing' },
    category: 'miracle',
    cost: 4,
    text: { de: 'Alle Werte der Zone rücken auf ihren Ruhewert.', en: 'All values of the zone return to rest.' },
    slots: [ZONE_SLOT],
    effect: { 2: 1, 3: 0 },
  },
];

const STAT_NAMES: L[] = [
  { de: 'Licht', en: 'Light' },
  { de: 'Feuchte', en: 'Moisture' },
  { de: 'Vegetation', en: 'Vegetation' },
];

interface GeoDef {
  id: string;
  name: L;
  special: { id: string; name: L };
  forms: Record<FormKind, { id: string; name: L }>;
  neighbors: string[];
}

const GEOS: GeoDef[] = [
  {
    id: 'mountains',
    name: { de: 'Berge', en: 'Mountains' },
    special: { id: 'snow', name: { de: 'Schnee', en: 'Snow' } },
    forms: {
      ideal: { id: 'alpine_meadow', name: { de: 'Alm', en: 'Alpine meadow' } },
      normal: { id: 'rock', name: { de: 'Fels', en: 'Rock' } },
      degraded: { id: 'scree', name: { de: 'Geröll', en: 'Scree' } },
      disturbance: { id: 'glacier', name: { de: 'Gletscher', en: 'Glacier' } },
    },
    neighbors: ['forest', 'river'],
  },
  {
    id: 'forest',
    name: { de: 'Wald', en: 'Forest' },
    special: { id: 'deadwood', name: { de: 'Totholz', en: 'Deadwood' } },
    forms: {
      ideal: { id: 'primeval_forest', name: { de: 'Urwald', en: 'Primeval forest' } },
      normal: { id: 'mixed_forest', name: { de: 'Mischwald', en: 'Mixed forest' } },
      degraded: { id: 'burnt_land', name: { de: 'Brandfläche', en: 'Burnt land' } },
      disturbance: { id: 'burnt_land', name: { de: 'Brandfläche', en: 'Burnt land' } },
    },
    neighbors: ['mountains', 'river', 'plains'],
  },
  {
    id: 'plains',
    name: { de: 'Flachland', en: 'Plains' },
    special: { id: 'soil', name: { de: 'Boden', en: 'Soil' } },
    forms: {
      ideal: { id: 'flower_meadow', name: { de: 'Blumenwiese', en: 'Flower meadow' } },
      normal: { id: 'steppe', name: { de: 'Steppe', en: 'Steppe' } },
      degraded: { id: 'wasteland', name: { de: 'Ödland', en: 'Wasteland' } },
      disturbance: { id: 'wasteland', name: { de: 'Ödland', en: 'Wasteland' } },
    },
    neighbors: ['forest', 'river', 'coast'],
  },
  {
    id: 'river',
    name: { de: 'Fluss', en: 'River' },
    special: { id: 'water', name: { de: 'Wasserstand', en: 'Water level' } },
    forms: {
      ideal: { id: 'floodplain', name: { de: 'Aue', en: 'Floodplain' } },
      normal: { id: 'stream', name: { de: 'Strom', en: 'Stream' } },
      degraded: { id: 'dry_bed', name: { de: 'Trockenes Flussbett', en: 'Dry riverbed' } },
      disturbance: { id: 'flood', name: { de: 'Hochwasser', en: 'Flood' } },
    },
    neighbors: ['mountains', 'forest', 'plains', 'coast'],
  },
  {
    id: 'coast',
    name: { de: 'Küste', en: 'Coast' },
    special: { id: 'salt', name: { de: 'Salz', en: 'Salt' } },
    forms: {
      ideal: { id: 'mangrove', name: { de: 'Mangrove', en: 'Mangrove' } },
      normal: { id: 'beach', name: { de: 'Strand', en: 'Beach' } },
      degraded: { id: 'salt_desert', name: { de: 'Salzwüste', en: 'Salt desert' } },
      disturbance: { id: 'salt_desert', name: { de: 'Salzwüste', en: 'Salt desert' } },
    },
    neighbors: ['river', 'plains'],
  },
];

const START_VALUES: Record<string, number[]> = {
  mountains: [4, 2, 2, 2],
  forest: [2, 3, 4, 2],
  plains: [4, 1, 0, 1],
  river: [3, 4, 3, 5],
  coast: [4, 3, 1, 3],
};

const START_LEVELS: Record<string, number> = { mountains: 2, forest: 2, plains: 1, river: 1, coast: 1 };

const START_POPULATIONS: Record<string, { species: string; name: L; tier: number; count: number }[]> = {
  forest: [
    { species: 'beetle', name: { de: 'Käfer', en: 'Beetles' }, tier: 1, count: 3 },
    { species: 'small_mammal', name: { de: 'Kleinsäuger', en: 'Small mammals' }, tier: 3, count: 2 },
  ],
  river: [{ species: 'fish', name: { de: 'Fische', en: 'Fish' }, tier: 2, count: 2 }],
  coast: [{ species: 'plankton', name: { de: 'Plankton', en: 'Plankton' }, tier: 1, count: 5 }],
  mountains: [{ species: 'bee', name: { de: 'Bienen', en: 'Bees' }, tier: 3, count: 1 }],
};

const SEASONS: { id: string; name: L }[] = [
  { id: 'spring', name: { de: 'Frühling', en: 'Spring' } },
  { id: 'summer', name: { de: 'Sommer', en: 'Summer' } },
  { id: 'autumn', name: { de: 'Herbst', en: 'Autumn' } },
  { id: 'winter', name: { de: 'Winter', en: 'Winter' } },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Grobe Form-Art aus den Werten – nur damit sich in der Vorschau sichtbar etwas ändert. */
function mockKind(geo: string, v: number[]): FormKind {
  const [light = 0, moist = 0, veg = 0, special = 0] = v;
  if (geo === 'river' && special >= 5) return 'disturbance';
  if (geo === 'river' && special === 0) return 'degraded';
  if (veg === 0 && moist <= 1) return 'degraded';
  if (veg === 0 && geo !== 'coast') return 'degraded';
  if (light >= 3 && veg >= 2 && moist >= 2 && special >= 1 && special <= 3) return 'ideal';
  return 'normal';
}

interface MockZone {
  geo: GeoDef;
  values: number[];
  kind: FormKind;
  level: number;
  levelProgress: number;
  populations: { species: string; name: L; tier: number; count: number }[];
}

interface MockState {
  round: number;
  harmony: number;
  breath: number;
  score: number;
  phase: 'play' | 'over';
  zones: MockZone[];
  hand: { uid: number; def: CardDef }[];
  drawPile: number;
  discardPile: number;
  playsThisTurn: number;
  nextUid: number;
  rng: number;
  lastHarmonyDelta: number;
}

const BREATH_MAX = 10;
const HAND_SIZE = 4;
const MIN_PLAYS = 1;

export class MockClient implements GameClient {
  readonly isMock = true;
  private state: MockState;
  private view: GameView;
  private readonly listeners = new Set<() => void>();
  private readonly noticeListeners = new Set<(notices: Notice[]) => void>();

  constructor(private readonly locale: Locale) {
    this.state = this.initialState();
    this.view = this.buildView();
  }

  getView(): GameView {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeNotices(listener: (notices: Notice[]) => void): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  /** Grobe Zielregel der Vorschau: `zone` = jede Zone, `neighbor` = Nachbarn der zuletzt gewählten Zone. */
  legalTargets(uid: number, chosen: Targets): string[] {
    const entry = this.state.hand.find((h) => h.uid === uid);
    if (!entry || entry.def.cost > this.state.breath || this.state.phase === 'over') return [];
    const slot = entry.def.slots.find((s) => chosen[s.id] === undefined);
    if (!slot) return [];
    if (slot.kind === 'neighbor') {
      const previous = Object.values(chosen).at(-1);
      return this.state.zones.find((z) => z.geo.id === previous)?.geo.neighbors ?? [];
    }
    return this.state.zones.map((z) => z.geo.id);
  }

  speciesName(speciesId: string): string {
    for (const zone of this.view.zones) {
      const pop = zone.populations.find((p) => p.species === speciesId);
      if (pop) return pop.name;
    }
    return speciesId;
  }

  preview(uid: number, targets: Targets): PreviewView | null {
    const entry = this.state.hand.find((h) => h.uid === uid);
    const zone = this.state.zones.find((z) => z.geo.id === targets['zone']);
    if (!entry || !zone) return null;
    const lc = this.locale;
    const changes: PreviewView['changes'] = [];
    for (const [stat, delta] of Object.entries(entry.def.effect)) {
      const i = Number(stat);
      const from = zone.values[i] ?? 0;
      const to = clamp(from + delta, 0, 5);
      const name = i === 3 ? zone.geo.special.name : STAT_NAMES[i];
      if (to !== from)
        changes.push({ zone: zone.geo.id, zoneName: zone.geo.name[lc], stat, statName: name?.[lc] ?? stat, from, to });
    }
    return {
      cost: entry.def.cost,
      affordable: entry.def.cost <= this.state.breath,
      changes,
      triggers: [],
      formChanges: [],
      populationChanges: [],
      eventChanges: [],
    };
  }

  getBook(): BookView {
    return {
      games: 0,
      species: [],
      speciesTotal: 0,
      milestones: [],
      best: { score: 0, rounds: 0, tier: 0 },
      totals: { rounds: 0, extinctions: 0, events: 0 },
    };
  }

  lastResult(): GameResult | null {
    return null;
  }

  newGame(): void {
    this.state = this.initialState();
    this.emit();
  }

  dispatch(action: Action): void {
    const s = this.state;
    if (s.phase === 'over') return;
    const notices: Notice[] = [];
    switch (action.type) {
      case 'play': {
        const index = s.hand.findIndex((h) => h.uid === action.uid);
        const entry = s.hand[index];
        if (!entry || entry.def.cost > s.breath) return;
        s.hand.splice(index, 1);
        s.breath -= entry.def.cost;
        s.discardPile += 1;
        s.playsThisTurn += 1;
        notices.push({ type: 'played', card: entry.def.name[this.locale] });
        const zone = s.zones.find((z) => z.geo.id === action.targets['zone']);
        if (zone) {
          for (const [stat, delta] of Object.entries(entry.def.effect)) {
            const i = Number(stat);
            zone.values[i] = clamp((zone.values[i] ?? 0) + delta, 0, 5);
          }
        }
        break;
      }
      case 'endTurn': {
        if (s.playsThisTurn < MIN_PLAYS) return;
        this.natureStep();
        const season = SEASONS[(s.round - 1) % SEASONS.length] ?? SEASONS[0]!;
        notices.push({ type: 'round', round: s.round, season: season.name[this.locale] });
        if (s.lastHarmonyDelta !== 0) notices.push({ type: 'harmony', delta: s.lastHarmonyDelta });
        if (this.state.phase === 'over') notices.push({ type: 'collapsed' });
        break;
      }
    }
    this.emit();
    if (notices.length > 0) for (const listener of this.noticeListeners) listener(notices);
  }

  // --- Simulation ---------------------------------------------------------------------------------

  private initialState(): MockState {
    const s: MockState = {
      round: 1,
      harmony: 60,
      breath: 3,
      score: 0,
      phase: 'play',
      zones: GEOS.map((geo) => {
        const values = [...(START_VALUES[geo.id] ?? [2, 2, 2, 2])];
        return {
          geo,
          values,
          kind: mockKind(geo.id, values),
          level: START_LEVELS[geo.id] ?? 1,
          levelProgress: 0.33,
          populations: (START_POPULATIONS[geo.id] ?? []).map((p) => ({ ...p })),
        };
      }),
      hand: [],
      drawPile: 14,
      discardPile: 0,
      playsThisTurn: 0,
      nextUid: 1,
      rng: 7,
      lastHarmonyDelta: 0,
    };
    // Starthand: eine bunte Mischung aus Naturgewalt, Gaben und Wunder.
    for (const id of ['thunderstorm', 'rain', 'storm', 'healing']) {
      const def = CARDS.find((c) => c.card === id);
      if (def) s.hand.push({ uid: s.nextUid++, def });
    }
    return s;
  }

  private random(): number {
    // Kleiner LCG – reicht für die Vorschau.
    this.state.rng = (this.state.rng * 1103515245 + 12345) % 2147483648;
    return this.state.rng / 2147483648;
  }

  private natureStep(): void {
    const s = this.state;
    let delta = 0;
    for (const zone of s.zones) {
      // Werte driften leicht, damit sich die Insel bewegt.
      const i = Math.floor(this.random() * 4);
      zone.values[i] = clamp((zone.values[i] ?? 0) + (this.random() < 0.5 ? -1 : 1), 0, 5);
      zone.kind = mockKind(zone.geo.id, zone.values);
      if (zone.kind === 'ideal') delta += 2;
      if (zone.kind === 'degraded') delta -= 3;
      if (zone.kind === 'disturbance') delta -= 1;
      zone.levelProgress += zone.kind === 'degraded' ? -0.34 : 0.34;
      if (zone.levelProgress >= 1) {
        zone.level = Math.min(5, zone.level + 1);
        zone.levelProgress = 0;
      } else if (zone.levelProgress < 0) {
        zone.level = Math.max(1, zone.level - 1);
        zone.levelProgress = 0.66;
      }
      for (const p of zone.populations) p.count = clamp(p.count + (zone.kind === 'degraded' ? -1 : 1), 0, 9);
    }
    const before = s.harmony;
    s.harmony = clamp(s.harmony + delta - 1, 0, 100);
    s.lastHarmonyDelta = s.harmony - before;
    s.breath = Math.min(BREATH_MAX, s.breath + this.income());
    s.score += Math.round(s.harmony / 10);
    s.round += 1;
    s.playsThisTurn = 0;
    while (s.hand.length < HAND_SIZE) {
      const def = CARDS[Math.floor(this.random() * CARDS.length)];
      if (!def) break;
      s.hand.push({ uid: s.nextUid++, def });
      if (s.drawPile > 0) s.drawPile -= 1;
      else s.discardPile = 0;
    }
    if (s.harmony <= 0) s.phase = 'over';
  }

  private income(): number {
    return 1 + Math.floor(this.state.harmony / 25);
  }

  // --- View ---------------------------------------------------------------------------------------

  private emit(): void {
    this.view = this.buildView();
    for (const listener of this.listeners) listener();
  }

  private buildView(): GameView {
    const s = this.state;
    const lc = this.locale;
    const season = SEASONS[(s.round - 1) % SEASONS.length] ?? SEASONS[0]!;
    const zones: ZoneView[] = s.zones.map((z) => {
      const statDefs = [...STAT_NAMES, z.geo.special.name];
      const statIds = ['light', 'moisture', 'vegetation', z.geo.special.id];
      const form = z.geo.forms[z.kind];
      const warnings: ZoneView['warnings'] = [];
      if ((z.values[1] ?? 0) <= 1 && s.hand.some((h) => h.def.card === 'thunderstorm')) {
        warnings.push({ card: 'thunderstorm', trigger: 'fire', name: lc === 'de' ? 'Feuer' : 'Fire', icon: '🔥' });
      }
      if ((z.values[2] ?? 0) >= 4 && s.hand.some((h) => h.def.card === 'storm')) {
        warnings.push({
          card: 'storm',
          trigger: 'windthrow',
          name: lc === 'de' ? 'Baumsturz' : 'Windthrow',
          icon: '🌪️',
        });
      }
      return {
        id: z.geo.id,
        geography: z.geo.id,
        geographyName: z.geo.name[lc],
        stats: statDefs.map((name, i) => ({ id: statIds[i] ?? '', name: name[lc], value: z.values[i] ?? 0, max: 5 })),
        form: { id: form.id, name: form.name[lc], kind: z.kind },
        level: z.level,
        levelProgress: z.levelProgress,
        neighbors: z.geo.neighbors,
        tags: [],
        populations: z.populations
          .filter((p) => p.count > 0)
          .map((p) => ({ species: p.species, name: p.name[lc], tier: p.tier, count: p.count })),
        warnings,
      };
    });
    const hand: CardView[] = s.hand.map(({ uid, def }) => ({
      uid,
      card: def.card,
      name: def.name[lc],
      category: def.category,
      cost: def.cost,
      text: def.text[lc],
      playable: s.phase === 'play' && def.cost <= s.breath,
      slots: def.slots.map((slot) => ({ id: slot.id, kind: slot.kind, label: slot.label[lc] })),
    }));
    return {
      locale: lc,
      round: s.round,
      year: Math.floor((s.round - 1) / 4) + 1,
      season: { id: season.id, name: season.name[lc] },
      phase: s.phase,
      harmony: { value: s.harmony, max: 100, trend: s.lastHarmonyDelta },
      breath: { value: s.breath, max: BREATH_MAX, nextIncome: this.income() },
      score: s.score,
      zones,
      hand,
      drawPile: s.drawPile,
      discardPile: s.discardPile,
      playsThisTurn: s.playsThisTurn,
      minPlays: MIN_PLAYS,
      canEndTurn: s.phase === 'play' && s.playsThisTurn >= MIN_PLAYS,
      forecast: {
        id: 'heatwave',
        name: lc === 'de' ? 'Hitzesommer' : 'Heatwave',
        text: lc === 'de' ? 'Alle Zonen Feuchte −1' : 'All zones moisture −1',
      },
      highestTier: Math.max(0, ...s.zones.flatMap((z) => z.populations.map((p) => p.tier))),
    };
  }
}

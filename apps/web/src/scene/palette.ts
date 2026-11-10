/** Farbstimmung im Stil des Referenzbilds: weiche, leicht entsättigte Low-Poly-Töne. Nur Optik. */
export const COLORS = {
  background: '#c8c4d6',
  earth: '#8a5a3b',
  earthDark: '#6a4329',
  underside: '#5a3a26',
  sea: '#86b3c6',
  water: '#5aa6d2',
  snow: '#f2f5fa',
  trunk: '#7a5236',
  stump: '#3b302b',
  boulder: '#a29d93',
  shrub: '#5f9a45',
  crown: '#3f7d4a',
  crownOld: '#24452c',
  grassDry: '#c2b46a',
  grassLush: '#4f9a35',
  herdBody: '#f1e9d8',
  herdHead: '#5a4636',
  wolfBody: '#6f7180',
  wolfHead: '#4a4b57',
  wolfHungry: '#8a5a5a',
  arrow: '#ffffff',
  arrowPreview: '#ffb347',
  target: '#ffd66b',
  grown: '#8ff07a',
  select: '#ffffff',
  dim: '#2d2a3a',
  fire: '#ff7a2f',
  fireCore: '#ffd24a',
  change: '#fff3b8',
  hunt: '#e0453a',
  born: '#8ff07a',
  loss: '#7a86a8',
  rain: '#a9d4f5',
  evolve: '#ffd66b',
  blocked: '#7a3040',
  // Wild (Rehe): warmes Rotbraun, hungrig blasser
  preyBody: '#c47f3e',
  preyHungry: '#c9a982',
  preyHead: '#6b4a2b',
  // Lager: Zelte aus Fell, Steine, Feuer; Lagerplätze mit Fahne
  camp: '#ffb347',
  campHut: '#b98a5a',
  campStone: '#8f877c',
  campFlame: '#ffb03a',
  campSite: '#ffe08a',
  flag: '#f2a33a',
  // Effekte: Jagd, Rudel reißt Wild, Wild wandert ein, Rodung
  preyHunt: '#e07a3a',
  preyFire: '#ff9f2f',
  packPrey: '#8b8d9c',
  preyNew: '#d9b77a',
  cleared: '#a8774a',
} as const;

/**
 * Aussehen der Herde je Stufe (nur Optik): Figur, Farben, Symbol. Unbekannte Stufen (z. B. neue in den Daten)
 * bekommen `STAGE_FALLBACK`.
 */
export interface StageLook {
  /** grasende Tiere (vierbeinig) oder aufrechte Gestalten */
  figure: 'grazer' | 'upright' | 'walker' | 'hunter' | 'human';
  body: string;
  head: string;
  icon: string;
}

export const STAGE_LOOK: Record<string, StageLook> = {
  herd: { figure: 'grazer', body: COLORS.herdBody, head: COLORS.herdHead, icon: '🐑' },
  gatherer: { figure: 'upright', body: '#a8703f', head: '#5d4130', icon: '🫐' },
  wanderer: { figure: 'walker', body: '#c4583e', head: '#e2b88f', icon: '🚶' },
  hunter: { figure: 'hunter', body: '#7d5a36', head: '#e2b88f', icon: '🏹' },
  human: { figure: 'human', body: '#4f6fa8', head: '#e2b88f', icon: '🏕' },
};

export const STAGE_FALLBACK: StageLook = { figure: 'upright', body: '#b98a5a', head: '#5d4130', icon: '✨' };

export const stageLook = (id: string): StageLook => STAGE_LOOK[id] ?? STAGE_FALLBACK;

/** Lichtfarbe der Sonne je Jahreszeit (leichte Tönung); `ice` gilt in der Eiszeit. */
export const SEASON_LIGHT: Record<string, { sun: string; sky: string }> = {
  spring: { sun: '#fff4e2', sky: '#f4f1ff' },
  summer: { sun: '#fff0c2', sky: '#f8f4ea' },
  autumn: { sun: '#ffd6ae', sky: '#f6ece6' },
  winter: { sun: '#e0e9ff', sky: '#eef2ff' },
  ice: { sun: '#d4e4ff', sky: '#e8f2ff' },
};

/** Darstellung einer Landschaft: Höhe der Oberkante, Farbe, Bewuchs. Unbekannte Ids: `landStyle` leitet ab. */
export interface LandStyle {
  /** Oberkante des Plättchens (Welt-y) */
  top: number;
  color: string;
  /** Wasserfläche statt Boden */
  water?: boolean;
  /** Bewuchs: Büsche, Bäume (Anzahl, Höhe, Farbe), Stümpfe, Felsbrocken */
  shrubs?: number;
  trees?: { count: number; height: number; color: string };
  stumps?: number;
  boulders?: number;
}

export const LAND_STYLES: Record<string, LandStyle> = {
  sea: { top: -0.22, color: COLORS.sea, water: true },
  river: { top: 0.02, color: COLORS.water, water: true },
  steppe: { top: 0.12, color: '#d8cb98' },
  meadow: { top: 0.16, color: '#9cc76b' },
  burnt: { top: 0.1, color: '#5e4b40', stumps: 3 },
  bush: { top: 0.18, color: '#7fae5c', shrubs: 4 },
  forest: { top: 0.2, color: '#4f8a52', trees: { count: 3, height: 0.55, color: COLORS.crown } },
  old: { top: 0.22, color: '#33593b', trees: { count: 5, height: 0.78, color: COLORS.crownOld } },
  rock: { top: 0.42, color: '#9a958b', boulders: 3 },
};

/** Stil einer Landschaft; neue Landschaften ohne eigenen Eintrag bekommen einen schlichten Stil aus ihren Daten. */
export function landStyle(id: string, info?: { walk: boolean; wood: boolean }): LandStyle {
  const known = LAND_STYLES[id];
  if (known) return known;
  if (info && !info.walk) return { top: 0.4, color: '#9a958b', boulders: 2 };
  if (info?.wood) return { top: 0.2, color: '#4f8a52', trees: { count: 3, height: 0.55, color: COLORS.crown } };
  return { top: 0.14, color: '#b8c48a' };
}

/** Mischt zwei Hex-Farben (#rrggbb), k = 0 … 1. Rein, ohne three. */
export function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 0xff;
    const vb = (pb >> shift) & 0xff;
    return Math.round(va + (vb - va) * Math.max(0, Math.min(1, k)));
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

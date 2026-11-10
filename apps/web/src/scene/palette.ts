import type { FormKind } from '@core/api';

/** Farbstimmung im Stil des Referenzbilds: weiche, leicht entsättigte Low-Poly-Töne. */
export const COLORS = {
  background: '#c8c4d6',
  earth: '#8a5a3b',
  earthDark: '#6a4329',
  stratum: '#5a3a26',
  rockBottom: '#4d3324',
  rock: '#9c98aa',
  rockDark: '#7f7b8f',
  snow: '#f6f8fb',
  water: '#6cb7dc',
  waterDeep: '#4f9fcf',
  sand: '#e8d6a0',
  trunk: '#7a5236',
  trunkBurnt: '#3b302b',
  select: '#ffffff',
  target: '#ffd66b',
  /** Nebel bei niedriger Harmonie – nah an der Hintergrundfarbe, damit die Insel „verblasst“. */
  fog: '#dcd8e6',
  paleSky: '#e4e2ea',
  burst: '#fff3b8',
} as const;

/** Lichtfarbe der Sonne je Jahreszeit (leichte Tönung). */
export const SEASON_LIGHT: Record<string, { sun: string; sky: string }> = {
  spring: { sun: '#fff4e2', sky: '#f4f1ff' },
  summer: { sun: '#fff0c2', sky: '#f8f4ea' },
  autumn: { sun: '#ffd6ae', sky: '#f6ece6' },
  winter: { sun: '#e0e9ff', sky: '#eef2ff' },
};

/** Darstellungsgruppen der Arten (nur Optik; die Regeln kennen keine Gruppen). */
export type SpeciesGroup = 'water' | 'insect' | 'reptile' | 'bird' | 'mammal' | 'human';
export const SPECIES_GROUPS: SpeciesGroup[] = ['water', 'insect', 'reptile', 'bird', 'mammal', 'human'];

export const GROUP_COLORS: Record<SpeciesGroup, string> = {
  water: '#3f8fd0',
  insect: '#e7b43c',
  reptile: '#5aa85a',
  bird: '#f2f2f6',
  mammal: '#a8714a',
  human: '#e2876a',
};

/**
 * Gruppe und Farbe je bekannter Art. Unbekannte Arten fallen über ihre Stufe in eine Gruppe.
 * AUSLEGUNG: Frösche zählen optisch zu „Reptil“ (Amphibien und Reptilien).
 */
const SPECIES_STYLE: Record<string, { group: SpeciesGroup; color: string }> = {
  plankton: { group: 'water', color: '#a6e3ea' },
  fish: { group: 'water', color: '#3f8fd0' },
  beetle: { group: 'insect', color: '#5b4a78' },
  bee: { group: 'insect', color: '#f2c230' },
  frog: { group: 'reptile', color: '#4fae5a' },
  lizard: { group: 'reptile', color: '#9ab53f' },
  small_mammal: { group: 'mammal', color: '#c09062' },
  bird: { group: 'bird', color: '#f4f4f8' },
  deer: { group: 'mammal', color: '#a0603a' },
  wolf: { group: 'mammal', color: '#8d8f9c' },
  raptor: { group: 'bird', color: '#7d5b45' },
  primate: { group: 'mammal', color: '#6b4a35' },
  human: { group: 'human', color: '#e2876a' },
};

export function speciesStyle(species: string, tier: number): { group: SpeciesGroup; color: string } {
  const known = SPECIES_STYLE[species];
  if (known) return known;
  const group: SpeciesGroup = tier <= 1 ? 'insect' : tier <= 4 ? 'reptile' : tier <= 6 ? 'mammal' : 'human';
  return { group, color: GROUP_COLORS[group] };
}

const TOP: Record<string, Record<FormKind, string>> = {
  mountains: { ideal: '#9fcd6f', normal: '#a9a6b4', degraded: '#b8ab98', disturbance: '#e8eef6' },
  forest: { ideal: '#4e9a4b', normal: '#6aaa56', degraded: '#4d433b', disturbance: '#7a4b31' },
  plains: { ideal: '#a8d470', normal: '#c3c47b', degraded: '#b59c78', disturbance: '#9c7a5a' },
  river: { ideal: '#7dc56a', normal: '#8ebe67', degraded: '#b69e78', disturbance: '#86b3a3' },
  coast: { ideal: '#73b06a', normal: '#e7d49e', degraded: '#f0eadc', disturbance: '#d9cfb8' },
};

const FALLBACK: Record<FormKind, string> = {
  ideal: '#8fcb6a',
  normal: '#9cc46e',
  degraded: '#b59c78',
  disturbance: '#a5785a',
};

export function topColor(geography: string, kind: FormKind): string {
  return TOP[geography]?.[kind] ?? FALLBACK[kind];
}

export const CROWN: Record<FormKind, string> = {
  ideal: '#2f7d3f',
  normal: '#428f47',
  degraded: '#6f7d4a',
  disturbance: '#a35b2c',
};

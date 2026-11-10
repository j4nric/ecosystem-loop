import type { FormKind, SpeciesGroup } from '@core/api';

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

/** Darstellungsgruppen der Arten kommen aus der Engine (`populations[].group`, species.yaml → group). */
export type { SpeciesGroup };
export const SPECIES_GROUPS: SpeciesGroup[] = ['water', 'insect', 'amphibian', 'reptile', 'bird', 'mammal', 'human'];

export const GROUP_COLORS: Record<SpeciesGroup, string> = {
  water: '#3f8fd0',
  insect: '#e7b43c',
  amphibian: '#4fae5a',
  reptile: '#9ab53f',
  bird: '#f2f2f6',
  mammal: '#a8714a',
  human: '#e2876a',
};

/** Nur Optik: eigene Farbtöne einzelner Arten innerhalb ihrer Gruppe. Unbekannte Arten nehmen die Gruppenfarbe. */
const SPECIES_COLORS: Record<string, string> = {
  plankton: '#a6e3ea',
  fish: '#3f8fd0',
  beetle: '#5b4a78',
  bee: '#f2c230',
  frog: '#4fae5a',
  lizard: '#9ab53f',
  small_mammal: '#c09062',
  bird: '#f4f4f8',
  deer: '#a0603a',
  wolf: '#8d8f9c',
  raptor: '#7d5b45',
  primate: '#6b4a35',
  human: '#e2876a',
};

/**
 * Gruppe und Farbe einer Art. Die Gruppe liefert die Engine; fehlt sie (ältere Daten, Vorschau-Client),
 * ordnet die Stufe grob zu.
 */
export function speciesStyle(pop: { species: string; tier: number; group?: SpeciesGroup }): {
  group: SpeciesGroup;
  color: string;
} {
  const t = pop.tier;
  const group: SpeciesGroup = pop.group ?? (t <= 1 ? 'insect' : t <= 4 ? 'reptile' : t <= 6 ? 'mammal' : 'human');
  return { group, color: SPECIES_COLORS[pop.species] ?? GROUP_COLORS[group] };
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

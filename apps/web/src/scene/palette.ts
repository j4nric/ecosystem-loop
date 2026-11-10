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
} as const;

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

/** Figurenfarbe nach Entwicklungsstufe der Art (1 Plankton … 7 Mensch). */
export const TIER_COLORS = ['#f2f2f2', '#9fd8e8', '#7aa6e0', '#e0b36c', '#c98a5a', '#e07a7a', '#b088d0', '#f5d36b'];

export function tierColor(tier: number): string {
  return TIER_COLORS[Math.max(0, Math.min(TIER_COLORS.length - 1, tier))] ?? '#ffffff';
}

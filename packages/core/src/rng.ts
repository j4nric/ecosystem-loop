/**
 * Deterministischer Zufall (mulberry32). Der Zustand ist eine Zahl im Spielzustand,
 * damit Spielstände klonbar und Läufe per Seed reproduzierbar sind.
 */
export interface RngHolder {
  rng: number;
}

export function nextFloat(h: RngHolder): number {
  h.rng = (h.rng + 0x6d2b79f5) | 0;
  let t = h.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(h: RngHolder, maxExclusive: number): number {
  return Math.floor(nextFloat(h) * maxExclusive);
}

export function pick<T>(h: RngHolder, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick aus leerer Liste');
  return items[nextInt(h, items.length)]!;
}

export function shuffle<T>(h: RngHolder, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(h, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** Leitet aus einem Text-/Zahl-Seed einen 32-bit-Startwert ab. */
export function seedFrom(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

/** Bequemer Zugriff auf den Zufall eines Halters (z. B. des Spielzustands). */
export interface Rng {
  float(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
}

export function rngOf(h: RngHolder): Rng {
  return {
    float: () => nextFloat(h),
    int: (n) => nextInt(h, n),
    pick: (items) => pick(h, items),
    shuffle: (items) => shuffle(h, items),
  };
}

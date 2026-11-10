/**
 * Deterministischer Zufall. Der Zustand ist eine Zahl im Spielzustand (`rng`), damit Spielstände klonbar und
 * Läufe per Seed reproduzierbar sind. Bauweise wie in der alten Engine (Konzept 0.4, siehe docs/archiv/).
 *
 * AUSLEGUNG: Abweichend von der alten Engine schreitet der Zustand wie im Prototyp (`rand(s)`) fort: Jeder Zug wertet die
 * mulberry32-Mischung einmal auf dem aktuellen Zustand aus und erhöht ihn dann um 0x9e3779b9. So liefert die
 * Engine für denselben Seed dieselbe Zahlenfolge wie `prototypes/herde/index.html` (Gleichheitstest).
 */
export interface RngHolder {
  rng: number;
}

export function nextFloat(h: RngHolder): number {
  let t = (h.rng + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  h.rng = (h.rng + 0x9e3779b9) >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(h: RngHolder, maxExclusive: number): number {
  return Math.floor(nextFloat(h) * maxExclusive);
}

export function pick<T>(h: RngHolder, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick aus leerer Liste');
  return items[nextInt(h, items.length)]!;
}

/** Startwert aus einem Seed: Zahlen direkt (wie im Prototyp), Texte über FNV-1a. */
export function seedFrom(seed: string | number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

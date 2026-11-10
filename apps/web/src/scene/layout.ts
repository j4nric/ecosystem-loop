/** Anordnung der Zonen auf der Insel (Konzept Kap. 4): Berge hinten, Fluss quer durch, Küste vorne. */

/** Radius einer Zonen-Kachel (Sechseck, Spitze nach vorn). */
export const HEX_RADIUS = 1.6;
/** Abstand der Mittelpunkte benachbarter Kacheln (Kante an Kante) plus kleine Fuge. */
const SPACING = Math.sqrt(3) * HEX_RADIUS + 0.06;
const ROW = SPACING * Math.sin(Math.PI / 3);

/** Gitterposition je Geografie: x nach rechts, z nach vorn (zur Kamera). */
const GRID: Record<string, [number, number]> = {
  mountains: [0, -ROW],
  forest: [-SPACING / 2, 0],
  river: [SPACING / 2, 0],
  plains: [0, ROW],
  coast: [SPACING, ROW],
};

const center = (() => {
  const points = Object.values(GRID);
  const x = points.reduce((s, p) => s + p[0], 0) / points.length;
  const z = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [x, z] as const;
})();

/** Position einer Zone; unbekannte Geografien werden auf einem Ring dahinter verteilt. */
export function zonePosition(geography: string, index: number): [number, number, number] {
  const p = GRID[geography];
  if (p) return [p[0] - center[0], 0, p[1] - center[1]];
  const angle = (index / 6) * Math.PI * 2;
  return [Math.cos(angle) * SPACING * 2, 0, Math.sin(angle) * SPACING * 2];
}

/** Höhe der Grasoberfläche über dem Gruppenursprung. */
export const TOP_Y = 0;

/** Deterministischer Zufall je Zone (für Platzierung von Bäumen, Felsen, Figuren). */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Zufälliger Punkt im Sechseck (in Kachel-Koordinaten), mit Rand. */
export function pointInHex(rand: () => number, margin = 0.78): [number, number] {
  for (let tries = 0; tries < 20; tries++) {
    const x = (rand() * 2 - 1) * HEX_RADIUS * margin;
    const z = (rand() * 2 - 1) * HEX_RADIUS * margin;
    // Spitze nach ±z: |x| ≤ √3/2·R und |x|·½ + |z|·√3/2 ≤ √3/2·R (Kanten bei 30°)
    const r = HEX_RADIUS * margin * (Math.sqrt(3) / 2);
    if (Math.abs(x) <= r && Math.abs(x) * 0.5 + Math.abs(z) * (Math.sqrt(3) / 2) <= r) return [x, z];
  }
  return [0, 0];
}

/**
 * Baut aus dem Lesemodell der Engine die Instanzen der Insel (rein, ohne three): Plättchen, Erdreich, Gras als
 * Futteranzeige, Büsche, Bäume, Stümpfe, Felsbrocken. Wird nur neu berechnet, wenn sich die View ändert.
 */
import type { CellView } from '@being-god/herde';
import { COLORS, landStyle, mix } from './palette.ts';

export interface InstanceSpec {
  position: [number, number, number];
  scale: [number, number, number];
  rotationY?: number;
  color: string;
}

/** Kantenlänge eines Felds in Welt-Einheiten und Unterkante des Erdreichs. */
export const TILE = 1;
export const BOTTOM = -0.85;
/** Dicke der farbigen Deckschicht eines Plättchens. */
export const SLAB = 0.14;

export interface Grid {
  width: number;
  height: number;
}

/** Mitte eines Felds in Weltkoordinaten (x nach Osten, z nach Süden = zur Kamera). */
export function cellCenter(grid: Grid, x: number, y: number): [number, number] {
  return [(x - (grid.width - 1) / 2) * TILE, (y - (grid.height - 1) / 2) * TILE];
}

/** Deterministischer Zufall 0 … 1 je Feld und Objekt, damit Bäume und Gras nicht springen. */
export function jitter(i: number, k: number): number {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(k + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface LandInfo {
  walk: boolean;
  wood: boolean;
}

export interface IslandModel {
  tops: InstanceSpec[];
  earth: InstanceSpec[];
  tufts: InstanceSpec[];
  shrubs: InstanceSpec[];
  crowns: InstanceSpec[];
  trunks: InstanceSpec[];
  boulders: InstanceSpec[];
  /** Oberkante je Feld (Index = y * Breite + x) */
  topY: number[];
}

export interface ModelOptions {
  /** Landschaften, die die Herde frisst (nur dort zeigt Gras das Futter) */
  eats: readonly string[];
  /** Winter: Schnee auf dem Land (0 … 1) */
  snow: number;
  info?: (land: string) => LandInfo | undefined;
}

/** Platz für ein Objekt im Feld: Ring um die Mitte, damit Herde und Rudel in der Mitte sichtbar bleiben. */
function spot(i: number, k: number, n: number, radius = 0.3): [number, number] {
  const angle = ((k + jitter(i, k) * 0.6) / Math.max(1, n)) * Math.PI * 2 + jitter(i, 99) * 6.28;
  const r = radius * (0.7 + 0.45 * jitter(i, k + 31));
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

export function buildIsland(grid: Grid, cells: readonly CellView[], opts: ModelOptions): IslandModel {
  const m: IslandModel = { tops: [], earth: [], tufts: [], shrubs: [], crowns: [], trunks: [], boulders: [], topY: [] };
  cells.forEach((c, i) => {
    const style = landStyle(c.land, opts.info?.(c.land));
    const [cx, cz] = cellCenter(grid, c.x, c.y);
    const top = style.top;
    m.topY.push(top);
    let color = style.color;
    if (c.fertile) color = mix(color, '#7fd34a', 0.35);
    if (!style.water && c.walkable) color = mix(color, COLORS.snow, opts.snow);
    m.tops.push({ position: [cx, top, cz], scale: [1, SLAB, 1], color });
    const earthTop = top - SLAB;
    m.earth.push({
      position: [cx, earthTop, cz],
      scale: [1, Math.max(0.05, earthTop - BOTTOM), 1],
      color: c.land === 'sea' ? COLORS.earthDark : COLORS.earth,
    });

    // Futter: Grashalme, Zahl = Futter, Höhe und Sättigung nach Anteil am Maximum
    if (c.food > 0 && c.maxFood > 0 && opts.eats.includes(c.land)) {
      const share = Math.min(1, c.food / c.maxFood);
      const n = Math.min(8, c.food);
      const grass = mix(mix(COLORS.grassDry, COLORS.grassLush, share), COLORS.snow, opts.snow * 0.5);
      for (let k = 0; k < n; k++) {
        const ox = (jitter(i, k * 3) - 0.5) * 0.8;
        const oz = (jitter(i, k * 3 + 1) - 0.5) * 0.8;
        const h = 0.1 + 0.2 * share * (0.75 + 0.5 * jitter(i, k * 3 + 2));
        m.tufts.push({
          position: [cx + ox, top, cz + oz],
          scale: [1, h, 1],
          rotationY: jitter(i, k) * 6,
          color: grass,
        });
      }
    }
    for (let k = 0; k < (style.shrubs ?? 0); k++) {
      const [ox, oz] = spot(i, k, style.shrubs ?? 1);
      const s = 0.12 + 0.06 * jitter(i, k + 5);
      m.shrubs.push({
        position: [cx + ox, top + s * 0.6, cz + oz],
        scale: [s, s * 0.85, s],
        rotationY: jitter(i, k) * 6,
        color: mix(COLORS.shrub, COLORS.snow, opts.snow * 0.3),
      });
    }
    const trees = style.trees;
    if (trees) {
      for (let k = 0; k < trees.count; k++) {
        const [ox, oz] = spot(i, k, trees.count, trees.count > 4 ? 0.32 : 0.28);
        const h = trees.height * (0.8 + 0.4 * jitter(i, k + 11));
        m.trunks.push({ position: [cx + ox, top, cz + oz], scale: [1, 1, 1], color: COLORS.trunk });
        m.crowns.push({
          position: [cx + ox, top + 0.14, cz + oz],
          scale: [h * 0.9, h, h * 0.9],
          rotationY: jitter(i, k) * 6,
          color: mix(trees.color, COLORS.snow, opts.snow * 0.25),
        });
      }
    }
    for (let k = 0; k < (style.stumps ?? 0); k++) {
      const [ox, oz] = spot(i, k, style.stumps ?? 1);
      m.trunks.push({ position: [cx + ox, top, cz + oz], scale: [1.3, 0.45, 1.3], color: COLORS.stump });
    }
    for (let k = 0; k < (style.boulders ?? 0); k++) {
      const [ox, oz] = spot(i, k, style.boulders ?? 1, 0.24);
      const s = 0.16 + 0.1 * jitter(i, k + 3);
      m.boulders.push({
        position: [cx + ox, top + s * 0.4, cz + oz],
        scale: [s, s * 1.1, s],
        rotationY: jitter(i, k) * 6,
        color: COLORS.boulder,
      });
    }
  });
  return m;
}

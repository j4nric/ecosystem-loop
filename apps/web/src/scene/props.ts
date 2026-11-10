import type { ZoneView } from '@core/api';
import type { InstanceSpec } from './Instanced.tsx';
import { pointInHex, seeded, TOP_Y } from './layout.ts';
import { COLORS, CROWN } from './palette.ts';

/** Platzhalter-Ausstattung aller Zonen, gesammelt je Geometrie für Instancing. */
export interface PropSet {
  crowns: InstanceSpec[];
  trunks: InstanceSpec[];
  rocks: InstanceSpec[];
}

const stat = (zone: ZoneView, index: number) => zone.stats[index]?.value ?? 0;

/** Bereiche, die frei bleiben (Bergspitzen, Fluss, Wasser). */
export function blocked(zone: ZoneView, x: number, z: number): boolean {
  switch (zone.geography) {
    case 'mountains':
      return Math.hypot(x + 0.1, z + 0.15) < 0.95;
    case 'river': {
      // Fluss läuft unter 60° durch die Kachel
      const d = Math.abs(x * Math.sin(Math.PI / 3) - z * Math.cos(Math.PI / 3));
      return d < 0.45;
    }
    case 'coast':
      return x * 0.5 + z * 0.866 > 0.05;
    default:
      return false;
  }
}

export function buildProps(zones: ZoneView[], positions: Map<string, [number, number, number]>): PropSet {
  const set: PropSet = { crowns: [], trunks: [], rocks: [] };
  for (const zone of zones) {
    const base = positions.get(zone.id);
    if (!base) continue;
    const rand = seeded(zone.id);
    const veg = stat(zone, 2);
    const kind = zone.form.kind;
    const burnt = kind === 'degraded' || kind === 'disturbance';
    const at = (x: number, z: number, y = 0): [number, number, number] => [base[0] + x, TOP_Y + y, base[2] + z];

    // Bäume: viele im Wald, wenige anderswo
    const treeFactor: Record<string, number> = { forest: 3, mountains: 1, plains: 0.8, river: 1, coast: 0.8 };
    const trees = Math.round(veg * (treeFactor[zone.geography] ?? 1));
    let placed = 0;
    for (let i = 0; i < 40 && placed < trees; i++) {
      const [x, z] = pointInHex(rand);
      if (blocked(zone, x, z)) continue;
      placed++;
      const s = 0.75 + rand() * 0.5;
      const rot = rand() * Math.PI;
      if (burnt && zone.geography === 'forest') {
        set.trunks.push({
          position: at(x, z, 0.18 * s),
          scale: [s, s * 1.4, s],
          rotationY: rot,
          color: COLORS.trunkBurnt,
        });
        continue;
      }
      set.trunks.push({ position: at(x, z, 0.12 * s), scale: [s, s, s], rotationY: rot, color: COLORS.trunk });
      set.crowns.push({ position: at(x, z, 0.55 * s), scale: [s, s, s], rotationY: rot, color: CROWN[kind] });
    }

    // Felsen: Berge immer, sonst bei kargem Boden
    const rockCount = zone.geography === 'mountains' ? 4 : veg <= 1 ? 3 : 0;
    for (let i = 0; i < rockCount; i++) {
      const [x, z] = pointInHex(rand);
      if (blocked(zone, x, z) && zone.geography !== 'mountains') continue;
      const s = 0.12 + rand() * 0.16;
      set.rocks.push({
        position: at(x, z, s * 0.5),
        scale: [s * 1.3, s, s],
        rotationY: rand() * Math.PI,
        color: rand() < 0.5 ? COLORS.rock : COLORS.rockDark,
      });
    }
  }
  return set;
}

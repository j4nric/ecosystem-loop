import type { ZoneView } from '@core/api';
import type { InstanceSpec } from './Instanced.tsx';
import { HEX_RADIUS, pointInHex, seeded, TOP_Y } from './layout.ts';
import { speciesStyle, type SpeciesGroup } from './palette.ts';
import { blocked } from './props.ts';

/** Figuren aller Bestände, gesammelt je Gruppe (ein Instanced-Mesh je Gruppe, Köpfe gemeinsam). */
export type CreatureSet = Record<SpeciesGroup | 'heads', InstanceSpec[]>;

/** Höchstens so viele Figuren je Art und Zone (Bestand 0–9 ⇒ 1 Figur je Tier). */
const MAX_FIGURES = 9;

/** Liegt der Punkt (Kachel-Koordinaten) im Wasser der Zone? */
function inWater(geography: string, x: number, z: number): boolean {
  switch (geography) {
    case 'river':
      return Math.abs(x * Math.sin(Math.PI / 3) - z * Math.cos(Math.PI / 3)) < 0.3;
    case 'coast':
      return x * 0.5 + z * 0.866 > 0.3;
    default:
      return false;
  }
}

function fits(group: SpeciesGroup, zone: ZoneView, x: number, z: number): boolean {
  const wet = zone.geography === 'river' || zone.geography === 'coast';
  if (group === 'water') return !wet || inWater(zone.geography, x, z);
  if (group === 'bird') return true;
  return !blocked(zone, x, z);
}

export function buildCreatures(zones: ZoneView[], positions: Map<string, [number, number, number]>): CreatureSet {
  const set: CreatureSet = {
    water: [],
    insect: [],
    amphibian: [],
    reptile: [],
    bird: [],
    mammal: [],
    human: [],
    heads: [],
  };
  for (const zone of zones) {
    const base = positions.get(zone.id);
    if (!base) continue;
    const pops = zone.populations.filter((p) => p.count > 0);
    pops.forEach((pop, p) => {
      const { group, color } = speciesStyle(pop);
      const rand = seeded(`${zone.id}:${pop.species}`);
      // Grüppchen je Art um einen Punkt im Ring um die Kachelmitte
      const angle = (p / Math.max(1, pops.length)) * Math.PI * 2 + 0.6;
      const cx = Math.cos(angle) * HEX_RADIUS * 0.45;
      const cz = Math.sin(angle) * HEX_RADIUS * 0.45;
      const s = (pop.species === 'plankton' ? 0.6 : 0.85) + Math.min(pop.tier, 7) * 0.04;
      for (let i = 0; i < Math.min(MAX_FIGURES, pop.count); i++) {
        let x = cx + (rand() - 0.5) * 0.6;
        let z = cz + (rand() - 0.5) * 0.6;
        for (let tries = 0; tries < 16 && !fits(group, zone, x, z); tries++) [x, z] = pointInHex(rand, 0.8);
        const rot = rand() * Math.PI * 2;
        const lift = group === 'bird' ? 0.65 + rand() * 0.35 : pop.species === 'bee' ? 0.22 + rand() * 0.1 : 0;
        const y = TOP_Y + lift + GROUND[group] * s;
        const at: [number, number, number] = [base[0] + x, y, base[2] + z];
        set[group].push({ position: at, scale: [s, s, s], rotationY: rot, color });
        const head = HEAD[group];
        if (head) {
          // Kopf vorn (lokal +x) bzw. oben, mit der Figur gedreht
          const hx = Math.cos(rot) * head[0] * s;
          const hz = -Math.sin(rot) * head[0] * s;
          set.heads.push({ position: [at[0] + hx, at[1] + head[1] * s, at[2] + hz], scale: [s, s, s], color });
        }
      }
    });
  }
  return set;
}

/** Höhe des Figurenmittelpunkts über dem Boden je Gruppe (vor Skalierung). */
const GROUND: Record<SpeciesGroup, number> = {
  water: 0.05,
  insect: 0.05,
  amphibian: 0.035,
  reptile: 0.03,
  bird: 0,
  mammal: 0.1,
  human: 0.1,
};

/** Kopfversatz [vorn, oben] je Gruppe; null = kein Kopf. */
const HEAD: Record<SpeciesGroup, [number, number] | null> = {
  water: null,
  insect: null,
  amphibian: [0.05, 0.035],
  reptile: null,
  bird: null,
  mammal: [0.1, 0.06],
  human: [0, 0.13],
};

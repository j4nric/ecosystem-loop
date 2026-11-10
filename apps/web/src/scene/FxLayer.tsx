import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  Matrix4,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import type { Fx, StepReport } from '../client/GameClient.ts';
import { GEO } from './geometries.ts';
import { cellCenter, jitter, type Grid } from './islandModel.ts';
import { COLORS } from './palette.ts';

const RINGS = 10;
const FLAMES = 48;
const STREAKS = 48;
const RING_SECONDS = 0.9;
const FIRE_SECONDS = 1.6;
const RAIN_SECONDS = 1.3;
/** Sprung zur nächsten Stufe: goldene Lichtsäule über der Herde */
const BEAM_SECONDS = 2.2;
/** Reduzierte Bewegung: statt Flammen und Regen ein kurzes, ruhiges Einfärben der Felder */
const TINTS = 64;
const TINT_SECONDS = 1.4;
const TINT_OPACITY = 0.5;

interface Ring {
  x: number;
  y: number;
  z: number;
  color: string;
  grow: number;
  delay: number;
  start: number | null;
}

interface Flame {
  x: number;
  y: number;
  z: number;
  seed: number;
  delay: number;
  start: number | null;
}

interface Tint {
  x: number;
  y: number;
  z: number;
  color: string;
}

const m = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const s = new Vector3();
const c = new Color();

/**
 * Kurze Effekte aus den Ereignissen eines Schritts: Ringe (Feldwechsel, Wölfe reißen, Nachwuchs, Verluste),
 * Flammen (Feuer) und Regen. Bei reduzierter Bewegung entfallen das Flackern der Flammen und der fallende Regen;
 * stattdessen färben sich die betroffenen Felder kurz und ruhig ein. Feste Pools ohne Neuanlegen; gearbeitet
 * (und bei frameloop="demand" neu gezeichnet) wird nur, solange ein Effekt läuft.
 */
export function FxLayer({
  grid,
  topY,
  subscribe,
  reducedMotion,
}: {
  grid: Grid;
  topY: readonly number[];
  subscribe: (listener: (r: StepReport) => void) => () => void;
  reducedMotion: boolean;
}) {
  const rings = useRef<Ring[]>([]);
  const flames = useRef<Flame[]>([]);
  const rainStart = useRef<number | null | undefined>(undefined);
  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const flameMesh = useRef<InstancedMesh>(null);
  const rainMesh = useRef<InstancedMesh>(null);
  const tints = useRef<Tint[]>([]);
  const tintStart = useRef<number | null | undefined>(undefined);
  const tintMesh = useRef<InstancedMesh>(null);
  const beamMesh = useRef<Mesh>(null);
  const beam = useRef<{ x: number; y: number; z: number; start: number | null } | null>(null);
  const geo = useRef({ grid, topY, reducedMotion });
  useEffect(() => {
    geo.current = { grid, topY, reducedMotion };
  }, [grid, topY, reducedMotion]);
  const invalidate = useThree((st) => st.invalidate);

  useEffect(
    () =>
      subscribe((report) => {
        if (report.fx.length === 0) return;
        const { grid: g, topY: tops, reducedMotion: calm } = geo.current;
        const at = (x: number, y: number): [number, number, number] => {
          const [cx, cz] = cellCenter(g, x, y);
          return [cx, (tops[y * g.width + x] ?? 0) + 0.03, cz];
        };
        const ring = (x: number, y: number, color: string, grow: number, delay = 0) => {
          const [px, py, pz] = at(x, y);
          rings.current = [...rings.current, { x: px, y: py, z: pz, color, grow, delay, start: null }].slice(-RINGS);
        };
        const tint = (cells: readonly { x: number; y: number }[], color: string) => {
          const fresh = cells.map((cell) => {
            const [px, py, pz] = at(cell.x, cell.y);
            return { x: px, y: py + 0.01, z: pz, color };
          });
          // Ein gemeinsamer, sanfter Verlauf für alle Felder eines Schritts.
          tints.current = (tintStart.current === undefined ? fresh : [...tints.current, ...fresh]).slice(-TINTS);
          tintStart.current = null;
        };
        for (const fx of report.fx as Fx[]) {
          switch (fx.type) {
            case 'change':
              ring(fx.x, fx.y, COLORS.change, 1.4);
              break;
            case 'fire':
              if (calm) {
                tint(fx.cells, COLORS.fire);
                break;
              }
              fx.cells.forEach((cell, n) => {
                const [px, py, pz] = at(cell.x, cell.y);
                for (let k = 0; k < 3; k++)
                  flames.current.push({ x: px, y: py, z: pz, seed: n * 3 + k, delay: n * 0.12, start: null });
              });
              flames.current = flames.current.slice(-FLAMES);
              break;
            case 'hunt':
              ring(fx.x, fx.y, COLORS.hunt, 2.2);
              for (const pack of fx.packs) ring(pack.x, pack.y, COLORS.hunt, 1.2, 0.15);
              break;
            case 'born':
              ring(fx.x, fx.y, COLORS.born, 2, 0.1);
              break;
            case 'loss':
              ring(fx.x, fx.y, COLORS.loss, 1.8, 0.2);
              break;
            case 'evolve': {
              if (calm) {
                tint([fx], COLORS.evolve);
                ring(fx.x, fx.y, COLORS.evolve, 2);
                break;
              }
              for (let k = 0; k < 3; k++) ring(fx.x, fx.y, COLORS.evolve, 2.6, k * 0.35);
              const [px, py, pz] = at(fx.x, fx.y);
              beam.current = { x: px, y: py, z: pz, start: null };
              break;
            }
            case 'rain':
              if (calm) tint(fx.cells, COLORS.grown);
              else rainStart.current = null;
              break;
          }
        }
        invalidate();
      }),
    [subscribe, invalidate],
  );

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const speed = reducedMotion ? 2 : 1;

    // Ringe
    rings.current = rings.current.filter((r) => r.start === null || now - r.start < RING_SECONDS / speed + r.delay);
    for (let i = 0; i < RINGS; i++) {
      const mesh = ringMeshes.current[i];
      if (!mesh) continue;
      const r = rings.current[i];
      mesh.visible = r !== undefined;
      if (!r) continue;
      if (r.start === null) r.start = now;
      const k = Math.max(0, (now - r.start - r.delay) * speed) / RING_SECONDS;
      mesh.visible = k > 0;
      mesh.position.set(r.x, r.y, r.z);
      mesh.scale.setScalar(0.6 + k * r.grow);
      const mat = mesh.material as MeshBasicMaterial;
      mat.color.set(r.color);
      mat.opacity = 0.9 * (1 - k);
    }

    // Flammen
    const fm = flameMesh.current;
    if (fm && (flames.current.length > 0 || fm.count > 0)) {
      flames.current = flames.current.filter((f) => f.start === null || now - f.start < FIRE_SECONDS / speed + f.delay);
      flames.current.forEach((f, i) => {
        if (f.start === null) f.start = now;
        const k = Math.max(0, (now - f.start - f.delay) * speed) / FIRE_SECONDS;
        const life = k <= 0 ? 0 : Math.sin(Math.min(1, k) * Math.PI);
        const ox = (jitter(f.seed, 1) - 0.5) * 0.55;
        const oz = (jitter(f.seed, 2) - 0.5) * 0.55;
        const flicker = 0.8 + 0.3 * Math.sin(now * 20 + f.seed);
        p.set(f.x + ox, f.y + k * 0.25, f.z + oz);
        s.set(life * 1.2, life * flicker * (1.2 + jitter(f.seed, 3)), life * 1.2);
        m.compose(p, q.identity(), s);
        fm.setMatrixAt(i, m);
        fm.setColorAt(i, c.set(k < 0.5 ? COLORS.fireCore : COLORS.fire));
      });
      fm.count = flames.current.length;
      fm.instanceMatrix.needsUpdate = true;
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    }

    // Regen
    const rm = rainMesh.current;
    if (rm && rainStart.current !== undefined) {
      if (rainStart.current === null) rainStart.current = now;
      const k = ((now - rainStart.current) * speed) / RAIN_SECONDS;
      if (k >= 1) {
        rainStart.current = undefined;
        rm.count = 0;
      } else {
        const w = geo.current.grid.width;
        const h = geo.current.grid.height;
        for (let i = 0; i < STREAKS; i++) {
          const fall = (k * 2.2 + jitter(i, 5)) % 1;
          p.set((jitter(i, 1) - 0.5) * w, 2.6 - fall * 2.6, (jitter(i, 2) - 0.5) * h);
          m.compose(p, q.identity(), s.set(1, 1, 1));
          rm.setMatrixAt(i, m);
        }
        rm.count = STREAKS;
        rm.instanceMatrix.needsUpdate = true;
      }
    }

    // Lichtsäule beim Sprung: wächst aus dem Boden, leuchtet auf und verblasst
    const bm = beamMesh.current;
    const b = beam.current;
    if (bm) {
      bm.visible = b !== null;
      if (b) {
        if (b.start === null) b.start = now;
        const k = (now - b.start) / BEAM_SECONDS;
        if (k >= 1) {
          beam.current = null;
          bm.visible = false;
        } else {
          bm.position.set(b.x, b.y, b.z);
          bm.scale.set(1, Math.min(1, k * 4), 1);
          bm.rotation.y = now * 1.5;
          (bm.material as MeshBasicMaterial).opacity = 0.55 * Math.sin(Math.min(1, k * 1.2) * Math.PI);
        }
      }
    }

    // Einfärben (reduzierte Bewegung): einmal einblenden und wieder aus, ohne Bewegung
    const tm = tintMesh.current;
    if (tm && tintStart.current !== undefined) {
      if (tintStart.current === null) {
        tintStart.current = now;
        tints.current.forEach((t, i) => {
          tm.setMatrixAt(i, m.makeTranslation(t.x, t.y, t.z));
          tm.setColorAt(i, c.set(t.color));
        });
        tm.count = tints.current.length;
        tm.instanceMatrix.needsUpdate = true;
        if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
      }
      const k = (now - tintStart.current) / TINT_SECONDS;
      const mat = tm.material as MeshBasicMaterial;
      if (k >= 1) {
        tintStart.current = undefined;
        tints.current = [];
        tm.count = 0;
      } else mat.opacity = TINT_OPACITY * Math.sin(k * Math.PI);
    }

    // Bei frameloop="demand" weiterzeichnen, solange ein Effekt läuft.
    const active =
      rings.current.length > 0 ||
      flames.current.length > 0 ||
      (fm?.count ?? 0) > 0 ||
      rainStart.current !== undefined ||
      tintStart.current !== undefined ||
      beam.current !== null;
    if (active) invalidate();
  });

  return (
    <>
      {Array.from({ length: RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            ringMeshes.current[i] = mesh;
          }}
          geometry={GEO.ring}
          visible={false}
          renderOrder={3}
        >
          <meshBasicMaterial transparent depthWrite={false} fog={false} />
        </mesh>
      ))}
      <mesh ref={beamMesh} geometry={GEO.beam} visible={false} renderOrder={4} raycast={() => null}>
        <meshBasicMaterial
          color={COLORS.evolve}
          transparent
          opacity={0}
          depthWrite={false}
          fog={false}
          side={DoubleSide}
        />
      </mesh>
      <instancedMesh ref={flameMesh} args={[GEO.flame, undefined, FLAMES]} count={0} frustumCulled={false}>
        <meshBasicMaterial transparent opacity={0.92} depthWrite={false} fog={false} />
      </instancedMesh>
      <instancedMesh ref={rainMesh} args={[GEO.streak, undefined, STREAKS]} count={0} frustumCulled={false}>
        <meshBasicMaterial color={COLORS.rain} transparent opacity={0.7} depthWrite={false} fog={false} />
      </instancedMesh>
      <instancedMesh
        ref={tintMesh}
        args={[GEO.square, undefined, TINTS]}
        count={0}
        frustumCulled={false}
        renderOrder={2}
        raycast={() => null}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} fog={false} />
      </instancedMesh>
    </>
  );
}

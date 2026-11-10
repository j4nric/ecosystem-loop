import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh } from 'three';

/** Eine Gruppe von Figuren auf einem Feld (die Herde oder ein Rudel). */
export interface FigureGroup {
  id: string;
  position: [number, number, number];
  /** Zahl der Figuren */
  count: number;
  /** Größe der Figuren (1 = normal) */
  size: number;
  /** Abstand der Figuren voneinander */
  spread: number;
  body: string;
  head: string;
}

const CAPACITY = 64;
const MOVE_SECONDS = 0.7;
const HOP = 0.14;
/** Goldener Winkel: Figuren als Sonnenblumen-Muster um die Mitte. */
const GOLDEN = 2.39996;

interface Track {
  from: Vector3;
  to: Vector3;
  cur: Vector3;
  /** Startzeit der Bewegung (null = beim nächsten Frame) oder -1 = steht */
  t0: number | null;
  /** Blickrichtung (Drehung um y) */
  facing: number;
}

const m = new Matrix4();
const q = new Quaternion();
const up = new Vector3(0, 1, 0);
const p = new Vector3();
const s = new Vector3();
const c = new Color();

/**
 * Herde bzw. Rudel als Gruppen einfacher Tierfiguren (je ein Instanced Mesh für Körper und Kopf).
 * Zieht eine Gruppe auf ein anderes Feld, hüpft sie dorthin; nur während dieser Bewegung werden Matrizen
 * geschrieben, sonst bleibt alles stehen.
 */
export function Figures({
  groups,
  bodyGeometry,
  headGeometry,
  reducedMotion,
}: {
  groups: FigureGroup[];
  bodyGeometry: BufferGeometry;
  headGeometry: BufferGeometry;
  reducedMotion: boolean;
}) {
  const bodies = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const tracks = useRef(new Map<string, Track>());
  const dirty = useRef(true);
  const groupsRef = useRef(groups);
  const invalidate = useThree((st) => st.invalidate);

  // Feste Lage und Drehung je Figur (Index in der Gruppe)
  const offsets = useMemo(
    () =>
      Array.from({ length: CAPACITY }, (_, k) => {
        const r = Math.sqrt(k + 0.4);
        return { x: Math.cos(k * GOLDEN) * r, z: Math.sin(k * GOLDEN) * r, turn: Math.sin(k * 12.9898) * 0.5 };
      }),
    [],
  );

  useEffect(() => {
    groupsRef.current = groups;
    const seen = new Set<string>();
    for (const g of groups) {
      seen.add(g.id);
      const target = new Vector3(...g.position);
      const track = tracks.current.get(g.id);
      if (!track) {
        tracks.current.set(g.id, {
          from: target.clone(),
          to: target,
          cur: target.clone(),
          t0: -1,
          facing: -Math.PI / 2,
        });
      } else if (!track.to.equals(target)) {
        const dx = target.x - track.cur.x;
        const dz = target.z - track.cur.z;
        if (Math.abs(dx) + Math.abs(dz) > 1e-3) track.facing = Math.atan2(-dz, dx);
        track.from.copy(track.cur);
        track.to = target;
        track.t0 = reducedMotion ? -1 : null;
        if (reducedMotion) track.cur.copy(target);
      }
    }
    for (const id of [...tracks.current.keys()]) if (!seen.has(id)) tracks.current.delete(id);
    dirty.current = true;
    invalidate(); // bei frameloop="demand" den nächsten Frame anfordern, der die Matrizen schreibt
  }, [groups, reducedMotion, invalidate]);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    let moving = false;
    for (const track of tracks.current.values()) {
      if (track.t0 === -1) continue;
      if (track.t0 === null) track.t0 = now;
      const k = Math.min(1, (now - track.t0) / MOVE_SECONDS);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      track.cur.lerpVectors(track.from, track.to, e);
      track.cur.y += Math.sin(Math.PI * k) * HOP;
      if (k >= 1) {
        track.cur.copy(track.to);
        track.t0 = -1;
      } else moving = true;
    }
    if (!moving && !dirty.current) return;
    dirty.current = moving;
    if (moving) invalidate();
    const b = bodies.current;
    const h = heads.current;
    if (!b || !h) return;
    let i = 0;
    for (const g of groupsRef.current) {
      const track = tracks.current.get(g.id);
      if (!track) continue;
      const hop = track.t0 !== -1 && track.t0 !== null ? now - track.t0 : 0;
      for (let k = 0; k < g.count && i < CAPACITY; k++, i++) {
        const o = offsets[k]!;
        // während des Zugs leicht versetzt hüpfen
        const bounce = hop > 0 ? Math.abs(Math.sin(hop * 14 + k)) * 0.03 : 0;
        p.set(track.cur.x + o.x * g.spread, track.cur.y + bounce, track.cur.z + o.z * g.spread);
        q.setFromAxisAngle(up, track.facing + o.turn);
        s.setScalar(g.size);
        m.compose(p, q, s);
        b.setMatrixAt(i, m);
        h.setMatrixAt(i, m);
        b.setColorAt(i, c.set(g.body));
        h.setColorAt(i, c.set(g.head));
      }
    }
    for (const mesh of [b, h]) {
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={bodies} args={[bodyGeometry, undefined, CAPACITY]} frustumCulled={false}>
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={heads} args={[headGeometry, undefined, CAPACITY]} frustumCulled={false}>
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </>
  );
}

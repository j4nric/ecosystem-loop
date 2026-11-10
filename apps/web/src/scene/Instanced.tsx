import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Color, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh } from 'three';
import type { InstanceSpec } from './islandModel.ts';

export type { InstanceSpec };

const m = new Matrix4();
const q = new Quaternion();
const up = new Vector3(0, 1, 0);
const pos = new Vector3();
const scl = new Vector3();
const col = new Color();

/** Schreibt Instanzen in ein Instanced Mesh (Matrix und Farbe). */
export function writeInstances(mesh: InstancedMesh, items: readonly InstanceSpec[]): void {
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.rotationY ?? 0);
    m.compose(pos.set(...it.position), q, scl.set(...it.scale));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.set(it.color));
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** Kapazität als Zweierpotenz: Die Instanz wird nur neu angelegt, wenn sie wachsen muss. */
export const capacityFor = (n: number): number => Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, n))));

interface Props {
  geometry: BufferGeometry;
  items: InstanceSpec[];
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

/**
 * Viele gleiche Objekte in einem Draw Call (flach schattiert, Low-Poly). Die Matrizen werden nur geschrieben,
 * wenn sich `items` ändert – nie pro Frame.
 */
export function Instanced({ geometry, items, onClick }: Props) {
  const ref = useRef<InstancedMesh>(null);
  const capacity = useMemo(() => capacityFor(items.length), [items.length]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    writeInstances(mesh, items);
    mesh.computeBoundingSphere();
  }, [items, capacity]);

  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[geometry, undefined, capacity]}
      frustumCulled={false}
      onClick={onClick}
    >
      <meshLambertMaterial flatShading />
    </instancedMesh>
  );
}

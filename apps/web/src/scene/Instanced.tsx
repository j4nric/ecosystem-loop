import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh } from 'three';

export interface InstanceSpec {
  position: [number, number, number];
  scale: [number, number, number];
  rotationY?: number;
  color: string;
}

/**
 * Viele gleiche Objekte in einem Draw Call. Die Kapazität wächst nur, damit die Instanz nicht bei jeder
 * Änderung neu angelegt wird.
 */
export function Instanced({ geometry, items }: { geometry: BufferGeometry; items: InstanceSpec[] }) {
  const ref = useRef<InstancedMesh>(null);
  const capacity = useMemo(() => Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, items.length)))), [items.length]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const c = new Color();
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rotationY ?? 0);
      m.compose(new Vector3(...it.position), q, new Vector3(...it.scale));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(it.color));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, capacity]);

  return (
    <instancedMesh key={capacity} ref={ref} args={[geometry, undefined, capacity]} frustumCulled={false}>
      <meshLambertMaterial flatShading />
    </instancedMesh>
  );
}

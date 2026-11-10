import { Vector3, type Camera, type Object3D } from 'three';

const anchorPos = new Vector3();

/**
 * Gemeinsame Ablage zwischen der 3D-Szene und der DOM-Schicht darüber: Kacheln (für Raycasts beim Ziehen),
 * Anker der Beschriftungen und die Beschriftungs-Elemente. Wird nur in Ref-Callbacks und Frames gelesen
 * bzw. geschrieben, nie während des Renderns.
 */
export class SceneRegistry {
  readonly tiles = new Map<string, Object3D>();
  readonly anchors = new Map<string, Object3D>();
  readonly labels = new Map<string, HTMLElement>();

  private readonly placed = new Map<string, string>();

  /** Projiziert die Anker auf den Bildschirm und setzt Lage, Stapelung und Sichtbarkeit der Beschriftungen. */
  projectLabels(camera: Camera, width: number, height: number): void {
    for (const [id, el] of this.labels) {
      const anchor = this.anchors.get(id);
      if (!anchor) continue;
      anchor.getWorldPosition(anchorPos);
      const depth = anchorPos.distanceTo(camera.position);
      anchorPos.project(camera);
      const visible = anchorPos.z < 1;
      const x = (((anchorPos.x + 1) / 2) * width).toFixed(1);
      const y = (((1 - anchorPos.y) / 2) * height).toFixed(1);
      const key = `${x},${y},${visible ? 1 : 0}`;
      if (this.placed.get(id) === key && el.style.visibility !== '') continue;
      this.placed.set(id, key);
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.style.zIndex = String(Math.max(1, Math.round(1000 - depth * 20)));
      el.style.visibility = visible ? 'visible' : 'hidden';
    }
  }

  register<T>(map: Map<string, T>, id: string, value: T | null): void {
    if (value) map.set(id, value);
    else map.delete(id);
  }
}

/** Liefert die Zone unter einem Bildschirmpunkt (Client-Koordinaten) oder null. */
export type ZonePicker = (clientX: number, clientY: number) => string | null;

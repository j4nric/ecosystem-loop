import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
} from 'three';

/** Pfeil in der Ebene: Schaft und Spitze, Länge 1 entlang −z (nach Norden), flach auf dem Boden. */
function arrowGeometry(): ShapeGeometry {
  const s = new Shape();
  const w = 0.07;
  const head = 0.22;
  s.moveTo(-w, 0);
  s.lineTo(w, 0);
  s.lineTo(w, 1 - head);
  s.lineTo(head, 1 - head);
  s.lineTo(0, 1);
  s.lineTo(-head, 1 - head);
  s.lineTo(-w, 1 - head);
  s.closePath();
  const g = new ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Geteilte Geometrien – einmal angelegt, von allen Instanzen benutzt. Ursprung jeweils am Fuß. */
export const GEO = {
  /** Plättchen und Erdreich: Oberkante bei y = 0, Höhe über scale.y */
  block: new BoxGeometry(0.97, 1, 0.97).translate(0, -0.5, 0),
  tuft: new ConeGeometry(0.055, 1, 4, 1).translate(0, 0.5, 0),
  shrub: new IcosahedronGeometry(1, 0),
  crown: new ConeGeometry(0.3, 1, 6, 1).translate(0, 0.5, 0),
  trunk: new CylinderGeometry(0.035, 0.05, 0.18, 5).translate(0, 0.09, 0),
  boulder: new IcosahedronGeometry(1, 0),
  underside: new ConeGeometry(1, 1, 7, 1),
  // Tiere: Körper und Kopf (je ein Instanced Mesh)
  animalBody: new BoxGeometry(0.16, 0.09, 0.085).translate(0, 0.085, 0),
  animalHead: new BoxGeometry(0.06, 0.065, 0.06).translate(0.095, 0.13, 0),
  // Aufrechte Gestalten (Waldsammler: gedrungen; Wanderer: schlank und größer)
  uprightBody: new CylinderGeometry(0.035, 0.05, 0.13, 5).translate(0, 0.075, 0),
  uprightHead: new IcosahedronGeometry(0.035, 0).translate(0, 0.17, 0),
  walkerBody: new CylinderGeometry(0.026, 0.04, 0.17, 5).translate(0, 0.095, 0),
  walkerHead: new IcosahedronGeometry(0.03, 0).translate(0, 0.205, 0),
  wolfBody: new BoxGeometry(0.2, 0.075, 0.07).translate(0, 0.09, 0),
  wolfHead: new ConeGeometry(0.045, 0.12, 4, 1).rotateZ(-Math.PI / 2).translate(0.15, 0.12, 0),
  // Hervorhebungen
  square: new PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2),
  frame: new RingGeometry(0.6, 0.68, 4, 1).rotateZ(Math.PI / 4).rotateX(-Math.PI / 2),
  frameThin: new RingGeometry(0.54, 0.62, 4, 1).rotateZ(Math.PI / 4).rotateX(-Math.PI / 2),
  ring: new RingGeometry(0.3, 0.4, 24, 1).rotateX(-Math.PI / 2),
  arrow: arrowGeometry(),
  marker: new OctahedronGeometry(0.09, 0).scale(1, 1.6, 1),
  flame: new ConeGeometry(0.11, 0.42, 5, 1).translate(0, 0.21, 0),
  streak: new BoxGeometry(0.015, 0.35, 0.015),
  /** Lichtsäule beim Sprung zur nächsten Stufe (offen, Fuß bei y = 0) */
  beam: new CylinderGeometry(0.42, 0.5, 2.4, 7, 1, true).translate(0, 1.2, 0),
};

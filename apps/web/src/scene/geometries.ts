import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mehrere Teile zu einer Geometrie (ein Draw Call je Figur-Teil); Teile mit Index werden vorher aufgelöst. */
function merge(...parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  if (!merged) throw new Error('Geometrien passen nicht zusammen');
  merged.computeVertexNormals();
  return merged;
}

/** Wild (Reh): Rumpf mit Schwanz (Körperfarbe); Beine, Hals, Kopf und Geweih (Kopffarbe). Blick nach +x. */
function deerBody(): BufferGeometry {
  return merge(
    new BoxGeometry(0.15, 0.065, 0.06).translate(0, 0.125, 0),
    new BoxGeometry(0.03, 0.035, 0.03).rotateZ(0.6).translate(-0.085, 0.145, 0),
  );
}
function deerHead(): BufferGeometry {
  const leg = (x: number, z: number) => new BoxGeometry(0.016, 0.1, 0.016).translate(x, 0.05, z);
  return merge(
    leg(0.055, 0.02),
    leg(0.055, -0.02),
    leg(-0.055, 0.02),
    leg(-0.055, -0.02),
    new BoxGeometry(0.028, 0.08, 0.03).rotateZ(-0.45).translate(0.08, 0.175, 0),
    new BoxGeometry(0.06, 0.035, 0.035).translate(0.115, 0.215, 0),
    new ConeGeometry(0.008, 0.06, 3).rotateX(0.4).translate(0.1, 0.255, 0.014),
    new ConeGeometry(0.008, 0.06, 3).rotateX(-0.4).translate(0.1, 0.255, -0.014),
  );
}

/** Jäger: schlanke Gestalt mit Speer (Körperfarbe); Kopf wie beim Wanderer. */
function hunterBody(): BufferGeometry {
  return merge(
    new CylinderGeometry(0.026, 0.04, 0.17, 5).translate(0, 0.095, 0),
    new CylinderGeometry(0.006, 0.006, 0.32, 4).rotateX(0.25).translate(0.04, 0.16, 0.02),
    new ConeGeometry(0.014, 0.05, 4).rotateX(0.25).translate(0.04, 0.33, 0.063),
  );
}

/** Lager: zwei Zelte (Hütten) – Fellbahnen als Kegel mit Eingang – und eine Feuerstelle aus Steinen. */
function campHuts(): BufferGeometry {
  return merge(
    new ConeGeometry(0.15, 0.26, 6).translate(-0.25, 0.13, -0.27),
    new ConeGeometry(0.12, 0.22, 6).translate(0.26, 0.11, -0.3),
    new CylinderGeometry(0.008, 0.008, 0.08, 3).translate(-0.25, 0.29, -0.27),
    new CylinderGeometry(0.008, 0.008, 0.07, 3).translate(0.26, 0.25, -0.3),
  );
}
function campStones(): BufferGeometry {
  const stones: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    stones.push(new IcosahedronGeometry(0.03, 0).translate(Math.cos(a) * 0.08, 0.015, Math.sin(a) * 0.08 - 0.04));
  }
  // Holzscheite in der Mitte
  stones.push(new BoxGeometry(0.11, 0.018, 0.02).rotateY(0.6).translate(0, 0.012, -0.04));
  stones.push(new BoxGeometry(0.11, 0.018, 0.02).rotateY(-0.6).translate(0, 0.02, -0.04));
  return merge(...stones);
}

/** Fahne für Lagerplätze: Stange und Wimpel. */
function flag(): BufferGeometry {
  return merge(
    new CylinderGeometry(0.012, 0.012, 0.5, 4).translate(0, 0.25, 0),
    new BoxGeometry(0.16, 0.1, 0.012).translate(0.08, 0.44, 0),
  );
}

/** Gefällter Baum (Rodung): Krone und Stamm, Fuß bei y = 0. */
function fallingTree(): BufferGeometry {
  return merge(
    new CylinderGeometry(0.035, 0.05, 0.18, 5).translate(0, 0.09, 0),
    new ConeGeometry(0.22, 0.55, 6).translate(0, 0.45, 0),
  );
}

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
  hunterBody: hunterBody(),
  /** Mensch: Gewand als Kegel (anders als die Zylinder von Sammlern und Wanderern) */
  humanBody: new ConeGeometry(0.05, 0.17, 6).translate(0, 0.085, 0),
  humanHead: new IcosahedronGeometry(0.034, 0).translate(0, 0.19, 0),
  deerBody: deerBody(),
  deerHead: deerHead(),
  wolfBody: new BoxGeometry(0.2, 0.075, 0.07).translate(0, 0.09, 0),
  wolfHead: new ConeGeometry(0.045, 0.12, 4, 1).rotateZ(-Math.PI / 2).translate(0.15, 0.12, 0),
  // Hervorhebungen
  square: new PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2),
  frame: new RingGeometry(0.6, 0.68, 4, 1).rotateZ(Math.PI / 4).rotateX(-Math.PI / 2),
  frameThin: new RingGeometry(0.54, 0.62, 4, 1).rotateZ(Math.PI / 4).rotateX(-Math.PI / 2),
  ring: new RingGeometry(0.3, 0.4, 24, 1).rotateX(-Math.PI / 2),
  arrow: arrowGeometry(),
  campHuts: campHuts(),
  campStones: campStones(),
  campFlame: new ConeGeometry(0.045, 0.14, 5).translate(0, 0.07, 0),
  flag: flag(),
  fallingTree: fallingTree(),
  marker: new OctahedronGeometry(0.09, 0).scale(1, 1.6, 1),
  flame: new ConeGeometry(0.11, 0.42, 5, 1).translate(0, 0.21, 0),
  streak: new BoxGeometry(0.015, 0.35, 0.015),
  /** Lichtsäule beim Sprung zur nächsten Stufe (offen, Fuß bei y = 0) */
  beam: new CylinderGeometry(0.42, 0.5, 2.4, 7, 1, true).translate(0, 1.2, 0),
};

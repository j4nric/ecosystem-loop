import { ConeGeometry, CylinderGeometry, IcosahedronGeometry, RingGeometry, SphereGeometry } from 'three';
import { HEX_RADIUS } from './layout.ts';

/** Geteilte Geometrien – einmal angelegt, von allen Kacheln benutzt. */
const R = HEX_RADIUS;

export const GEO = {
  top: new CylinderGeometry(R, R, 0.22, 6),
  earth: new CylinderGeometry(R, R * 0.94, 0.75, 6),
  stratum: new CylinderGeometry(R * 0.945, R * 0.9, 0.12, 6),
  bottom: new ConeGeometry(R * 0.9, 1.5, 6, 1),
  ring: new RingGeometry(R * 0.9, R * 1.04, 6, 1),
  peak: new ConeGeometry(0.7, 1.6, 5, 1),
  snowCap: new ConeGeometry(0.33, 0.55, 5, 1),
  waterHex: new CylinderGeometry(R * 0.86, R * 0.86, 0.06, 6),
  coastWater: new CylinderGeometry(R * 0.97, R * 0.97, 0.08, 3, 1, false, -Math.PI / 3, Math.PI),
  crown: new ConeGeometry(0.2, 0.62, 6, 1),
  trunk: new CylinderGeometry(0.035, 0.05, 0.24, 5),
  rock: new IcosahedronGeometry(1, 0),
  body: new ConeGeometry(0.06, 0.18, 6, 1),
  head: new SphereGeometry(0.05, 6, 4),
};

// Ring liegt flach und hat Spitzen in Richtung ±z wie die Kacheln
GEO.ring.rotateX(-Math.PI / 2);
GEO.ring.rotateY(Math.PI / 2);
GEO.bottom.rotateX(Math.PI);

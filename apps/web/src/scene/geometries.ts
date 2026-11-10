import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, RingGeometry, SphereGeometry } from 'three';
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
  // Figuren der Arten (je Gruppe eine Geometrie ⇒ ein Draw Call je Gruppe)
  fish: new ConeGeometry(0.045, 0.17, 4, 1),
  insect: new IcosahedronGeometry(0.06, 0),
  reptile: new BoxGeometry(0.19, 0.05, 0.075),
  bird: new ConeGeometry(0.11, 0.05, 3, 1),
  mammal: new BoxGeometry(0.17, 0.09, 0.08),
  human: new CylinderGeometry(0.03, 0.048, 0.19, 6),
  head: new SphereGeometry(0.045, 6, 4),
  // Hervorhebung „neues Leben“
  beam: new CylinderGeometry(0.55, 0.75, 2.4, 6, 1, true),
};

// Ring liegt flach und hat Spitzen in Richtung ±z wie die Kacheln
GEO.ring.rotateX(-Math.PI / 2);
GEO.ring.rotateY(Math.PI / 2);
GEO.bottom.rotateX(Math.PI);
// Fisch liegt waagrecht mit der Spitze nach +x, Vogel als flaches Dreieck mit Spitze nach +x
GEO.fish.rotateZ(-Math.PI / 2);
GEO.bird.rotateZ(-Math.PI / 2);
GEO.bird.rotateX(Math.PI / 2);
GEO.beam.translate(0, 1.2, 0);

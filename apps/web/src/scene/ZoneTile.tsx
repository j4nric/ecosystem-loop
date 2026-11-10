import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, type Group, type Mesh, type MeshBasicMaterial, type MeshLambertMaterial } from 'three';
import type { ZoneView } from '@core/api';
import { GEO } from './geometries.ts';
import { COLORS, topColor } from './palette.ts';
import { TOP_Y } from './layout.ts';
import type { SceneRegistry } from './registry.ts';
import type { Toward } from '../logic/ideal.ts';

interface Props {
  zone: ZoneView;
  position: [number, number, number];
  selected: boolean;
  /** true: Zone ist gültiges Ziel der laufenden Kartenwahl. */
  targetable: boolean;
  /** true: Zielwahl läuft, aber diese Zone ist kein gültiges Ziel. */
  dimmed: boolean;
  /** Wirkung dieser Zone als Ziel auf ihre Idealform: färbt den Zielring grün, rot oder gelb. */
  tint: Toward | null;
  reducedMotion: boolean;
  registry: SceneRegistry;
  onTap: (zoneId: string) => void;
}

const TAP_TOLERANCE_PX = 8;
/** Höhe der Beschriftung über der Kachel (Berge: über den Gipfeln). */
const LABEL_HEIGHT: Record<string, number> = { mountains: 1.95 };
const BLACK = new Color('#000000');
const stat = (zone: ZoneView, index: number) => zone.stats[index]?.value ?? 0;

export function ZoneTile({
  zone,
  position,
  selected,
  targetable,
  dimmed,
  tint,
  reducedMotion,
  registry,
  onTap,
}: Props) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const topMaterial = useRef<MeshLambertMaterial>(null);
  const kind = zone.form.kind;
  const top = useMemo(() => new Color(topColor(zone.geography, kind)), [zone.geography, kind]);
  // Startfarbe nur beim ersten Rendern setzen – danach blendet useFrame weich über.
  const [initialTop] = useState(() => topColor(zone.geography, kind));

  // Formwechsel: Kachel hebt sich kurz an und setzt wieder auf (Wert 1 → 0).
  const bump = useRef(0);
  const lastForm = useRef(zone.form.id);
  useEffect(() => {
    if (lastForm.current === zone.form.id) return;
    lastForm.current = zone.form.id;
    if (!reducedMotion) bump.current = 1;
  }, [zone.form.id, reducedMotion]);

  useFrame((state, delta) => {
    const g = group.current;
    if (g) {
      bump.current = Math.max(0, bump.current - delta * 1.1);
      const hop = Math.sin((1 - bump.current) * Math.PI) * (bump.current > 0 ? 0.3 : 0);
      const lift = (selected ? 0.18 : targetable ? 0.08 : 0) + hop;
      g.position.y = reducedMotion ? lift : g.position.y + (lift - g.position.y) * Math.min(1, delta * 10);
    }
    const mat = topMaterial.current;
    if (mat) {
      mat.color.lerp(top, reducedMotion ? 1 : 1 - Math.exp(-delta * 2.5));
      if (dimmed) mat.emissive.copy(BLACK);
      else mat.emissive.copy(mat.color);
    }
    const r = ring.current;
    if (r) {
      const m = r.material as MeshBasicMaterial;
      m.opacity = targetable && !reducedMotion ? 0.55 + 0.35 * Math.sin(state.clock.elapsedTime * 5) : 0.95;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > TAP_TOLERANCE_PX) return; // war ein Dreh-Wisch, kein Tippen
    onTap(zone.id);
  };

  return (
    <group position={position}>
      <group
        ref={(g) => {
          group.current = g;
          registry.register(registry.tiles, zone.id, g);
        }}
        userData={{ zoneId: zone.id }}
      >
        {/* Sockel: Grasdecke, Erde, Schichtkante, Felsunterseite */}
        <mesh geometry={GEO.top} position={[0, TOP_Y - 0.11, 0]} onClick={handleClick}>
          <meshLambertMaterial ref={topMaterial} flatShading color={initialTop} emissiveIntensity={0.06} />
        </mesh>
        <mesh geometry={GEO.earth} position={[0, TOP_Y - 0.595, 0]} onClick={handleClick}>
          <meshLambertMaterial flatShading color={COLORS.earth} />
        </mesh>
        <mesh geometry={GEO.stratum} position={[0, TOP_Y - 1.03, 0]}>
          <meshLambertMaterial flatShading color={COLORS.stratum} />
        </mesh>
        <mesh geometry={GEO.bottom} position={[0, TOP_Y - 1.84, 0]}>
          <meshLambertMaterial flatShading color={COLORS.rockBottom} />
        </mesh>

        <ZoneFeature zone={zone} />

        {(selected || targetable) && (
          <mesh ref={ring} geometry={GEO.ring} position={[0, TOP_Y + 0.02, 0]}>
            <meshBasicMaterial
              color={
                targetable
                  ? tint === 'better'
                    ? COLORS.better
                    : tint === 'worse'
                      ? COLORS.worse
                      : COLORS.target
                  : COLORS.select
              }
              transparent
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Anker der Beschriftung; die Beschriftung selbst liegt als DOM über der Szene (ZoneLabels). */}
        <object3D
          position={[0, TOP_Y + (LABEL_HEIGHT[zone.geography] ?? 1.05), 0]}
          ref={(o) => registry.register(registry.anchors, zone.id, o)}
        />
      </group>
    </group>
  );
}

/** Geografie-typische Form aus Primitiven: Gipfel und Schnee, Wasser, Küstenlinie. */
function ZoneFeature({ zone }: { zone: ZoneView }) {
  const kind = zone.form.kind;
  switch (zone.geography) {
    case 'mountains': {
      const snow = stat(zone, 3);
      const capScale = snow === 0 ? 0 : 0.6 + snow * 0.22;
      const glacier = kind === 'disturbance';
      return (
        <group position={[-0.1, TOP_Y, -0.15]}>
          {(
            [
              [0, 0, 0, 1.1],
              [0.55, 0, 0.35, 0.75],
              [-0.5, 0, 0.3, 0.65],
            ] as const
          ).map(([x, y, z, s], i) => (
            <group key={i} position={[x, y, z]} scale={s}>
              <mesh geometry={GEO.peak} position={[0, 0.8, 0]} rotation={[0, i * 0.7, 0]}>
                <meshLambertMaterial flatShading color={i === 0 ? COLORS.rock : COLORS.rockDark} />
              </mesh>
              {capScale > 0 && (
                <mesh
                  geometry={GEO.snowCap}
                  position={[0, 1.6 - 0.275 * capScale, 0]}
                  scale={glacier ? 1.6 : capScale}
                  rotation={[0, i * 0.7, 0]}
                >
                  <meshLambertMaterial flatShading color={COLORS.snow} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      );
    }
    case 'river': {
      if (kind === 'disturbance') {
        return (
          <mesh geometry={GEO.waterHex} position={[0, TOP_Y + 0.03, 0]}>
            <meshLambertMaterial flatShading color={COLORS.waterDeep} transparent opacity={0.85} />
          </mesh>
        );
      }
      return null; // Flusslauf zeichnet RiverRibbon über mehrere Kacheln
    }
    case 'coast': {
      const salt = stat(zone, 3);
      return (
        <mesh geometry={GEO.coastWater} position={[0, TOP_Y - 0.01, 0]}>
          <meshLambertMaterial flatShading color={salt >= 4 ? COLORS.waterDeep : COLORS.water} />
        </mesh>
      );
    }
    default:
      return null;
  }
}

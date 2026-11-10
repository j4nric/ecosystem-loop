import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { ZoneView } from '@core/api';
import { GEO } from './geometries.ts';
import { COLORS, topColor } from './palette.ts';
import { TOP_Y } from './layout.ts';

interface Props {
  zone: ZoneView;
  position: [number, number, number];
  selected: boolean;
  /** true: Zone ist gültiges Ziel der laufenden Kartenwahl. */
  targetable: boolean;
  /** true: Zielwahl läuft, aber diese Zone ist kein gültiges Ziel. */
  dimmed: boolean;
  onTap: (zoneId: string) => void;
}

const TAP_TOLERANCE_PX = 8;
const stat = (zone: ZoneView, index: number) => zone.stats[index]?.value ?? 0;

export function ZoneTile({ zone, position, selected, targetable, dimmed, onTap }: Props) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const kind = zone.form.kind;
  const top = useMemo(() => topColor(zone.geography, kind), [zone.geography, kind]);

  useFrame((state, delta) => {
    const g = group.current;
    if (g) {
      const lift = selected ? 0.18 : targetable ? 0.08 : 0;
      g.position.y += (lift - g.position.y) * Math.min(1, delta * 10);
    }
    const r = ring.current;
    if (r) {
      const mat = r.material as MeshBasicMaterial;
      mat.opacity = targetable ? 0.55 + 0.35 * Math.sin(state.clock.elapsedTime * 5) : 0.95;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > TAP_TOLERANCE_PX) return; // war ein Dreh-Wisch, kein Tippen
    onTap(zone.id);
  };

  return (
    <group position={position}>
      <group ref={group}>
        {/* Sockel: Grasdecke, Erde, Schichtkante, Felsunterseite */}
        <mesh geometry={GEO.top} position={[0, TOP_Y - 0.11, 0]} onClick={handleClick}>
          <meshLambertMaterial flatShading color={top} emissive={dimmed ? '#000000' : top} emissiveIntensity={0.06} />
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
            <meshBasicMaterial color={targetable ? COLORS.target : COLORS.select} transparent depthWrite={false} />
          </mesh>
        )}

        <Html position={[0, TOP_Y + 1.05, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`zone-label${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}>
            {zone.warnings.map((w) => (
              <span key={`${w.card}-${w.trigger}`} className="zone-label__warn" title={w.name}>
                {w.icon}
              </span>
            ))}
            <span>{zone.geographyName}</span>
          </div>
        </Html>
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

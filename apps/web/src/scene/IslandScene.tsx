import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BoxGeometry, CanvasTexture, Vector3, type Group, type PerspectiveCamera } from 'three';
import type { ZoneView } from '@core/api';
import { GEO } from './geometries.ts';
import { Instanced } from './Instanced.tsx';
import { TOP_Y, zonePosition } from './layout.ts';
import { COLORS } from './palette.ts';
import { buildProps } from './props.ts';
import { ZoneTile } from './ZoneTile.tsx';

interface Props {
  zones: ZoneView[];
  selectedZone: string | null;
  /** Während einer Zielwahl: gültige Zonen; sonst null. */
  validTargets: Set<string> | null;
  onZoneTap: (zoneId: string) => void;
  onBackgroundTap: () => void;
}

/** Schwebende Low-Poly-Insel mit den Zonen-Kacheln. */
export function IslandScene(props: Props) {
  return (
    <Canvas
      className="scene"
      dpr={[1, 2]}
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 38, near: 0.5, far: 80, position: [0, 9, 14] }}
      onPointerMissed={props.onBackgroundTap}
    >
      <hemisphereLight args={['#f4f1ff', '#7d6a72', 1.6]} />
      <directionalLight position={[5, 9, 6]} intensity={1.9} color="#fff4e2" />
      <directionalLight position={[-6, 3, -4]} intensity={0.5} color="#c9d4ff" />
      <Suspense fallback={null}>
        <Island {...props} />
      </Suspense>
      <CameraRig />
    </Canvas>
  );
}

function Island({ zones, selectedZone, validTargets, onZoneTap }: Props) {
  const float = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (float.current) float.current.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.08;
  });

  const positions = useMemo(() => new Map(zones.map((z, i) => [z.id, zonePosition(z.geography, i)] as const)), [zones]);
  const props = useMemo(() => buildProps(zones, positions), [zones, positions]);

  return (
    <>
      <group ref={float}>
        {zones.map((zone) => (
          <ZoneTile
            key={zone.id}
            zone={zone}
            position={positions.get(zone.id) ?? [0, 0, 0]}
            selected={zone.id === selectedZone}
            targetable={validTargets?.has(zone.id) ?? false}
            dimmed={validTargets !== null && !validTargets.has(zone.id)}
            onTap={onZoneTap}
          />
        ))}
        <RiverRibbon zones={zones} positions={positions} />
        <Instanced geometry={GEO.crown} items={props.crowns} />
        <Instanced geometry={GEO.trunk} items={props.trunks} />
        <Instanced geometry={GEO.rock} items={props.rocks} />
        <Instanced geometry={GEO.body} items={props.bodies} />
        <Instanced geometry={GEO.head} items={props.heads} />
      </group>
      <GroundShadow />
    </>
  );
}

const ribbonGeometry = new BoxGeometry(1, 0.05, 1);

/** Der Fluss als Band von den Bergen über die Flusszone bis ins Meer an der Küste. */
function RiverRibbon({ zones, positions }: { zones: ZoneView[]; positions: Map<string, [number, number, number]> }) {
  const river = zones.find((z) => z.geography === 'river');
  const from = positions.get(zones.find((z) => z.geography === 'mountains')?.id ?? '');
  const to = positions.get(zones.find((z) => z.geography === 'coast')?.id ?? '');
  if (!river || !from || !to) return null;
  const water = river.stats[3]?.value ?? 2;
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const full = Math.hypot(dx, dz);
  // Start am Fuß der Berge, Ende knapp unter der Meeresfläche der Küste
  const start = 0.75;
  const end = full + 0.35;
  const mid = (start + end) / 2 / full;
  const width = water === 0 ? 0.35 : 0.22 + water * 0.09;
  return (
    <mesh
      geometry={ribbonGeometry}
      position={[from[0] + dx * mid, TOP_Y, from[2] + dz * mid]}
      rotation={[0, Math.atan2(dx, dz), 0]}
      scale={[width, 1, end - start]}
    >
      <meshLambertMaterial flatShading color={water === 0 ? '#9c8264' : COLORS.water} />
    </mesh>
  );
}

/** Weicher Schatten unter der schwebenden Insel – eine Textur statt Echtzeit-Schatten. */
function GroundShadow() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(70,60,95,0.45)');
      g.addColorStop(1, 'rgba(70,60,95,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new CanvasTexture(canvas);
  }, []);
  return (
    <mesh position={[0.3, -4.2, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[11, 9]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

/**
 * Kamera und begrenzte Steuerung: Abstand passt sich dem Seitenverhältnis an (Hochformat ⇒ weiter weg),
 * Drehen nur in einem Fenster, kein Verschieben.
 */
const TARGET = new Vector3(0, -0.9, 0);

function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const halfWidth = 4.6; // halbe Inselbreite plus Rand
    const hfov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (size.width / size.height));
    const distance = Math.min(26, Math.max(12, halfWidth / Math.tan(hfov / 2)));
    const dir = cam.position.clone().sub(TARGET).normalize();
    cam.position.copy(TARGET).addScaledVector(dir, distance);
    cam.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.minDistance = distance * 0.6;
      c.maxDistance = distance * 1.25;
      c.update();
    }
  }, [camera, size.width, size.height]);

  return (
    <OrbitControls
      ref={controls}
      target={TARGET}
      enablePan={false}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.6}
      minPolarAngle={0.55}
      maxPolarAngle={1.15}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={0.9}
      makeDefault
    />
  );
}

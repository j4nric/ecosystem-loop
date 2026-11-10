import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Raycaster,
  Vector2,
  Vector3,
  type DirectionalLight,
  type Fog,
  type Group,
  type HemisphereLight,
  type Mesh,
  type MeshBasicMaterial,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import type { ZoneView } from '@core/api';
import { buildCreatures } from './creatures.ts';
import { GEO } from './geometries.ts';
import { Instanced } from './Instanced.tsx';
import { TOP_Y, zonePosition } from './layout.ts';
import { COLORS, SEASON_LIGHT, speciesStyle } from './palette.ts';
import { buildProps } from './props.ts';
import { SceneRegistry, type ZonePicker } from './registry.ts';
import { ZoneLabels } from './ZoneLabels.tsx';
import { ZoneTile } from './ZoneTile.tsx';

interface Props {
  zones: ZoneView[];
  /** Runde – erkennt eine neue Partie (dann keine „neues Leben“-Effekte für die Startarten). */
  round: number;
  /** Harmonie als Anteil 0–1: niedrig ⇒ blasser, nebliger. */
  harmony: number;
  season: string;
  selectedZone: string | null;
  /** Während einer Zielwahl oder beim Ziehen: gültige Zonen; sonst null. */
  validTargets: Set<string> | null;
  reducedMotion: boolean;
  /** Wird mit einer Funktion belegt, die die Zone unter einem Bildschirmpunkt findet (Ziehen). */
  pickerRef: RefObject<ZonePicker | null>;
  onZoneTap: (zoneId: string) => void;
  onBackgroundTap: () => void;
}

/** Schwebende Low-Poly-Insel mit den Zonen-Kacheln; Beschriftungen als DOM-Schicht darüber. */
export function IslandScene(props: Props) {
  const [registry] = useState(() => new SceneRegistry());
  return (
    <div className="scene">
      <Canvas
        className="scene__canvas"
        dpr={[1, 2]}
        flat
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.5, far: 80, position: [0, 9, 14] }}
        onPointerMissed={props.onBackgroundTap}
      >
        <Atmosphere harmony={props.harmony} season={props.season} reducedMotion={props.reducedMotion} />
        <Suspense fallback={null}>
          <Island {...props} registry={registry} />
        </Suspense>
        <CameraRig />
        <Picker registry={registry} pickerRef={props.pickerRef} />
        <LabelProjector registry={registry} />
      </Canvas>
      {/* Blasser Schleier bei niedriger Harmonie (eine Ebene, per CSS weich überblendet). */}
      <div className="scene__mist" style={{ opacity: mistAmount(props.harmony) * 0.45 }} aria-hidden />
      <ZoneLabels
        zones={props.zones}
        registry={registry}
        selectedZone={props.selectedZone}
        validTargets={props.validTargets}
      />
    </div>
  );
}

function Island({
  zones,
  round,
  selectedZone,
  validTargets,
  reducedMotion,
  onZoneTap,
  registry,
}: Props & { registry: SceneRegistry }) {
  const float = useRef<Group>(null);
  const birds = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    if (float.current) float.current.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.08;
    if (birds.current) birds.current.position.y = Math.sin(clock.elapsedTime * 1.6) * 0.05;
  });

  const positions = useMemo(() => new Map(zones.map((z, i) => [z.id, zonePosition(z.geography, i)] as const)), [zones]);
  const props = useMemo(() => buildProps(zones, positions), [zones, positions]);
  const creatures = useMemo(() => buildCreatures(zones, positions), [zones, positions]);

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
            reducedMotion={reducedMotion}
            registry={registry}
            onTap={onZoneTap}
          />
        ))}
        <RiverRibbon zones={zones} positions={positions} />
        <Instanced geometry={GEO.crown} items={props.crowns} />
        <Instanced geometry={GEO.trunk} items={props.trunks} />
        <Instanced geometry={GEO.rock} items={props.rocks} />
        <Instanced geometry={GEO.fish} items={creatures.water} />
        <Instanced geometry={GEO.insect} items={creatures.insect} />
        <Instanced geometry={GEO.reptile} items={creatures.reptile} />
        <Instanced geometry={GEO.mammal} items={creatures.mammal} />
        <Instanced geometry={GEO.human} items={creatures.human} />
        <Instanced geometry={GEO.head} items={creatures.heads} />
        <group ref={birds}>
          <Instanced geometry={GEO.bird} items={creatures.bird} />
        </group>
        <NewLifeBursts zones={zones} positions={positions} round={round} reducedMotion={reducedMotion} />
      </group>
      <GroundShadow />
    </>
  );
}

// --- Licht, Jahreszeit und Harmonie-Nebel ---------------------------------------------------------

const scratchColor = new Color();

/** Nebelstärke 0–1: beginnt unter etwa 55 % Harmonie, voll bei 10 %. */
export function mistAmount(harmony: number): number {
  return Math.max(0, Math.min(1, (0.55 - harmony) / 0.45));
}
const ORIGIN = new Vector3();

/**
 * Licht und Nebel: Die Jahreszeit tönt das Sonnenlicht leicht; sinkt die Harmonie unter etwa die Hälfte,
 * werden die Farben blasser (Himmelslicht gräulich, Sonne schwächer) und Nebel zieht auf (Konzept 7).
 * Alle Werte gleiten weich zum Ziel.
 */
function Atmosphere({ harmony, season, reducedMotion }: { harmony: number; season: string; reducedMotion: boolean }) {
  const sky = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const fog = useRef<Fog>(null);
  const mist = useRef(mistAmount(harmony));
  const light = SEASON_LIGHT[season] ?? SEASON_LIGHT['spring']!;

  useFrame(({ camera }, delta) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 1.5);
    mist.current += (mistAmount(harmony) - mist.current) * k;
    const m = mist.current;
    if (sky.current) {
      scratchColor.set(light.sky).lerp(scratchColor.clone().set(COLORS.paleSky), m);
      sky.current.color.lerp(scratchColor, k);
      sky.current.intensity = 1.6 + 0.2 * m;
    }
    if (sun.current) {
      sun.current.color.lerp(scratchColor.set(light.sun), k);
      sun.current.intensity = 1.9 * (1 - 0.4 * m);
    }
    if (fog.current) {
      const d = camera.position.distanceTo(ORIGIN);
      fog.current.near = d - 6 + (1 - m) * 60;
      fog.current.far = d + 8 + (1 - m) * 90;
    }
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={[COLORS.fog, 100, 200]} />
      <hemisphereLight ref={sky} args={[light.sky, '#7d6a72', 1.6]} />
      <directionalLight ref={sun} position={[5, 9, 6]} intensity={1.9} color={light.sun} />
      <directionalLight position={[-6, 3, -4]} intensity={0.5} color="#c9d4ff" />
    </>
  );
}

// --- Neues Leben ----------------------------------------------------------------------------------

const BURST_SLOTS = 4;
const BURST_SECONDS = 1.8;

interface Burst {
  position: [number, number, number];
  color: string;
  start: number | null;
}

/** Kurzer Lichtschein über einer Zone, wenn dort eine Art neu auftaucht (fester Pool, kein Neuanlegen). */
function NewLifeBursts({
  zones,
  positions,
  round,
  reducedMotion,
}: {
  zones: ZoneView[];
  positions: Map<string, [number, number, number]>;
  round: number;
  reducedMotion: boolean;
}) {
  const beams = useRef<(Mesh | null)[]>([]);
  const rings = useRef<(Mesh | null)[]>([]);
  const bursts = useRef<Burst[]>([]);
  const previous = useRef<{ round: number; present: Map<string, Set<string>> } | null>(null);

  useEffect(() => {
    const present = new Map(
      zones.map((z) => [z.id, new Set(z.populations.filter((p) => p.count > 0).map((p) => p.species))]),
    );
    const before = previous.current;
    previous.current = { round, present };
    if (!before || round < before.round) return; // erster Aufbau oder neue Partie
    for (const zone of zones) {
      const base = positions.get(zone.id);
      if (!base) continue;
      for (const pop of zone.populations) {
        if (pop.count <= 0 || before.present.get(zone.id)?.has(pop.species)) continue;
        bursts.current = [
          ...bursts.current,
          { position: base, color: speciesStyle(pop.species, pop.tier).color, start: null },
        ].slice(-BURST_SLOTS);
      }
    }
  }, [zones, positions, round]);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    bursts.current = bursts.current.filter((b) => b.start === null || now - b.start < BURST_SECONDS);
    for (let i = 0; i < BURST_SLOTS; i++) {
      const beam = beams.current[i];
      const ring = rings.current[i];
      if (!beam || !ring) continue;
      const b = bursts.current[i];
      beam.visible = ring.visible = b !== undefined;
      if (!b) continue;
      if (b.start === null) b.start = now;
      const age = (now - b.start) / BURST_SECONDS;
      const fade = Math.sin(Math.min(1, age) * Math.PI);
      beam.position.set(b.position[0], TOP_Y, b.position[2]);
      ring.position.set(b.position[0], TOP_Y + 0.04, b.position[2]);
      const grow = reducedMotion ? 1 : 0.5 + age * 0.9;
      ring.scale.setScalar(grow);
      beam.scale.set(1, reducedMotion ? 1 : 0.4 + age * 0.8, 1);
      (beam.material as MeshBasicMaterial).opacity = 0.32 * fade;
      (ring.material as MeshBasicMaterial).opacity = 0.9 * fade;
      (ring.material as MeshBasicMaterial).color.set(b.color).lerp(scratchColor.set(COLORS.burst), 0.4);
    }
  });

  return (
    <>
      {Array.from({ length: BURST_SLOTS }, (_, i) => (
        <group key={i}>
          <mesh
            ref={(m) => {
              beams.current[i] = m;
            }}
            geometry={GEO.beam}
            visible={false}
            renderOrder={2}
          >
            <meshBasicMaterial color={COLORS.burst} transparent depthWrite={false} fog={false} />
          </mesh>
          <mesh
            ref={(m) => {
              rings.current[i] = m;
            }}
            geometry={GEO.ring}
            visible={false}
            renderOrder={2}
          >
            <meshBasicMaterial color={COLORS.burst} transparent depthWrite={false} fog={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// --- Fluss und Schatten ---------------------------------------------------------------------------

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
      <meshBasicMaterial map={texture} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}

// --- Ziehen und Beschriftungen ---------------------------------------------------------------------

const raycaster = new Raycaster();
const pointer = new Vector2();

/** Stellt eine Raycast-Funktion bereit: welche Zone liegt unter dem Finger? */
function Picker({ registry, pickerRef }: { registry: SceneRegistry; pickerRef: RefObject<ZonePicker | null> }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const pick: ZonePicker = (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...registry.tiles.values()], true);
      for (const hit of hits) {
        let o: Object3D | null = hit.object;
        while (o) {
          const id = (o.userData as { zoneId?: string }).zoneId;
          if (id) return id;
          o = o.parent;
        }
      }
      return null;
    };
    pickerRef.current = pick;
    return () => {
      if (pickerRef.current === pick) pickerRef.current = null;
    };
  }, [camera, gl, registry, pickerRef]);
  return null;
}

/** Schiebt die Beschriftungen jedes Frame an die projizierten Anker (siehe `SceneRegistry.projectLabels`). */
function LabelProjector({ registry }: { registry: SceneRegistry }) {
  useFrame(({ camera, size }) => registry.projectLabels(camera, size.width, size.height));
  return null;
}

// --- Kamera ---------------------------------------------------------------------------------------

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

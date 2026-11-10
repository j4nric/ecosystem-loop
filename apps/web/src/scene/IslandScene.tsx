import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  CanvasTexture,
  Color,
  Matrix4,
  Vector3,
  type DirectionalLight,
  type Group,
  type HemisphereLight,
  type InstancedMesh,
  type MeshBasicMaterial,
  type PerspectiveCamera,
} from 'three';
import type { HerdeData, HerdeView, IntentView, Pos } from '@being-god/herde';
import type { StepReport } from '../client/GameClient.ts';
import { Figures, type FigureGroup } from './Figures.tsx';
import { FxLayer } from './FxLayer.tsx';
import { GEO } from './geometries.ts';
import { Instanced, type InstanceSpec } from './Instanced.tsx';
import { BOTTOM, buildIsland, cellCenter, type Grid } from './islandModel.ts';
import { COLORS, SEASON_LIGHT } from './palette.ts';

interface Props {
  data: HerdeData;
  view: HerdeView;
  /** Beim Zielen: gültige Felder (der Rest wird abgedunkelt); sonst null */
  targets: Pos[] | null;
  /** Vorschau einer globalen Karte: Felder, die Futter bekommen */
  grown: Pos[] | null;
  /** angetipptes bzw. gewähltes Feld */
  selected: Pos | null;
  /** Absicht nach dem Kartenzug (Vorschau), nur wenn sie sich ändert */
  previewIntent: IntentView | null;
  /** Monate laufen gerade ab: Absichtspfeil ausblenden */
  running: boolean;
  reducedMotion: boolean;
  subscribeReports: (listener: (r: StepReport) => void) => () => void;
  onCellTap: (pos: Pos) => void;
  onBackgroundTap: () => void;
}

/** Schwebende Low-Poly-Insel: ein Plättchen je Feld, Bewuchs, Herde, Rudel, Absichtspfeil und Effekte. */
export function IslandScene(props: Props) {
  const grid: Grid = useMemo(
    () => ({ width: props.view.width, height: props.view.height }),
    [props.view.width, props.view.height],
  );
  const season = props.view.ice.active ? 'ice' : props.view.season;
  return (
    <div className="scene">
      <Canvas
        className="scene__canvas"
        dpr={[1, 2]}
        flat
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 36, near: 0.5, far: 80, position: [0, 11, 9] }}
        onPointerMissed={props.onBackgroundTap}
      >
        <Atmosphere season={season} reducedMotion={props.reducedMotion} />
        <Island {...props} grid={grid} />
        <CameraRig grid={grid} />
      </Canvas>
    </div>
  );
}

function Island({
  data,
  view,
  targets,
  grown,
  selected,
  previewIntent,
  running,
  reducedMotion,
  subscribeReports,
  onCellTap,
  grid,
}: Props & { grid: Grid }) {
  const float = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reducedMotion || !float.current) return;
    float.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.06;
  });

  const stage = data.stages.get(view.herd.stage);
  const snow = view.ice.active ? 0.6 : view.season === data.params.ice.season ? 0.3 : 0;
  const model = useMemo(
    () =>
      buildIsland(grid, view.cells, {
        eats: stage?.eats ?? [],
        snow,
        info: (land) => {
          const l = data.landscapes.get(land);
          return l ? { walk: l.walk, wood: l.wood } : undefined;
        },
      }),
    [grid, view.cells, stage, snow, data],
  );
  const top = (x: number, y: number) => model.topY[y * grid.width + x] ?? 0;
  const at = (pos: Pos, lift = 0): [number, number, number] => {
    const [cx, cz] = cellCenter(grid, pos.x, pos.y);
    return [cx, top(pos.x, pos.y) + lift, cz];
  };

  // Herde: bis zu 20 Figuren, größere Herden werden größer dargestellt; Rudel: eine Figur je Stärke.
  const herdPos = at(view.herd);
  const groups: FigureGroup[] =
    view.herd.size > 0
      ? [
          {
            id: 'herd',
            position: herdPos,
            count: Math.min(20, view.herd.size),
            size: view.herd.size > 20 ? Math.min(1.5, 1 + (view.herd.size - 20) / 40) : 1,
            spread: 0.085,
            body: COLORS.herdBody,
            head: COLORS.herdHead,
          },
        ]
      : [];
  const packs: FigureGroup[] = view.packs.map((pack) => ({
    id: `pack-${pack.id}`,
    position: at(pack),
    count: pack.size,
    size: 1.4,
    spread: 0.15,
    body: pack.hungry ? COLORS.wolfHungry : COLORS.wolfBody,
    head: COLORS.wolfHead,
  }));
  // Gruppen nur neu anlegen, wenn sich etwas Sichtbares ändert (sonst würde jede View eine Animation prüfen).
  const herdKey = JSON.stringify(groups);
  const packKey = JSON.stringify(packs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const herdGroups = useMemo(() => groups, [herdKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const packGroups = useMemo(() => packs, [packKey]);

  // Rudel stehen oft zwischen hohen Bäumen: ein Zeichen darüber macht sie sichtbar (rot = hungrig).
  const packMarkers = useMemo(
    () =>
      view.packs.map((pack) => ({
        position: at(pack, 1.15),
        scale: [1, 1, 1] as [number, number, number],
        color: pack.hungry ? COLORS.hunt : COLORS.wolfBody,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.packs, model],
  );

  const tap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 10 || e.instanceId === undefined) return;
    const cell = view.cells[e.instanceId];
    if (cell) onCellTap({ x: cell.x, y: cell.y });
  };

  const targetSet = useMemo(
    () => (targets ? new Set(targets.map((p) => p.y * grid.width + p.x)) : null),
    [targets, grid],
  );
  const targetSquares = useMemo(
    () => (targets ?? []).map((p) => at(p, 0.012)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targets, model],
  );
  const dimSquares = useMemo(
    () => (targetSet ? view.cells.filter((c) => !targetSet.has(c.y * grid.width + c.x)).map((c) => at(c, 0.012)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetSet, model],
  );
  const grownSquares = useMemo(
    () => (grown ?? []).map((p) => at(p, 0.012)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grown, model],
  );

  const intent = running ? null : view.intent;

  return (
    <>
      <group ref={float}>
        <Instanced geometry={GEO.block} items={model.tops} onClick={tap} />
        <Instanced geometry={GEO.block} items={model.earth} />
        <Instanced geometry={GEO.tuft} items={model.tufts} />
        <Instanced geometry={GEO.shrub} items={model.shrubs} />
        <Instanced geometry={GEO.crown} items={model.crowns} />
        <Instanced geometry={GEO.trunk} items={model.trunks} />
        <Instanced geometry={GEO.boulder} items={model.boulders} />
        <mesh
          geometry={GEO.underside}
          position={[0, BOTTOM - 1.1, 0]}
          rotation={[Math.PI, Math.PI / 7, 0]}
          scale={[grid.width * 0.68, 2.2, grid.height * 0.62]}
        >
          <meshLambertMaterial flatShading color={COLORS.underside} />
        </mesh>

        <Figures
          groups={herdGroups}
          bodyGeometry={GEO.animalBody}
          headGeometry={GEO.animalHead}
          reducedMotion={reducedMotion}
        />
        <Figures
          groups={packGroups}
          bodyGeometry={GEO.wolfBody}
          headGeometry={GEO.wolfHead}
          reducedMotion={reducedMotion}
        />

        <Squares positions={dimSquares} color={COLORS.dim} opacity={0.38} />
        <Squares positions={targetSquares} color={COLORS.target} opacity={0.3} />
        <Squares positions={targetSquares} color={COLORS.target} opacity={0.95} pulse={!reducedMotion} frame />
        <Squares positions={grownSquares} color={COLORS.grown} opacity={0.45} pulse={!reducedMotion} />
        {selected && <Frame position={at(selected, 0.02)} />}

        {intent && (
          <IntentArrow
            from={herdPos}
            to={at(intent)}
            stays={intent.stays}
            color={COLORS.arrow}
            reducedMotion={reducedMotion}
          />
        )}
        {intent && previewIntent && (
          <IntentArrow
            from={herdPos}
            to={at(previewIntent)}
            stays={previewIntent.stays}
            color={COLORS.arrowPreview}
            reducedMotion={reducedMotion}
            lift={0.08}
          />
        )}

        <PackMarkers positions={packMarkers} />
        <FxLayer grid={grid} topY={model.topY} subscribe={subscribeReports} reducedMotion={reducedMotion} />
        {import.meta.env.DEV && <DevProbe grid={grid} topY={model.topY} />}
      </group>
      <GroundShadow width={grid.width} height={grid.height} />
    </>
  );
}

/** Kleine Rauten über den Rudeln (ein Draw Call). */
function PackMarkers({ positions }: { positions: InstanceSpec[] }) {
  return <Instanced geometry={GEO.marker} items={positions} />;
}

/** Nur im Entwicklungsmodus: Bildschirmpunkt eines Felds für automatische Tests (Playwright). */
function DevProbe({ grid, topY }: { grid: Grid; topY: readonly number[] }) {
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  useEffect(() => {
    const w = window as unknown as { __herdeCell?: (x: number, y: number) => { x: number; y: number } };
    w.__herdeCell = (x, y) => {
      const [cx, cz] = cellCenter(grid, x, y);
      const v = new Vector3(cx, topY[y * grid.width + x] ?? 0, cz).project(camera);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    };
  }, [camera, size, grid, topY]);
  return null;
}

// --- Hervorhebungen -------------------------------------------------------------------------------

const scratch = new Matrix4();

/** Flache, halbtransparente Quadrate auf Feldern (Ziele, Abdunkeln, Regen-Vorschau) in einem Draw Call. */
function Squares({
  positions,
  color,
  opacity,
  pulse = false,
  frame = false,
}: {
  positions: [number, number, number][];
  color: string;
  opacity: number;
  pulse?: boolean;
  /** Rahmen statt Fläche */
  frame?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const capacity = Math.max(16, positions.length);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    positions.forEach((pos, i) => mesh.setMatrixAt(i, scratch.makeTranslation(...pos)));
    mesh.count = positions.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions, capacity]);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!pulse || !mesh || mesh.count === 0) return;
    (mesh.material as MeshBasicMaterial).opacity = opacity * (0.7 + 0.3 * Math.sin(clock.elapsedTime * 4));
  });
  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[frame ? GEO.frameThin : GEO.square, undefined, capacity]}
      count={0}
      frustumCulled={false}
      renderOrder={2}
      raycast={() => null}
    >
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} fog={false} />
    </instancedMesh>
  );
}

function Frame({ position }: { position: [number, number, number] }) {
  return (
    <mesh geometry={GEO.frame} position={position} renderOrder={3} raycast={() => null}>
      <meshBasicMaterial color={COLORS.select} transparent opacity={0.95} depthWrite={false} fog={false} />
    </mesh>
  );
}

const ARROW_Y = 0.32;

/**
 * Absichtspfeil von der Herde zum nächsten Feld (über den Bäumen, immer sichtbar); bleibt die Herde, ein Ring.
 */
function IntentArrow({
  from,
  to,
  stays,
  color,
  reducedMotion,
  lift = 0,
}: {
  from: [number, number, number];
  to: [number, number, number];
  stays: boolean;
  color: string;
  reducedMotion: boolean;
  lift?: number;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reducedMotion || !ref.current) return;
    ref.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.04;
  });
  const y = Math.max(from[1], to[1]) + ARROW_Y + lift;
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  return (
    <group ref={ref}>
      {stays ? (
        <mesh
          geometry={GEO.ring}
          position={[from[0], y - 0.2, from[2]]}
          scale={1.5}
          renderOrder={5}
          raycast={() => null}
        >
          <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} depthWrite={false} fog={false} />
        </mesh>
      ) : (
        <mesh
          geometry={GEO.arrow}
          position={[from[0] + (dx / len) * 0.12, y, from[2] + (dz / len) * 0.12]}
          rotation={[0, Math.atan2(-dx, -dz), 0]}
          scale={[1.3, 1, len * 0.85]}
          renderOrder={5}
          raycast={() => null}
        >
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.92}
            depthTest={false}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      )}
    </group>
  );
}

// --- Licht und Schatten ---------------------------------------------------------------------------

/** Licht je Jahreszeit; die Farben gleiten weich zum Ziel (eine Farbe pro Frame, keine Neuberechnung). */
function Atmosphere({ season, reducedMotion }: { season: string; reducedMotion: boolean }) {
  const sky = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const light = SEASON_LIGHT[season] ?? SEASON_LIGHT['spring']!;
  const target = useMemo(() => ({ sky: light.sky, sun: light.sun }), [light]);
  const settled = useRef(false);
  useEffect(() => {
    settled.current = false;
  }, [target]);

  useFrame((_, delta) => {
    if (settled.current) return;
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 2);
    sky.current?.color.lerp(skyColor.set(target.sky), k);
    sun.current?.color.lerp(sunColor.set(target.sun), k);
    const c = sky.current?.color;
    if (k >= 1 || (c && Math.abs(c.r - skyColor.r) + Math.abs(c.g - skyColor.g) + Math.abs(c.b - skyColor.b) < 0.003))
      settled.current = true;
  });

  return (
    <>
      <hemisphereLight ref={sky} args={[light.sky, '#7d6a72', 1.7]} />
      <directionalLight ref={sun} position={[4, 9, 6]} intensity={1.9} color={light.sun} />
      <directionalLight position={[-6, 3, -4]} intensity={0.45} color="#c9d4ff" />
    </>
  );
}

const skyColor = new Color();
const sunColor = new Color();

/** Weicher Schatten unter der schwebenden Insel – eine Textur statt Echtzeit-Schatten. */
function GroundShadow({ width, height }: { width: number; height: number }) {
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
    <mesh position={[0.3, -4.6, 0.3]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[width * 1.5, height * 1.3]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}

// --- Kamera ---------------------------------------------------------------------------------------

/**
 * Kamera und begrenzte Steuerung: Abstand passt sich dem Seitenverhältnis an (Hochformat ⇒ weiter weg),
 * Drehen nur in einem Fenster, kein Verschieben.
 */
function CameraRig({ grid }: { grid: Grid }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const target = useMemo(() => new Vector3(0, -0.2, 0.5), []);

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const halfWidth = grid.width / 2 + 0.9;
    const halfDepth = grid.height / 2 + 0.6;
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    // Breite muss passen; die Tiefe erscheint durch die Neigung verkürzt (Faktor ≈ sin der Neigung).
    const byWidth = halfWidth / Math.tan(hfov / 2);
    const byDepth = (halfDepth * 0.82) / Math.tan(vfov / 2);
    const distance = Math.min(34, Math.max(10, Math.max(byWidth, byDepth)));
    const dir = new Vector3(0, 0.78, 0.62).normalize();
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.minDistance = distance * 0.65;
      c.maxDistance = distance * 1.2;
      c.update();
    }
  }, [camera, size.width, size.height, grid, target]);

  return (
    <OrbitControls
      ref={controls}
      target={target}
      enablePan={false}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.5}
      minPolarAngle={0.35}
      maxPolarAngle={1.0}
      minAzimuthAngle={-0.6}
      maxAzimuthAngle={0.6}
      makeDefault
    />
  );
}

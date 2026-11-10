import { useEffect, useRef, type RefObject } from 'react';
import type { GameClient, Notice } from '../client/index.ts';
import { t } from '../i18n/index.ts';
import { fxLines, type FxLine } from '../logic/fx.ts';

/** Von außen ansteuerbar (vor dem dispatch aufrufen). */
export interface EffectsApi {
  /** Gezielte Karte: von der Hand zur Zielzone fliegen lassen. */
  flyCard(uid: number, zoneId: string | null): void;
  /** Weltkarte (Wetter): Karte steigt über die Insel, eine Welle läuft über alle Zonen. */
  worldWave(uid: number): void;
}

interface Props {
  client: GameClient;
  reducedMotion: boolean;
  apiRef: RefObject<EffectsApi | null>;
}

const FLIGHT_MS = 460;
const RISE_MS = 1900;
const NATURE_STAGGER_MS = 140;
/** Weltkarte: so lange läuft die Welle, danach steigen die Werte je Zone nacheinander auf. */
const WAVE_MS = 720;
const WORLD_STAGGER_MS = 120;

/**
 * Sichtbares Feedback als eigene DOM-Schicht über der Szene: fliegende Karte, Puls über der Zielzone,
 * aufsteigende Wertänderungen („+2 Feuchte“, grün/rot nach Richtung zum Zielbereich) und Formwechsel.
 * Alles imperativ mit Web Animations – kein React-Rendern pro Frame, Elemente entfernen sich selbst.
 * Weltkarten (Wetter) fliegen nicht zu einer Zone: Eine Welle läuft über die ganze Insel, danach steigen die
 * Werte aller betroffenen Zonen nacheinander auf.
 * Bei „Bewegung reduzieren“ entfallen Flug, Welle und Puls; Zahlen erscheinen ohne Bewegung und blenden aus.
 */
export function Effects({ client, reducedMotion, apiRef }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const flightUntil = useRef(0);
  const motion = useRef(!reducedMotion);
  useEffect(() => {
    motion.current = !reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const api: EffectsApi = {
      flyCard(uid, zoneId) {
        const root = layer.current;
        const source = document.querySelector<HTMLElement>(`.hand [data-uid="${uid}"]`);
        const target = zoneId ? zonePoint(zoneId) : null;
        if (!root || !source || !target) return;
        if (!motion.current) return;
        const rect = source.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.className = `${source.className} fx-card`;
        ghost.innerHTML = source.innerHTML;
        ghost.setAttribute('aria-hidden', 'true');
        Object.assign(ghost.style, {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        root.appendChild(ghost);
        const dx = target.x - (rect.left + rect.width / 2);
        const dy = target.y + 24 - (rect.top + rect.height / 2);
        const anim = ghost.animate(
          [
            { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(0.8) rotate(-6deg)`, opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(4deg)`, opacity: 0.2 },
          ],
          { duration: FLIGHT_MS, easing: 'cubic-bezier(.4,0,.6,1)' },
        );
        flightUntil.current = performance.now() + FLIGHT_MS;
        anim.onfinish = () => ghost.remove();
        anim.oncancel = () => ghost.remove();
      },
      worldWave(uid) {
        const root = layer.current;
        const center = islandCenter();
        if (!root || !center || !motion.current) return;
        const source = document.querySelector<HTMLElement>(`.hand [data-uid="${uid}"]`);
        if (source) {
          // Karte steigt aus der Hand über die Inselmitte und löst sich auf.
          const rect = source.getBoundingClientRect();
          const ghost = document.createElement('div');
          ghost.className = `${source.className} fx-card`;
          ghost.innerHTML = source.innerHTML;
          ghost.setAttribute('aria-hidden', 'true');
          Object.assign(ghost.style, {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          });
          root.appendChild(ghost);
          const dx = center.x - (rect.left + rect.width / 2);
          const dy = center.y - 60 - (rect.top + rect.height / 2);
          const anim = ghost.animate(
            [
              { transform: 'translate(0, 0) scale(1)', opacity: 1 },
              { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.55 },
              { transform: `translate(${dx}px, ${dy - 30}px) scale(1.6)`, opacity: 0 },
            ],
            { duration: FLIGHT_MS + 200, easing: 'cubic-bezier(.3,0,.4,1)' },
          );
          anim.onfinish = () => ghost.remove();
          anim.oncancel = () => ghost.remove();
        }
        // Welle: ein flacher Ring breitet sich von der Inselmitte über alle Zonen aus, dahinter ein Schimmer.
        const delay = FLIGHT_MS * 0.5;
        for (const [i, cls] of ['fx-wave', 'fx-wave fx-wave--echo', 'fx-sheen'].entries()) {
          const el = document.createElement('div');
          el.className = cls;
          el.style.left = `${center.x}px`;
          el.style.top = `${center.y}px`;
          el.style.setProperty('--wave-w', `${center.w}px`);
          root.appendChild(el);
          const anim = el.animate(
            cls === 'fx-sheen'
              ? [
                  { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
                  { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.8, offset: 0.4 },
                  { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 0 },
                ]
              : [
                  { transform: 'translate(-50%, -50%) scale(0.1)', opacity: 0.95 },
                  { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 0 },
                ],
            { duration: WAVE_MS, delay: delay + i * 140, easing: 'ease-out', fill: 'backwards' },
          );
          anim.onfinish = () => el.remove();
          anim.oncancel = () => el.remove();
        }
        flightUntil.current = performance.now() + delay + WAVE_MS * 0.6;
      },
    };
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [apiRef]);

  useEffect(
    () =>
      client.subscribeNotices((notices: Notice[]) => {
        const root = layer.current;
        if (!root) return;
        const delayBase = Math.max(0, flightUntil.current - performance.now());
        const lines = fxLines(notices, client.getView().zones);
        const zoneOrder = [...new Set(lines.map((l) => l.zone))];
        // Mehrere Zonen in einem Kartenzug (Weltkarte): nacheinander, wie die Welle über die Insel läuft.
        const step = (cause: FxLine['cause']) =>
          cause === 'nature' ? NATURE_STAGGER_MS : zoneOrder.length > 1 ? WORLD_STAGGER_MS : 0;
        for (const line of lines) {
          const stagger = zoneOrder.indexOf(line.zone) * step(line.cause);
          const delay = delayBase + stagger + line.index * 110;
          if (line.index === 0 && line.cause === 'card') pulse(root, line.zone, delay, motion.current);
          floatLine(root, line, delay, motion.current);
        }
      }),
    [client],
  );

  return <div ref={layer} className="fx-layer" aria-hidden />;
}

/** Bildschirmpunkt einer Zone: Anker ihrer Beschriftung (wird von der Szene jedes Frame gesetzt). */
function zonePoint(zoneId: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`.zone-label-pos[data-zone="${CSS.escape(zoneId)}"]`);
  if (!el || el.style.visibility === 'hidden') return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top };
}

/** Mitte und Breite der Insel auf dem Bildschirm: aus den sichtbaren Zonenankern. */
function islandCenter(): { x: number; y: number; w: number } | null {
  const points = [...document.querySelectorAll<HTMLElement>('.zone-label-pos')]
    .filter((el) => el.style.visibility !== 'hidden')
    .map((el) => el.getBoundingClientRect());
  if (points.length === 0) return null;
  const xs = points.map((r) => r.left);
  const ys = points.map((r) => r.top);
  const w = Math.max(160, Math.max(...xs) - Math.min(...xs) + 120);
  return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length + 30, w };
}

function pulse(root: HTMLElement, zoneId: string, delay: number, motion: boolean): void {
  const p = zonePoint(zoneId);
  if (!p || !motion) return;
  const ring = document.createElement('div');
  ring.className = 'fx-pulse';
  ring.style.left = `${p.x}px`;
  ring.style.top = `${p.y + 34}px`;
  root.appendChild(ring);
  const anim = ring.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 },
      { transform: 'translate(-50%, -50%) scale(1.6)', opacity: 0 },
    ],
    { duration: 700, delay, easing: 'ease-out', fill: 'backwards' },
  );
  anim.onfinish = () => ring.remove();
  anim.oncancel = () => ring.remove();
}

function floatLine(root: HTMLElement, line: FxLine, delay: number, motion: boolean): void {
  const p = zonePoint(line.zone);
  if (!p) return;
  const el = document.createElement('div');
  el.className = `fx-float fx-float--${line.kind} is-${line.tone}`;
  el.textContent =
    line.kind === 'form'
      ? `✦ ${line.name}`
      : line.kind === 'more'
        ? t.fxMore(line.count)
        : `${TONE_ICON[line.tone]}${t.fxDelta(line.delta, line.statName)}`;
  el.style.left = `${p.x}px`;
  // Formwechsel steht über den Wertzeilen; die Wertzeilen stapeln sich darunter.
  el.style.top = `${p.y - (line.kind === 'form' ? 52 : 14)}px`;
  root.appendChild(el);
  const rise = motion ? (line.kind === 'form' ? -26 : -46) : 0;
  const keyframes: Keyframe[] =
    line.kind === 'form' && motion
      ? [
          { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0, filter: 'brightness(2)' },
          { transform: 'translate(-50%, -8px) scale(1.15)', opacity: 1, filter: 'brightness(1.4)', offset: 0.2 },
          { transform: `translate(-50%, ${rise}px) scale(1)`, opacity: 1, filter: 'brightness(1)', offset: 0.8 },
          { transform: `translate(-50%, ${rise - 6}px) scale(1)`, opacity: 0 },
        ]
      : [
          { transform: `translate(-50%, ${line.index * 22}px)`, opacity: 0 },
          { transform: `translate(-50%, ${line.index * 22 + rise * 0.2}px)`, opacity: 1, offset: 0.15 },
          { transform: `translate(-50%, ${line.index * 22 + rise * 0.8}px)`, opacity: 1, offset: 0.75 },
          { transform: `translate(-50%, ${line.index * 22 + rise}px)`, opacity: 0 },
        ];
  const anim = el.animate(keyframes, {
    duration: line.kind === 'form' ? RISE_MS + 400 : RISE_MS,
    delay,
    easing: 'ease-out',
    fill: 'backwards',
  });
  anim.onfinish = () => el.remove();
  anim.oncancel = () => el.remove();
}

const TONE_ICON: Record<FxLine['tone'], string> = { better: '✓ ', worse: '✗ ', neutral: '' };

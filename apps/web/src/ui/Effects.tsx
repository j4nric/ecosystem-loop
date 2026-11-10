import { useEffect, useRef, type RefObject } from 'react';
import type { GameClient, Notice } from '../client/index.ts';
import { t } from '../i18n/index.ts';
import { fxLines, type FxLine } from '../logic/fx.ts';

/** Von außen ansteuerbar: Karte von der Hand zur Zielzone fliegen lassen (vor dem dispatch aufrufen). */
export interface EffectsApi {
  flyCard(uid: number, zoneId: string | null): void;
}

interface Props {
  client: GameClient;
  reducedMotion: boolean;
  apiRef: RefObject<EffectsApi | null>;
}

const FLIGHT_MS = 460;
const RISE_MS = 1900;
const NATURE_STAGGER_MS = 140;

/**
 * Sichtbares Feedback als eigene DOM-Schicht über der Szene: fliegende Karte, Puls über der Zielzone,
 * aufsteigende Wertänderungen („+2 Feuchte“, grün/rot nach Richtung zum Zielbereich) und Formwechsel.
 * Alles imperativ mit Web Animations – kein React-Rendern pro Frame, Elemente entfernen sich selbst.
 * Bei „Bewegung reduzieren“ entfallen Flug und Puls; Zahlen erscheinen ohne Bewegung und blenden aus.
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
        for (const line of lines) {
          const stagger = line.cause === 'nature' ? zoneOrder.indexOf(line.zone) * NATURE_STAGGER_MS : 0;
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

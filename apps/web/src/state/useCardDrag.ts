import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { CardView } from '@core/api';
import type { GameClient } from '../client/index.ts';
import { canDrag, dropZone, LONG_PRESS_MS, movedBeyond } from '../logic/targeting.ts';
import type { ZonePicker } from '../scene/registry.ts';
import { haptic } from './motion.ts';

export interface DragState {
  card: CardView;
  /** Gültige Zonen für den ersten Slot der Karte. */
  valid: Set<string>;
  /** Zone unter dem Finger (gültig oder nicht) oder null. */
  zone: string | null;
  /** Weltkarte (Wetter): keine Zielzone, Loslassen über der Spielfläche spielt die Karte. */
  world: boolean;
  /** Nur Weltkarten: Finger liegt über der Spielfläche (nicht über Dock/Hand) – Loslassen spielt. */
  armed: boolean;
}

interface Pending {
  pointerId: number;
  card: CardView;
  x: number;
  y: number;
  dragging: boolean;
}

interface Options {
  client: GameClient;
  pickerRef: RefObject<ZonePicker | null>;
  /** Beim Start eines Ziehens: laufende Auswahl beenden, Sheets schließen. */
  onStart: () => void;
  /** Loslassen auf gültiger Zone. */
  onDrop: (card: CardView, zoneId: string) => void;
  /** Weltkarte über der Spielfläche losgelassen. */
  onDropWorld: (card: CardView) => void;
  /** Langer Druck ohne Ziehen: vollen Kartentext zeigen. */
  onLongPress: (card: CardView) => void;
}

/**
 * Karte aus der Hand auf eine Zone ziehen (Pointer-Events mit Pointer-Capture). Kleine Bewegungen bleiben
 * ein Antippen; erst ab `DRAG_START_PX` beginnt das Ziehen. Hält der Finger still (`LONG_PRESS_MS`), zeigt die
 * App die Kartendetails. Die Geisterkarte folgt dem Finger direkt über ihr DOM-Element (kein React-Rendern pro
 * Bewegung); nur ein Zonenwechsel unter dem Finger rendert neu.
 */
export function useCardDrag({ client, pickerRef, onStart, onDrop, onDropWorld, onLongPress }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const pending = useRef<Pending | null>(null);
  const ghost = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const hover = useRef<string | null>(null);
  const armedRef = useRef(false);
  const suppressClick = useRef(false);
  const frame = useRef(0);
  const pressTimer = useRef(0);

  const clearPress = useCallback(() => {
    window.clearTimeout(pressTimer.current);
    pressTimer.current = 0;
  }, []);

  // Laufenden Frame und Haltetimer beim Unmount abbrechen.
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(pressTimer.current);
    },
    [],
  );

  const placeGhost = useCallback(() => {
    const el = ghost.current;
    if (el) el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -110%)`;
  }, []);

  /** Ref-Callback für die Geisterkarte: sofort an die Fingerposition setzen. */
  const ghostRef = useCallback(
    (el: HTMLDivElement | null) => {
      ghost.current = el;
      placeGhost();
    },
    [placeGhost],
  );

  /** Zone unter dem Finger – nur, wenn der Finger über der Szene liegt (nicht über Dock oder HUD). */
  const zoneAt = useCallback(
    (x: number, y: number): string | null => {
      if (!(document.elementFromPoint(x, y) instanceof HTMLCanvasElement)) return null;
      return pickerRef.current?.(x, y) ?? null;
    },
    [pickerRef],
  );

  const end = useCallback(() => {
    cancelAnimationFrame(frame.current);
    clearPress();
    pending.current = null;
    hover.current = null;
    armedRef.current = false;
    setDrag(null);
  }, [clearPress]);

  const onPointerDown = useCallback(
    (card: CardView, e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      suppressClick.current = false;
      pending.current = { pointerId: e.pointerId, card, x: e.clientX, y: e.clientY, dragging: false };
      clearPress();
      pressTimer.current = window.setTimeout(() => {
        if (pending.current?.card.uid !== card.uid || pending.current.dragging) return;
        pending.current = null;
        suppressClick.current = true; // das folgende click gehört zum langen Druck
        haptic(10);
        onLongPress(card);
      }, LONG_PRESS_MS);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ältere Browser: ohne Capture weiter
      }
    },
    [clearPress, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const p = pending.current;
      if (!p || p.pointerId !== e.pointerId) return;
      pos.current = { x: e.clientX, y: e.clientY };
      if (!p.dragging) {
        if (!movedBeyond(p, pos.current)) return;
        clearPress();
        if (!canDrag(p.card)) return; // nur spielbare Karten mit Zonenziel lassen sich ziehen
        p.dragging = true;
        onStart();
        haptic(8);
        const world = p.card.reach === 'world';
        const valid = world ? new Set<string>() : new Set(client.legalTargets(p.card.uid, {}));
        setDrag({ card: p.card, valid, zone: null, world, armed: false });
      }
      placeGhost();
      // Raycast höchstens einmal pro Frame
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const zone = zoneAt(pos.current.x, pos.current.y);
        const armed = p.card.reach === 'world' && overPlayArea(pos.current.x, pos.current.y);
        if (zone === hover.current && armed === armedRef.current) return;
        hover.current = zone;
        armedRef.current = armed;
        setDrag((d) => (d ? { ...d, zone, armed } : d));
      });
    },
    [client, clearPress, onStart, placeGhost, zoneAt],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const p = pending.current;
      if (!p || p.pointerId !== e.pointerId) return;
      clearPress();
      if (!p.dragging) {
        pending.current = null;
        return; // war ein Antippen – das folgende click übernimmt
      }
      suppressClick.current = true;
      if (p.card.reach === 'world') {
        const card = p.card;
        const armed = overPlayArea(e.clientX, e.clientY);
        end();
        if (armed) {
          haptic(15);
          onDropWorld(card);
        }
        return;
      }
      const zone = dropZone(zoneAt(e.clientX, e.clientY), client.legalTargets(p.card.uid, {}));
      const card = p.card;
      end();
      if (zone !== null) {
        haptic(15);
        onDrop(card, zone);
      }
    },
    [client, clearPress, end, onDrop, onDropWorld, zoneAt],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (pending.current?.pointerId !== e.pointerId) return;
      if (pending.current.dragging) suppressClick.current = true;
      end();
    },
    [end],
  );

  /** Für onClick der Karte: true, wenn der Klick zu einem Ziehen oder langen Druck gehörte und ignoriert wird. */
  const consumeClick = useCallback(() => {
    const was = suppressClick.current;
    suppressClick.current = false;
    return was;
  }, []);

  return { drag, ghostRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, consumeClick };
}

/**
 * Liegt der Punkt über der Spielfläche? Alles außer Dock (Hand, Leiste) zählt – Weltkarten brauchen keine Zone.
 * Die Vorschau-Leiste beim Ziehen ignoriert Zeiger (pointer-events: none), darunter liegt das Dock.
 */
function overPlayArea(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y);
  if (el === null || el.closest('.dock') !== null) return false;
  // Die Zieh-Vorschau lässt Zeiger durch, deckt die Fläche aber sichtbar ab: dort loslassen spielt nicht.
  for (const panel of document.querySelectorAll('.drag-panel')) {
    const r = panel.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return false;
  }
  return true;
}

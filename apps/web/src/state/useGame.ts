import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Action } from '@being-god/herde';
import type { GameClient } from '../client/index.ts';
import type { Tone } from '../logic/events.ts';

export interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const TOAST_MS = 3400;
const MAX_TOASTS = 2;
/** Pause zwischen zwei Monaten beim Abspielen (die Herde braucht etwa 0,7 s für ihren Zug). */
export const MONTH_MS = 1000;
export const MONTH_MS_REDUCED = 300;

/**
 * Bindet den GameClient an React: aktuelle View, Protokoll, dispatch, kurze Meldungen und das animierte
 * Ablaufen mehrerer Monate (`run`).
 */
export function useGame(client: GameClient, reducedMotion: boolean) {
  const subscribe = useCallback((fn: () => void) => client.subscribe(fn), [client]);
  const view = useSyncExternalStore(subscribe, () => client.getView());
  const log = useSyncExternalStore(subscribe, () => client.getLog());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [running, setRunning] = useState(false);
  const nextId = useRef(1);
  const timer = useRef<number | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    const timers = new Set<number>();
    const unsubscribe = client.subscribeReports((report) => {
      const fresh = report.notices
        .filter((n) => n.toast)
        .map((n) => ({ id: nextId.current++, text: n.text, tone: n.tone }));
      if (fresh.length === 0) return;
      // Wichtiges zuerst: Verluste vor guten Nachrichten vor Hinweisen.
      const rank = { bad: 0, good: 1, info: 2 } as const;
      fresh.sort((a, b) => rank[a.tone] - rank[b.tone]);
      setToasts((list) => [...fresh.slice(0, MAX_TOASTS), ...list].slice(0, MAX_TOASTS));
      for (const toast of fresh) {
        const id = window.setTimeout(() => {
          timers.delete(id);
          setToasts((list) => list.filter((x) => x.id !== toast.id));
        }, TOAST_MS);
        timers.add(id);
      }
    });
    return () => {
      unsubscribe();
      for (const id of timers) window.clearTimeout(id);
    };
  }, [client]);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    runId.current++;
    setRunning(false);
  }, []);
  useEffect(() => stop, [stop]);

  const dispatch = useCallback((action: Action) => client.dispatch(action), [client]);

  /** Lässt `months` Monate nacheinander ablaufen; endet früher, wenn die Partie vorbei ist oder `stop` kommt. */
  const run = useCallback(
    (months: number) => {
      if (timer.current !== null || months <= 0) return;
      setRunning(true);
      const id = ++runId.current;
      let left = months;
      const tick = () => {
        const ok = client.dispatch({ type: 'advance' });
        left--;
        if (!ok || left <= 0 || client.getView().over) {
          timer.current = null;
          // Die letzte Bewegung noch ausklingen lassen, dann Knöpfe wieder freigeben.
          window.setTimeout(
            () => {
              if (runId.current === id) setRunning(false);
            },
            reducedMotion ? 0 : 500,
          );
          return;
        }
        timer.current = window.setTimeout(tick, reducedMotion ? MONTH_MS_REDUCED : MONTH_MS);
      };
      timer.current = window.setTimeout(tick, 0);
    },
    [client, reducedMotion],
  );

  const newGame = useCallback(() => {
    stop();
    setToasts([]);
    client.newGame();
  }, [client, stop]);

  return { view, log, toasts, running, dispatch, run, stop, newGame };
}

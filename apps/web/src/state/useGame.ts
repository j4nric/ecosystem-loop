import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Action } from '@being-god/herde';
import type { GameClient } from '../client/index.ts';
import type { Tone } from '../logic/events.ts';
import { createMonthRunner, timingFor, type MonthRunner } from './monthRunner.ts';

export interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const TOAST_MS = 3400;
const MAX_TOASTS = 2;

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
  const reduced = useRef(reducedMotion);
  useEffect(() => {
    reduced.current = reducedMotion;
  }, [reducedMotion]);

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

  // Schrittweises Ablaufen der Monate (Logik in monthRunner.ts, ohne DOM getestet). Ein Runner je Client;
  // beim Wechsel oder Abbau wird ein laufender Lauf angehalten.
  const runner = useRef<MonthRunner | null>(null);
  useEffect(() => {
    const r = createMonthRunner({
      advance: () => client.dispatch({ type: 'advance' }),
      isOver: () => client.getView().over !== null,
      setRunning,
      timing: () => timingFor(reduced.current),
    });
    runner.current = r;
    return () => {
      r.stop();
      if (runner.current === r) runner.current = null;
    };
  }, [client]);
  const stop = useCallback(() => runner.current?.stop(), []);

  const dispatch = useCallback((action: Action) => client.dispatch(action), [client]);

  /** Lässt `months` Monate nacheinander ablaufen; endet früher, wenn die Partie vorbei ist oder `stop` kommt. */
  const run = useCallback((months: number) => void runner.current?.run(months), []);

  const newGame = useCallback(() => {
    stop();
    setToasts([]);
    client.newGame();
  }, [client, stop]);

  return { view, log, toasts, running, dispatch, run, stop, newGame };
}

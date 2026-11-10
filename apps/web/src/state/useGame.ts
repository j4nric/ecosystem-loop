import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Action } from '@core/api';
import type { GameClient, Notice } from '../client/index.ts';
import { t } from '../i18n/index.ts';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

const TOAST_MS = 3200;
const MAX_TOASTS = 4;

/**
 * Bindet einen GameClient an React: aktuelle GameView, dispatch und kurze Ereignis-Meldungen.
 * Die Meldungen kommen aus den Engine-Ereignissen des jeweiligen Schritts (`subscribeNotices`).
 */
export function useGame(client: GameClient) {
  const view = useSyncExternalStore(
    useCallback((fn: () => void) => client.subscribe(fn), [client]),
    () => client.getView(),
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const timers = new Set<number>();
    const unsubscribe = client.subscribeNotices((notices) => {
      const fresh = notices.map((n) => ({ id: nextId.current++, ...noticeToast(n) }));
      // Ein großer Schritt (Rundenende) verdrängt ältere Meldungen; seine wichtigsten stehen vorn.
      setToasts((list) =>
        fresh.length >= MAX_TOASTS ? fresh.slice(0, MAX_TOASTS) : [...list, ...fresh].slice(-MAX_TOASTS),
      );
      for (const toast of fresh) {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          setToasts((list) => list.filter((x) => x.id !== toast.id));
        }, TOAST_MS);
        timers.add(timer);
      }
    });
    return () => {
      unsubscribe();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [client]);

  const dispatch = useCallback((action: Action) => client.dispatch(action), [client]);
  const newGame = useCallback(() => {
    setToasts([]);
    client.newGame();
  }, [client]);

  return { view, dispatch, newGame, toasts };
}

function noticeToast(n: Notice): Omit<Toast, 'id'> {
  switch (n.type) {
    case 'round':
      return { text: t.toastRound(n.round, n.season), tone: 'info' };
    case 'played':
      return { text: t.toastPlayed(n.card), tone: 'info' };
    case 'trigger':
      return { text: t.toastTrigger(n.icon, n.name, n.zone), tone: n.disturbance ? 'bad' : 'info' };
    case 'form':
      if (n.kind === 'disturbance') return { text: t.toastDisturbance(n.zone, n.to), tone: 'bad' };
      return {
        text: t.toastForm(n.zone, n.from, n.to),
        tone: n.kind === 'ideal' ? 'good' : n.kind === 'normal' ? 'info' : 'bad',
      };
    case 'level':
      return n.to > n.from
        ? { text: t.toastLevel(n.zone, n.to), tone: 'good' }
        : { text: t.toastLevelDown(n.zone, n.to), tone: 'bad' };
    case 'harmony':
      return { text: t.toastHarmony(n.delta), tone: n.delta > 0 ? 'good' : 'bad' };
    case 'collapsed':
      return { text: t.toastCollapsed, tone: 'bad' };
    case 'text':
      return { text: n.text, tone: n.tone };
    case 'emerged':
      return {
        text: n.first ? t.toastEmergedFirst(n.species, n.zone) : t.toastEmerged(n.species, n.zone),
        tone: 'good',
      };
    case 'extinct':
      return { text: t.toastExtinct(n.species), tone: 'bad' };
    case 'migrated':
      return { text: t.toastMigrated(n.species, n.from, n.to), tone: 'info' };
    case 'hunger':
      return { text: t.toastHunger(n.species, n.zone), tone: 'bad' };
    case 'gift':
      return { text: t.toastGift(n.species, n.card), tone: 'good' };
  }
}

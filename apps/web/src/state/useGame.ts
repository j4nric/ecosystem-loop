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
  const [incompatible, setIncompatible] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    const timers = new Set<number>();
    const unsubscribe = client.subscribeNotices((all) => {
      if (all.some((n) => n.type === 'incompatible')) setIncompatible(true);
      const notices = all.filter((n) => n.type !== 'incompatible');
      if (notices.length === 0) return;
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
    setIncompatible(false);
    client.newGame();
  }, [client]);
  const dismissIncompatible = useCallback(() => setIncompatible(false), []);

  return { view, dispatch, newGame, toasts, incompatible, dismissIncompatible };
}

const deltas = (list: { species: string; delta: number }[]) =>
  list.map((x) => t.popDelta(x.species, x.delta)).join(', ');

function noticeToast(n: Exclude<Notice, { type: 'incompatible' }>): Omit<Toast, 'id'> {
  switch (n.type) {
    case 'overgrazed':
      return { text: t.toastOvergrazed(n.zone, n.foods.join(', ')), tone: 'bad' };
    case 'hunted':
      return { text: t.toastHunted(n.zone, deltas(n.losses)), tone: 'bad' };
    case 'populationShift':
      return {
        text: t.toastPopulationShift(n.card, n.zone, deltas(n.changes)),
        tone: n.changes.every((c) => c.delta > 0) ? 'good' : 'info',
      };
    case 'rejected':
      return { text: t.toastRejected, tone: 'bad' };
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

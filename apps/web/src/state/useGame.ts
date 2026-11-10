import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Action, GameView } from '@core/api';
import type { GameClient } from '../client/index.ts';
import { t } from '../i18n/index.ts';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

const TOAST_MS = 2600;
const MAX_TOASTS = 3;

/**
 * Bindet einen GameClient an React: aktuelle GameView, dispatch und kurze Ereignis-Meldungen.
 * Die Meldungen entstehen aus dem Unterschied zweier Views, bis die Engine ein Ereignis-Log liefert.
 */
export function useGame(client: GameClient) {
  const view = useSyncExternalStore(
    useCallback((fn: () => void) => client.subscribe(fn), [client]),
    () => client.getView(),
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prev = useRef<GameView>(view);
  const nextId = useRef(1);

  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, text, tone }].slice(-MAX_TOASTS));
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  useEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (before === view) return;
    for (const message of diffViews(before, view)) push(message.text, message.tone);
  }, [view, push]);

  const dispatch = useCallback((action: Action) => client.dispatch(action), [client]);
  const newGame = useCallback(() => client.newGame(), [client]);

  return { view, dispatch, newGame, toasts };
}

function diffViews(a: GameView, b: GameView): Omit<Toast, 'id'>[] {
  const out: Omit<Toast, 'id'>[] = [];
  if (b.round !== a.round) out.push({ text: t.toastRound(b.round, b.season.name), tone: 'info' });
  for (const card of a.hand) {
    if (b.round === a.round && !b.hand.some((c) => c.uid === card.uid)) {
      out.push({ text: t.toastPlayed(card.name), tone: 'info' });
    }
  }
  for (const zb of b.zones) {
    const za = a.zones.find((z) => z.id === zb.id);
    if (!za) continue;
    if (za.form.id !== zb.form.id) {
      const tone = zb.form.kind === 'ideal' ? 'good' : zb.form.kind === 'normal' ? 'info' : 'bad';
      out.push({ text: t.toastForm(zb.geographyName, za.form.name, zb.form.name), tone });
    }
    if (zb.level > za.level) out.push({ text: t.toastLevel(zb.geographyName, zb.level), tone: 'good' });
  }
  const dh = b.harmony.value - a.harmony.value;
  if (dh !== 0 && b.round !== a.round) out.push({ text: t.toastHarmony(dh), tone: dh > 0 ? 'good' : 'bad' });
  return out;
}

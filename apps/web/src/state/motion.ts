import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

function subscribe(listener: () => void): () => void {
  const mq = media();
  mq?.addEventListener('change', listener);
  return () => mq?.removeEventListener('change', listener);
}

/** true, wenn das System „Bewegung reduzieren“ wünscht – Animationen werden dann kurz oder entfallen. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false);
}

/** Kurzes Vibrieren als Rückmeldung (Android; iOS Safari ignoriert es). */
export function haptic(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // nicht unterstützt
  }
}

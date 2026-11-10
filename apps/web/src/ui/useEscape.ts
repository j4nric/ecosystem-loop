import { useEffect, useRef } from 'react';

/** Escape schließt den Dialog bzw. das Menü (Tastatur, iPad mit Tastatur, Desktop-Browser). */
export function useEscape(onClose: () => void, active = true): void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      latest.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

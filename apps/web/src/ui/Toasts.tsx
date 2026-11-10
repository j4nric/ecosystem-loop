import type { Toast } from '../state/useGame.ts';

/** Kurze Ereignis-Meldungen unter der Kopfzeile. */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}

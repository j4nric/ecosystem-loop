import { useLayoutEffect, useRef } from 'react';
import type { GameView } from '@core/api';
import { t } from '../i18n/index.ts';

interface Props {
  view: GameView;
  isMock: boolean;
  reducedMotion: boolean;
  onNewGame: () => void;
  onHelp: () => void;
}

/** Kopfzeile: Harmonie-Balken (animiert), Odem, Runde/Jahr/Jahreszeit, Ereignis-Vorschau, Hilfe. */
export function Hud({ view, isMock, reducedMotion, onNewGame, onHelp }: Props) {
  const h = view.harmony;
  const pct = Math.round((h.value / Math.max(1, h.max)) * 100);
  const tone = pct >= 60 ? 'good' : pct >= 30 ? 'mid' : 'low';
  const trend = h.trend > 0 ? '▲' : h.trend < 0 ? '▼' : '';
  const meter = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  // Zahl zählt zum neuen Wert, der Balken blinkt kurz grün bzw. rot (Web Animations, ohne React-Rendern).
  // Die Zahl gehört allein diesem Effekt (das Element hat keine React-Kinder).
  useLayoutEffect(() => {
    const from = shown.current;
    const to = h.value;
    shown.current = to;
    const el = number.current;
    if (!el) return;
    if (from === null || from === to || reducedMotion) {
      el.textContent = String(to);
      return;
    }
    meter.current?.animate(
      [
        { boxShadow: `0 0 0 0 ${to > from ? 'rgba(106,166,79,0.8)' : 'rgba(207,90,74,0.8)'}` },
        { boxShadow: '0 0 0 8px rgba(0,0,0,0)' },
      ],
      { duration: 900, easing: 'ease-out' },
    );
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = String(to);
    };
  }, [h.value, reducedMotion]);

  return (
    <header className="hud">
      <div
        ref={meter}
        className={`harmony harmony--${tone}`}
        role="meter"
        aria-label={t.harmony}
        aria-valuemin={0}
        aria-valuemax={h.max}
        aria-valuenow={h.value}
      >
        <div className="harmony__fill" style={{ width: `${pct}%` }} />
        <span className="harmony__label">
          {t.harmony} <span ref={number} />/{h.max} {trend}
        </span>
      </div>
      <div className="hud__row">
        <div className="breath" aria-label={`${t.breath} ${view.breath.value}/${view.breath.max}`}>
          <span className="breath__icon" aria-hidden>
            ✦
          </span>
          <span className="breath__value">
            {view.breath.value}
            <small>/{view.breath.max}</small>
          </span>
          <span className="breath__pips" aria-hidden>
            {Array.from({ length: view.breath.max }, (_, i) => (
              <i key={i} className={i < view.breath.value ? 'on' : ''} />
            ))}
          </span>
        </div>
        <div className="calendar">
          <span className={`season season--${view.season.id}`}>{view.season.name}</span>
          <span className="calendar__meta">
            {t.round(view.round)} · {t.year(view.year)}
          </span>
        </div>
        <div className="hud__buttons">
          <button type="button" className="icon-btn" onClick={onHelp} aria-label={t.help}>
            ?
          </button>
          <button type="button" className="icon-btn" onClick={onNewGame} aria-label={t.newGame}>
            ↻
          </button>
        </div>
      </div>
      {view.forecast && (
        <div className="forecast">
          <b>{t.forecast}:</b> {view.forecast.name} – {view.forecast.text}
        </div>
      )}
      {isMock && <div className="mock-badge">{t.mockBadge}</div>}
    </header>
  );
}

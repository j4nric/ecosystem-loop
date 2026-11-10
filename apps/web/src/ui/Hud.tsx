import { useLayoutEffect, useRef, useState } from 'react';
import type { GameView } from '@core/api';
import { t } from '../i18n/index.ts';

interface Props {
  view: GameView;
  isMock: boolean;
  reducedMotion: boolean;
  onNewGame: () => void;
  onHelp: () => void;
  onBook: () => void;
}

/** Kopfzeile: Harmonie-Balken (animiert), Odem, Runde/Jahr/Jahreszeit, Ereignis-Vorschau, Hilfe. */
export function Hud({ view, isMock, reducedMotion, onNewGame, onHelp, onBook }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);
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
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t.menu}
            aria-expanded={menuOpen}
          >
            ☰
          </button>
          {menuOpen && (
            <div className="hud__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onBook();
                }}
              >
                <span aria-hidden>📖</span> {t.book}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onNewGame();
                }}
              >
                <span aria-hidden>↻</span> {t.newGame}
              </button>
            </div>
          )}
        </div>
      </div>
      {view.forecast && (
        <button
          type="button"
          className={`forecast${forecastOpen ? ' is-open' : ''}${(view.forecast.inRounds ?? 0) <= 0 ? ' is-now' : ''}`}
          aria-expanded={forecastOpen}
          title={t.forecastShowText}
          onClick={() => setForecastOpen((o) => !o)}
        >
          <span className="forecast__icon" aria-hidden>
            {view.forecast.icon ?? '⚠'}
          </span>
          <span className="forecast__main">
            <b>{view.forecast.name}</b>
            <small>
              {t.forecastWhen(view.forecast.inRounds ?? 0)}
              {view.forecast.zoneName ? ` · ${t.forecastZone(view.forecast.zoneName)}` : ''}
            </small>
            {forecastOpen && <span className="forecast__text">{view.forecast.text}</span>}
          </span>
        </button>
      )}
      {(view.eventShield ?? 0) > 0 && (
        <div className="shield">
          <span aria-hidden>🛡</span> {t.eventShield(view.eventShield ?? 0)}
        </div>
      )}
      {isMock && <div className="mock-badge">{t.mockBadge}</div>}
    </header>
  );
}

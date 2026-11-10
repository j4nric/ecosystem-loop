import type { GameView } from '@core/api';
import { t } from '../i18n/index.ts';

/** Kopfzeile: Harmonie-Balken, Odem, Runde/Jahr/Jahreszeit, Ereignis-Vorschau. */
export function Hud({ view, isMock }: { view: GameView; isMock: boolean }) {
  const h = view.harmony;
  const pct = Math.round((h.value / Math.max(1, h.max)) * 100);
  const tone = pct >= 60 ? 'good' : pct >= 30 ? 'mid' : 'low';
  const trend = h.trend > 0 ? '▲' : h.trend < 0 ? '▼' : '';
  return (
    <header className="hud">
      <div
        className={`harmony harmony--${tone}`}
        role="meter"
        aria-label={t.harmony}
        aria-valuemin={0}
        aria-valuemax={h.max}
        aria-valuenow={h.value}
      >
        <div className="harmony__fill" style={{ width: `${pct}%` }} />
        <span className="harmony__label">
          {t.harmony} {h.value}/{h.max} {trend}
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

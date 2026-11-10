import type { ReactNode } from 'react';
import type { ZoneView } from '@core/api';
import type { PreviewView } from '../client/index.ts';
import { t } from '../i18n/index.ts';

interface Props {
  zone: ZoneView;
  zones: ZoneView[];
  onClose: () => void;
  /** Wertänderungen aus einer Kartenvorschau (nur die dieser Zone werden an den Balken gezeigt). */
  changes?: PreviewView['changes'];
  /** Zusatzinhalt unter dem Kopf, z. B. die Kartenvorschau mit „Spielen“. */
  children?: ReactNode;
}

/** Bottom-Sheet mit Zonendetails: Form, Stufe, Werte als Balken, Bestände, Gefahren. */
export function ZoneSheet({ zone, zones, onClose, changes, children }: Props) {
  const next = new Map((changes ?? []).filter((c) => c.zone === zone.id).map((c) => [c.stat, c.to]));
  const neighborNames = zone.neighbors.map((id) => zones.find((z) => z.id === id)?.geographyName ?? id).join(', ');
  return (
    <section className={`sheet${children ? ' sheet--compact' : ''}`} role="dialog" aria-label={zone.geographyName}>
      <button type="button" className="sheet__grab" onClick={onClose} aria-label={t.close} />
      <header className="sheet__head">
        <div>
          <h2>{zone.geographyName}</h2>
          <p className="sheet__form">
            <span className={`kind kind--${zone.form.kind}`}>{t.formKind[zone.form.kind]}</span> {zone.form.name}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </header>

      {children}

      <div className="sheet__level" aria-label={`${t.level} ${zone.level}/5`}>
        <span className="stars" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} className={i < zone.level ? 'on' : ''}>
              ★
            </i>
          ))}
        </span>
        <span className="progress" title={t.levelProgress}>
          <span style={{ width: `${Math.round(zone.levelProgress * 100)}%` }} />
        </span>
      </div>

      {zone.warnings.length > 0 && (
        <ul className="sheet__warnings" aria-label={t.warnings}>
          {zone.warnings.map((w) => (
            <li key={`${w.card}-${w.trigger}`}>
              <span aria-hidden>{w.icon}</span> {w.name}
            </li>
          ))}
        </ul>
      )}

      <h3>{t.values}</h3>
      <ul className="stats">
        {zone.stats.map((s) => {
          const to = next.get(s.id);
          const lo = Math.min(s.value, to ?? s.value);
          const hi = Math.max(s.value, to ?? s.value);
          const dir = to === undefined ? '' : to > s.value ? 'up' : 'down';
          return (
            <li key={s.id} className={`stat stat--${s.id}${dir ? ` stat--${dir}` : ''}`}>
              <span className="stat__name">{s.name}</span>
              <span className="stat__bar" aria-hidden>
                {Array.from({ length: s.max }, (_, i) => (
                  <i key={i} className={i < lo ? 'on' : i < hi ? `delta delta--${dir}` : ''} />
                ))}
              </span>
              <span className="stat__value">
                {to === undefined ? (
                  s.value
                ) : (
                  <>
                    <s>{s.value}</s>
                    {to}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <h3>{t.populations}</h3>
      {zone.populations.length === 0 ? (
        <p className="muted">{t.noPopulations}</p>
      ) : (
        <ul className="pops">
          {zone.populations.map((p) => (
            <li key={p.species}>
              <span>{p.name}</span>
              <span className="muted">{t.tier(p.tier)}</span>
              <b>×{p.count}</b>
            </li>
          ))}
        </ul>
      )}

      <p className="muted sheet__neighbors">
        {t.neighbors}: {neighborNames}
      </p>
    </section>
  );
}

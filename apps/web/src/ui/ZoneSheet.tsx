import type { ZoneView } from '@core/api';
import { t } from '../i18n/index.ts';

/** Bottom-Sheet mit Zonendetails: Form, Stufe, Werte als Balken, Bestände, Gefahren. */
export function ZoneSheet({ zone, zones, onClose }: { zone: ZoneView; zones: ZoneView[]; onClose: () => void }) {
  const neighborNames = zone.neighbors.map((id) => zones.find((z) => z.id === id)?.geographyName ?? id).join(', ');
  return (
    <section className="sheet" role="dialog" aria-label={zone.geographyName}>
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
        {zone.stats.map((s) => (
          <li key={s.id} className={`stat stat--${s.id}`}>
            <span className="stat__name">{s.name}</span>
            <span className="stat__bar" aria-hidden>
              {Array.from({ length: s.max }, (_, i) => (
                <i key={i} className={i < s.value ? 'on' : ''} />
              ))}
            </span>
            <span className="stat__value">{s.value}</span>
          </li>
        ))}
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

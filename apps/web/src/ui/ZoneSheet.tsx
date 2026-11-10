import type { ReactNode } from 'react';
import type { ZoneView } from '@core/api';
import type { PreviewView } from '../client/index.ts';
import { t } from '../i18n/index.ts';
import { barCells, rangeLabel, towardOf } from '../logic/ideal.ts';

interface Props {
  zone: ZoneView;
  zones: ZoneView[];
  onClose: () => void;
  /** Wertänderungen aus einer Kartenvorschau (nur die dieser Zone werden an den Balken gezeigt). */
  changes?: PreviewView['changes'];
  /** Zusatzinhalt unter dem Kopf, z. B. die Kartenvorschau. */
  children?: ReactNode;
  /** Feste Fußleiste unter dem scrollenden Inhalt (z. B. „Abbrechen“/„Spielen“). */
  footer?: ReactNode;
}

/**
 * Bottom-Sheet mit Zonendetails: Form, Stufe, Werte als Balken, Bestände, Gefahren. Kopf und Fußleiste stehen
 * fest, nur der Inhalt dazwischen scrollt – so verdeckt die Aktionsleiste nie einen Chip oder Wert.
 */
export function ZoneSheet({ zone, zones, onClose, changes, children, footer }: Props) {
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

      <div className="sheet__body">
        {zone.ideal && <IdealGoal ideal={zone.ideal} />}
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
          {zone.stats.map((s) => (
            <StatRow key={s.id} stat={s} to={next.get(s.id)} />
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
      </div>
      {footer && <div className="sheet__footer">{footer}</div>}
    </section>
  );
}

type Stat = ZoneView['stats'][number];

const STATUS_ICON = { low: '▾', ok: '✓', high: '▴' } as const;
const TOWARD_ICON = { better: '✓', worse: '✗', neutral: '' } as const;

/**
 * Ein Wert als Balken (Zellen für 1…max): gefüllte Zellen = aktueller Wert, umrandete Spanne = Zielbereich der
 * Idealform; dahinter Zielangabe und Lage („zu niedrig / passt / zu hoch“ mit Symbol). Mit Vorschau zeigt der
 * Balken die Änderung gestrichelt und färbt sie nach der Richtung zum Zielbereich.
 */
export function StatRow({ stat: s, to }: { stat: Stat; to?: number | undefined }) {
  const target = s.target;
  const cells = barCells(s.value, s.max, target);
  const lo = Math.min(s.value, to ?? s.value);
  const hi = Math.max(s.value, to ?? s.value);
  const dir = to === undefined || to === s.value ? '' : to > s.value ? 'up' : 'down';
  const toward = to === undefined ? 'neutral' : towardOf(s.value, to, target);
  const status = target?.status;
  return (
    <li
      className={`stat stat--${s.id}${dir ? ` stat--${dir}` : ''}${target ? ' has-target' : ''}`}
      aria-label={`${s.name} ${s.value}${to !== undefined ? ` → ${to}` : ''}${
        target ? `. ${t.targetRange(rangeLabel(target, s.max))}, ${t.targetStatus[target.status]}` : ''
      }`}
    >
      <span className="stat__name">{s.name}</span>
      <span className="stat__bar" aria-hidden>
        {cells.map((c, i) => {
          const fill = i < lo ? 'on' : i < hi ? `delta delta--${dir} delta--${toward}` : '';
          const span = c.target
            ? ` t${i === 0 || !cells[i - 1]?.target ? ' t-start' : ''}${!cells[i + 1]?.target ? ' t-end' : ''}`
            : '';
          return <i key={i} className={`${fill}${span}`} />;
        })}
      </span>
      <span className={`stat__value${toward !== 'neutral' ? ` is-${toward}` : ''}`} aria-hidden>
        {to === undefined || to === s.value ? (
          s.value
        ) : (
          <>
            <s>{s.value}</s>
            {to}
            {TOWARD_ICON[toward] && <small>{TOWARD_ICON[toward]}</small>}
          </>
        )}
      </span>
      {target && status && (
        <span className={`stat__target is-${status}`} aria-hidden>
          <span>{t.targetShort(rangeLabel(target, s.max))}</span>
          <b>
            {STATUS_ICON[status]} {t.targetStatus[status]}
          </b>
        </span>
      )}
    </li>
  );
}

/** Kopf des Sheets: Idealform der Geografie und Abstand als Punkte („2 Schritte bis zur Idealform“). */
export function IdealGoal({ ideal }: { ideal: NonNullable<ZoneView['ideal']> }) {
  const reached = ideal.distance <= 0;
  const shown = Math.min(ideal.distance, 6);
  return (
    <div className={`ideal-goal${reached ? ' is-reached' : ''}`}>
      <span className="ideal-goal__name">
        <span aria-hidden>🎯</span> {t.idealGoal(ideal.name)}
      </span>
      <span className="ideal-goal__dist">
        {!reached && (
          <span className="ideal-goal__dots" aria-hidden>
            {Array.from({ length: shown }, (_, i) => (
              <i key={i} />
            ))}
            {ideal.distance > shown && <small>+{ideal.distance - shown}</small>}
          </span>
        )}
        <span>{reached ? `✓ ${t.idealReached}` : t.idealSteps(ideal.distance)}</span>
      </span>
    </div>
  );
}

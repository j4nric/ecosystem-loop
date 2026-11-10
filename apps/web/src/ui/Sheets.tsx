import type { ReactNode } from 'react';
import type { CellView, HerdeData, HerdeView } from '@being-god/herde';
import type { LogEntry, PlayPreview } from '../client/index.ts';
import { locale, t } from '../i18n/index.ts';
import { forecastLines, intentText, landName, textOf } from '../logic/format.ts';
import { useEscape } from './useEscape.ts';

function Sheet({
  title,
  icon,
  onClose,
  children,
  aside,
  className = '',
}: {
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  useEscape(onClose);
  return (
    <section className={`sheet ${className}`} role="dialog" aria-label={title}>
      <header className="sheet__head">
        <h2>
          {icon && (
            <span className="sheet__icon" aria-hidden>
              {icon}
            </span>
          )}
          {title}
        </h2>
        {aside}
        <button type="button" className="icon-btn icon-btn--flat" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </header>
      <div className="sheet__body">{children}</div>
    </section>
  );
}

/**
 * Karte gewählt: Text, Wildnis-Kosten und – sobald ein Ziel gewählt ist – die Vorschau. Kompakt, damit die Insel
 * sichtbar bleibt; „Legen“ und „Abbrechen“ stehen in der Steuerleiste.
 */
export function CardSheet({
  data,
  card,
  wild,
  global,
  playable,
  chosen,
  preview,
  onCancel,
}: {
  data: HerdeData;
  card: string;
  wild: number;
  global: boolean;
  /** false: kein gültiges Ziel – das Sheet sagt das, statt zur Feldwahl aufzufordern */
  playable: boolean;
  chosen: boolean;
  preview: PlayPreview | null;
  onCancel: () => void;
}) {
  const def = data.cards.get(card);
  const name = textOf(def?.name, locale, card);
  return (
    <Sheet
      title={name}
      icon={def?.icon}
      onClose={onCancel}
      className="sheet--card"
      aside={<span className="wild-cost">{t.wildCost(wild)}</span>}
    >
      <p className="sheet__text">{textOf(def?.text, locale)}</p>
      {!playable ? (
        <p className="hint is-bad">{t.noTargets}</p>
      ) : (
        !global && !chosen && <p className="hint">{t.pickField}</p>
      )}
      {preview && <PreviewLines data={data} preview={preview} />}
    </Sheet>
  );
}

function PreviewLines({ data, preview }: { data: HerdeData; preview: PlayPreview }) {
  const c = preview.cell;
  return (
    <ul className="preview" aria-label={t.previewTitle}>
      {c && c.before.land !== c.after.land && (
        <li>
          <b>{t.previewCell(landName(data, locale, c.before.land), landName(data, locale, c.after.land))}</b>
        </li>
      )}
      {c && c.before.food !== c.after.food && <li>{t.previewFood(c.before.food, c.after.food)}</li>}
      {c && !c.before.blocked && c.after.blocked && <li className="is-bad">{t.previewBlocked}</li>}
      {c && c.before.blocked && !c.after.blocked && <li className="is-good">{t.previewWasBlocked}</li>}
      {c && c.before.blocked && c.after.blocked && <li className="muted">{t.previewStillBlocked}</li>}
      {!c && preview.grown.length > 0 && <li>{t.previewGrow(preview.grown.length)}</li>}
      {preview.ignites && <li className="is-bad">{t.previewFire}</li>}
      {preview.packGone && <li className="is-good">{t.previewPackGone}</li>}
      {preview.intentChanged && preview.intentAfter ? (
        <li className="preview__intent">
          {t.previewIntentChanged} <b>{intentText(t, preview.intentAfter)}</b>
        </li>
      ) : (
        <li className="muted">{t.intentSame}</li>
      )}
    </ul>
  );
}

/** Feld-Info: Landschaft, Futter, Prognose, Herde und Rudel auf dem Feld. */
export function FieldSheet({
  data,
  view,
  cell,
  onClose,
}: {
  data: HerdeData;
  view: HerdeView;
  cell: CellView;
  onClose: () => void;
}) {
  const land = data.landscapes.get(cell.land);
  const pack = cell.pack === null ? undefined : view.packs.find((p) => p.id === cell.pack);
  const title = `${landName(data, locale, cell.land)}${cell.fertile ? ` (${t.fertile})` : ''}`;
  return (
    <Sheet title={title} icon={land?.icon || undefined} onClose={onClose} className="sheet--field">
      {cell.maxFood > 0 && (
        <div className="food" aria-label={t.food(cell.food, cell.maxFood)}>
          <span>{t.food(cell.food, cell.maxFood)}</span>
          <span className="bar" aria-hidden>
            <i style={{ width: `${(cell.food / cell.maxFood) * 100}%` }} />
          </span>
        </div>
      )}
      {forecastLines(t, data, locale, cell, view.evolution.stage).map((line) => (
        <p key={line}>{line}</p>
      ))}
      {cell.herd && <p className="is-herd">{t.infoHerd(view.herd.size)}</p>}
      {pack && <p className="is-bad">{t.infoPack(pack.size, pack.hungry)}</p>}
    </Sheet>
  );
}

/** Geschehen-Protokoll, neueste Einträge oben, mit Monat. */
export function LogSheet({ data, log, onClose }: { data: HerdeData; log: readonly LogEntry[]; onClose: () => void }) {
  const year = data.months.length;
  return (
    <Sheet title={t.log} onClose={onClose} className="sheet--log">
      {log.length === 0 ? (
        <p className="muted">{t.logEmpty}</p>
      ) : (
        <ol className="log">
          {log.map((e, i) => (
            <li key={i} className={`log__item log__item--${e.tone}`}>
              <small>{t.date(Math.floor(e.month / year) + 1, textOf(data.months[e.month % year], locale))}</small>
              {e.text}
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}

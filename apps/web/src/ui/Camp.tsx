import type { HerdeData, HerdeView, Pos } from '@being-god/herde';
import { locale, t } from '../i18n/index.ts';
import { campBanner, campChips, campGroupNames, campPreview, campPreviewLines, campShort } from '../logic/hunt.ts';
import { Sheet } from './Sheets.tsx';
import { useEscape } from './useEscape.ts';

/**
 * Hinweis zum Lager unter der Statusleiste: „Lagerplatz wählen“ (antippen öffnet die Vorschau des ersten Platzes),
 * in der Eiszeit „kein Lager“, ohne Platz in Zugweite, was gesucht ist.
 */
export function CampBanner({ data, view, onChoose }: { data: HerdeData; view: HerdeView; onChoose: () => void }) {
  const banner = campBanner(view);
  const camp = view.evolution.stage.camp;
  if (!banner || !camp) return null;
  if (banner.kind === 'choose')
    return (
      <button type="button" className="evo-banner camp-banner" onClick={onChoose}>
        {t.campBanner}
      </button>
    );
  return (
    <p className="camp-note" role="status">
      {banner.kind === 'ice' ? t.campBannerIce : t.campBannerNone(campGroupNames(data, locale, camp), camp.radius)}
    </p>
  );
}

/**
 * Vorschau eines Lagerplatzes im Dock, kompakt, damit die Insel mit den anderen Plätzen sichtbar bleibt: was im
 * Umkreis liegt (Chips) und ein Satz zu den Folgen. „Lager hier gründen“ steht in der Steuerleiste.
 */
export function CampSheet({
  data,
  view,
  pos,
  onClose,
}: {
  data: HerdeData;
  view: HerdeView;
  pos: Pos;
  onClose: () => void;
}) {
  const preview = campPreview(data, locale, view, pos);
  if (!preview) return null;
  const chips = campChips(t, preview);
  return (
    <Sheet title={t.campTitle} icon="⛺" onClose={onClose} className="sheet--camp">
      {[
        { radius: preview.radius, chips: chips.near },
        { radius: preview.reach, chips: chips.reach },
      ].map((row) => (
        <div key={row.radius} className="camp__row">
          <small>{t.campAround(row.radius)}</small>
          <ul className="camp__chips">
            {row.chips.map((chip) => (
              <li key={chip.label} className={chip.bad ? 'is-bad' : undefined}>
                <b>{chip.value}</b>
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="camp__short">{campShort(t, preview)}</p>
      {view.campSites.length > 1 && <p className="muted">{t.campOther}</p>}
    </Sheet>
  );
}

/** Bestätigung im Spiel (nicht `confirm()`): Folgen und kein Zurück, dann `settle`. */
export function CampConfirm({
  data,
  view,
  pos,
  onConfirm,
  onCancel,
}: {
  data: HerdeData;
  view: HerdeView;
  pos: Pos;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEscape(onCancel);
  const preview = campPreview(data, locale, view, pos);
  if (!preview) return null;
  const { effects } = campPreviewLines(t, preview);
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="camp-title">
      <div className="overlay__panel evolve">
        <div className="evolve__icons" aria-hidden>
          <span>⛺</span>
        </div>
        <h2 id="camp-title">{t.campConfirmTitle}</h2>
        <ul className="camp__effects">
          {effects.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="evolve__warning" role="note">
          {t.campConfirmWarning}
        </p>
        <div className="overlay__actions">
          <button type="button" className="btn" autoFocus onClick={onCancel}>
            {t.campCancel}
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            {t.campConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

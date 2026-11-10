import type { ReactNode } from 'react';
import type { CardView } from '@core/api';
import type { PreviewView } from '../client/index.ts';
import { t } from '../i18n/index.ts';

interface Props {
  card: CardView;
  preview: PreviewView | null;
  /** Zone, die das Sheet zeigt – bei ihren Wertänderungen entfällt der Zonenname. */
  shownZone: string | null;
  /** Zusatz unter dem Kartentext, z. B. die Artauswahl. */
  children?: ReactNode;
}

/**
 * Vorschau eines Kartenzugs vor dem Bestätigen: voller Kartentext, ausgelöste Schwellen, Formwechsel,
 * Wertänderungen. Die Knöpfe (`PlayActions`) stehen getrennt in der festen Fußleiste des Sheets.
 */
export function PlayPreview({ card, preview, shownZone, children }: Props) {
  return (
    <div className="play-preview">
      <div className="play-preview__card">
        <b>{card.name}</b>
        <span className="muted">{card.cost === 0 ? t.free : `✦${card.cost}`}</span>
      </div>
      <p className="play-preview__text">{card.text}</p>
      {children}
      {preview && <PreviewList preview={preview} shownZone={shownZone} />}
    </div>
  );
}

/** „Abbrechen“ / „Spielen“ – in der Daumenzone, außerhalb des scrollenden Inhalts. */
export function PlayActions({
  card,
  preview,
  onPlay,
  onCancel,
}: {
  card: CardView;
  preview: PreviewView | null;
  onPlay: () => void;
  onCancel: () => void;
}) {
  const affordable = preview?.affordable ?? card.playable;
  return (
    <div className="play-actions">
      <button type="button" className="btn" onClick={onCancel}>
        {t.cancel}
      </button>
      <button type="button" className="btn btn--primary" disabled={!affordable} onClick={onPlay}>
        {affordable ? t.play : t.notAffordable}
      </button>
    </div>
  );
}

/** Liste der erwarteten Wirkungen: Schwellen, Formwechsel, Wertänderungen. */
export function PreviewList({ preview, shownZone }: { preview: PreviewView; shownZone: string | null }) {
  const nothing =
    preview.changes.length === 0 &&
    preview.triggers.length === 0 &&
    preview.formChanges.length === 0 &&
    preview.populationChanges.length === 0 &&
    preview.eventChanges.length === 0;
  return (
    <ul className="play-preview__list" aria-label={t.previewTitle}>
      {preview.triggers.map((x) => (
        <li key={`t-${x.zone}-${x.name}`} className="is-bad">
          <span aria-hidden>{x.icon}</span> <b>{x.name}</b> – {t.previewTrigger(x.zoneName)}
        </li>
      ))}
      {preview.formChanges.map((f) => (
        <li key={`f-${f.zone}`} className={f.kind === 'ideal' ? 'is-good' : f.kind === 'normal' ? '' : 'is-bad'}>
          {t.previewForm(f.zoneName, f.from, f.to)}
        </li>
      ))}
      {preview.changes.map((c) => (
        <li key={`c-${c.zone}-${c.stat}`}>
          {c.zone === shownZone ? '' : `${c.zoneName} · `}
          {c.statName} {c.from} → <b>{c.to}</b>
        </li>
      ))}
      {preview.populationChanges.map((p) => (
        <li key={`p-${p.zone}-${p.species}`} className={p.to < p.from ? 'is-bad' : 'is-good'}>
          {t.previewPopulation(p.zoneName, p.speciesName, p.from, p.to)}
        </li>
      ))}
      {preview.eventChanges.map((e, i) => (
        <li key={`e-${i}`} className="is-good">
          {t.previewEvent(e.change, e.name, e.round)}
        </li>
      ))}
      {nothing && <li className="muted">{t.previewNone}</li>}
    </ul>
  );
}

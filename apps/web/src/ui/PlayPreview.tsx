import type { ReactNode } from 'react';
import type { CardView } from '@core/api';
import type { PreviewView } from '../client/index.ts';
import { t } from '../i18n/index.ts';

interface Props {
  card: CardView;
  preview: PreviewView | null;
  /** Zone, die das Sheet zeigt – bei ihren Wertänderungen entfällt der Zonenname. */
  shownZone: string | null;
  onPlay: () => void;
  onCancel: () => void;
  /** Zusatz unter dem Kartentext, z. B. die Artauswahl. */
  children?: ReactNode;
}

/** Vorschau eines Kartenzugs vor dem Bestätigen: ausgelöste Schwellen, Formwechsel, Wertänderungen. */
export function PlayPreview({ card, preview, shownZone, onPlay, onCancel, children }: Props) {
  const affordable = preview?.affordable ?? card.playable;
  return (
    <div className="play-preview">
      <div className="play-preview__card">
        <b>{card.name}</b>
        <span className="muted">{card.cost === 0 ? t.free : `✦${card.cost}`}</span>
      </div>
      <small className="muted">{card.text}</small>
      {children}
      {preview && <PreviewList preview={preview} shownZone={shownZone} />}
      <div className="play-preview__actions">
        <button type="button" className="btn" onClick={onCancel}>
          {t.cancel}
        </button>
        <button type="button" className="btn btn--primary" disabled={!affordable} onClick={onPlay}>
          {affordable ? t.play : t.notAffordable}
        </button>
      </div>
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

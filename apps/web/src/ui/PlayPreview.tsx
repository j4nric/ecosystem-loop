import type { CardView } from '@core/api';
import type { PreviewView } from '../client/index.ts';
import { t } from '../i18n/index.ts';

interface Props {
  card: CardView;
  preview: PreviewView | null;
  /** Zone, die das Sheet zeigt – deren Wertänderungen stehen schon an den Balken. */
  shownZone: string | null;
  onPlay: () => void;
  onCancel: () => void;
}

/** Vorschau eines Kartenzugs vor dem Bestätigen: ausgelöste Schwellen, Formwechsel, Wertänderungen anderswo. */
export function PlayPreview({ card, preview, shownZone, onPlay, onCancel }: Props) {
  const elsewhere = preview?.changes.filter((c) => c.zone !== shownZone) ?? [];
  const nothing =
    preview !== null && preview.changes.length === 0 && preview.triggers.length === 0 && preview.formChanges.length === 0;
  const affordable = preview?.affordable ?? card.playable;
  return (
    <div className="play-preview">
      <div className="play-preview__card">
        <b>{card.name}</b>
        <span className="muted">{card.cost === 0 ? t.free : `✦${card.cost}`}</span>
      </div>
      <small className="muted">{card.text}</small>
      {preview && (
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
          {elsewhere.map((c) => (
            <li key={`c-${c.zone}-${c.stat}`}>
              {c.zoneName} · {c.statName} {c.from} → <b>{c.to}</b>
            </li>
          ))}
          {nothing && <li className="muted">{t.previewNone}</li>}
        </ul>
      )}
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

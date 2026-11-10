import type { ReactNode } from 'react';
import type { CardView } from '@core/api';
import type { PreviewView } from '../client/index.ts';
import { t } from '../i18n/index.ts';
import {
  isWorldCard,
  towardFromDistance,
  worldBalance,
  zoneEffects,
  type Toward,
  type ZoneEffect,
} from '../logic/ideal.ts';

/** Symbol zur Richtung (Farbe allein reicht nicht). */
export const TOWARD_ARROW: Record<Toward, string> = { better: '▲', worse: '▼', neutral: '=' };

interface Props {
  card: CardView;
  preview: PreviewView | null;
  /** Zone, die das Sheet zeigt – bei ihren Wertänderungen entfällt der Zonenname. */
  shownZone: string | null;
  /** Zusatz unter dem Kartentext, z. B. die Artauswahl. */
  children?: ReactNode;
  /** Weltkarte: Wirkung je betroffener Zone (aus `zoneEffects`). */
  effects?: readonly ZoneEffect[];
}

/**
 * Vorschau eines Kartenzugs vor dem Bestätigen: voller Kartentext, ausgelöste Schwellen, Formwechsel,
 * Wertänderungen. Die Knöpfe (`PlayActions`) stehen getrennt in der festen Fußleiste des Sheets.
 */
export function PlayPreview({ card, preview, shownZone, children, effects }: Props) {
  const world = isWorldCard(card);
  return (
    <div className={`play-preview${world ? ' play-preview--world' : ''}`}>
      <div className="play-preview__card">
        <b>
          {world && <span aria-hidden>🌍 </span>}
          {card.name}
          {world && <small className="play-preview__world"> · {t.worldShort}</small>}
        </b>
        <span className="muted">{card.cost === 0 ? t.free : `✦${card.cost}`}</span>
      </div>
      {!world && <p className="play-preview__text">{card.text}</p>}
      {children}
      {preview &&
        (world ? (
          <WorldPreviewList preview={preview} effects={effects ?? zoneEffects(preview)} />
        ) : (
          <PreviewList preview={preview} shownZone={shownZone} />
        ))}
      {/* Weltkarte: die Wirkung je Zone steht oben, der volle Kartentext (Bedingungen) darunter. */}
      {world && <p className="play-preview__text">{card.text}</p>}
    </div>
  );
}

/**
 * Wirkung einer Weltkarte: Bilanzzeile (Anzahl Zonen näher/weiter weg/gleich – keine Gesamtpunktzahl, keine
 * Empfehlung), dann je Zone Abstand zur Idealform vorher → nachher mit Wertänderungen, Schwellen, Formwechseln.
 */
export function WorldPreviewList({
  preview,
  effects,
  compact = false,
}: {
  preview: PreviewView;
  effects: readonly ZoneEffect[];
  /** Kurzfassung beim Ziehen: nur Zone, Richtung und Abstand. */
  compact?: boolean;
}) {
  return (
    <div className="world-preview">
      <p className="world-preview__balance" role="status">
        {effects.length > 0 ? t.worldBalance(worldBalance(effects)) : t.worldNone}
      </p>
      <ul className={`world-preview__zones${compact ? ' is-compact' : ''}`} aria-label={t.worldEffectsTitle}>
        {effects.map((e) => (
          <li key={e.zone} className={`world-zone is-${e.toward}`}>
            <b className="world-zone__name">
              {e.zoneName} <span aria-hidden>{TOWARD_ARROW[e.toward]}</span>
            </b>
            <span className="world-zone__dist">
              {e.distance ? t.worldDistance(e.distance.before, e.distance.after) : t.towardShort[e.toward]}
            </span>
            {!compact && (
              <ul className="world-zone__list">
                {e.triggers.map((x) => (
                  <li key={`t-${x.name}`} className="is-bad">
                    <span aria-hidden>{x.icon}</span> <b>{x.name}</b>
                  </li>
                ))}
                {e.formChanges.map((f) => (
                  <li
                    key={`f-${f.to}`}
                    className={f.kind === 'ideal' ? 'is-good' : f.kind === 'normal' ? '' : 'is-bad'}
                  >
                    {f.from} → <b>{f.to}</b>
                  </li>
                ))}
                {e.changes.map((c) => {
                  const toward = c.toward ?? 'neutral';
                  return (
                    <li key={`c-${c.stat}`} className={toward === 'neutral' ? '' : `is-${toward}`}>
                      <span aria-hidden>{c.to > c.from ? '↑' : '↓'}</span> {c.statName} {c.from} → <b>{c.to}</b>
                    </li>
                  );
                })}
                {e.populationChanges.map((p) => (
                  <li key={`p-${p.species}`} className={p.to < p.from ? 'is-bad' : 'is-good'}>
                    {p.speciesName} {p.from} → <b>{p.to}</b>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {!compact && preview.eventChanges.length > 0 && (
        <ul className="play-preview__list">
          {preview.eventChanges.map((e, i) => (
            <li key={`e-${i}`} className="is-good">
              {t.previewEvent(e.change, e.name, e.round)}
            </li>
          ))}
        </ul>
      )}
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
        {affordable ? (isWorldCard(card) ? t.playWorld : t.play) : t.notAffordable}
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
      {(preview.idealDistance ?? [])
        .filter((d) => d.before !== d.after)
        .map((d) => {
          const toward = towardFromDistance(d.before, d.after);
          const name = preview.changes.find((c) => c.zone === d.zone)?.zoneName ?? d.zone;
          return (
            <li key={`i-${d.zone}`} className={`is-${toward} play-preview__ideal`}>
              <span aria-hidden>{TOWARD_ARROW[toward]}</span> {t.previewIdeal(name, d.before, d.after)}
            </li>
          );
        })}
      {preview.changes.map((c) => {
        const toward = c.toward ?? 'neutral';
        return (
          <li key={`c-${c.zone}-${c.stat}`} className={toward === 'neutral' ? '' : `is-${toward}`}>
            <span aria-hidden>{c.to > c.from ? '↑' : '↓'}</span> {c.zone === shownZone ? '' : `${c.zoneName} · `}
            {c.statName} {c.from} → <b>{c.to}</b>
            {toward !== 'neutral' && <small className="play-preview__toward"> · {t.toward[toward]}</small>}
          </li>
        );
      })}
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

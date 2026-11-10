import type { ZoneView } from '@core/api';
import type { PreviewView } from '../client/index.ts';
import { t } from '../i18n/index.ts';
import type { DragState } from '../state/useCardDrag.ts';
import type { ZoneEffect } from '../logic/ideal.ts';
import { PreviewList, WorldPreviewList } from './PlayPreview.tsx';

interface Props {
  drag: DragState;
  zones: ZoneView[];
  /** Vorschau für die Zone unter dem Finger (nur bei Karten mit einem einzigen Slot). */
  preview: PreviewView | null;
  /** Weltkarte: Wirkung je betroffener Zone (alle zugleich). */
  effects: readonly ZoneEffect[];
  ghostRef: (el: HTMLDivElement | null) => void;
}

/** Während des Ziehens: Geisterkarte am Finger und unten eine Vorschau der Zone unter dem Finger. */
export function DragOverlay({ drag, zones, preview, effects, ghostRef }: Props) {
  const zone = zones.find((z) => z.id === drag.zone);
  const valid = drag.world ? drag.armed : zone !== undefined && drag.valid.has(zone.id);
  const card = drag.card;
  const ghost = (
    <div
      ref={ghostRef}
      className={`drag-ghost card card--${card.category}${drag.world ? ' card--world' : ''}${valid ? ' is-valid' : ''}`}
      aria-hidden
    >
      <span className="card__cost">{card.cost === 0 ? t.free : `✦${card.cost}`}</span>
      <span className="card__name">
        {drag.world && '🌍 '}
        {card.name}
      </span>
    </div>
  );
  if (drag.world)
    return (
      <>
        {ghost}
        <section className="drag-panel drag-panel--world" role="status" aria-live="polite">
          <p className={`drag-panel__hint${drag.armed ? ' is-armed' : ''}`}>
            {drag.armed ? t.worldDragArmed : t.worldDragHint}
          </p>
          {preview ? (
            <WorldPreviewList preview={preview} effects={effects} compact />
          ) : (
            card.slots.length > 0 && <p className="muted">{t.worldDragChoice}</p>
          )}
          {drag.armed && <p className="drag-panel__sub muted">{t.worldDragCancel}</p>}
        </section>
      </>
    );
  return (
    <>
      {ghost}
      <section className="drag-panel" role="status" aria-live="polite">
        {!zone && <p className="drag-panel__hint">{t.dragHint}</p>}
        {zone && !valid && <p className="drag-panel__hint is-bad">{t.dragInvalid(zone.geographyName)}</p>}
        {zone && valid && (
          <>
            <header className="drag-panel__head">
              <b>{zone.geographyName}</b>
              <span className={`kind kind--${zone.form.kind}`}>{t.formKind[zone.form.kind]}</span>
              <span className="muted">{zone.form.name}</span>
              {zone.ideal && (
                <span className="drag-panel__goal">
                  {t.idealGoal(zone.ideal.name)} ·{' '}
                  {zone.ideal.distance <= 0 ? `✓ ${t.idealReached}` : t.idealSteps(zone.ideal.distance)}
                </span>
              )}
            </header>
            {preview ? (
              <PreviewList preview={preview} shownZone={zone.id} />
            ) : (
              <p className="muted">{t.dragMoreTargets}</p>
            )}
          </>
        )}
      </section>
    </>
  );
}

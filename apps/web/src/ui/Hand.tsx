import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CardView } from '@core/api';
import { t } from '../i18n/index.ts';

export interface CardPointerHandlers {
  onPointerDown: (card: CardView, e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  /** true, wenn der folgende Klick zu einem Ziehen gehörte. */
  consumeClick: () => boolean;
}

interface Props {
  cards: CardView[];
  activeUid: number | null;
  draggingUid: number | null;
  onCardTap: (card: CardView) => void;
  pointer: CardPointerHandlers;
}

/**
 * Kartenleiste am unteren Rand: Name, Kosten, Kurztext (`short`). Antippen oder auf die Insel ziehen; langer Druck
 * zeigt den vollen Text. Der volle Text steht auch im Screenreader-Label.
 */
export function Hand({ cards, activeUid, draggingUid, onCardTap, pointer }: Props) {
  return (
    <div className="hand" role="list">
      {cards.map((card) => {
        const active = card.uid === activeUid;
        const dragging = card.uid === draggingUid;
        return (
          <button
            key={card.uid}
            data-uid={card.uid}
            type="button"
            role="listitem"
            className={`card card--${card.category}${card.playable ? '' : ' is-disabled'}${active ? ' is-active' : ''}${dragging ? ' is-dragging' : ''}`}
            aria-disabled={!card.playable}
            aria-pressed={active}
            aria-label={`${t.dragCardLabel(card.name)}. ${t.cost} ${card.cost}. ${card.text}${card.playable ? '' : `. ${t.notPlayable}`}`}
            onPointerDown={(e) => pointer.onPointerDown(card, e)}
            onPointerMove={pointer.onPointerMove}
            onPointerUp={pointer.onPointerUp}
            onPointerCancel={pointer.onPointerCancel}
            onClick={() => {
              if (!pointer.consumeClick()) onCardTap(card);
            }}
          >
            <span className="card__cost" aria-hidden>
              {card.cost === 0 ? t.free : `✦${card.cost}`}
            </span>
            <span className="card__name">{card.name}</span>
            <span className="card__text">{card.short ?? card.text}</span>
          </button>
        );
      })}
    </div>
  );
}

import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CardView } from '@core/api';
import { t } from '../i18n/index.ts';
import { isWorldCard } from '../logic/ideal.ts';

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
 * zeigt den vollen Text. Der volle Text steht auch im Screenreader-Label. Weltkarten (Wetter) tragen 🌍, einen
 * eigenen Rahmen und den Hinweis „wirkt überall“.
 */
export function Hand({ cards, activeUid, draggingUid, onCardTap, pointer }: Props) {
  return (
    <div className="hand" role="list">
      {cards.map((card) => {
        const active = card.uid === activeUid;
        const dragging = card.uid === draggingUid;
        const world = isWorldCard(card);
        const label = world ? t.worldCardLabel(card.name) : t.dragCardLabel(card.name);
        return (
          <button
            key={card.uid}
            data-uid={card.uid}
            type="button"
            role="listitem"
            className={`card card--${card.category}${world ? ' card--world' : ''}${card.playable ? '' : ' is-disabled'}${active ? ' is-active' : ''}${dragging ? ' is-dragging' : ''}`}
            aria-disabled={!card.playable}
            aria-pressed={active}
            aria-label={`${label}. ${t.cost} ${card.cost}. ${card.text}${card.playable ? '' : `. ${t.notPlayable}`}`}
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
            {world && (
              <span className="card__globe" aria-hidden>
                🌍
              </span>
            )}
            <span className="card__text">{card.short ?? card.text}</span>
            {world && (
              <span className="card__reach" aria-hidden>
                {t.worldShort}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

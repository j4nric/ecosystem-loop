import type { CardView } from '@core/api';
import { t } from '../i18n/index.ts';

interface Props {
  cards: CardView[];
  activeUid: number | null;
  onCardTap: (card: CardView) => void;
}

/** Kartenleiste am unteren Rand: Name, Kosten, Kurztext. Nicht spielbare Karten sind gedimmt. */
export function Hand({ cards, activeUid, onCardTap }: Props) {
  return (
    <div className="hand" role="list">
      {cards.map((card) => {
        const active = card.uid === activeUid;
        return (
          <button
            key={card.uid}
            type="button"
            role="listitem"
            className={`card card--${card.category}${card.playable ? '' : ' is-disabled'}${active ? ' is-active' : ''}`}
            aria-disabled={!card.playable}
            aria-pressed={active}
            aria-label={`${card.name}, ${t.cost} ${card.cost}. ${card.text}${card.playable ? '' : `. ${t.notPlayable}`}`}
            onClick={() => onCardTap(card)}
          >
            <span className="card__cost" aria-hidden>
              {card.cost === 0 ? t.free : `✦${card.cost}`}
            </span>
            <span className="card__name">{card.name}</span>
            <span className="card__text">{card.text}</span>
          </button>
        );
      })}
    </div>
  );
}

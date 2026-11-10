import type { CardView } from '@core/api';
import { t } from '../i18n/index.ts';
import { isWorldCard } from '../logic/ideal.ts';
import { useEscape } from './useEscape.ts';

interface Props {
  card: CardView;
  onClose: () => void;
  /** Zielwahl beginnen (nur bei spielbaren Karten angeboten). */
  onPlay: () => void;
}

/** Kartendetails im Dock (langer Druck bzw. Antippen einer nicht spielbaren Karte): voller Kartentext. */
export function CardDetail({ card, onClose, onPlay }: Props) {
  useEscape(onClose);
  const world = isWorldCard(card);
  return (
    <section
      className={`sheet card-detail card--${card.category}${world ? ' card--world' : ''}`}
      role="dialog"
      aria-label={t.cardDetails}
    >
      <div className="sheet__body">
        <header className="sheet__head">
          <div>
            <h2>
              {world && <span aria-hidden>🌍 </span>}
              {card.name}
            </h2>
            <p className="card-detail__cost">{card.cost === 0 ? t.free : `✦ ${t.cost} ${card.cost}`}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} autoFocus>
            ✕
          </button>
        </header>
        {world && <p className="play-preview__world">{t.worldHint}</p>}
        <p className="card-detail__text">{card.text}</p>
        {!card.playable && <p className="muted">{t.notPlayable}</p>}
      </div>
      {card.playable && (
        <div className="sheet__footer">
          <div className="play-actions">
            <button type="button" className="btn" onClick={onClose}>
              {t.close}
            </button>
            <button type="button" className="btn btn--primary" onClick={onPlay}>
              {t.play}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

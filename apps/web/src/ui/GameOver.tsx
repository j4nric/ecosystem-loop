import type { HerdeData, HerdeView } from '@being-god/herde';
import { t } from '../i18n/index.ts';

/** Ende-Bildschirm: Sieg (Eiszeit überstanden) oder Niederlage (Herde ausgestorben). */
export function GameOver({
  data,
  view,
  onNewGame,
  onViewIsland,
}: {
  data: HerdeData;
  view: HerdeView;
  onNewGame: () => void;
  onViewIsland: () => void;
}) {
  const won = view.over === 'won';
  const year = data.months.length;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className={`overlay__panel game-over game-over--${won ? 'won' : 'lost'}`}>
        <div className="game-over__icon" aria-hidden>
          {won ? '🌅' : '🕯'}
        </div>
        <h2 id="game-over-title">{won ? t.wonTitle : t.lostTitle}</h2>
        <p>{won ? t.wonText(view.herd.size) : t.lostText}</p>
        <dl className="summary">
          <div>
            <dt>{t.survivors}</dt>
            <dd>{view.herd.size}</dd>
          </div>
          <div>
            <dt>{t.duration}</dt>
            <dd>{t.durationValue(Math.floor(view.month / year), view.month % year)}</dd>
          </div>
          <div>
            <dt>{t.wildReached}</dt>
            <dd>{Math.floor(view.wild.value)}</dd>
          </div>
        </dl>
        <div className="overlay__actions">
          <button type="button" className="btn" onClick={onViewIsland}>
            {t.viewIsland}
          </button>
          <button type="button" className="btn btn--primary" autoFocus onClick={onNewGame}>
            {t.newGame}
          </button>
        </div>
      </div>
    </div>
  );
}

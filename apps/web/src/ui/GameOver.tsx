import type { GameView } from '@core/api';
import { t } from '../i18n/index.ts';

/** Spiel-Ende-Bildschirm bei Kollaps (phase === 'over'). */
export function GameOver({ view, onNewGame }: { view: GameView; onNewGame: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="overlay__panel">
        <h2 id="game-over-title">{t.gameOverTitle}</h2>
        <p>{t.gameOverText}</p>
        <dl className="summary">
          <div>
            <dt>{t.score}</dt>
            <dd>{view.score}</dd>
          </div>
          <div>
            <dt>{t.roundsSurvived}</dt>
            <dd>{view.round}</dd>
          </div>
          <div>
            <dt>{t.highestTier}</dt>
            <dd>{view.highestTier}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn--primary" onClick={onNewGame}>
          {t.newGame}
        </button>
      </div>
    </div>
  );
}

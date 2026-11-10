import type { GameView } from '@core/api';
import type { GameResult } from '../client/index.ts';
import { t } from '../i18n/index.ts';

interface Props {
  view: GameView;
  /** Eintrag ins Schöpfungsbuch (null, wenn die Partie schon vor dieser Sitzung endete). */
  result: GameResult | null;
  onNewGame: () => void;
  onBook: () => void;
}

/** Spiel-Ende-Bildschirm bei Kollaps (phase === 'over') mit dem, was die Partie ins Schöpfungsbuch brachte. */
export function GameOver({ view, result, onNewGame, onBook }: Props) {
  const lines: [string, string[]][] = result
    ? [
        [t.resultRecords, result.records.map((r) => t.recordName[r])],
        [t.resultDiscovered, result.discovered],
        [t.resultMilestones, result.milestones],
        [t.resultUnlocked, result.unlocked],
      ]
    : [];
  const news = lines.filter(([, items]) => items.length > 0);
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
        {news.length > 0 && (
          <dl className="result">
            {news.map(([title, items]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="overlay__actions">
          <button type="button" className="btn" onClick={onBook}>
            {t.book}
          </button>
          <button type="button" className="btn btn--primary" onClick={onNewGame}>
            {t.newGame}
          </button>
        </div>
      </div>
    </div>
  );
}

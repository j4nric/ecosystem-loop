import type { BookView } from '../client/index.ts';
import { t } from '../i18n/index.ts';

/** Schöpfungsbuch: entdeckte Arten mit Stufe, Meilensteine, Bestwerte und Summen über alle Partien. */
export function Book({ book, onClose }: { book: BookView; onClose: () => void }) {
  return (
    <div
      className="overlay overlay--top"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-title"
      onClick={onClose}
    >
      <div className="overlay__panel help book" onClick={(e) => e.stopPropagation()}>
        <header className="help__head">
          <div>
            <h2 id="book-title">{t.book}</h2>
            <p className="muted">{t.bookGames(book.games)}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>
        <div className="help__body">
          <h3>{t.bookBest}</h3>
          <dl className="summary">
            <div>
              <dt>{t.score}</dt>
              <dd>{book.best.score}</dd>
            </div>
            <div>
              <dt>{t.roundsSurvived}</dt>
              <dd>{book.best.rounds}</dd>
            </div>
            <div>
              <dt>{t.highestTier}</dt>
              <dd>{book.best.tier}</dd>
            </div>
          </dl>

          <h3>{t.bookSpecies(book.species.length, book.speciesTotal)}</h3>
          {book.species.length === 0 ? (
            <p className="muted">{t.bookNoSpecies}</p>
          ) : (
            <ul className="pops">
              {book.species.map((s) => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <span className="muted">{t.bookFirstGame(s.firstGame)}</span>
                  <b>{t.tier(s.tier)}</b>
                </li>
              ))}
            </ul>
          )}

          <h3>{t.bookMilestones}</h3>
          <ul className="milestones">
            {book.milestones.map((m) => (
              <li key={m.id} className={m.reached ? 'is-reached' : ''}>
                <span aria-hidden>{m.reached ? '✔' : '○'}</span>
                <div>
                  <b>{m.name}</b>
                  <small>{m.description}</small>
                </div>
              </li>
            ))}
          </ul>

          <h3>{t.bookTotals}</h3>
          <dl className="summary">
            <div>
              <dt>{t.bookTotalRounds}</dt>
              <dd>{book.totals.rounds}</dd>
            </div>
            <div>
              <dt>{t.bookTotalExtinctions}</dt>
              <dd>{book.totals.extinctions}</dd>
            </div>
            <div>
              <dt>{t.bookTotalEvents}</dt>
              <dd>{book.totals.events}</dd>
            </div>
          </dl>
        </div>
        <footer className="help__actions help__actions--single">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t.close}
          </button>
        </footer>
      </div>
    </div>
  );
}

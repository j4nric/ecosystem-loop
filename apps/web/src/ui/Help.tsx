import type { HerdeData } from '@being-god/herde';
import { locale, t } from '../i18n/index.ts';
import { textOf } from '../logic/format.ts';
import { landStyle } from '../scene/palette.ts';
import { useEscape } from './useEscape.ts';

/** Hilfe: Ziel, Herde, Karten (aus den Daten), lebende Welt, Landschaften mit Farbe; Einführung erneut zeigen. */
export function Help({ data, onClose, onTutorial }: { data: HerdeData; onClose: () => void; onTutorial: () => void }) {
  useEscape(onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={onClose}>
      <div className="overlay__panel help" onClick={(e) => e.stopPropagation()}>
        <header className="help__head">
          <h2 id="help-title">{t.helpTitle}</h2>
          <button type="button" className="icon-btn icon-btn--flat" onClick={onClose} aria-label={t.close} autoFocus>
            ✕
          </button>
        </header>
        <div className="help__body">
          <h3>{t.helpGoal}</h3>
          <p>{t.helpGoalText}</p>
          <h3>{t.helpHerd}</h3>
          <p>{t.helpHerdText}</p>
          <h3>{t.helpCards}</h3>
          <p>{t.helpCardsText}</p>
          <dl className="help__list">
            {[...data.cards.values()].map((card) => (
              <div key={card.id}>
                <dt aria-hidden>{card.icon}</dt>
                <dd>
                  <b>{textOf(card.name, locale)}</b> – {textOf(card.text, locale)} ({t.wildCost(card.wild)})
                </dd>
              </div>
            ))}
          </dl>
          <h3>{t.helpWorld}</h3>
          <p>{t.helpWorldText}</p>
          <h3>{t.helpLands}</h3>
          <ul className="legend">
            {[...data.landscapes.values()].map((l) => (
              <li key={l.id}>
                <i style={{ background: landStyle(l.id, l).color }} aria-hidden />
                {textOf(l.name, locale)}
              </li>
            ))}
          </ul>
          <h3>{t.helpControls}</h3>
          <p>{t.helpControlsText}</p>
        </div>
        <footer className="help__actions">
          <button type="button" className="btn" onClick={onTutorial}>
            {t.showTutorial}
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t.close}
          </button>
        </footer>
      </div>
    </div>
  );
}

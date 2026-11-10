import type { FormKind } from '@core/api';
import { t } from '../i18n/index.ts';
import { useEscape } from './useEscape.ts';
import { GROUP_COLORS, SPECIES_GROUPS } from '../scene/palette.ts';

const KINDS: FormKind[] = ['ideal', 'normal', 'degraded', 'disturbance'];

/** Hilfe-Ansicht: Zielbereiche der Idealform, Formen-Arten, Symbole und Figuren der Insel; von hier aus die Einführung erneut zeigen. */
export function Help({ onClose, onTutorial }: { onClose: () => void; onTutorial: () => void }) {
  useEscape(onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={onClose}>
      <div className="overlay__panel help" onClick={(e) => e.stopPropagation()}>
        <header className="help__head">
          <h2 id="help-title">{t.helpTitle}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} autoFocus>
            ✕
          </button>
        </header>
        <div className="help__body">
          <h3>{t.helpIdeal}</h3>
          <p>{t.helpIdealText}</p>
          <div className="help__bar" aria-hidden>
            <span className="stat__bar">
              <i className="on" />
              <i className="on" />
              <i className="on t t-start t-end" />
              <i />
              <i />
            </span>
            <span className="stat__target is-ok">
              <b>✓ {t.targetStatus.ok}</b>
            </span>
          </div>
          <p>{t.helpIdealTools}</p>
          <p>{t.helpIdealTint}</p>

          <h3>{t.helpForms}</h3>
          <dl className="help__list">
            {KINDS.map((k) => (
              <div key={k}>
                <dt>
                  <span className={`kind kind--${k}`}>{t.formKind[k]}</span>
                </dt>
                <dd>{t.helpFormText[k]}</dd>
              </div>
            ))}
          </dl>

          <h3>{t.helpSymbols}</h3>
          <dl className="help__list help__list--symbols">
            {t.helpSymbolList.map(([symbol, text]) => (
              <div key={symbol}>
                <dt aria-hidden>{symbol}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>

          <h3>{t.helpCreatures}</h3>
          <p className="muted">{t.helpCreaturesText}</p>
          <ul className="legend">
            {SPECIES_GROUPS.map((g) => (
              <li key={g}>
                <i style={{ background: GROUP_COLORS[g] }} aria-hidden />
                {t.groups[g]}
              </li>
            ))}
          </ul>
          <p className="muted">{t.helpFog}</p>
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

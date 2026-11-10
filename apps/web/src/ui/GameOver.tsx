import type { HerdeData, HerdeView } from '@being-god/herde';
import { locale, t } from '../i18n/index.ts';
import { stageName, traitName } from '../logic/format.ts';
import { endSummary } from '../logic/hunt.ts';
import { stageLook } from '../scene/palette.ts';

const ICON = { won: '🌅', extinct: '🕯', lastIce: '❄️' } as const;

/**
 * Ende-Bildschirm: Sieg (als Mensch mit Lager die letzte Eiszeit überstanden), ausgestorben oder die letzte Eiszeit
 * überstanden, aber nicht als Mensch mit Lager. Dazu eine kleine Bilanz.
 */
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
  const end = endSummary(data, view);
  if (!end) return null;
  const stage = stageName(data, locale, end.stage);
  const title = end.kind === 'won' ? t.wonTitle : end.kind === 'lastIce' ? t.lostIceTitle : t.lostTitle;
  const text =
    end.kind === 'won'
      ? t.wonText(end.survivors)
      : end.kind === 'lastIce'
        ? t.lostIceText(end.lastStage, stage)
        : t.lostText;
  const icons = end.traits.map((id) => data.traits.get(id)?.icon ?? '✨').join('');
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className={`overlay__panel game-over game-over--${end.kind === 'won' ? 'won' : 'lost'}`}>
        <div className="game-over__icon" aria-hidden>
          {ICON[end.kind]}
        </div>
        <h2 id="game-over-title">{title}</h2>
        <p>{text}</p>
        <dl className="summary summary--end">
          <div>
            <dt>{t.survivors}</dt>
            <dd>{end.survivors}</dd>
          </div>
          <div>
            <dt>{t.duration}</dt>
            <dd>{t.durationValue(end.years, end.months)}</dd>
          </div>
          <div>
            <dt>{t.iceAgesLabel}</dt>
            <dd>{t.iceAgesValue(end.iceAges.survived, end.iceAges.max)}</dd>
          </div>
          <div className="summary__wide">
            <dt>{t.stageReached}</dt>
            <dd>
              <span aria-hidden>{stageLook(end.stage).icon}</span> {stage}
            </dd>
          </div>
          <div
            className="summary__wide"
            aria-label={`${t.traitsCount}: ${end.traits.map((id) => traitName(data, locale, id)).join(', ')}`}
          >
            <dt>{t.traitsCount}</dt>
            <dd>
              {end.traits.length}
              {icons && (
                <small className="summary__icons" aria-hidden>
                  {' '}
                  {icons}
                </small>
              )}
            </dd>
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

import type { HerdeData } from '@being-god/herde';
import { locale, t } from '../i18n/index.ts';
import { landName, ruleNumbers, textOf, traitName, type StageRules } from '../logic/format.ts';
import { huntRules } from '../logic/hunt.ts';
import { landStyle, stageLook } from '../scene/palette.ts';
import { useEscape } from './useEscape.ts';

/**
 * Hilfe: Ziel, Herde (Schritte, Umkreis, Wasser- und Schutzzeiten der aktuellen Stufe), Karten (aus den Daten),
 * Entwicklung mit Merkmalen und Stufen (aus den Daten), lebende Welt, Wild und Jagd, Feuer als Werkzeug, Lager,
 * Eiszeiten und Sieg (Zahlen aus den Daten), Landschaften mit Farbe; Einführung erneut zeigen.
 */
export function Help({
  data,
  stage,
  onClose,
  onTutorial,
}: {
  data: HerdeData;
  stage: StageRules;
  onClose: () => void;
  onTutorial: () => void;
}) {
  useEscape(onClose);
  const rules = ruleNumbers(data, locale, stage);
  const hunt = huntRules(data, locale);
  const lands = (ids: readonly string[]) => ids.map((id) => landName(data, locale, id)).join(', ');
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
          <p>{t.helpGoalText(rules)}</p>
          <h3>{t.helpHerd}</h3>
          <p>{t.helpHerdText(rules)}</p>
          <h3>{t.helpCards}</h3>
          <p>{t.helpCardsText(rules)}</p>
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
          <h3>{t.helpEvolution}</h3>
          <p>{t.helpEvolutionText}</p>
          <h4>{t.helpStages}</h4>
          <dl className="help__list">
            {[...data.stages.values()].map((s) => (
              <div key={s.id}>
                <dt aria-hidden>{stageLook(s.id).icon}</dt>
                <dd>
                  <b>{textOf(s.name, locale, s.id)}</b> – {t.needFood}: {lands(s.eats)}. {t.needWater}: {lands(s.water)}
                  . {t.needShelter}: {lands(s.shelter)}.
                  {s.blocked.length > 0 && ` ${t.needBlocked}: ${lands(s.blocked)}.`}
                  {s.preyFood > 0 && ` ${t.needPrey}: ${t.needPreyText(s.preyFood, s.huntKill, s.fireHunt)}.`}
                  {` ${t.needWolves}: ${s.wolves === 'rival' ? t.wolvesRival : t.wolvesEnemy}.`}
                  {s.mature &&
                    ` ${t.helpStageMature(
                      s.mature.traits,
                      (s.mature.oneOf ?? []).map((id) => traitName(data, locale, id)),
                    )}`}
                </dd>
              </div>
            ))}
          </dl>
          <h4>{t.helpTraits}</h4>
          <dl className="help__list">
            {[...data.traits.values()].map((trait) => (
              <div key={trait.id}>
                <dt aria-hidden>{trait.icon}</dt>
                <dd>
                  <b>{textOf(trait.name, locale, trait.id)}</b> – {textOf(trait.text, locale)} (
                  {t.helpTraitFrom(textOf(data.experiences.get(trait.from)?.name, locale, trait.from), trait.at)})
                </dd>
              </div>
            ))}
          </dl>
          <h3>{t.helpWorld}</h3>
          <p>{t.helpWorldText}</p>
          <h3>{t.helpPrey}</h3>
          <p>{t.helpPreyText(hunt)}</p>
          <h3>{t.helpFire}</h3>
          <p>{t.helpFireText(hunt)}</p>
          <h3>{t.helpCamp}</h3>
          <p>{t.helpCampText(hunt)}</p>
          <h3>{t.helpIce}</h3>
          <p>{t.helpIceText(rules)}</p>
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

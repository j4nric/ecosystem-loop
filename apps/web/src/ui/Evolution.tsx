import { useEffect, useState } from 'react';
import type { HerdeData, HerdeView, StageNeedsView } from '@being-god/herde';
import { locale, t } from '../i18n/index.ts';
import {
  countedText,
  evolutionBadge,
  experienceRows,
  missingOnIsland,
  missingText,
  needRows,
  ownedTraits,
  traitInfo,
  type NeedRow,
} from '../logic/evolution.ts';
import { stageName } from '../logic/format.ts';
import { preyHint } from '../logic/hunt.ts';
import { stageLook } from '../scene/palette.ts';
import { useEscape } from './useEscape.ts';

/** Knopf unten rechts: Symbol der Stufe, Punkt mit Zahl bei Angebot, Pfeil bei Reife. */
export function EvolutionButton({ view, active, onTap }: { view: HerdeView; active: boolean; onTap: () => void }) {
  const badge = evolutionBadge(view);
  return (
    <button
      type="button"
      className={`btn btn--icon evo-btn${active ? ' is-active' : ''}${badge ? ' evo-btn--alert' : ''}`}
      aria-label={t.evoOpen}
      aria-pressed={active}
      onClick={onTap}
    >
      <span aria-hidden>{stageLook(view.herd.stage).icon}</span>
      {badge && (
        <span className="evo-btn__badge" aria-hidden>
          {badge.kind === 'offer' ? badge.count : '⬆'}
        </span>
      )}
    </button>
  );
}

/** Deutlicher Hinweis unter der Absicht: Angebot liegt vor bzw. Herde ist reif. */
export function EvolutionBanner({
  data,
  view,
  onOffer,
  onMature,
}: {
  data: HerdeData;
  view: HerdeView;
  onOffer: () => void;
  onMature: () => void;
}) {
  const badge = evolutionBadge(view);
  if (!badge) return null;
  return (
    <button
      type="button"
      className={`evo-banner evo-banner--${badge.kind}`}
      onClick={badge.kind === 'offer' ? onOffer : onMature}
    >
      {badge.kind === 'offer' ? t.offerBanner(badge.count) : t.matureBanner(stageName(data, locale, badge.next))}
    </button>
  );
}

function NeedList({ rows }: { rows: NeedRow[] }) {
  return (
    <dl className="needs">
      {rows.map((row) => (
        <div key={row.kind} className={`needs__row needs__row--${row.tone}`}>
          <dt>{row.label}</dt>
          <dd>
            <span>{row.text}</span>
            {row.island && <small>{row.island}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Kurzer Kopf einer Stufe: Symbol und Name. */
function StageHead({ data, id, sub }: { data: HerdeData; id: string; sub?: string }) {
  return (
    <div className="stage-head">
      <span className="stage-head__icon" aria-hidden>
        {stageLook(id).icon}
      </span>
      <div>
        <b>{stageName(data, locale, id)}</b>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

/**
 * Herde und Entwicklung: aktuelle Stufe mit Bedürfnissen und Feldern auf der Insel, gewählte Merkmale,
 * Erfahrungsfortschritt, Reife und die Vorschau der nächsten Stufe (was sie braucht, was die Insel heute bietet).
 */
export function EvolutionPanel({
  data,
  view,
  busy,
  onClose,
  onOffer,
  onEvolve,
}: {
  data: HerdeData;
  view: HerdeView;
  /** Monate laufen oder die Partie ist vorbei: keine Aktionen */
  busy: boolean;
  onClose: () => void;
  onOffer: () => void;
  onEvolve: () => void;
}) {
  useEscape(onClose);
  const evo = view.evolution;
  const nextRows = evo.next ? needRows(t, data, locale, view, evo.next, evo.stage) : [];
  const lacking = missingOnIsland(nextRows);
  const maturity = missingText(t, data, locale, evo);
  const counted = countedText(t, evo);
  const nextPrey = evo.next ? preyHint(t, data, locale, view, evo.next) : null;
  return (
    <div
      className="overlay overlay--sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evo-title"
      onClick={onClose}
    >
      <div className="overlay__panel evo" onClick={(e) => e.stopPropagation()}>
        <header className="help__head">
          <h2 id="evo-title">{t.evoTitle}</h2>
          <button type="button" className="icon-btn icon-btn--flat" onClick={onClose} aria-label={t.close} autoFocus>
            ✕
          </button>
        </header>
        <div className="help__body evo__body">
          <StageHead data={data} id={evo.stage.id} sub={t.evoCurrentLabel} />
          <h3>{t.evoNeeds}</h3>
          <NeedList rows={needRows(t, data, locale, view, evo.stage)} />

          <h3>{t.evoTraits}</h3>
          {evo.traits.length === 0 ? (
            <p className="muted">{t.evoNoTraits}</p>
          ) : (
            <ul className="trait-list">
              {ownedTraits(data, locale, evo).map((info) => (
                <li key={info.id} className={info.role === 'earlier' ? 'trait-list--earlier' : undefined}>
                  <span aria-hidden>{info.icon}</span>
                  <b>{info.name}</b> – {info.effect}
                  {info.role === 'counted' && <em className="tag tag--good">{t.evoCountsTag}</em>}
                  {info.role === 'earlier' && <em className="tag tag--muted">{t.evoEarlierTag}</em>}
                </li>
              ))}
            </ul>
          )}

          <h3>{t.evoExperience}</h3>
          <ul className="xp">
            {experienceRows(data, locale, evo).map((row) => (
              <li key={row.id} className={row.trait?.forMaturity ? 'xp--maturity' : undefined}>
                <div className="xp__line">
                  <span>{row.name}</span>
                  <b>{row.at === null ? row.value : `${row.value}/${row.at}`}</b>
                </div>
                <span className="bar" aria-hidden>
                  <i style={{ width: `${row.share * 100}%` }} />
                </span>
                <small>
                  {row.trait ? (
                    <>
                      {t.evoExperienceNext(`${row.trait.icon} ${row.trait.name}`)}
                      {row.status === 'offer' && <em className="tag tag--good">{t.evoInOffer}</em>}
                      {row.status === 'later' && <em className="tag tag--muted">{t.evoLater}</em>}
                      {row.trait.forMaturity && <em className="tag">{t.evoForMaturity}</em>}
                    </>
                  ) : (
                    t.evoExperienceDone
                  )}
                </small>
              </li>
            ))}
          </ul>

          <h3>{t.evoMaturity}</h3>
          <p className={evo.mature ? 'is-good' : undefined}>{maturity ?? t.evoLast}</p>
          {counted && <p className="muted">{counted}</p>}

          {evo.next && (
            <section className="evo__next" aria-label={t.evoNext(stageName(data, locale, evo.next.id))}>
              <StageHead data={data} id={evo.next.id} sub={t.evoNextLabel} />
              <p className="muted">{t.evoNextIntro}</p>
              <NeedList rows={nextRows} />
              {nextPrey && <p className={view.prey.length > 0 ? 'is-good' : 'is-bad'}>{nextPrey}</p>}
              <p className={lacking.length > 0 ? 'is-bad' : 'is-good'}>
                {lacking.length > 0 ? t.evoNextMissing(lacking) : t.evoNextReady}
              </p>
            </section>
          )}
        </div>
        <footer className="help__actions">
          {evo.offer.length > 0 && !busy && (
            <button type="button" className="btn btn--gold" onClick={onOffer}>
              {t.offerBanner(evo.offer.length)}
            </button>
          )}
          {evo.mature && evo.next && !busy ? (
            <button type="button" className="btn btn--primary" onClick={onEvolve}>
              {t.evolveButton(stageName(data, locale, evo.next.id))}
            </button>
          ) : (
            <button type="button" className="btn" onClick={onClose}>
              {t.close}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/** Merkmal-Angebot: 2–3 Karten mit Name, Symbol und Wirkung; wählen und annehmen oder liegen lassen. */
export function TraitOffer({
  data,
  view,
  onPick,
  onClose,
}: {
  data: HerdeData;
  view: HerdeView;
  onPick: (trait: string) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const evo = view.evolution;
  const [chosen, setChosen] = useState<string | null>(evo.offer.length === 1 ? (evo.offer[0] ?? null) : null);
  return (
    <div className="overlay overlay--sheet" role="dialog" aria-modal="true" aria-labelledby="offer-title">
      <div className="overlay__panel offer">
        <h2 id="offer-title">{t.offerTitle}</h2>
        <p>{t.offerIntro}</p>
        <div className="offer__cards" role="radiogroup" aria-labelledby="offer-title">
          {evo.offer.map((id) => {
            const info = traitInfo(data, locale, id, evo);
            const active = chosen === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`trait-card${active ? ' is-active' : ''}`}
                onClick={() => setChosen(id)}
              >
                <span className="trait-card__icon" aria-hidden>
                  {info.icon}
                </span>
                <span className="trait-card__text">
                  <b>{info.name}</b>
                  <span>{info.effect}</span>
                  <small>
                    {t.offerFrom(info.experience, info.at)}
                    {info.forMaturity && <em className="tag">{t.offerHelpsMaturity}</em>}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="offer__leave muted">{t.offerLeave}</p>
        <div className="overlay__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t.offerLater}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={chosen === null}
            onClick={() => chosen && onPick(chosen)}
          >
            {t.offerPick}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bestätigung des Sprungs (im Spiel, nicht `confirm()`): neue Bedürfnisse, was die Insel bietet, kein Zurück. */
export function EvolveDialog({
  data,
  view,
  next,
  onConfirm,
  onCancel,
}: {
  data: HerdeData;
  view: HerdeView;
  next: StageNeedsView;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEscape(onCancel);
  const name = stageName(data, locale, next.id);
  const rows = needRows(t, data, locale, view, next, view.evolution.stage);
  const prey = preyHint(t, data, locale, view, next);
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="evolve-title">
      <div className="overlay__panel evolve">
        <div className="evolve__icons" aria-hidden>
          <span>{stageLook(view.evolution.stage.id).icon}</span>
          <i>→</i>
          <span>{stageLook(next.id).icon}</span>
        </div>
        <h2 id="evolve-title">{t.evolveTitle(name)}</h2>
        <p>{t.evolveIntro}</p>
        <NeedList rows={rows} />
        {prey && <p className={view.prey.length > 0 ? 'is-good' : 'is-bad'}>{prey}</p>}
        <p className="evolve__warning" role="note">
          {t.evolveWarning}
        </p>
        <div className="overlay__actions">
          <button type="button" className="btn" autoFocus onClick={onCancel}>
            {t.evolveCancel}
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            {t.evolveConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Kurze Einblendung nach dem Sprung: Symbol und Name der neuen Stufe, verschwindet von selbst. */
export function EvolvedCard({ data, stage, onDone }: { data: HerdeData; stage: string; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <div className="evolved" role="status" onClick={onDone}>
      <div className="evolved__card">
        <span className="evolved__icon" aria-hidden>
          {stageLook(stage).icon}
        </span>
        <small>{t.evolvedTitle}</small>
        <b>{stageName(data, locale, stage)}</b>
      </div>
    </div>
  );
}

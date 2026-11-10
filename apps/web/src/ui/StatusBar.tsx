import { useRef, useState } from 'react';
import type { HerdeData, HerdeView } from '@being-god/herde';
import { t, locale } from '../i18n/index.ts';
import { intentText, seasonHint, textOf, wolvesTotal } from '../logic/format.ts';
import { iceAgeNumber, preyAnimals, showPreyCounter } from '../logic/hunt.ts';
import { useEscape } from './useEscape.ts';

interface Props {
  data: HerdeData;
  view: HerdeView;
  onHelp: () => void;
  onNewGame: () => void;
  onTutorial: () => void;
}

/**
 * Kopf: Statusleiste (Herde, Vorrat, Wölfe, Wild ab der Stufe mit Wild, Wildnis/Eiszeit), Jahreskreis mit der
 * Nummer der Eiszeit und Absicht der Herde.
 */
export function StatusBar({ data, view, onHelp, onNewGame, onTutorial }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEscape(() => {
    setMenuOpen(false);
    menuButton.current?.focus();
  }, menuOpen);

  const wolves = wolvesTotal(view);
  const wildPct = Math.min(100, (view.wild.value / Math.max(1, view.wild.max)) * 100);
  const icePct = view.ice.months > 0 ? (view.ice.monthsLeft / view.ice.months) * 100 : 0;
  const monthName = textOf(data.months[view.monthOfYear], locale, String(view.monthOfYear + 1));
  const showPrey = showPreyCounter(data, view);
  const prey = preyAnimals(view);
  const ice = iceAgeNumber(view);

  return (
    <header className="hud">
      <div className="hud__row">
        <section
          className={`stats${showPrey ? ' stats--5' : ''}`}
          aria-label={t.statusLabel(view.herd.size, view.herd.fat, view.herd.fatMax, wolves)}
        >
          <div className={`stat${view.herd.size <= 3 ? ' stat--warn' : ''}`}>
            <span>{t.herd}</span>
            <b>{view.herd.size}</b>
          </div>
          <div className="stat">
            <span>{t.fat}</span>
            <b>
              {view.herd.fat}
              <small>/{view.herd.fatMax}</small>
            </b>
          </div>
          <div className={`stat${wolves > 0 ? ' stat--wolves' : ''}`}>
            <span>{t.wolves}</span>
            <b>{wolves}</b>
          </div>
          {showPrey && (
            <div className="stat stat--prey" aria-label={t.preyLabel(view.prey.length, prey)}>
              <span>{t.prey}</span>
              <b>{prey}</b>
            </div>
          )}
          {view.ice.active ? (
            <div className="stat stat--ice">
              <span>{t.iceAge}</span>
              <b className="stat__small">{t.iceLeft(view.ice.monthsLeft)}</b>
              <div className="bar" aria-hidden>
                <i style={{ width: `${icePct}%` }} />
              </div>
            </div>
          ) : (
            <div className="stat stat--wild">
              <span>{t.wild}</span>
              <b>{Math.floor(view.wild.value)}</b>
              <div
                className="bar"
                role="meter"
                aria-label={t.wild}
                aria-valuemin={0}
                aria-valuemax={view.wild.max}
                aria-valuenow={Math.floor(view.wild.value)}
              >
                <i style={{ width: `${wildPct}%` }} />
              </div>
            </div>
          )}
        </section>
        <div className="hud__buttons">
          <button
            ref={menuButton}
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t.menu}
            aria-expanded={menuOpen}
          >
            ☰
          </button>
          {menuOpen && (
            <div className="hud__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                autoFocus
                onClick={() => {
                  setMenuOpen(false);
                  onHelp();
                }}
              >
                <span aria-hidden>?</span> {t.help}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onNewGame();
                }}
              >
                <span aria-hidden>↻</span> {t.newGame}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onTutorial();
                }}
              >
                <span aria-hidden>▶</span> {t.showTutorial}
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="year" aria-label={t.date(view.year, monthName)}>
        <div className="year__line">
          <b>{t.date(view.year, monthName)}</b>
          {view.ice.active ? (
            <em className="year__ice is-active">{t.iceAgeOf(ice.n, ice.max)}</em>
          ) : (
            <em className="year__ice" aria-label={t.iceAgeNext(ice.n, ice.max)} title={t.iceAgeNext(ice.n, ice.max)}>
              {t.iceAgeChip(ice.n, ice.max)}
            </em>
          )}
          <span>{seasonHint(t, data, locale, view)}</span>
        </div>
        <div className="year__months" aria-hidden>
          {data.months.map((m, i) => {
            const seasonId = view.ice.active
              ? 'ice'
              : (data.seasons[Math.floor(i / data.monthsPerSeason)]?.id ?? 'spring');
            const state = i === view.monthOfYear ? ' is-now' : i < view.monthOfYear ? ' is-past' : '';
            return <i key={i} className={`m m--${seasonId}${state}`} title={textOf(m, locale)} />;
          })}
        </div>
      </section>

      {view.intent && (
        <div className="intent" aria-live="polite">
          {intentText(t, view.intent)}
        </div>
      )}
    </header>
  );
}

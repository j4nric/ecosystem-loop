import { useMemo, useState } from 'react';
import type { DeckIssue } from '@core/api';
import { t } from '../i18n/index.ts';
import {
  addCard,
  canAdd,
  copies,
  deckIssueMessage,
  removeCard,
  sameDeck,
  sortDeck,
  type DeckSetup,
} from '../logic/deck.ts';
import { useEscape } from './useEscape.ts';

interface Props {
  setup: DeckSetup;
  /** Deck, mit dem die Auswahl beginnt (gemerkt oder Standard). */
  initial: readonly string[];
  /** Prüfung der Engine (`validateDeck`). */
  check: (deck: readonly string[]) => DeckIssue[];
  onStart: (deck: string[]) => void;
  /** Schritt überspringen: sofort mit dem Standarddeck. */
  onQuickStart: () => void;
  onClose: () => void;
}

/**
 * Startdeck-Auswahl vor einer neuen Partie: Kartenpool aus dem Schöpfungsbuch mit −/+ je Karte, Kurztext und
 * (beim Antippen) vollem Text. Probleme meldet die Engine; „Starten“ geht nur mit gültigem Deck.
 */
export function DeckPicker({ setup, initial, check, onStart, onQuickStart, onClose }: Props) {
  const [deck, setDeck] = useState<readonly string[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  useEscape(onClose);
  const { rules, pool } = setup;
  const issues = useMemo(() => check(deck), [check, deck]);
  const names = useMemo(() => new Map(pool.map((c) => [c.id, c.name])), [pool]);
  const messages = issues.map((i) => deckIssueMessage(i, t, (id) => names.get(id) ?? id));
  const isStandard = sameDeck(deck, setup.standard);

  return (
    <div className="overlay overlay--top" role="dialog" aria-modal="true" aria-labelledby="deck-title">
      <div className="overlay__panel help deck">
        <header className="help__head">
          <div>
            <h2 id="deck-title">{t.deckTitle}</h2>
            <p className="muted">{t.deckIntro(rules.min, rules.max, rules.maxCopies)}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} autoFocus>
            ✕
          </button>
        </header>
        <div className="deck__status">
          <span>
            <b>{t.deckCount(deck.length, rules.min, rules.max)}</b>
            <small>{isStandard ? t.deckStandard : t.deckCustom}</small>
          </span>
          <button
            type="button"
            className="btn btn--small"
            disabled={isStandard}
            onClick={() => setDeck(setup.standard)}
          >
            ↺ {t.deckReset}
          </button>
        </div>
        <div className="help__body">
          <h3>{t.deckPool(pool.length)}</h3>
          <ul className="deck__list">
            {pool.map((card) => {
              const n = copies(deck, card.id);
              const expanded = open === card.id;
              return (
                <li key={card.id} className={`deck__row card--${card.category}${n > 0 ? ' is-in' : ''}`}>
                  <button
                    type="button"
                    className="deck__info"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : card.id)}
                  >
                    <span className="deck__name">
                      {card.name} <small>{card.cost === 0 ? t.free : `✦${card.cost}`}</small>
                    </span>
                    <span className="deck__text">{expanded ? card.text : card.short}</span>
                  </button>
                  <div className="deck__stepper">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t.deckRemove(card.name)}
                      disabled={n === 0}
                      onClick={() => setDeck((d) => removeCard(d, card.id))}
                    >
                      −
                    </button>
                    <span className="deck__copies" aria-label={t.deckInDeck(n)}>
                      {n}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t.deckAdd(card.name)}
                      disabled={!canAdd(deck, card.id, rules)}
                      onClick={() => setDeck((d) => addCard(d, card.id, rules))}
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={`deck__issues${messages.length > 0 ? ' is-bad' : ''}`} role="status" aria-live="polite">
          {messages.length > 0 ? messages.map((m) => <p key={m}>{m}</p>) : <p>{t.deckOk}</p>}
        </div>
        <footer className="help__actions">
          <button type="button" className="btn" onClick={onQuickStart} title={t.deckQuickHint}>
            {t.deckQuickStart}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={issues.length > 0}
            onClick={() =>
              onStart(
                sortDeck(
                  deck,
                  pool.map((c) => c.id),
                ),
              )
            }
          >
            {t.deckStart}
          </button>
        </footer>
      </div>
    </div>
  );
}

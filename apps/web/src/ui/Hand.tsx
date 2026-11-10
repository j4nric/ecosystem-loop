import type { HandCardView, HerdeData } from '@being-god/herde';
import { locale, t } from '../i18n/index.ts';
import { isPlayable, textOf } from '../logic/format.ts';

interface Props {
  data: HerdeData;
  cards: HandCardView[];
  selected: number | null;
  disabled: boolean;
  onTap: (index: number) => void;
}

/**
 * Kartenleiste: Symbol, Name, Wildnis-Kosten. Antippen wählt die Karte (dann ein hervorgehobenes Feld);
 * eine Karte ohne gültiges Ziel ist ausgegraut; gewählt zeigt ihr Sheet „kein passendes Feld“. Kein Ablegen.
 */
export function Hand({ data, cards, selected, disabled, onTap }: Props) {
  if (cards.length === 0) return <p className="hand hand--empty">{t.emptyHand}</p>;
  return (
    <div className="hand" role="list" aria-label={t.hand}>
      {cards.map((card) => {
        const def = data.cards.get(card.card);
        const name = textOf(def?.name, locale, card.card);
        const playable = isPlayable(card);
        const active = selected === card.index;
        return (
          <button
            key={`${card.index}-${card.card}`}
            type="button"
            role="listitem"
            className={`card${card.global ? ' card--global' : ''}${active ? ' is-active' : ''}${playable ? '' : ' is-disabled'}`}
            aria-pressed={active}
            aria-label={`${name}. ${textOf(def?.text, locale)}. ${t.wildCost(card.wild)}${playable ? '' : `. ${t.noTargets}`}`}
            disabled={disabled}
            onClick={() => onTap(card.index)}
          >
            <span className="card__icon" aria-hidden>
              {def?.icon}
            </span>
            <span className="card__name">{name}</span>
            <span className="card__cost" aria-hidden>
              +{card.wild}
            </span>
          </button>
        );
      })}
    </div>
  );
}

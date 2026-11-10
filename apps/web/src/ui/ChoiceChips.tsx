import type { ChipOption } from '../logic/targeting.ts';

interface Props {
  options: ChipOption[];
  selected: string | null;
  onPick: (optionId: string) => void;
  label: string;
}

/**
 * Auswahl für Art-Slots (z. B. Beute bei „Jagd“) und Wahl-Slots (z. B. Abwenden/Verschieben bei „Späherblick“)
 * als große, daumenfreundliche Chips.
 */
export function ChoiceChips({ options, selected, onPick, label }: Props) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === selected}
          className={`chip${o.id === selected ? ' is-selected' : ''}`}
          onClick={() => onPick(o.id)}
        >
          {o.name}
          {o.count !== null && <small>×{o.count}</small>}
        </button>
      ))}
    </div>
  );
}

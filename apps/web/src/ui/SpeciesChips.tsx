import type { SpeciesOption } from '../state/useTargeting.ts';
import { t } from '../i18n/index.ts';

interface Props {
  options: SpeciesOption[];
  selected: string | null;
  onPick: (speciesId: string) => void;
}

/** Auswahl einer Art für einen Art-Slot (z. B. Beute bei „Jagd“) als große, daumenfreundliche Chips. */
export function SpeciesChips({ options, selected, onPick }: Props) {
  return (
    <div className="chips" role="radiogroup" aria-label={t.speciesOptions}>
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

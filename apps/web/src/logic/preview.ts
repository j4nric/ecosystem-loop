/**
 * Vorschau eines Kartenzugs: `step` auf dem Zustand (rein, der Eingang bleibt unverändert), danach `view`.
 * Zeigt, was mit dem Zielfeld geschieht, wie viele Felder Gras bekommen und ob die Herde ihre Absicht ändert.
 */
import {
  step,
  view,
  type Action,
  type CellView,
  type HerdeData,
  type HerdeState,
  type IntentView,
  type Pos,
} from '@being-god/herde';
import { sameIntent } from './format.ts';

export interface PlayPreview {
  card: string;
  /** Zielfeld vorher/nachher (fehlt bei globalen Karten) */
  cell: { before: CellView; after: CellView } | null;
  /** Felder mit mehr Futter (z. B. Regen) */
  grown: Pos[];
  /** Feld des Ziels brennt (Blitz) */
  ignites: boolean;
  /** ein Rudel auf dem Ziel wird vertrieben */
  packGone: boolean;
  intentBefore: IntentView | null;
  intentAfter: IntentView | null;
  intentChanged: boolean;
  wildBefore: number;
  wildAfter: number;
}

/** null, wenn die Aktion keine Karte ist oder die Engine sie ablehnt. */
export function previewPlay(data: HerdeData, state: HerdeState, action: Action): PlayPreview | null {
  if (action.type !== 'play') return null;
  const card = state.hand[action.hand];
  if (card === undefined) return null;
  let result;
  try {
    result = step(data, state, action);
  } catch {
    return null;
  }
  const before = view(data, state);
  const after = view(data, result.state);
  const at = (v: typeof before) =>
    action.x === undefined || action.y === undefined ? undefined : v.cells[action.y * v.width + action.x];
  const cellBefore = at(before);
  const cellAfter = at(after);
  const grown = after.cells.filter((c, i) => c.food > before.cells[i]!.food).map(({ x, y }) => ({ x, y }));
  return {
    card,
    cell: cellBefore && cellAfter ? { before: cellBefore, after: cellAfter } : null,
    grown,
    ignites: result.events.some((e) => e.type === 'fire'),
    packGone: result.events.some((e) => e.type === 'packGone'),
    intentBefore: before.intent,
    intentAfter: after.intent,
    intentChanged: !sameIntent(before.intent, after.intent),
    wildBefore: before.wild.value,
    wildAfter: after.wild.value,
  };
}

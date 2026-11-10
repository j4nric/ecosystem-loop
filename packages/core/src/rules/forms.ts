/** Formen: aus den Werten jeder Zone die erste passende Form ihrer Geografie bestimmen (Konzept 4.2). */
import { z } from 'zod';
import { holdsAll } from '../conditions.ts';
import type { FormDef, GameData } from '../schema/index.ts';
import type { GameState, ZoneState } from '../state.ts';
import { geographyOf, markDisturbance } from '../world.ts';
import { defineRule } from './module.ts';

export const FormsParams = z.strictObject({});

/** Erste passende Form der Geografie (die Daten garantieren eine Form ohne Bedingungen am Ende). */
export function formFor(data: GameData, state: GameState, zone: ZoneState): FormDef {
  const forms = geographyOf(data, zone).forms;
  return forms.find((f) => holdsAll(f.when, { data, state, zone })) ?? forms[forms.length - 1]!;
}

export const forms = defineRule({
  id: 'forms',
  params: FormsParams,
  run({ data, state, emit }) {
    const next = state.zones.map((zone) => formFor(data, state, zone));
    state.zones.forEach((zone, i) => {
      const form = next[i]!;
      if (form.id !== zone.form) {
        emit({ type: 'formChanged', zone: zone.id, from: zone.form, to: form.id });
        zone.form = form.id;
        zone.formSince = state.round;
      }
      // AUSLEGUNG: Eine Störungsform (Hochwasser) stört ihre eigene Zone in jeder Runde, in der sie besteht.
      // Die Nachbarn trifft sie über die Kopplung „Hochwasser“, nicht als Störung.
      if (form.kind === 'disturbance') markDisturbance(state, zone, `form:${form.id}`, emit);
    });
  },
});

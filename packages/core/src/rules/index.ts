/** Registry aller Regel-Module. Neue Mechanik: Modul anlegen, hier eintragen, in config.yaml → pipeline aufnehmen. */
import { life } from './life.ts';
import { breath } from './breath.ts';
import { couplings } from './couplings.ts';
import { evolution } from './evolution.ts';
import { forms } from './forms.ts';
import { harmony } from './harmony.ts';
import { healing } from './healing.ts';
import { levels } from './levels.ts';
import type { RuleModule } from './module.ts';
import { score } from './score.ts';
import { season } from './season.ts';

export const RULES: ReadonlyMap<string, RuleModule> = new Map(
  [season, couplings, healing, forms, levels, life, evolution, score, harmony, breath].map((m) => [m.id, m]),
);

export type { RuleContext, RuleModule } from './module.ts';

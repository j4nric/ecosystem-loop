/** Öffentliche Schnittstelle der Regel-Engine (plattformunabhängig, läuft in Node und im Browser). */
export type * from './api.ts';
export * from './schema/index.ts';
export * from './state.ts';
export * from './rng.ts';
export * from './conditions.ts';
export * from './data.ts';
export * from './game.ts';
export { RuleError } from './world.ts';
export { cardText, describeCondition, describeEffect } from './cards/text.ts';
export { formFor } from './rules/forms.ts';
export { RULES, type RuleContext, type RuleModule } from './rules/index.ts';
export * from './meta.ts';

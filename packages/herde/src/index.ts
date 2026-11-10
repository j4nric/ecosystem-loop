/** Öffentlicher Einstieg von @being-god/herde (plattformunabhängig). */
export * from './api.ts';
export { newGame, step, view, legalPlays, validateState, intentOf, forecastOf } from './game.ts';
export { buildData, DataError, DATA_FILES, type RawData } from './data.ts';
export type { HerdeData, Landscape, Card, Season, Stage, Island, Params, Text } from './schema.ts';
export { STATE_VERSION, type CellState, type HerdState, type PackState, type EventType } from './state.ts';
export { RuleError } from './world.ts';
export { playRandomGame, type BotResult, type BotOptions } from './bot.ts';

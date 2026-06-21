// 引擎统一导出（纯函数，零 Firebase 依赖）。
export { GAME_CONFIG } from './config';
export type { GameConfig } from './config';
export * from './types';
export { createRng } from './rng';
export type { Rng, RngState } from './rng';
export { createGame, startRound, finishGame, createGameWithSeed } from './game';
export type { PlayerSeed } from './game';
export { reduce, applyAction } from './reduce';
export {
  aliveUids,
  aliveCount,
  aliveWithCards,
  nextActorAfter,
  computeForcedReveal,
  isThemeMatch,
  handIsLie,
} from './helpers';

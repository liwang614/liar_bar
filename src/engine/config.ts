// R-1 所有数值集中于此，全部可调。引擎与 UI 都从这里取值，禁止散落魔法数。
export const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 5,
  HAND_SIZE: 8, // 每小局每人发 8 张
  MIN_PLAY: 1, // 单次出牌下限
  MAX_PLAY: 3, // 单次出牌上限
  DECK: { cat: 13, dog: 13, sheep: 13, joker: 2 }, // 共 41 张（支持 5 人 ×8=40）
  FATE_TOTAL: 6, // 每人命运牌 6 张
  FATE_BOMBS: 2, // 其中炸弹 2 张（4 安全 + 2 炸弹）
  TURN_TIMEOUT_SEC: 30,
  TIMEOUT_STRIKES_TO_KICK: 3,
} as const;

export type GameConfig = typeof GAME_CONFIG;

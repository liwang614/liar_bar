// 引擎类型定义。引擎为纯函数、零 Firebase 依赖（文档 §3.5）。
import type { RngState } from './rng';

// R-2 动物牌三种；万能牌 joker 验证时视为任意主题动物，恒为真。
export type Animal = 'cat' | 'dog' | 'sheep';
export type CardKind = Animal | 'joker';

// 带唯一 id，便于校验 cardIds 确属手牌（文档 §3.5）。
export interface Card {
  id: string;
  kind: CardKind;
}

// 命运牌：安全 / 炸弹。
export type FateCard = 'safe' | 'bomb';

export interface Player {
  uid: string;
  nickname: string;
  avatar: string;
  seat: number; // 座位序号，决定 seatOrder 中的轮转顺序
  alive: boolean;
  hand: Card[]; // 机密：仅本人与裁判可见
  fateDeck: FateCard[]; // 机密：剩余未翻命运牌，跨小局保留，永不重置（R-5）
  fateSafeRevealed: number; // 已翻开的安全牌数（公开）
  timeoutStrikes: number; // 连续超时次数（文档 §5.1）
  online: boolean;
}

// 桌面最近一手出牌。cards 为机密真实牌面；count 公开。
export interface LastPlay {
  uid: string;
  count: number;
  playId: string;
  cards: Card[];
}

export type RoundPhase = 'turn' | 'revealing' | 'fate' | 'round_end';

// 待翻命运牌：判定已确定由 judgedUid 受罚，等 pickerUid（对方）选一张翻开。
export interface PendingFate {
  judgedUid: string;
  pickerUid: string;
}

export interface RoundState {
  roundNo: number;
  themeAnimal: Animal;
  turnUid: string; // 当前行动者
  forcedReveal: boolean; // R-15 强制验证模式
  lastPlay: LastPlay | null;
  phase: RoundPhase;
  pendingFate: PendingFate | null; // phase==='fate' 时由对方翻牌
}

export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface GameState {
  status: GameStatus;
  seatOrder: string[]; // uid 按座位排序
  players: Record<string, Player>;
  round: RoundState | null;
  deck: Card[]; // 本小局剩余未发牌库（2~3 人局会有剩余，弃置不用）
  rng: RngState; // 可序列化的 RNG 状态，保证刷新/接管可复现
  winnerUid?: string;
  lastJudgedUid?: string; // 上一小局执行死亡判定者，决定下小局首家（R-7）
}

// ── 玩家意图 ──────────────────────────────────────────────
export type Action =
  | { type: 'PLAY_CARDS'; uid: string; cardIds: string[] }
  | { type: 'CHALLENGE'; uid: string }
  | { type: 'PICK_FATE'; uid: string; index: number } // 对方翻命运牌
  | { type: 'TIMEOUT'; uid: string }
  | { type: 'FORFEIT'; uid: string };

// ── 公开事件流（驱动动画与日志，文档 §3.3）──────────────────
// seq 由裁判落库时分配，引擎内不赋值。
export type GameEvent =
  | { type: 'ROUND_STARTED'; roundNo: number; turnUid: string }
  | { type: 'THEME_ANNOUNCED'; themeAnimal: Animal }
  | { type: 'CARDS_PLAYED'; uid: string; count: number; playId: string }
  | { type: 'CHALLENGE_DECLARED'; challengerUid: string; targetUid: string }
  | {
      type: 'CARDS_REVEALED';
      cards: Card[];
      liar: boolean; // true=出牌者说谎
      playerUid: string; // 出牌者
      judgedUid: string; // 执行死亡判定者
      forced: boolean; // 是否为 R-15 强制验证触发
    }
  | { type: 'FATE_PENDING'; judgedUid: string; pickerUid: string; remaining: number }
  | { type: 'FATE_DRAWN'; uid: string; card: FateCard; remaining: number }
  | { type: 'PLAYER_ELIMINATED'; uid: string; reason: 'bomb' | 'forfeit' }
  | { type: 'ROUND_ENDED'; roundNo: number; reason: 'judged' | 'all_empty' }
  | { type: 'GAME_WON'; uid: string };

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
  rejected?: { reason: string };
}

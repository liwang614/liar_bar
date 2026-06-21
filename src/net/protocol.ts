// 前端与自建服务器共享的协议与公开数据形状（绝不含他人牌面）。
import type { Animal, Card, GameStatus, RoundPhase } from '../engine';

export interface PublicPlayer {
  uid: string;
  nickname: string;
  avatar: string;
  seat: number;
  ready: boolean;
  alive: boolean;
  handCount: number;
  fateRemaining: number;
  fateSafeRevealed: number;
  online: boolean;
  timeoutStrikes: number;
  wins: number; // 累计胜场（客户端 localStorage 持久，跨房间携带）
}

export interface PublicLastPlay {
  uid: string;
  count: number;
  playId: string;
}

// 待翻命运牌（由对方揭牌）。remaining = 被判定者剩余命运牌张数。
export interface PublicPendingFate {
  judgedUid: string;
  pickerUid: string;
  remaining: number;
}

export interface PublicRound {
  roundNo: number;
  themeAnimal: Animal;
  turnUid: string;
  turnDeadline: number | null;
  forcedReveal: boolean;
  lastPlay: PublicLastPlay | null;
  phase: RoundPhase;
  pendingFate: PublicPendingFate | null;
}

export interface PublicRoom {
  code: string;
  status: GameStatus;
  hostUid: string;
  seatOrder: string[];
  players: Record<string, PublicPlayer>;
  round: PublicRound | null;
  winnerUid?: string;
}

// 大厅房间摘要：在首页列出可加入的房间（仅 lobby 状态）。
export interface RoomSummary {
  code: string;
  hostNickname: string;
  hostAvatar: string;
  playerCount: number;
  maxPlayers: number;
}

// 事件流封装：seq 由服务器分配，type + 其余字段透传。
export interface EventEnvelope {
  seq: number;
  type: string;
  [k: string]: unknown;
}

// 出牌张数等校验在服务器引擎内完成；这里只描述线缆形状。
export type ActionMsg =
  | { type: 'PLAY_CARDS'; cardIds: string[] }
  | { type: 'CHALLENGE' }
  | { type: 'PICK_FATE'; index: number }
  | { type: 'TIMEOUT' }
  | { type: 'FORFEIT' };

// 客户端 → 服务器
export type ClientMsg =
  | { t: 'create'; uid: string; nickname: string; avatar: string; wins: number }
  | { t: 'join'; code: string; uid: string; nickname: string; avatar: string; wins: number }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'restart' } // 再来一局（同房重开）
  | { t: 'profile'; wins: number } // 上报最新胜场
  | { t: 'action'; action: ActionMsg }
  | { t: 'rooms' } // 请求大厅房间列表
  | { t: 'leave' };

// 服务器 → 客户端
export type ServerMsg =
  | { t: 'joined'; code: string; uid: string }
  | { t: 'state'; room: PublicRoom; hand: Card[]; events: EventEnvelope[] }
  | { t: 'rooms'; rooms: RoomSummary[] }
  | { t: 'error'; msg: string };

export const WS_PATH = '/ws';

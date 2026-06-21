// 引擎内部共享的纯查询/判定工具。无副作用。
import type { Animal, Card, GameState } from './types';

export function aliveUids(state: GameState): string[] {
  return state.seatOrder.filter((uid) => state.players[uid]?.alive);
}

export function aliveCount(state: GameState): number {
  return aliveUids(state).length;
}

// 存活且手牌>0 的玩家 uid（按座位序）。
export function aliveWithCards(state: GameState): string[] {
  return aliveUids(state).filter((uid) => state.players[uid].hand.length > 0);
}

// 从 fromUid 之后开始，循环查找下一个「存活且手牌>0」的玩家。
// 若只有 fromUid 满足，会绕回返回 fromUid 自身；都不满足返回 null。
export function nextActorAfter(state: GameState, fromUid: string): string | null {
  const order = state.seatOrder;
  const start = order.indexOf(fromUid);
  for (let step = 1; step <= order.length; step++) {
    const uid = order[(start + step) % order.length];
    const p = state.players[uid];
    if (p?.alive && p.hand.length > 0) return uid;
  }
  return null;
}

// 从 fromUid 之后开始，循环查找下一个存活玩家（忽略手牌，用于定首家 R-7）。
export function nextAliveAfter(state: GameState, fromUid: string): string | null {
  const order = state.seatOrder;
  const start = order.indexOf(fromUid);
  for (let step = 1; step <= order.length; step++) {
    const uid = order[(start + step) % order.length];
    if (state.players[uid]?.alive) return uid;
  }
  return null;
}

// R-15：轮到 turnUid 行动且其他所有存活者手牌均为 0。
export function computeForcedReveal(state: GameState, turnUid: string): boolean {
  const p = state.players[turnUid];
  if (!p?.alive || p.hand.length === 0) return false;
  return aliveUids(state).every((uid) => uid === turnUid || state.players[uid].hand.length === 0);
}

// R-2：joker 视为任意主题动物，恒为真。
export function isThemeMatch(card: Card, theme: Animal): boolean {
  return card.kind === theme || card.kind === 'joker';
}

// 一手牌是否含假牌（任意一张不是主题动物且不是 joker）。
export function handIsLie(cards: Card[], theme: Animal): boolean {
  return cards.some((c) => !isThemeMatch(c, theme));
}

// 单测专用：确定性构造 GameState，绕开发牌随机，精确测试规则。
import type { Animal, CardKind, Card, FateCard, GameState, Player, ReduceResult } from '../types';
import { applyAction } from '../reduce';

export function toHand(prefix: string, kinds: CardKind[]): Card[] {
  return kinds.map((kind, i) => ({ id: `${prefix}-${i}`, kind }));
}

export interface PlayerSpec {
  uid: string;
  hand?: CardKind[];
  fate?: FateCard[];
  alive?: boolean;
}

export interface StateSpec {
  players: PlayerSpec[];
  theme: Animal;
  turnUid: string;
  lastPlay?: { uid: string; cards: CardKind[] };
  forcedReveal?: boolean;
  roundNo?: number;
  lastJudgedUid?: string;
  seed?: number;
}

const FULL_SAFE: FateCard[] = ['safe', 'safe', 'safe', 'safe', 'safe', 'bomb'];

export function makeState(spec: StateSpec): GameState {
  const players: Record<string, Player> = {};
  spec.players.forEach((p, seat) => {
    players[p.uid] = {
      uid: p.uid,
      nickname: p.uid,
      avatar: '🐱',
      seat,
      alive: p.alive ?? true,
      hand: toHand(`${p.uid}-h`, p.hand ?? []),
      fateDeck: p.fate ?? [...FULL_SAFE],
      fateSafeRevealed: 0,
      timeoutStrikes: 0,
      online: true,
    };
  });
  return {
    status: 'playing',
    seatOrder: spec.players.map((p) => p.uid),
    players,
    round: {
      roundNo: spec.roundNo ?? 1,
      themeAnimal: spec.theme,
      turnUid: spec.turnUid,
      forcedReveal: spec.forcedReveal ?? false,
      lastPlay: spec.lastPlay
        ? {
            uid: spec.lastPlay.uid,
            count: spec.lastPlay.cards.length,
            playId: 'lp',
            cards: toHand(`${spec.lastPlay.uid}-lp`, spec.lastPlay.cards),
          }
        : null,
      phase: 'turn',
      pendingFate: null,
    },
    deck: [],
    rng: { seed: spec.seed ?? 12345 },
    lastJudgedUid: spec.lastJudgedUid,
  };
}

// 取出某玩家手牌中前 n 张的 id（用于构造 PLAY_CARDS）。
export function handIds(state: GameState, uid: string, n?: number): string[] {
  const ids = state.players[uid].hand.map((c) => c.id);
  return n === undefined ? ids : ids.slice(0, n);
}

// 处于 fate 阶段时，由对方翻第 index 张命运牌。
export function pickFate(state: GameState, index = 0): ReduceResult {
  const pf = state.round?.pendingFate;
  if (!pf) throw new Error('当前不在 fate 阶段');
  return applyAction(state, { type: 'PICK_FATE', uid: pf.pickerUid, index });
}

// 大局/小局的建立：发命运牌、洗牌发手牌、定主题与首家。
import { GAME_CONFIG, type GameConfig } from './config';
import { aliveCount, aliveUids, nextAliveAfter } from './helpers';
import { createRng, type Rng } from './rng';
import type {
  Animal,
  Card,
  FateCard,
  GameEvent,
  GameState,
  Player,
  ReduceResult,
} from './types';

const ANIMALS: Animal[] = ['cat', 'dog', 'sheep'];

export interface PlayerSeed {
  uid: string;
  nickname: string;
  avatar: string;
  seat: number;
  online?: boolean;
}

// R-5：每位玩家生成 FATE_TOTAL 张命运牌（FATE_BOMBS 炸弹 + 其余安全，顺序随机）。
function buildFateDeck(rng: Rng, config: GameConfig): FateCard[] {
  const deck: FateCard[] = [];
  for (let i = 0; i < config.FATE_BOMBS; i++) deck.push('bomb');
  for (let i = 0; i < config.FATE_TOTAL - config.FATE_BOMBS; i++) deck.push('safe');
  return rng.shuffle(deck);
}

// R-2/R-3：构造 32 张动物牌库并洗匀。
function buildDeck(rng: Rng, roundNo: number, config: GameConfig): Card[] {
  const deck: Card[] = [];
  let i = 0;
  const push = (kind: Card['kind'], n: number) => {
    for (let k = 0; k < n; k++) deck.push({ id: `r${roundNo}-${i++}`, kind });
  };
  push('cat', config.DECK.cat);
  push('dog', config.DECK.dog);
  push('sheep', config.DECK.sheep);
  push('joker', config.DECK.joker);
  return rng.shuffle(deck);
}

// 建立大局并立即开第一小局（R-4~R-7）。
export function createGame(
  seeds: PlayerSeed[],
  rng: Rng,
  config: GameConfig = GAME_CONFIG,
): ReduceResult {
  const ordered = [...seeds].sort((a, b) => a.seat - b.seat);
  const players: Record<string, Player> = {};
  for (const s of ordered) {
    players[s.uid] = {
      uid: s.uid,
      nickname: s.nickname,
      avatar: s.avatar,
      seat: s.seat,
      alive: true,
      hand: [],
      fateDeck: buildFateDeck(rng, config),
      fateSafeRevealed: 0,
      timeoutStrikes: 0,
      online: s.online ?? true,
    };
  }
  const state: GameState = {
    status: 'playing',
    seatOrder: ordered.map((s) => s.uid),
    players,
    round: null,
    deck: [],
    rng: rng.getState(),
    lastJudgedUid: undefined,
  };
  return startRound(state, rng, config);
}

// 开新小局：定主题、洗牌发手牌、定首家（R-6, R-7）。
export function startRound(
  inState: GameState,
  rng: Rng,
  config: GameConfig = GAME_CONFIG,
): ReduceResult {
  const state: GameState = structuredClone(inState);

  // 仅剩 1 名存活者：大局结束（R-16）。
  if (aliveCount(state) <= 1) {
    return finishGame(state, rng);
  }

  const roundNo = (inState.round?.roundNo ?? 0) + 1;
  const themeAnimal = ANIMALS[rng.pickIndex(ANIMALS.length)];

  // 洗牌发手牌（R-6②）。死亡者不发牌。
  const deck = buildDeck(rng, roundNo, config);
  for (const uid of state.seatOrder) {
    const p = state.players[uid];
    p.hand = p.alive ? deck.splice(0, config.HAND_SIZE) : [];
  }
  state.deck = deck; // 2~3 人局剩余牌弃置不用（R-3）

  // 定首家（R-7）。
  const turnUid = pickStarter(state, roundNo, rng);

  state.round = {
    roundNo,
    themeAnimal,
    turnUid,
    forcedReveal: false, // 小局开始时所有存活者手牌满，必为 false
    lastPlay: null,
    phase: 'turn',
    pendingFate: null,
  };
  state.rng = rng.getState();

  const events: GameEvent[] = [
    { type: 'ROUND_STARTED', roundNo, turnUid },
    { type: 'THEME_ANNOUNCED', themeAnimal },
  ];
  return { state, events };
}

// R-7：首小局随机；之后由上一小局执行死亡判定者先手，若其出局则其下家。
function pickStarter(state: GameState, roundNo: number, rng: Rng): string {
  const alive = aliveUids(state);
  if (roundNo === 1 || !state.lastJudgedUid) {
    return alive[rng.pickIndex(alive.length)];
  }
  const judged = state.players[state.lastJudgedUid];
  if (judged?.alive) return state.lastJudgedUid;
  return nextAliveAfter(state, state.lastJudgedUid) ?? alive[0];
}

// R-16：大局结束。
export function finishGame(inState: GameState, rng: Rng): ReduceResult {
  const state: GameState = structuredClone(inState);
  const survivors = aliveUids(state);
  const winnerUid = survivors[0];
  state.status = 'finished';
  state.winnerUid = winnerUid;
  if (state.round) state.round.phase = 'round_end';
  state.rng = rng.getState();
  return { state, events: winnerUid ? [{ type: 'GAME_WON', uid: winnerUid }] : [] };
}

// 便捷入口：从 state.rng 复原 RNG 后建立大局。
export function createGameWithSeed(seeds: PlayerSeed[], seed: number): ReduceResult {
  return createGame(seeds, createRng(seed));
}

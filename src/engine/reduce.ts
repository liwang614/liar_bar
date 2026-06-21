// 核心状态机：reduce(state, action, rng) → { state, events, rejected? }
// 对照文档 §2.10 伪代码实现。非法动作不改状态，返回 rejected 供裁判标记并 toast。
import { GAME_CONFIG } from './config';
import { startRound, finishGame } from './game';
import {
  aliveCount,
  computeForcedReveal,
  handIsLie,
  nextActorAfter,
  nextAliveAfter,
} from './helpers';
import { createRng, type Rng } from './rng';
import type { Action, Card, GameEvent, GameState, ReduceResult } from './types';

const { MIN_PLAY, MAX_PLAY, TIMEOUT_STRIKES_TO_KICK } = GAME_CONFIG;

// 便捷入口：从 state.rng 复原 RNG 后处理一个 action。裁判与单测使用。
export function applyAction(state: GameState, action: Action): ReduceResult {
  return reduce(state, action, createRng(state.rng));
}

export function reduce(inState: GameState, action: Action, rng: Rng): ReduceResult {
  const reject = (reason: string): ReduceResult => ({ state: inState, events: [], rejected: { reason } });

  if (inState.status !== 'playing' || !inState.round) return reject('对局未进行中');
  const actor = inState.players[action.uid];
  if (!actor) return reject('玩家不存在');

  // FORFEIT 可在任意时刻发生（主动退出 / 被踢）。
  if (action.type === 'FORFEIT') {
    if (!actor.alive) return reject('玩家已出局');
    return applyForfeit(structuredClone(inState), action.uid, rng, []);
  }

  // PICK_FATE 由「对方」在 fate 阶段触发，不受 turnUid 约束。
  if (action.type === 'PICK_FATE') {
    const pf = inState.round.pendingFate;
    if (inState.round.phase !== 'fate' || !pf) return reject('当前无需翻牌');
    if (pf.pickerUid !== action.uid) return reject('只有对方可以翻牌');
    const judged = inState.players[pf.judgedUid];
    if (action.index < 0 || action.index >= judged.fateDeck.length) return reject('翻牌位置无效');
    const s = structuredClone(inState);
    return resolveFateAt(s, pf.judgedUid, action.index, rng, []);
  }

  // PLAY / CHALLENGE / TIMEOUT 必须是当前回合、存活、且处于出牌阶段。
  if (!actor.alive) return reject('你已出局');
  if (inState.round.phase !== 'turn') return reject('当前不是出牌阶段');
  if (inState.round.turnUid !== action.uid) return reject('还没轮到你');

  const s: GameState = structuredClone(inState);
  const round = s.round!;
  const events: GameEvent[] = [];
  const me = s.players[action.uid];

  switch (action.type) {
    case 'PLAY_CARDS': {
      const ids = action.cardIds;
      if (ids.length < MIN_PLAY || ids.length > MAX_PLAY) {
        return reject(`每次出牌 ${MIN_PLAY}~${MAX_PLAY} 张`);
      }
      if (new Set(ids).size !== ids.length) return reject('出牌包含重复卡牌');
      const handIds = new Set(me.hand.map((c) => c.id));
      if (!ids.every((id) => handIds.has(id))) return reject('选择的牌不在你的手牌中');
      const played = ids.map((id) => me.hand.find((c) => c.id === id)!);
      return applyPlay(s, action.uid, played, rng, events);
    }
    case 'CHALLENGE': {
      if (!round.lastPlay) return reject('没有可质疑的对象'); // R-9
      return applyChallenge(s, action.uid, rng, events);
    }
    case 'TIMEOUT': {
      return applyTimeout(s, action.uid, rng, events);
    }
  }
}

// 出牌（PLAY_CARDS 与 TIMEOUT 自动出牌共用）。cards 已校验属于手牌。
function applyPlay(s: GameState, uid: string, played: Card[], rng: Rng, events: GameEvent[]): ReduceResult {
  const round = s.round!;
  const me = s.players[uid];
  const ids = new Set(played.map((c) => c.id));
  me.hand = me.hand.filter((c) => !ids.has(c.id));

  const playId = `${round.roundNo}-${uid}-${me.hand.length}`;
  round.lastPlay = { uid, count: played.length, playId, cards: played };
  events.push({ type: 'CARDS_PLAYED', uid, count: played.length, playId });

  // R-15 强制验证模式：立即自动翻验。
  if (round.forcedReveal) {
    const liar = handIsLie(played, round.themeAnimal);
    events.push({
      type: 'CARDS_REVEALED',
      cards: played,
      liar,
      playerUid: uid,
      judgedUid: liar ? uid : '',
      forced: true,
    });
    round.lastPlay = null; // 已验证、弃置
    if (liar) {
      // 强制验证模式下被抓 → 由最近的其他存活者替他翻命运牌。
      return enterFatePhase(s, uid, nextAliveAfter(s, uid) ?? '', rng, events);
    }
    // 全真：其他人都空，轮转后仍是 P；若 P 也打空 → R-14(b)。
    return advanceTurn(s, uid, rng, events);
  }

  // 普通出牌：推进到下一行动者（R-10 上家那手随下次覆写 lastPlay 而永久免验）。
  return advanceTurn(s, uid, rng, events);
}

// 质疑（R-12）。
function applyChallenge(s: GameState, uid: string, rng: Rng, events: GameEvent[]): ReduceResult {
  const round = s.round!;
  const lp = round.lastPlay!;
  events.push({ type: 'CHALLENGE_DECLARED', challengerUid: uid, targetUid: lp.uid });

  const liar = handIsLie(lp.cards, round.themeAnimal);
  const judgedUid = liar ? lp.uid : uid; // 说谎→出牌者判定；全真→质疑者判定
  const pickerUid = liar ? uid : lp.uid; // 由对方翻牌（R-13 改：对方揭牌）
  events.push({
    type: 'CARDS_REVEALED',
    cards: lp.cards,
    liar,
    playerUid: lp.uid,
    judgedUid,
    forced: false,
  });
  round.lastPlay = null;
  return enterFatePhase(s, judgedUid, pickerUid, rng, events);
}

// 超时（文档 §5.1）：等价自动随机出 1 张、不质疑；连续 N 次按 FORFEIT 出局。
function applyTimeout(s: GameState, uid: string, rng: Rng, events: GameEvent[]): ReduceResult {
  const me = s.players[uid];
  me.timeoutStrikes += 1;
  if (me.timeoutStrikes >= TIMEOUT_STRIKES_TO_KICK) {
    return applyForfeit(s, uid, rng, events);
  }
  const card = me.hand[rng.pickIndex(me.hand.length)];
  return applyPlay(s, uid, [card], rng, events);
}

// 主动退出 / 被踢出局（文档 §5.4）。
function applyForfeit(s: GameState, uid: string, rng: Rng, events: GameEvent[]): ReduceResult {
  const me = s.players[uid];
  const wasTurn = s.round?.turnUid === uid;
  me.alive = false;
  me.hand = [];
  events.push({ type: 'PLAYER_ELIMINATED', uid, reason: 'forfeit' });
  // 其桌面未验证的一手随其退出而免验、弃置（裁定记录）。
  if (s.round?.lastPlay?.uid === uid) s.round.lastPlay = null;

  if (aliveCount(s) <= 1) {
    const fin = finishGame(s, rng);
    return { state: fin.state, events: [...events, ...fin.events] };
  }
  if (wasTurn) {
    return advanceTurn(s, uid, rng, events);
  }
  // 当前回合不变，但少了一个有牌对手，可能触发 R-15。
  const round = s.round!;
  round.forcedReveal = computeForcedReveal(s, round.turnUid);
  s.rng = rng.getState();
  return { state: s, events };
}

// 进入待翻阶段（R-13 改）：判定已定，等对方 pickerUid 翻 judgedUid 的命运牌。
// 无合法对方（极端）→ 退化为随机翻。
function enterFatePhase(
  s: GameState,
  judgedUid: string,
  pickerUid: string,
  rng: Rng,
  events: GameEvent[],
): ReduceResult {
  const judged = s.players[judgedUid];
  if (!pickerUid || !s.players[pickerUid]?.alive) {
    const idx = judged.fateDeck.length > 0 ? rng.pickIndex(judged.fateDeck.length) : 0;
    return resolveFateAt(s, judgedUid, idx, rng, events);
  }
  const round = s.round!;
  round.phase = 'fate';
  round.pendingFate = { judgedUid, pickerUid };
  events.push({ type: 'FATE_PENDING', judgedUid, pickerUid, remaining: judged.fateDeck.length });
  s.rng = rng.getState();
  return { state: s, events };
}

// 翻开 judgedUid 命运牌的第 index 张（由对方选定的位置）并移出。
function resolveFateAt(
  s: GameState,
  judgedUid: string,
  index: number,
  rng: Rng,
  events: GameEvent[],
): ReduceResult {
  const p = s.players[judgedUid];
  const card = p.fateDeck.splice(index, 1)[0];
  const remaining = p.fateDeck.length;
  events.push({ type: 'FATE_DRAWN', uid: judgedUid, card, remaining });
  if (card === 'safe') {
    p.fateSafeRevealed += 1; // 安全牌永久移出
  } else {
    p.alive = false;
    p.hand = [];
    events.push({ type: 'PLAYER_ELIMINATED', uid: judgedUid, reason: 'bomb' });
  }
  s.lastJudgedUid = judgedUid; // R-7 下小局首家依据
  if (s.round) s.round.pendingFate = null;
  return concludeRound(s, rng, events, 'judged');
}

// 推进到下一行动者；无人可行动则按 R-14(b) 重发。
function advanceTurn(s: GameState, fromUid: string, rng: Rng, events: GameEvent[]): ReduceResult {
  const next = nextActorAfter(s, fromUid);
  if (next === null) {
    return concludeRound(s, rng, events, 'all_empty');
  }
  const round = s.round!;
  round.turnUid = next;
  round.forcedReveal = computeForcedReveal(s, next); // R-15
  round.phase = 'turn';
  s.rng = rng.getState();
  return { state: s, events };
}

// 小局结束（R-14）→ 开新小局（startRound 内部在仅剩 1 人时改为大局结束）。
function concludeRound(
  s: GameState,
  rng: Rng,
  events: GameEvent[],
  reason: 'judged' | 'all_empty',
): ReduceResult {
  events.push({ type: 'ROUND_ENDED', roundNo: s.round!.roundNo, reason });
  const res = startRound(s, rng);
  return { state: res.state, events: [...events, ...res.events] };
}

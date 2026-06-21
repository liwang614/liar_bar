// 大局建立、2 人局轮转与判胜、RNG 可复现。
import { describe, it, expect } from 'vitest';
import { createGame, createGameWithSeed } from '../game';
import { applyAction } from '../reduce';
import { createRng } from '../rng';
import { GAME_CONFIG } from '../config';
import { handIds, makeState, pickFate } from './helpers';

const seeds = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    uid: `P${i}`,
    nickname: `玩家${i}`,
    avatar: '🐱',
    seat: i,
  }));

const DECK_TOTAL = Object.values(GAME_CONFIG.DECK).reduce((a, b) => a + b, 0);

describe('大局建立 (R-5, R-6)', () => {
  it('4 人局：发满手牌、命运牌 6 张含 2 炸弹、余牌弃置', () => {
    const { state, events } = createGame(seeds(4), createRng(1));
    expect(state.status).toBe('playing');
    expect(state.round?.roundNo).toBe(1);
    for (const uid of state.seatOrder) {
      expect(state.players[uid].hand.length).toBe(GAME_CONFIG.HAND_SIZE);
      expect(state.players[uid].fateDeck.length).toBe(GAME_CONFIG.FATE_TOTAL);
      expect(state.players[uid].fateDeck.filter((f) => f === 'bomb').length).toBe(GAME_CONFIG.FATE_BOMBS);
    }
    expect(state.deck.length).toBe(DECK_TOTAL - 4 * GAME_CONFIG.HAND_SIZE);
    expect(events.map((e) => e.type)).toEqual(['ROUND_STARTED', 'THEME_ANNOUNCED']);
  });

  it('5 人局：每人发满 8 张、牌库足够', () => {
    const { state } = createGame(seeds(5), createRng(3));
    expect(state.seatOrder.length).toBe(5);
    for (const uid of state.seatOrder) {
      expect(state.players[uid].hand.length).toBe(GAME_CONFIG.HAND_SIZE);
    }
    expect(state.deck.length).toBe(DECK_TOTAL - 5 * GAME_CONFIG.HAND_SIZE);
  });

  it('3 人局：剩余牌弃置', () => {
    const { state } = createGame(seeds(3), createRng(7));
    expect(state.deck.length).toBe(DECK_TOTAL - 3 * GAME_CONFIG.HAND_SIZE);
  });

  it('RNG 同种子可复现完全一致的初始状态', () => {
    const a = createGameWithSeed(seeds(4), 42);
    const b = createGameWithSeed(seeds(4), 42);
    expect(a.state).toEqual(b.state);
  });
});

describe('2 人局与判胜 (R-16, R-17)', () => {
  it('2 人轮转：A 出牌后轮到 B', () => {
    const state = makeState({
      theme: 'cat',
      players: [{ uid: 'A', hand: ['cat', 'cat'] }, { uid: 'B', hand: ['cat', 'cat'] }],
      turnUid: 'A',
    });
    const res = applyAction(state, { type: 'PLAY_CARDS', uid: 'A', cardIds: handIds(state, 'A', 1) });
    expect(res.state.round?.turnUid).toBe('B');
  });

  it('判定致仅剩 1 人 → 大局结束并判胜', () => {
    const state = makeState({
      theme: 'cat',
      players: [{ uid: 'A', fate: ['bomb'] }, { uid: 'B', hand: ['cat'] }],
      turnUid: 'B',
      lastPlay: { uid: 'A', cards: ['dog'] },
    });
    const challenged = applyAction(state, { type: 'CHALLENGE', uid: 'B' });
    const res = pickFate(challenged.state, 0); // B 翻 A 的命运牌 → 炸弹
    expect(res.state.status).toBe('finished');
    expect(res.state.winnerUid).toBe('B');
    expect(res.events.map((e) => e.type)).toContain('GAME_WON');
  });
});

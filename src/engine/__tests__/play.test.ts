// R-8 / R-10 / R-11：出牌张数约束、cardIds 校验、轮转跳过、非当前回合拒绝。
import { describe, it, expect } from 'vitest';
import { applyAction } from '../reduce';
import { handIds, makeState, pickFate } from './helpers';

describe('出牌与轮转 (R-8, R-10, R-11)', () => {
  it('出牌 0 张被拒；4 张被拒；1~3 张允许', () => {
    const base = () =>
      makeState({
        theme: 'cat',
        players: [
          { uid: 'A', hand: ['cat', 'cat', 'cat', 'cat'] },
          { uid: 'B', hand: ['cat'] },
        ],
        turnUid: 'A',
      });
    expect(applyAction(base(), { type: 'PLAY_CARDS', uid: 'A', cardIds: [] }).rejected).toBeTruthy();
    const s = base();
    const four = handIds(s, 'A', 4);
    expect(applyAction(s, { type: 'PLAY_CARDS', uid: 'A', cardIds: four }).rejected).toBeTruthy();
    const two = handIds(s, 'A', 2);
    expect(applyAction(s, { type: 'PLAY_CARDS', uid: 'A', cardIds: two }).rejected).toBeUndefined();
  });

  it('cardIds 不属于手牌 → 被拒', () => {
    const state = makeState({
      theme: 'cat',
      players: [{ uid: 'A', hand: ['cat', 'cat'] }, { uid: 'B', hand: ['cat'] }],
      turnUid: 'A',
    });
    const res = applyAction(state, { type: 'PLAY_CARDS', uid: 'A', cardIds: ['不存在'] });
    expect(res.rejected?.reason).toBeTruthy();
  });

  it('非当前回合玩家的 action 被拒绝', () => {
    const state = makeState({
      theme: 'cat',
      players: [{ uid: 'A', hand: ['cat'] }, { uid: 'B', hand: ['cat'] }],
      turnUid: 'A',
    });
    const res = applyAction(state, { type: 'PLAY_CARDS', uid: 'B', cardIds: handIds(state, 'B', 1) });
    expect(res.rejected?.reason).toBeTruthy();
  });

  it('打空者被跳过；其最后一手仍可被质疑 (R-11)', () => {
    // A 出牌后应跳过手牌为 0 的 B，轮到 C。
    const skip = makeState({
      theme: 'cat',
      players: [
        { uid: 'A', hand: ['cat', 'cat'] },
        { uid: 'B', hand: [] }, // 已打空
        { uid: 'C', hand: ['cat'] },
      ],
      turnUid: 'A',
    });
    const afterPlay = applyAction(skip, { type: 'PLAY_CARDS', uid: 'A', cardIds: handIds(skip, 'A', 1) });
    expect(afterPlay.state.round?.turnUid).toBe('C');

    // C 可质疑已打空的 B 留在桌面的最后一手。
    const challengeable = makeState({
      theme: 'cat',
      players: [
        { uid: 'A', hand: ['cat'] },
        { uid: 'B', hand: [], fate: ['bomb'] },
        { uid: 'C', hand: ['cat'] },
      ],
      turnUid: 'C',
      lastPlay: { uid: 'B', cards: ['dog'] }, // B 的假牌
    });
    const res = applyAction(challengeable, { type: 'CHALLENGE', uid: 'C' });
    expect(res.rejected).toBeUndefined();
    expect(res.state.round?.pendingFate).toEqual({ judgedUid: 'B', pickerUid: 'C' });
    const res2 = pickFate(res.state, 0); // C 翻 B 的命运牌 → 炸弹
    expect(res2.state.players.B.alive).toBe(false);
  });
});

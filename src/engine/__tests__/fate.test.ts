// R-13：死亡判定——安全牌移出、概率随判定递增、炸弹即出局。
import { describe, it, expect } from 'vitest';
import { applyAction } from '../reduce';
import type { FateCard } from '../types';
import { makeState, pickFate } from './helpers';

// A 出假牌，B 质疑 → A 被判定，由 B 翻 A 的命运牌（第 0 张）。3 人局保证判定后大局不结束。
function judgeOnce(fate: FateCard[]) {
  const state = makeState({
    theme: 'cat',
    players: [
      { uid: 'A', fate },
      { uid: 'B', hand: ['cat'] },
      { uid: 'C', hand: ['cat'] },
    ],
    turnUid: 'B',
    lastPlay: { uid: 'A', cards: ['dog'] },
  });
  const challenged = applyAction(state, { type: 'CHALLENGE', uid: 'B' });
  const res = pickFate(challenged.state, 0);
  const drawn = res.events.find((e) => e.type === 'FATE_DRAWN');
  return { res, drawn };
}

describe('死亡判定 (R-13)', () => {
  it('炸弹 → 立即出局，剩余命运牌清零', () => {
    const { res, drawn } = judgeOnce(['bomb']);
    expect(drawn && 'card' in drawn && drawn.card).toBe('bomb');
    expect(res.state.players.A.alive).toBe(false);
    expect(res.state.players.A.hand.length).toBe(0); // 手牌弃置
  });

  it('安全 → 存活，安全牌永久移出（剩余张数减一）', () => {
    const { res, drawn } = judgeOnce(['safe', 'safe']); // 两张都安全，结果确定
    expect(drawn && 'card' in drawn && drawn.card).toBe('safe');
    expect(drawn && 'remaining' in drawn && drawn.remaining).toBe(1);
    expect(res.state.players.A.alive).toBe(true);
    expect(res.state.players.A.fateSafeRevealed).toBe(1);
  });

  it('概率序列机制：剩余命运牌张数随判定单调递减（1/6→1/5…）', () => {
    // 6 张全安全：单次判定后剩 5。
    const six = judgeOnce(['safe', 'safe', 'safe', 'safe', 'safe', 'safe']);
    expect(six.drawn && 'remaining' in six.drawn && six.drawn.remaining).toBe(5);
    // 模拟已判定一次后只剩 5 张：再判定后剩 4。
    const five = judgeOnce(['safe', 'safe', 'safe', 'safe', 'safe']);
    expect(five.drawn && 'remaining' in five.drawn && five.drawn.remaining).toBe(4);
  });
});

describe('对方翻牌（R-13 改：由对方揭牌）', () => {
  const base = () =>
    makeState({
      theme: 'cat',
      players: [
        { uid: 'A', fate: ['bomb', 'safe', 'bomb', 'safe'] }, // index 1/3 为安全
        { uid: 'B', hand: ['cat'] },
        { uid: 'C', hand: ['cat'] },
      ],
      turnUid: 'B',
      lastPlay: { uid: 'A', cards: ['dog'] }, // A 说谎 → A 被判定，B 翻牌
    });

  it('对方翻到安全位 → 判定者存活', () => {
    const challenged = applyAction(base(), { type: 'CHALLENGE', uid: 'B' });
    const res = pickFate(challenged.state, 1); // B 选了安全那张
    expect(res.state.players.A.alive).toBe(true);
    expect(res.state.players.A.fateSafeRevealed).toBe(1);
  });

  it('只有指定的对方能翻牌，其他人被拒', () => {
    const challenged = applyAction(base(), { type: 'CHALLENGE', uid: 'B' });
    // C 不是 picker
    expect(applyAction(challenged.state, { type: 'PICK_FATE', uid: 'C', index: 0 }).rejected).toBeTruthy();
    // 被判定者 A 自己也不能翻
    expect(applyAction(challenged.state, { type: 'PICK_FATE', uid: 'A', index: 0 }).rejected).toBeTruthy();
  });

  it('非 fate 阶段翻牌被拒', () => {
    const state = makeState({
      theme: 'cat',
      players: [{ uid: 'A', hand: ['cat'] }, { uid: 'B', hand: ['cat'] }],
      turnUid: 'A',
    });
    expect(applyAction(state, { type: 'PICK_FATE', uid: 'B', index: 0 }).rejected).toBeTruthy();
  });
});

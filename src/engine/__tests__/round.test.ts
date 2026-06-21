// R-14 小局结束路径 + R-7 下小局首家。
import { describe, it, expect } from 'vitest';
import { applyAction } from '../reduce';
import { makeState, pickFate } from './helpers';

describe('小局结束与首家 (R-14, R-7)', () => {
  it('R-14(a) 发生死亡判定 → 小局立即结束并重发', () => {
    const state = makeState({
      theme: 'cat',
      roundNo: 1,
      players: [
        { uid: 'A', fate: ['safe', 'safe'] }, // 安全，存活
        { uid: 'B', hand: ['cat'] },
        { uid: 'C', hand: ['cat'] },
      ],
      turnUid: 'B',
      lastPlay: { uid: 'A', cards: ['dog'] }, // A 说谎
    });
    const challenged = applyAction(state, { type: 'CHALLENGE', uid: 'B' });
    const res = pickFate(challenged.state, 0); // 由 B 翻 A 的命运牌（安全）
    expect(res.events.map((e) => e.type)).toContain('ROUND_ENDED');
    expect(res.state.round?.roundNo).toBe(2);
  });

  it('R-7 判定者存活则为下小局首家', () => {
    const state = makeState({
      theme: 'cat',
      roundNo: 1,
      players: [
        { uid: 'A', fate: ['safe', 'safe'] }, // 被判定但安全存活
        { uid: 'B', hand: ['cat'] },
        { uid: 'C', hand: ['cat'] },
      ],
      turnUid: 'B',
      lastPlay: { uid: 'A', cards: ['dog'] },
    });
    const challenged = applyAction(state, { type: 'CHALLENGE', uid: 'B' });
    const res = pickFate(challenged.state, 0); // 安全，A 存活
    expect(res.state.lastJudgedUid).toBe('A');
    expect(res.state.round?.turnUid).toBe('A'); // 判定者先手
  });
});

// R-15：最后持牌者强制验证模式的全部分支。
import { describe, it, expect } from 'vitest';
import { applyAction } from '../reduce';
import { handIds, makeState, pickFate } from './helpers';

describe('强制验证模式 (R-15)', () => {
  // A 是唯一持牌者（B 存活但手牌为 0），forcedReveal=true。
  const baseSpec = (aHand: string[]) =>
    ({
      theme: 'cat' as const,
      players: [
        { uid: 'A', hand: aHand as any, fate: ['bomb'] as any },
        { uid: 'B', hand: [] as any },
        { uid: 'C', hand: [] as any },
      ],
      turnUid: 'A',
      forcedReveal: true,
    });

  it('出含假牌 → 立即翻验，P 被判定，小局结束', () => {
    const state = makeState(baseSpec(['cat', 'cat', 'dog']));
    const dogId = state.players.A.hand.find((c) => c.kind === 'dog')!.id;
    const res = applyAction(state, { type: 'PLAY_CARDS', uid: 'A', cardIds: [dogId] });
    const reveal = res.events.find((e) => e.type === 'CARDS_REVEALED');
    expect(reveal && 'forced' in reveal && reveal.forced).toBe(true);
    expect(reveal && 'liar' in reveal && reveal.liar).toBe(true);
    // 强制验证被抓 → 由最近的其他存活者 B 翻 A 的命运牌。
    expect(res.state.round?.pendingFate?.judgedUid).toBe('A');
    expect(res.state.round?.pendingFate?.pickerUid).toBe('B');
    const res2 = pickFate(res.state, 0);
    expect(res2.state.players.A.alive).toBe(false); // 炸弹出局
  });

  it('出全真牌 → 无人判定，轮转后仍是 P，继续强制验证', () => {
    const state = makeState(baseSpec(['cat', 'cat', 'cat']));
    const res = applyAction(state, { type: 'PLAY_CARDS', uid: 'A', cardIds: handIds(state, 'A', 1) });
    expect(res.state.players.A.alive).toBe(true);
    expect(res.state.round?.turnUid).toBe('A');
    expect(res.state.round?.forcedReveal).toBe(true);
    expect(res.state.round?.lastPlay).toBeNull(); // 已验证、弃置
    expect(res.state.players.A.hand.length).toBe(2);
  });

  it('全真且打完最后一手 → 按 R-14(b) 重发新小局', () => {
    const state = makeState({ ...baseSpec(['cat']), roundNo: 3 });
    const res = applyAction(state, { type: 'PLAY_CARDS', uid: 'A', cardIds: handIds(state, 'A', 1) });
    expect(res.events.map((e) => e.type)).toContain('ROUND_ENDED');
    expect(res.state.round?.roundNo).toBe(4); // 已重发
    // 重发后所有存活者满手牌
    expect(res.state.players.A.hand.length).toBe(8);
    expect(res.state.players.B.hand.length).toBe(8);
  });
});

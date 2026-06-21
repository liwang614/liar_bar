// R-12 / R-2：质疑与验证、joker 判真。
import { describe, it, expect } from 'vitest';
import { applyAction } from '../reduce';
import type { GameEvent } from '../types';
import { makeState, pickFate } from './helpers';

function eventTypes(events: GameEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('质疑与验证 (R-12, R-2)', () => {
  it('质疑假牌 → 出牌者执行死亡判定', () => {
    // 3 人局，避免一次判定即结束大局，便于观察。
    const state = makeState({
      theme: 'cat',
      players: [
        { uid: 'A', fate: ['bomb'] }, // 出牌者，必中炸弹
        { uid: 'B', hand: ['cat'] }, // 质疑者
        { uid: 'C', hand: ['cat'] },
      ],
      turnUid: 'B',
      lastPlay: { uid: 'A', cards: ['cat', 'dog'] }, // 含假牌
    });
    const res = applyAction(state, { type: 'CHALLENGE', uid: 'B' });
    const reveal = res.events.find((e) => e.type === 'CARDS_REVEALED');
    expect(reveal && 'liar' in reveal && reveal.liar).toBe(true);
    expect(reveal && 'judgedUid' in reveal && reveal.judgedUid).toBe('A');
    // 进入待翻阶段，由对方 B 翻 A 的命运牌。
    expect(res.state.round?.phase).toBe('fate');
    expect(res.state.round?.pendingFate).toEqual({ judgedUid: 'A', pickerUid: 'B' });
    const res2 = pickFate(res.state, 0); // 翻到炸弹
    expect(res2.state.players.A.alive).toBe(false);
    expect(eventTypes(res2.events)).toContain('PLAYER_ELIMINATED');
  });

  it('质疑全真 → 质疑者执行死亡判定', () => {
    const state = makeState({
      theme: 'cat',
      players: [
        { uid: 'A', hand: ['cat'] },
        { uid: 'B', fate: ['bomb'] }, // 质疑者，冤枉好人，中炸弹
        { uid: 'C', hand: ['cat'] },
      ],
      turnUid: 'B',
      lastPlay: { uid: 'A', cards: ['cat', 'cat'] },
    });
    const res = applyAction(state, { type: 'CHALLENGE', uid: 'B' });
    const reveal = res.events.find((e) => e.type === 'CARDS_REVEALED');
    expect(reveal && 'liar' in reveal && reveal.liar).toBe(false);
    expect(reveal && 'judgedUid' in reveal && reveal.judgedUid).toBe('B');
    // 全真 → 质疑者 B 被判定，由对方 A 翻 B 的命运牌。
    expect(res.state.round?.pendingFate).toEqual({ judgedUid: 'B', pickerUid: 'A' });
    const res2 = pickFate(res.state, 0);
    expect(res2.state.players.B.alive).toBe(false);
  });

  it('含 joker 的混合手判真（joker 视为主题动物）', () => {
    const state = makeState({
      theme: 'sheep',
      players: [
        { uid: 'A', hand: ['sheep'] },
        { uid: 'B', fate: ['bomb'] },
        { uid: 'C', hand: ['sheep'] },
      ],
      turnUid: 'B',
      lastPlay: { uid: 'A', cards: ['sheep', 'joker', 'joker'] }, // 全部判真
    });
    const res = applyAction(state, { type: 'CHALLENGE', uid: 'B' });
    const reveal = res.events.find((e) => e.type === 'CARDS_REVEALED');
    expect(reveal && 'liar' in reveal && reveal.liar).toBe(false);
    // 质疑者 B 被判定，由对方 A 翻牌
    const res2 = pickFate(res.state, 0);
    expect(res2.state.players.B.alive).toBe(false);
  });

  it('小局第一个行动者无可质疑对象 → CHALLENGE 被拒（R-9）', () => {
    const state = makeState({
      theme: 'cat',
      players: [{ uid: 'A', hand: ['cat'] }, { uid: 'B', hand: ['cat'] }],
      turnUid: 'A',
    });
    const res = applyAction(state, { type: 'CHALLENGE', uid: 'A' });
    expect(res.rejected?.reason).toBeTruthy();
  });
});

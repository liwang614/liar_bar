// 翻倍质疑：判负方翻 2 张命运牌（成功翻对面两张、失败自己被翻两张）。
import { describe, it, expect } from 'vitest';
import { applyAction } from '../reduce';
import type { FateCard, GameState } from '../types';
import { makeState } from './helpers';

// 由当前 pendingFate 的 picker 翻第 index 张。
function pick(state: GameState, index = 0) {
  const pf = state.round!.pendingFate!;
  return applyAction(state, { type: 'PICK_FATE', uid: pf.pickerUid, index });
}

// A 出假牌(dog≠cat)、B 翻倍质疑 → A 判负，由 B 翻 A 的命运牌。3 人局保证判定后不结束大局。
function setup(aFate: FateCard[]) {
  return makeState({
    theme: 'cat',
    players: [
      { uid: 'A', fate: aFate },
      { uid: 'B', hand: ['cat'] },
      { uid: 'C', hand: ['cat'] },
    ],
    turnUid: 'B',
    lastPlay: { uid: 'A', cards: ['dog'] },
  });
}

describe('翻倍质疑', () => {
  it('成功（对面说谎）→ 翻对面两张牌，两张安全则判负方存活', () => {
    const ch = applyAction(setup(['safe', 'safe', 'safe', 'safe', 'safe', 'bomb']), {
      type: 'DOUBLE_CHALLENGE',
      uid: 'B',
    });
    expect(ch.state.round!.phase).toBe('fate');
    expect(ch.state.round!.pendingFate!.flipsLeft).toBe(2);

    const r1 = pick(ch.state, 0); // 翻到 safe
    expect(r1.state.round!.phase).toBe('fate'); // 仍需再翻一张
    expect(r1.state.round!.pendingFate!.flipsLeft).toBe(1);
    expect(r1.state.players.A.alive).toBe(true);

    const r2 = pick(r1.state, 0); // 再翻 safe → 收束
    expect(r2.state.players.A.alive).toBe(true);
    expect(r2.state.players.A.fateSafeRevealed).toBe(2); // 共移出 2 张安全
    expect(r2.state.round!.pendingFate).toBe(null);
  });

  it('失败（对面全真）→ 质疑者自己被翻两张', () => {
    const ch = applyAction(
      makeState({
        theme: 'cat',
        players: [
          { uid: 'A', hand: ['cat'] },
          { uid: 'B', fate: ['safe', 'safe', 'safe', 'safe', 'safe', 'bomb'] },
          { uid: 'C', hand: ['cat'] },
        ],
        turnUid: 'B',
        lastPlay: { uid: 'A', cards: ['cat'] }, // A 全真
      }),
      { type: 'DOUBLE_CHALLENGE', uid: 'B' },
    );
    const pf = ch.state.round!.pendingFate!;
    expect(pf.judgedUid).toBe('B'); // 质疑者判负
    expect(pf.pickerUid).toBe('A'); // 由对方(A)翻 B 的牌
    expect(pf.flipsLeft).toBe(2);

    const r2 = pick(pick(ch.state, 0).state, 0);
    expect(r2.state.players.B.fateSafeRevealed).toBe(2);
  });

  it('第一张翻到炸弹 → 立即出局，不再翻第二张', () => {
    const ch = applyAction(setup(['bomb', 'safe', 'safe', 'safe', 'safe', 'safe']), {
      type: 'DOUBLE_CHALLENGE',
      uid: 'B',
    });
    const r1 = pick(ch.state, 0); // index0 = bomb
    expect(r1.state.players.A.alive).toBe(false);
    expect(r1.state.round!.pendingFate).toBe(null); // 已收束，不再等第二翻
    expect(r1.events.filter((e) => e.type === 'FATE_DRAWN').length).toBe(1);
  });

  it('判负方仅剩 1 张命运牌 → 翻倍也只翻 1 张', () => {
    const ch = applyAction(setup(['safe']), { type: 'DOUBLE_CHALLENGE', uid: 'B' });
    const r1 = pick(ch.state, 0);
    expect(r1.state.players.A.alive).toBe(true);
    expect(r1.state.players.A.fateSafeRevealed).toBe(1);
    expect(r1.state.round!.pendingFate).toBe(null); // 无牌可翻，已收束
  });

  it('普通质疑仍只翻 1 张（回归）', () => {
    const ch = applyAction(setup(['safe', 'safe', 'safe', 'safe', 'safe', 'bomb']), {
      type: 'CHALLENGE',
      uid: 'B',
    });
    expect(ch.state.round!.pendingFate!.flipsLeft).toBe(1);
    const r1 = pick(ch.state, 0);
    expect(r1.state.round!.pendingFate).toBe(null);
    expect(r1.state.players.A.fateSafeRevealed).toBe(1);
  });
});

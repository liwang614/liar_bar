// WinStore：按昵称持久化胜场。用 :memory: 库，确定性、无文件副作用。
import { describe, it, expect } from 'vitest';
import { WinStore } from '../winStore';

const mem = () => new WinStore(':memory:');

describe('WinStore', () => {
  it('未知昵称胜场为 0', () => {
    expect(mem().getWins('小明')).toBe(0);
  });

  it('addWin 自增并返回新值、可持久查询', () => {
    const s = mem();
    expect(s.addWin('小明')).toBe(1);
    expect(s.addWin('小明')).toBe(2);
    expect(s.getWins('小明')).toBe(2);
    expect(s.getWins('小红')).toBe(0); // 互不影响
  });

  it('seed 取较大值（迁移老 localStorage 数据，不回退）', () => {
    const s = mem();
    expect(s.seed('小明', 5)).toBe(5); // 首次写入
    expect(s.seed('小明', 3)).toBe(5); // 上报更小 → 保持 5
    expect(s.seed('小明', 8)).toBe(8); // 上报更大 → 升到 8
  });

  it('seed 后 addWin 在其基础上累加（跨设备：先读存档再赢）', () => {
    const s = mem();
    s.seed('小明', 5);
    expect(s.addWin('小明')).toBe(6);
  });

  it('空白昵称不落库、恒返回 0', () => {
    const s = mem();
    expect(s.addWin('   ')).toBe(0);
    expect(s.seed('', 9)).toBe(0);
    expect(s.getWins('')).toBe(0);
  });

  it('昵称首尾空白被规整为同一条记录', () => {
    const s = mem();
    s.addWin('小明');
    expect(s.getWins('  小明  ')).toBe(1);
    expect(s.addWin('  小明 ')).toBe(2);
  });
});

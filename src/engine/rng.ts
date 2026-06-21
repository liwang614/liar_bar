// 可注入、可序列化的确定性 RNG（mulberry32）。
// 所有随机（洗牌/抽命运牌/定主题/首家）必须走这里，保证单测复现与裁判接管可重放。

export interface RngState {
  seed: number; // 当前内部状态（32 位无符号）
}

export interface Rng {
  // 返回 [0,1) 随机数并推进状态。
  next(): number;
  // 返回 [0,n) 的整数索引。
  pickIndex(n: number): number;
  // 原地 Fisher–Yates 洗牌，返回同一数组引用。
  shuffle<T>(arr: T[]): T[];
  // 导出当前可序列化状态。
  getState(): RngState;
}

// 用数字种子或已有 RngState 创建 RNG。
export function createRng(seed: number | RngState): Rng {
  let s = (typeof seed === 'number' ? seed : seed.seed) >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pickIndex = (n: number): number => Math.floor(next() * n);

  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = pickIndex(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  return {
    next,
    pickIndex,
    shuffle,
    getState: () => ({ seed: s >>> 0 }),
  };
}

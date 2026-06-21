// 命运牌格：● 未翻 / ✓ 已翻安全 / 💥 炸弹出局。
import { GAME_CONFIG } from '../engine';

interface Props {
  remaining: number;
  safeRevealed: number;
  eliminated: boolean;
}

export default function FateRow({ remaining, safeRevealed, eliminated }: Props) {
  const total = GAME_CONFIG.FATE_TOTAL;
  const cells = [];
  for (let i = 0; i < safeRevealed; i++) cells.push('✓');
  for (let i = 0; i < remaining; i++) cells.push('●');
  if (eliminated) cells.push('💥');
  // 补齐到 total（防御性）。
  while (cells.length < total) cells.push('·');

  return (
    <span className={`font-mono text-sm tracking-tight ${eliminated ? 'opacity-50' : ''}`}>
      [{cells.join('')}]
    </span>
  );
}

// 把事件流转成中文文案（驱动日志与状态提示，文档 §4.3）。
import type { Card } from '../engine';
import { ANIMAL_NAME, CARD_EMOJI } from './visuals';
import type { PublicRoom } from '../net/protocol';

interface EventLike {
  type: string;
  payload: Record<string, unknown>;
}

export function eventText(e: EventLike, room: PublicRoom | null): string {
  const p = e.payload;
  const name = (uid: unknown): string => {
    const u = uid as string;
    return room?.players[u]?.nickname ?? u ?? '?';
  };
  const cardStr = (cards: unknown): string =>
    Array.isArray(cards) ? (cards as Card[]).map((c) => CARD_EMOJI[c.kind]).join(' ') : '';

  switch (e.type) {
    case 'ROUND_STARTED':
      return `—— 第 ${p.roundNo} 小局开始，${name(p.turnUid)} 先手 ——`;
    case 'THEME_ANNOUNCED':
      return `本局主题：${ANIMAL_NAME[p.themeAnimal as keyof typeof ANIMAL_NAME]}`;
    case 'CARDS_PLAYED':
      return `${name(p.uid)} 打出 ${p.count} 张牌`;
    case 'CHALLENGE_DECLARED':
      return p.double
        ? `${name(p.challengerUid)} 翻倍质疑 ${name(p.targetUid)}！（翻 2 张）`
        : `${name(p.challengerUid)} 质疑了 ${name(p.targetUid)}！`;
    case 'CARDS_REVEALED':
      return p.forced
        ? `强制翻验 ${name(p.playerUid)}：${cardStr(p.cards)} → ${p.liar ? '有假！' : '全真'}`
        : `翻验：${cardStr(p.cards)} → ${p.liar ? '说谎被抓！' : '全真，冤枉好人'}`;
    case 'FATE_PENDING':
      return `${name(p.pickerUid)} 来翻 ${name(p.judgedUid)} 的命运牌…`;
    case 'FATE_DRAWN':
      return p.card === 'bomb'
        ? `💥 砰！${name(p.uid)} 翻到炸弹`
        : `呼——安全（剩余 ${p.remaining} 张命运牌）`;
    case 'PLAYER_ELIMINATED':
      return `☠ ${name(p.uid)} 出局`;
    case 'ROUND_ENDED':
      return p.reason === 'all_empty' ? '本小局无人受罚，重新发牌' : '本小局结束';
    case 'GAME_WON':
      return `🏆 ${name(p.uid)} 获胜！`;
    default:
      return '';
  }
}

// 卡面与主题的 emoji 映射，全中文 UI 复用。
import type { Animal, CardKind } from '../engine';

export const CARD_EMOJI: Record<CardKind, string> = {
  cat: '🐱',
  dog: '🐶',
  sheep: '🐑',
  joker: '🃏',
};

export const ANIMAL_NAME: Record<Animal, string> = {
  cat: '猫',
  dog: '狗',
  sheep: '羊',
};

export const AVATARS = ['🐱', '🐶', '🐑', '🦊', '🐮', '🐷', '🐰', '🐼'];

// 对局页（移动端竖屏）：玩家分列两侧、当前行动者头像高亮、事件按节奏播报。
// 视觉与首页/准备页统一（烛光酒馆主题），逻辑接真实 useGameStore。
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { GAME_CONFIG } from '../engine';
import FateRow from '../components/FateRow';
import { eventText } from '../components/eventText';
import { ANIMAL_NAME, CARD_EMOJI } from '../components/visuals';
import type { PublicPlayer } from '../net/protocol';
import { useGameStore } from '../store/useGameStore';

function useNow(intervalMs = 400): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// 侧边对手卡片。active 时头像高亮。
function OpponentChip({ p, active }: { p: PublicPlayer; active: boolean }) {
  return (
    <div className={`flex w-20 flex-col items-center text-center ${p.alive ? '' : 'opacity-40'}`}>
      <motion.div
        animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={active ? { duration: 1.4, repeat: Infinity } : { duration: 0.2 }}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition ${
          active
            ? 'bg-amber-400/25 ring-2 ring-amber-300 shadow-[0_0_22px_rgba(245,176,65,0.6)]'
            : 'bg-[#241813] ring-1 ring-amber-100/10'
        }`}
      >
        {p.avatar}
      </motion.div>
      <div className="mt-0.5 w-full truncate text-xs text-amber-100/85">{p.nickname}</div>
      <div className="text-[10px] text-amber-100/45">
        🏆{p.wins} ✋{p.handCount}
      </div>
      <FateRow remaining={p.fateRemaining} safeRevealed={p.fateSafeRevealed} eliminated={!p.alive} />
    </div>
  );
}

export default function Game() {
  const { uid, room, hand, events, banner, send } = useGameStore();
  const [selected, setSelected] = useState<string[]>([]);
  const now = useNow();

  const roundNo = room?.round?.roundNo;
  const turnUid = room?.round?.turnUid;
  const phase = room?.round?.phase;
  useEffect(() => {
    setSelected([]);
  }, [roundNo, turnUid, phase]);

  const logLines = useMemo(
    () => events.slice(-5).map((e) => ({ id: e.id, text: eventText(e, room) })),
    [events, room],
  );

  if (!room || !room.round || !uid) return null;
  const round = room.round;
  const me = room.players[uid];
  const pf = round.pendingFate;
  const myTurn = round.phase === 'turn' && round.turnUid === uid && me?.alive;
  const iPickFate = round.phase === 'fate' && pf?.pickerUid === uid;

  // 当前“行动者”：出牌阶段是 turnUid；翻牌阶段是 picker。
  const activeUid = round.phase === 'fate' && pf ? pf.pickerUid : round.turnUid;

  // 从“我”的下家开始按座位（出牌）顺序排列对手，使高亮顺时针流动：
  // 左列自下而上（下家在最底、紧挨“我”），接右列自上而下，最后回到“我”。
  const myIdx = room.seatOrder.indexOf(uid);
  const ordered = [...room.seatOrder.slice(myIdx + 1), ...room.seatOrder.slice(0, myIdx)].map(
    (u) => room.players[u],
  );
  const mid = Math.ceil(ordered.length / 2);
  const leftOpps = ordered.slice(0, mid).reverse();
  const rightOpps = ordered.slice(mid);
  const theme = ANIMAL_NAME[round.themeAnimal];
  const turnPlayer = room.players[round.turnUid];

  const canPlay = !!myTurn && selected.length >= GAME_CONFIG.MIN_PLAY && selected.length <= GAME_CONFIG.MAX_PLAY;
  const canChallenge = !!myTurn && !!round.lastPlay && !round.forcedReveal;

  const toggle = (id: string) => {
    setSelected((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= GAME_CONFIG.MAX_PLAY
          ? cur
          : [...cur, id],
    );
  };

  const remainingSec = round.turnDeadline ? Math.max(0, (round.turnDeadline - now) / 1000) : 0;
  const pct = Math.min(100, (remainingSec / GAME_CONFIG.TURN_TIMEOUT_SEC) * 100);
  const meActive = activeUid === uid;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden text-amber-50">
      {/* 全屏烛光背景层 */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_8%,rgba(255,184,77,0.2),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(143,66,38,0.22),transparent_36%),linear-gradient(135deg,#2b1712_0%,#1d1410_38%,#0e1f20_74%,#241710_100%)]" />
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-25 bg-[linear-gradient(90deg,rgba(255,214,128,0.07)_1px,transparent_1px),linear-gradient(rgba(255,214,128,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* 牌桌：左右两列对手 + 中央信息（内容过高时本区域可滚动，底部操作栏保持固定） */}
      <div className="flex flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-3 p-2 pt-3">
          {leftOpps.map((p) => (
            <OpponentChip key={p.uid} p={p} active={activeUid === p.uid} />
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-2">
          <div className="flex items-center gap-2 rounded-full border border-amber-100/15 bg-[#1c1512]/70 px-4 py-1.5 text-sm text-amber-100/80 backdrop-blur">
            主题 <span className="text-2xl">{CARD_EMOJI[round.themeAnimal]}</span>
            <span className="font-serif text-amber-200">{theme}</span>
            <span className="ml-1 text-xs text-amber-100/40">第 {round.roundNo} 局</span>
          </div>

          {round.lastPlay ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex gap-1">
                {Array.from({ length: round.lastPlay.count }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-14 w-10 items-center justify-center rounded-lg border border-amber-200/25 bg-gradient-to-br from-[#6d3f1f] to-[#3a2113] text-xl text-amber-100/80 shadow-[0_6px_14px_rgba(0,0,0,0.4)]"
                  >
                    🂠
                  </div>
                ))}
              </div>
              <div className="text-sm text-amber-100/70">「{round.lastPlay.count} 张{theme}」</div>
            </div>
          ) : (
            <div className="text-sm text-amber-100/40">等待首家出牌…</div>
          )}

          {/* 动作提示横幅 / 状态文案 */}
          <div className="flex min-h-[3rem] items-center px-2 text-center">
            {banner ? (
              <motion.span
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-base font-bold text-amber-200 shadow-[0_0_24px_rgba(245,176,65,0.35)]"
              >
                {banner}
              </motion.span>
            ) : round.phase === 'fate' && pf ? (
              iPickFate ? (
                <span className="text-amber-300">
                  你来替 {room.players[pf.judgedUid]?.nickname} 翻一张命运牌！翻到 💥 他就输
                </span>
              ) : pf.judgedUid === uid ? (
                <span className="text-rose-300">等待对方翻你的命运牌…🙏 别炸</span>
              ) : (
                <span className="text-amber-100/60">
                  {room.players[pf.pickerUid]?.nickname} 正在翻 {room.players[pf.judgedUid]?.nickname} 的命运牌…
                </span>
              )
            ) : (
              <span className="text-teal-200">
                {round.forcedReveal && round.turnUid === uid && '⚠ 强制验证 · '}
                {myTurn ? '轮到你了！' : `等待 ${turnPlayer?.nickname ?? ''} 出牌…`}
              </span>
            )}
          </div>

          {round.turnDeadline && !banner && (
            <div className="h-2 w-40 overflow-hidden rounded-full bg-[#241813] ring-1 ring-amber-100/10">
              <div
                className="h-full bg-gradient-to-r from-[#c3832f] to-[#f0b955] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 p-2 pt-3">
          {rightOpps.map((p) => (
            <OpponentChip key={p.uid} p={p} active={activeUid === p.uid} />
          ))}
        </div>
      </div>

      {/* 事件日志 */}
      <div className="max-h-20 overflow-y-auto border-t border-amber-100/10 bg-[#160f0c]/50 px-3 py-1.5 text-xs text-amber-100/40 backdrop-blur">
        {logLines.map((l) => (
          <div key={l.id}>{l.text}</div>
        ))}
      </div>

      {/* 本人区 */}
      <div
        className={`border-t p-3 backdrop-blur transition ${
          meActive ? 'border-amber-300/60 bg-amber-400/[0.07]' : 'border-amber-100/10 bg-[#160f0c]/40'
        }`}
      >
        <div className="mb-2 flex items-center gap-2 text-sm text-amber-100/85">
          <span className={`text-xl ${meActive ? 'drop-shadow-[0_0_12px_rgba(245,176,65,0.7)]' : ''}`}>
            {me?.avatar}
          </span>
          <span>你 🏆{me?.wins}</span>
          <FateRow remaining={me.fateRemaining} safeRevealed={me.fateSafeRevealed} eliminated={!me.alive} />
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {hand.map((c) => (
            <motion.button
              key={c.id}
              onClick={() => toggle(c.id)}
              disabled={!myTurn}
              whileTap={myTurn ? { scale: 0.94 } : undefined}
              className={`flex h-16 w-11 items-center justify-center rounded-lg border text-2xl transition ${
                selected.includes(c.id)
                  ? '-translate-y-2 border-amber-200 bg-gradient-to-b from-[#c3832f] to-[#8b451e] shadow-[0_0_20px_rgba(234,179,8,0.4)]'
                  : 'border-amber-100/15 bg-[#2a1c14]'
              } ${myTurn ? '' : 'opacity-60'}`}
            >
              {CARD_EMOJI[c.kind]}
            </motion.button>
          ))}
          {hand.length === 0 && <span className="text-sm text-amber-100/40">本小局手牌已打空</span>}
        </div>

        {iPickFate && pf ? (
          <div>
            <div className="mb-2 text-sm text-amber-300">
              点一张翻开 {room.players[pf.judgedUid]?.nickname} 的命运牌：
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: pf.remaining }).map((_, i) => (
                <motion.button
                  key={i}
                  onClick={() => send({ type: 'PICK_FATE', index: i })}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.94 }}
                  className="flex h-16 w-12 items-center justify-center rounded-lg border border-purple-300/30 bg-gradient-to-br from-[#5b2a7a] to-[#321046] text-2xl text-purple-100 shadow-[0_8px_18px_rgba(80,30,120,0.4)]"
                >
                  ❔
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <motion.button
              onClick={() => send({ type: 'CHALLENGE' })}
              disabled={!canChallenge}
              whileHover={canChallenge ? { scale: 1.02 } : undefined}
              whileTap={canChallenge ? { scale: 0.97 } : undefined}
              className="flex-1 rounded-2xl border border-rose-200/25 bg-gradient-to-br from-[#7a2230] to-[#4a1118] py-3 font-semibold text-rose-50 shadow-[0_10px_22px_rgba(120,30,45,0.3)] transition disabled:opacity-30"
            >
              质疑上家
            </motion.button>
            <motion.button
              onClick={() => {
                send({ type: 'PLAY_CARDS', cardIds: selected });
                setSelected([]);
              }}
              disabled={!canPlay}
              whileHover={canPlay ? { scale: 1.02 } : undefined}
              whileTap={canPlay ? { scale: 0.97 } : undefined}
              className="flex-1 rounded-2xl border border-amber-200/35 bg-gradient-to-r from-[#8b451e] via-[#c3832f] to-[#f0b955] py-3 font-semibold text-[#241209] shadow-[0_10px_22px_rgba(174,101,30,0.28)] transition disabled:opacity-30"
            >
              出牌 ({selected.length})
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}

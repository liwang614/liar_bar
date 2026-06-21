// 对局页（移动端竖屏）：玩家分列两侧、当前行动者头像高亮、事件按节奏播报。
import { useEffect, useMemo, useState } from 'react';
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
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition ${
          active ? 'bg-amber-400/30 ring-4 ring-amber-400 animate-pulse' : 'bg-slate-800'
        }`}
      >
        {p.avatar}
      </div>
      <div className="mt-0.5 w-full truncate text-xs text-slate-200">{p.nickname}</div>
      <div className="text-[10px] text-slate-400">
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
    <div className="flex flex-1 flex-col bg-slate-950">
      {/* 牌桌：左右两列对手 + 中央信息 */}
      <div className="flex flex-1">
        <div className="flex flex-col gap-3 p-2 pt-3">
          {leftOpps.map((p) => (
            <OpponentChip key={p.uid} p={p} active={activeUid === p.uid} />
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-2">
          <div className="text-base text-slate-300">
            主题 <span className="text-2xl">{CARD_EMOJI[round.themeAnimal]}</span> {theme}
            <span className="ml-2 text-xs text-slate-500">第 {round.roundNo} 局</span>
          </div>

          {round.lastPlay ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {Array.from({ length: round.lastPlay.count }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-14 w-10 items-center justify-center rounded-md bg-slate-700 text-xl shadow"
                  >
                    🂠
                  </div>
                ))}
              </div>
              <div className="text-sm text-slate-300">「{round.lastPlay.count} 张{theme}」</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">等待首家出牌…</div>
          )}

          {/* 动作提示横幅 / 状态文案 */}
          <div className="flex min-h-[3rem] items-center px-2 text-center">
            {banner ? (
              <span className="rounded-lg bg-amber-500/20 px-4 py-2 text-base font-bold text-amber-200 animate-pulse">
                {banner}
              </span>
            ) : round.phase === 'fate' && pf ? (
              iPickFate ? (
                <span className="text-amber-300">
                  你来替 {room.players[pf.judgedUid]?.nickname} 翻一张命运牌！翻到 💥 他就输
                </span>
              ) : pf.judgedUid === uid ? (
                <span className="text-rose-300">等待对方翻你的命运牌…🙏 别炸</span>
              ) : (
                <span className="text-slate-300">
                  {room.players[pf.pickerUid]?.nickname} 正在翻 {room.players[pf.judgedUid]?.nickname} 的命运牌…
                </span>
              )
            ) : (
              <span className="text-emerald-300">
                {round.forcedReveal && round.turnUid === uid && '⚠ 强制验证 · '}
                {myTurn ? '轮到你了！' : `等待 ${turnPlayer?.nickname ?? ''} 出牌…`}
              </span>
            )}
          </div>

          {round.turnDeadline && !banner && (
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
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
      <div className="max-h-20 overflow-y-auto border-t border-slate-800 px-3 py-1.5 text-xs text-slate-500">
        {logLines.map((l) => (
          <div key={l.id}>{l.text}</div>
        ))}
      </div>

      {/* 本人区 */}
      <div className={`border-t p-3 ${meActive ? 'border-amber-400 bg-amber-400/5' : 'border-slate-800'}`}>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <span className={`text-xl ${meActive ? 'animate-pulse' : ''}`}>{me?.avatar}</span>
          <span>你 🏆{me?.wins}</span>
          <FateRow remaining={me.fateRemaining} safeRevealed={me.fateSafeRevealed} eliminated={!me.alive} />
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          {hand.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              disabled={!myTurn}
              className={`flex h-16 w-11 items-center justify-center rounded-md text-2xl transition-transform ${
                selected.includes(c.id) ? '-translate-y-2 bg-emerald-600' : 'bg-slate-700'
              } ${myTurn ? '' : 'opacity-60'}`}
            >
              {CARD_EMOJI[c.kind]}
            </button>
          ))}
          {hand.length === 0 && <span className="text-sm text-slate-500">本小局手牌已打空</span>}
        </div>

        {iPickFate && pf ? (
          <div>
            <div className="mb-2 text-sm text-amber-300">
              点一张翻开 {room.players[pf.judgedUid]?.nickname} 的命运牌：
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: pf.remaining }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => send({ type: 'PICK_FATE', index: i })}
                  className="flex h-16 w-12 items-center justify-center rounded-md bg-purple-700 text-2xl active:bg-purple-500"
                >
                  ❔
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => send({ type: 'CHALLENGE' })}
              disabled={!canChallenge}
              className="flex-1 rounded-lg bg-rose-600 py-3 font-semibold disabled:opacity-30"
            >
              质疑上家
            </button>
            <button
              onClick={() => {
                send({ type: 'PLAY_CARDS', cardIds: selected });
                setSelected([]);
              }}
              disabled={!canPlay}
              className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold disabled:opacity-30"
            >
              出牌 ({selected.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

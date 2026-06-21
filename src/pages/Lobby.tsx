// 等待页：房间码展示+复制、玩家列表与准备、房主开始游戏。
// 视觉与首页统一（烛光酒馆主题），逻辑接真实 useGameStore。
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Users, Crown, Play, LogOut } from 'lucide-react';
import { GAME_CONFIG } from '../engine';
import { useGameStore } from '../store/useGameStore';

export default function Lobby() {
  const { uid, room, roomCode, setReady, startGame, leaveRoom } = useGameStore();
  const [copied, setCopied] = useState(false);

  // 背景金色尘埃粒子（与首页一致的确定性布局）。
  const motes = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: (i * 29) % 100,
        top: (i * 47) % 100,
        size: 1 + (i % 4),
        delay: (i % 9) * 0.35,
        gold: i % 3 !== 0,
      })),
    [],
  );

  if (!room || !roomCode) return null;

  const players = room.seatOrder.map((u) => room.players[u]).filter(Boolean);
  const me = room.players[uid];
  const isHost = room.hostUid === uid;
  const allReady = players.length >= GAME_CONFIG.MIN_PLAYERS && players.every((p) => p.ready);

  const copy = () => {
    void navigator.clipboard
      ?.writeText(roomCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-4 py-8 text-amber-50">
      {/* 全屏背景层：fixed 脱离父级 max-w-md，铺满视口 */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_8%,rgba(255,184,77,0.26),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(143,66,38,0.24),transparent_34%),linear-gradient(135deg,#2b1712_0%,#221713_34%,#102324_72%,#2a1b13_100%)]" />
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-35 bg-[linear-gradient(90deg,rgba(255,214,128,0.08)_1px,transparent_1px),linear-gradient(rgba(255,214,128,0.05)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="fixed -left-20 bottom-0 -z-10 h-72 w-[120%] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(122,70,36,0.5),rgba(28,17,14,0.1)_60%,transparent_70%)]" />

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {motes.map((mote, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full blur-[0.5px]"
            style={{
              width: mote.size,
              height: mote.size,
              left: `${mote.left}%`,
              top: `${mote.top}%`,
              background: mote.gold ? 'rgba(255,207,112,0.72)' : 'rgba(163,230,211,0.35)',
            }}
            animate={{ opacity: [0.15, 0.9, 0.15], y: [0, -18, 0], scale: [1, 1.5, 1] }}
            transition={{ duration: 3.2 + (i % 5) * 0.45, repeat: Infinity, delay: mote.delay }}
          />
        ))}
      </div>

      <motion.main
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative my-auto flex w-full max-w-[470px] flex-col gap-4"
      >
        {/* 房间码卡片 */}
        <section className="rounded-[28px] border border-amber-200/20 bg-[#1c1512]/80 p-6 text-center shadow-[0_30px_80px_rgba(22,10,5,0.55),inset_0_1px_0_rgba(255,236,179,0.13)] backdrop-blur-xl">
          <p className="text-xs tracking-[0.4em] text-amber-100/55">房 间 码</p>
          <motion.button
            onClick={copy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="mt-2 inline-flex items-center gap-3 font-serif text-5xl font-bold tracking-[0.28em] bg-gradient-to-b from-[#ffe7a3] via-[#d99a32] to-[#7b3f18] bg-clip-text text-transparent drop-shadow-[0_3px_20px_rgba(255,170,57,0.35)]"
          >
            {roomCode}
            <span className="text-amber-200/70">
              {copied ? <Check size={20} /> : <Copy size={18} />}
            </span>
          </motion.button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-100/40">
            {copied ? '已复制到剪贴板' : '点击复制 · 分享给好友入座'}
          </p>
        </section>

        {/* 玩家列表 */}
        <section className="overflow-hidden rounded-[24px] border border-amber-100/12 bg-[#1c1512]/70 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-amber-100/10 px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm text-amber-100/70">
              <Users size={15} />
              <span>今夜同桌</span>
            </div>
            <span className="rounded-full bg-amber-300/15 px-2.5 py-0.5 text-xs text-amber-200">
              {players.length}/{GAME_CONFIG.MAX_PLAYERS} 人
            </span>
          </div>
          <div className="space-y-2 p-3">
            <AnimatePresence>
              {players.map((p, i) => {
                const isMe = p.uid === uid;
                return (
                  <motion.div
                    key={p.uid}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                      isMe
                        ? 'border-amber-200/40 bg-amber-200/10'
                        : 'border-amber-100/10 bg-amber-50/[0.045]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/25 to-orange-900/30 text-xl">
                        {p.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-amber-50">{p.nickname}</span>
                          {isMe && <span className="text-[10px] text-amber-100/40">（你）</span>}
                          {p.uid === room.hostUid && (
                            <span className="flex items-center gap-0.5 rounded-md bg-amber-300/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                              <Crown size={10} />
                              房主
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-100/42">
                          🏆 {p.wins} 胜
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        p.ready
                          ? 'bg-emerald-400/15 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.25)]'
                          : 'bg-amber-50/[0.05] text-amber-100/40'
                      }`}
                    >
                      {p.ready ? '已就位' : '未就位'}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* 操作区 */}
        <div className="mt-2 flex flex-col gap-3">
          <motion.button
            onClick={() => setReady(!me?.ready)}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full rounded-2xl border py-3.5 font-semibold transition ${
              me?.ready
                ? 'border-amber-100/15 bg-[#211713]/80 text-amber-100/70'
                : 'border-amber-200/35 bg-gradient-to-r from-[#8b451e] via-[#c3832f] to-[#f0b955] text-[#241209] shadow-[0_12px_28px_rgba(174,101,30,0.28)]'
            }`}
          >
            {me?.ready ? '取消准备' : '准备'}
          </motion.button>

          {isHost && (
            <motion.button
              onClick={() => startGame()}
              disabled={!allReady}
              whileHover={allReady ? { scale: 1.015 } : undefined}
              whileTap={allReady ? { scale: 0.98 } : undefined}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-teal-100/25 bg-gradient-to-br from-[#1d6b67] to-[#123f42] py-3.5 font-semibold text-teal-50 shadow-[0_12px_24px_rgba(20,100,96,0.24)] transition disabled:opacity-40"
            >
              <Play size={17} /> 开始游戏
            </motion.button>
          )}

          <button
            onClick={() => leaveRoom()}
            className="flex items-center justify-center gap-1.5 py-1 text-sm text-amber-100/35 transition hover:text-amber-100/60"
          >
            <LogOut size={14} /> 退出房间
          </button>
        </div>
      </motion.main>
    </div>
  );
}

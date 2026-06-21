// 结算页：胜者展示 + 累计胜场 + 再来一局（同房重开）/ 回到首页。
// 视觉与首页/准备页/对局页统一（烛光酒馆主题）。
import { useMemo } from 'react';
import { motion } from 'motion/react';
import { RotateCw, LogOut, Crown } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export default function Result() {
  const { room, uid, restart, leaveRoom } = useGameStore();

  // 背景金色尘埃粒子（与其它页面一致的确定性布局）。
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

  if (!room) return null;
  const winner = room.winnerUid ? room.players[room.winnerUid] : null;
  const iWon = room.winnerUid === uid;
  const players = room.seatOrder.map((u) => room.players[u]).filter(Boolean);

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-4 py-8 text-center text-amber-50">
      {/* 全屏烛光背景层 */}
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
        className="relative my-auto flex w-full max-w-[470px] flex-col items-center gap-5"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="text-7xl drop-shadow-[0_0_30px_rgba(245,176,65,0.5)]"
        >
          {winner?.avatar ?? '🏆'}
        </motion.div>

        <div>
          <h1 className="font-serif text-4xl font-bold tracking-wide bg-gradient-to-b from-[#ffe7a3] via-[#d99a32] to-[#7b3f18] bg-clip-text text-transparent drop-shadow-[0_3px_20px_rgba(255,170,57,0.35)]">
            {winner ? `${winner.nickname} 获胜！` : '对局结束'}
          </h1>
          <p className="mt-1.5 text-sm text-amber-100/60">{iWon ? '🎉 恭喜你笑到最后' : '再接再厉'}</p>
        </div>

        {/* 累计胜场榜 */}
        <section className="w-full overflow-hidden rounded-[24px] border border-amber-100/12 bg-[#1c1512]/75 backdrop-blur-xl">
          <p className="border-b border-amber-100/10 px-5 py-3 text-xs tracking-[0.3em] text-amber-100/55">
            累 计 胜 场
          </p>
          <div className="space-y-1 p-3">
            {players
              .slice()
              .sort((a, b) => b.wins - a.wins)
              .map((p, i) => {
                const isMe = p.uid === uid;
                return (
                  <div
                    key={p.uid}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-left ${
                      isMe ? 'border-amber-200/40 bg-amber-200/10' : 'border-amber-100/10 bg-amber-50/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-4 text-xs text-amber-100/40">{i + 1}</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/25 to-orange-900/30 text-lg">
                        {p.avatar}
                      </span>
                      <span className="text-sm text-amber-50">{p.nickname}</span>
                      {isMe && <span className="text-[10px] text-amber-100/40">（你）</span>}
                      {p.uid === room.winnerUid && <Crown size={13} className="text-amber-300" />}
                    </span>
                    <span className="text-sm font-medium text-amber-200">🏆 {p.wins}</span>
                  </div>
                );
              })}
          </div>
        </section>

        <div className="flex w-full flex-col gap-3 pt-1">
          <motion.button
            onClick={() => restart()}
            whileHover={{ scale: 1.015, boxShadow: '0 0 34px rgba(217,154,50,0.48)' }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/35 bg-gradient-to-r from-[#8b451e] via-[#c3832f] to-[#f0b955] py-3.5 font-semibold text-[#241209] shadow-[0_12px_28px_rgba(174,101,30,0.28)] transition"
          >
            <RotateCw size={17} /> 再来一局
          </motion.button>
          <button
            onClick={() => leaveRoom()}
            className="flex items-center justify-center gap-1.5 py-1 text-sm text-amber-100/35 transition hover:text-amber-100/60"
          >
            <LogOut size={14} /> 回到首页
          </button>
        </div>
      </motion.main>
    </div>
  );
}

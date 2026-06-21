// 首页：昵称 + 头像选择，创建/加入房间，并展示大厅已创建的房间（点击进入）。
// 视觉移植自 figma 设计稿（烛光酒馆主题），逻辑接真实 useGameStore。
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, LogIn, Plus, Users, Crown, Clock, Sparkles } from 'lucide-react';
import { AVATARS } from '../components/visuals';
import { useGameStore } from '../store/useGameStore';

// 头像装饰元数据，与真实 AVATARS（emoji）一一对应；存入 store 的仍是 emoji 本身。
const AVATAR_META: Record<string, { name: string; tone: string; prop: string }> = {
  '🐱': { name: '猫赌徒', tone: 'from-yellow-500 to-stone-700', prop: '🍷' },
  '🐶': { name: '犬侦探', tone: 'from-red-500 to-amber-800', prop: '🕯️' },
  '🐑': { name: '绵羊诗人', tone: 'from-stone-300 to-amber-700', prop: '📜' },
  '🦊': { name: '狐老板', tone: 'from-amber-500 to-orange-700', prop: '🎩' },
  '🐮': { name: '牛庄家', tone: 'from-lime-600 to-emerald-900', prop: '🔔' },
  '🐷': { name: '猪财东', tone: 'from-rose-400 to-red-800', prop: '💰' },
  '🐰': { name: '兔跑堂', tone: 'from-rose-300 to-red-700', prop: '🔑' },
  '🐼': { name: '竹隐客', tone: 'from-slate-300 to-zinc-700', prop: '🎋' },
};

export default function Home() {
  const { connected, nickname, avatar, rooms, setProfile, setError, createRoom, joinRoom, refreshRooms } =
    useGameStore();
  const [name, setName] = useState(nickname);
  const [pickedAvatar, setPickedAvatar] = useState(avatar);
  const [joinCode, setJoinCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const valid = name.trim().length > 0 && connected;

  // 进入首页且连接就绪后主动拉一次房间列表（服务器在房间变化时也会自动推送）。
  useEffect(() => {
    if (connected) refreshRooms();
  }, [connected, refreshRooms]);

  // 背景金色尘埃粒子（纯装饰，确定性布局避免每次重排）。
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

  const handleRefresh = () => {
    setRefreshing(true);
    refreshRooms();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleCreate = () => {
    if (!valid) return;
    setProfile(name.trim(), pickedAvatar);
    createRoom();
  };

  const enterRoom = (code: string) => {
    if (name.trim().length === 0) {
      setError('请先输入昵称');
      return;
    }
    if (!connected) return;
    setProfile(name.trim(), pickedAvatar);
    joinRoom(code);
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('请输入 6 位房间码');
      return;
    }
    enterRoom(code);
  };

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-4 py-8 text-amber-50">
      {/* 全屏背景层：用 fixed 脱离父级 max-w-md 限制，铺满视口 */}
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
        className="relative my-auto w-full max-w-[470px]"
      >
        <header className="mb-7 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-3"
          >
            <span className="text-3xl drop-shadow-[0_0_18px_rgba(255,187,83,0.7)]">🍻</span>
            <h1 className="font-serif text-[44px] leading-tight tracking-normal bg-gradient-to-b from-[#ffe7a3] via-[#d99a32] to-[#7b3f18] bg-clip-text text-transparent drop-shadow-[0_3px_20px_rgba(255,170,57,0.35)]">
              骗子酒馆
            </h1>
            <span className="text-3xl drop-shadow-[0_0_18px_rgba(255,187,83,0.7)]">🃏</span>
          </motion.div>
          <p className="mt-1 text-xs tracking-[0.45em] text-amber-100/60">猫 · 狗 · 羊 · 最后一杯</p>
        </header>

        <section className="rounded-[28px] border border-amber-200/20 bg-[#1c1512]/80 p-5 shadow-[0_30px_80px_rgba(22,10,5,0.55),inset_0_1px_0_rgba(255,236,179,0.13)] backdrop-blur-xl space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-amber-100/70">昵称</label>
            <input
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
              placeholder="写下你的酒馆化名..."
              className="w-full rounded-2xl border border-amber-100/15 bg-[#211713]/80 px-4 py-3 text-amber-50 outline-none transition placeholder:text-amber-100/30 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/15"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm text-amber-100/70">选择你的牌桌角色</label>
            <div className="grid grid-cols-4 gap-2.5">
              {AVATARS.map((a) => {
                const meta = AVATAR_META[a] ?? { name: a, tone: 'from-amber-500 to-orange-700', prop: '🍷' };
                const selected = pickedAvatar === a;
                return (
                  <motion.button
                    key={a}
                    onClick={() => setPickedAvatar(a)}
                    whileHover={{ y: -4, scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    className={`group relative h-[76px] rounded-2xl border p-1.5 overflow-hidden transition ${
                      selected
                        ? 'border-amber-200 shadow-[0_0_24px_rgba(234,179,8,0.32)]'
                        : 'border-amber-100/10 hover:border-amber-200/35'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.tone} opacity-75`} />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,239,190,0.42),transparent_35%),linear-gradient(to_top,rgba(21,12,8,0.62),transparent)]" />
                    <span className="absolute right-1.5 top-1 text-sm drop-shadow">{meta.prop}</span>
                    <span className="relative block text-3xl drop-shadow-[0_5px_7px_rgba(0,0,0,0.45)]">{a}</span>
                    <span className="relative mt-0.5 block truncate text-[10px] text-amber-50/90">{meta.name}</span>
                    {selected && (
                      <motion.div
                        layoutId="avatar-ring"
                        className="absolute inset-0 rounded-2xl ring-2 ring-amber-200/80"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <motion.button
            onClick={handleCreate}
            disabled={!valid}
            whileHover={valid ? { scale: 1.015, boxShadow: '0 0 34px rgba(217,154,50,0.48)' } : undefined}
            whileTap={valid ? { scale: 0.98 } : undefined}
            className="w-full rounded-2xl border border-amber-200/35 bg-gradient-to-r from-[#8b451e] via-[#c3832f] to-[#f0b955] py-3.5 text-[#241209] font-semibold flex items-center justify-center gap-2 shadow-[0_12px_28px_rgba(174,101,30,0.28)] transition disabled:opacity-40"
          >
            <Plus size={18} /> 创建房间
          </motion.button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-amber-100/12" />
            <span className="text-xs text-amber-100/45">或者加入</span>
            <div className="h-px flex-1 bg-amber-100/12" />
          </div>

          <div className="flex gap-2">
            <input
              value={joinCode}
              maxLength={6}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="房间码..."
              className="min-w-0 flex-1 rounded-2xl border border-amber-100/15 bg-[#211713]/80 px-4 py-3 uppercase tracking-widest text-amber-50 outline-none transition placeholder:text-amber-100/30 placeholder:tracking-normal focus:border-teal-200/60 focus:ring-4 focus:ring-teal-200/10"
            />
            <motion.button
              onClick={handleJoin}
              disabled={!valid}
              whileHover={valid ? { scale: 1.04 } : undefined}
              whileTap={valid ? { scale: 0.96 } : undefined}
              className="rounded-2xl border border-teal-100/25 bg-gradient-to-br from-[#1d6b67] to-[#123f42] px-5 py-3 font-semibold text-teal-50 shadow-[0_12px_24px_rgba(20,100,96,0.24)] flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <LogIn size={16} />
              加入
            </motion.button>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-amber-100/12 bg-[#1c1512]/70 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-amber-100/10 px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm text-amber-100/70">
              <Users size={15} />
              <span>今夜牌桌</span>
              <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs text-amber-200">{rooms.length}</span>
            </div>
            <motion.button
              onClick={handleRefresh}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              className="flex items-center gap-1.5 rounded-xl bg-amber-100/8 px-3 py-1.5 text-xs text-amber-100/60 hover:text-amber-100"
            >
              <motion.span animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.6 }}>
                <RefreshCw size={13} />
              </motion.span>
              刷新
            </motion.button>
          </div>
          <div className="space-y-2 p-3">
            {rooms.length === 0 ? (
              <p className="rounded-2xl bg-amber-50/[0.03] px-4 py-6 text-center text-xs text-amber-100/40">
                暂无等待中的牌桌，开一桌吧
              </p>
            ) : (
              <AnimatePresence>
                {rooms.map((room, i) => (
                  <motion.button
                    key={room.code}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => enterRoom(room.code)}
                    disabled={!connected}
                    className="group flex w-full items-center justify-between rounded-2xl border border-amber-100/10 bg-amber-50/[0.045] px-4 py-3 text-left transition hover:border-amber-200/30 hover:bg-amber-200/10 disabled:opacity-40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/25 to-orange-900/30 text-xl">
                        {room.hostAvatar || <Crown size={17} className="text-amber-300" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-amber-50">房主 {room.hostNickname}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-amber-100/42">
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {room.playerCount}/{room.maxPlayers}
                          </span>
                          <span className="flex items-center gap-1 font-mono tracking-widest">
                            <Clock size={11} />#{room.code}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="rounded-xl bg-amber-300/12 px-3 py-1.5 text-xs font-medium text-amber-200 opacity-80 transition group-hover:opacity-100">
                      入座
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-amber-100/35">
          {connected ? (
            <>
              <Sparkles size={13} />
              人人都是骗子，直到你证明自己
            </>
          ) : (
            '正在连接服务器…'
          )}
        </p>
      </motion.main>
    </div>
  );
}

// 首页：昵称 + 头像选择，创建/加入房间，并展示大厅已创建的房间（点击进入）。
import { useEffect, useState } from 'react';
import { AVATARS } from '../components/visuals';
import { useGameStore } from '../store/useGameStore';

export default function Home() {
  const { connected, nickname, avatar, rooms, setProfile, setError, createRoom, joinRoom, refreshRooms } =
    useGameStore();
  const [name, setName] = useState(nickname);
  const [pickedAvatar, setPickedAvatar] = useState(avatar);
  const [joinCode, setJoinCode] = useState('');

  const valid = name.trim().length > 0 && connected;

  // 进入首页且连接就绪后主动拉一次房间列表（服务器在房间变化时也会自动推送）。
  useEffect(() => {
    if (connected) refreshRooms();
  }, [connected, refreshRooms]);

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
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="pt-8 text-center">
        <h1 className="text-3xl font-bold">骗子酒馆</h1>
        <p className="mt-1 text-slate-400">猫 · 狗 · 羊</p>
      </header>

      <label className="flex flex-col gap-2">
        <span className="text-sm text-slate-300">昵称</span>
        <input
          className="rounded-lg bg-slate-800 px-4 py-3 text-lg outline-none ring-1 ring-slate-700 focus:ring-emerald-500"
          value={name}
          maxLength={12}
          placeholder="输入昵称"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-300">头像</span>
        <div className="grid grid-cols-8 gap-1">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setPickedAvatar(a)}
              className={`aspect-square rounded-lg text-2xl ${
                pickedAvatar === a ? 'bg-emerald-600' : 'bg-slate-800'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={!valid}
        className="rounded-lg bg-emerald-600 py-3 text-lg font-semibold disabled:opacity-40"
      >
        创建房间
      </button>

      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 uppercase tracking-widest outline-none ring-1 ring-slate-700 focus:ring-emerald-500"
          value={joinCode}
          maxLength={6}
          placeholder="房间码"
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <button
          onClick={handleJoin}
          disabled={!valid}
          className="rounded-lg bg-sky-600 px-5 py-3 font-semibold disabled:opacity-40"
        >
          加入
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">房间列表（点击进入）</span>
          <button onClick={refreshRooms} className="text-xs text-slate-400 active:text-slate-200">
            刷新
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="rounded-lg bg-slate-800/50 px-4 py-3 text-center text-xs text-slate-500">
            暂无等待中的房间，创建一个吧
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((r) => (
              <button
                key={r.code}
                onClick={() => enterRoom(r.code)}
                disabled={!connected}
                className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3 ring-1 ring-slate-700 active:bg-slate-700 disabled:opacity-40"
              >
                <span className="flex items-center gap-3">
                  <span className="text-2xl">{r.hostAvatar}</span>
                  <span className="flex flex-col items-start">
                    <span className="font-mono text-lg tracking-widest">{r.code}</span>
                    <span className="text-xs text-slate-400">房主 {r.hostNickname}</span>
                  </span>
                </span>
                <span className="text-sm text-slate-300">
                  {r.playerCount}/{r.maxPlayers} 人
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!connected && <p className="text-center text-xs text-slate-500">正在连接服务器…</p>}
    </div>
  );
}

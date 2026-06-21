// 等待页：房间码展示+复制、玩家列表与准备、房主开始游戏。
import { GAME_CONFIG } from '../engine';
import { useGameStore } from '../store/useGameStore';

export default function Lobby() {
  const { uid, room, roomCode, setReady, startGame, leaveRoom } = useGameStore();
  if (!room || !roomCode) return null;

  const players = room.seatOrder.map((u) => room.players[u]).filter(Boolean);
  const me = room.players[uid];
  const isHost = room.hostUid === uid;
  const allReady = players.length >= GAME_CONFIG.MIN_PLAYERS && players.every((p) => p.ready);

  const copy = () => {
    void navigator.clipboard?.writeText(roomCode).catch(() => {});
  };

  const handleStart = () => startGame();
  const handleLeave = () => leaveRoom();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="pt-6 text-center">
        <p className="text-sm text-slate-400">房间码</p>
        <button onClick={copy} className="mt-1 text-5xl font-bold tracking-[0.3em]">
          {roomCode}
        </button>
        <p className="mt-1 text-xs text-slate-500">点击复制 · 分享给好友加入</p>
      </header>

      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <div
            key={p.uid}
            className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3"
          >
            <span className="text-lg">
              {p.avatar} {p.nickname}
              <span className="ml-2 text-xs text-amber-300">🏆{p.wins}</span>
              {p.uid === room.hostUid && <span className="ml-2 text-xs text-amber-400">房主</span>}
            </span>
            <span className={p.ready ? 'text-emerald-400' : 'text-slate-500'}>
              {p.ready ? '已准备' : '未准备'}
            </span>
          </div>
        ))}
        <p className="text-center text-xs text-slate-500">
          {players.length}/{GAME_CONFIG.MAX_PLAYERS} 人
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={() => setReady(!me?.ready)}
          className={`rounded-lg py-3 text-lg font-semibold ${
            me?.ready ? 'bg-slate-700' : 'bg-emerald-600'
          }`}
        >
          {me?.ready ? '取消准备' : '准备'}
        </button>
        {isHost && (
          <button
            onClick={handleStart}
            disabled={!allReady}
            className="rounded-lg bg-sky-600 py-3 text-lg font-semibold disabled:opacity-40"
          >
            开始游戏
          </button>
        )}
        <button onClick={handleLeave} className="text-sm text-slate-500">
          退出房间
        </button>
      </div>
    </div>
  );
}

// 结算页：胜者展示 + 累计胜场 + 再来一局（同房重开）/ 回到首页。
import { useGameStore } from '../store/useGameStore';

export default function Result() {
  const { room, uid, restart, leaveRoom } = useGameStore();
  if (!room) return null;
  const winner = room.winnerUid ? room.players[room.winnerUid] : null;
  const iWon = room.winnerUid === uid;
  const players = room.seatOrder.map((u) => room.players[u]).filter(Boolean);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="text-6xl">{winner?.avatar ?? '🏆'}</div>
      <h1 className="text-3xl font-bold">{winner ? `${winner.nickname} 获胜！` : '对局结束'}</h1>
      <p className="text-slate-400">{iWon ? '🎉 恭喜你笑到最后' : '再接再厉'}</p>

      {/* 累计胜场榜 */}
      <div className="w-full max-w-xs rounded-lg bg-slate-800 p-3 text-left text-sm">
        <p className="mb-2 text-center text-slate-400">累计胜场</p>
        {players
          .slice()
          .sort((a, b) => b.wins - a.wins)
          .map((p) => (
            <div key={p.uid} className="flex justify-between py-1">
              <span>
                {p.avatar} {p.nickname}
                {p.uid === uid && <span className="ml-1 text-emerald-400">（你）</span>}
              </span>
              <span className="text-amber-300">🏆 {p.wins}</span>
            </div>
          ))}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3 pt-2">
        <button
          onClick={() => restart()}
          className="rounded-lg bg-emerald-600 py-3 text-lg font-semibold"
        >
          再来一局
        </button>
        <button onClick={() => leaveRoom()} className="text-sm text-slate-500">
          回到首页
        </button>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Result from './pages/Result';
import Toast from './components/Toast';

export default function App() {
  const init = useGameStore((s) => s.init);
  const room = useGameStore((s) => s.room);
  const roomCode = useGameStore((s) => s.roomCode);

  useEffect(() => {
    init();
  }, [init]);

  let page = <Home />;
  if (roomCode && room) {
    if (room.status === 'lobby') page = <Lobby />;
    else if (room.status === 'playing') page = <Game />;
    else page = <Result />;
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      {page}
      <Toast />
    </div>
  );
}

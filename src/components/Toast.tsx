// 全局错误/提示条（被拒动作原因等）。
import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function Toast() {
  const error = useGameStore((s) => s.error);
  const setError = useGameStore((s) => s.setError);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 2500);
    return () => clearTimeout(t);
  }, [error, setError]);

  if (!error) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg">{error}</div>
    </div>
  );
}

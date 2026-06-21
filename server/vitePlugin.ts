// Vite 开发插件：把游戏 WebSocket 服务挂到 vite 自身的 http 服务器上（同 5173 端口、
// 路径 /ws）。手机已能访问 5173，故无需额外端口或防火墙规则。
import type { Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { WS_PATH } from '../src/net/protocol';
import { GameHub } from './gameServer';

export function gameServerPlugin(): Plugin {
  return {
    name: 'liarbar-game-server',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const hub = new GameHub();
      wss.on('connection', (ws) => hub.handle(ws));
      server.httpServer?.on('upgrade', (req, socket, head) => {
        // 仅接管 /ws；其余（如 vite HMR）交回 vite 自己处理。
        if (req.url === WS_PATH) {
          wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
        }
      });
    },
  };
}

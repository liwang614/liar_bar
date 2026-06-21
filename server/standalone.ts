// 生产/远程用独立服务器：托管已构建的 dist 静态文件 + 同端口 /ws 游戏服务。
// 用法：npm run build && node --import tsx server/standalone.ts （默认端口 8080，可用 PORT 覆盖）
import { createReadStream, existsSync, statSync } from 'fs';
import { createServer } from 'http';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { WS_PATH } from '../src/net/protocol';
import { GameHub } from './gameServer';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT ?? 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const httpServer = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let filePath = normalize(join(root, urlPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html'); // SPA 回退
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

const wss = new WebSocketServer({ noServer: true });
const hub = new GameHub();
wss.on('connection', (ws) => hub.handle(ws));
httpServer.on('upgrade', (req, socket, head) => {
  if (req.url === WS_PATH) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

httpServer.listen(PORT, () => {
  console.log(`骗子酒馆服务器已启动: http://0.0.0.0:${PORT}  (ws ${WS_PATH})`);
});

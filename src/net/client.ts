// 前端 WebSocket 客户端：单连接 + 自动重连 + 断线后自动重新加入恢复视图。
import type { Card } from '../engine';
import type {
  ActionMsg,
  ClientMsg,
  EventEnvelope,
  PublicRoom,
  RoomSummary,
  ServerMsg,
} from './protocol';
import { WS_PATH } from './protocol';

export interface NetHandlers {
  onState: (room: PublicRoom, hand: Card[], events: EventEnvelope[]) => void;
  onJoined: (code: string) => void;
  onError: (msg: string) => void;
  onStatus: (connected: boolean) => void;
  onRooms: (rooms: RoomSummary[]) => void;
}

// 开发(vite)与生产(standalone)都通过当前页面 host 连接 /ws，
// 手机从电脑 IP 打开页面时会自动连到同一台电脑，无需配置。
function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${WS_PATH}`;
}

class NetClient {
  private ws: WebSocket | null = null;
  private handlers: NetHandlers | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // 记住身份与房间，断线重连后自动恢复。
  private identity: { uid: string; nickname: string; avatar: string; wins: number } | null = null;
  private code: string | null = null;

  connect(handlers: NetHandlers): void {
    this.handlers = handlers;
    this.open();
  }

  private open(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING))
      return;
    const ws = new WebSocket(wsUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.handlers?.onStatus(true);
      // 重连后自动恢复：曾在房间则重新加入。
      if (this.code && this.identity) {
        this.raw({ t: 'join', code: this.code, ...this.identity });
      }
    };
    ws.onclose = () => {
      this.handlers?.onStatus(false);
      this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (ev) => this.onMessage(ev.data);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, 1500);
  }

  private onMessage(data: unknown): void {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.t === 'joined') {
      this.code = msg.code;
      this.handlers?.onJoined(msg.code);
    } else if (msg.t === 'state') {
      this.handlers?.onState(msg.room, msg.hand, msg.events);
    } else if (msg.t === 'rooms') {
      this.handlers?.onRooms(msg.rooms);
    } else if (msg.t === 'error') {
      this.handlers?.onError(msg.msg);
    }
  }

  private raw(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // ── 对外操作 ──────────────────────────────────────────
  createRoom(uid: string, nickname: string, avatar: string, wins: number): void {
    this.identity = { uid, nickname, avatar, wins };
    this.code = null;
    this.raw({ t: 'create', uid, nickname, avatar, wins });
  }

  joinRoom(code: string, uid: string, nickname: string, avatar: string, wins: number): void {
    this.identity = { uid, nickname, avatar, wins };
    this.code = code.toUpperCase();
    this.raw({ t: 'join', code: this.code, uid, nickname, avatar, wins });
  }

  ready(ready: boolean): void {
    this.raw({ t: 'ready', ready });
  }

  start(): void {
    this.raw({ t: 'start' });
  }

  restart(): void {
    this.raw({ t: 'restart' });
  }

  // 上报最新胜场（胜利后调用），并更新本地身份以便重连携带。
  profile(wins: number): void {
    if (this.identity) this.identity.wins = wins;
    this.raw({ t: 'profile', wins });
  }

  action(action: ActionMsg): void {
    this.raw({ t: 'action', action });
  }

  // 主动请求大厅房间列表（首页可手动刷新；服务器在房间变化时也会自动推送）。
  refreshRooms(): void {
    this.raw({ t: 'rooms' });
  }

  leave(): void {
    this.raw({ t: 'leave' });
    this.code = null;
  }
}

export const net = new NetClient();

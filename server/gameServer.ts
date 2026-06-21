// 自建权威服务器：房间中枢。服务器永远是裁判，内存持有引擎全状态，
// 只向每个客户端下发其本人手牌 + 公开房态 + 事件流。复用纯函数引擎。
import type { WebSocket } from 'ws';
import {
  applyAction,
  createGame,
  createRng,
  GAME_CONFIG,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerSeed,
} from '../src/engine/index';
import type {
  ActionMsg,
  ClientMsg,
  EventEnvelope,
  PublicPlayer,
  PublicRoom,
  RoomSummary,
  ServerMsg,
} from '../src/net/protocol';

interface Member {
  nickname: string;
  avatar: string;
  ready: boolean;
  seat: number;
  wins: number;
}

interface Room {
  code: string;
  hostUid: string;
  status: 'lobby' | 'playing' | 'finished';
  members: Map<string, Member>;
  order: string[]; // 加入顺序 = 座位序
  state: GameState | null;
  events: EventEnvelope[];
  conns: Map<string, WebSocket>;
  turnTimer: ReturnType<typeof setTimeout> | null;
  turnDeadline: number | null;
  winnerUid?: string;
}

// ws 连接上附带的会话信息。
interface Session {
  uid?: string;
  code?: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class GameHub {
  private rooms = new Map<string, Room>();
  private sessions = new WeakMap<WebSocket, Session>();
  private allConns = new Set<WebSocket>(); // 全部活动连接，用于向大厅广播房间列表

  handle(ws: WebSocket): void {
    this.sessions.set(ws, {});
    this.allConns.add(ws);
    this.send(ws, { t: 'rooms', rooms: this.roomSummaries() }); // 连上即推送大厅房间列表
    ws.on('message', (raw: Buffer | string) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      try {
        this.dispatch(ws, msg);
      } catch (e) {
        this.send(ws, { t: 'error', msg: e instanceof Error ? e.message : '服务器错误' });
      }
    });
    ws.on('close', () => this.onClose(ws));
    ws.on('error', () => this.onClose(ws));
  }

  private dispatch(ws: WebSocket, msg: ClientMsg): void {
    switch (msg.t) {
      case 'create':
        return this.onCreate(ws, msg.uid, msg.nickname, msg.avatar, msg.wins);
      case 'join':
        return this.onJoin(ws, msg.code, msg.uid, msg.nickname, msg.avatar, msg.wins);
      case 'ready':
        return this.onReady(ws, msg.ready);
      case 'start':
        return this.onStart(ws);
      case 'restart':
        return this.onRestart(ws);
      case 'profile':
        return this.onProfile(ws, msg.wins);
      case 'action':
        return this.onAction(ws, msg.action);
      case 'rooms':
        return this.send(ws, { t: 'rooms', rooms: this.roomSummaries() });
      case 'leave':
        return this.onLeave(ws);
    }
  }

  // ── 房间生命周期 ───────────────────────────────────────
  private onCreate(ws: WebSocket, uid: string, nickname: string, avatar: string, wins: number): void {
    const code = this.newCode();
    const room: Room = {
      code,
      hostUid: uid,
      status: 'lobby',
      members: new Map([[uid, { nickname, avatar, ready: false, seat: 0, wins: wins ?? 0 }]]),
      order: [uid],
      state: null,
      events: [],
      conns: new Map([[uid, ws]]),
      turnTimer: null,
      turnDeadline: null,
    };
    this.rooms.set(code, room);
    this.sessions.set(ws, { uid, code });
    this.send(ws, { t: 'joined', code, uid });
    this.broadcast(room);
    this.broadcastLobby();
  }

  private onJoin(
    ws: WebSocket,
    code: string,
    uid: string,
    nickname: string,
    avatar: string,
    wins: number,
  ): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return this.send(ws, { t: 'error', msg: '房间不存在' });

    const known = room.members.has(uid);
    if (!known) {
      if (room.status !== 'lobby') return this.send(ws, { t: 'error', msg: '对局已开始，无法加入' });
      if (room.members.size >= GAME_CONFIG.MAX_PLAYERS)
        return this.send(ws, { t: 'error', msg: '房间已满' });
      room.members.set(uid, { nickname, avatar, ready: false, seat: room.order.length, wins: wins ?? 0 });
      room.order.push(uid);
    } else {
      // 重连：更新资料，胜场取较大值，复用座位。
      const m = room.members.get(uid)!;
      m.nickname = nickname;
      m.avatar = avatar;
      m.wins = Math.max(m.wins, wins ?? 0);
    }
    room.conns.set(uid, ws);
    this.sessions.set(ws, { uid, code: room.code });
    this.send(ws, { t: 'joined', code: room.code, uid });
    this.broadcast(room);
    this.broadcastLobby();
  }

  private onReady(ws: WebSocket, ready: boolean): void {
    const room = this.roomOf(ws);
    const uid = this.sessions.get(ws)?.uid;
    if (!room || !uid || room.status !== 'lobby') return;
    const m = room.members.get(uid);
    if (!m) return;
    m.ready = ready;
    this.broadcast(room);
  }

  private onStart(ws: WebSocket): void {
    const room = this.roomOf(ws);
    const uid = this.sessions.get(ws)?.uid;
    if (!room || !uid) return;
    if (room.hostUid !== uid) return this.send(ws, { t: 'error', msg: '只有房主可以开始' });
    if (room.status !== 'lobby') return;
    if (room.order.length < GAME_CONFIG.MIN_PLAYERS)
      return this.send(ws, { t: 'error', msg: '至少需要 2 名玩家' });
    if (![...room.members.values()].every((m) => m.ready))
      return this.send(ws, { t: 'error', msg: '还有玩家未准备' });

    const seeds: PlayerSeed[] = room.order.map((u, seat) => {
      const m = room.members.get(u)!;
      return { uid: u, nickname: m.nickname, avatar: m.avatar, seat };
    });
    this.beginGame(room, seeds);
  }

  // 再来一局：同房重开（保留成员/座位/胜场，全员复活）。任意成员在结束后可触发。
  private onRestart(ws: WebSocket): void {
    const room = this.roomOf(ws);
    if (!room || room.status !== 'finished') return;
    if (room.order.length < GAME_CONFIG.MIN_PLAYERS)
      return this.send(ws, { t: 'error', msg: '人数不足，无法再来一局' });
    const seeds: PlayerSeed[] = room.order.map((u, seat) => {
      const m = room.members.get(u)!;
      return { uid: u, nickname: m.nickname, avatar: m.avatar, seat };
    });
    this.beginGame(room, seeds);
  }

  private beginGame(room: Room, seeds: PlayerSeed[]): void {
    const { state, events } = createGame(seeds, this.rng());
    room.state = state;
    room.status = 'playing';
    room.winnerUid = undefined;
    room.events = [];
    this.pushEvents(room, events);
    this.armTimer(room);
    this.broadcast(room);
    this.broadcastLobby(); // 房间已开局，从大厅列表移除
  }

  // 上报最新胜场（客户端胜利后驱动）。
  private onProfile(ws: WebSocket, wins: number): void {
    const room = this.roomOf(ws);
    const uid = this.sessions.get(ws)?.uid;
    if (!room || !uid) return;
    const m = room.members.get(uid);
    if (!m) return;
    m.wins = Math.max(m.wins, wins ?? 0);
    this.broadcast(room);
  }

  private onAction(ws: WebSocket, action: ActionMsg): void {
    const room = this.roomOf(ws);
    const uid = this.sessions.get(ws)?.uid;
    if (!room || !uid || room.status !== 'playing' || !room.state) return;
    this.applyAndBroadcast(room, { ...action, uid } as Action, ws);
  }

  private onLeave(ws: WebSocket): void {
    const room = this.roomOf(ws);
    const uid = this.sessions.get(ws)?.uid;
    if (!room || !uid) return;
    room.conns.delete(uid);
    if (room.status === 'lobby') {
      room.members.delete(uid);
      room.order = room.order.filter((u) => u !== uid);
      if (room.hostUid === uid) room.hostUid = room.order[0] ?? '';
    } else if (room.state?.players[uid]?.alive) {
      // 对局中主动退出 → FORFEIT 出局。
      this.applyAndBroadcast(room, { type: 'FORFEIT', uid });
    }
    this.sessions.set(ws, {});
    this.cleanup(room);
    this.broadcast(room);
    this.broadcastLobby();
  }

  private onClose(ws: WebSocket): void {
    const room = this.roomOf(ws);
    const uid = this.sessions.get(ws)?.uid;
    this.sessions.delete(ws);
    this.allConns.delete(ws);
    if (!room || !uid) return;
    // 仅断开连接（标记离线），保留成员以便重连；轮到他时由超时托管。
    if (room.conns.get(uid) === ws) room.conns.delete(uid);
    this.cleanup(room);
    this.broadcast(room);
    this.broadcastLobby();
  }

  // ── 引擎推进 ──────────────────────────────────────────
  private applyAndBroadcast(room: Room, action: Action, origin?: WebSocket): void {
    if (!room.state) return;
    const res = applyAction(room.state, action);
    if (res.rejected) {
      if (origin) this.send(origin, { t: 'error', msg: res.rejected.reason });
      return;
    }
    room.state = res.state;
    this.pushEvents(room, res.events);
    if (res.state.status === 'finished') {
      room.status = 'finished';
      room.winnerUid = res.state.winnerUid;
    }
    this.armTimer(room);
    this.broadcast(room);
  }

  // 倒计时托管：出牌阶段超时自动出 1 张；翻牌阶段超时由对方随机翻。解决锁屏/掉线卡死。
  private armTimer(room: Room): void {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnDeadline = null;
    const round = room.state?.round;
    if (room.status !== 'playing' || !round) return;

    const ms = GAME_CONFIG.TURN_TIMEOUT_SEC * 1000;
    if (round.phase === 'turn') {
      const turnUid = round.turnUid;
      room.turnDeadline = Date.now() + ms;
      room.turnTimer = setTimeout(() => {
        if (room.status === 'playing' && room.state?.round?.turnUid === turnUid && room.state.round.phase === 'turn') {
          this.applyAndBroadcast(room, { type: 'TIMEOUT', uid: turnUid });
        }
      }, ms + 300);
    } else if (round.phase === 'fate' && round.pendingFate) {
      const { pickerUid, judgedUid } = round.pendingFate;
      room.turnDeadline = Date.now() + ms;
      room.turnTimer = setTimeout(() => {
        const pf = room.state?.round?.pendingFate;
        if (room.status === 'playing' && pf && pf.judgedUid === judgedUid) {
          const remaining = room.state!.players[judgedUid].fateDeck.length;
          const index = Math.floor(Math.random() * Math.max(1, remaining));
          this.applyAndBroadcast(room, { type: 'PICK_FATE', uid: pickerUid, index });
        }
      }, ms + 300);
    }
  }

  private pushEvents(room: Room, events: GameEvent[]): void {
    for (const ev of events) {
      room.events.push({ seq: room.events.length, ...(ev as object) } as EventEnvelope);
    }
    if (room.events.length > 200) room.events = room.events.slice(-200);
  }

  // ── 下发 ──────────────────────────────────────────────
  private broadcast(room: Room): void {
    const base = this.publicRoom(room);
    const recent = room.events.slice(-50);
    for (const [uid, ws] of room.conns) {
      const hand = room.state?.players[uid]?.hand ?? [];
      this.send(ws, { t: 'state', room: base, hand, events: recent });
    }
  }

  // 大厅房间列表：仅列出仍在等待（lobby）的房间，供首页展示并点击加入。
  private roomSummaries(): RoomSummary[] {
    const out: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.status !== 'lobby') continue;
      const host = room.members.get(room.hostUid);
      out.push({
        code: room.code,
        hostNickname: host?.nickname ?? '?',
        hostAvatar: host?.avatar ?? '🐱',
        playerCount: room.members.size,
        maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      });
    }
    return out;
  }

  // 把最新房间列表推给所有尚未进入任何房间的连接（仍停留在首页者）。
  private broadcastLobby(): void {
    const rooms = this.roomSummaries();
    for (const ws of this.allConns) {
      if (this.sessions.get(ws)?.code) continue; // 已在房间内，无需大厅列表
      this.send(ws, { t: 'rooms', rooms });
    }
  }

  private publicRoom(room: Room): PublicRoom {
    const players: Record<string, PublicPlayer> = {};
    if (room.state) {
      for (const uid of room.state.seatOrder) {
        const p = room.state.players[uid];
        players[uid] = {
          uid,
          nickname: p.nickname,
          avatar: p.avatar,
          seat: p.seat,
          ready: true,
          alive: p.alive,
          handCount: p.hand.length,
          fateRemaining: p.fateDeck.length,
          fateSafeRevealed: p.fateSafeRevealed,
          online: room.conns.has(uid),
          timeoutStrikes: p.timeoutStrikes,
          wins: room.members.get(uid)?.wins ?? 0,
        };
      }
      const r = room.state.round;
      return {
        code: room.code,
        status: room.status,
        hostUid: room.hostUid,
        seatOrder: room.state.seatOrder,
        players,
        round: r
          ? {
              roundNo: r.roundNo,
              themeAnimal: r.themeAnimal,
              turnUid: r.turnUid,
              turnDeadline: room.turnDeadline,
              forcedReveal: r.forcedReveal,
              lastPlay: r.lastPlay
                ? { uid: r.lastPlay.uid, count: r.lastPlay.count, playId: r.lastPlay.playId }
                : null,
              phase: r.phase,
              pendingFate: r.pendingFate
                ? {
                    judgedUid: r.pendingFate.judgedUid,
                    pickerUid: r.pendingFate.pickerUid,
                    remaining: room.state.players[r.pendingFate.judgedUid].fateDeck.length,
                    flipsLeft: r.pendingFate.flipsLeft,
                  }
                : null,
            }
          : null,
        winnerUid: room.winnerUid,
      };
    }
    // lobby
    for (const uid of room.order) {
      const m = room.members.get(uid)!;
      players[uid] = {
        uid,
        nickname: m.nickname,
        avatar: m.avatar,
        seat: m.seat,
        ready: m.ready,
        alive: true,
        handCount: 0,
        fateRemaining: GAME_CONFIG.FATE_TOTAL,
        fateSafeRevealed: 0,
        online: room.conns.has(uid),
        timeoutStrikes: 0,
        wins: m.wins,
      };
    }
    return {
      code: room.code,
      status: room.status,
      hostUid: room.hostUid,
      seatOrder: room.order,
      players,
      round: null,
      winnerUid: room.winnerUid,
    };
  }

  // ── 工具 ──────────────────────────────────────────────
  private send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private roomOf(ws: WebSocket): Room | undefined {
    const code = this.sessions.get(ws)?.code;
    return code ? this.rooms.get(code) : undefined;
  }

  private cleanup(room: Room): void {
    if (room.conns.size === 0) {
      if (room.turnTimer) clearTimeout(room.turnTimer);
      this.rooms.delete(room.code);
    }
  }

  private newCode(): string {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    } while (this.rooms.has(code));
    return code;
  }

  private rng() {
    // 服务器侧用时间种子；引擎内部仍走可序列化 RNG。
    return createRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  }
}

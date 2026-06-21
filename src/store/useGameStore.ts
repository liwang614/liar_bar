// 全局状态：本地身份、WebSocket 连接、房间公开态、本人手牌、事件流。
// 事件按节奏逐步“演出”（带提示横幅与停顿），给其他玩家反应时间，避免一闪而过。
import { create } from 'zustand';
import type { Card } from '../engine';
import { eventText } from '../components/eventText';
import { net } from '../net/client';
import type { ActionMsg, EventEnvelope, PublicRoom, RoomSummary } from '../net/protocol';

const NICK_KEY = 'liarbar.nickname';
const AVATAR_KEY = 'liarbar.avatar';
const UID_KEY = 'liarbar.uid';
const WINS_KEY = 'liarbar.wins';

function ensureUid(): string {
  let uid = localStorage.getItem(UID_KEY);
  if (!uid) {
    uid = crypto.randomUUID?.() ?? `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(UID_KEY, uid);
  }
  return uid;
}

interface EventLog {
  id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
}

interface GameStore {
  uid: string;
  nickname: string;
  avatar: string;
  wins: number;
  connected: boolean;
  roomCode: string | null;
  room: PublicRoom | null;
  rooms: RoomSummary[]; // 大厅可加入房间列表（首页展示）
  hand: Card[];
  events: EventLog[];
  banner: string | null; // 当前动作提示横幅
  error: string | null;

  init: () => void;
  setProfile: (nickname: string, avatar: string) => void;
  setError: (msg: string | null) => void;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  refreshRooms: () => void;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  restart: () => void;
  leaveRoom: () => void;
  send: (action: ActionMsg) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 每类事件的停顿时长（ms）。0 表示不单独提示、直接带过。
function eventDelay(type: string): number {
  switch (type) {
    case 'CARDS_PLAYED':
      return 850;
    case 'CHALLENGE_DECLARED':
      return 1500;
    case 'CARDS_REVEALED':
      return 2000;
    case 'FATE_PENDING':
      return 1200;
    case 'FATE_DRAWN':
      return 1700;
    case 'PLAYER_ELIMINATED':
      return 1600;
    case 'ROUND_ENDED':
      return 1300;
    default:
      return 0; // ROUND_STARTED / THEME_ANNOUNCED / GAME_WON 直接带过
  }
}

// 演出队列（模块级，跨 set 持续）。
interface Snap {
  room: PublicRoom;
  hand: Card[];
  events: EventEnvelope[];
}
let snapQueue: Snap[] = [];
let pumping = false;
let committedSeq = -1;
let fastForward = false; // 刚加入/重连：第一帧直接跳到最新，不回放历史

let started = false;

export const useGameStore = create<GameStore>((set, get) => {
  const toLog = (events: EventEnvelope[]): EventLog[] =>
    events.map((e) => ({ id: String(e.seq), seq: e.seq, type: e.type, payload: e as Record<string, unknown> }));

  // 提交一个快照到界面。胜场由服务器权威计数（按昵称持久化），客户端只采用服务器值。
  const commit = (snap: Snap) => {
    set({
      room: snap.room,
      roomCode: snap.room.code,
      hand: snap.hand,
      events: toLog(snap.events),
      banner: null,
    });
    // 采用服务器下发的本人胜场，让 localStorage 跟随权威值（也作为下次进房的迁移种子）。
    const myServerWins = snap.room.players[get().uid]?.wins ?? 0;
    if (myServerWins > get().wins) {
      localStorage.setItem(WINS_KEY, String(myServerWins));
      set({ wins: myServerWins });
    }
  };

  const pump = async () => {
    if (pumping) return;
    pumping = true;
    while (snapQueue.length) {
      const snap = snapQueue.shift()!;
      const maxSeq = snap.events.length ? snap.events[snap.events.length - 1].seq : -1;
      if (fastForward) {
        fastForward = false;
        committedSeq = maxSeq;
        commit(snap);
        continue;
      }
      if (maxSeq < committedSeq) committedSeq = -1; // 事件流重置（再来一局）

      const fresh = snap.events.filter((e) => e.seq > committedSeq);
      committedSeq = Math.max(committedSeq, maxSeq);

      // 大厅/无新事件：直接提交。
      const pacing = fresh.filter((e) => eventDelay(e.type) > 0);
      if (snap.room.status === 'lobby' || pacing.length === 0) {
        commit(snap);
        continue;
      }

      // 先逐条播报（界面仍停留在上一帧，制造反应时间），最后提交本帧。
      for (const e of pacing) {
        set({ banner: eventText({ type: e.type, payload: e as Record<string, unknown> }, snap.room) });
        await sleep(eventDelay(e.type));
      }
      commit(snap);
    }
    pumping = false;
  };

  const resetPresentation = () => {
    snapQueue = [];
    pumping = false;
    committedSeq = -1;
  };

  return {
    uid: ensureUid(),
    nickname: localStorage.getItem(NICK_KEY) ?? '',
    avatar: localStorage.getItem(AVATAR_KEY) ?? '🐱',
    wins: Number(localStorage.getItem(WINS_KEY) ?? '0'),
    connected: false,
    roomCode: null,
    room: null,
    rooms: [],
    hand: [],
    events: [],
    banner: null,
    error: null,

    init: () => {
      if (started) return;
      started = true;
      net.connect({
        onStatus: (connected) => set({ connected }),
        onJoined: (code) => {
          fastForward = true; // 加入后第一帧跳到最新，不回放历史
          snapQueue = [];
          committedSeq = -1;
          set({ roomCode: code });
        },
        onError: (msg) => set({ error: msg }),
        onRooms: (rooms) => set({ rooms }),
        onState: (room, hand, events) => {
          snapQueue.push({ room, hand, events });
          void pump();
        },
      });
    },

    setProfile: (nickname, avatar) => {
      localStorage.setItem(NICK_KEY, nickname);
      localStorage.setItem(AVATAR_KEY, avatar);
      set({ nickname, avatar });
    },

    setError: (msg) => set({ error: msg }),

    createRoom: () => {
      const { uid, nickname, avatar, wins } = get();
      net.createRoom(uid, nickname, avatar, wins);
    },

    joinRoom: (code) => {
      const { uid, nickname, avatar, wins } = get();
      net.joinRoom(code, uid, nickname, avatar, wins);
    },

    refreshRooms: () => net.refreshRooms(),

    setReady: (ready) => net.ready(ready),
    startGame: () => net.start(),
    restart: () => net.restart(),

    leaveRoom: () => {
      net.leave();
      resetPresentation();
      set({ roomCode: null, room: null, hand: [], events: [], banner: null });
    },

    send: (action) => net.action(action),
  };
});

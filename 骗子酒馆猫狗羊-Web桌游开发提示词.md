# 开发任务提示词：基于 Firebase 的 Web 端多人桌游《骗子酒馆：猫狗羊》

> 使用方法：将本文件全文作为一条指令交给编程 AI（Claude Code / Cursor 等）。本文件即完整的需求规格说明书，按里程碑顺序执行即可。

---

## 0. 执行指令

你是一名资深全栈工程师，精通 React、TypeScript 与 Firebase 实时应用。你的任务是**从零实现一个可真人联机、可直接部署的 Web 桌游**——《骗子酒馆 / Liar's Bar》的实体卡牌变体「猫狗羊」版：一款吹牛 + 质疑 + 俄罗斯轮盘式惩罚的心理博弈游戏。

工作约束与优先级：

1. 后端**只用 Firebase**（Firestore + Anonymous Auth + Hosting），不允许自建服务器或第三方游戏服务。
2. **规则正确性 > 完整对局流程 > 联机健壮性 > 视觉效果**。先实现并单测核心规则引擎，再做 UI。
3. 第 2 章规则条款（R-x 编号）是权威定义，实现中遇到歧义以条款为准；条款未覆盖的情况，按 Liar's Bar 电子版惯例自行裁定，并在 README 的「规则裁定记录」中逐条说明。
4. 全中文界面，移动端竖屏优先（玩家主要用手机浏览器游玩）。

---

## 1. 游戏一句话概述

每小局指定一种主题动物（猫/狗/羊），玩家轮流面朝下打出 1~3 张牌并被默认宣称"全是主题动物"——真假自便；下家可选择继续出牌或"开他"（质疑翻验）。说谎被抓或冤枉好人的一方，要从自己面前的命运牌里随机翻一张：翻到炸弹立即出局。最后活着的人获胜。

---

## 2. 游戏规则（权威条款）

### 2.1 牌与配置常量

**R-1** 所有数值写入独立 config 文件，全部可调：

```ts
export const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  HAND_SIZE: 8,                 // 每小局每人发 8 张
  MIN_PLAY: 1,                  // 单次出牌下限
  MAX_PLAY: 3,                  // 单次出牌上限
  DECK: { cat: 10, dog: 10, sheep: 10, joker: 2 },  // 共 32 张
  FATE_TOTAL: 6,                // 每人命运牌 6 张
  FATE_BOMBS: 1,                // 其中炸弹 1 张
  TURN_TIMEOUT_SEC: 30,
  TIMEOUT_STRIKES_TO_KICK: 3,
};
```

**R-2** 动物牌三种：猫 cat、狗 dog、羊 sheep；**万能牌 joker 在验证时视为任意主题动物，恒为真**。主题动物只会从猫/狗/羊中产生。

**R-3** 牌库配比说明：按电子版（Q/K/A 各 6 + 小丑 2、每人 5 张）等比放大到每人 8 张的自洽设计；4 人局 32 张恰好发完，2~3 人局剩余牌该小局弃置不用。

### 2.2 大局、命运牌

**R-4** 一场大局（Game）由若干小局（Round）组成，直到只剩 1 名存活者。

**R-5** 大局开始时，每位玩家面前生成 6 张面朝下命运牌（1 炸弹 + 5 安全，顺序随机）。命运牌**跨小局持续、永不重置**；未翻开的命运牌内容对所有客户端（含本人）保密，公开的只有剩余张数与已翻开结果。

### 2.3 小局开始

**R-6** 小局流程：① 系统从 {猫,狗,羊} 等概率随机指定**主题动物**并公示 → ② 洗匀 32 张动物牌，给每位存活玩家发 `HAND_SIZE` 张 → ③ 确定首家并进入回合循环。

**R-7** 首家：第一小局随机；之后每小局由**上一小局执行死亡判定的玩家**先手；若其已出局，则由其下家先手。

### 2.4 回合行动

**R-8** 按 seatOrder 轮转，自动跳过已出局者与本小局手牌已打空者。轮到的玩家必须二选一：

- **出牌**：选手牌 1~3 张面朝下打出。张数公开且即为宣称数（"N 张〈主题动物〉"），**玩家无法谎报张数，只能对牌面撒谎**。
- **质疑（开他）**：翻验上一位出牌者最近打出的那一手牌（见 2.5）。

**R-9** 小局第一个行动者只能出牌（无可质疑对象）。

**R-10** 质疑对象只能是"桌面上最近一手未被验证的出牌"。一旦下家选择出牌而非质疑，上家那手牌**永久免验**，面朝下弃置，本小局不再翻开。

**R-11** 手牌打空者本小局后续被跳过（安全旁观），但其最后一手在被下一行动者"跳过"之前仍可被质疑。

### 2.5 质疑与验证

**R-12** 翻开被质疑的一手牌逐张公示：
- 每一张都是主题动物或 joker → 出牌者诚实，**质疑者**执行死亡判定；
- 任意一张不是 → 出牌者说谎，**出牌者**执行死亡判定。

### 2.6 死亡判定（翻炸弹牌）

**R-13** 从被判定者**剩余未翻**命运牌中**随机抽一张**翻开、全员可见：
- 安全 → 存活，该安全牌**永久移出**（其炸弹概率随判定次数 1/6 → 1/5 → 1/4 … 递增，模拟俄罗斯轮盘）；
- 炸弹 → 💥 立即出局：弃其手牌、标记死亡、之后所有小局跳过；可留房观战（只读，看不到任何手牌）。

### 2.7 小局结束与重发

**R-14** 满足任一条件，小局立即结束 → 收回全部手牌与桌面牌 → 按 R-6 开新小局：
- **(a)** 发生了一次死亡判定（无论结果安全还是炸弹）；
- **(b)** 所有存活者手牌打空且无人触发判定（极端情况，直接重发、无人受罚）。

### 2.8 最后持牌者（关键边界，必须实现）

**R-15** 轮到玩家 P 行动、且其他所有存活者手牌均为 0 时，P 进入**强制验证模式**：他仍正常出牌，但每手牌打出后**立即被系统自动翻验**（等效被质疑）——
- 含假牌 → P 执行死亡判定，小局结束；
- 全真 → 无人判定；由于其他人都被跳过，轮转后仍是 P，继续出下一手，直到打完（全部为真且打完 → 按 R-14(b) 重发）。

### 2.9 胜负与人数

**R-16** 存活者仅剩 1 人时大局结束，该玩家获胜。

**R-17** 支持 2~4 人；2 人局上家与下家为同一人，规则不变。

### 2.10 回合循环伪代码（引擎实现参考）

```
loop:
  P = 下一个(存活 且 手牌>0) 的玩家
  if 其他存活者手牌全为 0: 标记 P 强制验证模式 (R-15)
  P 行动:
    ├─ 出牌(cards 1..3):
    │     桌面 lastPlay = {P, count}; 牌面写入机密区
    │     if 强制验证模式: 立即翻验 → 假则 P 判定→小局结束; 真则 continue
    │     else continue
    └─ 质疑: 翻验 lastPlay → 假则上家判定 / 真则 P 判定 → 小局结束
  死亡判定: 随机翻命运牌 → 炸弹则出局; 存活人数==1 则大局结束
```

---

## 3. 技术架构

### 3.1 技术栈（固定）

- 前端：**React 18 + TypeScript + Vite + Tailwind CSS**；本地状态用 zustand（或同级轻量方案）。
- 后端：**Firebase v9+ modular SDK**：Cloud Firestore（onSnapshot 实时监听）+ Anonymous Authentication + Hosting。
- 测试：vitest（引擎单测必做）。
- 昵称与头像选择保存在浏览器 localStorage，便于回访。

### 3.2 权威模型：裁判客户端（Host-Authoritative）

不使用 Cloud Functions 的前提下，采用「裁判客户端权威」：

1. 房间有唯一 `judgeUid`（初始 = 房主）。**只有裁判客户端**运行游戏引擎、读写机密文档、推进状态。
2. 普通玩家不直接改游戏状态，而是把意图写入 `actions` 子集合；裁判 onSnapshot 监听未处理 action，按 `createdAt` 串行送入引擎 `reduce()`，结果用**批量写/事务**落库（公共状态 + 各人手牌 + 事件流），并把 action 标记 processed / rejected(原因)。
3. **裁判迁移（必做）**：裁判每 10s 写 `judgeHeartbeat`(serverTimestamp)；任何在线存活玩家检测到心跳超时 > 30s，可将 `judgeUid` 改写为自己（安全规则仅在超时条件下放行），读取机密引擎状态接管主持。手机锁屏极常见，缺这条游戏必卡死。
4. README 中如实声明信任模型：裁判客户端理论上可见全部牌面，适合熟人局；彻底防作弊的升级路径见第 9 章（引擎纯函数设计已为迁移预留）。

### 3.3 Firestore 数据模型

```
rooms/{roomCode}                          // roomCode: 6 位大写字母数字
  status: 'lobby' | 'playing' | 'finished'
  hostUid, judgeUid, judgeHeartbeat, createdAt, winnerUid?
  seatOrder: string[]
  players: {                              // 用 map，避免数组并发写冲突
    [uid]: { nickname, avatar, seat, ready, alive,
             handCount, fateRemaining, fateSafeRevealed,
             online, lastSeen, timeoutStrikes }
  }
  round: {
    roundNo, themeAnimal,
    turnUid, turnDeadline,
    forcedReveal: boolean,                // R-15 模式标记
    lastPlay: { uid, count, playId } | null,    // 只含张数，无牌面
    phase: 'turn' | 'revealing' | 'fate' | 'round_end',
    reveal?: { cards: Card[], liar: boolean, judgedUid },
    fateResult?: { uid, card: 'safe'|'bomb', remaining }
  }

rooms/{roomCode}/hands/{uid}              // 私有手牌镜像
  cards: Card[]                           // 读: 本人或裁判; 写: 仅裁判

rooms/{roomCode}/secrets/engine           // 机密引擎全状态
  deck, pendingPlays(真实牌面), fateDecks, rngState, fullState
                                          // 读写: 仅裁判

rooms/{roomCode}/actions/{autoId}         // 玩家意图队列
  uid, type, payload(出牌含 cardIds), createdAt, processed
                                          // create: 仅本人; read: 本人+裁判; update: 仅裁判

rooms/{roomCode}/events/{autoId}          // 公开事件流（驱动动画与日志）
  seq, type, payload, createdAt           // 写: 仅裁判; 读: 房间成员
```

**前端必须按 events 事件流顺序播放动画**（出牌飞入 → 逐张翻验 → 命运牌悬念停顿 → 爆炸/安全），禁止直接对 room 快照做"状态瞬移"渲染。事件类型至少包括：ROUND_STARTED, THEME_ANNOUNCED, CARDS_PLAYED(uid,count), CHALLENGE_DECLARED, CARDS_REVEALED(cards,result), FATE_DRAWN(uid,card,remaining), PLAYER_ELIMINATED, ROUND_ENDED, GAME_WON。

### 3.4 安全规则（firestore.rules，作为交付物）

- `rooms/{code}` 与 `events`：仅房间成员可读；
- `hands/{uid}`：read 仅 `uid == request.auth.uid || request.auth.uid == judgeUid`，write 仅裁判；
- `secrets/*`：读写仅裁判；
- `actions`：create 仅限 `request.resource.data.uid == request.auth.uid` 且为在房存活成员；update 仅裁判；read 本人或裁判；
- `judgeUid` 改写：仅当 `judgeHeartbeat` 超时（用 `request.time` 比较）且写入者为在房成员时放行；
- lobby 阶段加入：仅允许写 `players` map 中自己的 key，且房间未满、status == 'lobby'。
- 注意规则中 `get()` 调用次数限制，必要时把校验所需字段冗余到被校验文档上。

### 3.5 引擎设计（纯函数，零 Firebase 依赖）

```ts
type Action =
  | { type: 'PLAY_CARDS'; uid: string; cardIds: string[] }
  | { type: 'CHALLENGE';  uid: string }
  | { type: 'TIMEOUT';    uid: string }
  | { type: 'FORFEIT';    uid: string };   // 主动退出 / 被踢

function reduce(state: GameState, action: Action, rng: Rng):
  { state: GameState; events: GameEvent[] }
```

- 随机数（洗牌、抽命运牌、定主题）一律通过注入的 `rng` 产生，保证单测可复现。
- 裁判处理 action 时必须校验：轮到该玩家、张数 1~3、cardIds 确属其当前手牌、质疑时存在合法对象、玩家存活；非法 action 标记 rejected 并附原因，前端 toast 提示。

---

## 4. 页面与交互（全中文 UI）

### 4.1 页面清单

1. **首页**：昵称输入（必填，localStorage 记忆）+ emoji 头像选择（🐱🐶🐑🦊🐮🐷 等）；「创建房间」生成 6 位房间码；「加入房间」输入房间码。
2. **等待页**：房间码大字展示 + 一键复制；玩家列表与准备状态；全员准备且 ≥2 人时房主可「开始游戏」。
3. **对局页**：核心页面，竖屏布局见 4.2。
4. **结算页**：胜者展示；趣味统计（存活小局数、成功质疑数、骗过次数）；「再来一局」（同房间重置命运牌与状态、保留座位）与「回到首页」。

### 4.2 对局页布局（移动端竖屏线框）

```
┌──────────────────────────────┐
│ 🐶小明 ✋3 [●●✓●●●]  🐷小红 ✋0 [✓✓💥] │ ← 对手区: 手牌数+命运牌格
├──────────────────────────────┤
│         本局主题：🐑 羊        │
│      [牌背×2] 「2 张羊」       │ ← 最近出牌(只见张数)
│      ⏳ ████████░░ 18s        │ ← 当前行动者倒计时
├──────────────────────────────┤
│ 你的命运牌 [●●●✓●●]            │
│ [🐱][🐱][🐑][🃏][🐶][🐑][🐑][🐶]   │ ← 手牌，点选多张上浮
│   〔 质疑上家 〕 〔 出牌 (2) 〕   │ ← 按合法性启用/置灰
└──────────────────────────────┘
```

命运牌格图例：● 未翻 / ✓ 已翻安全 / 💥 炸弹（出局，整卡置灰）。

### 4.3 动画与状态文案（必做）

发牌动画；出牌飞向桌面；质疑逐张翻牌（间隔约 400ms）；死亡判定先停顿 1.5s 制造悬念再翻开；炸弹爆炸 + 震屏；轮到自己时操作区呼吸高亮。文案示例：「等待 小明 出牌…」「轮到你了！」「小红 质疑了 小明！」「正在抽取命运牌…」「💥 砰！小明 出局」「呼——安全（已排除 2/6）」。音效（出牌/翻牌/爆炸）可选，默认提供静音开关。

---

## 5. 健壮性要求

1. **超时**：倒计时归零 → 裁判注入 TIMEOUT：自动随机打出 1 张（不质疑）；`timeoutStrikes`+1，连续 3 次按 FORFEIT 出局；任何主动操作清零 strikes。
2. **断线重连**：基于匿名 uid，刷新后自动回座并恢复完整视图（含自己手牌）。
3. **裁判迁移**：按 3.2 实现并实测——关闭房主标签页后，对局须在 30s 内由他人接管恢复。
4. **中途退出**：主动退出，或离线超 2 分钟且轮到他 → FORFEIT 出局；若仅剩 1 人立即判胜。
5. 裁判的每次状态推进使用事务或批量写，杜绝半更新状态。

---

## 6. 项目结构与交付物

```
/src
  /engine            // 纯函数引擎 + types + rng（零 Firebase 依赖）
  /engine/__tests__  // vitest 单测
  /firebase          // 初始化、房间/动作封装、judge runner（裁判运行时）
  /components
  /pages             // Home / Lobby / Game / Result
firestore.rules
firebase.json
.env.example         // VITE_FIREBASE_* 占位
README.md
```

README 必须包含：Firebase 控制台逐步配置指南（创建项目 → 开启 Anonymous Auth → 建 Firestore → 部署 rules → 填 .env → `npm run dev` → `firebase deploy`）、信任模型声明、规则裁定记录、验收清单勾选结果。

---

## 7. 开发里程碑（按序执行，每步可运行）

- **M1** 脚手架 + Firebase 初始化 + 匿名登录 + 创建/加入房间 + 等待页。
- **M2** 规则引擎纯函数 + 全量单测（先于任何对局 UI）。
- **M3** 裁判运行时接入：发牌→出牌→质疑→判定→重发 全流程在线可玩（简陋 UI 即可）。
- **M4** 边界完善：R-15 强制验证、超时、重连、裁判迁移、2 人局、FORFEIT。
- **M5** UI/动画/音效打磨，移动端适配。
- **M6** 结算与再来一局、README、部署 Hosting。

---

## 8. 验收测试清单（完成后逐项自验，结果写入 README）

引擎单测覆盖：
- [ ] 质疑假牌→出牌者判定；质疑全真→质疑者判定；含 joker 的混合手判真（R-12, R-2）
- [ ] 张数约束 1~3；cardIds 不属于手牌的 action 被拒（R-8, 3.5）
- [ ] 命运牌概率序列 1/6→1/5→…（安全牌移除）；炸弹即出局（R-13）
- [ ] 打空者被跳过，其最后一手仍可被质疑（R-11）
- [ ] R-15 强制验证模式全部分支
- [ ] R-14 (a)(b) 两种小局结束路径；判定者为下小局首家（R-7）
- [ ] 2 人局轮转；仅剩 1 人判胜（R-16, R-17）
- [ ] 非当前回合玩家的 action 被拒绝

联机实测（两台设备 + 多浏览器）：
- [ ] 4 人完整对局打到决出胜者
- [ ] 用普通玩家身份直接查 Firestore：读不到他人 hands 与 secrets（规则生效）
- [ ] 刷新重连恢复；关闭房主页面后裁判迁移成功、对局继续
- [ ] 手机竖屏可顺畅完成多选出牌与质疑

---

## 9. 可选进阶（核心验收通过后再做）

- 迁移到 **Cloud Functions（onCall）** 实现服务端权威、彻底防作弊：复用 engine 纯函数；hands 改为仅本人可读，secrets 不再暴露给任何客户端。
- 观战模式完善、快捷喊话（「开他！」「我全真」）、基于 events 流的对局回放、命运牌概率提示、过期房间清理（createdAt 超 24h 由任意客户端触发删除或忽略）。

---

## 附录：术语表

| 术语 | 含义 |
|---|---|
| 主题动物 | 本小局所有出牌被默认宣称的动物（猫/狗/羊之一） |
| 万能牌 joker | 验证时视为任意主题动物，恒为真 |
| 质疑 / 开他 | 翻验上家最近一手牌 |
| 死亡判定 | 从自己剩余命运牌中随机翻一张 |
| 命运牌 / 炸弹牌 | 每人 6 张（1 炸弹 + 5 安全），跨小局不重置 |
| 小局 | 一次发牌到一次判定（或全部打空）之间 |
| 裁判 / judge | 运行引擎并推进状态的权威客户端，可迁移 |

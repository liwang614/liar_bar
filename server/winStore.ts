// 按昵称持久化胜场（奖杯数）。better-sqlite3 同步 API，dev(vitePlugin) 与
// prod(standalone) 都通过 GameHub 持有同一个 WinStore。键为昵称（用户要求）。
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DEFAULT_PATH = process.env.LIARBAR_DB ?? 'data/liarbar.db';

export class WinStore {
  private db: Database.Database;

  constructor(path: string = DEFAULT_PATH) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS wins (nickname TEXT PRIMARY KEY, wins INTEGER NOT NULL DEFAULT 0)',
    );
  }

  // 查询某昵称当前胜场，缺省 0。空白昵称不参与持久化。
  getWins(nickname: string): number {
    const name = nickname.trim();
    if (!name) return 0;
    const row = this.db.prepare('SELECT wins FROM wins WHERE nickname = ?').get(name) as
      | { wins: number }
      | undefined;
    return row?.wins ?? 0;
  }

  // 读取并并入客户端上报的本地值（取较大，一次性迁移老 localStorage 数据），返回当前值。
  seed(nickname: string, reported: number): number {
    const name = nickname.trim();
    if (!name) return 0;
    const safe = Math.max(0, Math.floor(reported) || 0);
    this.db
      .prepare(
        'INSERT INTO wins(nickname, wins) VALUES(?, ?) ON CONFLICT(nickname) DO UPDATE SET wins = MAX(wins, excluded.wins)',
      )
      .run(name, safe);
    return this.getWins(name);
  }

  // 胜者 +1（落库），返回新值。
  addWin(nickname: string): number {
    const name = nickname.trim();
    if (!name) return 0;
    this.db
      .prepare(
        'INSERT INTO wins(nickname, wins) VALUES(?, 1) ON CONFLICT(nickname) DO UPDATE SET wins = wins + 1',
      )
      .run(name);
    return this.getWins(name);
  }
}

import * as SQLite from 'expo-sqlite';
import { api } from './api';

/**
 * Offline-first sync queue for completed refills, reclaims and walk-in
 * sales. Each operation is written to the local DB *first*, then the
 * uploader drains the queue when connectivity returns. Drivers can keep
 * working even with zero bars of signal — critical in Iraq.
 *
 * The schema is intentionally minimal: one row per pending mutation,
 * with the HTTP method, path, and JSON body. The uploader iterates rows
 * oldest-first and deletes on 2xx response.
 */
let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('maa-worker.db');
  await dbInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retries INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);
  return dbInstance;
}

export async function enqueue(method: 'POST' | 'PATCH', path: string, body: any) {
  const db = await getDB();
  await db.runAsync(
    'INSERT INTO pending_mutations (method, path, body, created_at) VALUES (?, ?, ?, ?)',
    method,
    path,
    JSON.stringify(body),
    Date.now(),
  );
}

export async function pendingCount(): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pending_mutations',
  );
  return row?.n ?? 0;
}

/**
 * Tries to upload everything in the queue. Stops on the first failure
 * so we don't burn battery hammering a dead server. Caller should retry
 * later (e.g. on connectivity-change events or app foreground).
 */
export async function flush(): Promise<{ ok: number; failed: number }> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: number;
    method: string;
    path: string;
    body: string;
    retries: number;
  }>('SELECT id, method, path, body, retries FROM pending_mutations ORDER BY id ASC');

  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await api.request({
        method: r.method,
        url: r.path,
        data: JSON.parse(r.body),
      });
      await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', r.id);
      ok++;
    } catch (e: any) {
      failed++;
      await db.runAsync(
        'UPDATE pending_mutations SET retries = retries + 1, last_error = ? WHERE id = ?',
        String(e?.message ?? e),
        r.id,
      );
      // If it's a 4xx (validation error), discard — retrying won't help.
      const status = e?.response?.status ?? 0;
      if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
        await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', r.id);
      }
      break; // stop on first failure
    }
  }
  return { ok, failed };
}

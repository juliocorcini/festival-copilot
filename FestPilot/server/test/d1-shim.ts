// A minimal D1Database shim backed by sql.js (SQLite compiled to WASM, no native
// build). Implements only the surface our code uses: prepare().bind().all()/first()/run()
// and db.batch(). Lets us run the REAL migration + REAL store SQL offline, in CI.

import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { createRequire } from "node:module";

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

function getSql() {
  if (!sqlPromise) {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    sqlPromise = initSqlJs({ locateFile: () => wasmPath });
  }
  return sqlPromise;
}

/** Create an in-memory SQLite DB and apply the given schema SQL. */
export async function createSqliteDb(schemaSql: string): Promise<Database> {
  const SQL = await getSql();
  const db = new SQL.Database();
  db.run(schemaSql);
  return db;
}

class ShimStatement {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly args: SqlValue[] = []
  ) {}

  bind(...args: SqlValue[]): ShimStatement {
    return new ShimStatement(this.db, this.sql, args);
  }

  async all<T>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }> {
    const stmt = this.db.prepare(this.sql);
    try {
      if (this.args.length) stmt.bind(this.args);
      const results: T[] = [];
      while (stmt.step()) results.push(stmt.getAsObject() as unknown as T);
      return { results, success: true, meta: {} };
    } finally {
      stmt.free();
    }
  }

  async first<T>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    try {
      if (this.args.length) stmt.bind(this.args);
      if (stmt.step()) return stmt.getAsObject() as unknown as T;
      return null;
    } finally {
      stmt.free();
    }
  }

  async run(): Promise<{ success: boolean; meta: Record<string, unknown> }> {
    this.db.run(this.sql, this.args);
    // Mirror D1's `meta.changes` (rows affected by the last write) so repos that branch on it work.
    return { success: true, meta: { changes: this.db.getRowsModified() } };
  }

  /** Used by batch(); sql.js is synchronous. */
  execSync(): void {
    this.db.run(this.sql, this.args);
  }
}

class ShimD1 {
  constructor(private readonly db: Database) {}

  prepare(sql: string): ShimStatement {
    return new ShimStatement(this.db, sql);
  }

  async batch(stmts: ShimStatement[]): Promise<Array<{ success: boolean; meta: Record<string, unknown> }>> {
    this.db.run("BEGIN");
    try {
      for (const s of stmts) s.execSync();
      this.db.run("COMMIT");
    } catch (e) {
      this.db.run("ROLLBACK");
      throw e;
    }
    return stmts.map(() => ({ success: true, meta: {} }));
  }
}

/** Wrap a sql.js Database as a (subset of) D1Database for our store/repo code. */
export function makeD1(db: Database): D1Database {
  return new ShimD1(db) as unknown as D1Database;
}

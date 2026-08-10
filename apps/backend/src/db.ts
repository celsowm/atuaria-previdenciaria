import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sqlite3 from "sqlite3";
import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  type SqliteClientLike
} from "metal-orm";
import { seedDemoData, seedReferenceData } from "./database-seed.js";
import { synchronizeEntitySchema } from "./schema.js";

let database: sqlite3.Database | null = null;
let orm: Orm | null = null;
let databasePath: string | null = null;

function execSql(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    db.exec(sql, (error) => (error ? reject(error) : resolvePromise()));
  });
}

function closeSqlite(db: sqlite3.Database): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    db.close((error) => (error ? reject(error) : resolvePromise()));
  });
}

function sqliteClient(db: sqlite3.Database): SqliteClientLike {
  return {
    all(sql, params = []) {
      return new Promise((resolvePromise, reject) => {
        db.all(sql, params, (error, rows) =>
          error ? reject(error) : resolvePromise(rows as Record<string, unknown>[])
        );
      });
    },
    beginTransaction: () => execSql(db, "BEGIN IMMEDIATE"),
    commitTransaction: () => execSql(db, "COMMIT"),
    rollbackTransaction: () => execSql(db, "ROLLBACK")
  };
}

export async function initializeDatabase() {
  if (database && orm) return databasePath!;

  const file = resolve(process.env.ATUAS_DB_PATH ?? "./data/atuas.sqlite");
  await mkdir(dirname(file), { recursive: true });

  database = new sqlite3.Database(file);
  databasePath = file;

  await execSql(database, "PRAGMA foreign_keys = ON");
  await execSql(database, "PRAGMA journal_mode = WAL");
  await execSql(database, "PRAGMA synchronous = NORMAL");
  await execSql(database, "PRAGMA busy_timeout = 5000");

  const executor = createSqliteExecutor(sqliteClient(database));
  await synchronizeEntitySchema(executor);
  await seedReferenceData(database);
  await seedDemoData(database);

  orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {}
    }
  });

  return file;
}

export function getDatabasePath() {
  if (!databasePath) throw new Error("ATUAS database is not initialized");
  return databasePath;
}

export function createSession() {
  if (!orm) throw new Error("ATUAS database is not initialized");
  return orm.createSession();
}

export async function closeDatabase() {
  if (!database) return;
  const current = database;
  database = null;
  orm = null;
  databasePath = null;
  await closeSqlite(current);
}

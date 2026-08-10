import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sqlite3 from "sqlite3";
import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  type SqliteClientLike
} from "metal-orm";

let database: sqlite3.Database | null = null;
let orm: Orm | null = null;

function execSql(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    db.exec(sql, (error) => (error ? reject(error) : resolvePromise()));
  });
}

function getValue<T>(db: sqlite3.Database, sql: string): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    db.get(sql, (error, row) => (error ? reject(error) : resolvePromise(row as T)));
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
    beginTransaction: () => execSql(db, "BEGIN"),
    commitTransaction: () => execSql(db, "COMMIT"),
    rollbackTransaction: () => execSql(db, "ROLLBACK")
  };
}

export async function initializeDatabase() {
  const file = resolve(process.env.ATUAS_DB_PATH ?? "./data/atuas.sqlite");
  await mkdir(dirname(file), { recursive: true });

  database = new sqlite3.Database(file);
  await execSql(database, "PRAGMA foreign_keys = ON");
  await execSql(database, "PRAGMA journal_mode = WAL");

  await execSql(database, `
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planName TEXT NOT NULL,
      referenceDate TEXT NOT NULL,
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      progress INTEGER NOT NULL,
      blockingIssues INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mapping_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      population TEXT NOT NULL,
      version TEXT NOT NULL,
      mappedFields INTEGER NOT NULL,
      totalFields INTEGER NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      baseUrl TEXT NOT NULL,
      model TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS llm_provider_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      providerId INTEGER NOT NULL,
      label TEXT NOT NULL,
      secretRef TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 100,
      FOREIGN KEY(providerId) REFERENCES llm_providers(id) ON DELETE CASCADE
    );
  `);

  const evaluationCount = await getValue<{ count: number }>(database, "SELECT COUNT(*) AS count FROM evaluations");
  if (evaluationCount.count === 0) {
    await execSql(database, `
      INSERT INTO evaluations (planName, referenceDate, status, stage, progress, blockingIssues, updatedAt) VALUES
        ('Plano Previdenciário Alfa', '2025-12-31', 'Em andamento', 'Fechamento', 82, 3, '2026-08-10T13:40:00.000Z'),
        ('Plano Beta', '2025-12-31', 'Em andamento', 'Aderência', 57, 0, '2026-08-10T12:55:00.000Z'),
        ('Plano Gama', '2025-12-31', 'Aguardando correção', 'Crítica cadastral', 23, 47, '2026-08-10T11:20:00.000Z');

      INSERT INTO mapping_profiles (name, population, version, mappedFields, totalFields, updatedAt) VALUES
        ('PREV-X Ativos', 'Ativos', 'v3', 46, 47, '2026-08-10T10:00:00.000Z'),
        ('PREV-X Assistidos', 'Assistidos', 'v2', 31, 31, '2026-07-28T10:00:00.000Z');
    `);
  }

  const providerCount = await getValue<{ count: number }>(database, "SELECT COUNT(*) AS count FROM llm_providers");
  if (providerCount.count === 0) {
    await execSql(database, `
      INSERT INTO llm_providers (name, baseUrl, model, enabled) VALUES
        ('PGE LLM', 'https://llm.interno/v1', 'modelo-principal', 1),
        ('OpenAI', 'https://api.openai.com/v1', 'modelo-redacao', 1);

      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Produção 01', 'env://ATUAS_PGE_LLM_KEY_1', 1, 10 FROM llm_providers WHERE name = 'PGE LLM';
      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Produção 02', 'env://ATUAS_PGE_LLM_KEY_2', 1, 20 FROM llm_providers WHERE name = 'PGE LLM';
      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Produção 03', 'env://ATUAS_PGE_LLM_KEY_3', 1, 30 FROM llm_providers WHERE name = 'PGE LLM';
      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Produção 01', 'env://ATUAS_OPENAI_KEY_1', 1, 10 FROM llm_providers WHERE name = 'OpenAI';
    `);
  }

  const executor = createSqliteExecutor(sqliteClient(database));
  orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {}
    }
  });
}

export function createSession() {
  if (!orm) throw new Error("ATUAS database is not initialized");
  return orm.createSession();
}

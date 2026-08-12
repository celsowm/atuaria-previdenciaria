import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import sqlite3 from "sqlite3";
import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  type SqliteClientLike
} from "metal-orm";
import { linkLegacyEvaluationsToPlans, seedDemoData, seedReferenceData } from "./database-seed.js";
import { databaseFilePath } from "./runtime-paths.js";
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

function runSql(db: sqlite3.Database, sql: string, params: unknown[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    db.run(sql, params, (error) => (error ? reject(error) : resolvePromise()));
  });
}

function allSql<T extends object>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolvePromise, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolvePromise(rows as T[]));
  });
}

async function garantirColunaCampoUnicoLgpd(db: sqlite3.Database, tabela: string) {
  const colunas = await allSql<{ name: string }>(db, `PRAGMA table_info(${tabela})`);
  if (!colunas.some((coluna) => coluna.name === "campo_unico_lgpd")) {
    await execSql(db, `ALTER TABLE ${tabela} ADD COLUMN campo_unico_lgpd TEXT`);
  }
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

  const file = databaseFilePath();
  await mkdir(dirname(file), { recursive: true });

  database = new sqlite3.Database(file);
  databasePath = file;

  await execSql(database, "PRAGMA foreign_keys = ON");
  await execSql(database, "PRAGMA journal_mode = WAL");
  await execSql(database, "PRAGMA synchronous = NORMAL");
  await execSql(database, "PRAGMA busy_timeout = 5000");

  const executor = createSqliteExecutor(sqliteClient(database));
  await synchronizeEntitySchema(executor);
  await garantirColunaCampoUnicoLgpd(database, "resultados_participantes_calculo");
  await garantirColunaCampoUnicoLgpd(database, "inconsistencias_critica");
  await seedReferenceData(database);
  await seedDemoData(database);
  await linkLegacyEvaluationsToPlans(database);

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
  if (!databasePath) throw new Error("Atuária Previdenciária database is not initialized");
  return databasePath;
}

export function createSession() {
  if (!orm) throw new Error("Atuária Previdenciária database is not initialized");
  return orm.createSession();
}

/** Executa escrita parametrizada no banco operacional. Uso restrito a fluxos cujo schema usa nomes físicos em português. */
export async function executarSql(sql: string, params: unknown[] = []) {
  if (!database) throw new Error("Banco de dados não inicializado.");
  await runSql(database, sql, params);
}

export async function consultarSql<T extends object>(sql: string, params: unknown[] = []) {
  if (!database) throw new Error("Banco de dados não inicializado.");
  return new Promise<T[]>((resolvePromise, reject) => {
    database!.all(sql, params, (error, rows) => error ? reject(error) : resolvePromise(rows as T[]));
  });
}

export async function closeDatabase() {
  if (!database) return;
  const current = database;
  database = null;
  orm = null;
  databasePath = null;
  await closeSqlite(current);
}

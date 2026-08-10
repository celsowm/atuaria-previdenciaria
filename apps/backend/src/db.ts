import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sqlite3 from "sqlite3";
import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  type SqliteClientLike
} from "metal-orm";
import { synchronizeEntitySchema } from "./schema.js";

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

  const executor = createSqliteExecutor(sqliteClient(database));
  await synchronizeEntitySchema(executor);

  const evaluationCount = await getValue<{ count: number }>(database, "SELECT COUNT(*) AS count FROM evaluations");
  if (evaluationCount.count === 0) {
    await execSql(database, `
      INSERT INTO evaluations (planName, referenceDate, status, stage, progress, blockingIssues, updatedAt) VALUES
        ('Plano Previdenciário Alfa', '2025-12-31', 'Em andamento', 'Fechamento', 82, 3, '2026-08-10T13:40:00.000Z'),
        ('Plano Beta', '2025-12-31', 'Em andamento', 'Aderência', 57, 0, '2026-08-10T12:55:00.000Z'),
        ('Plano Gama', '2025-12-31', 'Aguardando correção', 'Crítica cadastral', 23, 47, '2026-08-10T11:20:00.000Z');

      INSERT INTO mapping_profiles
        (name, population, version, schemaFingerprint, rulesFingerprint, sourceHeadersJson, mappedFields, totalFields, updatedAt)
      VALUES
        ('PREV-X Ativos', 'Ativos', 'v3', NULL, NULL, NULL, 46, 47, '2026-08-10T10:00:00.000Z'),
        ('PREV-X Assistidos', 'Assistidos', 'v2', NULL, NULL, NULL, 31, 31, '2026-07-28T10:00:00.000Z');
    `);
  }

  await execSql(database, `
    INSERT OR IGNORE INTO critique_rules (id, code, name, severity, category, description, configJson, enabled) VALUES
      ('STRUCTURAL_IMPORT_INVALID', 'STRUCTURAL_IMPORT_INVALID', 'Falha estrutural da importação', 'BLOCKING', 'DATA_QUALITY', 'A linha não passou pela validação estrutural RAW/NORMALIZED/CANONICAL.', '{}', 1),
      ('MISSING_REGISTRATION', 'MISSING_REGISTRATION', 'Matrícula ausente', 'BLOCKING', 'CADASTRAL', 'Participante sem matrícula canônica.', '{}', 1),
      ('DUPLICATE_REGISTRATION', 'DUPLICATE_REGISTRATION', 'Matrícula duplicada', 'BLOCKING', 'CADASTRAL', 'A mesma matrícula aparece mais de uma vez na massa.', '{}', 1),
      ('INVALID_BIRTH_DATE', 'INVALID_BIRTH_DATE', 'Data de nascimento inválida', 'BLOCKING', 'CADASTRAL', 'Data de nascimento ausente ou inválida.', '{}', 1),
      ('AGE_OUTLIER', 'AGE_OUTLIER', 'Idade fora da faixa esperada', 'INCONSISTENCY', 'ACTUARIAL', 'Idade incompatível com a faixa configurada para crítica.', '{"min":14,"max":100}', 1),
      ('PLAN_JOIN_BEFORE_ADMISSION', 'PLAN_JOIN_BEFORE_ADMISSION', 'Tempo de plano superior ao tempo de empresa', 'INCONSISTENCY', 'ACTUARIAL', 'A data de ingresso no plano é anterior à data de admissão.', '{}', 1),
      ('NON_POSITIVE_SALARY', 'NON_POSITIVE_SALARY', 'Salário de contribuição não positivo', 'INCONSISTENCY', 'ACTUARIAL', 'Salário de contribuição deve ser maior que zero quando informado.', '{}', 1),
      ('SEX_CHANGED', 'SEX_CHANGED', 'Sexo alterado entre avaliações', 'INCONSISTENCY', 'HISTORICAL', 'O sexo canônico diverge do exercício anterior.', '{}', 1),
      ('BIRTH_DATE_CHANGED', 'BIRTH_DATE_CHANGED', 'Nascimento alterado entre avaliações', 'INCONSISTENCY', 'HISTORICAL', 'A data de nascimento diverge do exercício anterior.', '{}', 1),
      ('SALARY_VARIATION', 'SALARY_VARIATION', 'Variação salarial relevante', 'WARNING', 'HISTORICAL', 'O salário de contribuição variou acima do limite configurado.', '{"thresholdPercent":50}', 1),
      ('NEW_PARTICIPANT', 'NEW_PARTICIPANT', 'Novo participante', 'INFO', 'MOVEMENT', 'Participante não existia na massa do exercício anterior.', '{}', 1),
      ('PARTICIPANT_EXIT', 'PARTICIPANT_EXIT', 'Saída da massa', 'INFO', 'MOVEMENT', 'Participante do exercício anterior não aparece na massa atual.', '{}', 1);
  `);

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

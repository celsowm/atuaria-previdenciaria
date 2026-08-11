import type sqlite3 from "sqlite3";

function execSql(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
}

function getValue<T>(db: sqlite3.Database, sql: string): Promise<T> {
  return new Promise((resolve, reject) => {
    db.get(sql, (error, row) => (error ? reject(error) : resolve(row as T)));
  });
}

export async function seedReferenceData(db: sqlite3.Database) {
  await execSql(db, `
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
}

export async function seedDemoData(db: sqlite3.Database) {
  if (process.env.APP_SEED_DEMO !== "true") return;

  await execSql(db, `
    INSERT OR IGNORE INTO plans (id, code, name, modality, sponsorName, cnpj, status, createdAt, updatedAt) VALUES
      ('6d74e611-a2e0-4f51-b727-100000000001', 'ALFA-BD', 'Plano Previdenciário Alfa', 'BD', 'Patrocinadora Alfa', NULL, 'ACTIVE', '2026-08-10T13:00:00.000Z', '2026-08-10T13:00:00.000Z'),
      ('6d74e611-a2e0-4f51-b727-100000000002', 'BETA-CD', 'Plano Beta', 'CD', 'Patrocinadora Beta', NULL, 'ACTIVE', '2026-08-10T13:00:00.000Z', '2026-08-10T13:00:00.000Z'),
      ('6d74e611-a2e0-4f51-b727-100000000003', 'GAMA-CV', 'Plano Gama', 'CV', 'Patrocinadora Gama', NULL, 'ACTIVE', '2026-08-10T13:00:00.000Z', '2026-08-10T13:00:00.000Z');
  `);

  const evaluationCount = await getValue<{ count: number }>(db, "SELECT COUNT(*) AS count FROM evaluations");
  if (evaluationCount.count === 0) {
    await execSql(db, `
      INSERT INTO evaluations (planId, planName, referenceDate, status, stage, progress, blockingIssues, updatedAt)
        SELECT id, name, '2025-12-31', 'Em andamento', 'Fechamento', 82, 3, '2026-08-10T13:40:00.000Z' FROM plans WHERE code = 'ALFA-BD'
        UNION ALL
        SELECT id, name, '2025-12-31', 'Em andamento', 'Aderência', 57, 0, '2026-08-10T12:55:00.000Z' FROM plans WHERE code = 'BETA-CD'
        UNION ALL
        SELECT id, name, '2025-12-31', 'Aguardando correção', 'Crítica cadastral', 23, 47, '2026-08-10T11:20:00.000Z' FROM plans WHERE code = 'GAMA-CV';

      INSERT INTO mapping_profiles
        (name, population, version, schemaFingerprint, rulesFingerprint, sourceHeadersJson, mappedFields, totalFields, updatedAt)
      VALUES
        ('PREV-X Ativos', 'Ativos', 'v3', NULL, NULL, NULL, 46, 47, '2026-08-10T10:00:00.000Z'),
        ('PREV-X Assistidos', 'Assistidos', 'v2', NULL, NULL, NULL, 31, 31, '2026-07-28T10:00:00.000Z');
    `);
  }

  const providerCount = await getValue<{ count: number }>(db, "SELECT COUNT(*) AS count FROM llm_providers");
  if (providerCount.count === 0) {
    await execSql(db, `
      INSERT INTO llm_providers (name, baseUrl, model, enabled) VALUES
        ('OpenAI-compatible', 'http://localhost:8000/v1', 'modelo-principal', 1),
        ('OpenAI', 'https://api.openai.com/v1', 'modelo-redacao', 1);

      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Credencial 01', 'env://APP_LLM_KEY_1', 1, 10 FROM llm_providers WHERE name = 'OpenAI-compatible';
      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Credencial 02', 'env://APP_LLM_KEY_2', 1, 20 FROM llm_providers WHERE name = 'OpenAI-compatible';
      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Credencial 03', 'env://APP_LLM_KEY_3', 1, 30 FROM llm_providers WHERE name = 'OpenAI-compatible';
      INSERT INTO llm_provider_credentials (providerId, label, secretRef, enabled, priority)
        SELECT id, 'Credencial 01', 'env://OPENAI_API_KEY', 1, 10 FROM llm_providers WHERE name = 'OpenAI';
    `);
  }
}

export async function linkLegacyEvaluationsToPlans(db: sqlite3.Database) {
  await execSql(db, `
    UPDATE evaluations
       SET planId = (
         SELECT plans.id
           FROM plans
          WHERE plans.name = evaluations.planName
          ORDER BY plans.id
          LIMIT 1
       )
     WHERE planId IS NULL
       AND (
         SELECT COUNT(*)
           FROM plans
          WHERE plans.name = evaluations.planName
       ) = 1;
  `);
}

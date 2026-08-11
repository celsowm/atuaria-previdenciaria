import { createHash } from "node:crypto";
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

function getValues<T>(db: sqlite3.Database, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (error, rows) => (error ? reject(error) : resolve(rows as T[])));
  });
}

type SeedRow = Record<string, unknown>;

function demoUuid(value: string) {
  const digest = createHash("sha256").update(`atuaria-previdenciaria-demo:${value}`).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function normalizeSeedValue(column: string, value: unknown) {
  if (
    typeof value === "string" &&
    value.startsWith("demo-") &&
    (column === "id" || column.endsWith("Id"))
  ) {
    return demoUuid(value);
  }
  return value;
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function insertIgnoreRows(
  db: sqlite3.Database,
  table: string,
  columns: string[],
  rows: SeedRow[]
) {
  if (rows.length === 0) return;
  const values = rows
    .map((row) => `(${columns.map((column) => sqlValue(normalizeSeedValue(column, row[column]))).join(", ")})`)
    .join(",\n");
  await execSql(db, `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES ${values};`);
}

async function migrateLegacyDemoIdentifiers(db: sqlite3.Database) {
  const identifierColumns: Array<[string, string]> = [
    ["plan_rules_versions", "id"],
    ["plan_rule_values", "id"], ["plan_rule_values", "planRulesVersionId"],
    ["mapping_rules", "id"],
    ["import_files", "id"],
    ["import_jobs", "id"], ["import_jobs", "fileId"],
    ["import_rows", "id"], ["import_rows", "importJobId"],
    ["critique_runs", "id"], ["critique_runs", "importJobId"], ["critique_runs", "previousImportJobId"],
    ["critique_issues", "id"], ["critique_issues", "critiqueRunId"], ["critique_issues", "importRowId"], ["critique_issues", "previousImportRowId"],
    ["biometric_tables", "id"],
    ["biometric_table_versions", "id"], ["biometric_table_versions", "tableId"], ["biometric_table_versions", "parentVersionId"],
    ["biometric_table_points", "id"], ["biometric_table_points", "versionId"],
    ["adherence_studies", "id"],
    ["adherence_observations", "id"], ["adherence_observations", "studyId"],
    ["adherence_candidate_results", "id"], ["adherence_candidate_results", "studyId"], ["adherence_candidate_results", "biometricVersionId"],
    ["adherence_candidate_points", "id"], ["adherence_candidate_points", "candidateResultId"],
    ["actuarial_parameterizations", "id"],
    ["actuarial_parameter_values", "id"], ["actuarial_parameter_values", "parameterizationId"],
    ["actuarial_hypothesis_selections", "id"], ["actuarial_hypothesis_selections", "parameterizationId"], ["actuarial_hypothesis_selections", "adherenceStudyId"], ["actuarial_hypothesis_selections", "candidateResultId"], ["actuarial_hypothesis_selections", "biometricVersionId"],
    ["calculation_runs", "id"], ["calculation_runs", "parameterizationId"], ["calculation_runs", "planRulesVersionId"],
    ["calculation_inputs", "id"], ["calculation_inputs", "calculationRunId"], ["calculation_inputs", "importJobId"],
    ["calculation_result_metrics", "id"], ["calculation_result_metrics", "calculationRunId"],
    ["calculation_participant_results", "id"], ["calculation_participant_results", "calculationRunId"], ["calculation_participant_results", "importJobId"]
  ];
  const legacyIds = new Set<string>();
  for (const [table, column] of identifierColumns) {
    const rows = await getValues<{ value: string }>(db, `SELECT DISTINCT ${column} AS value FROM ${table} WHERE ${column} LIKE 'demo-%'`);
    for (const row of rows) if (row.value) legacyIds.add(row.value);
  }
  if (legacyIds.size === 0) return;

  await execSql(db, "PRAGMA foreign_keys = OFF");
  for (const legacyId of legacyIds) {
    const replacement = demoUuid(legacyId);
    for (const [table, column] of identifierColumns) {
      await execSql(db, `UPDATE ${table} SET ${column} = ${sqlValue(replacement)} WHERE ${column} = ${sqlValue(legacyId)}`);
    }
  }
  await execSql(db, "PRAGMA foreign_keys = ON");
}

async function ensureEvaluation(
  db: sqlite3.Database,
  planCode: string,
  planName: string,
  referenceDate: string,
  status: string,
  stage: string,
  progress: number,
  blockingIssues: number,
  updatedAt: string
) {
  const code = sqlValue(planCode);
  await execSql(db, `
    INSERT INTO evaluations (planId, planName, referenceDate, status, stage, progress, blockingIssues, updatedAt)
      SELECT id, ${sqlValue(planName)}, ${sqlValue(referenceDate)}, ${sqlValue(status)}, ${sqlValue(stage)}, ${progress}, ${blockingIssues}, ${sqlValue(updatedAt)}
        FROM plans
       WHERE code = ${code}
         AND NOT EXISTS (SELECT 1 FROM evaluations WHERE planName = ${sqlValue(planName)} AND referenceDate = ${sqlValue(referenceDate)});
  `);
  const row = await getValue<{ id: number } | undefined>(
    db,
    `SELECT id FROM evaluations WHERE planName = ${sqlValue(planName)} AND referenceDate = ${sqlValue(referenceDate)} ORDER BY id LIMIT 1`
  );
  if (!row) throw new Error(`Demo evaluation was not created for ${planCode}.`);
  return row.id;
}

async function ensureMappingProfile(
  db: sqlite3.Database,
  name: string,
  population: string,
  version: string,
  sourceHeadersJson: string,
  mappedFields: number,
  totalFields: number,
  updatedAt: string
) {
  await execSql(db, `
    INSERT INTO mapping_profiles
      (name, population, version, schemaFingerprint, rulesFingerprint, sourceHeadersJson, mappedFields, totalFields, updatedAt)
    SELECT ${sqlValue(name)}, ${sqlValue(population)}, ${sqlValue(version)}, ${sqlValue(`demo-schema-${population.toLowerCase()}`)}, ${sqlValue(`demo-rules-${population.toLowerCase()}`)}, ${sqlValue(sourceHeadersJson)}, ${mappedFields}, ${totalFields}, ${sqlValue(updatedAt)}
     WHERE NOT EXISTS (SELECT 1 FROM mapping_profiles WHERE name = ${sqlValue(name)} AND population = ${sqlValue(population)});
  `);
  const row = await getValue<{ id: number } | undefined>(
    db,
    `SELECT id FROM mapping_profiles WHERE name = ${sqlValue(name)} AND population = ${sqlValue(population)} ORDER BY id LIMIT 1`
  );
  if (!row) throw new Error(`Demo mapping profile was not created: ${name}.`);
  return row.id;
}

function participant(
  registration: string,
  birthDate: string,
  sex: "MALE" | "FEMALE",
  salary: number,
  admissionDate: string,
  planJoinDate: string,
  population = "Ativos"
) {
  return {
    population,
    "participant.registration": registration,
    "participant.name": `Participante Demo ${registration || "sem matrícula"}`,
    "participant.birthDate": birthDate,
    "participant.sex": sex,
    "participant.admissionDate": admissionDate,
    "participant.planJoinDate": planJoinDate,
    "participant.contributionSalary": salary
  };
}

function qxAt(age: number, sex: "MALE" | "FEMALE") {
  if (age >= 110) return 1;
  const sexFactor = sex === "FEMALE" ? 0.84 : 1;
  return Math.min(0.999999, 0.0007 * Math.exp((age - 35) / 10) * sexFactor);
}

async function ensureProvider(db: sqlite3.Database, name: string, baseUrl: string, model: string) {
  await execSql(db, `
    INSERT INTO llm_providers (name, baseUrl, model, enabled)
    SELECT ${sqlValue(name)}, ${sqlValue(baseUrl)}, ${sqlValue(model)}, 1
     WHERE NOT EXISTS (SELECT 1 FROM llm_providers WHERE name = ${sqlValue(name)});
  `);
  const row = await getValue<{ id: number } | undefined>(
    db,
    `SELECT id FROM llm_providers WHERE name = ${sqlValue(name)} ORDER BY id LIMIT 1`
  );
  if (!row) throw new Error(`Demo LLM provider was not created: ${name}.`);
  return row.id;
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

  await migrateLegacyDemoIdentifiers(db);

  const now = "2026-08-10T13:00:00.000Z";
  const referenceDate = "2025-12-31";

  await execSql(db, `
    INSERT OR IGNORE INTO plans (id, code, name, modality, sponsorName, cnpj, status, createdAt, updatedAt) VALUES
      ('6d74e611-a2e0-4f51-b727-100000000001', 'ALFA-BD', 'Plano Previdenciário Alfa', 'BD', 'Patrocinadora Alfa', '12.345.678/0001-90', 'ACTIVE', ${sqlValue(now)}, ${sqlValue(now)}),
      ('6d74e611-a2e0-4f51-b727-100000000002', 'BETA-CD', 'Plano Beta', 'CD', 'Patrocinadora Beta', '23.456.789/0001-01', 'ACTIVE', ${sqlValue(now)}, ${sqlValue(now)}),
      ('6d74e611-a2e0-4f51-b727-100000000003', 'GAMA-CV', 'Plano Gama', 'CV', 'Patrocinadora Gama', '34.567.890/0001-12', 'ACTIVE', ${sqlValue(now)}, ${sqlValue(now)});
  `);

  const alfaEvaluationId = await ensureEvaluation(db, "ALFA-BD", "Plano Previdenciário Alfa", referenceDate, "Em andamento", "Fechamento", 82, 3, "2026-08-10T13:40:00.000Z");
  const betaEvaluationId = await ensureEvaluation(db, "BETA-CD", "Plano Beta", referenceDate, "Em andamento", "Aderência", 57, 0, "2026-08-10T12:55:00.000Z");
  const gamaEvaluationId = await ensureEvaluation(db, "GAMA-CV", "Plano Gama", referenceDate, "Aguardando correção", "Crítica cadastral", 23, 47, "2026-08-10T11:20:00.000Z");

  const headers = ["MATRICULA", "NOME", "NASCIMENTO", "SEXO", "ADMISSAO", "INGRESSO_PLANO", "SALARIO"].map((value) => value);
  const ativosProfileId = await ensureMappingProfile(db, "PREV-X Ativos", "Ativos", "v3", JSON.stringify(headers), 7, 7, "2026-08-10T10:00:00.000Z");
  const assistidosProfileId = await ensureMappingProfile(db, "PREV-X Assistidos", "Assistidos", "v2", JSON.stringify(["MATRICULA", "NOME", "NASCIMENTO", "SEXO", "BENEFICIO"]), 5, 5, "2026-07-28T10:00:00.000Z");

  await insertIgnoreRows(db, "plan_rules_versions", ["id", "planId", "version", "name", "modality", "status", "effectiveFrom", "effectiveTo", "rulesFingerprint", "notes", "createdAt", "updatedAt", "approvedAt"], [
    { id: "demo-rules-alfa-v1", planId: "6d74e611-a2e0-4f51-b727-100000000001", version: 1, name: "Regras BD · Exercício 2025", modality: "BD", status: "APPROVED", effectiveFrom: "2025-01-01", effectiveTo: null, rulesFingerprint: "demo-fingerprint-rules-alfa-v1", notes: "Snapshot demonstrativo para navegação do produto.", createdAt: now, updatedAt: now, approvedAt: now },
    { id: "demo-rules-beta-v1", planId: "6d74e611-a2e0-4f51-b727-100000000002", version: 1, name: "Regras CD · Exercício 2025", modality: "CD", status: "APPROVED", effectiveFrom: "2025-01-01", effectiveTo: null, rulesFingerprint: "demo-fingerprint-rules-beta-v1", notes: "Snapshot demonstrativo de plano CD.", createdAt: now, updatedAt: now, approvedAt: now },
    { id: "demo-rules-gama-v1", planId: "6d74e611-a2e0-4f51-b727-100000000003", version: 1, name: "Regras CV · Exercício 2025", modality: "CV", status: "APPROVED", effectiveFrom: "2025-01-01", effectiveTo: null, rulesFingerprint: "demo-fingerprint-rules-gama-v1", notes: "Snapshot demonstrativo de plano CV.", createdAt: now, updatedAt: now, approvedAt: now },
    { id: "demo-rules-alfa-v2-draft", planId: "6d74e611-a2e0-4f51-b727-100000000001", version: 2, name: "Regras BD · Proposta 2026", modality: "BD", status: "DRAFT", effectiveFrom: null, effectiveTo: null, rulesFingerprint: null, notes: "Rascunho para demonstrar o fluxo de aprovação.", createdAt: now, updatedAt: now, approvedAt: null }
  ]);

  const ruleRows = [
    ["demo-rules-alfa-v1", "BENEFIT.CALCULATION_BASIS", "BENEFIT", "Base de cálculo do benefício", "STRING", JSON.stringify("FINAL_SALARY"), null],
    ["demo-rules-alfa-v1", "BENEFIT.NORMAL_RETIREMENT_AGE", "BENEFIT", "Idade normal de aposentadoria", "NUMBER", "60", "anos"],
    ["demo-rules-alfa-v1", "BENEFIT.MINIMUM_PLAN_YEARS", "BENEFIT", "Carência mínima no plano", "NUMBER", "10", "anos"],
    ["demo-rules-alfa-v1", "BENEFIT.MINIMUM_SPONSOR_YEARS", "BENEFIT", "Carência mínima no patrocinador", "NUMBER", "5", "anos"],
    ["demo-rules-alfa-v1", "BENEFIT.ACCRUAL_RATE", "BENEFIT", "Taxa de formação do benefício", "NUMBER", "0.02", "% a.a."],
    ["demo-rules-alfa-v1", "BENEFIT.MAXIMUM_AGE", "BENEFIT", "Idade limite para projeção", "NUMBER", "110", "anos"],
    ["demo-rules-beta-v1", "BENEFIT.CALCULATION_BASIS", "BENEFIT", "Base de cálculo do benefício", "STRING", JSON.stringify("ACCOUNT_BALANCE"), null],
    ["demo-rules-beta-v1", "BENEFIT.NORMAL_RETIREMENT_AGE", "BENEFIT", "Idade normal de aposentadoria", "NUMBER", "60", "anos"],
    ["demo-rules-gama-v1", "BENEFIT.CALCULATION_BASIS", "BENEFIT", "Base de cálculo do benefício", "STRING", JSON.stringify("FINAL_SALARY"), null],
    ["demo-rules-gama-v1", "BENEFIT.NORMAL_RETIREMENT_AGE", "BENEFIT", "Idade normal de aposentadoria", "NUMBER", "62", "anos"]
  ].map(([planRulesVersionId, code, category, label, valueType, valueJson, unit], index) => ({
    id: `demo-rule-value-${index + 1}`,
    planRulesVersionId,
    code,
    category,
    label,
    valueType,
    valueJson,
    unit,
    source: "Catálogo demonstrativo · não regulatório",
    active: 1,
    updatedAt: now
  }));
  await insertIgnoreRows(db, "plan_rule_values", ["id", "planRulesVersionId", "code", "category", "label", "valueType", "valueJson", "unit", "source", "active", "updatedAt"], ruleRows);

  await insertIgnoreRows(db, "mapping_rules", ["id", "profileId", "ordinal", "sourcesJson", "targetsJson", "transform"], [
    { id: "demo-map-registration", profileId: ativosProfileId, ordinal: 1, sourcesJson: JSON.stringify(["MATRICULA"]), targetsJson: JSON.stringify(["participant.registration"]), transform: "IDENTITY" },
    { id: "demo-map-birth", profileId: ativosProfileId, ordinal: 2, sourcesJson: JSON.stringify(["NASCIMENTO"]), targetsJson: JSON.stringify(["participant.birthDate"]), transform: "DATE_ISO" },
    { id: "demo-map-sex", profileId: ativosProfileId, ordinal: 3, sourcesJson: JSON.stringify(["SEXO"]), targetsJson: JSON.stringify(["participant.sex"]), transform: "SEX_NORMALIZE" },
    { id: "demo-map-salary", profileId: ativosProfileId, ordinal: 4, sourcesJson: JSON.stringify(["SALARIO"]), targetsJson: JSON.stringify(["participant.contributionSalary"]), transform: "NUMBER_BR" },
    { id: "demo-map-admission", profileId: ativosProfileId, ordinal: 5, sourcesJson: JSON.stringify(["ADMISSAO"]), targetsJson: JSON.stringify(["participant.admissionDate"]), transform: "DATE_ISO" },
    { id: "demo-map-join", profileId: ativosProfileId, ordinal: 6, sourcesJson: JSON.stringify(["INGRESSO_PLANO"]), targetsJson: JSON.stringify(["participant.planJoinDate"]), transform: "DATE_ISO" },
    { id: "demo-map-benefit", profileId: assistidosProfileId, ordinal: 1, sourcesJson: JSON.stringify(["BENEFICIO"]), targetsJson: JSON.stringify(["participant.monthlyBenefit"]), transform: "NUMBER_BR" }
  ]);

  await insertIgnoreRows(db, "import_files", ["id", "originalName", "mimeType", "sizeBytes", "sha256", "storagePath", "createdAt"], [
    { id: "demo-file-ativos-2025", originalName: "PREV-X_Ativos_2025.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 184320, sha256: "demo-sha256-ativos-2025", storagePath: "demo/PREV-X_Ativos_2025.xlsx", createdAt: now },
    { id: "demo-file-ativos-2024", originalName: "PREV-X_Ativos_2024.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 176128, sha256: "demo-sha256-ativos-2024", storagePath: "demo/PREV-X_Ativos_2024.xlsx", createdAt: "2025-08-10T10:00:00.000Z" },
    { id: "demo-file-assistidos-2025", originalName: "PREV-X_Assistidos_2025.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 92160, sha256: "demo-sha256-assistidos-2025", storagePath: "demo/PREV-X_Assistidos_2025.xlsx", createdAt: now }
  ]);

  await insertIgnoreRows(db, "import_jobs", ["id", "evaluationId", "fileId", "mappingProfileId", "population", "sheetName", "headerRow", "sourceHeadersJson", "schemaFingerprint", "status", "rowCount", "validRows", "invalidRows", "createdAt", "completedAt"], [
    { id: "demo-job-ativos-2025", evaluationId: alfaEvaluationId, fileId: "demo-file-ativos-2025", mappingProfileId: ativosProfileId, population: "Ativos", sheetName: "Ativos", headerRow: 1, sourceHeadersJson: JSON.stringify(headers), schemaFingerprint: "demo-schema-ativos-v3", status: "COMPLETED", rowCount: 9, validRows: 8, invalidRows: 1, createdAt: now, completedAt: now },
    { id: "demo-job-ativos-2024", evaluationId: alfaEvaluationId, fileId: "demo-file-ativos-2024", mappingProfileId: ativosProfileId, population: "Ativos", sheetName: "Ativos", headerRow: 1, sourceHeadersJson: JSON.stringify(headers), schemaFingerprint: "demo-schema-ativos-v2", status: "COMPLETED", rowCount: 6, validRows: 6, invalidRows: 0, createdAt: "2025-08-10T10:00:00.000Z", completedAt: "2025-08-10T10:15:00.000Z" },
    { id: "demo-job-assistidos-2025", evaluationId: betaEvaluationId, fileId: "demo-file-assistidos-2025", mappingProfileId: assistidosProfileId, population: "Assistidos", sheetName: "Assistidos", headerRow: 1, sourceHeadersJson: JSON.stringify(["MATRICULA", "NOME", "NASCIMENTO", "SEXO", "BENEFICIO"]), schemaFingerprint: "demo-schema-assistidos-v2", status: "COMPLETED", rowCount: 4, validRows: 4, invalidRows: 0, createdAt: now, completedAt: now }
  ]);

  const ativosRows = [
    participant("000001", "1985-11-25", "MALE", 8500, "2010-02-01", "2010-03-01"),
    participant("000002", "1979-04-03", "FEMALE", 11200, "2008-07-15", "2008-08-01"),
    participant("000003", "1990-08-19", "MALE", 6200, "2015-01-10", "2015-02-01"),
    participant("000004", "1988-02-14", "FEMALE", 7300, "2012-05-02", "2012-06-01"),
    participant("000005", "1972-06-30", "MALE", 14800, "2000-01-03", "2000-02-01"),
    participant("000006", "1968-09-11", "FEMALE", 17600, "1998-04-20", "1998-05-01"),
    participant("000007", "1982-12-01", "MALE", 9100, "2011-09-12", "2011-10-01"),
    participant("000008", "1975-03-22", "FEMALE", 13200, "2004-11-08", "2004-12-01"),
    participant("", "1986-07-07", "MALE", 0, "2014-03-10", "2014-04-01")
  ];
  const previousRows = ativosRows.slice(0, 6).map((row, index) => ({ ...row, "participant.contributionSalary": Number(row["participant.contributionSalary"]) * (index === 1 ? 0.62 : 0.96) }));
  const assistidosRows = [
    { population: "Assistidos", "participant.registration": "A-1001", "participant.name": "Assistido Demo 1001", "participant.birthDate": "1958-04-12", "participant.sex": "MALE", "participant.monthlyBenefit": 6800 },
    { population: "Assistidos", "participant.registration": "A-1002", "participant.name": "Assistida Demo 1002", "participant.birthDate": "1961-10-28", "participant.sex": "FEMALE", "participant.monthlyBenefit": 5400 },
    { population: "Assistidos", "participant.registration": "A-1003", "participant.name": "Assistido Demo 1003", "participant.birthDate": "1955-01-19", "participant.sex": "MALE", "participant.monthlyBenefit": 8100 },
    { population: "Assistidos", "participant.registration": "A-1004", "participant.name": "Assistida Demo 1004", "participant.birthDate": "1963-06-05", "participant.sex": "FEMALE", "participant.monthlyBenefit": 4700 }
  ];
  const rowSeed = (jobId: string, rowNumber: number, data: SeedRow, valid: boolean) => ({
    id: `demo-row-${jobId}-${rowNumber}`,
    importJobId: jobId,
    rowNumber,
    rawJson: JSON.stringify(data),
    normalizedJson: JSON.stringify(data),
    canonicalJson: JSON.stringify(data),
    validationStatus: valid ? "VALID" : "INVALID",
    validationErrorsJson: valid ? "[]" : JSON.stringify([{ code: "MISSING_REGISTRATION", field: "participant.registration" }, { code: "NON_POSITIVE_SALARY", field: "participant.contributionSalary" }])
  });
  await insertIgnoreRows(db, "import_rows", ["id", "importJobId", "rowNumber", "rawJson", "normalizedJson", "canonicalJson", "validationStatus", "validationErrorsJson"], [
    ...ativosRows.map((row, index) => rowSeed("demo-job-ativos-2025", index + 2, row, index < 8)),
    ...previousRows.map((row, index) => rowSeed("demo-job-ativos-2024", index + 2, row, true)),
    ...assistidosRows.map((row, index) => rowSeed("demo-job-assistidos-2025", index + 2, row, true))
  ]);

  await insertIgnoreRows(db, "critique_runs", ["id", "importJobId", "previousImportJobId", "status", "blockingCount", "inconsistencyCount", "warningCount", "infoCount", "createdAt", "completedAt"], [
    { id: "demo-critique-ativos-2025", importJobId: "demo-job-ativos-2025", previousImportJobId: "demo-job-ativos-2024", status: "COMPLETED", blockingCount: 3, inconsistencyCount: 2, warningCount: 1, infoCount: 2, createdAt: now, completedAt: now }
  ]);
  await insertIgnoreRows(db, "critique_issues", ["id", "critiqueRunId", "ruleId", "ruleCode", "importRowId", "previousImportRowId", "participantRegistration", "severity", "category", "status", "fieldPath", "currentValueJson", "previousValueJson", "message", "detailsJson", "createdAt", "resolutionNote", "resolvedAt"], [
    { id: "demo-issue-missing-registration", critiqueRunId: "demo-critique-ativos-2025", ruleId: "MISSING_REGISTRATION", ruleCode: "MISSING_REGISTRATION", importRowId: "demo-row-demo-job-ativos-2025-10", previousImportRowId: null, participantRegistration: null, severity: "BLOCKING", category: "CADASTRAL", status: "OPEN", fieldPath: "participant.registration", currentValueJson: "null", previousValueJson: null, message: "Participante sem matrícula canônica.", detailsJson: JSON.stringify({ source: "demo" }), createdAt: now, resolutionNote: null, resolvedAt: null },
    { id: "demo-issue-salary", critiqueRunId: "demo-critique-ativos-2025", ruleId: "NON_POSITIVE_SALARY", ruleCode: "NON_POSITIVE_SALARY", importRowId: "demo-row-demo-job-ativos-2025-10", previousImportRowId: null, participantRegistration: null, severity: "INCONSISTENCY", category: "ACTUARIAL", status: "OPEN", fieldPath: "participant.contributionSalary", currentValueJson: "0", previousValueJson: null, message: "Salário de contribuição deve ser maior que zero.", detailsJson: JSON.stringify({ source: "demo" }), createdAt: now, resolutionNote: null, resolvedAt: null },
    { id: "demo-issue-salary-variation", critiqueRunId: "demo-critique-ativos-2025", ruleId: "SALARY_VARIATION", ruleCode: "SALARY_VARIATION", importRowId: "demo-row-demo-job-ativos-2025-3", previousImportRowId: "demo-row-demo-job-ativos-2024-3", participantRegistration: "000002", severity: "WARNING", category: "HISTORICAL", status: "OPEN", fieldPath: "participant.contributionSalary", currentValueJson: "11200", previousValueJson: "6944", message: "Variação salarial relevante em relação ao exercício anterior.", detailsJson: JSON.stringify({ thresholdPercent: 50, source: "demo" }), createdAt: now, resolutionNote: null, resolvedAt: null },
    { id: "demo-issue-sex-change", critiqueRunId: "demo-critique-ativos-2025", ruleId: "SEX_CHANGED", ruleCode: "SEX_CHANGED", importRowId: "demo-row-demo-job-ativos-2025-4", previousImportRowId: "demo-row-demo-job-ativos-2024-4", participantRegistration: "000003", severity: "INCONSISTENCY", category: "HISTORICAL", status: "JUSTIFIED", fieldPath: "participant.sex", currentValueJson: JSON.stringify("MALE"), previousValueJson: JSON.stringify("FEMALE"), message: "Sexo alterado entre avaliações.", detailsJson: JSON.stringify({ source: "demo" }), createdAt: now, resolutionNote: "Revisão cadastral demonstrativa concluída.", resolvedAt: now },
    { id: "demo-issue-new-participant", critiqueRunId: "demo-critique-ativos-2025", ruleId: "NEW_PARTICIPANT", ruleCode: "NEW_PARTICIPANT", importRowId: "demo-row-demo-job-ativos-2025-8", previousImportRowId: null, participantRegistration: "000007", severity: "INFO", category: "MOVEMENT", status: "OPEN", fieldPath: null, currentValueJson: JSON.stringify("000007"), previousValueJson: null, message: "Novo participante na massa atual.", detailsJson: JSON.stringify({ source: "demo" }), createdAt: now, resolutionNote: null, resolvedAt: null },
    { id: "demo-issue-exit", critiqueRunId: "demo-critique-ativos-2025", ruleId: "PARTICIPANT_EXIT", ruleCode: "PARTICIPANT_EXIT", importRowId: null, previousImportRowId: "demo-row-demo-job-ativos-2024-7", participantRegistration: "000006", severity: "INFO", category: "MOVEMENT", status: "OPEN", fieldPath: null, currentValueJson: null, previousValueJson: JSON.stringify("000006"), message: "Participante do exercício anterior não aparece na massa atual.", detailsJson: JSON.stringify({ source: "demo" }), createdAt: now, resolutionNote: null, resolvedAt: null }
  ]);

  const biometricTables = [
    { id: "demo-table-at-2025", code: "AT-2025", name: "AT-2025 · Mortalidade", kind: "MORTALITY", sexScope: "BOTH", source: "Base demonstrativa", description: "Tábua sintética para navegação e testes do produto.", enabled: 1, createdAt: now, updatedAt: now },
    { id: "demo-table-at-2015", code: "AT-2015", name: "AT-2015 · Mortalidade", kind: "MORTALITY", sexScope: "BOTH", source: "Base histórica demonstrativa", description: "Versão alternativa para comparação de aderência.", enabled: 1, createdAt: now, updatedAt: now }
  ];
  await insertIgnoreRows(db, "biometric_tables", ["id", "code", "name", "kind", "sexScope", "source", "description", "enabled", "createdAt", "updatedAt"], biometricTables);
  await insertIgnoreRows(db, "biometric_table_versions", ["id", "tableId", "version", "status", "effectiveFrom", "effectiveTo", "parentVersionId", "derivationType", "derivationParametersJson", "minAge", "maxAge", "pointCount", "createdAt"], [
    { id: "demo-biometric-at-2025-v1", tableId: "demo-table-at-2025", version: "v1", status: "APPROVED", effectiveFrom: "2025-01-01", effectiveTo: null, parentVersionId: null, derivationType: null, derivationParametersJson: "{}", minAge: 25, maxAge: 110, pointCount: 172, createdAt: now },
    { id: "demo-biometric-at-2015-v1", tableId: "demo-table-at-2015", version: "v1", status: "APPROVED", effectiveFrom: "2015-01-01", effectiveTo: "2024-12-31", parentVersionId: null, derivationType: null, derivationParametersJson: "{}", minAge: 25, maxAge: 110, pointCount: 172, createdAt: now }
  ]);
  const biometricPoints: SeedRow[] = [];
  for (const version of ["demo-biometric-at-2025-v1", "demo-biometric-at-2015-v1"]) {
    for (let age = 25; age <= 110; age += 1) {
      for (const sex of ["MALE", "FEMALE"] as const) {
        const base = qxAt(age, sex);
        const qx = version === "demo-biometric-at-2015-v1" ? Math.min(1, base * 1.08) : base;
        biometricPoints.push({ id: `demo-point-${version}-${sex}-${age}`, versionId: version, age, sex, qx });
      }
    }
  }
  await insertIgnoreRows(db, "biometric_table_points", ["id", "versionId", "age", "sex", "qx"], biometricPoints);

  const observations: SeedRow[] = [];
  for (const year of [2021, 2022, 2023, 2024]) {
    for (const age of [50, 55, 60, 65]) {
      for (const sex of ["MALE", "FEMALE"] as const) {
        const exposure = 90 + age + (sex === "FEMALE" ? 8 : 0);
        observations.push({ id: `demo-observation-${year}-${age}-${sex}`, studyId: "demo-adherence-2025", year, age, sex, exposure, observedEvents: Math.max(0, Math.round(exposure * qxAt(age, sex) * (year === 2024 ? 1.02 : 0.98))) });
      }
    }
  }
  await insertIgnoreRows(db, "adherence_studies", ["id", "evaluationId", "name", "hypothesisType", "periodStart", "periodEnd", "sexScope", "alpha", "fisherSplitAge", "status", "engineVersion", "observationCount", "candidateCount", "createdAt", "completedAt"], [
    { id: "demo-adherence-2025", evaluationId: alfaEvaluationId, name: "Aderência · Mortalidade Ativos 2021–2024", hypothesisType: "MORTALITY", periodStart: 2021, periodEnd: 2024, sexScope: "BOTH", alpha: 0.05, fisherSplitAge: 60, status: "COMPLETED", engineVersion: "adherence-engine-v1", observationCount: observations.length, candidateCount: 2, createdAt: now, completedAt: now }
  ]);
  await insertIgnoreRows(db, "adherence_observations", ["id", "studyId", "year", "age", "sex", "exposure", "observedEvents"], observations);
  await insertIgnoreRows(db, "adherence_candidate_results", ["id", "studyId", "biometricVersionId", "tableCode", "tableName", "versionLabel", "rank", "observedEvents", "expectedEvents", "chiSquare", "chiSquareDf", "chiSquareCritical", "chiSquareP", "chiSquarePass", "ksD", "ksCritical", "ksP", "ksPass", "zStatistic", "zCritical", "zP", "zPass", "fisherP", "fisherPass", "dqm", "rejectedTests", "createdAt"], [
    { id: "demo-candidate-at-2025", studyId: "demo-adherence-2025", biometricVersionId: "demo-biometric-at-2025-v1", tableCode: "AT-2025", tableName: "AT-2025 · Mortalidade", versionLabel: "v1", rank: 1, observedEvents: 49, expectedEvents: 50.72, chiSquare: 0.21, chiSquareDf: 7, chiSquareCritical: 14.07, chiSquareP: 0.999, chiSquarePass: 1, ksD: 0.041, ksCritical: 0.228, ksP: 0.991, ksPass: 1, zStatistic: -0.24, zCritical: 1.96, zP: 0.81, zPass: 1, fisherP: 0.76, fisherPass: 1, dqm: 0.0339, rejectedTests: 0, createdAt: now },
    { id: "demo-candidate-at-2015", studyId: "demo-adherence-2025", biometricVersionId: "demo-biometric-at-2015-v1", tableCode: "AT-2015", tableName: "AT-2015 · Mortalidade", versionLabel: "v1", rank: 2, observedEvents: 49, expectedEvents: 54.78, chiSquare: 1.12, chiSquareDf: 7, chiSquareCritical: 14.07, chiSquareP: 0.992, chiSquarePass: 1, ksD: 0.088, ksCritical: 0.228, ksP: 0.73, ksPass: 1, zStatistic: -0.74, zCritical: 1.96, zP: 0.46, zPass: 1, fisherP: 0.42, fisherPass: 1, dqm: 0.1055, rejectedTests: 0, createdAt: now }
  ]);
  const candidatePoints: SeedRow[] = [];
  for (const candidate of [{ id: "demo-candidate-at-2025", version: "demo-biometric-at-2025-v1" }, { id: "demo-candidate-at-2015", version: "demo-biometric-at-2015-v1" }]) {
    for (const row of observations) {
      const sex = row.sex as "MALE" | "FEMALE";
      const age = Number(row.age);
      const exposure = Number(row.exposure);
      const observedEvents = Number(row.observedEvents);
      const qx = candidate.version === "demo-biometric-at-2015-v1" ? Math.min(1, qxAt(age, sex) * 1.08) : qxAt(age, sex);
      const expectedEvents = exposure * qx;
      candidatePoints.push({ id: `demo-candidate-point-${candidate.id}-${row.year}-${row.age}-${row.sex}`, candidateResultId: candidate.id, age, sex, exposure, observedEvents, qx, expectedEvents, residual: observedEvents - expectedEvents });
    }
  }
  await insertIgnoreRows(db, "adherence_candidate_points", ["id", "candidateResultId", "age", "sex", "exposure", "observedEvents", "qx", "expectedEvents", "residual"], candidatePoints);

  await insertIgnoreRows(db, "actuarial_parameterizations", ["id", "evaluationId", "version", "name", "status", "notes", "createdAt", "updatedAt", "approvedAt"], [
    { id: "demo-parameterization-alfa-v1", evaluationId: alfaEvaluationId, version: 1, name: "Hipóteses Atuariais · Base 2025", status: "APPROVED", notes: "Snapshot demonstrativo aprovado para cálculo BD_PVFB.", createdAt: now, updatedAt: now, approvedAt: now },
    { id: "demo-parameterization-beta-v1", evaluationId: betaEvaluationId, version: 1, name: "Hipóteses CD · Rascunho", status: "DRAFT", notes: "Rascunho demonstrativo de parametrização.", createdAt: now, updatedAt: now, approvedAt: null }
  ]);
  const parameterRows = [
    ["demo-parameterization-alfa-v1", "ECONOMIC.REAL_INTEREST_RATE", "ECONOMIC", "Taxa real de juros", "NUMBER", "5", "% a.a.", "Nota técnica demonstrativa"],
    ["demo-parameterization-alfa-v1", "ECONOMIC.SALARY_GROWTH_RATE", "ECONOMIC", "Crescimento real de salários", "NUMBER", "2", "% a.a.", "Nota técnica demonstrativa"],
    ["demo-parameterization-alfa-v1", "ECONOMIC.BENEFIT_GROWTH_RATE", "ECONOMIC", "Crescimento real de benefícios", "NUMBER", "0", "% a.a.", "Nota técnica demonstrativa"],
    ["demo-parameterization-alfa-v1", "ACTUARIAL.TURNOVER_RATE", "ACTUARIAL", "Rotatividade", "NUMBER", "1.5", "% a.a." , "Estudo demonstrativo"],
    ["demo-parameterization-alfa-v1", "BENEFIT.NORMAL_RETIREMENT_AGE", "BENEFIT", "Idade normal de aposentadoria", "NUMBER", "60", "anos", "Regra do plano demonstrativa"],
    ["demo-parameterization-alfa-v1", "BENEFIT.MINIMUM_PLAN_YEARS", "BENEFIT", "Carência mínima no plano", "NUMBER", "10", "anos", "Regra do plano demonstrativa"],
    ["demo-parameterization-alfa-v1", "BENEFIT.MINIMUM_SPONSOR_YEARS", "BENEFIT", "Carência mínima no patrocinador", "NUMBER", "5", "anos", "Regra do plano demonstrativa"],
    ["demo-parameterization-alfa-v1", "FINANCING.METHOD", "FINANCING", "Método de financiamento", "STRING", JSON.stringify("PROJECTED_UNIT_CREDIT"), null, "Nota técnica demonstrativa"],
    ["demo-parameterization-beta-v1", "ECONOMIC.REAL_INTEREST_RATE", "ECONOMIC", "Taxa real de juros", "NUMBER", "4", "% a.a.", "Rascunho demonstrativo"],
    ["demo-parameterization-beta-v1", "BENEFIT.NORMAL_RETIREMENT_AGE", "BENEFIT", "Idade normal de aposentadoria", "NUMBER", "60", "anos", "Rascunho demonstrativo"]
  ].map(([parameterizationId, code, category, label, valueType, valueJson, unit, source], index) => ({ id: `demo-parameter-value-${index + 1}`, parameterizationId, code, category, label, valueType, valueJson, unit, source, active: 1, updatedAt: now }));
  await insertIgnoreRows(db, "actuarial_parameter_values", ["id", "parameterizationId", "code", "category", "label", "valueType", "valueJson", "unit", "source", "active", "updatedAt"], parameterRows);
  await insertIgnoreRows(db, "actuarial_hypothesis_selections", ["id", "parameterizationId", "hypothesisType", "adherenceStudyId", "candidateResultId", "biometricVersionId", "tableCode", "tableName", "versionLabel", "candidateRank", "active", "selectedAt"], [
    { id: "demo-selection-mortality-alfa", parameterizationId: "demo-parameterization-alfa-v1", hypothesisType: "MORTALITY", adherenceStudyId: "demo-adherence-2025", candidateResultId: "demo-candidate-at-2025", biometricVersionId: "demo-biometric-at-2025-v1", tableCode: "AT-2025", tableName: "AT-2025 · Mortalidade", versionLabel: "v1", candidateRank: 1, active: 1, selectedAt: now }
  ]);

  await insertIgnoreRows(db, "calculation_runs", ["id", "evaluationId", "parameterizationId", "planRulesVersionId", "planRulesFingerprint", "engineCode", "engineVersion", "status", "parameterFingerprint", "dataFingerprint", "inputFingerprint", "resultFingerprint", "inputImportCount", "inputRowCount", "validRowCount", "invalidRowCount", "participantResultCount", "createdAt", "completedAt", "errorMessage"], [
    { id: "demo-calculation-alfa-pvfb", evaluationId: alfaEvaluationId, parameterizationId: "demo-parameterization-alfa-v1", planRulesVersionId: "demo-rules-alfa-v1", planRulesFingerprint: "demo-fingerprint-rules-alfa-v1", engineCode: "BD_PVFB", engineVersion: "bd-pvfb-v1", status: "COMPLETED", parameterFingerprint: "demo-fingerprint-parameters-alfa", dataFingerprint: "demo-fingerprint-data-ativos", inputFingerprint: "demo-fingerprint-input-alfa", resultFingerprint: "demo-fingerprint-result-alfa", inputImportCount: 1, inputRowCount: 9, validRowCount: 8, invalidRowCount: 1, participantResultCount: 8, createdAt: now, completedAt: now, errorMessage: null }
  ]);
  await insertIgnoreRows(db, "calculation_inputs", ["id", "calculationRunId", "importJobId", "population", "fileSha256", "schemaFingerprint", "canonicalFingerprint", "rowCount", "validRows", "invalidRows", "importedAt"], [
    { id: "demo-calculation-input-alfa-ativos", calculationRunId: "demo-calculation-alfa-pvfb", importJobId: "demo-job-ativos-2025", population: "Ativos", fileSha256: "demo-sha256-ativos-2025", schemaFingerprint: "demo-schema-ativos-v3", canonicalFingerprint: "demo-fingerprint-canonical-ativos", rowCount: 9, validRows: 8, invalidRows: 1, importedAt: now }
  ]);
  await insertIgnoreRows(db, "calculation_result_metrics", ["id", "calculationRunId", "code", "category", "label", "valueType", "valueJson", "unit", "ordinal"], [
    { id: "demo-metric-pvfb", calculationRunId: "demo-calculation-alfa-pvfb", code: "BD.PVFB.TOTAL", category: "BD_PVFB", label: "Valor presente dos benefícios futuros", valueType: "NUMBER", valueJson: "12784320.55", unit: "BRL", ordinal: 1 },
    { id: "demo-metric-participants", calculationRunId: "demo-calculation-alfa-pvfb", code: "BD.PVFB.PARTICIPANT_COUNT", category: "POPULATION", label: "Participantes calculados", valueType: "NUMBER", valueJson: "8", unit: "participantes", ordinal: 2 },
    { id: "demo-metric-salary", calculationRunId: "demo-calculation-alfa-pvfb", code: "BD.PVFB.CURRENT_MONTHLY_SALARY", category: "POPULATION", label: "Folha mensal atual", valueType: "NUMBER", valueJson: "87900", unit: "BRL/mês", ordinal: 3 },
    { id: "demo-metric-rate", calculationRunId: "demo-calculation-alfa-pvfb", code: "BD.PVFB.REAL_INTEREST_RATE", category: "ECONOMIC", label: "Taxa real de juros", valueType: "NUMBER", valueJson: "5", unit: "% a.a.", ordinal: 4 }
  ]);
  await insertIgnoreRows(db, "calculation_participant_results", ["id", "calculationRunId", "importJobId", "population", "sourceRowNumber", "participantRegistration", "resultJson", "ordinal"], ativosRows.slice(0, 8).map((row, index) => ({ id: `demo-participant-result-${index + 1}`, calculationRunId: "demo-calculation-alfa-pvfb", importJobId: "demo-job-ativos-2025", population: "Ativos", sourceRowNumber: index + 2, participantRegistration: String(row["participant.registration"]), resultJson: JSON.stringify({ participantRegistration: row["participant.registration"], currentAge: 35 + index, currentMonthlySalary: row["participant.contributionSalary"], projectedBenefit: 3200 + index * 410, pvfb: 820000 + index * 128000, status: "COMPLETED" }), ordinal: index + 1 })));

  await insertIgnoreRows(db, "actuarial_closings", ["id", "evaluationId", "calculationRunId", "status", "notes", "createdAt", "updatedAt", "finalizedAt"], [
    { id: "demo-closing-alfa-2025", evaluationId: alfaEvaluationId, calculationRunId: "demo-calculation-alfa-pvfb", status: "FINALIZED", notes: "Fechamento demonstrativo baseado na rodada BD_PVFB. PVFB não representa provisão técnica.", createdAt: now, updatedAt: now, finalizedAt: now }
  ]);
  await insertIgnoreRows(db, "actuarial_closing_lines", ["id", "closingId", "code", "category", "label", "valueJson", "unit", "source", "ordinal"], [
    { id: "demo-closing-line-pvfb", closingId: "demo-closing-alfa-2025", code: "BD.PVFB.TOTAL", category: "BD_PVFB", label: "Valor presente dos benefícios futuros", valueJson: "12784320.55", unit: "BRL", source: "CalculationRun bd-pvfb-v1", ordinal: 1 },
    { id: "demo-closing-line-population", closingId: "demo-closing-alfa-2025", code: "BD.PVFB.PARTICIPANT_COUNT", category: "POPULATION", label: "Participantes calculados", valueJson: "8", unit: "participantes", source: "CalculationRun bd-pvfb-v1", ordinal: 2 },
    { id: "demo-closing-line-salary", closingId: "demo-closing-alfa-2025", code: "BD.PVFB.CURRENT_MONTHLY_SALARY", category: "POPULATION", label: "Folha mensal atual", valueJson: "87900", unit: "BRL/mês", source: "CalculationRun bd-pvfb-v1", ordinal: 3 }
  ]);

  const compatibleProviderId = await ensureProvider(db, "OpenAI-compatible", "http://localhost:8000/v1", "modelo-principal");
  const openAiProviderId = await ensureProvider(db, "OpenAI", "https://api.openai.com/v1", "modelo-redacao");
  await insertIgnoreRows(db, "llm_provider_credentials", ["id", "providerId", "label", "secretRef", "enabled", "priority"], [
    { id: 1, providerId: compatibleProviderId, label: "Credencial 01", secretRef: "env://APP_LLM_KEY_1", enabled: 1, priority: 10 },
    { id: 2, providerId: compatibleProviderId, label: "Credencial 02", secretRef: "env://APP_LLM_KEY_2", enabled: 1, priority: 20 },
    { id: 3, providerId: compatibleProviderId, label: "Credencial 03", secretRef: "env://APP_LLM_KEY_3", enabled: 1, priority: 30 },
    { id: 4, providerId: openAiProviderId, label: "Credencial 01", secretRef: "env://OPENAI_API_KEY", enabled: 1, priority: 10 }
  ]);

  // Keep the intentionally unused evaluation referenced so the demo includes all modalities.
  void gamaEvaluationId;
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

import { randomUUID } from "node:crypto";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { CritiqueIssue, CritiqueRule, CritiqueRun } from "../domain/critique-entities.js";
import { Evaluation, ImportJob, ImportRow } from "../domain/entities.js";

type Canonical = Record<string, unknown>;
type Severity = "BLOCKING" | "INCONSISTENCY" | "WARNING" | "INFO";

type RowSnapshot = {
  row: ImportRow;
  canonical: Canonical;
};

type IssueInput = {
  code: string;
  row?: RowSnapshot;
  previousRow?: RowSnapshot;
  registration?: string | null;
  fieldPath?: string | null;
  currentValue?: unknown;
  previousValue?: unknown;
  message: string;
  details?: Record<string, unknown>;
};

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableOf(entity: typeof CritiqueRun | typeof CritiqueIssue) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function parseJsonObject(value: string): Canonical {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Canonical
      : {};
  } catch {
    return {};
  }
}

function present(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function registrationOf(row: RowSnapshot) {
  const value = row.canonical["participant.registration"];
  return present(value) ? String(value).trim() : null;
}

function numberOf(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!present(value)) return null;
  const parsed = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function ageAt(birthValue: unknown, referenceDate: string) {
  const birth = isoDate(birthValue);
  const reference = isoDate(referenceDate);
  if (!birth || !reference) return null;
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const month = reference.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && reference.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function jsonValue(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

async function findPreviousImport(current: ImportJob) {
  if (!current.evaluationId) return null;
  return withSession(async (session) => {
    const [evaluations, imports] = await Promise.all([
      selectFromEntity(Evaluation).execute(session),
      selectFromEntity(ImportJob).execute(session)
    ]);
    const currentEvaluation = evaluations.find((item) => item.id === current.evaluationId);
    if (!currentEvaluation) return null;
    const evaluationById = new Map(evaluations.map((item) => [item.id, item]));
    const candidates = imports
      .filter((item) => item.id !== current.id && item.status === "COMPLETED" && item.population === current.population && item.evaluationId)
      .map((item) => ({ item, evaluation: evaluationById.get(item.evaluationId!) }))
      .filter((candidate) => candidate.evaluation?.planName === currentEvaluation.planName && candidate.evaluation.referenceDate < currentEvaluation.referenceDate)
      .sort((a, b) => b.evaluation!.referenceDate.localeCompare(a.evaluation!.referenceDate));
    return candidates[0]?.item ?? null;
  });
}

async function loadRows(importJobId: string) {
  const rows = await withSession((session) => selectFromEntity(ImportRow).execute(session));
  return rows
    .filter((row) => row.importJobId === importJobId)
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map<RowSnapshot>((row) => ({ row, canonical: parseJsonObject(row.canonicalJson) }));
}

async function loadRuleMap() {
  const rules = await withSession((session) => selectFromEntity(CritiqueRule).execute(session));
  return new Map(rules.filter((rule) => rule.enabled === 1).map((rule) => [rule.code, rule]));
}

function groupByRegistration(rows: RowSnapshot[]) {
  const groups = new Map<string, RowSnapshot[]>();
  for (const row of rows) {
    const registration = registrationOf(row);
    if (!registration) continue;
    const list = groups.get(registration) ?? [];
    list.push(row);
    groups.set(registration, list);
  }
  return groups;
}

export async function runCritique(importJobId: string, requestedPreviousImportJobId?: string) {
  const current = await withSession((session) => session.find(ImportJob, importJobId));
  if (!current) throw new Error(`Importação ${importJobId} não encontrada.`);
  if (current.status !== "COMPLETED") throw new Error("A crítica só pode ser executada sobre importações concluídas.");

  const previous = requestedPreviousImportJobId
    ? await withSession((session) => session.find(ImportJob, requestedPreviousImportJobId))
    : await findPreviousImport(current);
  if (previous && previous.population !== current.population) {
    throw new Error("A massa anterior precisa pertencer à mesma população.");
  }

  const [rules, currentRows, previousRows] = await Promise.all([
    loadRuleMap(),
    loadRows(current.id),
    previous ? loadRows(previous.id) : Promise.resolve([])
  ]);

  let referenceDate: string | null = null;
  if (current.evaluationId) {
    const evaluation = await withSession((session) => session.find(Evaluation, current.evaluationId!));
    referenceDate = evaluation?.referenceDate ?? null;
  }

  const run = new CritiqueRun();
  run.id = randomUUID();
  run.importJobId = current.id;
  run.previousImportJobId = previous?.id ?? null;
  run.status = "PROCESSING";
  run.blockingCount = 0;
  run.inconsistencyCount = 0;
  run.warningCount = 0;
  run.infoCount = 0;
  run.createdAt = new Date().toISOString();
  run.completedAt = null;

  await withSession(async (session) => {
    session.trackNew(tableOf(CritiqueRun), run, run.id);
    await session.commit();
  });

  const pending: CritiqueIssue[] = [];
  const counts: Record<Severity, number> = { BLOCKING: 0, INCONSISTENCY: 0, WARNING: 0, INFO: 0 };

  const addIssue = (input: IssueInput) => {
    const rule = rules.get(input.code);
    if (!rule) return;
    const issue = new CritiqueIssue();
    issue.id = randomUUID();
    issue.critiqueRunId = run.id;
    issue.ruleId = rule.id;
    issue.ruleCode = rule.code;
    issue.importRowId = input.row?.row.id ?? null;
    issue.previousImportRowId = input.previousRow?.row.id ?? null;
    issue.participantRegistration = input.registration ?? (input.row ? registrationOf(input.row) : input.previousRow ? registrationOf(input.previousRow) : null);
    issue.severity = rule.severity;
    issue.category = rule.category;
    issue.status = "OPEN";
    issue.fieldPath = input.fieldPath ?? null;
    issue.currentValueJson = jsonValue(input.currentValue);
    issue.previousValueJson = jsonValue(input.previousValue);
    issue.message = input.message;
    issue.detailsJson = JSON.stringify(input.details ?? {});
    issue.createdAt = new Date().toISOString();
    issue.resolutionNote = null;
    issue.resolvedAt = null;
    pending.push(issue);
    counts[rule.severity as Severity] += 1;
  };

  const currentGroups = groupByRegistration(currentRows);
  const previousGroups = groupByRegistration(previousRows);

  for (const snapshot of currentRows) {
    const canonical = snapshot.canonical;
    const registration = registrationOf(snapshot);

    if (snapshot.row.validationStatus !== "VALID") {
      addIssue({
        code: "STRUCTURAL_IMPORT_INVALID",
        row: snapshot,
        registration,
        message: "A linha possui falhas estruturais vindas da importação.",
        details: { errors: JSON.parse(snapshot.row.validationErrorsJson || "[]") }
      });
    }

    if (!registration) {
      addIssue({ code: "MISSING_REGISTRATION", row: snapshot, fieldPath: "participant.registration", message: "Matrícula obrigatória não informada." });
    }

    const birthValue = canonical["participant.birthDate"];
    if (!isoDate(birthValue)) {
      addIssue({ code: "INVALID_BIRTH_DATE", row: snapshot, registration, fieldPath: "participant.birthDate", currentValue: birthValue, message: "Data de nascimento ausente ou inválida." });
    } else if (referenceDate) {
      const rule = rules.get("AGE_OUTLIER");
      const config = rule ? parseJsonObject(rule.configJson) : {};
      const min = Number(config.min ?? 14);
      const max = Number(config.max ?? 100);
      const age = ageAt(birthValue, referenceDate);
      if (age !== null && (age < min || age > max)) {
        addIssue({ code: "AGE_OUTLIER", row: snapshot, registration, fieldPath: "participant.birthDate", currentValue: age, message: `Idade de ${age} anos fora da faixa esperada de ${min} a ${max} anos.`, details: { referenceDate, min, max } });
      }
    }

    const admission = isoDate(canonical["participant.admissionDate"]);
    const planJoin = isoDate(canonical["participant.planJoinDate"]);
    if (admission && planJoin && planJoin < admission) {
      addIssue({
        code: "PLAN_JOIN_BEFORE_ADMISSION",
        row: snapshot,
        registration,
        fieldPath: "participant.planJoinDate",
        currentValue: canonical["participant.planJoinDate"],
        previousValue: canonical["participant.admissionDate"],
        message: "Ingresso no plano anterior à admissão: o tempo de plano supera o tempo de empresa.",
        details: { admissionDate: canonical["participant.admissionDate"], planJoinDate: canonical["participant.planJoinDate"] }
      });
    }

    const salaryValue = canonical["participant.contributionSalary"];
    const salary = numberOf(salaryValue);
    if (present(salaryValue) && (salary === null || salary <= 0)) {
      addIssue({ code: "NON_POSITIVE_SALARY", row: snapshot, registration, fieldPath: "participant.contributionSalary", currentValue: salaryValue, message: "Salário de contribuição deve ser maior que zero." });
    }
  }

  for (const [registration, rows] of currentGroups) {
    if (rows.length <= 1) continue;
    for (const row of rows) {
      addIssue({ code: "DUPLICATE_REGISTRATION", row, registration, fieldPath: "participant.registration", currentValue: registration, message: `Matrícula ${registration} aparece ${rows.length} vezes na massa.`, details: { occurrences: rows.map((item) => item.row.rowNumber) } });
    }
  }

  if (previous) {
    const salaryRule = rules.get("SALARY_VARIATION");
    const salaryConfig = salaryRule ? parseJsonObject(salaryRule.configJson) : {};
    const thresholdPercent = Number(salaryConfig.thresholdPercent ?? 50);

    for (const [registration, rows] of currentGroups) {
      const currentRow = rows[0];
      const previousRow = previousGroups.get(registration)?.[0];
      if (!previousRow) {
        addIssue({ code: "NEW_PARTICIPANT", row: currentRow, registration, message: `Matrícula ${registration} não existia na massa anterior.` });
        continue;
      }

      const currentSex = currentRow.canonical["participant.sex"];
      const previousSex = previousRow.canonical["participant.sex"];
      if (present(currentSex) && present(previousSex) && currentSex !== previousSex) {
        addIssue({ code: "SEX_CHANGED", row: currentRow, previousRow, registration, fieldPath: "participant.sex", currentValue: currentSex, previousValue: previousSex, message: `Sexo alterado de ${String(previousSex)} para ${String(currentSex)}.` });
      }

      const currentBirth = currentRow.canonical["participant.birthDate"];
      const previousBirth = previousRow.canonical["participant.birthDate"];
      if (present(currentBirth) && present(previousBirth) && currentBirth !== previousBirth) {
        addIssue({ code: "BIRTH_DATE_CHANGED", row: currentRow, previousRow, registration, fieldPath: "participant.birthDate", currentValue: currentBirth, previousValue: previousBirth, message: `Data de nascimento diverge do exercício anterior (${String(previousBirth)} → ${String(currentBirth)}).` });
      }

      const currentSalary = numberOf(currentRow.canonical["participant.contributionSalary"]);
      const previousSalary = numberOf(previousRow.canonical["participant.contributionSalary"]);
      if (currentSalary !== null && previousSalary !== null && previousSalary !== 0) {
        const variationPercent = ((currentSalary - previousSalary) / Math.abs(previousSalary)) * 100;
        if (Math.abs(variationPercent) > thresholdPercent) {
          addIssue({
            code: "SALARY_VARIATION",
            row: currentRow,
            previousRow,
            registration,
            fieldPath: "participant.contributionSalary",
            currentValue: currentSalary,
            previousValue: previousSalary,
            message: `Salário variou ${variationPercent.toFixed(1)}% em relação ao exercício anterior.`,
            details: { variationPercent, thresholdPercent }
          });
        }
      }
    }

    for (const [registration, rows] of previousGroups) {
      if (currentGroups.has(registration)) continue;
      const previousRow = rows[0];
      addIssue({ code: "PARTICIPANT_EXIT", previousRow, registration, previousValue: registration, message: `Matrícula ${registration} saiu da massa atual.` });
    }
  }

  const batchSize = 250;
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize);
    await withSession(async (session) => {
      const table = tableOf(CritiqueIssue);
      for (const issue of batch) session.trackNew(table, issue, issue.id);
      await session.commit();
    });
  }

  await withSession(async (session) => {
    const storedRun = await session.find(CritiqueRun, run.id);
    if (!storedRun) throw new Error("Execução de crítica desapareceu durante o processamento.");
    storedRun.status = "COMPLETED";
    storedRun.blockingCount = counts.BLOCKING;
    storedRun.inconsistencyCount = counts.INCONSISTENCY;
    storedRun.warningCount = counts.WARNING;
    storedRun.infoCount = counts.INFO;
    storedRun.completedAt = new Date().toISOString();

    if (current.evaluationId) {
      const evaluation = await session.find(Evaluation, current.evaluationId);
      if (evaluation) {
        evaluation.blockingIssues = counts.BLOCKING;
        evaluation.stage = "Crítica cadastral";
        evaluation.status = counts.BLOCKING > 0 ? "Aguardando correção" : "Em andamento";
        evaluation.progress = Math.max(evaluation.progress, counts.BLOCKING > 0 ? 25 : 30);
        evaluation.updatedAt = new Date().toISOString();
      }
    }
    await session.commit();
  });

  return getCritiqueRun(run.id);
}

export async function getCritiqueRun(runId: string) {
  const run = await withSession((session) => session.find(CritiqueRun, runId));
  if (!run) return null;
  return {
    id: run.id,
    importJobId: run.importJobId,
    previousImportJobId: run.previousImportJobId ?? null,
    status: run.status,
    blockingCount: run.blockingCount,
    inconsistencyCount: run.inconsistencyCount,
    warningCount: run.warningCount,
    infoCount: run.infoCount,
    totalIssues: run.blockingCount + run.inconsistencyCount + run.warningCount + run.infoCount,
    comparedWithPrevious: Boolean(run.previousImportJobId),
    createdAt: run.createdAt,
    completedAt: run.completedAt ?? null
  };
}

export async function listCritiqueIssues(runId: string) {
  const issues = await withSession((session) => selectFromEntity(CritiqueIssue).execute(session));
  return issues
    .filter((issue) => issue.critiqueRunId === runId)
    .sort((a, b) => {
      const order: Record<string, number> = { BLOCKING: 0, INCONSISTENCY: 1, WARNING: 2, INFO: 3 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9) || a.createdAt.localeCompare(b.createdAt);
    })
    .map((issue) => ({
      id: issue.id,
      ruleCode: issue.ruleCode,
      severity: issue.severity,
      category: issue.category,
      status: issue.status,
      participantRegistration: issue.participantRegistration ?? null,
      campoUnicoLgpd: issue.campoUnicoLgpd ?? null,
      fieldPath: issue.fieldPath ?? null,
      currentValueJson: issue.currentValueJson ?? null,
      previousValueJson: issue.previousValueJson ?? null,
      message: issue.message,
      createdAt: issue.createdAt
    }));
}

export async function getCritiqueIssueDetail(issueId: string) {
  const issue = await withSession((session) => session.find(CritiqueIssue, issueId));
  if (!issue) return null;
  const [row, previousRow] = await Promise.all([
    issue.importRowId ? withSession((session) => session.find(ImportRow, issue.importRowId!)) : Promise.resolve(null),
    issue.previousImportRowId ? withSession((session) => session.find(ImportRow, issue.previousImportRowId!)) : Promise.resolve(null)
  ]);
  return {
    id: issue.id,
    ruleCode: issue.ruleCode,
    severity: issue.severity,
    category: issue.category,
    status: issue.status,
    participantRegistration: issue.participantRegistration ?? null,
    campoUnicoLgpd: issue.campoUnicoLgpd ?? null,
    fieldPath: issue.fieldPath ?? null,
    currentValueJson: issue.currentValueJson ?? null,
    previousValueJson: issue.previousValueJson ?? null,
    message: issue.message,
    detailsJson: issue.detailsJson,
    rawJson: row?.rawJson ?? null,
    normalizedJson: row?.normalizedJson ?? null,
    canonicalJson: row?.canonicalJson ?? null,
    previousCanonicalJson: previousRow?.canonicalJson ?? null,
    resolutionNote: issue.resolutionNote ?? null,
    createdAt: issue.createdAt,
    resolvedAt: issue.resolvedAt ?? null
  };
}

export async function resolveCritiqueIssue(issueId: string, status: "JUSTIFIED" | "RESOLVED" | "IGNORED", note: string) {
  return withSession(async (session) => {
    const issue = await session.find(CritiqueIssue, issueId);
    if (!issue) return null;
    issue.status = status;
    issue.resolutionNote = note.trim();
    issue.resolvedAt = new Date().toISOString();
    await session.commit();
    return getCritiqueIssueDetail(issueId);
  });
}

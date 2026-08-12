import { createHash, randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  Evaluation,
  ImportFile,
  ImportJob,
  ImportRow
} from "../domain/entities.js";
import { Plan } from "../domain/plan-entities.js";
import { PlanRuleValue, PlanRulesVersion } from "../domain/plan-rule-entities.js";
import { BiometricTablePoint } from "../domain/biometric-entities.js";
import {
  ActuarialHypothesisSelection,
  ActuarialParameterization,
  ActuarialParameterValue
} from "../domain/parameterization-entities.js";
import {
  CalculationInput,
  CalculationParticipantResult,
  CalculationResultMetric,
  CalculationRun
} from "../domain/calculation-entities.js";
import { calculatePlanRulesFingerprint, comparePlanRuleCode } from "../plans/plan-rules-fingerprint.js";
import "./core-precalculation-engine.js";
import "./bd-pvfb-engine.js";
import {
  getCalculationEngine,
  listCalculationEngines,
  validateCalculationOutput,
  type CalculationEngine,
  type CalculationEngineContext
} from "./calculation-engine.js";

const runRef = entityRef(CalculationRun);
const importJobRef = entityRef(ImportJob);
const importRowRef = entityRef(ImportRow);
const valueRef = entityRef(ActuarialParameterValue);
const selectionRef = entityRef(ActuarialHypothesisSelection);
const planRuleRef = entityRef(PlanRuleValue);
const biometricPointRef = entityRef(BiometricTablePoint);
const inputRef = entityRef(CalculationInput);
const metricRef = entityRef(CalculationResultMetric);
const participantRef = entityRef(CalculationParticipantResult);

type Session = ReturnType<typeof createSession>;

type CalculationEntity =
  | typeof CalculationRun
  | typeof CalculationInput
  | typeof CalculationResultMetric
  | typeof CalculationParticipantResult;

async function withSession<T>(handler: (session: Session) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableOf(entity: CalculationEntity) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedJsonFingerprint(value: unknown) {
  return sha256(JSON.stringify(value));
}

function isModality(value: string): value is "BD" | "CD" | "CV" {
  return value === "BD" || value === "CD" || value === "CV";
}

function isImmutableApprovedSnapshot(status: string) {
  return status === "APPROVED" || status === "SUPERSEDED";
}

function runSummary(row: CalculationRun) {
  return {
    id: row.id,
    evaluationId: row.evaluationId,
    parameterizationId: row.parameterizationId,
    planRulesVersionId: row.planRulesVersionId ?? null,
    planRulesFingerprint: row.planRulesFingerprint ?? null,
    engineCode: row.engineCode,
    engineVersion: row.engineVersion,
    status: row.status,
    inputFingerprint: row.inputFingerprint,
    resultFingerprint: row.resultFingerprint ?? null,
    inputImportCount: row.inputImportCount,
    inputRowCount: row.inputRowCount,
    validRowCount: row.validRowCount,
    invalidRowCount: row.invalidRowCount,
    participantResultCount: row.participantResultCount ?? 0,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    errorMessage: row.errorMessage ?? null
  };
}

async function detailInSession(session: Session, row: CalculationRun) {
  const [inputs, metrics] = await Promise.all([
    selectFromEntity(CalculationInput).where(eq(inputRef.calculationRunId, row.id)).execute(session),
    selectFromEntity(CalculationResultMetric).where(eq(metricRef.calculationRunId, row.id)).execute(session)
  ]);
  return {
    ...runSummary(row),
    parameterFingerprint: row.parameterFingerprint,
    dataFingerprint: row.dataFingerprint,
    inputs: inputs
      .sort((a, b) => a.population.localeCompare(b.population, "pt-BR") || a.importJobId.localeCompare(b.importJobId))
      .map((item) => ({
        id: item.id,
        importJobId: item.importJobId,
        population: item.population,
        fileSha256: item.fileSha256,
        schemaFingerprint: item.schemaFingerprint,
        canonicalFingerprint: item.canonicalFingerprint,
        rowCount: item.rowCount,
        validRows: item.validRows,
        invalidRows: item.invalidRows,
        importedAt: item.importedAt
      })),
    metrics: metrics
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((item) => ({
        id: item.id,
        code: item.code,
        category: item.category,
        label: item.label,
        valueType: item.valueType,
        valueJson: item.valueJson,
        unit: item.unit ?? null,
        ordinal: item.ordinal
      }))
  };
}

export function availableCalculationEngines() {
  return listCalculationEngines();
}

export async function listCalculationRuns(evaluationId: number) {
  return withSession(async (session) => {
    const rows = await selectFromEntity(CalculationRun)
      .where(eq(runRef.evaluationId, evaluationId))
      .orderBy(runRef.createdAt, "DESC")
      .execute(session);
    return rows.map(runSummary);
  });
}

export async function getCalculationRun(id: string) {
  return withSession(async (session) => {
    const row = await session.find(CalculationRun, id);
    return row ? detailInSession(session, row) : null;
  });
}

export async function listCalculationParticipantResults(id: string, page: number, pageSize: number) {
  return withSession(async (session) => {
    const run = await session.find(CalculationRun, id);
    if (!run) return null;
    const result = await selectFromEntity(CalculationParticipantResult)
      .where(eq(participantRef.calculationRunId, id))
      .orderBy(participantRef.ordinal, "ASC")
      .orderBy(participantRef.id, "ASC")
      .executePaged(session, { page, pageSize });
    return {
      items: result.items.map((item) => ({
        id: item.id,
        importJobId: item.importJobId,
        population: item.population,
        sourceRowNumber: item.sourceRowNumber,
        participantRegistration: item.participantRegistration ?? null,
        campoUnicoLgpd: item.campoUnicoLgpd ?? null,
        resultJson: item.resultJson,
        ordinal: item.ordinal
      })),
      totalItems: result.totalItems,
      page,
      pageSize
    };
  });
}

function latestCompletedImports(jobs: ImportJob[]) {
  const byPopulation = new Map<string, ImportJob>();
  const sorted = jobs
    .filter((job) => job.status === "COMPLETED")
    .sort((a, b) => {
      const timeOrder = (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
      return timeOrder || b.id.localeCompare(a.id);
    });
  for (const job of sorted) {
    if (!byPopulation.has(job.population)) byPopulation.set(job.population, job);
  }
  return [...byPopulation.values()].sort(
    (a, b) => a.population.localeCompare(b.population, "pt-BR") || a.id.localeCompare(b.id)
  );
}

async function loadPlanRules(
  session: Session,
  evaluation: Evaluation,
  engine: CalculationEngine,
  planRulesVersionId: string | undefined
): Promise<CalculationEngineContext["planRules"]> {
  if (!engine.requiresPlanRules) {
    if (planRulesVersionId) {
      throw new Error(`O motor ${engine.code} não utiliza regras versionadas do plano; remova planRulesVersionId da solicitação.`);
    }
    return null;
  }

  if (!evaluation.planId) {
    throw new Error("O motor atuarial exige que a avaliação esteja vinculada a um plano por planId.");
  }
  if (!planRulesVersionId) {
    throw new Error(`O motor ${engine.code} exige planRulesVersionId de um snapshot aprovado e imutável.`);
  }

  const plan = await session.find(Plan, evaluation.planId);
  if (!plan) throw new Error("O plano vinculado à avaliação não foi encontrado.");
  if (!isModality(plan.modality)) throw new Error(`Modalidade de plano inválida: ${plan.modality}.`);
  if (!engine.supportedModalities.includes(plan.modality)) {
    throw new Error(`O motor ${engine.code} não suporta plano ${plan.modality}.`);
  }

  const version = await session.find(PlanRulesVersion, planRulesVersionId);
  if (!version || version.planId !== plan.id) {
    throw new Error("A versão de regras informada não pertence ao plano desta avaliação.");
  }
  if (!isImmutableApprovedSnapshot(version.status)) {
    throw new Error("O motor atuarial exige uma versão de regras APPROVED ou SUPERSEDED, ambas imutáveis após aprovação.");
  }
  if (version.modality !== plan.modality) {
    throw new Error("A modalidade congelada na versão de regras diverge da modalidade do plano.");
  }
  if (!version.rulesFingerprint) {
    throw new Error("A versão aprovada das regras do plano não possui fingerprint.");
  }
  if (!version.effectiveFrom) {
    throw new Error("A versão aprovada das regras do plano não possui início de vigência.");
  }
  if (evaluation.referenceDate < version.effectiveFrom || (version.effectiveTo && evaluation.referenceDate > version.effectiveTo)) {
    throw new Error(`A versão de regras não está vigente na data-base ${evaluation.referenceDate}.`);
  }

  const storedRules = await selectFromEntity(PlanRuleValue)
    .where(eq(planRuleRef.planRulesVersionId, version.id))
    .execute(session);
  const rules = storedRules
    .filter((item) => item.active !== 0)
    .sort(comparePlanRuleCode)
    .map((item) => ({
      code: item.code,
      category: item.category,
      label: item.label,
      valueType: item.valueType,
      valueJson: item.valueJson,
      unit: item.unit ?? null,
      source: item.source
    }));
  if (!rules.length) throw new Error("A versão aprovada das regras do plano não possui regras ativas.");

  const recalculatedFingerprint = calculatePlanRulesFingerprint({
    planId: version.planId,
    version: version.version,
    modality: version.modality,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo ?? null,
    rules
  });
  if (recalculatedFingerprint !== version.rulesFingerprint) {
    throw new Error("A integridade da versão de regras do plano falhou: o conteúdo atual não corresponde ao fingerprint aprovado.");
  }

  return {
    id: version.id,
    version: version.version,
    modality: plan.modality,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo ?? null,
    fingerprint: recalculatedFingerprint,
    rules
  };
}

export async function executeCalculation(
  evaluationId: number,
  input: { parameterizationId: string; planRulesVersionId?: string; engineCode?: string }
) {
  return withSession(async (session) => {
    const evaluation = await session.find(Evaluation, evaluationId);
    if (!evaluation) throw new Error("Avaliação não encontrada.");
    if (evaluation.blockingIssues > 0) {
      throw new Error("A avaliação possui ocorrências bloqueantes e não pode ser calculada.");
    }

    const parameterization = await session.find(ActuarialParameterization, input.parameterizationId);
    if (!parameterization || parameterization.evaluationId !== evaluationId) {
      throw new Error("A parametrização não pertence a esta avaliação.");
    }
    if (!isImmutableApprovedSnapshot(parameterization.status)) {
      throw new Error("O cálculo exige uma parametrização APPROVED ou SUPERSEDED, ambas imutáveis após aprovação.");
    }

    const engine = getCalculationEngine(input.engineCode ?? "CORE_PRECALCULATION");
    const planRules = await loadPlanRules(session, evaluation, engine, input.planRulesVersionId);

    const [storedValues, storedSelections, jobs] = await Promise.all([
      selectFromEntity(ActuarialParameterValue)
        .where(eq(valueRef.parameterizationId, parameterization.id))
        .execute(session),
      selectFromEntity(ActuarialHypothesisSelection)
        .where(eq(selectionRef.parameterizationId, parameterization.id))
        .execute(session),
      selectFromEntity(ImportJob)
        .where(eq(importJobRef.evaluationId, evaluationId))
        .execute(session)
    ]);

    const parameters = storedValues
      .filter((value) => value.active !== 0)
      .sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
      .map((value) => ({
        code: value.code,
        category: value.category,
        label: value.label,
        valueType: value.valueType,
        valueJson: value.valueJson,
        unit: value.unit ?? null,
        source: value.source
      }));

    const hypotheses: CalculationEngineContext["parameterization"]["hypotheses"] = [];
    for (const selection of storedSelections
      .filter((item) => item.active !== 0)
      .sort((a, b) => a.hypothesisType < b.hypothesisType ? -1 : a.hypothesisType > b.hypothesisType ? 1 : a.id.localeCompare(b.id))) {
      const storedPoints = await selectFromEntity(BiometricTablePoint)
        .where(eq(biometricPointRef.versionId, selection.biometricVersionId))
        .execute(session);
      const points = storedPoints
        .sort((a, b) => a.age - b.age || a.sex.localeCompare(b.sex))
        .map((point) => ({ age: point.age, sex: point.sex, qx: Number(point.qx) }));
      hypotheses.push({
        hypothesisType: selection.hypothesisType,
        adherenceStudyId: selection.adherenceStudyId,
        candidateResultId: selection.candidateResultId,
        biometricVersionId: selection.biometricVersionId,
        tableCode: selection.tableCode,
        tableName: selection.tableName,
        versionLabel: selection.versionLabel,
        candidateRank: selection.candidateRank,
        points
      });
    }

    const selectedImports = latestCompletedImports(jobs);
    if (!selectedImports.length) {
      throw new Error("A avaliação não possui imports COMPLETED vinculados ao Data Studio.");
    }

    const canonicalRows: CalculationEngineContext["rows"] = [];
    const inputSnapshots: Array<{
      job: ImportJob;
      file: ImportFile;
      canonicalFingerprint: string;
    }> = [];

    for (const job of selectedImports) {
      const file = await session.find(ImportFile, job.fileId);
      if (!file) throw new Error(`Arquivo do import ${job.id} não foi encontrado.`);
      const rows = await selectFromEntity(ImportRow)
        .where(eq(importRowRef.importJobId, job.id))
        .execute(session);
      rows.sort((a, b) => a.rowNumber - b.rowNumber || a.id.localeCompare(b.id));
      const canonicalFingerprint = normalizedJsonFingerprint(rows.map((row) => ({
        id: row.id,
        rowNumber: row.rowNumber,
        validationStatus: row.validationStatus,
        canonicalJson: row.canonicalJson,
        validationErrorsJson: row.validationErrorsJson
      })));
      inputSnapshots.push({ job, file, canonicalFingerprint });

      for (const row of rows) {
        if (row.validationStatus !== "VALID") continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(row.canonicalJson) as Record<string, unknown>;
        } catch {
          throw new Error(`Linha canônica inválida no import ${job.id}, linha ${row.rowNumber}.`);
        }
        canonicalRows.push({ importJobId: job.id, population: job.population, rowNumber: row.rowNumber, data });
      }
    }

    const parameterFingerprint = normalizedJsonFingerprint({
      parameterizationId: parameterization.id,
      version: parameterization.version,
      approvedAt: parameterization.approvedAt ?? null,
      parameters,
      hypotheses
    });
    const dataFingerprint = normalizedJsonFingerprint(inputSnapshots.map(({ job, file, canonicalFingerprint }) => ({
      importJobId: job.id,
      population: job.population,
      fileSha256: file.sha256,
      schemaFingerprint: job.schemaFingerprint,
      canonicalFingerprint,
      rowCount: job.rowCount,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      completedAt: job.completedAt ?? null
    })));
    const inputFingerprint = normalizedJsonFingerprint({
      evaluationId,
      planId: evaluation.planId ?? null,
      referenceDate: evaluation.referenceDate,
      planRules,
      parameterFingerprint,
      dataFingerprint,
      engineCode: engine.code,
      engineVersion: engine.version
    });

    const prior = await selectFromEntity(CalculationRun)
      .where(eq(runRef.evaluationId, evaluationId))
      .execute(session);
    const reusable = prior.find(
      (run) =>
        run.status === "COMPLETED" &&
        run.engineCode === engine.code &&
        run.engineVersion === engine.version &&
        run.inputFingerprint === inputFingerprint
    );
    if (reusable) return detailInSession(session, reusable);

    const createdAt = new Date().toISOString();
    const run = new CalculationRun();
    run.id = randomUUID();
    run.evaluationId = evaluationId;
    run.parameterizationId = parameterization.id;
    run.planRulesVersionId = planRules?.id ?? null;
    run.planRulesFingerprint = planRules?.fingerprint ?? null;
    run.engineCode = engine.code;
    run.engineVersion = engine.version;
    run.status = "PROCESSING";
    run.parameterFingerprint = parameterFingerprint;
    run.dataFingerprint = dataFingerprint;
    run.inputFingerprint = inputFingerprint;
    run.resultFingerprint = null;
    run.inputImportCount = selectedImports.length;
    run.inputRowCount = selectedImports.reduce((total, job) => total + job.rowCount, 0);
    run.validRowCount = selectedImports.reduce((total, job) => total + job.validRows, 0);
    run.invalidRowCount = selectedImports.reduce((total, job) => total + job.invalidRows, 0);
    run.participantResultCount = null;
    run.createdAt = createdAt;
    run.completedAt = null;
    run.errorMessage = null;
    session.trackNew(tableOf(CalculationRun), run, run.id);

    for (const snapshot of inputSnapshots) {
      const stored = new CalculationInput();
      stored.id = randomUUID();
      stored.calculationRunId = run.id;
      stored.importJobId = snapshot.job.id;
      stored.population = snapshot.job.population;
      stored.fileSha256 = snapshot.file.sha256;
      stored.schemaFingerprint = snapshot.job.schemaFingerprint;
      stored.canonicalFingerprint = snapshot.canonicalFingerprint;
      stored.rowCount = snapshot.job.rowCount;
      stored.validRows = snapshot.job.validRows;
      stored.invalidRows = snapshot.job.invalidRows;
      stored.importedAt = snapshot.job.completedAt ?? snapshot.job.createdAt;
      session.trackNew(tableOf(CalculationInput), stored, stored.id);
    }
    await session.commit();

    try {
      const output = validateCalculationOutput(await engine.execute({
        evaluation: {
          id: evaluation.id,
          planId: evaluation.planId ?? null,
          planName: evaluation.planName,
          referenceDate: evaluation.referenceDate
        },
        planRules,
        parameterization: {
          id: parameterization.id,
          version: parameterization.version,
          parameters,
          hypotheses
        },
        rows: canonicalRows,
        invalidRowCount: run.invalidRowCount,
        importCount: run.inputImportCount
      }));

      const allowedRows = new Set(canonicalRows.map((row) => `${row.importJobId}:${row.rowNumber}`));
      for (const participant of output.participantResults) {
        const key = `${participant.importJobId}:${participant.sourceRowNumber}`;
        if (!allowedRows.has(key)) {
          throw new Error(`O engine tentou persistir resultado individual para uma linha que não pertence aos inputs congelados: ${key}.`);
        }
      }

      for (const [ordinal, metric] of output.metrics.entries()) {
        const stored = new CalculationResultMetric();
        stored.id = randomUUID();
        stored.calculationRunId = run.id;
        stored.code = metric.code;
        stored.category = metric.category;
        stored.label = metric.label;
        stored.valueType = metric.valueType;
        stored.valueJson = JSON.stringify(metric.value);
        stored.unit = metric.unit ?? null;
        stored.ordinal = ordinal;
        session.trackNew(tableOf(CalculationResultMetric), stored, stored.id);
      }

      for (const [ordinal, participant] of output.participantResults.entries()) {
        const stored = new CalculationParticipantResult();
        stored.id = randomUUID();
        stored.calculationRunId = run.id;
        stored.importJobId = participant.importJobId;
        stored.population = participant.population;
        stored.sourceRowNumber = participant.sourceRowNumber;
        stored.participantRegistration = participant.participantRegistration;
        stored.campoUnicoLgpd = participant.campoUnicoLgpd;
        stored.resultJson = JSON.stringify(participant.result);
        stored.ordinal = ordinal;
        session.trackNew(tableOf(CalculationParticipantResult), stored, stored.id);
      }

      run.resultFingerprint = normalizedJsonFingerprint({
        metrics: output.metrics.map((metric) => ({
          code: metric.code,
          category: metric.category,
          label: metric.label,
          valueType: metric.valueType,
          value: metric.value,
          unit: metric.unit ?? null
        })),
        participantResults: output.participantResults
      });
      run.participantResultCount = output.participantResults.length;
      run.status = "COMPLETED";
      run.completedAt = new Date().toISOString();
      session.markDirty(run);
      await session.commit();
    } catch (error) {
      run.status = "FAILED";
      run.participantResultCount = 0;
      run.completedAt = new Date().toISOString();
      run.errorMessage = error instanceof Error ? error.message : "Falha não identificada no motor de cálculo.";
      session.markDirty(run);
      await session.commit();
    }

    return detailInSession(session, run);
  });
}

import { randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { Evaluation } from "../domain/entities.js";
import { AdherenceCandidateResult, AdherenceStudy } from "../domain/adherence-entities.js";
import {
  ActuarialHypothesisSelection,
  ActuarialParameterization,
  ActuarialParameterValue
} from "../domain/parameterization-entities.js";

const parameterizationRef = entityRef(ActuarialParameterization);
const valueRef = entityRef(ActuarialParameterValue);
const selectionRef = entityRef(ActuarialHypothesisSelection);
const statuses = new Set(["DRAFT", "APPROVED", "SUPERSEDED"]);
const valueTypes = new Set(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"]);

type Session = ReturnType<typeof createSession>;

type ParameterInput = {
  code: string;
  category: string;
  label: string;
  valueType: string;
  valueJson: string;
  unit?: string | null;
  source?: string | null;
};

async function withSession<T>(handler: (session: Session) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableOf(
  entity:
    | typeof ActuarialParameterization
    | typeof ActuarialParameterValue
    | typeof ActuarialHypothesisSelection
) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "_");
}

function validateValue(input: ParameterInput) {
  const code = normalizeCode(input.code);
  const category = input.category.trim();
  const label = input.label.trim();
  const valueType = input.valueType.trim().toUpperCase();
  if (!code) throw new Error("Código do parâmetro é obrigatório.");
  if (!category) throw new Error(`Categoria do parâmetro ${code} é obrigatória.`);
  if (!label) throw new Error(`Rótulo do parâmetro ${code} é obrigatório.`);
  if (!valueTypes.has(valueType)) throw new Error(`Tipo inválido para ${code}.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.valueJson);
  } catch {
    throw new Error(`valueJson de ${code} não contém JSON válido.`);
  }

  if (valueType === "NUMBER" && (typeof parsed !== "number" || !Number.isFinite(parsed))) {
    throw new Error(`${code} deve possuir valor numérico finito.`);
  }
  if (valueType === "INTEGER" && (typeof parsed !== "number" || !Number.isInteger(parsed))) {
    throw new Error(`${code} deve possuir valor inteiro.`);
  }
  if (valueType === "TEXT" && typeof parsed !== "string") {
    throw new Error(`${code} deve possuir valor textual.`);
  }
  if (valueType === "BOOLEAN" && typeof parsed !== "boolean") {
    throw new Error(`${code} deve possuir valor booleano.`);
  }

  return {
    code,
    category,
    label,
    valueType,
    valueJson: JSON.stringify(parsed),
    unit: normalizeOptional(input.unit),
    source: normalizeOptional(input.source) ?? "MANUAL"
  };
}

async function requireDraft(session: Session, id: string) {
  const parameterization = await session.find(ActuarialParameterization, id);
  if (!parameterization) throw new Error("Parametrização não encontrada.");
  if (parameterization.status !== "DRAFT") {
    throw new Error("Somente uma parametrização em rascunho pode ser alterada.");
  }
  return parameterization;
}

async function valuesFor(session: Session, parameterizationId: string) {
  return selectFromEntity(ActuarialParameterValue)
    .where(eq(valueRef.parameterizationId, parameterizationId))
    .orderBy(valueRef.category, "ASC")
    .orderBy(valueRef.code, "ASC")
    .execute(session);
}

async function selectionsFor(session: Session, parameterizationId: string) {
  return selectFromEntity(ActuarialHypothesisSelection)
    .where(eq(selectionRef.parameterizationId, parameterizationId))
    .orderBy(selectionRef.hypothesisType, "ASC")
    .execute(session);
}

function summary(row: ActuarialParameterization) {
  return {
    id: row.id,
    evaluationId: row.evaluationId,
    version: row.version,
    name: row.name,
    status: row.status,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    approvedAt: row.approvedAt ?? null
  };
}

async function detailInSession(session: Session, row: ActuarialParameterization) {
  const [parameters, hypotheses] = await Promise.all([
    valuesFor(session, row.id),
    selectionsFor(session, row.id)
  ]);
  return {
    ...summary(row),
    parameters: parameters.map((value) => ({
      id: value.id,
      code: value.code,
      category: value.category,
      label: value.label,
      valueType: value.valueType,
      valueJson: value.valueJson,
      unit: value.unit ?? null,
      source: value.source,
      updatedAt: value.updatedAt
    })),
    hypotheses: hypotheses.map((selection) => ({
      id: selection.id,
      hypothesisType: selection.hypothesisType,
      adherenceStudyId: selection.adherenceStudyId,
      candidateResultId: selection.candidateResultId,
      biometricVersionId: selection.biometricVersionId,
      tableCode: selection.tableCode,
      tableName: selection.tableName,
      versionLabel: selection.versionLabel,
      candidateRank: selection.candidateRank,
      selectedAt: selection.selectedAt
    }))
  };
}

export async function listParameterizations(evaluationId: number) {
  return withSession(async (session) => {
    const rows = await selectFromEntity(ActuarialParameterization)
      .where(eq(parameterizationRef.evaluationId, evaluationId))
      .orderBy(parameterizationRef.version, "DESC")
      .execute(session);
    return rows.map(summary);
  });
}

export async function getParameterization(id: string) {
  return withSession(async (session) => {
    const row = await session.find(ActuarialParameterization, id);
    return row ? detailInSession(session, row) : null;
  });
}

export async function createParameterization(
  evaluationId: number,
  input: { name?: string; notes?: string | null; copyFromId?: string }
) {
  return withSession(async (session) => {
    const evaluation = await session.find(Evaluation, evaluationId);
    if (!evaluation) throw new Error("Avaliação não encontrada.");

    const existing = await selectFromEntity(ActuarialParameterization)
      .where(eq(parameterizationRef.evaluationId, evaluationId))
      .orderBy(parameterizationRef.version, "DESC")
      .execute(session);
    const version = (existing[0]?.version ?? 0) + 1;

    let copyFrom: ActuarialParameterization | null = null;
    if (input.copyFromId) {
      copyFrom = await session.find(ActuarialParameterization, input.copyFromId);
      if (!copyFrom || copyFrom.evaluationId !== evaluationId) {
        throw new Error("A parametrização de origem não pertence a esta avaliação.");
      }
    }

    const now = new Date().toISOString();
    const row = new ActuarialParameterization();
    row.id = randomUUID();
    row.evaluationId = evaluationId;
    row.version = version;
    row.name = input.name?.trim() || `Parametrização v${version}`;
    row.status = "DRAFT";
    row.notes = normalizeOptional(input.notes);
    row.createdAt = now;
    row.updatedAt = now;
    row.approvedAt = null;
    session.trackNew(tableOf(ActuarialParameterization), row, row.id);

    if (copyFrom) {
      const [sourceValues, sourceSelections] = await Promise.all([
        valuesFor(session, copyFrom.id),
        selectionsFor(session, copyFrom.id)
      ]);
      for (const source of sourceValues) {
        const value = new ActuarialParameterValue();
        value.id = randomUUID();
        value.parameterizationId = row.id;
        value.code = source.code;
        value.category = source.category;
        value.label = source.label;
        value.valueType = source.valueType;
        value.valueJson = source.valueJson;
        value.unit = source.unit ?? null;
        value.source = source.source;
        value.updatedAt = now;
        session.trackNew(tableOf(ActuarialParameterValue), value, value.id);
      }
      for (const source of sourceSelections) {
        const selection = new ActuarialHypothesisSelection();
        selection.id = randomUUID();
        selection.parameterizationId = row.id;
        selection.hypothesisType = source.hypothesisType;
        selection.adherenceStudyId = source.adherenceStudyId;
        selection.candidateResultId = source.candidateResultId;
        selection.biometricVersionId = source.biometricVersionId;
        selection.tableCode = source.tableCode;
        selection.tableName = source.tableName;
        selection.versionLabel = source.versionLabel;
        selection.candidateRank = source.candidateRank;
        selection.selectedAt = now;
        session.trackNew(tableOf(ActuarialHypothesisSelection), selection, selection.id);
      }
    }

    await session.commit();
    return detailInSession(session, row);
  });
}

export async function updateParameterizationMetadata(
  id: string,
  input: { name?: string; notes?: string | null }
) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error("Nome da parametrização é obrigatório.");
      row.name = name;
    }
    if (input.notes !== undefined) row.notes = normalizeOptional(input.notes);
    row.updatedAt = new Date().toISOString();
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function setParameterValues(id: string, inputs: ParameterInput[]) {
  if (!inputs.length) throw new Error("Informe ao menos um parâmetro.");
  const normalized = inputs.map(validateValue);
  if (new Set(normalized.map((item) => item.code)).size !== normalized.length) {
    throw new Error("Existem códigos de parâmetros duplicados.");
  }

  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const existing = await valuesFor(session, id);
    const byCode = new Map(existing.map((item) => [item.code, item]));
    const now = new Date().toISOString();

    for (const input of normalized) {
      const stored = byCode.get(input.code);
      if (stored) {
        stored.category = input.category;
        stored.label = input.label;
        stored.valueType = input.valueType;
        stored.valueJson = input.valueJson;
        stored.unit = input.unit;
        stored.source = input.source;
        stored.updatedAt = now;
        session.markDirty(stored);
      } else {
        const value = new ActuarialParameterValue();
        value.id = randomUUID();
        value.parameterizationId = id;
        value.code = input.code;
        value.category = input.category;
        value.label = input.label;
        value.valueType = input.valueType;
        value.valueJson = input.valueJson;
        value.unit = input.unit;
        value.source = input.source;
        value.updatedAt = now;
        session.trackNew(tableOf(ActuarialParameterValue), value, value.id);
      }
    }

    row.updatedAt = now;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function promoteAdherenceCandidate(id: string, candidateResultId: string) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const candidate = await session.find(AdherenceCandidateResult, candidateResultId);
    if (!candidate) throw new Error("Resultado candidato de aderência não encontrado.");
    const study = await session.find(AdherenceStudy, candidate.studyId);
    if (!study) throw new Error("Estudo de aderência não encontrado.");
    if (study.evaluationId !== null && study.evaluationId !== undefined && study.evaluationId !== row.evaluationId) {
      throw new Error("O estudo de aderência pertence a outra avaliação.");
    }

    const current = (await selectionsFor(session, id)).find(
      (selection) => selection.hypothesisType === study.hypothesisType
    );
    const now = new Date().toISOString();
    const selection = current ?? new ActuarialHypothesisSelection();
    if (!current) {
      selection.id = randomUUID();
      selection.parameterizationId = id;
    }
    selection.hypothesisType = study.hypothesisType;
    selection.adherenceStudyId = study.id;
    selection.candidateResultId = candidate.id;
    selection.biometricVersionId = candidate.biometricVersionId;
    selection.tableCode = candidate.tableCode;
    selection.tableName = candidate.tableName;
    selection.versionLabel = candidate.versionLabel;
    selection.candidateRank = candidate.rank;
    selection.selectedAt = now;

    if (current) session.markDirty(selection);
    else session.trackNew(tableOf(ActuarialHypothesisSelection), selection, selection.id);
    row.updatedAt = now;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function approveParameterization(id: string) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const [parameters, hypotheses] = await Promise.all([
      valuesFor(session, id),
      selectionsFor(session, id)
    ]);
    if (!parameters.length && !hypotheses.length) {
      throw new Error("Não é possível aprovar uma parametrização vazia.");
    }

    const now = new Date().toISOString();
    const siblings = await selectFromEntity(ActuarialParameterization)
      .where(eq(parameterizationRef.evaluationId, row.evaluationId))
      .execute(session);
    for (const sibling of siblings) {
      if (sibling.id === row.id || sibling.status !== "APPROVED") continue;
      sibling.status = "SUPERSEDED";
      sibling.updatedAt = now;
      session.markDirty(sibling);
    }

    row.status = "APPROVED";
    row.approvedAt = now;
    row.updatedAt = now;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export function isParameterizationStatus(value: string) {
  return statuses.has(value);
}

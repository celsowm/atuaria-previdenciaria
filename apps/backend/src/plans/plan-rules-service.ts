import { createHash, randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { Plan } from "../domain/plan-entities.js";
import { PlanRuleValue, PlanRulesVersion } from "../domain/plan-rule-entities.js";

const versionRef = entityRef(PlanRulesVersion);
const valueRef = entityRef(PlanRuleValue);
const valueTypes = new Set(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"]);

type Session = ReturnType<typeof createSession>;
type PlanRulesEntity = typeof PlanRulesVersion | typeof PlanRuleValue;

type RuleInput = {
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

function tableOf(entity: PlanRulesEntity) {
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

function compareCanonicalCode(a: { code: string }, b: { code: string }) {
  if (a.code === b.code) return 0;
  return a.code < b.code ? -1 : 1;
}

function normalizeDate(value: string | null | undefined) {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`Data inválida: ${normalized}.`);
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Data inválida: ${normalized}.`);
  }
  return normalized;
}

function validatePeriod(effectiveFrom: string | null, effectiveTo: string | null) {
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error("A data final de vigência não pode ser anterior à data inicial.");
  }
}

function validateRule(input: RuleInput) {
  const code = normalizeCode(input.code);
  const category = input.category.trim();
  const label = input.label.trim();
  const valueType = input.valueType.trim().toUpperCase();
  if (!code) throw new Error("Código da regra é obrigatório.");
  if (!category) throw new Error(`Categoria da regra ${code} é obrigatória.`);
  if (!label) throw new Error(`Rótulo da regra ${code} é obrigatório.`);
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
    source: normalizeOptional(input.source) ?? "PLAN_REGULATION"
  };
}

async function allValuesFor(session: Session, planRulesVersionId: string) {
  return selectFromEntity(PlanRuleValue)
    .where(eq(valueRef.planRulesVersionId, planRulesVersionId))
    .execute(session);
}

async function valuesFor(session: Session, planRulesVersionId: string) {
  const rows = await allValuesFor(session, planRulesVersionId);
  return rows
    .filter((row) => row.active !== 0)
    .sort(compareCanonicalCode);
}

async function requireDraft(session: Session, id: string) {
  const version = await session.find(PlanRulesVersion, id);
  if (!version) throw new Error("Versão de regras do plano não encontrada.");
  if (version.status !== "DRAFT") {
    throw new Error("Somente uma versão de regras em rascunho pode ser alterada.");
  }
  return version;
}

function summary(row: PlanRulesVersion) {
  return {
    id: row.id,
    planId: row.planId,
    version: row.version,
    name: row.name,
    modality: row.modality,
    status: row.status,
    effectiveFrom: row.effectiveFrom ?? null,
    effectiveTo: row.effectiveTo ?? null,
    rulesFingerprint: row.rulesFingerprint ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    approvedAt: row.approvedAt ?? null
  };
}

async function detailInSession(session: Session, row: PlanRulesVersion) {
  const rules = await valuesFor(session, row.id);
  return {
    ...summary(row),
    rules: rules.map((value) => ({
      id: value.id,
      code: value.code,
      category: value.category,
      label: value.label,
      valueType: value.valueType,
      valueJson: value.valueJson,
      unit: value.unit ?? null,
      source: value.source,
      updatedAt: value.updatedAt
    }))
  };
}

export async function listPlanRulesVersions(planId: string) {
  return withSession(async (session) => {
    const plan = await session.find(Plan, planId);
    if (!plan) throw new Error("Plano não encontrado.");
    const rows = await selectFromEntity(PlanRulesVersion)
      .where(eq(versionRef.planId, planId))
      .orderBy(versionRef.version, "DESC")
      .execute(session);
    return rows.map(summary);
  });
}

export async function getPlanRulesVersion(id: string) {
  return withSession(async (session) => {
    const row = await session.find(PlanRulesVersion, id);
    return row ? detailInSession(session, row) : null;
  });
}

export async function createPlanRulesVersion(
  planId: string,
  input: {
    name?: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    notes?: string | null;
    copyFromId?: string;
  }
) {
  return withSession(async (session) => {
    const plan = await session.find(Plan, planId);
    if (!plan) throw new Error("Plano não encontrado.");

    const existing = await selectFromEntity(PlanRulesVersion)
      .where(eq(versionRef.planId, planId))
      .orderBy(versionRef.version, "DESC")
      .execute(session);
    if (existing.some((version) => version.status === "DRAFT")) {
      throw new Error("O plano já possui uma versão de regras em rascunho.");
    }

    let copyFrom: PlanRulesVersion | null = null;
    if (input.copyFromId) {
      copyFrom = await session.find(PlanRulesVersion, input.copyFromId);
      if (!copyFrom || copyFrom.planId !== planId) {
        throw new Error("A versão de origem não pertence a este plano.");
      }
      if (copyFrom.modality !== plan.modality) {
        throw new Error("Não é permitido copiar regras de uma modalidade diferente da modalidade atual do plano.");
      }
    }

    const versionNumber = (existing[0]?.version ?? 0) + 1;
    const effectiveFrom = input.effectiveFrom !== undefined ? normalizeDate(input.effectiveFrom) : null;
    const effectiveTo = input.effectiveTo !== undefined ? normalizeDate(input.effectiveTo) : null;
    validatePeriod(effectiveFrom, effectiveTo);

    const now = new Date().toISOString();
    const row = new PlanRulesVersion();
    row.id = randomUUID();
    row.planId = planId;
    row.version = versionNumber;
    row.name = input.name?.trim() || `Regras do plano v${versionNumber}`;
    row.modality = plan.modality;
    row.status = "DRAFT";
    row.effectiveFrom = effectiveFrom;
    row.effectiveTo = effectiveTo;
    row.rulesFingerprint = null;
    row.notes = input.notes !== undefined ? normalizeOptional(input.notes) : copyFrom?.notes ?? null;
    row.createdAt = now;
    row.updatedAt = now;
    row.approvedAt = null;
    session.trackNew(tableOf(PlanRulesVersion), row, row.id);

    if (copyFrom) {
      const sourceValues = await valuesFor(session, copyFrom.id);
      for (const source of sourceValues) {
        const value = new PlanRuleValue();
        value.id = randomUUID();
        value.planRulesVersionId = row.id;
        value.code = source.code;
        value.category = source.category;
        value.label = source.label;
        value.valueType = source.valueType;
        value.valueJson = source.valueJson;
        value.unit = source.unit ?? null;
        value.source = source.source;
        value.active = 1;
        value.updatedAt = now;
        session.trackNew(tableOf(PlanRuleValue), value, value.id);
      }
    }

    await session.commit();
    return detailInSession(session, row);
  });
}

export async function updatePlanRulesMetadata(
  id: string,
  input: {
    name?: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    notes?: string | null;
  }
) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error("Nome da versão de regras é obrigatório.");
      row.name = name;
    }
    if (input.effectiveFrom !== undefined) row.effectiveFrom = normalizeDate(input.effectiveFrom);
    if (input.effectiveTo !== undefined) row.effectiveTo = normalizeDate(input.effectiveTo);
    validatePeriod(row.effectiveFrom ?? null, row.effectiveTo ?? null);
    if (input.notes !== undefined) row.notes = normalizeOptional(input.notes);
    row.updatedAt = new Date().toISOString();
    row.rulesFingerprint = null;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function setPlanRuleValues(id: string, inputs: RuleInput[]) {
  const normalized = inputs.map(validateRule);
  if (new Set(normalized.map((item) => item.code)).size !== normalized.length) {
    throw new Error("Existem códigos de regras duplicados.");
  }

  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const existing = await allValuesFor(session, id);
    const byCode = new Map(existing.map((item) => [item.code, item]));
    const activeCodes = new Set(normalized.map((item) => item.code));
    const now = new Date().toISOString();

    for (const stored of existing) {
      if (stored.active !== 0 && !activeCodes.has(stored.code)) {
        stored.active = 0;
        stored.updatedAt = now;
        session.markDirty(stored);
      }
    }

    for (const input of normalized) {
      const stored = byCode.get(input.code);
      if (stored) {
        stored.category = input.category;
        stored.label = input.label;
        stored.valueType = input.valueType;
        stored.valueJson = input.valueJson;
        stored.unit = input.unit;
        stored.source = input.source;
        stored.active = 1;
        stored.updatedAt = now;
        session.markDirty(stored);
      } else {
        const value = new PlanRuleValue();
        value.id = randomUUID();
        value.planRulesVersionId = id;
        value.code = input.code;
        value.category = input.category;
        value.label = input.label;
        value.valueType = input.valueType;
        value.valueJson = input.valueJson;
        value.unit = input.unit;
        value.source = input.source;
        value.active = 1;
        value.updatedAt = now;
        session.trackNew(tableOf(PlanRuleValue), value, value.id);
      }
    }

    row.updatedAt = now;
    row.rulesFingerprint = null;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function approvePlanRulesVersion(id: string) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const rules = await valuesFor(session, id);
    if (!row.effectiveFrom) {
      throw new Error("Informe a data inicial de vigência antes de aprovar as regras do plano.");
    }
    validatePeriod(row.effectiveFrom, row.effectiveTo ?? null);
    if (!rules.length) throw new Error("Não é possível aprovar uma versão de regras vazia.");

    const fingerprintPayload = {
      planId: row.planId,
      version: row.version,
      modality: row.modality,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo ?? null,
      rules: rules.map((rule) => ({
        code: rule.code,
        category: rule.category,
        label: rule.label,
        valueType: rule.valueType,
        valueJson: rule.valueJson,
        unit: rule.unit ?? null,
        source: rule.source
      }))
    };
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(fingerprintPayload))
      .digest("hex");

    const now = new Date().toISOString();
    const siblings = await selectFromEntity(PlanRulesVersion)
      .where(eq(versionRef.planId, row.planId))
      .execute(session);
    for (const sibling of siblings) {
      if (sibling.id === row.id || sibling.status !== "APPROVED") continue;
      sibling.status = "SUPERSEDED";
      sibling.updatedAt = now;
      session.markDirty(sibling);
    }

    row.status = "APPROVED";
    row.rulesFingerprint = fingerprint;
    row.approvedAt = now;
    row.updatedAt = now;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

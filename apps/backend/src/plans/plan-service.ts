import { randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { Plan } from "../domain/plan-entities.js";
import { PlanRulesVersion } from "../domain/plan-rule-entities.js";

const planRef = entityRef(Plan);
const rulesVersionRef = entityRef(PlanRulesVersion);
const modalities = new Set(["BD", "CD", "CV"]);
const statuses = new Set(["ACTIVE", "INACTIVE", "CLOSED"]);

type Session = ReturnType<typeof createSession>;

async function withSession<T>(handler: (session: Session) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function table() {
  const result = getTableDefFromEntity(Plan);
  if (!result) throw new Error("Metal ORM metadata not bootstrapped for Plan");
  return result;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateModality(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!modalities.has(normalized)) throw new Error("Modalidade deve ser BD, CD ou CV.");
  return normalized;
}

function validateStatus(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!statuses.has(normalized)) throw new Error("Status deve ser ACTIVE, INACTIVE ou CLOSED.");
  return normalized;
}

export async function listPlans() {
  return withSession((session) =>
    selectFromEntity(Plan).orderBy(planRef.$.name, "ASC").execute(session)
  );
}

export async function getPlan(id: string) {
  return withSession((session) => session.find(Plan, id));
}

export async function createPlan(input: {
  code: string;
  name: string;
  modality: string;
  sponsorName?: string;
  cnpj?: string;
}) {
  const code = normalizeCode(input.code);
  const name = input.name.trim();
  if (!code) throw new Error("Código do plano é obrigatório.");
  if (!name) throw new Error("Nome do plano é obrigatório.");

  return withSession(async (session) => {
    const existing = await selectFromEntity(Plan).where(eq(planRef.code, code)).execute(session);
    if (existing.length > 0) throw new Error("Já existe um plano com este código.");

    const now = new Date().toISOString();
    const plan = new Plan();
    plan.id = randomUUID();
    plan.code = code;
    plan.name = name;
    plan.modality = validateModality(input.modality);
    plan.sponsorName = normalizeOptional(input.sponsorName);
    plan.cnpj = normalizeOptional(input.cnpj);
    plan.status = "ACTIVE";
    plan.createdAt = now;
    plan.updatedAt = now;

    session.trackNew(table(), plan, plan.id);
    await session.commit();
    return plan;
  });
}

export async function updatePlan(id: string, input: {
  code?: string;
  name?: string;
  modality?: string;
  sponsorName?: string | null;
  cnpj?: string | null;
  status?: string;
}) {
  return withSession(async (session) => {
    const plan = await session.find(Plan, id);
    if (!plan) return null;

    if (input.code !== undefined) {
      const code = normalizeCode(input.code);
      if (!code) throw new Error("Código do plano é obrigatório.");
      const duplicate = await selectFromEntity(Plan).where(eq(planRef.code, code)).execute(session);
      if (duplicate.some((candidate) => candidate.id !== id)) {
        throw new Error("Já existe um plano com este código.");
      }
      plan.code = code;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error("Nome do plano é obrigatório.");
      plan.name = name;
    }
    if (input.modality !== undefined) {
      const modality = validateModality(input.modality);
      if (modality !== plan.modality) {
        const versions = await selectFromEntity(PlanRulesVersion)
          .where(eq(rulesVersionRef.planId, id))
          .execute(session);
        if (versions.length > 0) {
          throw new Error("A modalidade não pode ser alterada depois que o plano possui versões de regras atuariais.");
        }
      }
      plan.modality = modality;
    }
    if (input.sponsorName !== undefined) plan.sponsorName = normalizeOptional(input.sponsorName);
    if (input.cnpj !== undefined) plan.cnpj = normalizeOptional(input.cnpj);
    if (input.status !== undefined) plan.status = validateStatus(input.status);
    plan.updatedAt = new Date().toISOString();

    session.markDirty(plan);
    await session.commit();
    return plan;
  });
}

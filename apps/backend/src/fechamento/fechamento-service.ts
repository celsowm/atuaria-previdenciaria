import { randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { CalculationResultMetric, CalculationRun } from "../domain/calculation-entities.js";
import { ActuarialClosing, ActuarialClosingLine } from "../domain/closing-entities.js";
import { Evaluation } from "../domain/entities.js";

type Session = ReturnType<typeof createSession>;
const closingRef = entityRef(ActuarialClosing);
const lineRef = entityRef(ActuarialClosingLine);
const metricRef = entityRef(CalculationResultMetric);
const tableOf = (entity: typeof ActuarialClosing | typeof ActuarialClosingLine) => { const table = getTableDefFromEntity(entity); if (!table) throw new Error(`Missing table metadata for ${entity.name}`); return table; };
async function withSession<T>(handler: (session: Session) => Promise<T>) { const session = createSession(); try { return await handler(session); } finally { await session.dispose(); } }

async function detail(session: Session, row: ActuarialClosing) {
  const lines = await selectFromEntity(ActuarialClosingLine).where(eq(lineRef.closingId, row.id)).orderBy(lineRef.ordinal, "ASC").execute(session);
  return { id: row.id, evaluationId: row.evaluationId, calculationRunId: row.calculationRunId, status: row.status, notes: row.notes ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt, finalizedAt: row.finalizedAt ?? null, lines: lines.map((line) => ({ id: line.id, code: line.code, category: line.category, label: line.label, valueJson: line.valueJson, unit: line.unit ?? null, source: line.source, ordinal: line.ordinal })) };
}

export async function listClosings(evaluationId: number) { return withSession(async (session) => { const rows = await selectFromEntity(ActuarialClosing).where(eq(closingRef.evaluationId, evaluationId)).orderBy(closingRef.updatedAt, "DESC").execute(session); return Promise.all(rows.map((row) => detail(session, row))); }); }
export async function getClosing(id: string) { return withSession(async (session) => { const row = await session.find(ActuarialClosing, id); return row ? detail(session, row) : null; }); }

export async function createClosing(evaluationId: number, input: { calculationRunId: string; notes?: string | null }) { return withSession(async (session) => {
  const [evaluation, run] = await Promise.all([session.find(Evaluation, evaluationId), session.find(CalculationRun, input.calculationRunId)]);
  if (!evaluation) throw new Error("Avaliação não encontrada.");
  if (!run || run.evaluationId !== evaluationId || run.status !== "COMPLETED") throw new Error("O fechamento exige um cálculo COMPLETED da própria avaliação.");
  const now = new Date().toISOString(); const row = new ActuarialClosing(); row.id = randomUUID(); row.evaluationId = evaluationId; row.calculationRunId = run.id; row.status = "DRAFT"; row.notes = input.notes?.trim() || null; row.createdAt = now; row.updatedAt = now; row.finalizedAt = null; session.trackNew(tableOf(ActuarialClosing), row, row.id);
  const metrics = await selectFromEntity(CalculationResultMetric).where(eq(metricRef.calculationRunId, run.id)).orderBy(metricRef.ordinal, "ASC").execute(session);
  for (const [ordinal, metric] of metrics.entries()) { const line = new ActuarialClosingLine(); line.id = randomUUID(); line.closingId = row.id; line.code = metric.code; line.category = metric.category; line.label = metric.label; line.valueJson = metric.valueJson; line.unit = metric.unit ?? null; line.source = `CalculationRun ${run.engineVersion}`; line.ordinal = ordinal; session.trackNew(tableOf(ActuarialClosingLine), line, line.id); }
  await session.commit(); return detail(session, row);
}); }

export async function updateClosing(id: string, input: { notes?: string | null }) { return withSession(async (session) => { const row = await session.find(ActuarialClosing, id); if (!row) throw new Error("Fechamento não encontrado."); if (row.status !== "DRAFT") throw new Error("O fechamento finalizado é imutável."); if (input.notes !== undefined) row.notes = input.notes?.trim() || null; row.updatedAt = new Date().toISOString(); session.markDirty(row); await session.commit(); return detail(session, row); }); }
export async function finalizeClosing(id: string) { return withSession(async (session) => { const row = await session.find(ActuarialClosing, id); if (!row) throw new Error("Fechamento não encontrado."); if (row.status !== "DRAFT") throw new Error("O fechamento já foi finalizado."); const [run, lines] = await Promise.all([session.find(CalculationRun, row.calculationRunId), selectFromEntity(ActuarialClosingLine).where(eq(lineRef.closingId, id)).execute(session)]); if (!run || run.status !== "COMPLETED") throw new Error("O cálculo selecionado não está concluído."); if (!lines.length) throw new Error("O fechamento não possui linhas de reconciliação."); const now = new Date().toISOString(); row.status = "FINALIZED"; row.finalizedAt = now; row.updatedAt = now; session.markDirty(row); await session.commit(); return detail(session, row); }); }

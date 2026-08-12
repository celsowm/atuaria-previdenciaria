import { randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { MetricaResultadoCalculo, ExecucaoCalculo } from "../domain/calculo-entities.js";
import { FechamentoAtuarial, LinhaFechamentoAtuarial } from "../domain/fechamento-entities.js";
import { Avaliacao } from "../domain/entities.js";

type Session = ReturnType<typeof createSession>;
const closingRef = entityRef(FechamentoAtuarial);
const lineRef = entityRef(LinhaFechamentoAtuarial);
const metricRef = entityRef(MetricaResultadoCalculo);
const tableOf = (entity: typeof FechamentoAtuarial | typeof LinhaFechamentoAtuarial) => { const table = getTableDefFromEntity(entity); if (!table) throw new Error(`Missing table metadata for ${entity.name}`); return table; };
async function withSession<T>(handler: (session: Session) => Promise<T>) { const session = createSession(); try { return await handler(session); } finally { await session.dispose(); } }

async function detail(session: Session, row: FechamentoAtuarial) {
  const lines = await selectFromEntity(LinhaFechamentoAtuarial).where(eq(lineRef.fechamentoId, row.id)).orderBy(lineRef.ordinal, "ASC").execute(session);
  return { id: row.id, avaliacaoId: row.avaliacaoId, execucaoCalculoId: row.execucaoCalculoId, situacao: row.situacao, observacoes: row.observacoes ?? null, criadoEm: row.criadoEm, atualizadoEm: row.atualizadoEm, finalizadoEm: row.finalizadoEm ?? null, lines: lines.map((line) => ({ id: line.id, codigo: line.codigo, categoria: line.categoria, rotulo: line.rotulo, jsonValor: line.jsonValor, unidade: line.unidade ?? null, origem: line.origem, ordinal: line.ordinal })) };
}

export async function listFechamentos(avaliacaoId: number) { return withSession(async (session) => { const rows = await selectFromEntity(FechamentoAtuarial).where(eq(closingRef.avaliacaoId, avaliacaoId)).orderBy(closingRef.atualizadoEm, "DESC").execute(session); return Promise.all(rows.map((row) => detail(session, row))); }); }
export async function getFechamento(id: string) { return withSession(async (session) => { const row = await session.find(FechamentoAtuarial, id); return row ? detail(session, row) : null; }); }

export async function createFechamento(avaliacaoId: number, input: { execucaoCalculoId: string; observacoes?: string | null }) { return withSession(async (session) => {
  const [evaluation, run] = await Promise.all([session.find(Avaliacao, avaliacaoId), session.find(ExecucaoCalculo, input.execucaoCalculoId)]);
  if (!evaluation) throw new Error("Avaliação não encontrada.");
  if (!run || run.avaliacaoId !== avaliacaoId || run.situacao !== "CONCLUIDO") throw new Error("O fechamento exige um cálculo CONCLUIDO da própria avaliação.");
  const now = new Date().toISOString(); const row = new FechamentoAtuarial(); row.id = randomUUID(); row.avaliacaoId = avaliacaoId; row.execucaoCalculoId = run.id; row.situacao = "RASCUNHO"; row.observacoes = input.observacoes?.trim() || null; row.criadoEm = now; row.atualizadoEm = now; row.finalizadoEm = null; session.trackNew(tableOf(FechamentoAtuarial), row, row.id);
  const metrics = await selectFromEntity(MetricaResultadoCalculo).where(eq(metricRef.execucaoCalculoId, run.id)).orderBy(metricRef.ordinal, "ASC").execute(session);
  for (const [ordinal, metric] of metrics.entries()) { const line = new LinhaFechamentoAtuarial(); line.id = randomUUID(); line.fechamentoId = row.id; line.codigo = metric.codigo; line.categoria = metric.categoria; line.rotulo = metric.rotulo; line.jsonValor = metric.jsonValor; line.unidade = metric.unidade ?? null; line.origem = `ExecucaoCalculo ${run.versaoMotor}`; line.ordinal = ordinal; session.trackNew(tableOf(LinhaFechamentoAtuarial), line, line.id); }
  await session.commit(); return detail(session, row);
}); }

export async function updateFechamento(id: string, input: { observacoes?: string | null }) { return withSession(async (session) => { const row = await session.find(FechamentoAtuarial, id); if (!row) throw new Error("Fechamento não encontrado."); if (row.situacao !== "RASCUNHO") throw new Error("O fechamento finalizado é imutável."); if (input.observacoes !== undefined) row.observacoes = input.observacoes?.trim() || null; row.atualizadoEm = new Date().toISOString(); session.markDirty(row); await session.commit(); return detail(session, row); }); }
export async function finalizeFechamento(id: string) { return withSession(async (session) => { const row = await session.find(FechamentoAtuarial, id); if (!row) throw new Error("Fechamento não encontrado."); if (row.situacao !== "RASCUNHO") throw new Error("O fechamento já foi finalizado."); const [run, lines] = await Promise.all([session.find(ExecucaoCalculo, row.execucaoCalculoId), selectFromEntity(LinhaFechamentoAtuarial).where(eq(lineRef.fechamentoId, id)).execute(session)]); if (!run || run.situacao !== "CONCLUIDO") throw new Error("O cálculo selecionado não está concluído."); if (!lines.length) throw new Error("O fechamento não possui linhas de reconciliação."); const now = new Date().toISOString(); row.situacao = "FINALIZADO"; row.finalizadoEm = now; row.atualizadoEm = now; session.markDirty(row); await session.commit(); return detail(session, row); }); }

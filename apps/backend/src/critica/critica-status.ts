import { selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { InconsistenciaCritica, ExecucaoCritica } from "../domain/critica-entities.js";
import { Avaliacao, ImportacaoJob } from "../domain/entities.js";

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

export async function refreshAvaliacaoAfterIssue(issueId: string) {
  const context = await withSession(async (session) => {
    const issue = await session.find(InconsistenciaCritica, issueId);
    if (!issue) return null;
    const run = await session.find(ExecucaoCritica, issue.execucaoCriticaId);
    if (!run) return null;
    const job = await session.find(ImportacaoJob, run.importacaoId);
    if (!job?.avaliacaoId) return null;
    return { runId: run.id, avaliacaoId: job.avaliacaoId };
  });
  if (!context) return;

  const unresolvedBlocking = await withSession(async (session) => {
    const issues = await selectFromEntity(InconsistenciaCritica).execute(session);
    return issues.filter(
      (issue) =>
        issue.execucaoCriticaId === context.runId &&
        issue.severidade === "BLOCKING" &&
        issue.situacao === "ABERTO"
    ).length;
  });

  await withSession(async (session) => {
    const evaluation = await session.find(Avaliacao, context.avaliacaoId);
    if (!evaluation) return;
    evaluation.inconsistenciasBloqueantes = unresolvedBlocking;
    evaluation.etapa = "Crítica cadastral";
    evaluation.situacao = unresolvedBlocking > 0 ? "Aguardando correção" : "Em andamento";
    if (unresolvedBlocking === 0) evaluation.progresso = Math.max(evaluation.progresso, 30);
    evaluation.atualizadoEm = new Date().toISOString();
    await session.commit();
  });
}

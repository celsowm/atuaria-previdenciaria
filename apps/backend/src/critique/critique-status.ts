import { selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { CritiqueIssue, CritiqueRun } from "../domain/critique-entities.js";
import { Evaluation, ImportJob } from "../domain/entities.js";

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

export async function refreshEvaluationAfterIssue(issueId: string) {
  const context = await withSession(async (session) => {
    const issue = await session.find(CritiqueIssue, issueId);
    if (!issue) return null;
    const run = await session.find(CritiqueRun, issue.critiqueRunId);
    if (!run) return null;
    const job = await session.find(ImportJob, run.importJobId);
    if (!job?.evaluationId) return null;
    return { runId: run.id, evaluationId: job.evaluationId };
  });
  if (!context) return;

  const unresolvedBlocking = await withSession(async (session) => {
    const issues = await selectFromEntity(CritiqueIssue).execute(session);
    return issues.filter(
      (issue) =>
        issue.critiqueRunId === context.runId &&
        issue.severity === "BLOCKING" &&
        issue.status === "OPEN"
    ).length;
  });

  await withSession(async (session) => {
    const evaluation = await session.find(Evaluation, context.evaluationId);
    if (!evaluation) return;
    evaluation.blockingIssues = unresolvedBlocking;
    evaluation.stage = "Crítica cadastral";
    evaluation.status = unresolvedBlocking > 0 ? "Aguardando correção" : "Em andamento";
    if (unresolvedBlocking === 0) evaluation.progress = Math.max(evaluation.progress, 30);
    evaluation.updatedAt = new Date().toISOString();
    await session.commit();
  });
}

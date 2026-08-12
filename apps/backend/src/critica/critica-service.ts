import { randomUUID } from "node:crypto";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { InconsistenciaCritica, RegraCritica, ExecucaoCritica } from "../domain/critica-entities.js";
import { Avaliacao, ImportacaoJob, LinhaImportacao } from "../domain/entities.js";

type Canonical = Record<string, unknown>;
type Severity = "BLOCKING" | "INCONSISTENCY" | "WARNING" | "INFO";

type RowSnapshot = {
  row: LinhaImportacao;
  canonical: Canonical;
};

type IssueInput = {
  codigo: string;
  row?: RowSnapshot;
  previousRow?: RowSnapshot;
  registration?: string | null;
  caminhoCampo?: string | null;
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

function tableOf(entity: typeof ExecucaoCritica | typeof InconsistenciaCritica) {
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
  const [ano, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(ano, month - 1, day));
  return date.getUTCFullYear() === ano && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function ageAt(birthValue: unknown, dataReferencia: string) {
  const birth = isoDate(birthValue);
  const reference = isoDate(dataReferencia);
  if (!birth || !reference) return null;
  let idade = reference.getUTCFullYear() - birth.getUTCFullYear();
  const month = reference.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && reference.getUTCDate() < birth.getUTCDate())) idade -= 1;
  return idade;
}

function jsonValue(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

async function findPreviousImportacao(current: ImportacaoJob) {
  if (!current.avaliacaoId) return null;
  return withSession(async (session) => {
    const [avaliacoes, imports] = await Promise.all([
      selectFromEntity(Avaliacao).execute(session),
      selectFromEntity(ImportacaoJob).execute(session)
    ]);
    const currentAvaliacao = avaliacoes.find((item) => item.id === current.avaliacaoId);
    if (!currentAvaliacao) return null;
    const evaluationById = new Map(avaliacoes.map((item) => [item.id, item]));
    const candidates = imports
      .filter((item) => item.id !== current.id && item.situacao === "CONCLUIDO" && item.populacao === current.populacao && item.avaliacaoId)
      .map((item) => ({ item, evaluation: evaluationById.get(item.avaliacaoId!) }))
      .filter((candidate) => candidate.evaluation?.nomePlano === currentAvaliacao.nomePlano && candidate.evaluation.dataReferencia < currentAvaliacao.dataReferencia)
      .sort((a, b) => b.evaluation!.dataReferencia.localeCompare(a.evaluation!.dataReferencia));
    return candidates[0]?.item ?? null;
  });
}

async function loadRows(importacaoId: string) {
  const rows = await withSession((session) => selectFromEntity(LinhaImportacao).execute(session));
  return rows
    .filter((row) => row.importacaoId === importacaoId)
    .sort((a, b) => a.numeroLinha - b.numeroLinha)
    .map<RowSnapshot>((row) => ({ row, canonical: parseJsonObject(row.jsonCanonico) }));
}

async function loadRuleMap() {
  const rules = await withSession((session) => selectFromEntity(RegraCritica).execute(session));
  return new Map(rules.filter((rule) => rule.habilitado === 1).map((rule) => [rule.codigo, rule]));
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

export async function runCritica(importacaoId: string, requestedPreviousImportacaoJobId?: string) {
  const current = await withSession((session) => session.find(ImportacaoJob, importacaoId));
  if (!current) throw new Error(`Importacaoação ${importacaoId} não encontrada.`);
  if (current.situacao !== "CONCLUIDO") throw new Error("A crítica só pode ser executada sobre importações concluídas.");

  const previous = requestedPreviousImportacaoJobId
    ? await withSession((session) => session.find(ImportacaoJob, requestedPreviousImportacaoJobId))
    : await findPreviousImportacao(current);
  if (previous && previous.populacao !== current.populacao) {
    throw new Error("A massa anterior precisa pertencer à mesma população.");
  }

  const [rules, currentRows, previousRows] = await Promise.all([
    loadRuleMap(),
    loadRows(current.id),
    previous ? loadRows(previous.id) : Promise.resolve([])
  ]);

  let dataReferencia: string | null = null;
  if (current.avaliacaoId) {
    const evaluation = await withSession((session) => session.find(Avaliacao, current.avaliacaoId!));
    dataReferencia = evaluation?.dataReferencia ?? null;
  }

  const run = new ExecucaoCritica();
  run.id = randomUUID();
  run.importacaoId = current.id;
  run.importacaoAnteriorId = previous?.id ?? null;
  run.situacao = "PROCESSANDO";
  run.quantidadeBloqueios = 0;
  run.quantidadeInconsistencias = 0;
  run.quantidadeAvisos = 0;
  run.quantidadeInformacoes = 0;
  run.criadoEm = new Date().toISOString();
  run.concluidoEm = null;

  await withSession(async (session) => {
    session.trackNew(tableOf(ExecucaoCritica), run, run.id);
    await session.commit();
  });

  const pending: InconsistenciaCritica[] = [];
  const counts: Record<Severity, number> = { BLOCKING: 0, INCONSISTENCY: 0, WARNING: 0, INFO: 0 };

  const addIssue = (input: IssueInput) => {
    const rule = rules.get(input.codigo);
    if (!rule) return;
    const issue = new InconsistenciaCritica();
    issue.id = randomUUID();
    issue.execucaoCriticaId = run.id;
    issue.regraId = rule.id;
    issue.codigoRegra = rule.codigo;
    issue.linhaImportacaoId = input.row?.row.id ?? null;
    issue.linhaImportacaoAnteriorId = input.previousRow?.row.id ?? null;
    issue.matriculaParticipante = input.registration ?? (input.row ? registrationOf(input.row) : input.previousRow ? registrationOf(input.previousRow) : null);
    issue.severidade = rule.severidade;
    issue.categoria = rule.categoria;
    issue.situacao = "ABERTO";
    issue.caminhoCampo = input.caminhoCampo ?? null;
    issue.jsonValorAtual = jsonValue(input.currentValue);
    issue.jsonValorAnterior = jsonValue(input.previousValue);
    issue.mensagem = input.message;
    issue.jsonDetalhes = JSON.stringify(input.details ?? {});
    issue.criadoEm = new Date().toISOString();
    issue.notaResolucao = null;
    issue.resolvidoEm = null;
    pending.push(issue);
    counts[rule.severidade as Severity] += 1;
  };

  const currentGroups = groupByRegistration(currentRows);
  const previousGroups = groupByRegistration(previousRows);

  for (const snapshot of currentRows) {
    const canonical = snapshot.canonical;
    const registration = registrationOf(snapshot);

    if (snapshot.row.situacaoValidacao !== "VALID") {
      addIssue({
        codigo: "STRUCTURAL_IMPORT_INVALID",
        row: snapshot,
        registration,
        message: "A linha possui falhas estruturais vindas da importação.",
        details: { errors: JSON.parse(snapshot.row.jsonErrosValidacao || "[]") }
      });
    }

    if (!registration) {
      addIssue({ codigo: "MISSING_REGISTRATION", row: snapshot, caminhoCampo: "participant.registration", message: "Matrícula obrigatória não informada." });
    }

    const birthValue = canonical["participant.birthDate"];
    if (!isoDate(birthValue)) {
      addIssue({ codigo: "INVALID_BIRTH_DATE", row: snapshot, registration, caminhoCampo: "participant.birthDate", currentValue: birthValue, message: "Data de nascimento ausente ou inválida." });
    } else if (dataReferencia) {
      const rule = rules.get("AGE_OUTLIER");
      const config = rule ? parseJsonObject(rule.jsonConfiguracao) : {};
      const min = Number(config.min ?? 14);
      const max = Number(config.max ?? 100);
      const idade = ageAt(birthValue, dataReferencia);
      if (idade !== null && (idade < min || idade > max)) {
        addIssue({ codigo: "AGE_OUTLIER", row: snapshot, registration, caminhoCampo: "participant.birthDate", currentValue: idade, message: `Idade de ${idade} anos fora da faixa esperada de ${min} a ${max} anos.`, details: { dataReferencia, min, max } });
      }
    }

    const admission = isoDate(canonical["participant.admissionDate"]);
    const planJoin = isoDate(canonical["participant.planJoinDate"]);
    if (admission && planJoin && planJoin < admission) {
      addIssue({
        codigo: "PLAN_JOIN_BEFORE_ADMISSION",
        row: snapshot,
        registration,
        caminhoCampo: "participant.planJoinDate",
        currentValue: canonical["participant.planJoinDate"],
        previousValue: canonical["participant.admissionDate"],
        message: "Ingresso no plano anterior à admissão: o tempo de plano supera o tempo de empresa.",
        details: { admissionDate: canonical["participant.admissionDate"], planJoinDate: canonical["participant.planJoinDate"] }
      });
    }

    const salaryValue = canonical["participant.contributionSalary"];
    const salary = numberOf(salaryValue);
    if (present(salaryValue) && (salary === null || salary <= 0)) {
      addIssue({ codigo: "NON_POSITIVE_SALARY", row: snapshot, registration, caminhoCampo: "participant.contributionSalary", currentValue: salaryValue, message: "Salário de contribuição deve ser maior que zero." });
    }
  }

  for (const [registration, rows] of currentGroups) {
    if (rows.length <= 1) continue;
    for (const row of rows) {
      addIssue({ codigo: "DUPLICATE_REGISTRATION", row, registration, caminhoCampo: "participant.registration", currentValue: registration, message: `Matrícula ${registration} aparece ${rows.length} vezes na massa.`, details: { occurrences: rows.map((item) => item.row.numeroLinha) } });
    }
  }

  if (previous) {
    const salaryRule = rules.get("SALARY_VARIATION");
    const salaryConfig = salaryRule ? parseJsonObject(salaryRule.jsonConfiguracao) : {};
    const thresholdPercent = Number(salaryConfig.thresholdPercent ?? 50);

    for (const [registration, rows] of currentGroups) {
      const currentRow = rows[0];
      const previousRow = previousGroups.get(registration)?.[0];
      if (!previousRow) {
        addIssue({ codigo: "NEW_PARTICIPANT", row: currentRow, registration, message: `Matrícula ${registration} não existia na massa anterior.` });
        continue;
      }

      const currentSex = currentRow.canonical["participant.sexo"];
      const previousSex = previousRow.canonical["participant.sexo"];
      if (present(currentSex) && present(previousSex) && currentSex !== previousSex) {
        addIssue({ codigo: "SEX_CHANGED", row: currentRow, previousRow, registration, caminhoCampo: "participant.sexo", currentValue: currentSex, previousValue: previousSex, message: `Sexo alterado de ${String(previousSex)} para ${String(currentSex)}.` });
      }

      const currentBirth = currentRow.canonical["participant.birthDate"];
      const previousBirth = previousRow.canonical["participant.birthDate"];
      if (present(currentBirth) && present(previousBirth) && currentBirth !== previousBirth) {
        addIssue({ codigo: "BIRTH_DATE_CHANGED", row: currentRow, previousRow, registration, caminhoCampo: "participant.birthDate", currentValue: currentBirth, previousValue: previousBirth, message: `Data de nascimento diverge do exercício anterior (${String(previousBirth)} → ${String(currentBirth)}).` });
      }

      const currentSalary = numberOf(currentRow.canonical["participant.contributionSalary"]);
      const previousSalary = numberOf(previousRow.canonical["participant.contributionSalary"]);
      if (currentSalary !== null && previousSalary !== null && previousSalary !== 0) {
        const variationPercent = ((currentSalary - previousSalary) / Math.abs(previousSalary)) * 100;
        if (Math.abs(variationPercent) > thresholdPercent) {
          addIssue({
            codigo: "SALARY_VARIATION",
            row: currentRow,
            previousRow,
            registration,
            caminhoCampo: "participant.contributionSalary",
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
      addIssue({ codigo: "PARTICIPANT_EXIT", previousRow, registration, previousValue: registration, message: `Matrícula ${registration} saiu da massa atual.` });
    }
  }

  const batchSize = 250;
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize);
    await withSession(async (session) => {
      const table = tableOf(InconsistenciaCritica);
      for (const issue of batch) session.trackNew(table, issue, issue.id);
      await session.commit();
    });
  }

  await withSession(async (session) => {
    const storedRun = await session.find(ExecucaoCritica, run.id);
    if (!storedRun) throw new Error("Execução de crítica desapareceu durante o processamento.");
    storedRun.situacao = "CONCLUIDO";
    storedRun.quantidadeBloqueios = counts.BLOCKING;
    storedRun.quantidadeInconsistencias = counts.INCONSISTENCY;
    storedRun.quantidadeAvisos = counts.WARNING;
    storedRun.quantidadeInformacoes = counts.INFO;
    storedRun.concluidoEm = new Date().toISOString();

    if (current.avaliacaoId) {
      const evaluation = await session.find(Avaliacao, current.avaliacaoId);
      if (evaluation) {
        evaluation.inconsistenciasBloqueantes = counts.BLOCKING;
        evaluation.etapa = "Crítica cadastral";
        evaluation.situacao = counts.BLOCKING > 0 ? "Aguardando correção" : "Em andamento";
        evaluation.progresso = Math.max(evaluation.progresso, counts.BLOCKING > 0 ? 25 : 30);
        evaluation.atualizadoEm = new Date().toISOString();
      }
    }
    await session.commit();
  });

  return getExecucaoCritica(run.id);
}

export async function getExecucaoCritica(runId: string) {
  const run = await withSession((session) => session.find(ExecucaoCritica, runId));
  if (!run) return null;
  return {
    id: run.id,
    importacaoId: run.importacaoId,
    importacaoAnteriorId: run.importacaoAnteriorId ?? null,
    situacao: run.situacao,
    quantidadeBloqueios: run.quantidadeBloqueios,
    quantidadeInconsistencias: run.quantidadeInconsistencias,
    quantidadeAvisos: run.quantidadeAvisos,
    quantidadeInformacoes: run.quantidadeInformacoes,
    totalIssues: run.quantidadeBloqueios + run.quantidadeInconsistencias + run.quantidadeAvisos + run.quantidadeInformacoes,
    comparedWithPrevious: Boolean(run.importacaoAnteriorId),
    criadoEm: run.criadoEm,
    concluidoEm: run.concluidoEm ?? null
  };
}

export async function listInconsistenciaCriticas(runId: string) {
  const issues = await withSession((session) => selectFromEntity(InconsistenciaCritica).execute(session));
  return issues
    .filter((issue) => issue.execucaoCriticaId === runId)
    .sort((a, b) => {
      const order: Record<string, number> = { BLOCKING: 0, INCONSISTENCY: 1, WARNING: 2, INFO: 3 };
      return (order[a.severidade] ?? 9) - (order[b.severidade] ?? 9) || a.criadoEm.localeCompare(b.criadoEm);
    })
    .map((issue) => ({
      id: issue.id,
      codigoRegra: issue.codigoRegra,
      severidade: issue.severidade,
      categoria: issue.categoria,
      situacao: issue.situacao,
      matriculaParticipante: issue.matriculaParticipante ?? null,
      campoUnicoLgpd: issue.campoUnicoLgpd ?? null,
      caminhoCampo: issue.caminhoCampo ?? null,
      jsonValorAtual: issue.jsonValorAtual ?? null,
      jsonValorAnterior: issue.jsonValorAnterior ?? null,
      mensagem: issue.mensagem,
      criadoEm: issue.criadoEm
    }));
}

export async function getInconsistenciaCriticaDetail(issueId: string) {
  const issue = await withSession((session) => session.find(InconsistenciaCritica, issueId));
  if (!issue) return null;
  const [row, previousRow] = await Promise.all([
    issue.linhaImportacaoId ? withSession((session) => session.find(LinhaImportacao, issue.linhaImportacaoId!)) : Promise.resolve(null),
    issue.linhaImportacaoAnteriorId ? withSession((session) => session.find(LinhaImportacao, issue.linhaImportacaoAnteriorId!)) : Promise.resolve(null)
  ]);
  return {
    id: issue.id,
    codigoRegra: issue.codigoRegra,
    severidade: issue.severidade,
    categoria: issue.categoria,
    situacao: issue.situacao,
    matriculaParticipante: issue.matriculaParticipante ?? null,
    campoUnicoLgpd: issue.campoUnicoLgpd ?? null,
    caminhoCampo: issue.caminhoCampo ?? null,
    jsonValorAtual: issue.jsonValorAtual ?? null,
    jsonValorAnterior: issue.jsonValorAnterior ?? null,
    mensagem: issue.mensagem,
    jsonDetalhes: issue.jsonDetalhes,
    jsonBruto: row?.jsonBruto ?? null,
    jsonNormalizado: row?.jsonNormalizado ?? null,
    jsonCanonico: row?.jsonCanonico ?? null,
    previousCanonicalJson: previousRow?.jsonCanonico ?? null,
    notaResolucao: issue.notaResolucao ?? null,
    criadoEm: issue.criadoEm,
    resolvidoEm: issue.resolvidoEm ?? null
  };
}

export async function resolveInconsistenciaCritica(issueId: string, situacao: "JUSTIFICADO" | "RESOLVIDO" | "IGNORADO", note: string) {
  return withSession(async (session) => {
    const issue = await session.find(InconsistenciaCritica, issueId);
    if (!issue) return null;
    issue.situacao = situacao;
    issue.notaResolucao = note.trim();
    issue.resolvidoEm = new Date().toISOString();
    await session.commit();
    return getInconsistenciaCriticaDetail(issueId);
  });
}

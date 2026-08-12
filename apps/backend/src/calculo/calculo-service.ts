import { createHash, randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  Avaliacao,
  ArquivoImportacao,
  ImportacaoJob,
  LinhaImportacao
} from "../domain/entities.js";
import { Plano } from "../domain/plano-entities.js";
import { ValorRegraPlano, VersaoRegrasPlano } from "../domain/regras-plano-entities.js";
import { PontoTabuaBiometria } from "../domain/biometria-entities.js";
import {
  SelecaoHipoteseAtuarial,
  ParametrizacaoAtuarial,
  ValorParametroAtuarial
} from "../domain/parametrizacao-entities.js";
import {
  EntradaCalculo,
  ResultadoParticipanteCalculo,
  MetricaResultadoCalculo,
  ExecucaoCalculo
} from "../domain/calculo-entities.js";
import { calculateRegrasPlanoFingerprint, compareRegraPlanoCode } from "../planos/regras-plano-fingerprint.js";
import "./pre-calculo-nuclear-engine.js";
import "./bd-pvfb-engine.js";
import {
  getCalculoEngine,
  listCalculoEngines,
  validateCalculationOutput,
  type CalculoEngine,
  type CalculoEngineContext
} from "./calculo-engine.js";

const runRef = entityRef(ExecucaoCalculo);
const importJobRef = entityRef(ImportacaoJob);
const importRowRef = entityRef(LinhaImportacao);
const valueRef = entityRef(ValorParametroAtuarial);
const selectionRef = entityRef(SelecaoHipoteseAtuarial);
const planRuleRef = entityRef(ValorRegraPlano);
const biometricPointRef = entityRef(PontoTabuaBiometria);
const inputRef = entityRef(EntradaCalculo);
const metricRef = entityRef(MetricaResultadoCalculo);
const participantRef = entityRef(ResultadoParticipanteCalculo);

type Session = ReturnType<typeof createSession>;

type CalculationEntity =
  | typeof ExecucaoCalculo
  | typeof EntradaCalculo
  | typeof MetricaResultadoCalculo
  | typeof ResultadoParticipanteCalculo;

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

function jsonNormalizadoFingerprint(value: unknown) {
  return sha256(JSON.stringify(value));
}

function isModality(value: string): value is "BD" | "CD" | "CV" {
  return value === "BD" || value === "CD" || value === "CV";
}

function isImmutableApprovedSnapshot(situacao: string) {
  return situacao === "APROVADO" || situacao === "SUBSTITUIDO";
}

function runSummary(row: ExecucaoCalculo) {
  return {
    id: row.id,
    avaliacaoId: row.avaliacaoId,
    parametrizacaoId: row.parametrizacaoId,
    versaoRegrasPlanoId: row.versaoRegrasPlanoId ?? null,
    impressaoDigitalRegrasPlano: row.impressaoDigitalRegrasPlano ?? null,
    codigoMotor: row.codigoMotor,
    versaoMotor: row.versaoMotor,
    situacao: row.situacao,
    impressaoDigitalEntrada: row.impressaoDigitalEntrada,
    impressaoDigitalResultado: row.impressaoDigitalResultado ?? null,
    quantidadeImportacoesEntrada: row.quantidadeImportacoesEntrada,
    quantidadeLinhasEntrada: row.quantidadeLinhasEntrada,
    quantidadeLinhasValidas: row.quantidadeLinhasValidas,
    quantidadeLinhasInvalidas: row.quantidadeLinhasInvalidas,
    quantidadeResultadosParticipantes: row.quantidadeResultadosParticipantes ?? 0,
    criadoEm: row.criadoEm,
    concluidoEm: row.concluidoEm ?? null,
    mensagemErro: row.mensagemErro ?? null
  };
}

async function detailInSession(session: Session, row: ExecucaoCalculo) {
  const [inputs, metrics] = await Promise.all([
    selectFromEntity(EntradaCalculo).where(eq(inputRef.execucaoCalculoId, row.id)).execute(session),
    selectFromEntity(MetricaResultadoCalculo).where(eq(metricRef.execucaoCalculoId, row.id)).execute(session)
  ]);
  return {
    ...runSummary(row),
    impressaoDigitalParametros: row.impressaoDigitalParametros,
    impressaoDigitalDados: row.impressaoDigitalDados,
    inputs: inputs
      .sort((a, b) => a.populacao.localeCompare(b.populacao, "pt-BR") || a.importacaoId.localeCompare(b.importacaoId))
      .map((item) => ({
        id: item.id,
        importacaoId: item.importacaoId,
        populacao: item.populacao,
        arquivoSha256: item.arquivoSha256,
        impressaoDigitalEsquema: item.impressaoDigitalEsquema,
        impressaoDigitalCanonica: item.impressaoDigitalCanonica,
        quantidadeLinhas: item.quantidadeLinhas,
        linhasValidas: item.linhasValidas,
        linhasInvalidas: item.linhasInvalidas,
        importadoEm: item.importadoEm
      })),
    metrics: metrics
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((item) => ({
        id: item.id,
        codigo: item.codigo,
        categoria: item.categoria,
        rotulo: item.rotulo,
        tipoValor: item.tipoValor,
        jsonValor: item.jsonValor,
        unidade: item.unidade ?? null,
        ordinal: item.ordinal
      }))
  };
}

export function availableCalculoEngines() {
  return listCalculoEngines();
}

export async function listExecucaoCalculos(avaliacaoId: number) {
  return withSession(async (session) => {
    const rows = await selectFromEntity(ExecucaoCalculo)
      .where(eq(runRef.avaliacaoId, avaliacaoId))
      .orderBy(runRef.criadoEm, "DESC")
      .execute(session);
    return rows.map(runSummary);
  });
}

export async function getExecucaoCalculo(id: string) {
  return withSession(async (session) => {
    const row = await session.find(ExecucaoCalculo, id);
    return row ? detailInSession(session, row) : null;
  });
}

export async function listResultadoParticipanteCalculos(id: string, page: number, pageSize: number) {
  return withSession(async (session) => {
    const run = await session.find(ExecucaoCalculo, id);
    if (!run) return null;
    const result = await selectFromEntity(ResultadoParticipanteCalculo)
      .where(eq(participantRef.execucaoCalculoId, id))
      .orderBy(participantRef.ordinal, "ASC")
      .orderBy(participantRef.id, "ASC")
      .executePaged(session, { page, pageSize });
    return {
      items: result.items.map((item) => ({
        id: item.id,
        importacaoId: item.importacaoId,
        populacao: item.populacao,
        numeroLinhaOrigem: item.numeroLinhaOrigem,
        matriculaParticipante: item.matriculaParticipante ?? null,
        campoUnicoLgpd: item.campoUnicoLgpd ?? null,
        jsonResultado: item.jsonResultado,
        ordinal: item.ordinal
      })),
      totalItems: result.totalItems,
      page,
      pageSize
    };
  });
}

function latestCompletedImportacaos(jobs: ImportacaoJob[]) {
  const byPopulation = new Map<string, ImportacaoJob>();
  const sorted = jobs
    .filter((job) => job.situacao === "CONCLUIDO")
    .sort((a, b) => {
      const timeOrder = (b.concluidoEm ?? b.criadoEm).localeCompare(a.concluidoEm ?? a.criadoEm);
      return timeOrder || b.id.localeCompare(a.id);
    });
  for (const job of sorted) {
    if (!byPopulation.has(job.populacao)) byPopulation.set(job.populacao, job);
  }
  return [...byPopulation.values()].sort(
    (a, b) => a.populacao.localeCompare(b.populacao, "pt-BR") || a.id.localeCompare(b.id)
  );
}

async function loadRegrasPlano(
  session: Session,
  evaluation: Avaliacao,
  engine: CalculoEngine,
  versaoRegrasPlanoId: string | undefined
): Promise<CalculoEngineContext["planRules"]> {
  if (!engine.requiresRegrasPlano) {
    if (versaoRegrasPlanoId) {
      throw new Error(`O motor ${engine.codigo} não utiliza regras versionadas do plano; remova versaoRegrasPlanoId da solicitação.`);
    }
    return null;
  }

  if (!evaluation.planoId) {
    throw new Error("O motor atuarial exige que a avaliação esteja vinculada a um plano por planoId.");
  }
  if (!versaoRegrasPlanoId) {
    throw new Error(`O motor ${engine.codigo} exige versaoRegrasPlanoId de um snapshot aprovado e imutável.`);
  }

  const plan = await session.find(Plano, evaluation.planoId);
  if (!plan) throw new Error("O plano vinculado à avaliação não foi encontrado.");
  if (!isModality(plan.modalidade)) throw new Error(`Modalidade de plano inválida: ${plan.modalidade}.`);
  if (!engine.modalidadesSuportadas.includes(plan.modalidade)) {
    throw new Error(`O motor ${engine.codigo} não suporta plano ${plan.modalidade}.`);
  }

  const versao = await session.find(VersaoRegrasPlano, versaoRegrasPlanoId);
  if (!versao || versao.planoId !== plan.id) {
    throw new Error("A versão de regras informada não pertence ao plano desta avaliação.");
  }
  if (!isImmutableApprovedSnapshot(versao.situacao)) {
    throw new Error("O motor atuarial exige uma versão de regras APROVADO ou SUBSTITUIDO, ambas imutáveis após aprovação.");
  }
  if (versao.modalidade !== plan.modalidade) {
    throw new Error("A modalidade congelada na versão de regras diverge da modalidade do plano.");
  }
  if (!versao.impressaoDigitalRegras) {
    throw new Error("A versão aprovada das regras do plano não possui fingerprint.");
  }
  if (!versao.vigenciaInicial) {
    throw new Error("A versão aprovada das regras do plano não possui início de vigência.");
  }
  if (evaluation.dataReferencia < versao.vigenciaInicial || (versao.vigenciaFinal && evaluation.dataReferencia > versao.vigenciaFinal)) {
    throw new Error(`A versão de regras não está vigente na data-base ${evaluation.dataReferencia}.`);
  }

  const storedRules = await selectFromEntity(ValorRegraPlano)
    .where(eq(planRuleRef.versaoRegrasPlanoId, versao.id))
    .execute(session);
  const rules = storedRules
    .filter((item) => item.ativo !== 0)
    .sort(compareRegraPlanoCode)
    .map((item) => ({
      codigo: item.codigo,
      categoria: item.categoria,
      rotulo: item.rotulo,
      tipoValor: item.tipoValor,
      jsonValor: item.jsonValor,
      unidade: item.unidade ?? null,
      origem: item.origem
    }));
  if (!rules.length) throw new Error("A versão aprovada das regras do plano não possui regras ativas.");

  const recalculatedFingerprint = calculateRegrasPlanoFingerprint({
    planoId: versao.planoId,
    versao: versao.versao,
    modalidade: versao.modalidade,
    vigenciaInicial: versao.vigenciaInicial,
    vigenciaFinal: versao.vigenciaFinal ?? null,
    rules
  });
  if (recalculatedFingerprint !== versao.impressaoDigitalRegras) {
    throw new Error("A integridade da versão de regras do plano falhou: o conteúdo atual não corresponde ao fingerprint aprovado.");
  }

  return {
    id: versao.id,
    versao: versao.versao,
    modalidade: plan.modalidade,
    vigenciaInicial: versao.vigenciaInicial,
    vigenciaFinal: versao.vigenciaFinal ?? null,
    fingerprint: recalculatedFingerprint,
    rules
  };
}

export async function executeCalculation(
  avaliacaoId: number,
  input: { parametrizacaoId: string; versaoRegrasPlanoId?: string; codigoMotor?: string }
) {
  return withSession(async (session) => {
    const evaluation = await session.find(Avaliacao, avaliacaoId);
    if (!evaluation) throw new Error("Avaliação não encontrada.");
    if (evaluation.inconsistenciasBloqueantes > 0) {
      throw new Error("A avaliação possui ocorrências bloqueantes e não pode ser calculada.");
    }

    const parametrizacao = await session.find(ParametrizacaoAtuarial, input.parametrizacaoId);
    if (!parametrizacao || parametrizacao.avaliacaoId !== avaliacaoId) {
      throw new Error("A parametrização não pertence a esta avaliação.");
    }
    if (!isImmutableApprovedSnapshot(parametrizacao.situacao)) {
      throw new Error("O cálculo exige uma parametrização APROVADO ou SUBSTITUIDO, ambas imutáveis após aprovação.");
    }

    const engine = getCalculoEngine(input.codigoMotor ?? "CORE_PRECALCULATION");
    const planRules = await loadRegrasPlano(session, evaluation, engine, input.versaoRegrasPlanoId);

    const [storedValues, storedSelecaos, jobs] = await Promise.all([
      selectFromEntity(ValorParametroAtuarial)
        .where(eq(valueRef.parametrizacaoId, parametrizacao.id))
        .execute(session),
      selectFromEntity(SelecaoHipoteseAtuarial)
        .where(eq(selectionRef.parametrizacaoId, parametrizacao.id))
        .execute(session),
      selectFromEntity(ImportacaoJob)
        .where(eq(importJobRef.avaliacaoId, avaliacaoId))
        .execute(session)
    ]);

    const parameters = storedValues
      .filter((value) => value.ativo !== 0)
      .sort((a, b) => a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0)
      .map((value) => ({
        codigo: value.codigo,
        categoria: value.categoria,
        rotulo: value.rotulo,
        tipoValor: value.tipoValor,
        jsonValor: value.jsonValor,
        unidade: value.unidade ?? null,
        origem: value.origem
      }));

    const hypotheses: CalculoEngineContext["parametrizacao"]["hypotheses"] = [];
    for (const selection of storedSelecaos
      .filter((item) => item.ativo !== 0)
      .sort((a, b) => a.tipoHipotese < b.tipoHipotese ? -1 : a.tipoHipotese > b.tipoHipotese ? 1 : a.id.localeCompare(b.id))) {
      const storedPoints = await selectFromEntity(PontoTabuaBiometria)
        .where(eq(biometricPointRef.versaoId, selection.versaoBiometriaId))
        .execute(session);
      const points = storedPoints
        .sort((a, b) => a.idade - b.idade || a.sexo.localeCompare(b.sexo))
        .map((point) => ({ idade: point.idade, sexo: point.sexo, qx: Number(point.qx) }));
      hypotheses.push({
        tipoHipotese: selection.tipoHipotese,
        estudoAderenciaId: selection.estudoAderenciaId,
        resultadoCandidatoId: selection.resultadoCandidatoId,
        versaoBiometriaId: selection.versaoBiometriaId,
        codigoTabua: selection.codigoTabua,
        nomeTabua: selection.nomeTabua,
        rotuloVersao: selection.rotuloVersao,
        posicaoCandidato: selection.posicaoCandidato,
        points
      });
    }

    const selectedImportacaos = latestCompletedImportacaos(jobs);
    if (!selectedImportacaos.length) {
      throw new Error("A avaliação não possui imports CONCLUIDO vinculados ao Data Studio.");
    }

    const canonicalRows: CalculoEngineContext["rows"] = [];
    const inputSnapshots: Array<{
      job: ImportacaoJob;
      file: ArquivoImportacao;
      impressaoDigitalCanonica: string;
    }> = [];

    for (const job of selectedImportacaos) {
      const file = await session.find(ArquivoImportacao, job.arquivoId);
      if (!file) throw new Error(`Arquivo do import ${job.id} não foi encontrado.`);
      const rows = await selectFromEntity(LinhaImportacao)
        .where(eq(importRowRef.importacaoId, job.id))
        .execute(session);
      rows.sort((a, b) => a.numeroLinha - b.numeroLinha || a.id.localeCompare(b.id));
      const impressaoDigitalCanonica = jsonNormalizadoFingerprint(rows.map((row) => ({
        id: row.id,
        numeroLinha: row.numeroLinha,
        situacaoValidacao: row.situacaoValidacao,
        jsonCanonico: row.jsonCanonico,
        jsonErrosValidacao: row.jsonErrosValidacao
      })));
      inputSnapshots.push({ job, file, impressaoDigitalCanonica });

      for (const row of rows) {
        if (row.situacaoValidacao !== "VALID") continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(row.jsonCanonico) as Record<string, unknown>;
        } catch {
          throw new Error(`Linha canônica inválida no import ${job.id}, linha ${row.numeroLinha}.`);
        }
        canonicalRows.push({ importacaoId: job.id, populacao: job.populacao, numeroLinha: row.numeroLinha, data });
      }
    }

    const impressaoDigitalParametros = jsonNormalizadoFingerprint({
      parametrizacaoId: parametrizacao.id,
      versao: parametrizacao.versao,
      aprovadoEm: parametrizacao.aprovadoEm ?? null,
      parameters,
      hypotheses
    });
    const impressaoDigitalDados = jsonNormalizadoFingerprint(inputSnapshots.map(({ job, file, impressaoDigitalCanonica }) => ({
      importacaoId: job.id,
      populacao: job.populacao,
      arquivoSha256: file.sha256,
      impressaoDigitalEsquema: job.impressaoDigitalEsquema,
      impressaoDigitalCanonica,
      quantidadeLinhas: job.quantidadeLinhas,
      linhasValidas: job.linhasValidas,
      linhasInvalidas: job.linhasInvalidas,
      concluidoEm: job.concluidoEm ?? null
    })));
    const impressaoDigitalEntrada = jsonNormalizadoFingerprint({
      avaliacaoId,
      planoId: evaluation.planoId ?? null,
      dataReferencia: evaluation.dataReferencia,
      planRules,
      impressaoDigitalParametros,
      impressaoDigitalDados,
      codigoMotor: engine.codigo,
      versaoMotor: engine.versao
    });

    const prior = await selectFromEntity(ExecucaoCalculo)
      .where(eq(runRef.avaliacaoId, avaliacaoId))
      .execute(session);
    const reusable = prior.find(
      (run) =>
        run.situacao === "CONCLUIDO" &&
        run.codigoMotor === engine.codigo &&
        run.versaoMotor === engine.versao &&
        run.impressaoDigitalEntrada === impressaoDigitalEntrada
    );
    if (reusable) return detailInSession(session, reusable);

    const criadoEm = new Date().toISOString();
    const run = new ExecucaoCalculo();
    run.id = randomUUID();
    run.avaliacaoId = avaliacaoId;
    run.parametrizacaoId = parametrizacao.id;
    run.versaoRegrasPlanoId = planRules?.id ?? null;
    run.impressaoDigitalRegrasPlano = planRules?.fingerprint ?? null;
    run.codigoMotor = engine.codigo;
    run.versaoMotor = engine.versao;
    run.situacao = "PROCESSANDO";
    run.impressaoDigitalParametros = impressaoDigitalParametros;
    run.impressaoDigitalDados = impressaoDigitalDados;
    run.impressaoDigitalEntrada = impressaoDigitalEntrada;
    run.impressaoDigitalResultado = null;
    run.quantidadeImportacoesEntrada = selectedImportacaos.length;
    run.quantidadeLinhasEntrada = selectedImportacaos.reduce((total, job) => total + job.quantidadeLinhas, 0);
    run.quantidadeLinhasValidas = selectedImportacaos.reduce((total, job) => total + job.linhasValidas, 0);
    run.quantidadeLinhasInvalidas = selectedImportacaos.reduce((total, job) => total + job.linhasInvalidas, 0);
    run.quantidadeResultadosParticipantes = null;
    run.criadoEm = criadoEm;
    run.concluidoEm = null;
    run.mensagemErro = null;
    session.trackNew(tableOf(ExecucaoCalculo), run, run.id);

    for (const snapshot of inputSnapshots) {
      const stored = new EntradaCalculo();
      stored.id = randomUUID();
      stored.execucaoCalculoId = run.id;
      stored.importacaoId = snapshot.job.id;
      stored.populacao = snapshot.job.populacao;
      stored.arquivoSha256 = snapshot.file.sha256;
      stored.impressaoDigitalEsquema = snapshot.job.impressaoDigitalEsquema;
      stored.impressaoDigitalCanonica = snapshot.impressaoDigitalCanonica;
      stored.quantidadeLinhas = snapshot.job.quantidadeLinhas;
      stored.linhasValidas = snapshot.job.linhasValidas;
      stored.linhasInvalidas = snapshot.job.linhasInvalidas;
      stored.importadoEm = snapshot.job.concluidoEm ?? snapshot.job.criadoEm;
      session.trackNew(tableOf(EntradaCalculo), stored, stored.id);
    }
    await session.commit();

    try {
      const output = validateCalculationOutput(await engine.execute({
        evaluation: {
          id: evaluation.id,
          planoId: evaluation.planoId ?? null,
          nomePlano: evaluation.nomePlano,
          dataReferencia: evaluation.dataReferencia
        },
        planRules,
        parametrizacao: {
          id: parametrizacao.id,
          versao: parametrizacao.versao,
          parameters,
          hypotheses
        },
        rows: canonicalRows,
        quantidadeLinhasInvalidas: run.quantidadeLinhasInvalidas,
        importCount: run.quantidadeImportacoesEntrada
      }));

      const allowedRows = new Set(canonicalRows.map((row) => `${row.importacaoId}:${row.numeroLinha}`));
      for (const participant of output.participantResults) {
        const key = `${participant.importacaoId}:${participant.numeroLinhaOrigem}`;
        if (!allowedRows.has(key)) {
          throw new Error(`O engine tentou persistir resultado individual para uma linha que não pertence aos inputs congelados: ${key}.`);
        }
      }

      for (const [ordinal, metric] of output.metrics.entries()) {
        const stored = new MetricaResultadoCalculo();
        stored.id = randomUUID();
        stored.execucaoCalculoId = run.id;
        stored.codigo = metric.codigo;
        stored.categoria = metric.categoria;
        stored.rotulo = metric.rotulo;
        stored.tipoValor = metric.tipoValor;
        stored.jsonValor = JSON.stringify(metric.value);
        stored.unidade = metric.unidade ?? null;
        stored.ordinal = ordinal;
        session.trackNew(tableOf(MetricaResultadoCalculo), stored, stored.id);
      }

      for (const [ordinal, participant] of output.participantResults.entries()) {
        const stored = new ResultadoParticipanteCalculo();
        stored.id = randomUUID();
        stored.execucaoCalculoId = run.id;
        stored.importacaoId = participant.importacaoId;
        stored.populacao = participant.populacao;
        stored.numeroLinhaOrigem = participant.numeroLinhaOrigem;
        stored.matriculaParticipante = participant.matriculaParticipante;
        stored.campoUnicoLgpd = participant.campoUnicoLgpd;
        stored.jsonResultado = JSON.stringify(participant.result);
        stored.ordinal = ordinal;
        session.trackNew(tableOf(ResultadoParticipanteCalculo), stored, stored.id);
      }

      run.impressaoDigitalResultado = jsonNormalizadoFingerprint({
        metrics: output.metrics.map((metric) => ({
          codigo: metric.codigo,
          categoria: metric.categoria,
          rotulo: metric.rotulo,
          tipoValor: metric.tipoValor,
          value: metric.value,
          unidade: metric.unidade ?? null
        })),
        participantResults: output.participantResults
      });
      run.quantidadeResultadosParticipantes = output.participantResults.length;
      run.situacao = "CONCLUIDO";
      run.concluidoEm = new Date().toISOString();
      session.markDirty(run);
      await session.commit();
    } catch (error) {
      run.situacao = "FALHO";
      run.quantidadeResultadosParticipantes = 0;
      run.concluidoEm = new Date().toISOString();
      run.mensagemErro = error instanceof Error ? error.message : "Falha não identificada no motor de cálculo.";
      session.markDirty(run);
      await session.commit();
    }

    return detailInSession(session, run);
  });
}

import { randomUUID } from "node:crypto";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  PontoCandidatoAderencia,
  ResultadoCandidatoAderencia,
  ObservacaoAderencia,
  EstudoAderencia
} from "../domain/aderencia-entities.js";
import {
  TabuaBiometria,
  PontoTabuaBiometria,
  VersaoTabuaBiometria
} from "../domain/biometria-entities.js";
import { evaluateCandidato, type AderenciaCell } from "./estatisticas.js";

export const ADHERENCE_ENGINE_VERSION = "adherence-engine-v1";

type Sex = "MASCULINO" | "FEMININO" | "UNISSEX";

export type ObservacaoInput = {
  ano: number;
  idade: number;
  sexo: Sex;
  exposicao: number;
  eventosObservados: number;
};

export type CreateStudyInput = {
  avaliacaoId?: number;
  nome: string;
  tipoHipotese: string;
  periodoInicial: number;
  periodoFinal: number;
  escopoSexo: "AMBOS" | Sex;
  alpha: number;
  idadeDivisaoFisher: number;
  idsVersoesCandidatas: string[];
  observacoes: ObservacaoInput[];
};

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableOf(entity: typeof EstudoAderencia | typeof ObservacaoAderencia | typeof ResultadoCandidatoAderencia | typeof PontoCandidatoAderencia) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function validateInput(input: CreateStudyInput) {
  if (!input.nome.trim()) throw new Error("Nome do estudo é obrigatório.");
  if (!input.tipoHipotese.trim()) throw new Error("Hipótese é obrigatória.");
  if (!Number.isInteger(input.periodoInicial) || !Number.isInteger(input.periodoFinal) || input.periodoInicial > input.periodoFinal) {
    throw new Error("Período do estudo é inválido.");
  }
  if (!Number.isFinite(input.alpha) || input.alpha <= 0 || input.alpha >= 1) {
    throw new Error("Nível de significância deve estar entre 0 e 1.");
  }
  if (!Number.isInteger(input.idadeDivisaoFisher) || input.idadeDivisaoFisher < 0 || input.idadeDivisaoFisher > 130) {
    throw new Error("Idade de corte do Fisher deve estar entre 0 e 130.");
  }
  const candidatos = new Set(input.idsVersoesCandidatas);
  if (!candidatos.size) throw new Error("Selecione ao menos uma versão biométrica candidata.");
  if (candidatos.size !== input.idsVersoesCandidatas.length) throw new Error("Existem versões candidatas duplicadas.");
  if (!input.observacoes.length) throw new Error("O estudo precisa possuir observações de exposição e eventos.");
  for (const observation of input.observacoes) {
    if (!Number.isInteger(observation.ano) || observation.ano < input.periodoInicial || observation.ano > input.periodoFinal) {
      throw new Error(`Ano ${observation.ano} está fora do período do estudo.`);
    }
    if (!Number.isInteger(observation.idade) || observation.idade < 0 || observation.idade > 130) {
      throw new Error(`Idade inválida: ${observation.idade}.`);
    }
    if (!["MASCULINO", "FEMININO", "UNISSEX"].includes(observation.sexo)) {
      throw new Error(`Sexo inválido: ${observation.sexo}.`);
    }
    if (input.escopoSexo !== "AMBOS" && observation.sexo !== input.escopoSexo) {
      throw new Error(`A observação ${observation.ano}/${observation.idade}/${observation.sexo} não pertence ao escopo ${input.escopoSexo}.`);
    }
    if (!Number.isFinite(observation.exposicao) || observation.exposicao <= 0) {
      throw new Error(`Exposição inválida em ${observation.ano}/${observation.idade}/${observation.sexo}.`);
    }
    if (!Number.isInteger(observation.eventosObservados) || observation.eventosObservados < 0) {
      throw new Error(`Eventos observados inválidos em ${observation.ano}/${observation.idade}/${observation.sexo}.`);
    }
  }
}

function aggregateObservacaos(observacoes: ObservacaoInput[]) {
  const aggregated = new Map<string, { idade: number; sexo: Sex; exposicao: number; observado: number }>();
  for (const observation of observacoes) {
    const key = `${observation.sexo}:${observation.idade}`;
    const current = aggregated.get(key) ?? { idade: observation.idade, sexo: observation.sexo, exposicao: 0, observado: 0 };
    current.exposicao += observation.exposicao;
    current.observado += observation.eventosObservados;
    aggregated.set(key, current);
  }
  return [...aggregated.values()].sort((a, b) => a.idade - b.idade || a.sexo.localeCompare(b.sexo));
}

async function loadBiometriaCatalog() {
  return withSession(async (session) => {
    const [tables, versions, pontos] = await Promise.all([
      selectFromEntity(TabuaBiometria).execute(session),
      selectFromEntity(VersaoTabuaBiometria).execute(session),
      selectFromEntity(PontoTabuaBiometria).execute(session)
    ]);
    return { tables, versions, pontos };
  });
}

function buildCandidatoCells(
  aggregated: ReturnType<typeof aggregateObservacaos>,
  pontos: PontoTabuaBiometria[],
  versaoId: string
): AderenciaCell[] {
  const ownPoints = pontos.filter((ponto) => ponto.versaoId === versaoId);
  const qxByKey = new Map(ownPoints.map((ponto) => [`${ponto.sexo}:${ponto.idade}`, Number(ponto.qx)]));
  return aggregated.map((observation) => {
    const exact = qxByKey.get(`${observation.sexo}:${observation.idade}`);
    const unisex = qxByKey.get(`UNISSEX:${observation.idade}`);
    const qx = exact ?? unisex;
    if (qx === undefined) {
      throw new Error(`A versão biométrica ${versaoId} não possui qx para ${observation.sexo}, idade ${observation.idade}.`);
    }
    return {
      idade: observation.idade,
      sexo: observation.sexo,
      exposicao: observation.exposicao,
      observado: observation.observado,
      qx,
      esperado: observation.exposicao * qx
    };
  });
}

export async function createEstudoAderencia(input: CreateStudyInput) {
  validateInput(input);
  const catalog = await loadBiometriaCatalog();
  const versionsById = new Map(catalog.versions.map((versao) => [versao.id, versao]));
  const tablesById = new Map(catalog.tables.map((table) => [table.id, table]));
  const aggregated = aggregateObservacaos(input.observacoes);

  const computed = input.idsVersoesCandidatas.map((versaoId) => {
    const versao = versionsById.get(versaoId);
    if (!versao) throw new Error(`Versão biométrica ${versaoId} não encontrada.`);
    const table = tablesById.get(versao.tabuaId);
    if (!table) throw new Error(`Tábua da versão ${versaoId} não encontrada.`);
    const cells = buildCandidatoCells(aggregated, catalog.pontos, versaoId);
    const metrics = evaluateCandidato(cells, input.alpha, input.idadeDivisaoFisher);
    return { versao, table, cells, metrics };
  });

  computed.sort((a, b) =>
    a.metrics.testesRejeitados - b.metrics.testesRejeitados ||
    a.metrics.dqm - b.metrics.dqm ||
    b.metrics.quiQuadradoP - a.metrics.quiQuadradoP
  );

  const now = new Date().toISOString();
  const study = new EstudoAderencia();
  study.id = randomUUID();
  study.avaliacaoId = input.avaliacaoId ?? null;
  study.nome = input.nome.trim();
  study.tipoHipotese = input.tipoHipotese.trim();
  study.periodoInicial = input.periodoInicial;
  study.periodoFinal = input.periodoFinal;
  study.escopoSexo = input.escopoSexo;
  study.alpha = input.alpha;
  study.idadeDivisaoFisher = input.idadeDivisaoFisher;
  study.situacao = "CONCLUIDO";
  study.versaoMotor = ADHERENCE_ENGINE_VERSION;
  study.quantidadeObservacoes = input.observacoes.length;
  study.quantidadeCandidatos = computed.length;
  study.criadoEm = now;
  study.concluidoEm = now;

  await withSession(async (session) => {
    session.trackNew(tableOf(EstudoAderencia), study, study.id);
    for (const observation of input.observacoes) {
      const entity = new ObservacaoAderencia();
      entity.id = randomUUID();
      entity.estudoId = study.id;
      entity.ano = observation.ano;
      entity.idade = observation.idade;
      entity.sexo = observation.sexo;
      entity.exposicao = observation.exposicao;
      entity.eventosObservados = observation.eventosObservados;
      session.trackNew(tableOf(ObservacaoAderencia), entity, entity.id);
    }
    for (let index = 0; index < computed.length; index += 1) {
      const candidato = computed[index];
      const result = new ResultadoCandidatoAderencia();
      result.id = randomUUID();
      result.estudoId = study.id;
      result.versaoBiometriaId = candidato.versao.id;
      result.codigoTabua = candidato.table.codigo;
      result.nomeTabua = candidato.table.nome;
      result.rotuloVersao = candidato.versao.versao;
      result.rank = index + 1;
      result.eventosObservados = candidato.metrics.eventosObservados;
      result.eventosEsperados = candidato.metrics.eventosEsperados;
      result.quiQuadrado = candidato.metrics.quiQuadrado;
      result.quiQuadradoDf = candidato.metrics.quiQuadradoDf;
      result.quiQuadradoCritical = candidato.metrics.quiQuadradoCritical;
      result.quiQuadradoP = candidato.metrics.quiQuadradoP;
      result.quiQuadradoPass = candidato.metrics.quiQuadradoPass ? 1 : 0;
      result.ksD = candidato.metrics.ksD;
      result.ksCritico = candidato.metrics.ksCritico;
      result.pKs = candidato.metrics.pKs;
      result.pKsass = candidato.metrics.pKsass ? 1 : 0;
      result.estatisticaZ = candidato.metrics.estatisticaZ;
      result.zCritico = candidato.metrics.zCritico;
      result.pZ = candidato.metrics.pZ;
      result.pZass = candidato.metrics.pZass ? 1 : 0;
      result.pFisher = candidato.metrics.pFisher;
      result.pFisherass = candidato.metrics.pFisherass ? 1 : 0;
      result.dqm = candidato.metrics.dqm;
      result.testesRejeitados = candidato.metrics.testesRejeitados;
      result.criadoEm = now;
      session.trackNew(tableOf(ResultadoCandidatoAderencia), result, result.id);

      for (const cell of candidato.cells) {
        const ponto = new PontoCandidatoAderencia();
        ponto.id = randomUUID();
        ponto.resultadoCandidatoId = result.id;
        ponto.idade = cell.idade;
        ponto.sexo = cell.sexo;
        ponto.exposicao = cell.exposicao;
        ponto.eventosObservados = cell.observado;
        ponto.qx = cell.qx;
        ponto.eventosEsperados = cell.esperado;
        ponto.residuo = cell.observado - cell.esperado;
        session.trackNew(tableOf(PontoCandidatoAderencia), ponto, ponto.id);
      }
    }
    await session.commit();
  });

  return getEstudoAderencia(study.id);
}

function summarizeCandidato(result: ResultadoCandidatoAderencia) {
  return {
    id: result.id,
    versaoBiometriaId: result.versaoBiometriaId,
    codigoTabua: result.codigoTabua,
    nomeTabua: result.nomeTabua,
    rotuloVersao: result.rotuloVersao,
    rank: result.rank,
    eventosObservados: Number(result.eventosObservados),
    eventosEsperados: Number(result.eventosEsperados),
    quiQuadrado: Number(result.quiQuadrado),
    quiQuadradoDf: result.quiQuadradoDf,
    quiQuadradoCritical: Number(result.quiQuadradoCritical),
    quiQuadradoP: Number(result.quiQuadradoP),
    quiQuadradoPass: result.quiQuadradoPass === 1,
    ksD: Number(result.ksD),
    ksCritico: Number(result.ksCritico),
    pKs: Number(result.pKs),
    pKsass: result.pKsass === 1,
    estatisticaZ: Number(result.estatisticaZ),
    zCritico: Number(result.zCritico),
    pZ: Number(result.pZ),
    pZass: result.pZass === 1,
    pFisher: Number(result.pFisher),
    pFisherass: result.pFisherass === 1,
    dqm: Number(result.dqm),
    testesRejeitados: result.testesRejeitados
  };
}

export async function listAderenciaStudies() {
  return withSession(async (session) => {
    const studies = await selectFromEntity(EstudoAderencia).execute(session);
    return studies.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((study) => ({
      id: study.id,
      avaliacaoId: study.avaliacaoId ?? null,
      nome: study.nome,
      tipoHipotese: study.tipoHipotese,
      periodoInicial: study.periodoInicial,
      periodoFinal: study.periodoFinal,
      escopoSexo: study.escopoSexo,
      alpha: Number(study.alpha),
      situacao: study.situacao,
      versaoMotor: study.versaoMotor,
      quantidadeObservacoes: study.quantidadeObservacoes,
      quantidadeCandidatos: study.quantidadeCandidatos,
      criadoEm: study.criadoEm,
      concluidoEm: study.concluidoEm ?? null
    }));
  });
}

export async function getEstudoAderencia(estudoId: string) {
  return withSession(async (session) => {
    const study = await session.find(EstudoAderencia, estudoId);
    if (!study) return null;
    const candidatos = (await selectFromEntity(ResultadoCandidatoAderencia).execute(session))
      .filter((result) => result.estudoId === study.id)
      .sort((a, b) => a.rank - b.rank);
    return {
      id: study.id,
      avaliacaoId: study.avaliacaoId ?? null,
      nome: study.nome,
      tipoHipotese: study.tipoHipotese,
      periodoInicial: study.periodoInicial,
      periodoFinal: study.periodoFinal,
      escopoSexo: study.escopoSexo,
      alpha: Number(study.alpha),
      idadeDivisaoFisher: study.idadeDivisaoFisher,
      situacao: study.situacao,
      versaoMotor: study.versaoMotor,
      quantidadeObservacoes: study.quantidadeObservacoes,
      quantidadeCandidatos: study.quantidadeCandidatos,
      criadoEm: study.criadoEm,
      concluidoEm: study.concluidoEm ?? null,
      candidatos: candidatos.map(summarizeCandidato)
    };
  });
}

export async function getPontosCandidatoAderencia(resultadoCandidatoId: string) {
  return withSession(async (session) => {
    const result = await session.find(ResultadoCandidatoAderencia, resultadoCandidatoId);
    if (!result) return null;
    const pontos = (await selectFromEntity(PontoCandidatoAderencia).execute(session))
      .filter((ponto) => ponto.resultadoCandidatoId === result.id)
      .sort((a, b) => a.idade - b.idade || a.sexo.localeCompare(b.sexo))
      .map((ponto) => ({
        idade: ponto.idade,
        sexo: ponto.sexo,
        exposicao: Number(ponto.exposicao),
        eventosObservados: ponto.eventosObservados,
        qx: Number(ponto.qx),
        eventosEsperados: Number(ponto.eventosEsperados),
        residuo: Number(ponto.residuo)
      }));
    return { candidato: summarizeCandidato(result), pontos };
  });
}

import { randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { Avaliacao } from "../domain/entities.js";
import { ResultadoCandidatoAderencia, EstudoAderencia } from "../domain/aderencia-entities.js";
import {
  SelecaoHipoteseAtuarial,
  ParametrizacaoAtuarial,
  ValorParametroAtuarial
} from "../domain/parametrizacao-entities.js";

const parametrizacaoRef = entityRef(ParametrizacaoAtuarial);
const valueRef = entityRef(ValorParametroAtuarial);
const selectionRef = entityRef(SelecaoHipoteseAtuarial);
const tipoValors = new Set(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"]);

type Session = ReturnType<typeof createSession>;

type ParameterInput = {
  codigo: string;
  categoria: string;
  rotulo: string;
  tipoValor: string;
  jsonValor: string;
  unidade?: string | null;
  origem?: string | null;
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
    | typeof ParametrizacaoAtuarial
    | typeof ValorParametroAtuarial
    | typeof SelecaoHipoteseAtuarial
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
  const codigo = normalizeCode(input.codigo);
  const categoria = input.categoria.trim();
  const rotulo = input.rotulo.trim();
  const tipoValor = input.tipoValor.trim().toUpperCase();
  if (!codigo) throw new Error("Código do parâmetro é obrigatório.");
  if (!categoria) throw new Error(`Categoria do parâmetro ${codigo} é obrigatória.`);
  if (!rotulo) throw new Error(`Rótulo do parâmetro ${codigo} é obrigatório.`);
  if (!tipoValors.has(tipoValor)) throw new Error(`Tipo inválido para ${codigo}.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.jsonValor);
  } catch {
    throw new Error(`jsonValor de ${codigo} não contém JSON válido.`);
  }

  if (tipoValor === "NUMBER" && (typeof parsed !== "number" || !Number.isFinite(parsed))) {
    throw new Error(`${codigo} deve possuir valor numérico finito.`);
  }
  if (tipoValor === "INTEGER" && (typeof parsed !== "number" || !Number.isInteger(parsed))) {
    throw new Error(`${codigo} deve possuir valor inteiro.`);
  }
  if (tipoValor === "TEXT" && typeof parsed !== "string") {
    throw new Error(`${codigo} deve possuir valor textual.`);
  }
  if (tipoValor === "BOOLEAN" && typeof parsed !== "boolean") {
    throw new Error(`${codigo} deve possuir valor booleano.`);
  }

  return {
    codigo,
    categoria,
    rotulo,
    tipoValor,
    jsonValor: JSON.stringify(parsed),
    unidade: normalizeOptional(input.unidade),
    origem: normalizeOptional(input.origem) ?? "MANUAL"
  };
}

async function requireDraft(session: Session, id: string) {
  const parametrizacao = await session.find(ParametrizacaoAtuarial, id);
  if (!parametrizacao) throw new Error("Parametrização não encontrada.");
  if (parametrizacao.situacao !== "RASCUNHO") {
    throw new Error("Somente uma parametrização em rascunho pode ser alterada.");
  }
  return parametrizacao;
}

async function allValuesFor(session: Session, parametrizacaoId: string) {
  const rows = await selectFromEntity(ValorParametroAtuarial)
    .where(eq(valueRef.parametrizacaoId, parametrizacaoId))
    .execute(session);
  return rows as ValorParametroAtuarial[];
}

async function valuesFor(session: Session, parametrizacaoId: string) {
  const rows = await allValuesFor(session, parametrizacaoId);
  return rows
    .filter((row) => row.ativo !== 0)
    .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR") || a.codigo.localeCompare(b.codigo));
}

async function allSelecaosFor(session: Session, parametrizacaoId: string) {
  return selectFromEntity(SelecaoHipoteseAtuarial)
    .where(eq(selectionRef.parametrizacaoId, parametrizacaoId))
    .execute(session);
}

async function selectionsFor(session: Session, parametrizacaoId: string) {
  const rows = await allSelecaosFor(session, parametrizacaoId);
  return rows
    .filter((row) => row.ativo !== 0)
    .sort((a, b) => a.tipoHipotese.localeCompare(b.tipoHipotese, "pt-BR"));
}

function summary(row: ParametrizacaoAtuarial) {
  return {
    id: row.id,
    avaliacaoId: row.avaliacaoId,
    versao: row.versao,
    nome: row.nome,
    situacao: row.situacao,
    observacoes: row.observacoes ?? null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    aprovadoEm: row.aprovadoEm ?? null
  };
}

async function detailInSession(session: Session, row: ParametrizacaoAtuarial) {
  const [parameters, hypotheses] = await Promise.all([
    valuesFor(session, row.id),
    selectionsFor(session, row.id)
  ]);
  return {
    ...summary(row),
    parametros: parameters.map((value) => ({
      id: value.id,
      codigo: value.codigo,
      categoria: value.categoria,
      rotulo: value.rotulo,
      tipoValor: value.tipoValor,
      jsonValor: value.jsonValor,
      unidade: value.unidade ?? null,
      origem: value.origem,
      atualizadoEm: value.atualizadoEm
    })),
    hipoteses: hypotheses.map((selection) => ({
      id: selection.id,
      tipoHipotese: selection.tipoHipotese,
      estudoAderenciaId: selection.estudoAderenciaId,
      resultadoCandidatoId: selection.resultadoCandidatoId,
      versaoBiometriaId: selection.versaoBiometriaId,
      codigoTabua: selection.codigoTabua,
      nomeTabua: selection.nomeTabua,
      rotuloVersao: selection.rotuloVersao,
      posicaoCandidato: selection.posicaoCandidato,
      selecionadoEm: selection.selecionadoEm
    }))
  };
}

export async function listParametrizacaos(avaliacaoId: number) {
  return withSession(async (session) => {
    const rows = await selectFromEntity(ParametrizacaoAtuarial)
      .where(eq(parametrizacaoRef.avaliacaoId, avaliacaoId))
      .orderBy(parametrizacaoRef.versao, "DESC")
      .execute(session);
    return rows.map(summary);
  });
}

export async function getParametrizacao(id: string) {
  return withSession(async (session) => {
    const row = await session.find(ParametrizacaoAtuarial, id);
    return row ? detailInSession(session, row) : null;
  });
}

export async function createParametrizacao(
  avaliacaoId: number,
  input: { nome?: string; observacoes?: string | null; copiarDeId?: string }
) {
  return withSession(async (session) => {
    const evaluation = await session.find(Avaliacao, avaliacaoId);
    if (!evaluation) throw new Error("Avaliação não encontrada.");

    const existing = await selectFromEntity(ParametrizacaoAtuarial)
      .where(eq(parametrizacaoRef.avaliacaoId, avaliacaoId))
      .orderBy(parametrizacaoRef.versao, "DESC")
      .execute(session);
    const openDraft = existing.find((candidate) => candidate.situacao === "RASCUNHO");
    if (openDraft) {
      throw new Error(`Já existe a parametrização v${openDraft.versao} em rascunho. Aprove-a antes de criar outra versão.`);
    }
    const versao = (existing[0]?.versao ?? 0) + 1;

    let copyFrom: ParametrizacaoAtuarial | null = null;
    if (input.copiarDeId) {
      copyFrom = await session.find(ParametrizacaoAtuarial, input.copiarDeId);
      if (!copyFrom || copyFrom.avaliacaoId !== avaliacaoId) {
        throw new Error("A parametrização de origem não pertence a esta avaliação.");
      }
      if (copyFrom.situacao === "RASCUNHO") {
        throw new Error("Uma nova versão só pode copiar uma parametrização já consolidada.");
      }
    }

    const now = new Date().toISOString();
    const row = new ParametrizacaoAtuarial();
    row.id = randomUUID();
    row.avaliacaoId = avaliacaoId;
    row.versao = versao;
    row.nome = input.nome?.trim() || `Parametrização v${versao}`;
    row.situacao = "RASCUNHO";
    row.observacoes = normalizeOptional(input.observacoes);
    row.criadoEm = now;
    row.atualizadoEm = now;
    row.aprovadoEm = null;
    session.trackNew(tableOf(ParametrizacaoAtuarial), row, row.id);

    if (copyFrom) {
      const [sourceValues, sourceSelecaos] = await Promise.all([
        valuesFor(session, copyFrom.id),
        selectionsFor(session, copyFrom.id)
      ]);
      for (const origem of sourceValues) {
        const value = new ValorParametroAtuarial();
        value.id = randomUUID();
        value.parametrizacaoId = row.id;
        value.codigo = origem.codigo;
        value.categoria = origem.categoria;
        value.rotulo = origem.rotulo;
        value.tipoValor = origem.tipoValor;
        value.jsonValor = origem.jsonValor;
        value.unidade = origem.unidade ?? null;
        value.origem = origem.origem;
        value.ativo = 1;
        value.atualizadoEm = now;
        session.trackNew(tableOf(ValorParametroAtuarial), value, value.id);
      }
      for (const origem of sourceSelecaos) {
        const selection = new SelecaoHipoteseAtuarial();
        selection.id = randomUUID();
        selection.parametrizacaoId = row.id;
        selection.tipoHipotese = origem.tipoHipotese;
        selection.estudoAderenciaId = origem.estudoAderenciaId;
        selection.resultadoCandidatoId = origem.resultadoCandidatoId;
        selection.versaoBiometriaId = origem.versaoBiometriaId;
        selection.codigoTabua = origem.codigoTabua;
        selection.nomeTabua = origem.nomeTabua;
        selection.rotuloVersao = origem.rotuloVersao;
        selection.posicaoCandidato = origem.posicaoCandidato;
        selection.ativo = 1;
        selection.selecionadoEm = now;
        session.trackNew(tableOf(SelecaoHipoteseAtuarial), selection, selection.id);
      }
    }

    await session.commit();
    return detailInSession(session, row);
  });
}

export async function updateParametrizacaoMetadata(
  id: string,
  input: { nome?: string; observacoes?: string | null }
) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    if (input.nome !== undefined) {
      const nome = input.nome.trim();
      if (!nome) throw new Error("Nome da parametrização é obrigatório.");
      row.nome = nome;
    }
    if (input.observacoes !== undefined) row.observacoes = normalizeOptional(input.observacoes);
    row.atualizadoEm = new Date().toISOString();
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function setParameterValues(id: string, inputs: ParameterInput[]) {
  if (!inputs.length) throw new Error("Informe ao menos um parâmetro.");
  const normalized = inputs.map(validateValue);
  if (new Set(normalized.map((item) => item.codigo)).size !== normalized.length) {
    throw new Error("Existem códigos de parâmetros duplicados.");
  }

  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const existing = await allValuesFor(session, id);
    const byCode = new Map(existing.map((item) => [item.codigo, item]));
    const incomingCodes = new Set(normalized.map((item) => item.codigo));
    const now = new Date().toISOString();

    for (const stored of existing) {
      if (incomingCodes.has(stored.codigo) || stored.ativo === 0) continue;
      stored.ativo = 0;
      stored.atualizadoEm = now;
      session.markDirty(stored);
    }

    for (const input of normalized) {
      const stored = byCode.get(input.codigo);
      if (stored) {
        stored.categoria = input.categoria;
        stored.rotulo = input.rotulo;
        stored.tipoValor = input.tipoValor;
        stored.jsonValor = input.jsonValor;
        stored.unidade = input.unidade;
        stored.origem = input.origem;
        stored.ativo = 1;
        stored.atualizadoEm = now;
        session.markDirty(stored);
      } else {
        const value = new ValorParametroAtuarial();
        value.id = randomUUID();
        value.parametrizacaoId = id;
        value.codigo = input.codigo;
        value.categoria = input.categoria;
        value.rotulo = input.rotulo;
        value.tipoValor = input.tipoValor;
        value.jsonValor = input.jsonValor;
        value.unidade = input.unidade;
        value.origem = input.origem;
        value.ativo = 1;
        value.atualizadoEm = now;
        session.trackNew(tableOf(ValorParametroAtuarial), value, value.id);
      }
    }

    row.atualizadoEm = now;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function promoteAderenciaCandidato(id: string, resultadoCandidatoId: string) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const candidate = await session.find(ResultadoCandidatoAderencia, resultadoCandidatoId);
    if (!candidate) throw new Error("Resultado candidato de aderência não encontrado.");
    const study = await session.find(EstudoAderencia, candidate.estudoId);
    if (!study) throw new Error("Estudo de aderência não encontrado.");
    if (study.avaliacaoId === null || study.avaliacaoId === undefined) {
      study.avaliacaoId = row.avaliacaoId;
      session.markDirty(study);
    } else if (study.avaliacaoId !== row.avaliacaoId) {
      throw new Error("O estudo de aderência pertence a outra avaliação.");
    }

    const current = (await allSelecaosFor(session, id)).find(
      (selection) => selection.tipoHipotese === study.tipoHipotese
    );
    const now = new Date().toISOString();
    const selection = current ?? new SelecaoHipoteseAtuarial();
    if (!current) {
      selection.id = randomUUID();
      selection.parametrizacaoId = id;
    }
    selection.tipoHipotese = study.tipoHipotese;
    selection.estudoAderenciaId = study.id;
    selection.resultadoCandidatoId = candidate.id;
    selection.versaoBiometriaId = candidate.versaoBiometriaId;
    selection.codigoTabua = candidate.codigoTabua;
    selection.nomeTabua = candidate.nomeTabua;
    selection.rotuloVersao = candidate.rotuloVersao;
    selection.posicaoCandidato = candidate.rank;
    selection.ativo = 1;
    selection.selecionadoEm = now;

    if (current) session.markDirty(selection);
    else session.trackNew(tableOf(SelecaoHipoteseAtuarial), selection, selection.id);
    row.atualizadoEm = now;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function removeHipoteseSelecao(id: string, selecaoId: string) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const selection = await session.find(SelecaoHipoteseAtuarial, selecaoId);
    if (!selection || selection.parametrizacaoId !== id || selection.ativo === 0) {
      throw new Error("Hipótese selecionada não encontrada nesta parametrização.");
    }
    selection.ativo = 0;
    session.markDirty(selection);
    row.atualizadoEm = new Date().toISOString();
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

export async function approveParametrizacao(id: string) {
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
    const siblings = await selectFromEntity(ParametrizacaoAtuarial)
      .where(eq(parametrizacaoRef.avaliacaoId, row.avaliacaoId))
      .execute(session);
    for (const sibling of siblings) {
      if (sibling.id === row.id || sibling.situacao !== "APROVADO") continue;
      sibling.situacao = "SUBSTITUIDO";
      sibling.atualizadoEm = now;
      session.markDirty(sibling);
    }

    row.situacao = "APROVADO";
    row.aprovadoEm = now;
    row.atualizadoEm = now;
    session.markDirty(row);
    await session.commit();
    return detailInSession(session, row);
  });
}

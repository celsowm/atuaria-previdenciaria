import { randomUUID } from "node:crypto";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  TabuaBiometria,
  PontoTabuaBiometria,
  VersaoTabuaBiometria
} from "../domain/biometria-entities.js";

export type PontoBiometriaInput = {
  idade: number;
  sexo: "MASCULINO" | "FEMININO" | "UNISSEX";
  qx: number;
};

export type CreateTabuaBiometriaInput = {
  codigo: string;
  nome: string;
  tipo: string;
  escopoSexo: string;
  origem?: string;
  descricao?: string;
  versao?: string;
  vigenciaInicial?: string;
  pontos: PontoBiometriaInput[];
};

export type DeriveVersaoBiometriaInput = {
  versaoOrigemId: string;
  versao: string;
  transformacao: "QX_SCALE" | "AGE_SHIFT";
  fator?: number;
  anos?: number;
  vigenciaInicial?: string;
};

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableOf(entity: typeof TabuaBiometria | typeof VersaoTabuaBiometria | typeof PontoTabuaBiometria) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function validatePoints(pontos: PontoBiometriaInput[]) {
  if (!pontos.length) throw new Error("A tábua precisa possuir ao menos um ponto.");
  const seen = new Set<string>();
  for (const ponto of pontos) {
    if (!Number.isInteger(ponto.idade) || ponto.idade < 0 || ponto.idade > 130) {
      throw new Error(`Idade inválida: ${ponto.idade}.`);
    }
    if (!["MASCULINO", "FEMININO", "UNISSEX"].includes(ponto.sexo)) {
      throw new Error(`Sexo inválido na idade ${ponto.idade}: ${ponto.sexo}.`);
    }
    if (!Number.isFinite(ponto.qx) || ponto.qx < 0 || ponto.qx > 1) {
      throw new Error(`qx inválido na idade ${ponto.idade}: ${ponto.qx}.`);
    }
    const key = `${ponto.sexo}:${ponto.idade}`;
    if (seen.has(key)) throw new Error(`Ponto duplicado para ${ponto.sexo}, idade ${ponto.idade}.`);
    seen.add(key);
  }
}

function summarizeVersion(versao: VersaoTabuaBiometria) {
  return {
    id: versao.id,
    versao: versao.versao,
    situacao: versao.situacao,
    vigenciaInicial: versao.vigenciaInicial ?? null,
    vigenciaFinal: versao.vigenciaFinal ?? null,
    versaoOrigemId: versao.versaoOrigemId ?? null,
    tipoDerivacao: versao.tipoDerivacao ?? null,
    parametrosDerivacaoJson: versao.parametrosDerivacaoJson,
    idadeMinima: versao.idadeMinima,
    idadeMaxima: versao.idadeMaxima,
    quantidadePontos: versao.quantidadePontos,
    criadoEm: versao.criadoEm
  };
}

export async function createTabuaBiometria(input: CreateTabuaBiometriaInput) {
  const codigo = input.codigo.trim();
  const nome = input.nome.trim();
  if (!codigo || !nome) throw new Error("Código e nome da tábua são obrigatórios.");
  validatePoints(input.pontos);

  const existing = await withSession((session) => selectFromEntity(TabuaBiometria).execute(session));
  if (existing.some((item) => item.codigo.toUpperCase() === codigo.toUpperCase())) {
    throw new Error(`Já existe uma tábua com o código ${codigo}.`);
  }

  const now = new Date().toISOString();
  const table = new TabuaBiometria();
  table.id = randomUUID();
  table.codigo = codigo;
  table.nome = nome;
  table.tipo = input.tipo.trim();
  table.escopoSexo = input.escopoSexo.trim();
  table.origem = input.origem?.trim() || null;
  table.descricao = input.descricao?.trim() || null;
  table.habilitada = 1;
  table.criadoEm = now;
  table.atualizadoEm = now;

  const versao = new VersaoTabuaBiometria();
  versao.id = randomUUID();
  versao.tabuaId = table.id;
  versao.versao = input.versao?.trim() || "v1";
  versao.situacao = "ATIVO";
  versao.vigenciaInicial = input.vigenciaInicial?.trim() || null;
  versao.vigenciaFinal = null;
  versao.versaoOrigemId = null;
  versao.tipoDerivacao = null;
  versao.parametrosDerivacaoJson = "{}";
  versao.idadeMinima = Math.min(...input.pontos.map((ponto) => ponto.idade));
  versao.idadeMaxima = Math.max(...input.pontos.map((ponto) => ponto.idade));
  versao.quantidadePontos = input.pontos.length;
  versao.criadoEm = now;

  await withSession(async (session) => {
    session.trackNew(tableOf(TabuaBiometria), table, table.id);
    session.trackNew(tableOf(VersaoTabuaBiometria), versao, versao.id);
    for (const ponto of input.pontos) {
      const entity = new PontoTabuaBiometria();
      entity.id = randomUUID();
      entity.versaoId = versao.id;
      entity.idade = ponto.idade;
      entity.sexo = ponto.sexo;
      entity.qx = ponto.qx;
      session.trackNew(tableOf(PontoTabuaBiometria), entity, entity.id);
    }
    await session.commit();
  });

  return getTabuaBiometria(table.id);
}

export async function listTabuaBiometrias() {
  return withSession(async (session) => {
    const [tables, versions] = await Promise.all([
      selectFromEntity(TabuaBiometria).execute(session),
      selectFromEntity(VersaoTabuaBiometria).execute(session)
    ]);
    return tables
      .filter((table) => table.habilitada === 1)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((table) => {
        const ownVersions = versions
          .filter((versao) => versao.tabuaId === table.id)
          .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
        const latest = ownVersions[0];
        return {
          id: table.id,
          codigo: table.codigo,
          nome: table.nome,
          tipo: table.tipo,
          escopoSexo: table.escopoSexo,
          origem: table.origem ?? null,
          descricao: table.descricao ?? null,
          quantidadeVersoes: ownVersions.length,
          ultimaVersaoId: latest?.id ?? null,
          ultimaVersao: latest?.versao ?? null,
          quantidadePontos: latest?.quantidadePontos ?? 0,
          idadeMinima: latest?.idadeMinima ?? null,
          idadeMaxima: latest?.idadeMaxima ?? null,
          atualizadoEm: table.atualizadoEm
        };
      });
  });
}

export async function getTabuaBiometria(tabuaId: string) {
  return withSession(async (session) => {
    const table = await session.find(TabuaBiometria, tabuaId);
    if (!table) return null;
    const versions = (await selectFromEntity(VersaoTabuaBiometria).execute(session))
      .filter((versao) => versao.tabuaId === table.id)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    return {
      id: table.id,
      codigo: table.codigo,
      nome: table.nome,
      tipo: table.tipo,
      escopoSexo: table.escopoSexo,
      origem: table.origem ?? null,
      descricao: table.descricao ?? null,
          habilitada: table.habilitada === 1,
      criadoEm: table.criadoEm,
      atualizadoEm: table.atualizadoEm,
      versions: versions.map(summarizeVersion)
    };
  });
}

export async function getVersaoBiometriaPoints(versaoId: string) {
  return withSession(async (session) => {
    const versao = await session.find(VersaoTabuaBiometria, versaoId);
    if (!versao) return null;
    const pontos: PontoBiometriaInput[] = (await selectFromEntity(PontoTabuaBiometria).execute(session))
      .filter((ponto) => ponto.versaoId === versao.id)
      .sort((a, b) => a.sexo.localeCompare(b.sexo) || a.idade - b.idade)
      .map((ponto) => ({
        idade: ponto.idade,
        sexo: ponto.sexo as PontoBiometriaInput["sexo"],
        qx: Number(ponto.qx)
      }));
    return { versao: summarizeVersion(versao), pontos };
  });
}

export async function deriveVersaoBiometria(tabuaId: string, input: DeriveVersaoBiometriaInput) {
  const [table, parentBundle] = await Promise.all([
    withSession((session) => session.find(TabuaBiometria, tabuaId)),
    getVersaoBiometriaPoints(input.versaoOrigemId)
  ]);
  if (!table) throw new Error("Tábua não encontrada.");
  if (!parentBundle) throw new Error("Versão de origem não encontrada.");

  const parentVersion = await withSession((session) => session.find(VersaoTabuaBiometria, input.versaoOrigemId));
  if (!parentVersion || parentVersion.tabuaId !== table.id) {
    throw new Error("A versão de origem não pertence à tábua selecionada.");
  }

  const allVersions = await withSession((session) => selectFromEntity(VersaoTabuaBiometria).execute(session));
  if (allVersions.some((versao) => versao.tabuaId === table.id && versao.versao.toUpperCase() === input.versao.trim().toUpperCase())) {
    throw new Error(`A versão ${input.versao} já existe nesta tábua.`);
  }

  let derived: PontoBiometriaInput[];
  let parametros: Record<string, number>;
  if (input.transformacao === "QX_SCALE") {
    const fator = input.fator;
    if (fator === undefined || !Number.isFinite(fator) || fator <= 0 || fator > 5) {
      throw new Error("fator deve ser maior que zero e menor ou igual a 5.");
    }
    derived = parentBundle.pontos.map((ponto) => ({
      idade: ponto.idade,
      sexo: ponto.sexo,
      qx: Math.min(1, Math.max(0, ponto.qx * fator))
    }));
    parametros = { fator };
  } else {
    const anos = input.anos;
    if (anos === undefined || !Number.isInteger(anos) || anos < -20 || anos > 20) {
      throw new Error("anos deve ser um inteiro entre -20 e 20.");
    }
    const bySexAge = new Map(parentBundle.pontos.map((ponto) => [`${ponto.sexo}:${ponto.idade}`, ponto]));
    derived = parentBundle.pontos.flatMap((ponto) => {
      const origem = bySexAge.get(`${ponto.sexo}:${ponto.idade + anos}`);
      return origem ? [{ idade: ponto.idade, sexo: ponto.sexo, qx: origem.qx }] : [];
    });
    parametros = { anos };
  }
  validatePoints(derived);

  const now = new Date().toISOString();
  const versao = new VersaoTabuaBiometria();
  versao.id = randomUUID();
  versao.tabuaId = table.id;
  versao.versao = input.versao.trim();
  versao.situacao = "ATIVO";
  versao.vigenciaInicial = input.vigenciaInicial?.trim() || null;
  versao.vigenciaFinal = null;
  versao.versaoOrigemId = parentVersion.id;
  versao.tipoDerivacao = input.transformacao;
  versao.parametrosDerivacaoJson = JSON.stringify(parametros);
  versao.idadeMinima = Math.min(...derived.map((ponto) => ponto.idade));
  versao.idadeMaxima = Math.max(...derived.map((ponto) => ponto.idade));
  versao.quantidadePontos = derived.length;
  versao.criadoEm = now;

  await withSession(async (session) => {
    session.trackNew(tableOf(VersaoTabuaBiometria), versao, versao.id);
    for (const ponto of derived) {
      const entity = new PontoTabuaBiometria();
      entity.id = randomUUID();
      entity.versaoId = versao.id;
      entity.idade = ponto.idade;
      entity.sexo = ponto.sexo;
      entity.qx = ponto.qx;
      session.trackNew(tableOf(PontoTabuaBiometria), entity, entity.id);
    }
    const storedTable = await session.find(TabuaBiometria, table.id);
    if (storedTable) storedTable.atualizadoEm = now;
    await session.commit();
  });

  return getVersaoBiometriaPoints(versao.id);
}

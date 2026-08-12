import { randomUUID } from "node:crypto";
import { entityRef, eq, selectFromEntity } from "metal-orm";
import { createSession, executarSql } from "../db.js";
import { Plano } from "../domain/plano-entities.js";
import { ValorRegraPlano, VersaoRegrasPlano } from "../domain/regras-plano-entities.js";
import { calculateRegrasPlanoFingerprint, compareRegraPlanoCode } from "./regras-plano-fingerprint.js";

const versionRef = entityRef(VersaoRegrasPlano);
const valueRef = entityRef(ValorRegraPlano);
const tipoValors = new Set(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"]);

type Session = ReturnType<typeof createSession>;
type RuleInput = {
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

async function findVersao(session: Session, id: string) {
  const rows = await selectFromEntity(VersaoRegrasPlano)
    .where(eq(versionRef.id, id))
    .limit(1)
    .execute(session);
  return (rows[0] as VersaoRegrasPlano | undefined) ?? null;
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizeDate(value: string | null | undefined) {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`Data inválida: ${normalized}.`);
  const [ano, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(ano, month - 1, day));
  if (
    date.getUTCFullYear() !== ano ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Data inválida: ${normalized}.`);
  }
  return normalized;
}

function validatePeriod(vigenciaInicial: string | null, vigenciaFinal: string | null) {
  if (vigenciaInicial && vigenciaFinal && vigenciaFinal < vigenciaInicial) {
    throw new Error("A data final de vigência não pode ser anterior à data inicial.");
  }
}

function validateRule(input: RuleInput) {
  const codigo = normalizeCode(input.codigo);
  const categoria = input.categoria.trim();
  const rotulo = input.rotulo.trim();
  const tipoValor = input.tipoValor.trim().toUpperCase();
  if (!codigo) throw new Error("Código da regra é obrigatório.");
  if (!categoria) throw new Error(`Categoria da regra ${codigo} é obrigatória.`);
  if (!rotulo) throw new Error(`Rótulo da regra ${codigo} é obrigatório.`);
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
    origem: normalizeOptional(input.origem) ?? "PLAN_REGULATION"
  };
}

async function allValuesFor(session: Session, versaoRegrasPlanoId: string) {
  const rows = await selectFromEntity(ValorRegraPlano)
    .where(eq(valueRef.versaoRegrasPlanoId, versaoRegrasPlanoId))
    .execute(session);
  return rows as ValorRegraPlano[];
}

async function valuesFor(session: Session, versaoRegrasPlanoId: string) {
  const rows = await allValuesFor(session, versaoRegrasPlanoId);
  return rows
    .filter((row) => row.ativo !== 0)
    .sort(compareRegraPlanoCode);
}

async function requireDraft(session: Session, id: string) {
  const versao = await findVersao(session, id);
  if (!versao) throw new Error("Versão de regras do plano não encontrada.");
  if (versao.situacao !== "RASCUNHO") {
    throw new Error("Somente uma versão de regras em rascunho pode ser alterada.");
  }
  return versao;
}

function summary(row: VersaoRegrasPlano) {
  return {
    id: row.id,
    planoId: row.planoId,
    versao: row.versao,
    nome: row.nome,
    modalidade: row.modalidade,
    situacao: row.situacao,
    vigenciaInicial: row.vigenciaInicial ?? null,
    vigenciaFinal: row.vigenciaFinal ?? null,
    impressaoDigitalRegras: row.impressaoDigitalRegras ?? null,
    observacoes: row.observacoes ?? null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    aprovadoEm: row.aprovadoEm ?? null
  };
}

async function detailInSession(session: Session, row: VersaoRegrasPlano) {
  const rules = await valuesFor(session, row.id);
  return {
    ...summary(row),
    regras: rules.map((value) => ({
      id: value.id,
      codigo: value.codigo,
      categoria: value.categoria,
      rotulo: value.rotulo,
      tipoValor: value.tipoValor,
      jsonValor: value.jsonValor,
      unidade: value.unidade ?? null,
      origem: value.origem,
      atualizadoEm: value.atualizadoEm
    }))
  };
}

export async function listVersaoRegrasPlanos(planoId: string) {
  return withSession(async (session) => {
    const plan = await session.find(Plano, planoId);
    if (!plan) throw new Error("Plano não encontrado.");
    const rows = await selectFromEntity(VersaoRegrasPlano)
      .where(eq(versionRef.planoId, planoId))
      .orderBy(versionRef.versao, "DESC")
      .execute(session);
    return rows.map(summary);
  });
}

export async function getVersaoRegrasPlano(id: string) {
  return withSession(async (session) => {
    const row = await findVersao(session, id);
    return row ? detailInSession(session, row) : null;
  });
}

export async function createVersaoRegrasPlano(
  planoId: string,
  input: {
    nome?: string;
    vigenciaInicial?: string | null;
    vigenciaFinal?: string | null;
    observacoes?: string | null;
    copiarDeId?: string;
  }
) {
  return withSession(async (session) => {
    const plan = await session.find(Plano, planoId);
    if (!plan) throw new Error("Plano não encontrado.");

    const existing = await selectFromEntity(VersaoRegrasPlano)
      .where(eq(versionRef.planoId, planoId))
      .orderBy(versionRef.versao, "DESC")
      .execute(session);
    if (existing.some((versao) => versao.situacao === "RASCUNHO")) {
      throw new Error("O plano já possui uma versão de regras em rascunho.");
    }

    let copyFrom: VersaoRegrasPlano | null = null;
    if (input.copiarDeId) {
      copyFrom = await findVersao(session, input.copiarDeId);
      if (!copyFrom || copyFrom.planoId !== planoId) {
        throw new Error("A versão de origem não pertence a este plano.");
      }
      if (copyFrom.modalidade !== plan.modalidade) {
        throw new Error("Não é permitido copiar regras de uma modalidade diferente da modalidade atual do plano.");
      }
    }

    const versionNumber = (existing[0]?.versao ?? 0) + 1;
    const vigenciaInicial = input.vigenciaInicial !== undefined ? normalizeDate(input.vigenciaInicial) : null;
    const vigenciaFinal = input.vigenciaFinal !== undefined ? normalizeDate(input.vigenciaFinal) : null;
    validatePeriod(vigenciaInicial, vigenciaFinal);

    const now = new Date().toISOString();
    const row = new VersaoRegrasPlano();
    row.id = randomUUID();
    row.planoId = planoId;
    row.versao = versionNumber;
    row.nome = input.nome?.trim() || `Regras do plano v${versionNumber}`;
    row.modalidade = plan.modalidade;
    row.situacao = "RASCUNHO";
    row.vigenciaInicial = vigenciaInicial;
    row.vigenciaFinal = vigenciaFinal;
    row.impressaoDigitalRegras = null;
    row.observacoes = input.observacoes !== undefined ? normalizeOptional(input.observacoes) : copyFrom?.observacoes ?? null;
    row.criadoEm = now;
    row.atualizadoEm = now;
    row.aprovadoEm = null;
    await executarSql(
      "INSERT INTO versoes_regras_plano (id, plano_id, versao, nome, modalidade, situacao, vigencia_inicial, vigencia_final, impressao_digital_regras, observacoes, criado_em, atualizado_em, aprovado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [row.id, row.planoId, row.versao, row.nome, row.modalidade, row.situacao, row.vigenciaInicial, row.vigenciaFinal, row.impressaoDigitalRegras, row.observacoes, row.criadoEm, row.atualizadoEm, row.aprovadoEm]
    );

    if (copyFrom) {
      const sourceValues = await valuesFor(session, copyFrom.id);
      for (const origem of sourceValues) {
        const value = new ValorRegraPlano();
        value.id = randomUUID();
        value.versaoRegrasPlanoId = row.id;
        value.codigo = origem.codigo;
        value.categoria = origem.categoria;
        value.rotulo = origem.rotulo;
        value.tipoValor = origem.tipoValor;
        value.jsonValor = origem.jsonValor;
        value.unidade = origem.unidade ?? null;
        value.origem = origem.origem;
        value.ativo = 1;
        value.atualizadoEm = now;
        await executarSql(
          "INSERT INTO valores_regras_plano (id, versao_regras_plano_id, codigo, categoria, rotulo, tipo_valor, json_valor, unidade, origem, ativo, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [value.id, value.versaoRegrasPlanoId, value.codigo, value.categoria, value.rotulo, value.tipoValor, value.jsonValor, value.unidade, value.origem, value.ativo, value.atualizadoEm]
        );
      }
    }

    return detailInSession(session, row);
  });
}

export async function updateRegrasPlanoMetadata(
  id: string,
  input: {
    nome?: string;
    vigenciaInicial?: string | null;
    vigenciaFinal?: string | null;
    observacoes?: string | null;
  }
) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    if (input.nome !== undefined) {
      const nome = input.nome.trim();
      if (!nome) throw new Error("Nome da versão de regras é obrigatório.");
      row.nome = nome;
    }
    if (input.vigenciaInicial !== undefined) row.vigenciaInicial = normalizeDate(input.vigenciaInicial);
    if (input.vigenciaFinal !== undefined) row.vigenciaFinal = normalizeDate(input.vigenciaFinal);
    validatePeriod(row.vigenciaInicial ?? null, row.vigenciaFinal ?? null);
    if (input.observacoes !== undefined) row.observacoes = normalizeOptional(input.observacoes);
    row.atualizadoEm = new Date().toISOString();
    row.impressaoDigitalRegras = null;
    await executarSql(
      "UPDATE versoes_regras_plano SET nome = ?, vigencia_inicial = ?, vigencia_final = ?, observacoes = ?, atualizado_em = ?, impressao_digital_regras = ? WHERE id = ?",
      [row.nome, row.vigenciaInicial, row.vigenciaFinal, row.observacoes, row.atualizadoEm, row.impressaoDigitalRegras, row.id]
    );
    return detailInSession(session, row);
  });
}

export async function setValorRegraPlanos(id: string, inputs: RuleInput[]) {
  const normalized = inputs.map(validateRule);
  if (new Set(normalized.map((item) => item.codigo)).size !== normalized.length) {
    throw new Error("Existem códigos de regras duplicados.");
  }

  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const existing = await allValuesFor(session, id);
    const byCode = new Map(existing.map((item) => [item.codigo, item]));
    const activeCodes = new Set(normalized.map((item) => item.codigo));
    const now = new Date().toISOString();

    for (const stored of existing) {
      if (stored.ativo !== 0 && !activeCodes.has(stored.codigo)) {
        stored.ativo = 0;
        stored.atualizadoEm = now;
        await executarSql(
          "UPDATE valores_regras_plano SET ativo = ?, atualizado_em = ? WHERE id = ?",
          [stored.ativo, stored.atualizadoEm, stored.id]
        );
      }
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
        await executarSql(
          "UPDATE valores_regras_plano SET categoria = ?, rotulo = ?, tipo_valor = ?, json_valor = ?, unidade = ?, origem = ?, ativo = ?, atualizado_em = ? WHERE id = ?",
          [stored.categoria, stored.rotulo, stored.tipoValor, stored.jsonValor, stored.unidade, stored.origem, stored.ativo, stored.atualizadoEm, stored.id]
        );
      } else {
        const value = new ValorRegraPlano();
        value.id = randomUUID();
        value.versaoRegrasPlanoId = id;
        value.codigo = input.codigo;
        value.categoria = input.categoria;
        value.rotulo = input.rotulo;
        value.tipoValor = input.tipoValor;
        value.jsonValor = input.jsonValor;
        value.unidade = input.unidade;
        value.origem = input.origem;
        value.ativo = 1;
        value.atualizadoEm = now;
        await executarSql(
          "INSERT INTO valores_regras_plano (id, versao_regras_plano_id, codigo, categoria, rotulo, tipo_valor, json_valor, unidade, origem, ativo, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [value.id, value.versaoRegrasPlanoId, value.codigo, value.categoria, value.rotulo, value.tipoValor, value.jsonValor, value.unidade, value.origem, value.ativo, value.atualizadoEm]
        );
      }
    }

    row.atualizadoEm = now;
    row.impressaoDigitalRegras = null;
    await executarSql(
      "UPDATE versoes_regras_plano SET atualizado_em = ?, impressao_digital_regras = ? WHERE id = ?",
      [row.atualizadoEm, row.impressaoDigitalRegras, row.id]
    );
    return detailInSession(session, row);
  });
}

export async function approveVersaoRegrasPlano(id: string) {
  return withSession(async (session) => {
    const row = await requireDraft(session, id);
    const rules = await valuesFor(session, id);
    if (!row.vigenciaInicial) {
      throw new Error("Informe a data inicial de vigência antes de aprovar as regras do plano.");
    }
    validatePeriod(row.vigenciaInicial, row.vigenciaFinal ?? null);
    if (!rules.length) throw new Error("Não é possível aprovar uma versão de regras vazia.");

    const fingerprint = calculateRegrasPlanoFingerprint({
      planoId: row.planoId,
      versao: row.versao,
      modalidade: row.modalidade,
      vigenciaInicial: row.vigenciaInicial,
      vigenciaFinal: row.vigenciaFinal ?? null,
      rules: rules.map((rule) => ({
        codigo: rule.codigo,
        categoria: rule.categoria,
        rotulo: rule.rotulo,
        tipoValor: rule.tipoValor,
        jsonValor: rule.jsonValor,
        unidade: rule.unidade ?? null,
        origem: rule.origem
      }))
    });

    const now = new Date().toISOString();
    const siblings = await selectFromEntity(VersaoRegrasPlano)
      .where(eq(versionRef.planoId, row.planoId))
      .execute(session);
    for (const sibling of siblings) {
      if (sibling.id === row.id || sibling.situacao !== "APROVADO") continue;
      sibling.situacao = "SUBSTITUIDO";
      sibling.atualizadoEm = now;
      await executarSql(
        "UPDATE versoes_regras_plano SET situacao = ?, atualizado_em = ? WHERE id = ?",
        [sibling.situacao, sibling.atualizadoEm, sibling.id]
      );
    }

    row.situacao = "APROVADO";
    row.impressaoDigitalRegras = fingerprint;
    row.aprovadoEm = now;
    row.atualizadoEm = now;
    await executarSql(
      "UPDATE versoes_regras_plano SET situacao = ?, impressao_digital_regras = ?, aprovado_em = ?, atualizado_em = ? WHERE id = ?",
      [row.situacao, row.impressaoDigitalRegras, row.aprovadoEm, row.atualizadoEm, row.id]
    );
    return detailInSession(session, row);
  });
}

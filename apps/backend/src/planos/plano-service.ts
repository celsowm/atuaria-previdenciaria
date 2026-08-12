import { randomUUID } from "node:crypto";
import { entityRef, eq, selectFromEntity } from "metal-orm";
import { createSession, executarSql, consultarSql } from "../db.js";
import { Plano } from "../domain/plano-entities.js";
import { EntidadePrevidencia } from "../domain/previdencia-entities.js";

const planRef = entityRef(Plano);
const modalities = new Set(["BD", "CD", "CV"]);
const situacaoes = new Set(["ATIVO", "INATIVO", "ENCERRADO"]);

type Session = ReturnType<typeof createSession>;

async function withSession<T>(handler: (session: Session) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateModality(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!modalities.has(normalized)) throw new Error("Modalidade deve ser BD, CD ou CV.");
  return normalized;
}

function validateStatus(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!situacaoes.has(normalized)) throw new Error("Status deve ser ATIVO, INATIVO ou ENCERRADO.");
  return normalized;
}

export async function listarPlanos() {
  return withSession((session) =>
    selectFromEntity(Plano).orderBy(planRef.$.nome, "ASC").execute(session)
  );
}

export async function obterPlano(id: string) {
  return withSession(async (session) => {
    const rows = await selectFromEntity(Plano).where(eq(planRef.id, id)).limit(1).execute(session);
    return rows[0] ?? null;
  });
}

export async function criarPlano(input: {
  entidadePrevidenciaId: string;
  codigo: string;
  nome: string;
  modalidade: string;
  nomePatrocinador?: string;
  cnpj?: string;
}) {
  const codigo = normalizeCode(input.codigo);
  const nome = input.nome.trim();
  if (!codigo) throw new Error("Código do plano é obrigatório.");
  if (!nome) throw new Error("Nome do plano é obrigatório.");

  return withSession(async (session) => {
    const entidade = await session.find(EntidadePrevidencia, input.entidadePrevidenciaId);
    if (!entidade || entidade.situacao !== "ATIVA") throw new Error("Entidade de previdência inválida ou inativa.");
    const existing = await selectFromEntity(Plano).where(eq(planRef.codigo, codigo)).execute(session);
    if (existing.length > 0) throw new Error("Já existe um plano com este código.");

    const now = new Date().toISOString();
    const plan = new Plano();
    plan.id = randomUUID();
    plan.entidadePrevidenciaId = input.entidadePrevidenciaId;
    plan.codigo = codigo;
    plan.nome = nome;
    plan.modalidade = validateModality(input.modalidade);
    plan.nomePatrocinador = normalizeOptional(input.nomePatrocinador);
    plan.cnpj = normalizeOptional(input.cnpj);
    plan.situacao = "ATIVO";
    plan.criadoEm = now;
    plan.atualizadoEm = now;

    await executarSql("INSERT INTO planos (id, entidade_previdencia_id, codigo, nome, modalidade, nome_patrocinador, cnpj, situacao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [plan.id, plan.entidadePrevidenciaId, plan.codigo, plan.nome, plan.modalidade, plan.nomePatrocinador ?? null, plan.cnpj ?? null, plan.situacao, plan.criadoEm, plan.atualizadoEm]);
    return plan;
  });
}

export async function atualizarPlano(id: string, input: {
  codigo?: string;
  nome?: string;
  modalidade?: string;
  nomePatrocinador?: string | null;
  cnpj?: string | null;
  situacao?: string;
}) {
  return withSession(async (session) => {
    const plan = await session.find(Plano, id);
    if (!plan) return null;

    if (input.codigo !== undefined) {
      const codigo = normalizeCode(input.codigo);
      if (!codigo) throw new Error("Código do plano é obrigatório.");
      const duplicate = await selectFromEntity(Plano).where(eq(planRef.codigo, codigo)).execute(session);
      if (duplicate.some((candidate) => candidate.id !== id)) {
        throw new Error("Já existe um plano com este código.");
      }
      plan.codigo = codigo;
    }
    if (input.nome !== undefined) {
      const nome = input.nome.trim();
      if (!nome) throw new Error("Nome do plano é obrigatório.");
      plan.nome = nome;
    }
    if (input.modalidade !== undefined) {
      const modalidade = validateModality(input.modalidade);
      if (modalidade !== plan.modalidade) {
        const versoesAprovadas = await consultarSql<{ id: string }>(
          "SELECT id FROM versoes_regras_plano WHERE plano_id = ? AND situacao IN (?, ?) LIMIT 1",
          [plan.id, "APROVADO", "SUBSTITUIDO"]
        );
        if (versoesAprovadas.length) {
          throw new Error("A modalidade não pode ser alterada após a aprovação das regras do plano.");
        }
      }
      plan.modalidade = modalidade;
    }
    if (input.nomePatrocinador !== undefined) plan.nomePatrocinador = normalizeOptional(input.nomePatrocinador);
    if (input.cnpj !== undefined) plan.cnpj = normalizeOptional(input.cnpj);
    if (input.situacao !== undefined) plan.situacao = validateStatus(input.situacao);
    plan.atualizadoEm = new Date().toISOString();

    await executarSql(
      "UPDATE planos SET codigo = ?, nome = ?, modalidade = ?, nome_patrocinador = ?, cnpj = ?, situacao = ?, atualizado_em = ? WHERE id = ?",
      [plan.codigo, plan.nome, plan.modalidade, plan.nomePatrocinador, plan.cnpj, plan.situacao, plan.atualizadoEm, plan.id]
    );
    return plan;
  });
}

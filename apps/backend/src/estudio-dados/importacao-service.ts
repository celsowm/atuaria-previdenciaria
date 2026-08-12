import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { UploadedFileInfo } from "adorn-api";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  Avaliacao,
  ArquivoImportacao,
  ImportacaoJob,
  LinhaImportacao,
  PerfilMapeamento,
  RegraMapeamento
} from "../domain/entities.js";
import { Submassa } from "../domain/previdencia-entities.js";
import { storageRootPath } from "../runtime-paths.js";
import {
  compareHeaders,
  fingerprintHeaders,
  fingerprintRules,
  normalizeSourceRow,
  parseWorkbookBuffer,
  rowToObject,
  toCanonicalRow,
  validateCanonicalRow,
  type RegraMapeamentoInput
} from "./mapeamento.js";

type ImportacaoOptions = {
  avaliacaoId?: number;
  submassaId: string;
  populacao: string;
  perfilMapeamentoId?: number;
  nomePerfil?: string;
  savePerfil: boolean;
  nomeAba?: string;
  linhaCabecalho: number;
  regras: RegraMapeamentoInput[];
};

export type ImportacaoResult = {
  id: string;
  arquivoId: string;
  perfilMapeamentoId: number | null;
  versaoPerfilMapeamento: string | null;
  nomeArquivo: string;
  arquivoSha256: string;
  populacao: string;
  nomeAba: string;
  quantidadeLinhas: number;
  linhasValidas: number;
  linhasInvalidas: number;
  situacao: string;
};

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function requireTable(entity: typeof PerfilMapeamento | typeof RegraMapeamento | typeof ArquivoImportacao | typeof ImportacaoJob | typeof LinhaImportacao) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function parsePerfilVersion(versao: string) {
  const match = /^v(\d+)$/i.exec(versao.trim());
  return match ? Number(match[1]) : 0;
}

async function loadRules(perfilMapeamentoId: number) {
  return withSession(async (session) => {
    const rows = await selectFromEntity(RegraMapeamento).execute(session);
    return rows
      .filter((row) => row.perfilMapeamentoId === perfilMapeamentoId)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map<RegraMapeamentoInput>((row) => ({
        sources: JSON.parse(row.jsonOrigens) as string[],
        targets: JSON.parse(row.jsonDestinos) as string[],
        transform: row.transform as RegraMapeamentoInput["transform"]
      }));
  });
}

export async function matchPerfilMapeamento(headers: string[], populacao: string) {
  const perfils = await withSession((session) => selectFromEntity(PerfilMapeamento).execute(session));
  const candidates = perfils
    .filter((perfil) => perfil.populacao === populacao && perfil.jsonCabecalhosOrigem)
    .map((perfil) => {
      const perfilHeaders = JSON.parse(perfil.jsonCabecalhosOrigem ?? "[]") as string[];
      return { perfil, perfilHeaders, ...compareHeaders(headers, perfilHeaders) };
    })
    .sort((a, b) => b.compatibility - a.compatibility || b.perfil.atualizadoEm.localeCompare(a.perfil.atualizadoEm));

  const best = candidates[0];
  if (!best || best.compatibility < 50) {
    return {
      matched: false,
      compatibility: 0,
      exact: false,
      missingColumns: [] as string[],
      newColumns: [] as string[],
      regrasJson: "[]"
    };
  }

  const regras = await loadRules(best.perfil.id);
  return {
    matched: true,
    perfilMapeamentoId: best.perfil.id,
    nomePerfil: best.perfil.nome,
    versao: best.perfil.versao,
    compatibility: best.compatibility,
    exact: best.exact,
    missingColumns: best.missingColumns,
    newColumns: best.newColumns,
    regrasJson: JSON.stringify(regras)
  };
}

async function resolvePerfil(
  options: ImportacaoOptions,
  headers: string[],
  impressaoDigitalEsquema: string
): Promise<PerfilMapeamento | null> {
  if (!options.savePerfil && !options.perfilMapeamentoId) return null;

  const impressaoDigitalRegras = fingerprintRules(options.regras);
  const perfils = await withSession((session) => selectFromEntity(PerfilMapeamento).execute(session));
  const requested = options.perfilMapeamentoId
    ? perfils.find((perfil) => perfil.id === options.perfilMapeamentoId)
    : undefined;
  const reusable = perfils.find(
    (perfil) =>
      perfil.populacao === options.populacao &&
      perfil.impressaoDigitalEsquema === impressaoDigitalEsquema &&
      perfil.impressaoDigitalRegras === impressaoDigitalRegras
  );
  if (reusable) return reusable;
  if (!options.savePerfil) return requested ?? null;

  const nome = options.nomePerfil?.trim() || requested?.nome || `${options.populacao} mapping`;
  const siblings = perfils.filter(
    (perfil) => perfil.populacao === options.populacao && perfil.nome === nome
  );
  const versao = `v${Math.max(0, ...siblings.map((perfil) => parsePerfilVersion(perfil.versao))) + 1}`;
  const perfil = new PerfilMapeamento();
  perfil.id = Math.max(0, ...perfils.map((item) => item.id)) + 1;
  perfil.nome = nome;
  perfil.populacao = options.populacao;
  perfil.versao = versao;
  perfil.impressaoDigitalEsquema = impressaoDigitalEsquema;
  perfil.impressaoDigitalRegras = impressaoDigitalRegras;
  perfil.jsonCabecalhosOrigem = JSON.stringify(headers);
  perfil.camposMapeados = new Set(options.regras.flatMap((rule) => rule.targets)).size;
  perfil.quantidadeCampos = headers.length;
  perfil.atualizadoEm = new Date().toISOString();

  await withSession(async (session) => {
    session.trackNew(requireTable(PerfilMapeamento), perfil, perfil.id);
    await session.commit();
  });

  await withSession(async (session) => {
    const table = requireTable(RegraMapeamento);
    for (const [index, input] of options.regras.entries()) {
      const rule = new RegraMapeamento();
      rule.id = randomUUID();
      rule.perfilMapeamentoId = perfil.id;
      rule.ordinal = index;
      rule.jsonOrigens = JSON.stringify(input.sources);
      rule.jsonDestinos = JSON.stringify(input.targets);
      rule.transform = input.transform;
      session.trackNew(table, rule, rule.id);
    }
    await session.commit();
  });

  return perfil;
}

async function uploadedBuffer(file: UploadedFileInfo) {
  if (file.buffer) return file.buffer;
  if (file.path) return readFile(file.path);
  throw new Error("O upload não possui buffer nem caminho temporário.");
}

function safeName(nome: string) {
  return basename(nome).replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function markJobFailed(jobId: string) {
  await withSession(async (session) => {
    const job = await session.find(ImportacaoJob, jobId);
    if (!job) return;
    job.situacao = "FALHO";
    job.concluidoEm = new Date().toISOString();
    session.markDirty(job);
    await session.commit();
  });
}

export async function persistImportacao(file: UploadedFileInfo, options: ImportacaoOptions): Promise<ImportacaoResult> {
  await withSession(async (session) => {
    const submassa = await session.find(Submassa, options.submassaId);
    if (!submassa || submassa.situacao !== "APROVADA") throw new Error("A importação exige uma submassa aprovada.");
    if (!options.avaliacaoId) return;
    const avaliacao = await session.find(Avaliacao, options.avaliacaoId);
    if (!avaliacao) throw new Error("Avaliação não encontrada.");
    if (avaliacao.planoId !== submassa.planoId || avaliacao.submassaId !== submassa.id) {
      throw new Error("A submassa informada não corresponde à avaliação.");
    }
    if (avaliacao.dataReferencia < submassa.vigenciaInicial || (submassa.vigenciaFinal && avaliacao.dataReferencia > submassa.vigenciaFinal)) {
      throw new Error("A submassa não está vigente na data-base da avaliação.");
    }
  });
  const buffer = await uploadedBuffer(file);
  const parsed = parseWorkbookBuffer(buffer, {
    nomeAba: options.nomeAba,
    linhaCabecalho: options.linhaCabecalho
  });
  const impressaoDigitalEsquema = fingerprintHeaders(parsed.headers);
  const perfil = await resolvePerfil(options, parsed.headers, impressaoDigitalEsquema);

  const arquivoId = randomUUID();
  const jobId = randomUUID();
  const arquivoSha256 = createHash("sha256").update(buffer).digest("hex");
  const storageRoot = storageRootPath();
  const relativePath = join("imports", arquivoId, safeName(file.originalName));
  const absolutePath = join(storageRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const criadoEm = new Date().toISOString();
  const sourceFile = new ArquivoImportacao();
  sourceFile.id = arquivoId;
  sourceFile.nomeOriginal = file.originalName;
  sourceFile.mimeType = file.mimeType || "application/octet-stream";
  sourceFile.tamanhoBytes = file.size;
  sourceFile.sha256 = arquivoSha256;
  sourceFile.caminhoArmazenamento = relativePath;
  sourceFile.criadoEm = criadoEm;

  const job = new ImportacaoJob();
  job.id = jobId;
  job.avaliacaoId = options.avaliacaoId ?? null;
  job.submassaId = options.submassaId;
  job.arquivoId = arquivoId;
  job.perfilMapeamentoId = perfil?.id ?? null;
  job.populacao = options.populacao;
  job.nomeAba = parsed.nomeAba;
  job.linhaCabecalho = options.linhaCabecalho;
  job.jsonCabecalhosOrigem = JSON.stringify(parsed.headers);
  job.impressaoDigitalEsquema = impressaoDigitalEsquema;
  job.situacao = "PROCESSANDO";
  job.quantidadeLinhas = parsed.rows.length;
  job.linhasValidas = 0;
  job.linhasInvalidas = 0;
  job.criadoEm = criadoEm;
  job.concluidoEm = null;

  await withSession(async (session) => {
    session.trackNew(requireTable(ArquivoImportacao), sourceFile, sourceFile.id);
    session.trackNew(requireTable(ImportacaoJob), job, job.id);
    await session.commit();
  });

  let linhasValidas = 0;
  let linhasInvalidas = 0;
  const batchSize = 250;

  try {
    for (let offset = 0; offset < parsed.rows.length; offset += batchSize) {
      const batch = parsed.rows.slice(offset, offset + batchSize);
      await withSession(async (session) => {
        const table = requireTable(LinhaImportacao);
        for (const [batchIndex, sourceRow] of batch.entries()) {
          const raw = rowToObject(parsed.headers, sourceRow);
          const normalized = normalizeSourceRow(raw);
          const canonical = toCanonicalRow(normalized, options.regras);
          const validationErrors = validateCanonicalRow(canonical);
          if (validationErrors.length) linhasInvalidas += 1;
          else linhasValidas += 1;

          const row = new LinhaImportacao();
          row.id = randomUUID();
          row.importacaoId = jobId;
          row.numeroLinha = options.linhaCabecalho + offset + batchIndex + 1;
          row.jsonBruto = JSON.stringify(raw);
          row.jsonNormalizado = JSON.stringify(normalized);
          row.jsonCanonico = JSON.stringify(canonical);
          row.situacaoValidacao = validationErrors.length ? "INVALID" : "VALID";
          row.jsonErrosValidacao = JSON.stringify(validationErrors);
          session.trackNew(table, row, row.id);
        }
        await session.commit();
      });
    }

    await withSession(async (session) => {
      const storedJob = await session.find(ImportacaoJob, jobId);
      if (!storedJob) throw new Error(`Importacao job ${jobId} desapareceu durante o processamento.`);
      storedJob.situacao = "CONCLUIDO";
      storedJob.linhasValidas = linhasValidas;
      storedJob.linhasInvalidas = linhasInvalidas;
      storedJob.concluidoEm = new Date().toISOString();
      session.markDirty(storedJob);
      await session.commit();
    });
  } catch (error) {
    await markJobFailed(jobId);
    throw error;
  }

  return {
    id: jobId,
    arquivoId,
    perfilMapeamentoId: perfil?.id ?? null,
    versaoPerfilMapeamento: perfil?.versao ?? null,
    nomeArquivo: file.originalName,
    arquivoSha256,
    populacao: options.populacao,
    nomeAba: parsed.nomeAba,
    quantidadeLinhas: parsed.rows.length,
    linhasValidas,
    linhasInvalidas,
    situacao: "CONCLUIDO"
  };
}

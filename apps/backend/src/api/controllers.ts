import {
  Auth,
  Body,
  Controller,
  Get,
  HttpError,
  Params,
  Patch,
  Post,
  Public,
  Returns,
  UploadedFile,
  t,
  type RequestContext,
  type UploadedFileInfo
} from "adorn-api";
import { entityRef, selectFromEntity } from "metal-orm";
import { APPLICATION_SLUG, getPublicApplicationConfig } from "../application-config.js";
import { createSession } from "../db.js";
import { Avaliacao, ProvedorLlm, CredencialProvedorLlm, PerfilMapeamento } from "../domain/entities.js";
import { matchPerfilMapeamento, persistImportacao } from "../estudio-dados/importacao-service.js";
import type { RegraMapeamentoInput, Transform } from "../estudio-dados/mapeamento.js";
import {
  getInconsistenciaCriticaDetail,
  getExecucaoCritica,
  listInconsistenciaCriticas,
  resolveInconsistenciaCritica,
  runCritica
} from "../critica/critica-service.js";
import { refreshAvaliacaoAfterIssue } from "../critica/critica-status.js";
import {
  CriarExecucaoCriticaDto,
  CriarImportacaoDto,
  InconsistenciaCriticaDetailDto,
  InconsistenciaCriticaDto,
  InconsistenciaCriticaParamsDto,
  ExecucaoCriticaDto,
  ExecucaoCriticaParamsDto,
  DashboardDto,
  AvaliacaoDto,
  ImportacaoResultDto,
  ProvedorLlmDto,
  PerfilMapeamentoDto,
  PerfilMapeamentoMatchDto,
  PerfilMapeamentoMatchRequestDto,
  ResolverInconsistenciaCriticaDto
} from "./dtos.js";

type Session = ReturnType<typeof createSession>;

async function withSession<T>(handler: (session: Session) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

const evaluationRef = entityRef(Avaliacao);
const mappingRef = entityRef(PerfilMapeamento);
const providerRef = entityRef(ProvedorLlm);
const allowedTransforms = new Set<Transform>([
  "auto",
  "date-yyyymmdd",
  "date-br",
  "concat",
  "sum",
  "split-dash",
  "sex"
]);

function parseRegraMapeamentos(value: string): RegraMapeamentoInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new HttpError(400, "rulesJson não contém JSON válido.");
  }
  if (!Array.isArray(parsed)) throw new HttpError(400, "rulesJson deve ser uma lista de regras.");

  return parsed.map((candidato, index) => {
    if (!candidato || typeof candidato !== "object") {
      throw new HttpError(400, `Regra ${index + 1} inválida.`);
    }
    const rule = candidato as Record<string, unknown>;
    const sources = rule.sources;
    const targets = rule.targets;
    const transform = rule.transform;
    if (
      !Array.isArray(sources) ||
      !sources.every((item) => typeof item === "string") ||
      !Array.isArray(targets) ||
      !targets.every((item) => typeof item === "string") ||
      typeof transform !== "string" ||
      !allowedTransforms.has(transform as Transform)
    ) {
      throw new HttpError(400, `Regra ${index + 1} possui sources, targets ou transformação inválidos.`);
    }
    return { sources, targets, transform: transform as Transform };
  });
}

@Auth()
@Controller({ path: "/api", tags: ["Sistema"] })
export class SystemController {
  @Get("/health")
  @Public()
  @Returns(t.object({ situacao: t.string(), service: t.string(), versao: t.string() }))
  health() {
    return { situacao: "ok", service: `${APPLICATION_SLUG}-backend`, versao: "0.0.1" };
  }

  @Get("/config")
  @Public()
  @Returns(t.object({
    nome: t.string(),
    shortName: t.string(),
    organizationName: t.nullable(t.string())
  }))
  config() {
    return getPublicApplicationConfig();
  }

  @Get("/dashboard")
  @Returns(DashboardDto)
  async dashboard(): Promise<DashboardDto> {
    return withSession(async (session) => {
      const avaliacoes = await selectFromEntity(Avaliacao).execute(session);
      return {
        inProgress: avaliacoes.filter((item) => item.situacao === "Em andamento").length,
        awaitingCorrections: avaliacoes.filter((item) => item.inconsistenciasBloqueantes > 0).length,
        pendingStudies: avaliacoes.filter((item) => item.etapa === "Aderência").length,
        draftsAwaitingReview: 2
      };
    });
  }
}

@Auth()
@Controller({ path: "/api/avaliacoes", tags: ["Avaliacoes"] })
export class AvaliacaoController {
  @Get("/")
  @Returns(t.array(t.ref(AvaliacaoDto)))
  async list(): Promise<AvaliacaoDto[]> {
    return withSession(async (session) => {
      const rows = await selectFromEntity(Avaliacao)
        .orderBy(evaluationRef.atualizadoEm, "DESC")
        .execute(session);
      return rows.map((row) => ({
        id: row.id,
        planoId: row.planoId ?? null,
        nomePlano: row.nomePlano,
        dataReferencia: row.dataReferencia,
        situacao: row.situacao,
        etapa: row.etapa,
        progresso: row.progresso,
        inconsistenciasBloqueantes: row.inconsistenciasBloqueantes,
        atualizadoEm: row.atualizadoEm
      }));
    });
  }
}

@Auth()
@Controller({ path: "/api/perfis-mapeamento", tags: ["EstudioDados"] })
export class PerfilMapeamentoController {
  @Get("/")
  @Returns(t.array(t.ref(PerfilMapeamentoDto)))
  async list(): Promise<PerfilMapeamentoDto[]> {
    return withSession(async (session) => {
      const rows = await selectFromEntity(PerfilMapeamento)
        .orderBy(mappingRef.atualizadoEm, "DESC")
        .execute(session);
      return rows.map((row) => ({
        id: row.id,
        nome: row.nome,
        populacao: row.populacao,
        versao: row.versao,
        camposMapeados: row.camposMapeados,
        quantidadeCampos: row.quantidadeCampos,
        atualizadoEm: row.atualizadoEm
      }));
    });
  }

  @Post("/correspondencia")
  @Body(PerfilMapeamentoMatchRequestDto)
  @Returns(PerfilMapeamentoMatchDto)
  async match(ctx: RequestContext<PerfilMapeamentoMatchRequestDto>): Promise<PerfilMapeamentoMatchDto> {
    return matchPerfilMapeamento(ctx.body.headers, ctx.body.populacao);
  }
}

@Auth()
@Controller({ path: "/api/importacoes", tags: ["EstudioDados"] })
export class ImportacaoController {
  @Post("/")
  @UploadedFile("file", t.file({ description: "XLSX, XLS or CSV source file." }))
  @Body(CriarImportacaoDto)
  @Returns({ status: 201, schema: ImportacaoResultDto })
  async create(
    ctx: RequestContext<
      CriarImportacaoDto,
      undefined,
      undefined,
      undefined,
      { file: UploadedFileInfo }
    >
  ): Promise<ImportacaoResultDto> {
    const file = ctx.files?.file;
    if (!file) throw new HttpError(400, "Arquivo de origem é obrigatório.");
    const rules = parseRegraMapeamentos(ctx.body.regrasJson);
    if (!rules.some((rule) => rule.targets.length > 0)) {
      throw new HttpError(400, "A importação precisa possuir ao menos um campo canônico mapeado.");
    }

    return persistImportacao(file, {
      avaliacaoId: ctx.body.avaliacaoId,
      submassaId: ctx.body.submassaId,
      populacao: ctx.body.populacao,
      perfilMapeamentoId: ctx.body.perfilMapeamentoId,
      nomePerfil: ctx.body.nomePerfil,
      savePerfil: ctx.body.savePerfil ?? true,
      nomeAba: ctx.body.nomeAba,
      linhaCabecalho: ctx.body.linhaCabecalho,
      regras: rules
    });
  }
}

@Auth()
@Controller({ path: "/api/critica", tags: ["Critica"] })
export class CriticaController {
  @Post("/execucoes")
  @Body(CriarExecucaoCriticaDto)
  @Returns({ status: 201, schema: ExecucaoCriticaDto })
  async createRun(ctx: RequestContext<CriarExecucaoCriticaDto>): Promise<ExecucaoCriticaDto> {
    try {
      const result = await runCritica(ctx.body.importacaoId, ctx.body.importacaoAnteriorId);
      if (!result) throw new HttpError(500, "A execução de crítica não pôde ser recuperada.");
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : "Não foi possível executar a crítica cadastral.");
    }
  }

  @Get("/execucoes/:id")
  @Params(ExecucaoCriticaParamsDto)
  @Returns(ExecucaoCriticaDto)
  async getRun(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<ExecucaoCriticaDto> {
    const result = await getExecucaoCritica(ctx.params.id);
    if (!result) throw new HttpError(404, "Execução de crítica não encontrada.");
    return result;
  }

  @Get("/execucoes/:id/inconsistencias")
  @Params(ExecucaoCriticaParamsDto)
  @Returns(t.array(t.ref(InconsistenciaCriticaDto)))
  async listIssues(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<InconsistenciaCriticaDto[]> {
    const run = await getExecucaoCritica(ctx.params.id);
    if (!run) throw new HttpError(404, "Execução de crítica não encontrada.");
    return listInconsistenciaCriticas(ctx.params.id);
  }

  @Get("/inconsistencias/:id")
  @Params(InconsistenciaCriticaParamsDto)
  @Returns(InconsistenciaCriticaDetailDto)
  async getIssue(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<InconsistenciaCriticaDetailDto> {
    const issue = await getInconsistenciaCriticaDetail(ctx.params.id);
    if (!issue) throw new HttpError(404, "Ocorrência de crítica não encontrada.");
    return issue;
  }

  @Patch("/inconsistencias/:id")
  @Params(InconsistenciaCriticaParamsDto)
  @Body(ResolverInconsistenciaCriticaDto)
  @Returns(InconsistenciaCriticaDetailDto)
  async resolveIssue(ctx: RequestContext<ResolverInconsistenciaCriticaDto, undefined, { id: string }>): Promise<InconsistenciaCriticaDetailDto> {
    const situacao = ctx.body.situacao as "JUSTIFICADO" | "RESOLVIDO" | "IGNORADO";
    if (!["JUSTIFICADO", "RESOLVIDO", "IGNORADO"].includes(situacao)) {
      throw new HttpError(400, "situacao deve ser JUSTIFICADO, RESOLVIDO ou IGNORADO.");
    }
    const issue = await resolveInconsistenciaCritica(ctx.params.id, situacao, ctx.body.nota);
    if (!issue) throw new HttpError(404, "Ocorrência de crítica não encontrada.");
    await refreshAvaliacaoAfterIssue(ctx.params.id);
    return issue;
  }
}

@Auth()
@Controller({ path: "/api/llm/providers", tags: ["Ia"] })
export class ProvedorLlmController {
  @Get("/")
  @Returns(t.array(t.ref(ProvedorLlmDto)))
  async list(): Promise<ProvedorLlmDto[]> {
    return withSession(async (session) => {
      const [providers, credentials] = await Promise.all([
        selectFromEntity(ProvedorLlm).orderBy(providerRef.$.nome, "ASC").execute(session),
        selectFromEntity(CredencialProvedorLlm).execute(session)
      ]);
      return providers.map((row) => ({
        id: row.id,
        nome: row.nome,
        urlBase: row.urlBase,
        modelo: row.modelo,
        credentialCount: credentials.filter((credential) => credential.provedorId === row.id && credential.habilitado === 1).length,
        habilitado: row.habilitado === 1
      }));
    });
  }
}

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
import { Evaluation, LlmProvider, LlmProviderCredential, MappingProfile } from "../domain/entities.js";
import { matchMappingProfile, persistImport } from "../data-studio/import-service.js";
import type { MappingRuleInput, Transform } from "../data-studio/mapping.js";
import {
  getCritiqueIssueDetail,
  getCritiqueRun,
  listCritiqueIssues,
  resolveCritiqueIssue,
  runCritique
} from "../critique/critique-service.js";
import { refreshEvaluationAfterIssue } from "../critique/critique-status.js";
import {
  CreateCritiqueRunDto,
  CreateImportDto,
  CritiqueIssueDetailDto,
  CritiqueIssueDto,
  CritiqueIssueParamsDto,
  CritiqueRunDto,
  CritiqueRunParamsDto,
  DashboardDto,
  EvaluationDto,
  ImportResultDto,
  LlmProviderDto,
  MappingProfileDto,
  MappingProfileMatchDto,
  MappingProfileMatchRequestDto,
  ResolveCritiqueIssueDto
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

const evaluationRef = entityRef(Evaluation);
const mappingRef = entityRef(MappingProfile);
const providerRef = entityRef(LlmProvider);
const allowedTransforms = new Set<Transform>([
  "auto",
  "date-yyyymmdd",
  "date-br",
  "concat",
  "sum",
  "split-dash",
  "sex"
]);

function parseMappingRules(value: string): MappingRuleInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new HttpError(400, "rulesJson não contém JSON válido.");
  }
  if (!Array.isArray(parsed)) throw new HttpError(400, "rulesJson deve ser uma lista de regras.");

  return parsed.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") {
      throw new HttpError(400, `Regra ${index + 1} inválida.`);
    }
    const rule = candidate as Record<string, unknown>;
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
@Controller({ path: "/api", tags: ["System"] })
export class SystemController {
  @Get("/health")
  @Public()
  @Returns(t.object({ status: t.string(), service: t.string(), version: t.string() }))
  health() {
    return { status: "ok", service: `${APPLICATION_SLUG}-backend`, version: "0.0.1" };
  }

  @Get("/config")
  @Public()
  @Returns(t.object({
    name: t.string(),
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
      const evaluations = await selectFromEntity(Evaluation).execute(session);
      return {
        inProgress: evaluations.filter((item) => item.status === "Em andamento").length,
        awaitingCorrections: evaluations.filter((item) => item.blockingIssues > 0).length,
        pendingStudies: evaluations.filter((item) => item.stage === "Aderência").length,
        draftsAwaitingReview: 2
      };
    });
  }
}

@Auth()
@Controller({ path: "/api/evaluations", tags: ["Evaluations"] })
export class EvaluationController {
  @Get("/")
  @Returns(t.array(t.ref(EvaluationDto)))
  async list(): Promise<EvaluationDto[]> {
    return withSession(async (session) => {
      const rows = await selectFromEntity(Evaluation)
        .orderBy(evaluationRef.updatedAt, "DESC")
        .execute(session);
      return rows.map((row) => ({
        id: row.id,
        planId: row.planId ?? null,
        planName: row.planName,
        referenceDate: row.referenceDate,
        status: row.status,
        stage: row.stage,
        progress: row.progress,
        blockingIssues: row.blockingIssues,
        updatedAt: row.updatedAt
      }));
    });
  }
}

@Auth()
@Controller({ path: "/api/mapping-profiles", tags: ["Data Studio"] })
export class MappingProfileController {
  @Get("/")
  @Returns(t.array(t.ref(MappingProfileDto)))
  async list(): Promise<MappingProfileDto[]> {
    return withSession(async (session) => {
      const rows = await selectFromEntity(MappingProfile)
        .orderBy(mappingRef.updatedAt, "DESC")
        .execute(session);
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        population: row.population,
        version: row.version,
        mappedFields: row.mappedFields,
        totalFields: row.totalFields,
        updatedAt: row.updatedAt
      }));
    });
  }

  @Post("/match")
  @Body(MappingProfileMatchRequestDto)
  @Returns(MappingProfileMatchDto)
  async match(ctx: RequestContext<MappingProfileMatchRequestDto>): Promise<MappingProfileMatchDto> {
    return matchMappingProfile(ctx.body.headers, ctx.body.population);
  }
}

@Auth()
@Controller({ path: "/api/imports", tags: ["Data Studio"] })
export class ImportController {
  @Post("/")
  @UploadedFile("file", t.file({ description: "XLSX, XLS or CSV source file." }))
  @Body(CreateImportDto)
  @Returns({ status: 201, schema: ImportResultDto })
  async create(
    ctx: RequestContext<
      CreateImportDto,
      undefined,
      undefined,
      undefined,
      { file: UploadedFileInfo }
    >
  ): Promise<ImportResultDto> {
    const file = ctx.files?.file;
    if (!file) throw new HttpError(400, "Arquivo de origem é obrigatório.");
    const rules = parseMappingRules(ctx.body.rulesJson);
    if (!rules.some((rule) => rule.targets.length > 0)) {
      throw new HttpError(400, "A importação precisa possuir ao menos um campo canônico mapeado.");
    }

    return persistImport(file, {
      evaluationId: ctx.body.evaluationId,
      population: ctx.body.population,
      profileId: ctx.body.profileId,
      profileName: ctx.body.profileName,
      saveProfile: ctx.body.saveProfile ?? true,
      sheetName: ctx.body.sheetName,
      headerRow: ctx.body.headerRow,
      rules
    });
  }
}

@Auth()
@Controller({ path: "/api/critique", tags: ["Critique"] })
export class CritiqueController {
  @Post("/runs")
  @Body(CreateCritiqueRunDto)
  @Returns({ status: 201, schema: CritiqueRunDto })
  async createRun(ctx: RequestContext<CreateCritiqueRunDto>): Promise<CritiqueRunDto> {
    try {
      const result = await runCritique(ctx.body.importJobId, ctx.body.previousImportJobId);
      if (!result) throw new HttpError(500, "A execução de crítica não pôde ser recuperada.");
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : "Não foi possível executar a crítica cadastral.");
    }
  }

  @Get("/runs/:id")
  @Params(CritiqueRunParamsDto)
  @Returns(CritiqueRunDto)
  async getRun(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<CritiqueRunDto> {
    const result = await getCritiqueRun(ctx.params.id);
    if (!result) throw new HttpError(404, "Execução de crítica não encontrada.");
    return result;
  }

  @Get("/runs/:id/issues")
  @Params(CritiqueRunParamsDto)
  @Returns(t.array(t.ref(CritiqueIssueDto)))
  async listIssues(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<CritiqueIssueDto[]> {
    const run = await getCritiqueRun(ctx.params.id);
    if (!run) throw new HttpError(404, "Execução de crítica não encontrada.");
    return listCritiqueIssues(ctx.params.id);
  }

  @Get("/issues/:id")
  @Params(CritiqueIssueParamsDto)
  @Returns(CritiqueIssueDetailDto)
  async getIssue(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<CritiqueIssueDetailDto> {
    const issue = await getCritiqueIssueDetail(ctx.params.id);
    if (!issue) throw new HttpError(404, "Ocorrência de crítica não encontrada.");
    return issue;
  }

  @Patch("/issues/:id")
  @Params(CritiqueIssueParamsDto)
  @Body(ResolveCritiqueIssueDto)
  @Returns(CritiqueIssueDetailDto)
  async resolveIssue(ctx: RequestContext<ResolveCritiqueIssueDto, undefined, { id: string }>): Promise<CritiqueIssueDetailDto> {
    const status = ctx.body.status as "JUSTIFIED" | "RESOLVED" | "IGNORED";
    if (!["JUSTIFIED", "RESOLVED", "IGNORED"].includes(status)) {
      throw new HttpError(400, "status deve ser JUSTIFIED, RESOLVED ou IGNORED.");
    }
    const issue = await resolveCritiqueIssue(ctx.params.id, status, ctx.body.note);
    if (!issue) throw new HttpError(404, "Ocorrência de crítica não encontrada.");
    await refreshEvaluationAfterIssue(ctx.params.id);
    return issue;
  }
}

@Auth()
@Controller({ path: "/api/llm/providers", tags: ["AI"] })
export class LlmProviderController {
  @Get("/")
  @Returns(t.array(t.ref(LlmProviderDto)))
  async list(): Promise<LlmProviderDto[]> {
    return withSession(async (session) => {
      const [providers, credentials] = await Promise.all([
        selectFromEntity(LlmProvider).orderBy(providerRef.name, "ASC").execute(session),
        selectFromEntity(LlmProviderCredential).execute(session)
      ]);
      return providers.map((row) => ({
        id: row.id,
        name: row.name,
        baseUrl: row.baseUrl,
        model: row.model,
        credentialCount: credentials.filter((credential) => credential.providerId === row.id && credential.enabled === 1).length,
        enabled: row.enabled === 1
      }));
    });
  }
}

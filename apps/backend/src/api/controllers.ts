import { Controller, Get, Returns, t } from "adorn-api";
import { entityRef, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { Evaluation, LlmProvider, LlmProviderCredential, MappingProfile } from "../domain/entities.js";
import { DashboardDto, EvaluationDto, LlmProviderDto, MappingProfileDto } from "./dtos.js";

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

@Controller({ path: "/api", tags: ["System"] })
export class SystemController {
  @Get("/health")
  @Returns(t.object({ status: t.string(), service: t.string(), version: t.string() }))
  health() {
    return { status: "ok", service: "atuas-backend", version: "0.0.1" };
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
}

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

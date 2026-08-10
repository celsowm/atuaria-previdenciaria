import {
  Body,
  Controller,
  Get,
  HttpError,
  Params,
  Post,
  Returns,
  t,
  type RequestContext
} from "adorn-api";
import {
  createAdherenceStudy,
  getAdherenceCandidatePoints,
  getAdherenceStudy,
  listAdherenceStudies
} from "../adherence/adherence-service.js";
import {
  AdherenceCandidateParamsDto,
  AdherenceCandidatePointsDto,
  AdherenceStudyDetailDto,
  AdherenceStudyParamsDto,
  AdherenceStudySummaryDto,
  CreateAdherenceStudyDto
} from "./adherence-dtos.js";

@Controller({ path: "/api/adherence-studies", tags: ["Adherence"] })
export class AdherenceStudyController {
  @Get("/")
  @Returns(t.array(t.ref(AdherenceStudySummaryDto)))
  async list(): Promise<AdherenceStudySummaryDto[]> {
    return listAdherenceStudies();
  }

  @Post("/")
  @Body(CreateAdherenceStudyDto)
  @Returns({ status: 201, schema: AdherenceStudyDetailDto })
  async create(ctx: RequestContext<CreateAdherenceStudyDto>): Promise<AdherenceStudyDetailDto> {
    try {
      const result = await createAdherenceStudy({
        evaluationId: ctx.body.evaluationId,
        name: ctx.body.name,
        hypothesisType: ctx.body.hypothesisType,
        periodStart: ctx.body.periodStart,
        periodEnd: ctx.body.periodEnd,
        sexScope: ctx.body.sexScope as "BOTH" | "MALE" | "FEMALE" | "UNISEX",
        alpha: ctx.body.alpha,
        fisherSplitAge: ctx.body.fisherSplitAge,
        candidateVersionIds: ctx.body.candidateVersionIds,
        observations: ctx.body.observations.map((observation) => ({
          year: observation.year,
          age: observation.age,
          sex: observation.sex as "MALE" | "FEMALE" | "UNISEX",
          exposure: observation.exposure,
          observedEvents: observation.observedEvents
        }))
      });
      if (!result) throw new HttpError(500, "O estudo criado não pôde ser recuperado.");
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : "Não foi possível executar o estudo de aderência.");
    }
  }

  @Get("/:id")
  @Params(AdherenceStudyParamsDto)
  @Returns(AdherenceStudyDetailDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<AdherenceStudyDetailDto> {
    const result = await getAdherenceStudy(ctx.params.id);
    if (!result) throw new HttpError(404, "Estudo de aderência não encontrado.");
    return result;
  }
}

@Controller({ path: "/api/adherence-candidates", tags: ["Adherence"] })
export class AdherenceCandidateController {
  @Get("/:id/points")
  @Params(AdherenceCandidateParamsDto)
  @Returns(AdherenceCandidatePointsDto)
  async points(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<AdherenceCandidatePointsDto> {
    const result = await getAdherenceCandidatePoints(ctx.params.id);
    if (!result) throw new HttpError(404, "Resultado candidato não encontrado.");
    return result;
  }
}

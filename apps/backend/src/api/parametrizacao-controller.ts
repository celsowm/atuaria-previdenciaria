import { Auth, Body, Controller, Get, HttpError, Params, Patch, Post, Returns, t, type RequestContext } from "adorn-api";
import {
  approveParameterization,
  createParameterization,
  getParameterization,
  listParameterizations,
  promoteAdherenceCandidate,
  removeHypothesisSelection,
  setParameterValues,
  updateParameterizationMetadata
} from "../parameterization/parameterization-service.js";
import {
  ActuarialParameterizationDto,
  ActuarialParameterizationParamsDto,
  ActuarialParameterizationSummaryDto,
  CreateActuarialParameterizationDto,
  EvaluationParameterizationParamsDto,
  PromoteAdherenceCandidateDto,
  RemoveActuarialHypothesisSelectionDto,
  SetActuarialParametersDto,
  UpdateActuarialParameterizationDto
} from "./parameterization-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api", tags: ["Parameterization"] })
export class ParameterizationController {
  @Get("/evaluations/:evaluationId/parameterizations")
  @Params(EvaluationParameterizationParamsDto)
  @Returns(t.array(t.ref(ActuarialParameterizationSummaryDto)))
  async list(
    ctx: RequestContext<unknown, undefined, { evaluationId: number }>
  ): Promise<ActuarialParameterizationSummaryDto[]> {
    return listParameterizations(ctx.params.evaluationId);
  }

  @Post("/evaluations/:evaluationId/parameterizations")
  @Params(EvaluationParameterizationParamsDto)
  @Body(CreateActuarialParameterizationDto)
  @Returns({ status: 201, schema: ActuarialParameterizationDto })
  async create(
    ctx: RequestContext<CreateActuarialParameterizationDto, undefined, { evaluationId: number }>
  ): Promise<ActuarialParameterizationDto> {
    try {
      return await createParameterization(ctx.params.evaluationId, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Get("/parameterizations/:id")
  @Params(ActuarialParameterizationParamsDto)
  @Returns(ActuarialParameterizationDto)
  async getOne(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<ActuarialParameterizationDto> {
    const row = await getParameterization(ctx.params.id);
    if (!row) throw new HttpError(404, "Parametrização não encontrada.");
    return row;
  }

  @Patch("/parameterizations/:id")
  @Params(ActuarialParameterizationParamsDto)
  @Body(UpdateActuarialParameterizationDto)
  @Returns(ActuarialParameterizationDto)
  async update(
    ctx: RequestContext<UpdateActuarialParameterizationDto, undefined, { id: string }>
  ): Promise<ActuarialParameterizationDto> {
    try {
      return await updateParameterizationMetadata(ctx.params.id, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/parameterizations/:id/parameters")
  @Params(ActuarialParameterizationParamsDto)
  @Body(SetActuarialParametersDto)
  @Returns(ActuarialParameterizationDto)
  async setParameters(
    ctx: RequestContext<SetActuarialParametersDto, undefined, { id: string }>
  ): Promise<ActuarialParameterizationDto> {
    try {
      return await setParameterValues(ctx.params.id, ctx.body.parameters);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/parameterizations/:id/adherence-candidate")
  @Params(ActuarialParameterizationParamsDto)
  @Body(PromoteAdherenceCandidateDto)
  @Returns(ActuarialParameterizationDto)
  async promoteCandidate(
    ctx: RequestContext<PromoteAdherenceCandidateDto, undefined, { id: string }>
  ): Promise<ActuarialParameterizationDto> {
    try {
      return await promoteAdherenceCandidate(ctx.params.id, ctx.body.candidateResultId);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/parameterizations/:id/hypothesis/remove")
  @Params(ActuarialParameterizationParamsDto)
  @Body(RemoveActuarialHypothesisSelectionDto)
  @Returns(ActuarialParameterizationDto)
  async removeHypothesis(
    ctx: RequestContext<RemoveActuarialHypothesisSelectionDto, undefined, { id: string }>
  ): Promise<ActuarialParameterizationDto> {
    try {
      return await removeHypothesisSelection(ctx.params.id, ctx.body.selectionId);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/parameterizations/:id/approve")
  @Params(ActuarialParameterizationParamsDto)
  @Returns(ActuarialParameterizationDto)
  async approve(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<ActuarialParameterizationDto> {
    try {
      return await approveParameterization(ctx.params.id);
    } catch (error) {
      return badRequest(error);
    }
  }
}

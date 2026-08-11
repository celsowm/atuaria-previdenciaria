import { Auth, Body, Controller, Get, HttpError, Params, Post, Query, Returns, t, type RequestContext } from "adorn-api";
import {
  availableCalculationEngines,
  executeCalculation,
  getCalculationRun,
  listCalculationParticipantResults,
  listCalculationRuns
} from "../calculation/calculation-service.js";
import {
  CalculationEngineDto,
  CalculationEvaluationParamsDto,
  CalculationParticipantQueryDto,
  CalculationParticipantResultPageDto,
  CalculationRunDto,
  CalculationRunParamsDto,
  CalculationRunSummaryDto,
  CreateCalculationRunDto
} from "./calculation-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api", tags: ["Calculation"] })
export class CalculationController {
  @Get("/calculation-engines")
  @Returns(t.array(t.ref(CalculationEngineDto)))
  engines(): CalculationEngineDto[] {
    return availableCalculationEngines();
  }

  @Get("/evaluations/:evaluationId/calculations")
  @Params(CalculationEvaluationParamsDto)
  @Returns(t.array(t.ref(CalculationRunSummaryDto)))
  async list(
    ctx: RequestContext<unknown, undefined, { evaluationId: number }>
  ): Promise<CalculationRunSummaryDto[]> {
    return listCalculationRuns(ctx.params.evaluationId);
  }

  @Post("/evaluations/:evaluationId/calculations")
  @Params(CalculationEvaluationParamsDto)
  @Body(CreateCalculationRunDto)
  @Returns({ status: 201, schema: CalculationRunDto })
  async create(
    ctx: RequestContext<CreateCalculationRunDto, undefined, { evaluationId: number }>
  ): Promise<CalculationRunDto> {
    try {
      return await executeCalculation(ctx.params.evaluationId, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Get("/calculations/:id")
  @Params(CalculationRunParamsDto)
  @Returns(CalculationRunDto)
  async getOne(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<CalculationRunDto> {
    const run = await getCalculationRun(ctx.params.id);
    if (!run) throw new HttpError(404, "Execução de cálculo não encontrada.");
    return run;
  }

  @Get("/calculations/:id/participants")
  @Params(CalculationRunParamsDto)
  @Query(CalculationParticipantQueryDto)
  @Returns(CalculationParticipantResultPageDto)
  async participants(
    ctx: RequestContext<unknown, CalculationParticipantQueryDto, { id: string }>
  ): Promise<CalculationParticipantResultPageDto> {
    const page = ctx.query.page ?? 1;
    const pageSize = ctx.query.pageSize ?? 50;
    const result = await listCalculationParticipantResults(ctx.params.id, page, pageSize);
    if (!result) throw new HttpError(404, "Execução de cálculo não encontrada.");
    return result;
  }
}

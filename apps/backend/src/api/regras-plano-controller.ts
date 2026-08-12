import { Auth, Body, Controller, Get, HttpError, Params, Patch, Post, Returns, t, type RequestContext } from "adorn-api";
import {
  approvePlanRulesVersion,
  createPlanRulesVersion,
  getPlanRulesVersion,
  listPlanRulesVersions,
  setPlanRuleValues,
  updatePlanRulesMetadata
} from "../plans/plan-rules-service.js";
import {
  CreatePlanRulesVersionDto,
  PlanRulesPlanParamsDto,
  PlanRulesVersionDto,
  PlanRulesVersionParamsDto,
  PlanRulesVersionSummaryDto,
  SetPlanRuleValuesDto,
  UpdatePlanRulesVersionDto
} from "./plan-rules-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api", tags: ["Plan Rules"] })
export class PlanRulesController {
  @Get("/plans/:planId/rules")
  @Params(PlanRulesPlanParamsDto)
  @Returns(t.array(t.ref(PlanRulesVersionSummaryDto)))
  async list(
    ctx: RequestContext<unknown, undefined, { planId: string }>
  ): Promise<PlanRulesVersionSummaryDto[]> {
    try {
      return await listPlanRulesVersions(ctx.params.planId);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/plans/:planId/rules")
  @Params(PlanRulesPlanParamsDto)
  @Body(CreatePlanRulesVersionDto)
  @Returns({ status: 201, schema: PlanRulesVersionDto })
  async create(
    ctx: RequestContext<CreatePlanRulesVersionDto, undefined, { planId: string }>
  ): Promise<PlanRulesVersionDto> {
    try {
      return await createPlanRulesVersion(ctx.params.planId, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Get("/plan-rules/:id")
  @Params(PlanRulesVersionParamsDto)
  @Returns(PlanRulesVersionDto)
  async getOne(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<PlanRulesVersionDto> {
    const row = await getPlanRulesVersion(ctx.params.id);
    if (!row) throw new HttpError(404, "Versão de regras do plano não encontrada.");
    return row;
  }

  @Patch("/plan-rules/:id")
  @Params(PlanRulesVersionParamsDto)
  @Body(UpdatePlanRulesVersionDto)
  @Returns(PlanRulesVersionDto)
  async update(
    ctx: RequestContext<UpdatePlanRulesVersionDto, undefined, { id: string }>
  ): Promise<PlanRulesVersionDto> {
    try {
      return await updatePlanRulesMetadata(ctx.params.id, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/plan-rules/:id/values")
  @Params(PlanRulesVersionParamsDto)
  @Body(SetPlanRuleValuesDto)
  @Returns(PlanRulesVersionDto)
  async setValues(
    ctx: RequestContext<SetPlanRuleValuesDto, undefined, { id: string }>
  ): Promise<PlanRulesVersionDto> {
    try {
      return await setPlanRuleValues(ctx.params.id, ctx.body.rules);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/plan-rules/:id/approve")
  @Params(PlanRulesVersionParamsDto)
  @Returns(PlanRulesVersionDto)
  async approve(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<PlanRulesVersionDto> {
    try {
      return await approvePlanRulesVersion(ctx.params.id);
    } catch (error) {
      return badRequest(error);
    }
  }
}

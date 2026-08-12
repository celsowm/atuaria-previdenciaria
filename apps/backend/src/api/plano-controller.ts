import { Auth, Body, Controller, Get, HttpError, Params, Patch, Post, Returns, t, type RequestContext } from "adorn-api";
import { createPlan, getPlan, listPlans, updatePlan } from "../plans/plan-service.js";
import { CreatePlanDto, PlanDto, PlanParamsDto, UpdatePlanDto } from "./plan-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api/plans", tags: ["Plans"] })
export class PlanController {
  @Get("/")
  @Returns(t.array(t.ref(PlanDto)))
  async list(): Promise<PlanDto[]> {
    return listPlans();
  }

  @Get("/:id")
  @Params(PlanParamsDto)
  @Returns(PlanDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<PlanDto> {
    const plan = await getPlan(ctx.params.id);
    if (!plan) throw new HttpError(404, "Plano não encontrado.");
    return plan;
  }

  @Post("/")
  @Body(CreatePlanDto)
  @Returns({ status: 201, schema: PlanDto })
  async create(ctx: RequestContext<CreatePlanDto>): Promise<PlanDto> {
    try {
      return await createPlan(ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/:id")
  @Params(PlanParamsDto)
  @Body(UpdatePlanDto)
  @Returns(PlanDto)
  async update(ctx: RequestContext<UpdatePlanDto, undefined, { id: string }>): Promise<PlanDto> {
    try {
      const plan = await updatePlan(ctx.params.id, ctx.body);
      if (!plan) throw new HttpError(404, "Plano não encontrado.");
      return plan;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return badRequest(error);
    }
  }
}

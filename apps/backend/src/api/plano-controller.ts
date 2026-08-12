import { Auth, Body, Controller, Get, HttpError, Params, Patch, Post, Returns, t, type RequestContext } from "adorn-api";
import { criarPlano, obterPlano, listarPlanos, atualizarPlano } from "../planos/plano-service.js";
import { CriarPlanoDto, PlanoDto, PlanoParamsDto, AtualizarPlanoDto } from "./plano-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api/planos", tags: ["Planos"] })
export class PlanoController {
  @Get("/")
  @Returns(t.array(t.ref(PlanoDto)))
  async list(): Promise<PlanoDto[]> {
    return listarPlanos();
  }

  @Get("/:id")
  @Params(PlanoParamsDto)
  @Returns(PlanoDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<PlanoDto> {
    const plan = await obterPlano(ctx.params.id);
    if (!plan) throw new HttpError(404, "Plano não encontrado.");
    return plan;
  }

  @Post("/")
  @Body(CriarPlanoDto)
  @Returns({ status: 201, schema: PlanoDto })
  async create(ctx: RequestContext<CriarPlanoDto>): Promise<PlanoDto> {
    try {
      return await criarPlano(ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/:id")
  @Params(PlanoParamsDto)
  @Body(AtualizarPlanoDto)
  @Returns(PlanoDto)
  async update(ctx: RequestContext<AtualizarPlanoDto, undefined, { id: string }>): Promise<PlanoDto> {
    try {
      const plan = await atualizarPlano(ctx.params.id, ctx.body);
      if (!plan) throw new HttpError(404, "Plano não encontrado.");
      return plan;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return badRequest(error);
    }
  }
}

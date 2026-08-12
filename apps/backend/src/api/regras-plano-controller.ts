import { Auth, Body, Controller, Get, HttpError, Params, Patch, Post, Returns, t, type RequestContext } from "adorn-api";
import {
  approveVersaoRegrasPlano,
  createVersaoRegrasPlano,
  getVersaoRegrasPlano,
  listVersaoRegrasPlanos,
  setValorRegraPlanos,
  updateRegrasPlanoMetadata
} from "../planos/regras-plano-service.js";
import {
  CriarVersaoRegrasPlanoDto,
  RegrasPlanoPlanoParamsDto,
  VersaoRegrasPlanoDto,
  VersaoRegrasPlanoParamsDto,
  VersaoRegrasPlanoSummaryDto,
  DefinirValoresRegrasPlanoDto,
  AtualizarVersaoRegrasPlanoDto
} from "./regras-plano-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api", tags: ["RegrasPlano"] })
export class RegrasPlanoController {
  @Get("/planos/:planoId/regras")
  @Params(RegrasPlanoPlanoParamsDto)
  @Returns(t.array(t.ref(VersaoRegrasPlanoSummaryDto)))
  async list(
    ctx: RequestContext<unknown, undefined, { planoId: string }>
  ): Promise<VersaoRegrasPlanoSummaryDto[]> {
    try {
      return await listVersaoRegrasPlanos(ctx.params.planoId);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/planos/:planoId/regras")
  @Params(RegrasPlanoPlanoParamsDto)
  @Body(CriarVersaoRegrasPlanoDto)
  @Returns({ status: 201, schema: VersaoRegrasPlanoDto })
  async create(
    ctx: RequestContext<CriarVersaoRegrasPlanoDto, undefined, { planoId: string }>
  ): Promise<VersaoRegrasPlanoDto> {
    try {
      return await createVersaoRegrasPlano(ctx.params.planoId, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Get("/regras-plano/:id")
  @Params(VersaoRegrasPlanoParamsDto)
  @Returns(VersaoRegrasPlanoDto)
  async getOne(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<VersaoRegrasPlanoDto> {
    const row = await getVersaoRegrasPlano(ctx.params.id);
    if (!row) throw new HttpError(404, "Versão de regras do plano não encontrada.");
    return row;
  }

  @Patch("/regras-plano/:id")
  @Params(VersaoRegrasPlanoParamsDto)
  @Body(AtualizarVersaoRegrasPlanoDto)
  @Returns(VersaoRegrasPlanoDto)
  async update(
    ctx: RequestContext<AtualizarVersaoRegrasPlanoDto, undefined, { id: string }>
  ): Promise<VersaoRegrasPlanoDto> {
    try {
      return await updateRegrasPlanoMetadata(ctx.params.id, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/regras-plano/:id/valores")
  @Params(VersaoRegrasPlanoParamsDto)
  @Body(DefinirValoresRegrasPlanoDto)
  @Returns(VersaoRegrasPlanoDto)
  async setValues(
    ctx: RequestContext<DefinirValoresRegrasPlanoDto, undefined, { id: string }>
  ): Promise<VersaoRegrasPlanoDto> {
    try {
      return await setValorRegraPlanos(ctx.params.id, ctx.body.regras);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/regras-plano/:id/aprovar")
  @Params(VersaoRegrasPlanoParamsDto)
  @Returns(VersaoRegrasPlanoDto)
  async approve(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<VersaoRegrasPlanoDto> {
    try {
      return await approveVersaoRegrasPlano(ctx.params.id);
    } catch (error) {
      return badRequest(error);
    }
  }
}

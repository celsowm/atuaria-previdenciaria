import { Auth, Body, Controller, Get, HttpError, Params, Patch, Post, Returns, t, type RequestContext } from "adorn-api";
import {
  approveParametrizacao,
  createParametrizacao,
  getParametrizacao,
  listParametrizacaos,
  promoteAderenciaCandidato,
  removeHipoteseSelecao,
  setParameterValues,
  updateParametrizacaoMetadata
} from "../parametrizacao/parametrizacao-service.js";
import {
  ParametrizacaoAtuarialDto,
  ParametrizacaoAtuarialParamsDto,
  ParametrizacaoAtuarialSummaryDto,
  CriarParametrizacaoAtuarialDto,
  AvaliacaoParametrizacaoParamsDto,
  PromoverCandidatoAderenciaDto,
  RemoverSelecaoHipoteseAtuarialDto,
  DefinirParametrosAtuariaisDto,
  AtualizarParametrizacaoAtuarialDto
} from "./parametrizacao-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api", tags: ["Parametrizacao"] })
export class ParametrizacaoController {
  @Get("/avaliacoes/:avaliacaoId/parametrizacoes")
  @Params(AvaliacaoParametrizacaoParamsDto)
  @Returns(t.array(t.ref(ParametrizacaoAtuarialSummaryDto)))
  async list(
    ctx: RequestContext<unknown, undefined, { avaliacaoId: number }>
  ): Promise<ParametrizacaoAtuarialSummaryDto[]> {
    return listParametrizacaos(ctx.params.avaliacaoId);
  }

  @Post("/avaliacoes/:avaliacaoId/parametrizacoes")
  @Params(AvaliacaoParametrizacaoParamsDto)
  @Body(CriarParametrizacaoAtuarialDto)
  @Returns({ status: 201, schema: ParametrizacaoAtuarialDto })
  async create(
    ctx: RequestContext<CriarParametrizacaoAtuarialDto, undefined, { avaliacaoId: number }>
  ): Promise<ParametrizacaoAtuarialDto> {
    try {
      return await createParametrizacao(ctx.params.avaliacaoId, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Get("/parametrizacoes/:id")
  @Params(ParametrizacaoAtuarialParamsDto)
  @Returns(ParametrizacaoAtuarialDto)
  async getOne(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<ParametrizacaoAtuarialDto> {
    const row = await getParametrizacao(ctx.params.id);
    if (!row) throw new HttpError(404, "Parametrização não encontrada.");
    return row;
  }

  @Patch("/parametrizacoes/:id")
  @Params(ParametrizacaoAtuarialParamsDto)
  @Body(AtualizarParametrizacaoAtuarialDto)
  @Returns(ParametrizacaoAtuarialDto)
  async update(
    ctx: RequestContext<AtualizarParametrizacaoAtuarialDto, undefined, { id: string }>
  ): Promise<ParametrizacaoAtuarialDto> {
    try {
      return await updateParametrizacaoMetadata(ctx.params.id, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/parametrizacoes/:id/parametros")
  @Params(ParametrizacaoAtuarialParamsDto)
  @Body(DefinirParametrosAtuariaisDto)
  @Returns(ParametrizacaoAtuarialDto)
  async setParameters(
    ctx: RequestContext<DefinirParametrosAtuariaisDto, undefined, { id: string }>
  ): Promise<ParametrizacaoAtuarialDto> {
    try {
      return await setParameterValues(ctx.params.id, ctx.body.parametros);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/parametrizacoes/:id/candidato-aderencia")
  @Params(ParametrizacaoAtuarialParamsDto)
  @Body(PromoverCandidatoAderenciaDto)
  @Returns(ParametrizacaoAtuarialDto)
  async promoteCandidato(
    ctx: RequestContext<PromoverCandidatoAderenciaDto, undefined, { id: string }>
  ): Promise<ParametrizacaoAtuarialDto> {
    try {
      return await promoteAderenciaCandidato(ctx.params.id, ctx.body.resultadoCandidatoId);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/parametrizacoes/:id/hipotese/remover")
  @Params(ParametrizacaoAtuarialParamsDto)
  @Body(RemoverSelecaoHipoteseAtuarialDto)
  @Returns(ParametrizacaoAtuarialDto)
  async removeHipotese(
    ctx: RequestContext<RemoverSelecaoHipoteseAtuarialDto, undefined, { id: string }>
  ): Promise<ParametrizacaoAtuarialDto> {
    try {
      return await removeHipoteseSelecao(ctx.params.id, ctx.body.selecaoId);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Post("/parametrizacoes/:id/aprovar")
  @Params(ParametrizacaoAtuarialParamsDto)
  @Returns(ParametrizacaoAtuarialDto)
  async approve(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<ParametrizacaoAtuarialDto> {
    try {
      return await approveParametrizacao(ctx.params.id);
    } catch (error) {
      return badRequest(error);
    }
  }
}

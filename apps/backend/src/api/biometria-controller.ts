import {
  Auth,
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
  createTabuaBiometria,
  deriveVersaoBiometria,
  getTabuaBiometria,
  getVersaoBiometriaPoints,
  listTabuaBiometrias
} from "../biometria/biometria-service.js";
import {
  TabuaBiometriaDetailDto,
  TabuaBiometriaParamsDto,
  TabuaBiometriaSummaryDto,
  VersaoBiometriaParamsDto,
  VersaoBiometriaPointsDto,
  CriarTabuaBiometriaDto,
  DerivarVersaoBiometriaDto
} from "./biometria-dtos.js";

@Auth()
@Controller({ path: "/api/tabuas-biometricas", tags: ["Biometria"] })
export class TabuaBiometriaController {
  @Get("/")
  @Returns(t.array(t.ref(TabuaBiometriaSummaryDto)))
  async list(): Promise<TabuaBiometriaSummaryDto[]> {
    return listTabuaBiometrias();
  }

  @Post("/")
  @Body(CriarTabuaBiometriaDto)
  @Returns({ status: 201, schema: TabuaBiometriaDetailDto })
  async create(ctx: RequestContext<CriarTabuaBiometriaDto>): Promise<TabuaBiometriaDetailDto> {
    try {
      const result = await createTabuaBiometria({
        ...ctx.body,
        pontos: ctx.body.pontos.map((ponto) => ({
          idade: ponto.idade,
          sexo: ponto.sexo as "MASCULINO" | "FEMININO" | "UNISSEX",
          qx: ponto.qx
        }))
      });
      if (!result) throw new HttpError(500, "A tábua criada não pôde ser recuperada.");
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : "Não foi possível criar a tábua.");
    }
  }

  @Get("/:id")
  @Params(TabuaBiometriaParamsDto)
  @Returns(TabuaBiometriaDetailDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<TabuaBiometriaDetailDto> {
    const result = await getTabuaBiometria(ctx.params.id);
    if (!result) throw new HttpError(404, "Tábua não encontrada.");
    return result;
  }

  @Post("/:id/derivar")
  @Params(TabuaBiometriaParamsDto)
  @Body(DerivarVersaoBiometriaDto)
  @Returns({ status: 201, schema: VersaoBiometriaPointsDto })
  async derive(
    ctx: RequestContext<DerivarVersaoBiometriaDto, undefined, { id: string }>
  ): Promise<VersaoBiometriaPointsDto> {
    const transformacao = ctx.body.transformacao as "QX_SCALE" | "AGE_SHIFT";
    if (!["QX_SCALE", "AGE_SHIFT"].includes(transformacao)) {
      throw new HttpError(400, "transformacao deve ser QX_SCALE ou AGE_SHIFT.");
    }
    try {
      const result = await deriveVersaoBiometria(ctx.params.id, { ...ctx.body, transformacao });
      if (!result) throw new HttpError(500, "A versão derivada não pôde ser recuperada.");
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : "Não foi possível derivar a tábua.");
    }
  }
}

@Auth()
@Controller({ path: "/api/versoes-tabuas-biometricas", tags: ["Biometria"] })
export class VersaoBiometriaController {
  @Get("/:id/pontos")
  @Params(VersaoBiometriaParamsDto)
  @Returns(VersaoBiometriaPointsDto)
  async pontos(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<VersaoBiometriaPointsDto> {
    const result = await getVersaoBiometriaPoints(ctx.params.id);
    if (!result) throw new HttpError(404, "Versão biométrica não encontrada.");
    return result;
  }
}

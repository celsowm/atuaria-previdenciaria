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
  createBiometricTable,
  deriveBiometricVersion,
  getBiometricTable,
  getBiometricVersionPoints,
  listBiometricTables
} from "../biometrics/biometric-service.js";
import {
  BiometricTableDetailDto,
  BiometricTableParamsDto,
  BiometricTableSummaryDto,
  BiometricVersionParamsDto,
  BiometricVersionPointsDto,
  CreateBiometricTableDto,
  DeriveBiometricVersionDto
} from "./biometric-dtos.js";

@Controller({ path: "/api/biometric-tables", tags: ["Biometrics"] })
export class BiometricTableController {
  @Get("/")
  @Returns(t.array(t.ref(BiometricTableSummaryDto)))
  async list(): Promise<BiometricTableSummaryDto[]> {
    return listBiometricTables();
  }

  @Post("/")
  @Body(CreateBiometricTableDto)
  @Returns({ status: 201, schema: BiometricTableDetailDto })
  async create(ctx: RequestContext<CreateBiometricTableDto>): Promise<BiometricTableDetailDto> {
    try {
      const result = await createBiometricTable({
        ...ctx.body,
        points: ctx.body.points.map((point) => ({
          age: point.age,
          sex: point.sex as "MALE" | "FEMALE" | "UNISEX",
          qx: point.qx
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
  @Params(BiometricTableParamsDto)
  @Returns(BiometricTableDetailDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<BiometricTableDetailDto> {
    const result = await getBiometricTable(ctx.params.id);
    if (!result) throw new HttpError(404, "Tábua não encontrada.");
    return result;
  }

  @Post("/:id/derive")
  @Params(BiometricTableParamsDto)
  @Body(DeriveBiometricVersionDto)
  @Returns({ status: 201, schema: BiometricVersionPointsDto })
  async derive(
    ctx: RequestContext<DeriveBiometricVersionDto, undefined, { id: string }>
  ): Promise<BiometricVersionPointsDto> {
    const transform = ctx.body.transform as "QX_SCALE" | "AGE_SHIFT";
    if (!["QX_SCALE", "AGE_SHIFT"].includes(transform)) {
      throw new HttpError(400, "transform deve ser QX_SCALE ou AGE_SHIFT.");
    }
    try {
      const result = await deriveBiometricVersion(ctx.params.id, { ...ctx.body, transform });
      if (!result) throw new HttpError(500, "A versão derivada não pôde ser recuperada.");
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : "Não foi possível derivar a tábua.");
    }
  }
}

@Controller({ path: "/api/biometric-versions", tags: ["Biometrics"] })
export class BiometricVersionController {
  @Get("/:id/points")
  @Params(BiometricVersionParamsDto)
  @Returns(BiometricVersionPointsDto)
  async points(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<BiometricVersionPointsDto> {
    const result = await getBiometricVersionPoints(ctx.params.id);
    if (!result) throw new HttpError(404, "Versão biométrica não encontrada.");
    return result;
  }
}

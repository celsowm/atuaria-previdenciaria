import { Auth, Body, Controller, Get, HttpError, Params, Post, Query, Returns, t, type RequestContext } from "adorn-api";
import {
  availableCalculoEngines,
  executeCalculation,
  getExecucaoCalculo,
  listResultadoParticipanteCalculos,
  listExecucaoCalculos
} from "../calculo/calculo-service.js";
import {
  CalculoEngineDto,
  ParametrosAvaliacaoCalculoDto,
  ConsultaParticipantesCalculoDto,
  ResultadoParticipanteCalculoPageDto,
  ExecucaoCalculoDto,
  ParametrosExecucaoCalculoDto,
  ResumoExecucaoCalculoDto,
  CriarExecucaoCalculoDto
} from "./calculo-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api", tags: ["Calculo"] })
export class CalculoController {
  @Get("/motores-calculo")
  @Returns(t.array(t.ref(CalculoEngineDto)))
  engines(): CalculoEngineDto[] {
    return availableCalculoEngines();
  }

  @Get("/avaliacoes/:avaliacaoId/calculos")
  @Params(ParametrosAvaliacaoCalculoDto)
  @Returns(t.array(t.ref(ResumoExecucaoCalculoDto)))
  async list(
    ctx: RequestContext<unknown, undefined, { avaliacaoId: number }>
  ): Promise<ResumoExecucaoCalculoDto[]> {
    return listExecucaoCalculos(ctx.params.avaliacaoId);
  }

  @Post("/avaliacoes/:avaliacaoId/calculos")
  @Params(ParametrosAvaliacaoCalculoDto)
  @Body(CriarExecucaoCalculoDto)
  @Returns({ status: 201, schema: ExecucaoCalculoDto })
  async create(
    ctx: RequestContext<CriarExecucaoCalculoDto, undefined, { avaliacaoId: number }>
  ): Promise<ExecucaoCalculoDto> {
    try {
      return await executeCalculation(ctx.params.avaliacaoId, ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Get("/calculos/:id")
  @Params(ParametrosExecucaoCalculoDto)
  @Returns(ExecucaoCalculoDto)
  async getOne(
    ctx: RequestContext<unknown, undefined, { id: string }>
  ): Promise<ExecucaoCalculoDto> {
    const run = await getExecucaoCalculo(ctx.params.id);
    if (!run) throw new HttpError(404, "Execução de cálculo não encontrada.");
    return run;
  }

  @Get("/calculos/:id/participantes")
  @Params(ParametrosExecucaoCalculoDto)
  @Query(ConsultaParticipantesCalculoDto)
  @Returns(ResultadoParticipanteCalculoPageDto)
  async participants(
    ctx: RequestContext<unknown, ConsultaParticipantesCalculoDto, { id: string }>
  ): Promise<ResultadoParticipanteCalculoPageDto> {
    const page = ctx.query.page ?? 1;
    const pageSize = ctx.query.pageSize ?? 50;
    const result = await listResultadoParticipanteCalculos(ctx.params.id, page, pageSize);
    if (!result) throw new HttpError(404, "Execução de cálculo não encontrada.");
    return result;
  }
}

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
  createEstudoAderencia,
  getPontosCandidatoAderencia,
  getEstudoAderencia,
  listAderenciaStudies
} from "../aderencia/aderencia-service.js";
import {
  AderenciaCandidatoParamsDto,
  PontosCandidatoAderenciaDto,
  EstudoAderenciaDetailDto,
  EstudoAderenciaParamsDto,
  EstudoAderenciaSummaryDto,
  CriarEstudoAderenciaDto
} from "./aderencia-dtos.js";

@Auth()
@Controller({ path: "/api/estudos-aderencia", tags: ["Aderencia"] })
export class EstudoAderenciaController {
  @Get("/")
  @Returns(t.array(t.ref(EstudoAderenciaSummaryDto)))
  async list(): Promise<EstudoAderenciaSummaryDto[]> {
    return listAderenciaStudies();
  }

  @Post("/")
  @Body(CriarEstudoAderenciaDto)
  @Returns({ status: 201, schema: EstudoAderenciaDetailDto })
  async create(ctx: RequestContext<CriarEstudoAderenciaDto>): Promise<EstudoAderenciaDetailDto> {
    try {
      const result = await createEstudoAderencia({
        avaliacaoId: ctx.body.avaliacaoId,
        nome: ctx.body.nome,
        tipoHipotese: ctx.body.tipoHipotese,
        periodoInicial: ctx.body.periodoInicial,
        periodoFinal: ctx.body.periodoFinal,
        escopoSexo: ctx.body.escopoSexo as "AMBOS" | "MASCULINO" | "FEMININO" | "UNISSEX",
        alpha: ctx.body.alpha,
        idadeDivisaoFisher: ctx.body.idadeDivisaoFisher,
        idsVersoesCandidatas: ctx.body.idsVersoesCandidatas,
        observacoes: ctx.body.observacoes.map((observation) => ({
          ano: observation.ano,
          idade: observation.idade,
          sexo: observation.sexo as "MASCULINO" | "FEMININO" | "UNISSEX",
          exposicao: observation.exposicao,
          eventosObservados: observation.eventosObservados
        }))
      });
      if (!result) throw new HttpError(500, "O estudo criado não pôde ser recuperado.");
      return result;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, error instanceof Error ? error.message : "Não foi possível executar o estudo de aderência.");
    }
  }

  @Get("/:id")
  @Params(EstudoAderenciaParamsDto)
  @Returns(EstudoAderenciaDetailDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<EstudoAderenciaDetailDto> {
    const result = await getEstudoAderencia(ctx.params.id);
    if (!result) throw new HttpError(404, "Estudo de aderência não encontrado.");
    return result;
  }
}

@Auth()
@Controller({ path: "/api/candidatos-aderencia", tags: ["Aderencia"] })
export class AderenciaCandidatoController {
  @Get("/:id/pontos")
  @Params(AderenciaCandidatoParamsDto)
  @Returns(PontosCandidatoAderenciaDto)
  async pontos(ctx: RequestContext<unknown, undefined, { id: string }>): Promise<PontosCandidatoAderenciaDto> {
    const result = await getPontosCandidatoAderencia(ctx.params.id);
    if (!result) throw new HttpError(404, "Resultado candidato não encontrado.");
    return result;
  }
}

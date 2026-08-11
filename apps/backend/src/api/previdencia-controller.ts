import { Auth, Body, Controller, Get, HttpError, Params, Post, Returns, t, type RequestContext } from "adorn-api";
import {
  aprovarSubmassa,
  avaliarBeneficio,
  criarEntidade,
  criarSubmassa,
  criarUnidadeReferencia,
  definirBeneficios,
  definirValorUnidade,
  listarEntidades,
  listarSubmassas,
  obterSubmassa
} from "../previdencia/previdencia-service.js";
import {
  CriarEntidadePrevidenciaDto,
  CriarSubmassaDto,
  CriarUnidadeReferenciaDto,
  CriarValorUnidadeReferenciaDto,
  AvaliarBeneficioDto,
  DefinirBeneficiosDto,
  EntidadePrevidenciaDto,
  ParametroPlanoDto,
  ParametroSubmassaDto,
  SubmassaDto,
  UnidadeReferenciaDto,
  ValorUnidadeReferenciaDto
} from "./previdencia-dtos.js";

function invalido(erro: unknown): never { throw new HttpError(400, erro instanceof Error ? erro.message : "Operação inválida."); }

@Auth()
@Controller({ path: "/api", tags: ["Previdência"] })
export class PrevidenciaController {
  @Get("/entidades-previdencia") @Returns(t.array(t.ref(EntidadePrevidenciaDto)))
  async listarEntidades(): Promise<EntidadePrevidenciaDto[]> { return (await listarEntidades()).map((entidade) => ({ ...entidade, cnpj: entidade.cnpj ?? null })); }

  @Post("/entidades-previdencia") @Body(CriarEntidadePrevidenciaDto) @Returns({ status: 201, schema: EntidadePrevidenciaDto })
  async criarEntidade(ctx: RequestContext<CriarEntidadePrevidenciaDto>): Promise<EntidadePrevidenciaDto> { try { const entidade = await criarEntidade(ctx.body); return { ...entidade, cnpj: entidade.cnpj ?? null }; } catch (erro) { return invalido(erro); } }

  @Get("/planos/:planoId/submassas") @Params(ParametroPlanoDto) @Returns(t.array(t.ref(SubmassaDto)))
  async listarSubmassas(ctx: RequestContext<unknown, undefined, { planoId: string }>): Promise<SubmassaDto[]> { try { return (await listarSubmassas(ctx.params.planoId)).map((submassa) => ({ ...submassa, vigenciaFinal: submassa.vigenciaFinal ?? null, impressaoDigitalRegras: submassa.impressaoDigitalRegras ?? null, observacoes: submassa.observacoes ?? null, aprovadaEm: submassa.aprovadaEm ?? null })); } catch (erro) { return invalido(erro); } }

  @Post("/planos/:planoId/submassas") @Params(ParametroPlanoDto) @Body(CriarSubmassaDto) @Returns({ status: 201, schema: SubmassaDto })
  async criarSubmassa(ctx: RequestContext<CriarSubmassaDto, undefined, { planoId: string }>): Promise<SubmassaDto> { try { const submassa = await criarSubmassa(ctx.params.planoId, ctx.body); return { ...submassa, vigenciaFinal: submassa.vigenciaFinal ?? null, impressaoDigitalRegras: submassa.impressaoDigitalRegras ?? null, observacoes: submassa.observacoes ?? null, aprovadaEm: submassa.aprovadaEm ?? null }; } catch (erro) { return invalido(erro); } }

  @Get("/submassas/:id") @Params(ParametroSubmassaDto) @Returns(t.any())
  async obterSubmassa(ctx: RequestContext<unknown, undefined, { id: string }>) { const resultado = await obterSubmassa(ctx.params.id); if (!resultado) throw new HttpError(404, "Submassa não encontrada."); return resultado; }

  @Post("/submassas/:id/beneficios") @Params(ParametroSubmassaDto) @Body(DefinirBeneficiosDto) @Returns(t.any())
  async definirBeneficios(ctx: RequestContext<DefinirBeneficiosDto, undefined, { id: string }>) { try { return await definirBeneficios(ctx.params.id, ctx.body.beneficios); } catch (erro) { return invalido(erro); } }

  @Post("/submassas/:id/aprovar") @Params(ParametroSubmassaDto) @Returns(t.any())
  async aprovarSubmassa(ctx: RequestContext<unknown, undefined, { id: string }>) { try { return await aprovarSubmassa(ctx.params.id); } catch (erro) { return invalido(erro); } }

  @Post("/beneficios/:id/avaliar") @Params(ParametroSubmassaDto) @Body(AvaliarBeneficioDto) @Returns(t.any())
  async avaliarBeneficio(ctx: RequestContext<AvaliarBeneficioDto, undefined, { id: string }>) { try { return await avaliarBeneficio(ctx.params.id, ctx.body); } catch (erro) { return invalido(erro); } }

  @Post("/unidades-referencia") @Body(CriarUnidadeReferenciaDto) @Returns({ status: 201, schema: UnidadeReferenciaDto })
  async criarUnidade(ctx: RequestContext<CriarUnidadeReferenciaDto>): Promise<UnidadeReferenciaDto> { try { return await criarUnidadeReferencia(ctx.body); } catch (erro) { return invalido(erro); } }

  @Post("/unidades-referencia/:id/valores") @Params(ParametroSubmassaDto) @Body(CriarValorUnidadeReferenciaDto) @Returns({ status: 201, schema: ValorUnidadeReferenciaDto })
  async definirValor(ctx: RequestContext<CriarValorUnidadeReferenciaDto, undefined, { id: string }>): Promise<ValorUnidadeReferenciaDto> { try { const valor = await definirValorUnidade(ctx.params.id, ctx.body); return { ...valor, vigenciaFinal: valor.vigenciaFinal ?? null }; } catch (erro) { return invalido(erro); } }
}

import { Auth, Body, Controller, Get, HttpError, Params, Patch, Post, Returns, t, type RequestContext } from "adorn-api";
import { createClosing, finalizeClosing, getClosing, listClosings, updateClosing } from "../closing/closing-service.js";
import { ActuarialClosingDto, ActuarialClosingParamsDto, ClosingEvaluationParamsDto, CreateActuarialClosingDto, UpdateActuarialClosingDto } from "./closing-dtos.js";
const badRequest = (error: unknown): never => { throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida."); };
@Auth() @Controller({ path: "/api", tags: ["Closing"] }) export class ClosingController {
  @Get("/evaluations/:evaluationId/closings") @Params(ClosingEvaluationParamsDto) @Returns(t.array(t.ref(ActuarialClosingDto))) list(ctx: RequestContext<unknown, undefined, { evaluationId: number }>) { return listClosings(ctx.params.evaluationId); }
  @Post("/evaluations/:evaluationId/closings") @Params(ClosingEvaluationParamsDto) @Body(CreateActuarialClosingDto) @Returns({ status: 201, schema: ActuarialClosingDto }) async create(ctx: RequestContext<CreateActuarialClosingDto, undefined, { evaluationId: number }>) { try { return await createClosing(ctx.params.evaluationId, ctx.body); } catch (error) { return badRequest(error); } }
  @Get("/closings/:id") @Params(ActuarialClosingParamsDto) @Returns(ActuarialClosingDto) async get(ctx: RequestContext<unknown, undefined, { id: string }>) { const value = await getClosing(ctx.params.id); if (!value) throw new HttpError(404, "Fechamento não encontrado."); return value; }
  @Patch("/closings/:id") @Params(ActuarialClosingParamsDto) @Body(UpdateActuarialClosingDto) @Returns(ActuarialClosingDto) async update(ctx: RequestContext<UpdateActuarialClosingDto, undefined, { id: string }>) { try { return await updateClosing(ctx.params.id, ctx.body); } catch (error) { return badRequest(error); } }
  @Post("/closings/:id/finalize") @Params(ActuarialClosingParamsDto) @Returns(ActuarialClosingDto) async finalize(ctx: RequestContext<unknown, undefined, { id: string }>) { try { return await finalizeClosing(ctx.params.id); } catch (error) { return badRequest(error); } }
}

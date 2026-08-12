import {
  Auth,
  Body,
  Controller,
  Get,
  HttpError,
  Params,
  Patch,
  Post,
  Public,
  Returns,
  extractBearerToken,
  getUser,
  t,
  type RequestContext
} from "adorn-api";
import {
  createUsuario,
  listUsuarios,
  login,
  logout,
  updateUsuario,
  type ApplicationUsuarioAutenticado
} from "../auth/auth-service.js";
import {
  UsuarioAutenticadoDto,
  CriarUsuarioDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  AtualizarUsuarioDto,
  UsuarioParamsDto
} from "./auth-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api/auth", tags: ["Autenticacao"] })
export class AuthController {
  @Post("/login")
  @Public()
  @Body(LoginRequestDto)
  @Returns(LoginResponseDto)
  async login(ctx: RequestContext<LoginRequestDto>): Promise<LoginResponseDto> {
    const result = await login(ctx.body.email, ctx.body.password);
    if (!result) throw new HttpError(401, "E-mail ou senha inválidos.");
    return result;
  }

  @Get("/me")
  @Returns(UsuarioAutenticadoDto)
  async me(ctx: RequestContext): Promise<UsuarioAutenticadoDto> {
    const authenticated = getUser<ApplicationUsuarioAutenticado>(ctx.req);
    if (!authenticated) throw new HttpError(401, "Sessão inválida.");
    const user = (await listUsuarios()).find((candidato) => candidato.id === authenticated.id);
    if (!user) throw new HttpError(401, "Usuário não encontrado.");
    return user;
  }

  @Post("/logout")
  @Returns(LogoutResponseDto)
  async logout(ctx: RequestContext): Promise<LogoutResponseDto> {
    const token = extractBearerToken(ctx.req);
    if (!token) throw new HttpError(401, "Sessão inválida.");
    await logout(token);
    return { ok: true };
  }
}

@Auth({ roles: ["admin"] })
@Controller({ path: "/api/usuarios", tags: ["Usuarios"] })
export class UsuarioController {
  @Get("/")
  @Returns(t.array(t.ref(UsuarioAutenticadoDto)))
  async list(): Promise<UsuarioAutenticadoDto[]> {
    return listUsuarios();
  }

  @Post("/")
  @Body(CriarUsuarioDto)
  @Returns({ status: 201, schema: UsuarioAutenticadoDto })
  async create(ctx: RequestContext<CriarUsuarioDto>): Promise<UsuarioAutenticadoDto> {
    try {
      return await createUsuario(ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/:id")
  @Params(UsuarioParamsDto)
  @Body(AtualizarUsuarioDto)
  @Returns(UsuarioAutenticadoDto)
  async update(
    ctx: RequestContext<AtualizarUsuarioDto, undefined, { id: string }>
  ): Promise<UsuarioAutenticadoDto> {
    try {
      const user = await updateUsuario(ctx.params.id, ctx.body);
      if (!user) throw new HttpError(404, "Usuário não encontrado.");
      return user;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return badRequest(error);
    }
  }
}

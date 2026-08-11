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
  createUser,
  listUsers,
  login,
  logout,
  updateUser,
  type ApplicationAuthUser
} from "../auth/auth-service.js";
import {
  AuthUserDto,
  CreateUserDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  UpdateUserDto,
  UserParamsDto
} from "./auth-dtos.js";

function badRequest(error: unknown): never {
  throw new HttpError(400, error instanceof Error ? error.message : "Operação inválida.");
}

@Auth()
@Controller({ path: "/api/auth", tags: ["Authentication"] })
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
  @Returns(AuthUserDto)
  async me(ctx: RequestContext): Promise<AuthUserDto> {
    const authenticated = getUser<ApplicationAuthUser>(ctx.req);
    if (!authenticated) throw new HttpError(401, "Sessão inválida.");
    const user = (await listUsers()).find((candidate) => candidate.id === authenticated.id);
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
@Controller({ path: "/api/users", tags: ["Users"] })
export class UserController {
  @Get("/")
  @Returns(t.array(t.ref(AuthUserDto)))
  async list(): Promise<AuthUserDto[]> {
    return listUsers();
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: AuthUserDto })
  async create(ctx: RequestContext<CreateUserDto>): Promise<AuthUserDto> {
    try {
      return await createUser(ctx.body);
    } catch (error) {
      return badRequest(error);
    }
  }

  @Patch("/:id")
  @Params(UserParamsDto)
  @Body(UpdateUserDto)
  @Returns(AuthUserDto)
  async update(
    ctx: RequestContext<UpdateUserDto, undefined, { id: string }>
  ): Promise<AuthUserDto> {
    try {
      const user = await updateUser(ctx.params.id, ctx.body);
      if (!user) throw new HttpError(404, "Usuário não encontrado.");
      return user;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return badRequest(error);
    }
  }
}

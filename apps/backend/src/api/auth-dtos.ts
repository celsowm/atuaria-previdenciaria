import { Dto, Field, t } from "adorn-api";

@Dto({ name: "UsuarioAutenticado", description: "Authenticated ATUAS user." })
export class UsuarioAutenticadoDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "email" })) email!: string;
  @Field(t.string()) nomeExibicao!: string;
  @Field(t.string()) perfil!: string;
  @Field(t.boolean()) ativo!: boolean;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) ultimoAcessoEm!: string | null;
}

@Dto({ name: "LoginRequest", description: "Local account credentials." })
export class LoginRequestDto {
  @Field(t.string({ format: "email" })) email!: string;
  @Field(t.string({ minLength: 1 })) password!: string;
}

@Dto({ name: "LoginResponse", description: "Opaque bearer session created after authentication." })
export class LoginResponseDto {
  @Field(t.string()) token!: string;
  @Field(t.string({ format: "date-time" })) expiraEm!: string;
  @Field(t.ref(UsuarioAutenticadoDto)) user!: UsuarioAutenticadoDto;
}

@Dto({ name: "CriarUsuario", description: "Create a local ATUAS account." })
export class CriarUsuarioDto {
  @Field(t.string({ format: "email" })) email!: string;
  @Field(t.string({ minLength: 1 })) nomeExibicao!: string;
  @Field(t.string({ minLength: 10 })) password!: string;
  @Field(t.string()) perfil!: string;
}

@Dto({ name: "AtualizarUsuario", description: "Administrative changes to a local ATUAS account." })
export class AtualizarUsuarioDto {
  @Field(t.optional(t.string({ minLength: 1 }))) nomeExibicao?: string;
  @Field(t.optional(t.string())) perfil?: string;
  @Field(t.optional(t.boolean())) ativo?: boolean;
  @Field(t.optional(t.string({ minLength: 10 }))) password?: string;
}

@Dto({ name: "UsuarioParams" })
export class UsuarioParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "LogoutResponse" })
export class LogoutResponseDto {
  @Field(t.boolean()) ok!: boolean;
}

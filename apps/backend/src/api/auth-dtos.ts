import { Dto, Field, t } from "adorn-api";

@Dto({ name: "AuthUser", description: "Authenticated ATUAS user." })
export class AuthUserDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "email" })) email!: string;
  @Field(t.string()) displayName!: string;
  @Field(t.string()) role!: string;
  @Field(t.boolean()) active!: boolean;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) lastLoginAt!: string | null;
}

@Dto({ name: "LoginRequest", description: "Local account credentials." })
export class LoginRequestDto {
  @Field(t.string({ format: "email" })) email!: string;
  @Field(t.string({ minLength: 1 })) password!: string;
}

@Dto({ name: "LoginResponse", description: "Opaque bearer session created after authentication." })
export class LoginResponseDto {
  @Field(t.string()) token!: string;
  @Field(t.string({ format: "date-time" })) expiresAt!: string;
  @Field(t.ref(AuthUserDto)) user!: AuthUserDto;
}

@Dto({ name: "CreateUser", description: "Create a local ATUAS account." })
export class CreateUserDto {
  @Field(t.string({ format: "email" })) email!: string;
  @Field(t.string({ minLength: 1 })) displayName!: string;
  @Field(t.string({ minLength: 10 })) password!: string;
  @Field(t.string()) role!: string;
}

@Dto({ name: "UpdateUser", description: "Administrative changes to a local ATUAS account." })
export class UpdateUserDto {
  @Field(t.optional(t.string({ minLength: 1 }))) displayName?: string;
  @Field(t.optional(t.string())) role?: string;
  @Field(t.optional(t.boolean())) active?: boolean;
  @Field(t.optional(t.string({ minLength: 10 }))) password?: string;
}

@Dto({ name: "UserParams" })
export class UserParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "LogoutResponse" })
export class LogoutResponseDto {
  @Field(t.boolean()) ok!: boolean;
}

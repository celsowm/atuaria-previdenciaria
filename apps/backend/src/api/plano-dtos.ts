import { Dto, Field, t } from "adorn-api";

@Dto({ name: "Plano", description: "Pension plan managed by Atuária Previdenciária." })
export class PlanoDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) entidadePrevidenciaId!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) nome!: string;
  @Field(t.string()) modalidade!: string;
  @Field(t.nullable(t.string())) nomePatrocinador!: string | null;
  @Field(t.nullable(t.string())) cnpj!: string | null;
  @Field(t.string()) situacao!: string;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
}

@Dto({ name: "CriarPlano", description: "Criar um plano previdenciário." })
export class CriarPlanoDto {
  @Field(t.string({ format: "uuid" })) entidadePrevidenciaId!: string;
  @Field(t.string({ minLength: 1, maxLength: 40 })) codigo!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) nome!: string;
  @Field(t.string({ minLength: 1 })) modalidade!: string;
  @Field(t.optional(t.string({ maxLength: 200 }))) nomePatrocinador?: string;
  @Field(t.optional(t.string({ maxLength: 20 }))) cnpj?: string;
}

@Dto({ name: "AtualizarPlano", description: "Atualizar os dados mestres do plano." })
export class AtualizarPlanoDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 40 }))) codigo?: string;
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) nome?: string;
  @Field(t.optional(t.string({ minLength: 1 }))) modalidade?: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 200 })))) nomePatrocinador?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 20 })))) cnpj?: string | null;
  @Field(t.optional(t.string({ minLength: 1 }))) situacao?: string;
}

@Dto({ name: "PlanParams" })
export class PlanoParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

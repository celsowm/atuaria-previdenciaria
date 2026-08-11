import { Dto, Field, t } from "adorn-api";

@Dto({ name: "Plan", description: "Pension plan managed by Atuária Previdenciária." })
export class PlanDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) entidadePrevidenciaId!: string;
  @Field(t.string()) code!: string;
  @Field(t.string()) name!: string;
  @Field(t.string()) modality!: string;
  @Field(t.nullable(t.string())) sponsorName!: string | null;
  @Field(t.nullable(t.string())) cnpj!: string | null;
  @Field(t.string()) status!: string;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
}

@Dto({ name: "CreatePlan", description: "Create a pension plan." })
export class CreatePlanDto {
  @Field(t.string({ format: "uuid" })) entidadePrevidenciaId!: string;
  @Field(t.string({ minLength: 1, maxLength: 40 })) code!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) name!: string;
  @Field(t.string({ minLength: 1 })) modality!: string;
  @Field(t.optional(t.string({ maxLength: 200 }))) sponsorName?: string;
  @Field(t.optional(t.string({ maxLength: 20 }))) cnpj?: string;
}

@Dto({ name: "UpdatePlan", description: "Update plan master data." })
export class UpdatePlanDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 40 }))) code?: string;
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) name?: string;
  @Field(t.optional(t.string({ minLength: 1 }))) modality?: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 200 })))) sponsorName?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 20 })))) cnpj?: string | null;
  @Field(t.optional(t.string({ minLength: 1 }))) status?: string;
}

@Dto({ name: "PlanParams" })
export class PlanParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

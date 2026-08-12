import { Dto, Field, t } from "adorn-api";

@Dto({ name: "ActuarialClosingLine" })
export class ActuarialClosingLineDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) code!: string;
  @Field(t.string()) category!: string;
  @Field(t.string()) label!: string;
  @Field(t.string()) valueJson!: string;
  @Field(t.nullable(t.string())) unit!: string | null;
  @Field(t.string()) source!: string;
  @Field(t.integer({ minimum: 0 })) ordinal!: number;
}

@Dto({ name: "ActuarialClosing" })
export class ActuarialClosingDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.integer({ minimum: 1 })) evaluationId!: number;
  @Field(t.string({ format: "uuid" })) calculationRunId!: string;
  @Field(t.enum(["DRAFT", "FINALIZED"])) status!: string;
  @Field(t.nullable(t.string())) notes!: string | null;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) finalizedAt!: string | null;
  @Field(t.array(t.ref(ActuarialClosingLineDto))) lines!: ActuarialClosingLineDto[];
}

@Dto({ name: "CreateActuarialClosing" })
export class CreateActuarialClosingDto { @Field(t.string({ format: "uuid" })) calculationRunId!: string; @Field(t.optional(t.nullable(t.string()))) notes?: string | null; }
@Dto({ name: "UpdateActuarialClosing" })
export class UpdateActuarialClosingDto { @Field(t.optional(t.nullable(t.string()))) notes?: string | null; }
@Dto({ name: "ActuarialClosingParams" })
export class ActuarialClosingParamsDto { @Field(t.string({ format: "uuid" })) id!: string; }
@Dto({ name: "ClosingEvaluationParams" })
export class ClosingEvaluationParamsDto { @Field(t.integer({ minimum: 1 })) evaluationId!: number; }

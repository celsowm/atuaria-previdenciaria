import { Dto, Field, t } from "adorn-api";

@Dto({ name: "CalculationEngine", description: "Registered deterministic calculation engine." })
export class CalculationEngineDto {
  @Field(t.string()) code!: string;
  @Field(t.string()) version!: string;
  @Field(t.string()) label!: string;
  @Field(t.string()) description!: string;
  @Field(t.enum(["PRECALCULATION", "ACTUARIAL"])) resultKind!: string;
  @Field(t.boolean()) requiresPlanRules!: boolean;
  @Field(t.array(t.enum(["BD", "CD", "CV"]), { minItems: 1 })) supportedModalities!: string[];
}

@Dto({ name: "CalculationRunSummary", description: "Immutable calculation run metadata." })
export class CalculationRunSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.integer({ minimum: 1 })) evaluationId!: number;
  @Field(t.string({ format: "uuid" })) parameterizationId!: string;
  @Field(t.nullable(t.string({ format: "uuid" }))) planRulesVersionId!: string | null;
  @Field(t.nullable(t.string())) planRulesFingerprint!: string | null;
  @Field(t.string()) engineCode!: string;
  @Field(t.string()) engineVersion!: string;
  @Field(t.enum(["PROCESSING", "COMPLETED", "FAILED"])) status!: string;
  @Field(t.string()) inputFingerprint!: string;
  @Field(t.nullable(t.string())) resultFingerprint!: string | null;
  @Field(t.integer({ minimum: 0 })) inputImportCount!: number;
  @Field(t.integer({ minimum: 0 })) inputRowCount!: number;
  @Field(t.integer({ minimum: 0 })) validRowCount!: number;
  @Field(t.integer({ minimum: 0 })) invalidRowCount!: number;
  @Field(t.integer({ minimum: 0 })) participantResultCount!: number;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) completedAt!: string | null;
  @Field(t.nullable(t.string())) errorMessage!: string | null;
}

@Dto({ name: "CalculationInput", description: "Frozen import selected as calculation input." })
export class CalculationInputDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) importJobId!: string;
  @Field(t.string()) population!: string;
  @Field(t.string()) fileSha256!: string;
  @Field(t.string()) schemaFingerprint!: string;
  @Field(t.string()) canonicalFingerprint!: string;
  @Field(t.integer({ minimum: 0 })) rowCount!: number;
  @Field(t.integer({ minimum: 0 })) validRows!: number;
  @Field(t.integer({ minimum: 0 })) invalidRows!: number;
  @Field(t.string({ format: "date-time" })) importedAt!: string;
}

@Dto({ name: "CalculationResultMetric", description: "Typed deterministic metric produced by a calculation engine." })
export class CalculationResultMetricDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) code!: string;
  @Field(t.string()) category!: string;
  @Field(t.string()) label!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) valueType!: string;
  @Field(t.string()) valueJson!: string;
  @Field(t.nullable(t.string())) unit!: string | null;
  @Field(t.integer({ minimum: 0 })) ordinal!: number;
}

@Dto({ name: "CalculationParticipantResult", description: "Participant-level result for actuarial reconciliation." })
export class CalculationParticipantResultDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) importJobId!: string;
  @Field(t.string()) population!: string;
  @Field(t.integer({ minimum: 1 })) sourceRowNumber!: number;
  @Field(t.nullable(t.string())) participantRegistration!: string | null;
  @Field(t.string()) resultJson!: string;
  @Field(t.integer({ minimum: 0 })) ordinal!: number;
}

@Dto({ name: "CalculationParticipantResultPage", description: "Paged participant-level calculation results." })
export class CalculationParticipantResultPageDto {
  @Field(t.array(t.ref(CalculationParticipantResultDto))) items!: CalculationParticipantResultDto[];
  @Field(t.integer({ minimum: 0 })) totalItems!: number;
  @Field(t.integer({ minimum: 1 })) page!: number;
  @Field(t.integer({ minimum: 1, maximum: 200 })) pageSize!: number;
}

@Dto({ name: "CalculationParticipantQuery" })
export class CalculationParticipantQueryDto {
  @Field(t.optional(t.integer({ minimum: 1 }))) page?: number;
  @Field(t.optional(t.integer({ minimum: 1, maximum: 200 }))) pageSize?: number;
}

@Dto({ name: "CalculationRun", description: "Complete immutable calculation run with frozen inputs and aggregate metrics." })
export class CalculationRunDto extends CalculationRunSummaryDto {
  @Field(t.string()) parameterFingerprint!: string;
  @Field(t.string()) dataFingerprint!: string;
  @Field(t.array(t.ref(CalculationInputDto))) inputs!: CalculationInputDto[];
  @Field(t.array(t.ref(CalculationResultMetricDto))) metrics!: CalculationResultMetricDto[];
}

@Dto({ name: "CreateCalculationRun", description: "Execute one registered engine against approved immutable inputs." })
export class CreateCalculationRunDto {
  @Field(t.string({ format: "uuid" })) parameterizationId!: string;
  @Field(t.optional(t.string({ format: "uuid" }))) planRulesVersionId?: string;
  @Field(t.optional(t.string({ minLength: 1 }))) engineCode?: string;
}

@Dto({ name: "CalculationEvaluationParams" })
export class CalculationEvaluationParamsDto {
  @Field(t.integer({ minimum: 1 })) evaluationId!: number;
}

@Dto({ name: "CalculationRunParams" })
export class CalculationRunParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

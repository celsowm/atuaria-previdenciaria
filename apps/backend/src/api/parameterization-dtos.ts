import { Dto, Field, t } from "adorn-api";

@Dto({ name: "ActuarialParameterValue", description: "Typed value captured inside a versioned actuarial parameterization snapshot." })
export class ActuarialParameterValueDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) code!: string;
  @Field(t.string()) category!: string;
  @Field(t.string()) label!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) valueType!: string;
  @Field(t.string()) valueJson!: string;
  @Field(t.nullable(t.string())) unit!: string | null;
  @Field(t.string()) source!: string;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
}

@Dto({ name: "ActuarialHypothesisSelection", description: "Adherence-study candidate promoted into an actuarial parameterization snapshot." })
export class ActuarialHypothesisSelectionDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) hypothesisType!: string;
  @Field(t.string({ format: "uuid" })) adherenceStudyId!: string;
  @Field(t.string({ format: "uuid" })) candidateResultId!: string;
  @Field(t.string({ format: "uuid" })) biometricVersionId!: string;
  @Field(t.string()) tableCode!: string;
  @Field(t.string()) tableName!: string;
  @Field(t.string()) versionLabel!: string;
  @Field(t.integer({ minimum: 1 })) candidateRank!: number;
  @Field(t.string({ format: "date-time" })) selectedAt!: string;
}

@Dto({ name: "ActuarialParameterizationSummary", description: "Versioned actuarial parameterization metadata." })
export class ActuarialParameterizationSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.integer({ minimum: 1 })) evaluationId!: number;
  @Field(t.integer({ minimum: 1 })) version!: number;
  @Field(t.string()) name!: string;
  @Field(t.enum(["DRAFT", "APPROVED", "SUPERSEDED"])) status!: string;
  @Field(t.nullable(t.string())) notes!: string | null;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) approvedAt!: string | null;
}

@Dto({ name: "ActuarialParameterization", description: "Complete immutable-ready actuarial parameterization snapshot." })
export class ActuarialParameterizationDto extends ActuarialParameterizationSummaryDto {
  @Field(t.array(t.ref(ActuarialParameterValueDto))) parameters!: ActuarialParameterValueDto[];
  @Field(t.array(t.ref(ActuarialHypothesisSelectionDto))) hypotheses!: ActuarialHypothesisSelectionDto[];
}

@Dto({ name: "CreateActuarialParameterization", description: "Create a new draft parameterization version for an evaluation." })
export class CreateActuarialParameterizationDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) name?: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) notes?: string | null;
  @Field(t.optional(t.string({ format: "uuid" }))) copyFromId?: string;
}

@Dto({ name: "UpdateActuarialParameterization", description: "Update draft-only parameterization metadata." })
export class UpdateActuarialParameterizationDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) name?: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) notes?: string | null;
}

@Dto({ name: "SetActuarialParameterValue", description: "Upsert one typed actuarial parameter value." })
export class SetActuarialParameterValueDto {
  @Field(t.string({ minLength: 1, maxLength: 120 })) code!: string;
  @Field(t.string({ minLength: 1, maxLength: 120 })) category!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) label!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) valueType!: string;
  @Field(t.string({ minLength: 1 })) valueJson!: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 60 })))) unit?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 120 })))) source?: string | null;
}

@Dto({ name: "SetActuarialParameters", description: "Upsert parameter values into a draft parameterization." })
export class SetActuarialParametersDto {
  @Field(t.array(t.ref(SetActuarialParameterValueDto), { minItems: 1 })) parameters!: SetActuarialParameterValueDto[];
}

@Dto({ name: "PromoteAdherenceCandidate", description: "Promote one adherence candidate into the draft parameterization." })
export class PromoteAdherenceCandidateDto {
  @Field(t.string({ format: "uuid" })) candidateResultId!: string;
}

@Dto({ name: "EvaluationParameterizationParams" })
export class EvaluationParameterizationParamsDto {
  @Field(t.integer({ minimum: 1 })) evaluationId!: number;
}

@Dto({ name: "ActuarialParameterizationParams" })
export class ActuarialParameterizationParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

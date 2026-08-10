import { Dto, Field, t } from "adorn-api";

@Dto({ name: "AdherenceObservation", description: "Historical exposure and observed events by year, age and sex." })
export class AdherenceObservationDto {
  @Field(t.integer({ minimum: 1900, maximum: 2200 })) year!: number;
  @Field(t.integer({ minimum: 0, maximum: 130 })) age!: number;
  @Field(t.enum(["MALE", "FEMALE", "UNISEX"])) sex!: string;
  @Field(t.number({ exclusiveMinimum: 0 })) exposure!: number;
  @Field(t.integer({ minimum: 0 })) observedEvents!: number;
}

@Dto({ name: "CreateAdherenceStudy", description: "Execute and persist an adherence study against biometric table versions." })
export class CreateAdherenceStudyDto {
  @Field(t.optional(t.integer({ minimum: 1 }))) evaluationId?: number;
  @Field(t.string({ minLength: 1 })) name!: string;
  @Field(t.string({ minLength: 1 })) hypothesisType!: string;
  @Field(t.integer({ minimum: 1900, maximum: 2200 })) periodStart!: number;
  @Field(t.integer({ minimum: 1900, maximum: 2200 })) periodEnd!: number;
  @Field(t.enum(["BOTH", "MALE", "FEMALE", "UNISEX"])) sexScope!: string;
  @Field(t.number({ exclusiveMinimum: 0, exclusiveMaximum: 1 })) alpha!: number;
  @Field(t.integer({ minimum: 0, maximum: 130 })) fisherSplitAge!: number;
  @Field(t.array(t.string({ format: "uuid" }), { minItems: 1, uniqueItems: true })) candidateVersionIds!: string[];
  @Field(t.array(t.ref(AdherenceObservationDto), { minItems: 1 })) observations!: AdherenceObservationDto[];
}

@Dto({ name: "AdherenceStudySummary", description: "Persisted adherence study summary." })
export class AdherenceStudySummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.nullable(t.integer())) evaluationId!: number | null;
  @Field(t.string()) name!: string;
  @Field(t.string()) hypothesisType!: string;
  @Field(t.integer()) periodStart!: number;
  @Field(t.integer()) periodEnd!: number;
  @Field(t.string()) sexScope!: string;
  @Field(t.number()) alpha!: number;
  @Field(t.string()) status!: string;
  @Field(t.string()) engineVersion!: string;
  @Field(t.integer({ minimum: 0 })) observationCount!: number;
  @Field(t.integer({ minimum: 0 })) candidateCount!: number;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) completedAt!: string | null;
}

@Dto({ name: "AdherenceCandidateResult", description: "Statistical adherence result for one immutable biometric version." })
export class AdherenceCandidateResultDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) biometricVersionId!: string;
  @Field(t.string()) tableCode!: string;
  @Field(t.string()) tableName!: string;
  @Field(t.string()) versionLabel!: string;
  @Field(t.integer({ minimum: 1 })) rank!: number;
  @Field(t.number({ minimum: 0 })) observedEvents!: number;
  @Field(t.number({ minimum: 0 })) expectedEvents!: number;
  @Field(t.number({ minimum: 0 })) chiSquare!: number;
  @Field(t.integer({ minimum: 1 })) chiSquareDf!: number;
  @Field(t.number({ minimum: 0 })) chiSquareCritical!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) chiSquareP!: number;
  @Field(t.boolean()) chiSquarePass!: boolean;
  @Field(t.number({ minimum: 0, maximum: 1 })) ksD!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) ksCritical!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) ksP!: number;
  @Field(t.boolean()) ksPass!: boolean;
  @Field(t.number()) zStatistic!: number;
  @Field(t.number({ minimum: 0 })) zCritical!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) zP!: number;
  @Field(t.boolean()) zPass!: boolean;
  @Field(t.number({ minimum: 0, maximum: 1 })) fisherP!: number;
  @Field(t.boolean()) fisherPass!: boolean;
  @Field(t.number({ minimum: 0 })) dqm!: number;
  @Field(t.integer({ minimum: 0, maximum: 4 })) rejectedTests!: number;
}

@Dto({ name: "AdherenceStudyDetail", description: "Study metadata and ranked candidate results." })
export class AdherenceStudyDetailDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.nullable(t.integer())) evaluationId!: number | null;
  @Field(t.string()) name!: string;
  @Field(t.string()) hypothesisType!: string;
  @Field(t.integer()) periodStart!: number;
  @Field(t.integer()) periodEnd!: number;
  @Field(t.string()) sexScope!: string;
  @Field(t.number()) alpha!: number;
  @Field(t.integer()) fisherSplitAge!: number;
  @Field(t.string()) status!: string;
  @Field(t.string()) engineVersion!: string;
  @Field(t.integer({ minimum: 0 })) observationCount!: number;
  @Field(t.integer({ minimum: 0 })) candidateCount!: number;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) completedAt!: string | null;
  @Field(t.array(t.ref(AdherenceCandidateResultDto))) candidates!: AdherenceCandidateResultDto[];
}

@Dto({ name: "AdherenceCandidatePoint", description: "Observed versus expected cell used by the statistical engine." })
export class AdherenceCandidatePointDto {
  @Field(t.integer()) age!: number;
  @Field(t.string()) sex!: string;
  @Field(t.number({ exclusiveMinimum: 0 })) exposure!: number;
  @Field(t.integer({ minimum: 0 })) observedEvents!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) qx!: number;
  @Field(t.number({ minimum: 0 })) expectedEvents!: number;
  @Field(t.number()) residual!: number;
}

@Dto({ name: "AdherenceCandidatePoints", description: "Candidate result with complete observed-versus-expected detail." })
export class AdherenceCandidatePointsDto {
  @Field(t.ref(AdherenceCandidateResultDto)) candidate!: AdherenceCandidateResultDto;
  @Field(t.array(t.ref(AdherenceCandidatePointDto))) points!: AdherenceCandidatePointDto[];
}

@Dto({ name: "AdherenceStudyParams" })
export class AdherenceStudyParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "AdherenceCandidateParams" })
export class AdherenceCandidateParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

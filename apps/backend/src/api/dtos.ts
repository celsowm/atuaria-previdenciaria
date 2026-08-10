import { Dto, Field, t } from "adorn-api";

@Dto({ description: "Actuarial valuation workspace summary." })
export class EvaluationDto {
  @Field(t.integer()) id!: number;
  @Field(t.string()) planName!: string;
  @Field(t.string({ format: "date" })) referenceDate!: string;
  @Field(t.string()) status!: string;
  @Field(t.string()) stage!: string;
  @Field(t.integer({ minimum: 0, maximum: 100 })) progress!: number;
  @Field(t.integer({ minimum: 0 })) blockingIssues!: number;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
}

@Dto({ description: "Reusable import mapping profile." })
export class MappingProfileDto {
  @Field(t.integer()) id!: number;
  @Field(t.string()) name!: string;
  @Field(t.string()) population!: string;
  @Field(t.string()) version!: string;
  @Field(t.integer()) mappedFields!: number;
  @Field(t.integer()) totalFields!: number;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
}

@Dto({ description: "OpenAI-compatible LLM provider configuration summary." })
export class LlmProviderDto {
  @Field(t.integer()) id!: number;
  @Field(t.string()) name!: string;
  @Field(t.string({ format: "uri" })) baseUrl!: string;
  @Field(t.string()) model!: string;
  @Field(t.integer({ minimum: 0 })) credentialCount!: number;
  @Field(t.boolean()) enabled!: boolean;
}

@Dto({ description: "Operational dashboard totals." })
export class DashboardDto {
  @Field(t.integer()) inProgress!: number;
  @Field(t.integer()) awaitingCorrections!: number;
  @Field(t.integer()) pendingStudies!: number;
  @Field(t.integer()) draftsAwaitingReview!: number;
}

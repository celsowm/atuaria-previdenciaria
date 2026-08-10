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

@Dto({ description: "Find the best reusable mapping profile for a workbook schema." })
export class MappingProfileMatchRequestDto {
  @Field(t.string({ minLength: 1 })) population!: string;
  @Field(t.array(t.string({ minLength: 1 }))) headers!: string[];
}

@Dto({ description: "Compatibility result against a previous mapping profile." })
export class MappingProfileMatchDto {
  @Field(t.boolean()) matched!: boolean;
  @Field(t.optional(t.integer())) profileId?: number;
  @Field(t.optional(t.string())) profileName?: string;
  @Field(t.optional(t.string())) version?: string;
  @Field(t.integer({ minimum: 0, maximum: 100 })) compatibility!: number;
  @Field(t.boolean()) exact!: boolean;
  @Field(t.array(t.string())) missingColumns!: string[];
  @Field(t.array(t.string())) newColumns!: string[];
  @Field(t.string()) rulesJson!: string;
}

@Dto({ description: "Multipart metadata used to execute an auditable workbook import." })
export class CreateImportDto {
  @Field(t.string({ minLength: 1 })) population!: string;
  @Field(t.optional(t.integer({ minimum: 1 }))) evaluationId?: number;
  @Field(t.optional(t.integer({ minimum: 1 }))) profileId?: number;
  @Field(t.optional(t.string({ minLength: 1 }))) profileName?: string;
  @Field(t.optional(t.boolean())) saveProfile?: boolean;
  @Field(t.optional(t.string({ minLength: 1 }))) sheetName?: string;
  @Field(t.integer({ minimum: 1 })) headerRow!: number;
  @Field(t.string({ minLength: 2 })) rulesJson!: string;
}

@Dto({ description: "Completed Data Studio import with persisted RAW, normalized and canonical rows." })
export class ImportResultDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) fileId!: string;
  @Field(t.optional(t.integer())) mappingProfileId?: number | null;
  @Field(t.optional(t.string())) mappingProfileVersion?: string | null;
  @Field(t.string()) fileName!: string;
  @Field(t.string()) fileSha256!: string;
  @Field(t.string()) population!: string;
  @Field(t.string()) sheetName!: string;
  @Field(t.integer({ minimum: 0 })) rowCount!: number;
  @Field(t.integer({ minimum: 0 })) validRows!: number;
  @Field(t.integer({ minimum: 0 })) invalidRows!: number;
  @Field(t.string()) status!: string;
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
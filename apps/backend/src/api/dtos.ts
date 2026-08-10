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
  @Field(t.nullable(t.integer())) mappingProfileId!: number | null;
  @Field(t.nullable(t.string())) mappingProfileVersion!: string | null;
  @Field(t.string()) fileName!: string;
  @Field(t.string()) fileSha256!: string;
  @Field(t.string()) population!: string;
  @Field(t.string()) sheetName!: string;
  @Field(t.integer({ minimum: 0 })) rowCount!: number;
  @Field(t.integer({ minimum: 0 })) validRows!: number;
  @Field(t.integer({ minimum: 0 })) invalidRows!: number;
  @Field(t.string()) status!: string;
}

@Dto({ description: "Start deterministic cadastral critique for a persisted import." })
export class CreateCritiqueRunDto {
  @Field(t.string({ format: "uuid" })) importJobId!: string;
  @Field(t.optional(t.string({ format: "uuid" }))) previousImportJobId?: string;
}

@Dto({ description: "Persisted cadastral critique execution summary." })
export class CritiqueRunDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) importJobId!: string;
  @Field(t.nullable(t.string({ format: "uuid" }))) previousImportJobId!: string | null;
  @Field(t.string()) status!: string;
  @Field(t.integer({ minimum: 0 })) blockingCount!: number;
  @Field(t.integer({ minimum: 0 })) inconsistencyCount!: number;
  @Field(t.integer({ minimum: 0 })) warningCount!: number;
  @Field(t.integer({ minimum: 0 })) infoCount!: number;
  @Field(t.integer({ minimum: 0 })) totalIssues!: number;
  @Field(t.boolean()) comparedWithPrevious!: boolean;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) completedAt!: string | null;
}

@Dto()
export class CritiqueRunParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ description: "Cadastral critique occurrence." })
export class CritiqueIssueDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) ruleCode!: string;
  @Field(t.string()) severity!: string;
  @Field(t.string()) category!: string;
  @Field(t.string()) status!: string;
  @Field(t.nullable(t.string())) participantRegistration!: string | null;
  @Field(t.nullable(t.string())) fieldPath!: string | null;
  @Field(t.nullable(t.string())) currentValueJson!: string | null;
  @Field(t.nullable(t.string())) previousValueJson!: string | null;
  @Field(t.string()) message!: string;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
}

@Dto()
export class CritiqueIssueParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ description: "Critique occurrence with complete source-data provenance." })
export class CritiqueIssueDetailDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) ruleCode!: string;
  @Field(t.string()) severity!: string;
  @Field(t.string()) category!: string;
  @Field(t.string()) status!: string;
  @Field(t.nullable(t.string())) participantRegistration!: string | null;
  @Field(t.nullable(t.string())) fieldPath!: string | null;
  @Field(t.nullable(t.string())) currentValueJson!: string | null;
  @Field(t.nullable(t.string())) previousValueJson!: string | null;
  @Field(t.string()) message!: string;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.string()) detailsJson!: string;
  @Field(t.nullable(t.string())) rawJson!: string | null;
  @Field(t.nullable(t.string())) normalizedJson!: string | null;
  @Field(t.nullable(t.string())) canonicalJson!: string | null;
  @Field(t.nullable(t.string())) previousCanonicalJson!: string | null;
  @Field(t.nullable(t.string())) resolutionNote!: string | null;
  @Field(t.nullable(t.string({ format: "date-time" }))) resolvedAt!: string | null;
}

@Dto({ description: "Resolve or justify a persisted cadastral critique occurrence." })
export class ResolveCritiqueIssueDto {
  @Field(t.string({ minLength: 1 })) status!: string;
  @Field(t.string({ minLength: 1 })) note!: string;
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

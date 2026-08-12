import { Dto, Field, t } from "adorn-api";

@Dto({ name: "PlanRuleValue", description: "Typed rule captured inside a versioned pension plan rules snapshot." })
export class PlanRuleValueDto {
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

@Dto({ name: "PlanRulesVersionSummary", description: "Versioned pension plan rules metadata." })
export class PlanRulesVersionSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) planId!: string;
  @Field(t.integer({ minimum: 1 })) version!: number;
  @Field(t.string()) name!: string;
  @Field(t.enum(["BD", "CD", "CV"])) modality!: string;
  @Field(t.enum(["DRAFT", "APPROVED", "SUPERSEDED"])) status!: string;
  @Field(t.nullable(t.string({ format: "date" }))) effectiveFrom!: string | null;
  @Field(t.nullable(t.string({ format: "date" }))) effectiveTo!: string | null;
  @Field(t.nullable(t.string())) rulesFingerprint!: string | null;
  @Field(t.nullable(t.string())) notes!: string | null;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) approvedAt!: string | null;
}

@Dto({ name: "PlanRulesVersion", description: "Complete immutable-ready pension plan rules snapshot." })
export class PlanRulesVersionDto extends PlanRulesVersionSummaryDto {
  @Field(t.array(t.ref(PlanRuleValueDto))) rules!: PlanRuleValueDto[];
}

@Dto({ name: "CreatePlanRulesVersion", description: "Create a new draft rules version for a pension plan." })
export class CreatePlanRulesVersionDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) name?: string;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) effectiveFrom?: string | null;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) effectiveTo?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) notes?: string | null;
  @Field(t.optional(t.string({ format: "uuid" }))) copyFromId?: string;
}

@Dto({ name: "UpdatePlanRulesVersion", description: "Update metadata of a draft plan rules version." })
export class UpdatePlanRulesVersionDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) name?: string;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) effectiveFrom?: string | null;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) effectiveTo?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) notes?: string | null;
}

@Dto({ name: "SetPlanRuleValue", description: "One typed pension plan rule value." })
export class SetPlanRuleValueDto {
  @Field(t.string({ minLength: 1, maxLength: 120 })) code!: string;
  @Field(t.string({ minLength: 1, maxLength: 120 })) category!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) label!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) valueType!: string;
  @Field(t.string({ minLength: 1 })) valueJson!: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 60 })))) unit?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 200 })))) source?: string | null;
}

@Dto({ name: "SetPlanRuleValues", description: "Replace the active rule set of a draft plan rules version." })
export class SetPlanRuleValuesDto {
  @Field(t.array(t.ref(SetPlanRuleValueDto))) rules!: SetPlanRuleValueDto[];
}

@Dto({ name: "PlanRulesPlanParams" })
export class PlanRulesPlanParamsDto {
  @Field(t.string({ format: "uuid" })) planId!: string;
}

@Dto({ name: "PlanRulesVersionParams" })
export class PlanRulesVersionParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

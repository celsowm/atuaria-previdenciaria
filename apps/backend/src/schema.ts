import {
  SQLiteSchemaDialect,
  bootstrapEntities,
  getTableDefFromEntity,
  introspectSchema,
  synchronizeSchema,
  type DbExecutor
} from "metal-orm";
import {
  Evaluation,
  ImportFile,
  ImportJob,
  ImportRow,
  LlmProvider,
  LlmProviderCredential,
  MappingProfile,
  MappingRule
} from "./domain/entities.js";
import { User, UserSession } from "./domain/auth-entities.js";
import { Plan } from "./domain/plan-entities.js";
import { PlanRuleValue, PlanRulesVersion } from "./domain/plan-rule-entities.js";
import { CritiqueIssue, CritiqueRule, CritiqueRun } from "./domain/critique-entities.js";
import {
  BiometricTable,
  BiometricTablePoint,
  BiometricTableVersion
} from "./domain/biometric-entities.js";
import {
  AdherenceCandidatePoint,
  AdherenceCandidateResult,
  AdherenceObservation,
  AdherenceStudy
} from "./domain/adherence-entities.js";
import {
  ActuarialHypothesisSelection,
  ActuarialParameterization,
  ActuarialParameterValue
} from "./domain/parameterization-entities.js";
import {
  CalculationInput,
  CalculationResultMetric,
  CalculationRun
} from "./domain/calculation-entities.js";

const entityTypes = [
  User,
  UserSession,
  Plan,
  PlanRulesVersion,
  PlanRuleValue,
  Evaluation,
  MappingProfile,
  MappingRule,
  ImportFile,
  ImportJob,
  ImportRow,
  CritiqueRule,
  CritiqueRun,
  CritiqueIssue,
  BiometricTable,
  BiometricTableVersion,
  BiometricTablePoint,
  AdherenceStudy,
  AdherenceObservation,
  AdherenceCandidateResult,
  AdherenceCandidatePoint,
  ActuarialParameterization,
  ActuarialParameterValue,
  ActuarialHypothesisSelection,
  CalculationRun,
  CalculationInput,
  CalculationResultMetric,
  LlmProvider,
  LlmProviderCredential
] as const;

bootstrapEntities();

export const entityTables = entityTypes.map((entity) => {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM did not bootstrap ${entity.name}`);
  return table;
});

export async function synchronizeEntitySchema(executor: DbExecutor) {
  const actual = await introspectSchema(executor, "sqlite");
  await synchronizeSchema(
    entityTables,
    actual,
    new SQLiteSchemaDialect(),
    executor,
    { allowDestructive: false }
  );
}

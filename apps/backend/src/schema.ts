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
import { CritiqueIssue, CritiqueRule, CritiqueRun } from "./domain/critique-entities.js";

const entityTypes = [
  Evaluation,
  MappingProfile,
  MappingRule,
  ImportFile,
  ImportJob,
  ImportRow,
  CritiqueRule,
  CritiqueRun,
  CritiqueIssue,
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

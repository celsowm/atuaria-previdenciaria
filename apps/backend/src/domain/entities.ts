import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "evaluations" })
export class Evaluation {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  planName!: string;

  @Column(col.notNull(col.text()))
  referenceDate!: string;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.notNull(col.text()))
  stage!: string;

  @Column(col.notNull(col.int()))
  progress!: number;

  @Column(col.notNull(col.int()))
  blockingIssues!: number;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
}

@Entity({ tableName: "mapping_profiles" })
export class MappingProfile {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  population!: string;

  @Column(col.notNull(col.text()))
  version!: string;

  @Column(col.text())
  schemaFingerprint?: string | null;

  @Column(col.text())
  rulesFingerprint?: string | null;

  @Column(col.text())
  sourceHeadersJson?: string | null;

  @Column(col.notNull(col.int()))
  mappedFields!: number;

  @Column(col.notNull(col.int()))
  totalFields!: number;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
}

@Entity({ tableName: "mapping_rules" })
export class MappingRule {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.int()))
  profileId!: number;

  @Column(col.notNull(col.int()))
  ordinal!: number;

  @Column(col.notNull(col.text()))
  sourcesJson!: string;

  @Column(col.notNull(col.text()))
  targetsJson!: string;

  @Column(col.notNull(col.text()))
  transform!: string;
}

@Entity({ tableName: "import_files" })
export class ImportFile {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  originalName!: string;

  @Column(col.notNull(col.text()))
  mimeType!: string;

  @Column(col.notNull(col.int()))
  sizeBytes!: number;

  @Column(col.notNull(col.text()))
  sha256!: string;

  @Column(col.notNull(col.text()))
  storagePath!: string;

  @Column(col.notNull(col.text()))
  createdAt!: string;
}

@Entity({ tableName: "import_jobs" })
export class ImportJob {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.int())
  evaluationId?: number | null;

  @Column(col.notNull(col.text()))
  fileId!: string;

  @Column(col.int())
  mappingProfileId?: number | null;

  @Column(col.notNull(col.text()))
  population!: string;

  @Column(col.notNull(col.text()))
  sheetName!: string;

  @Column(col.notNull(col.int()))
  headerRow!: number;

  @Column(col.notNull(col.text()))
  sourceHeadersJson!: string;

  @Column(col.notNull(col.text()))
  schemaFingerprint!: string;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.notNull(col.int()))
  rowCount!: number;

  @Column(col.notNull(col.int()))
  validRows!: number;

  @Column(col.notNull(col.int()))
  invalidRows!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.text())
  completedAt?: string | null;
}

@Entity({ tableName: "import_rows" })
export class ImportRow {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  importJobId!: string;

  @Column(col.notNull(col.int()))
  rowNumber!: number;

  @Column(col.notNull(col.text()))
  rawJson!: string;

  @Column(col.notNull(col.text()))
  normalizedJson!: string;

  @Column(col.notNull(col.text()))
  canonicalJson!: string;

  @Column(col.notNull(col.text()))
  validationStatus!: string;
}

@Entity({ tableName: "llm_providers" })
export class LlmProvider {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  baseUrl!: string;

  @Column(col.notNull(col.text()))
  model!: string;

  @Column(col.notNull(col.int()))
  enabled!: number;
}

@Entity({ tableName: "llm_provider_credentials" })
export class LlmProviderCredential {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  providerId!: number;

  @Column(col.notNull(col.text()))
  label!: string;

  @Column(col.notNull(col.text()))
  secretRef!: string;

  @Column(col.notNull(col.int()))
  enabled!: number;

  @Column(col.notNull(col.int()))
  priority!: number;
}
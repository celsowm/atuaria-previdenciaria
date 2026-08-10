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

  @Column(col.notNull(col.int()))
  mappedFields!: number;

  @Column(col.notNull(col.int()))
  totalFields!: number;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
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

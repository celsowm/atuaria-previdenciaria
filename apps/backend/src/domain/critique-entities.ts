import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "critique_rules" })
export class CritiqueRule {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  code!: string;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  severity!: string;

  @Column(col.notNull(col.text()))
  category!: string;

  @Column(col.notNull(col.text()))
  description!: string;

  @Column(col.notNull(col.text()))
  configJson!: string;

  @Column(col.notNull(col.int()))
  enabled!: number;
}

@Entity({ tableName: "critique_runs" })
export class CritiqueRun {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  importJobId!: string;

  @Column(col.text())
  previousImportJobId?: string | null;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.notNull(col.int()))
  blockingCount!: number;

  @Column(col.notNull(col.int()))
  inconsistencyCount!: number;

  @Column(col.notNull(col.int()))
  warningCount!: number;

  @Column(col.notNull(col.int()))
  infoCount!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.text())
  completedAt?: string | null;
}

@Entity({ tableName: "critique_issues" })
export class CritiqueIssue {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  critiqueRunId!: string;

  @Column(col.notNull(col.text()))
  ruleId!: string;

  @Column(col.notNull(col.text()))
  ruleCode!: string;

  @Column(col.notNull(col.text()))
  importRowId!: string;

  @Column(col.text())
  previousImportRowId?: string | null;

  @Column(col.text())
  participantRegistration?: string | null;

  @Column(col.notNull(col.text()))
  severity!: string;

  @Column(col.notNull(col.text()))
  category!: string;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.text())
  fieldPath?: string | null;

  @Column(col.text())
  currentValueJson?: string | null;

  @Column(col.text())
  previousValueJson?: string | null;

  @Column(col.notNull(col.text()))
  message!: string;

  @Column(col.notNull(col.text()))
  detailsJson!: string;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.text())
  resolutionNote?: string | null;

  @Column(col.text())
  resolvedAt?: string | null;
}

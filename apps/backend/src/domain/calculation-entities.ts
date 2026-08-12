import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "calculation_runs" })
export class CalculationRun {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.int(), {
    table: "evaluations",
    column: "id",
    onDelete: "RESTRICT"
  })))
  evaluationId!: number;

  @Column(col.references(col.text(), {
    table: "submassas",
    column: "id",
    onDelete: "RESTRICT"
  }))
  submassaId?: string | null;

  @Column(col.references(col.text(), {
    table: "beneficios",
    column: "id",
    onDelete: "RESTRICT"
  }))
  beneficioId?: string | null;

  @Column(col.text())
  impressaoDigitalSubmassa?: string | null;

  @Column(col.notNull(col.references(col.text(), {
    table: "actuarial_parameterizations",
    column: "id",
    onDelete: "RESTRICT"
  })))
  parameterizationId!: string;

  @Column(col.references(col.text(), {
    table: "plan_rules_versions",
    column: "id",
    onDelete: "RESTRICT"
  }))
  planRulesVersionId?: string | null;

  @Column(col.text())
  planRulesFingerprint?: string | null;

  @Column(col.notNull(col.text()))
  engineCode!: string;

  @Column(col.notNull(col.text()))
  engineVersion!: string;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.notNull(col.text()))
  parameterFingerprint!: string;

  @Column(col.notNull(col.text()))
  dataFingerprint!: string;

  @Column(col.notNull(col.text()))
  inputFingerprint!: string;

  @Column(col.text())
  resultFingerprint?: string | null;

  @Column(col.notNull(col.int()))
  inputImportCount!: number;

  @Column(col.notNull(col.int()))
  inputRowCount!: number;

  @Column(col.notNull(col.int()))
  validRowCount!: number;

  @Column(col.notNull(col.int()))
  invalidRowCount!: number;

  @Column(col.int())
  participantResultCount?: number | null;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.text())
  completedAt?: string | null;

  @Column(col.text())
  errorMessage?: string | null;
}

@Entity({ tableName: "calculation_inputs" })
export class CalculationInput {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "calculation_runs",
    column: "id",
    onDelete: "CASCADE"
  })))
  calculationRunId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "import_jobs",
    column: "id",
    onDelete: "RESTRICT"
  })))
  importJobId!: string;

  @Column(col.notNull(col.text()))
  population!: string;

  @Column(col.notNull(col.text()))
  fileSha256!: string;

  @Column(col.notNull(col.text()))
  schemaFingerprint!: string;

  @Column(col.notNull(col.text()))
  canonicalFingerprint!: string;

  @Column(col.notNull(col.int()))
  rowCount!: number;

  @Column(col.notNull(col.int()))
  validRows!: number;

  @Column(col.notNull(col.int()))
  invalidRows!: number;

  @Column(col.notNull(col.text()))
  importedAt!: string;
}

@Entity({ tableName: "calculation_result_metrics" })
export class CalculationResultMetric {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "calculation_runs",
    column: "id",
    onDelete: "CASCADE"
  })))
  calculationRunId!: string;

  @Column(col.notNull(col.text()))
  code!: string;

  @Column(col.notNull(col.text()))
  category!: string;

  @Column(col.notNull(col.text()))
  label!: string;

  @Column(col.notNull(col.text()))
  valueType!: string;

  @Column(col.notNull(col.text()))
  valueJson!: string;

  @Column(col.text())
  unit?: string | null;

  @Column(col.notNull(col.int()))
  ordinal!: number;
}

@Entity({ tableName: "calculation_participant_results" })
export class CalculationParticipantResult {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "calculation_runs",
    column: "id",
    onDelete: "CASCADE"
  })))
  calculationRunId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "import_jobs",
    column: "id",
    onDelete: "RESTRICT"
  })))
  importJobId!: string;

  @Column(col.notNull(col.text()))
  population!: string;

  @Column(col.notNull(col.int()))
  sourceRowNumber!: number;

  @Column(col.text())
  participantRegistration?: string | null;

  @Column(col.text())
  campoUnicoLgpd?: string | null;

  @Column(col.notNull(col.text()))
  resultJson!: string;

  @Column(col.notNull(col.int()))
  ordinal!: number;
}

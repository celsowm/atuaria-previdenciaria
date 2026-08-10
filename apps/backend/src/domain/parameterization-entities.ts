import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "actuarial_parameterizations" })
export class ActuarialParameterization {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.int(), {
    table: "evaluations",
    column: "id",
    onDelete: "CASCADE"
  })))
  evaluationId!: number;

  @Column(col.notNull(col.int()))
  version!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.text())
  notes?: string | null;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.notNull(col.text()))
  updatedAt!: string;

  @Column(col.text())
  approvedAt?: string | null;
}

@Entity({ tableName: "actuarial_parameter_values" })
export class ActuarialParameterValue {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "actuarial_parameterizations",
    column: "id",
    onDelete: "CASCADE"
  })))
  parameterizationId!: string;

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

  @Column(col.notNull(col.text()))
  source!: string;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
}

@Entity({ tableName: "actuarial_hypothesis_selections" })
export class ActuarialHypothesisSelection {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "actuarial_parameterizations",
    column: "id",
    onDelete: "CASCADE"
  })))
  parameterizationId!: string;

  @Column(col.notNull(col.text()))
  hypothesisType!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "adherence_studies",
    column: "id",
    onDelete: "RESTRICT"
  })))
  adherenceStudyId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "adherence_candidate_results",
    column: "id",
    onDelete: "RESTRICT"
  })))
  candidateResultId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "biometric_table_versions",
    column: "id",
    onDelete: "RESTRICT"
  })))
  biometricVersionId!: string;

  @Column(col.notNull(col.text()))
  tableCode!: string;

  @Column(col.notNull(col.text()))
  tableName!: string;

  @Column(col.notNull(col.text()))
  versionLabel!: string;

  @Column(col.notNull(col.int()))
  candidateRank!: number;

  @Column(col.notNull(col.text()))
  selectedAt!: string;
}

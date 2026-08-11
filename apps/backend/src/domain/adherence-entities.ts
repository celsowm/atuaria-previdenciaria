import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "adherence_studies" })
export class AdherenceStudy {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.int())
  evaluationId?: number | null;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  hypothesisType!: string;

  @Column(col.notNull(col.int()))
  periodStart!: number;

  @Column(col.notNull(col.int()))
  periodEnd!: number;

  @Column(col.notNull(col.text()))
  sexScope!: string;

  @Column(col.notNull(col.decimal(8, 6)))
  alpha!: number;

  @Column(col.notNull(col.int()))
  fisherSplitAge!: number;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.notNull(col.text()))
  engineVersion!: string;

  @Column(col.notNull(col.int()))
  observationCount!: number;

  @Column(col.notNull(col.int()))
  candidateCount!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.text())
  completedAt?: string | null;
}

@Entity({ tableName: "adherence_observations" })
export class AdherenceObservation {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  studyId!: string;

  @Column(col.notNull(col.int()))
  year!: number;

  @Column(col.notNull(col.int()))
  age!: number;

  @Column(col.notNull(col.text()))
  sex!: string;

  @Column(col.notNull(col.decimal(20, 8)))
  exposure!: number;

  @Column(col.notNull(col.int()))
  observedEvents!: number;
}

@Entity({ tableName: "adherence_candidate_results" })
export class AdherenceCandidateResult {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  studyId!: string;

  @Column(col.notNull(col.text()))
  biometricVersionId!: string;

  @Column(col.notNull(col.text()))
  tableCode!: string;

  @Column(col.notNull(col.text()))
  tableName!: string;

  @Column(col.notNull(col.text()))
  versionLabel!: string;

  @Column(col.notNull(col.int()))
  rank!: number;

  @Column(col.notNull(col.decimal(20, 8)))
  observedEvents!: number;

  @Column(col.notNull(col.decimal(20, 8)))
  expectedEvents!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  chiSquare!: number;

  @Column(col.notNull(col.int()))
  chiSquareDf!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  chiSquareCritical!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  chiSquareP!: number;

  @Column(col.notNull(col.int()))
  chiSquarePass!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  ksD!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  ksCritical!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  ksP!: number;

  @Column(col.notNull(col.int()))
  ksPass!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  zStatistic!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  zCritical!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  zP!: number;

  @Column(col.notNull(col.int()))
  zPass!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  fisherP!: number;

  @Column(col.notNull(col.int()))
  fisherPass!: number;

  @Column(col.notNull(col.decimal(24, 16)))
  dqm!: number;

  @Column(col.notNull(col.int()))
  rejectedTests!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;
}

@Entity({ tableName: "adherence_candidate_points" })
export class AdherenceCandidatePoint {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  candidateResultId!: string;

  @Column(col.notNull(col.int()))
  age!: number;

  @Column(col.notNull(col.text()))
  sex!: string;

  @Column(col.notNull(col.decimal(20, 8)))
  exposure!: number;

  @Column(col.notNull(col.int()))
  observedEvents!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  qx!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  expectedEvents!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  residual!: number;
}

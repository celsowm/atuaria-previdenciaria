import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "actuarial_closings" })
export class ActuarialClosing {
  @PrimaryKey(col.text()) id!: string;
  @Column(col.notNull(col.references(col.int(), { table: "evaluations", column: "id", onDelete: "CASCADE" }))) evaluationId!: number;
  @Column(col.notNull(col.references(col.text(), { table: "calculation_runs", column: "id", onDelete: "RESTRICT" }))) calculationRunId!: string;
  @Column(col.notNull(col.text())) status!: string;
  @Column(col.text()) notes?: string | null;
  @Column(col.notNull(col.text())) createdAt!: string;
  @Column(col.notNull(col.text())) updatedAt!: string;
  @Column(col.text()) finalizedAt?: string | null;
}

@Entity({ tableName: "actuarial_closing_lines" })
export class ActuarialClosingLine {
  @PrimaryKey(col.text()) id!: string;
  @Column(col.notNull(col.references(col.text(), { table: "actuarial_closings", column: "id", onDelete: "CASCADE" }))) closingId!: string;
  @Column(col.notNull(col.text())) code!: string;
  @Column(col.notNull(col.text())) category!: string;
  @Column(col.notNull(col.text())) label!: string;
  @Column(col.notNull(col.text())) valueJson!: string;
  @Column(col.text()) unit?: string | null;
  @Column(col.notNull(col.text())) source!: string;
  @Column(col.notNull(col.int())) ordinal!: number;
}

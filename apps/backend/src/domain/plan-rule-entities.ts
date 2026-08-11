import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "plan_rules_versions" })
export class PlanRulesVersion {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "plans",
    column: "id",
    onDelete: "RESTRICT"
  })))
  planId!: string;

  @Column(col.notNull(col.int()))
  version!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  modality!: string;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.text())
  effectiveFrom?: string | null;

  @Column(col.text())
  effectiveTo?: string | null;

  @Column(col.text())
  rulesFingerprint?: string | null;

  @Column(col.text())
  notes?: string | null;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.notNull(col.text()))
  updatedAt!: string;

  @Column(col.text())
  approvedAt?: string | null;
}

@Entity({ tableName: "plan_rule_values" })
export class PlanRuleValue {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "plan_rules_versions",
    column: "id",
    onDelete: "CASCADE"
  })))
  planRulesVersionId!: string;

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

  @Column(col.int())
  active?: number | null;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
}

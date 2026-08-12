import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "biometric_tables" })
export class BiometricTable {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  code!: string;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  kind!: string;

  @Column(col.notNull(col.text()))
  sexScope!: string;

  @Column(col.text())
  source?: string | null;

  @Column(col.text())
  description?: string | null;

  @Column(col.notNull(col.int()))
  enabled!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
}

@Entity({ tableName: "biometric_table_versions" })
export class BiometricTableVersion {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  tableId!: string;

  @Column(col.notNull(col.text()))
  version!: string;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.text())
  effectiveFrom?: string | null;

  @Column(col.text())
  effectiveTo?: string | null;

  @Column(col.text())
  parentVersionId?: string | null;

  @Column(col.text())
  derivationType?: string | null;

  @Column(col.notNull(col.text()))
  derivationParametersJson!: string;

  @Column(col.notNull(col.int()))
  minAge!: number;

  @Column(col.notNull(col.int()))
  maxAge!: number;

  @Column(col.notNull(col.int()))
  pointCount!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;
}

@Entity({ tableName: "biometric_table_points" })
export class BiometricTablePoint {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  versionId!: string;

  @Column(col.notNull(col.int()))
  age!: number;

  @Column(col.notNull(col.text()))
  sex!: string;

  @Column(col.notNull(col.decimal(18, 12)))
  qx!: number;
}

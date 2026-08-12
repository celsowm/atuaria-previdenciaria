import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "plans" })
export class Plan {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "entidades_previdencia",
    column: "id",
    onDelete: "RESTRICT"
  })))
  entidadePrevidenciaId!: string;

  @Column(col.notNull(col.unique(col.text())))
  code!: string;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  modality!: string;

  @Column(col.text())
  sponsorName!: string | null;

  @Column(col.text())
  cnpj!: string | null;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
}

import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "plans" })
export class Plano {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "entidades_previdencia",
    column: "id",
    onDelete: "RESTRICT"
  })))
  entidadePrevidenciaId!: string;

  @Column(col.notNull(col.unique(col.text())))
  codigo!: string;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  modalidade!: string;

  @Column(col.text())
  nomePatrocinador!: string | null;

  @Column(col.text())
  cnpj!: string | null;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

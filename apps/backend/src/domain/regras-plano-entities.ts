import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "plan_rules_versions" })
export class VersaoRegrasPlano {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "plans",
    column: "id",
    onDelete: "RESTRICT"
  })))
  planoId!: string;

  @Column(col.notNull(col.int()))
  versao!: number;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  modalidade!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.text())
  vigenciaInicial?: string | null;

  @Column(col.text())
  vigenciaFinal?: string | null;

  @Column(col.text())
  impressaoDigitalRegras?: string | null;

  @Column(col.text())
  observacoes?: string | null;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;

  @Column(col.text())
  aprovadoEm?: string | null;
}

@Entity({ tableName: "plan_rule_values" })
export class ValorRegraPlano {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "plan_rules_versions",
    column: "id",
    onDelete: "CASCADE"
  })))
  versaoRegrasPlanoId!: string;

  @Column(col.notNull(col.text()))
  codigo!: string;

  @Column(col.notNull(col.text()))
  categoria!: string;

  @Column(col.notNull(col.text()))
  rotulo!: string;

  @Column(col.notNull(col.text()))
  tipoValor!: string;

  @Column(col.notNull(col.text()))
  jsonValor!: string;

  @Column(col.text())
  unidade?: string | null;

  @Column(col.notNull(col.text()))
  origem!: string;

  @Column(col.int())
  ativo?: number | null;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

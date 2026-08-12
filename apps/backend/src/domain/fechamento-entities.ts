import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "actuarial_closings" })
export class FechamentoAtuarial {
  @PrimaryKey(col.text()) id!: string;
  @Column(col.notNull(col.references(col.int(), { table: "avaliacoes", column: "id", onDelete: "CASCADE" }))) avaliacaoId!: number;
  @Column(col.notNull(col.references(col.text(), { table: "calculation_runs", column: "id", onDelete: "RESTRICT" }))) execucaoCalculoId!: string;
  @Column(col.notNull(col.text())) situacao!: string;
  @Column(col.text()) observacoes?: string | null;
  @Column(col.notNull(col.text())) criadoEm!: string;
  @Column(col.notNull(col.text())) atualizadoEm!: string;
  @Column(col.text()) finalizadoEm?: string | null;
}

@Entity({ tableName: "actuarial_closing_lines" })
export class LinhaFechamentoAtuarial {
  @PrimaryKey(col.text()) id!: string;
  @Column(col.notNull(col.references(col.text(), { table: "actuarial_closings", column: "id", onDelete: "CASCADE" }))) fechamentoId!: string;
  @Column(col.notNull(col.text())) codigo!: string;
  @Column(col.notNull(col.text())) categoria!: string;
  @Column(col.notNull(col.text())) rotulo!: string;
  @Column(col.notNull(col.text())) jsonValor!: string;
  @Column(col.text()) unidade?: string | null;
  @Column(col.notNull(col.text())) origem!: string;
  @Column(col.notNull(col.int())) ordinal!: number;
}

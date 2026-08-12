import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "actuarial_parameterizations" })
export class ParametrizacaoAtuarial {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.int(), {
    table: "avaliacoes",
    column: "id",
    onDelete: "CASCADE"
  })))
  avaliacaoId!: number;

  @Column(col.notNull(col.int()))
  versao!: number;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.text())
  observacoes?: string | null;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;

  @Column(col.text())
  aprovadoEm?: string | null;
}

@Entity({ tableName: "actuarial_parameter_values" })
export class ValorParametroAtuarial {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "actuarial_parameterizations",
    column: "id",
    onDelete: "CASCADE"
  })))
  parametrizacaoId!: string;

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

@Entity({ tableName: "actuarial_hypothesis_selections" })
export class SelecaoHipoteseAtuarial {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "actuarial_parameterizations",
    column: "id",
    onDelete: "CASCADE"
  })))
  parametrizacaoId!: string;

  @Column(col.notNull(col.text()))
  tipoHipotese!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "adherence_studies",
    column: "id",
    onDelete: "RESTRICT"
  })))
  estudoAderenciaId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "adherence_candidate_results",
    column: "id",
    onDelete: "RESTRICT"
  })))
  resultadoCandidatoId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "biometric_table_versions",
    column: "id",
    onDelete: "RESTRICT"
  })))
  versaoBiometriaId!: string;

  @Column(col.notNull(col.text()))
  codigoTabua!: string;

  @Column(col.notNull(col.text()))
  nomeTabua!: string;

  @Column(col.notNull(col.text()))
  rotuloVersao!: string;

  @Column(col.notNull(col.int()))
  posicaoCandidato!: number;

  @Column(col.int())
  ativo?: number | null;

  @Column(col.notNull(col.text()))
  selecionadoEm!: string;
}

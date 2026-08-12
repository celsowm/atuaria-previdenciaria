import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "biometric_tables" })
export class TabuaBiometria {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  codigo!: string;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  tipo!: string;

  @Column(col.notNull(col.text()))
  escopoSexo!: string;

  @Column(col.text())
  origem?: string | null;

  @Column(col.text())
  descricao?: string | null;

  @Column(col.notNull(col.int()))
  habilitada!: number;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

@Entity({ tableName: "biometric_table_versions" })
export class VersaoTabuaBiometria {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  tabuaId!: string;

  @Column(col.notNull(col.text()))
  versao!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.text())
  vigenciaInicial?: string | null;

  @Column(col.text())
  vigenciaFinal?: string | null;

  @Column(col.text())
  versaoOrigemId?: string | null;

  @Column(col.text())
  tipoDerivacao?: string | null;

  @Column(col.notNull(col.text()))
  parametrosDerivacaoJson!: string;

  @Column(col.notNull(col.int()))
  idadeMinima!: number;

  @Column(col.notNull(col.int()))
  idadeMaxima!: number;

  @Column(col.notNull(col.int()))
  quantidadePontos!: number;

  @Column(col.notNull(col.text()))
  criadoEm!: string;
}

@Entity({ tableName: "biometric_table_points" })
export class PontoTabuaBiometria {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  versaoId!: string;

  @Column(col.notNull(col.int()))
  idade!: number;

  @Column(col.notNull(col.text()))
  sexo!: string;

  @Column(col.notNull(col.decimal(18, 12)))
  qx!: number;
}

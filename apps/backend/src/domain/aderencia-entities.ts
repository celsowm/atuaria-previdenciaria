import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "adherence_studies" })
export class EstudoAderencia {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.int())
  avaliacaoId?: number | null;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  tipoHipotese!: string;

  @Column(col.notNull(col.int()))
  periodoInicial!: number;

  @Column(col.notNull(col.int()))
  periodoFinal!: number;

  @Column(col.notNull(col.text()))
  escopoSexo!: string;

  @Column(col.notNull(col.decimal(8, 6)))
  alpha!: number;

  @Column(col.notNull(col.int()))
  idadeDivisaoFisher!: number;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.text()))
  versaoMotor!: string;

  @Column(col.notNull(col.int()))
  quantidadeObservacoes!: number;

  @Column(col.notNull(col.int()))
  quantidadeCandidatos!: number;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.text())
  concluidoEm?: string | null;
}

@Entity({ tableName: "adherence_observations" })
export class ObservacaoAderencia {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  estudoId!: string;

  @Column(col.notNull(col.int()))
  ano!: number;

  @Column(col.notNull(col.int()))
  idade!: number;

  @Column(col.notNull(col.text()))
  sexo!: string;

  @Column(col.notNull(col.decimal(20, 8)))
  exposicao!: number;

  @Column(col.notNull(col.int()))
  eventosObservados!: number;
}

@Entity({ tableName: "adherence_candidate_results" })
export class ResultadoCandidatoAderencia {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  estudoId!: string;

  @Column(col.notNull(col.text()))
  versaoBiometriaId!: string;

  @Column(col.notNull(col.text()))
  codigoTabua!: string;

  @Column(col.notNull(col.text()))
  nomeTabua!: string;

  @Column(col.notNull(col.text()))
  rotuloVersao!: string;

  @Column(col.notNull(col.int()))
  rank!: number;

  @Column(col.notNull(col.decimal(20, 8)))
  eventosObservados!: number;

  @Column(col.notNull(col.decimal(20, 8)))
  eventosEsperados!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  quiQuadrado!: number;

  @Column(col.notNull(col.int()))
  quiQuadradoDf!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  quiQuadradoCritical!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  quiQuadradoP!: number;

  @Column(col.notNull(col.int()))
  quiQuadradoPass!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  ksD!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  ksCritico!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  pKs!: number;

  @Column(col.notNull(col.int()))
  pKsass!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  estatisticaZ!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  zCritico!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  pZ!: number;

  @Column(col.notNull(col.int()))
  pZass!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  pFisher!: number;

  @Column(col.notNull(col.int()))
  pFisherass!: number;

  @Column(col.notNull(col.decimal(24, 16)))
  dqm!: number;

  @Column(col.notNull(col.int()))
  testesRejeitados!: number;

  @Column(col.notNull(col.text()))
  criadoEm!: string;
}

@Entity({ tableName: "adherence_candidate_points" })
export class PontoCandidatoAderencia {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  resultadoCandidatoId!: string;

  @Column(col.notNull(col.int()))
  idade!: number;

  @Column(col.notNull(col.text()))
  sexo!: string;

  @Column(col.notNull(col.decimal(20, 8)))
  exposicao!: number;

  @Column(col.notNull(col.int()))
  eventosObservados!: number;

  @Column(col.notNull(col.decimal(18, 12)))
  qx!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  eventosEsperados!: number;

  @Column(col.notNull(col.decimal(20, 10)))
  residuo!: number;
}

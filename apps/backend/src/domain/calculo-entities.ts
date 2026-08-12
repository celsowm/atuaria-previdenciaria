import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "calculation_runs" })
export class ExecucaoCalculo {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.int(), {
    table: "avaliacoes",
    column: "id",
    onDelete: "RESTRICT"
  })))
  avaliacaoId!: number;

  @Column(col.references(col.text(), {
    table: "submassas",
    column: "id",
    onDelete: "RESTRICT"
  }))
  submassaId?: string | null;

  @Column(col.references(col.text(), {
    table: "beneficios",
    column: "id",
    onDelete: "RESTRICT"
  }))
  beneficioId?: string | null;

  @Column(col.text())
  impressaoDigitalSubmassa?: string | null;

  @Column(col.notNull(col.references(col.text(), {
    table: "actuarial_parameterizations",
    column: "id",
    onDelete: "RESTRICT"
  })))
  parametrizacaoId!: string;

  @Column(col.references(col.text(), {
    table: "plan_rules_versions",
    column: "id",
    onDelete: "RESTRICT"
  }))
  versaoRegrasPlanoId?: string | null;

  @Column(col.text())
  impressaoDigitalRegrasPlano?: string | null;

  @Column(col.notNull(col.text()))
  codigoMotor!: string;

  @Column(col.notNull(col.text()))
  versaoMotor!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.text()))
  impressaoDigitalParametros!: string;

  @Column(col.notNull(col.text()))
  impressaoDigitalDados!: string;

  @Column(col.notNull(col.text()))
  impressaoDigitalEntrada!: string;

  @Column(col.text())
  impressaoDigitalResultado?: string | null;

  @Column(col.notNull(col.int()))
  quantidadeImportacoesEntrada!: number;

  @Column(col.notNull(col.int()))
  quantidadeLinhasEntrada!: number;

  @Column(col.notNull(col.int()))
  quantidadeLinhasValidas!: number;

  @Column(col.notNull(col.int()))
  quantidadeLinhasInvalidas!: number;

  @Column(col.int())
  quantidadeResultadosParticipantes?: number | null;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.text())
  concluidoEm?: string | null;

  @Column(col.text())
  mensagemErro?: string | null;
}

@Entity({ tableName: "calculation_inputs" })
export class EntradaCalculo {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "calculation_runs",
    column: "id",
    onDelete: "CASCADE"
  })))
  execucaoCalculoId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "import_jobs",
    column: "id",
    onDelete: "RESTRICT"
  })))
  importacaoId!: string;

  @Column(col.notNull(col.text()))
  populacao!: string;

  @Column(col.notNull(col.text()))
  arquivoSha256!: string;

  @Column(col.notNull(col.text()))
  impressaoDigitalEsquema!: string;

  @Column(col.notNull(col.text()))
  impressaoDigitalCanonica!: string;

  @Column(col.notNull(col.int()))
  quantidadeLinhas!: number;

  @Column(col.notNull(col.int()))
  linhasValidas!: number;

  @Column(col.notNull(col.int()))
  linhasInvalidas!: number;

  @Column(col.notNull(col.text()))
  importadoEm!: string;
}

@Entity({ tableName: "calculation_result_metrics" })
export class MetricaResultadoCalculo {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "calculation_runs",
    column: "id",
    onDelete: "CASCADE"
  })))
  execucaoCalculoId!: string;

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

  @Column(col.notNull(col.int()))
  ordinal!: number;
}

@Entity({ tableName: "calculation_participant_results" })
export class ResultadoParticipanteCalculo {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "calculation_runs",
    column: "id",
    onDelete: "CASCADE"
  })))
  execucaoCalculoId!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "import_jobs",
    column: "id",
    onDelete: "RESTRICT"
  })))
  importacaoId!: string;

  @Column(col.notNull(col.text()))
  populacao!: string;

  @Column(col.notNull(col.int()))
  numeroLinhaOrigem!: number;

  @Column(col.text())
  matriculaParticipante?: string | null;

  @Column(col.text())
  campoUnicoLgpd?: string | null;

  @Column(col.notNull(col.text()))
  jsonResultado!: string;

  @Column(col.notNull(col.int()))
  ordinal!: number;
}

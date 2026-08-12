import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "critique_rules" })
export class RegraCritica {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  codigo!: string;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  severidade!: string;

  @Column(col.notNull(col.text()))
  categoria!: string;

  @Column(col.notNull(col.text()))
  descricao!: string;

  @Column(col.notNull(col.text()))
  jsonConfiguracao!: string;

  @Column(col.notNull(col.int()))
  habilitado!: number;
}

@Entity({ tableName: "critique_runs" })
export class ExecucaoCritica {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  importacaoId!: string;

  @Column(col.text())
  importacaoAnteriorId?: string | null;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.int()))
  quantidadeBloqueios!: number;

  @Column(col.notNull(col.int()))
  quantidadeInconsistencias!: number;

  @Column(col.notNull(col.int()))
  quantidadeAvisos!: number;

  @Column(col.notNull(col.int()))
  quantidadeInformacoes!: number;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.text())
  concluidoEm?: string | null;
}

@Entity({ tableName: "critique_issues" })
export class InconsistenciaCritica {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  execucaoCriticaId!: string;

  @Column(col.notNull(col.text()))
  regraId!: string;

  @Column(col.notNull(col.text()))
  codigoRegra!: string;

  @Column(col.text())
  linhaImportacaoId?: string | null;

  @Column(col.text())
  linhaImportacaoAnteriorId?: string | null;

  @Column(col.text())
  matriculaParticipante?: string | null;

  @Column(col.text())
  campoUnicoLgpd?: string | null;

  @Column(col.notNull(col.text()))
  severidade!: string;

  @Column(col.notNull(col.text()))
  categoria!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.text())
  caminhoCampo?: string | null;

  @Column(col.text())
  jsonValorAtual?: string | null;

  @Column(col.text())
  jsonValorAnterior?: string | null;

  @Column(col.notNull(col.text()))
  mensagem!: string;

  @Column(col.notNull(col.text()))
  jsonDetalhes!: string;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.text())
  notaResolucao?: string | null;

  @Column(col.text())
  resolvidoEm?: string | null;
}

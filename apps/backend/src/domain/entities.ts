import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "avaliacoes" })
export class Avaliacao {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.references(col.text(), {
    table: "plans",
    column: "id",
    onDelete: "RESTRICT"
  }))
  planoId?: string | null;

  @Column(col.references(col.text(), {
    table: "submassas",
    column: "id",
    onDelete: "RESTRICT"
  }))
  submassaId?: string | null;

  @Column(col.notNull(col.text()))
  nomePlano!: string;

  @Column(col.notNull(col.text()))
  dataReferencia!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.text()))
  etapa!: string;

  @Column(col.notNull(col.int()))
  progresso!: number;

  @Column(col.notNull(col.int()))
  inconsistenciasBloqueantes!: number;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

@Entity({ tableName: "mapping_profiles" })
export class PerfilMapeamento {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  populacao!: string;

  @Column(col.notNull(col.text()))
  versao!: string;

  @Column(col.text())
  impressaoDigitalEsquema?: string | null;

  @Column(col.text())
  impressaoDigitalRegras?: string | null;

  @Column(col.text())
  jsonCabecalhosOrigem?: string | null;

  @Column(col.notNull(col.int()))
  camposMapeados!: number;

  @Column(col.notNull(col.int()))
  quantidadeCampos!: number;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

@Entity({ tableName: "mapping_rules" })
export class RegraMapeamento {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.int()))
  perfilMapeamentoId!: number;

  @Column(col.notNull(col.int()))
  ordinal!: number;

  @Column(col.notNull(col.text()))
  jsonOrigens!: string;

  @Column(col.notNull(col.text()))
  jsonDestinos!: string;

  @Column(col.notNull(col.text()))
  transform!: string;
}

@Entity({ tableName: "import_files" })
export class ArquivoImportacao {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  nomeOriginal!: string;

  @Column(col.notNull(col.text()))
  mimeType!: string;

  @Column(col.notNull(col.int()))
  tamanhoBytes!: number;

  @Column(col.notNull(col.text()))
  sha256!: string;

  @Column(col.notNull(col.text()))
  caminhoArmazenamento!: string;

  @Column(col.notNull(col.text()))
  criadoEm!: string;
}

@Entity({ tableName: "import_jobs" })
export class ImportacaoJob {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.int())
  avaliacaoId?: number | null;

  @Column(col.references(col.text(), {
    table: "submassas",
    column: "id",
    onDelete: "RESTRICT"
  }))
  submassaId?: string | null;

  @Column(col.notNull(col.text()))
  arquivoId!: string;

  @Column(col.int())
  perfilMapeamentoId?: number | null;

  @Column(col.notNull(col.text()))
  populacao!: string;

  @Column(col.notNull(col.text()))
  nomeAba!: string;

  @Column(col.notNull(col.int()))
  linhaCabecalho!: number;

  @Column(col.notNull(col.text()))
  jsonCabecalhosOrigem!: string;

  @Column(col.notNull(col.text()))
  impressaoDigitalEsquema!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.int()))
  quantidadeLinhas!: number;

  @Column(col.notNull(col.int()))
  linhasValidas!: number;

  @Column(col.notNull(col.int()))
  linhasInvalidas!: number;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.text())
  concluidoEm?: string | null;
}

@Entity({ tableName: "import_rows" })
export class LinhaImportacao {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.text()))
  importacaoId!: string;

  @Column(col.notNull(col.int()))
  numeroLinha!: number;

  @Column(col.notNull(col.text()))
  jsonBruto!: string;

  @Column(col.notNull(col.text()))
  jsonNormalizado!: string;

  @Column(col.notNull(col.text()))
  jsonCanonico!: string;

  @Column(col.notNull(col.text()))
  situacaoValidacao!: string;

  @Column(col.notNull(col.text()))
  jsonErrosValidacao!: string;
}

@Entity({ tableName: "llm_providers" })
export class ProvedorLlm {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  urlBase!: string;

  @Column(col.notNull(col.text()))
  modelo!: string;

  @Column(col.notNull(col.int()))
  habilitado!: number;
}

@Entity({ tableName: "llm_provider_credentials" })
export class CredencialProvedorLlm {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  provedorId!: number;

  @Column(col.notNull(col.text()))
  rotulo!: string;

  @Column(col.notNull(col.text()))
  referenciaSegredo!: string;

  @Column(col.notNull(col.int()))
  habilitado!: number;

  @Column(col.notNull(col.int()))
  prioridade!: number;
}

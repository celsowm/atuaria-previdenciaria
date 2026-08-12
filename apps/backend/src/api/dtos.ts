import { Dto, Field, t } from "adorn-api";

@Dto({ name: "Avaliacao", description: "Actuarial valuation workspace summary." })
export class AvaliacaoDto {
  @Field(t.integer()) id!: number;
  @Field(t.nullable(t.string({ format: "uuid" }))) planoId!: string | null;
  @Field(t.string()) nomePlano!: string;
  @Field(t.string({ format: "date" })) dataReferencia!: string;
  @Field(t.string()) situacao!: string;
  @Field(t.string()) etapa!: string;
  @Field(t.integer({ minimum: 0, maximum: 100 })) progresso!: number;
  @Field(t.integer({ minimum: 0 })) inconsistenciasBloqueantes!: number;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
}

@Dto({ name: "PerfilMapeamento", description: "Reusable import mapping profile." })
export class PerfilMapeamentoDto {
  @Field(t.integer()) id!: number;
  @Field(t.string()) nome!: string;
  @Field(t.string()) populacao!: string;
  @Field(t.string()) versao!: string;
  @Field(t.integer()) camposMapeados!: number;
  @Field(t.integer()) quantidadeCampos!: number;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
}

@Dto({ name: "PerfilMapeamentoMatchRequest", description: "Find the best reusable mapping profile for a workbook schema." })
export class PerfilMapeamentoMatchRequestDto {
  @Field(t.string({ minLength: 1 })) populacao!: string;
  @Field(t.array(t.string({ minLength: 1 }))) headers!: string[];
}

@Dto({ name: "PerfilMapeamentoMatch", description: "Compatibility result against a previous mapping profile." })
export class PerfilMapeamentoMatchDto {
  @Field(t.boolean()) matched!: boolean;
  @Field(t.optional(t.integer())) perfilMapeamentoId?: number;
  @Field(t.optional(t.string())) nomePerfil?: string;
  @Field(t.optional(t.string())) versao?: string;
  @Field(t.integer({ minimum: 0, maximum: 100 })) compatibility!: number;
  @Field(t.boolean()) exact!: boolean;
  @Field(t.array(t.string())) missingColumns!: string[];
  @Field(t.array(t.string())) newColumns!: string[];
  @Field(t.string()) regrasJson!: string;
}

@Dto({ name: "CriarImportacao", description: "Multipart metadata used to execute an auditable workbook import." })
export class CriarImportacaoDto {
  @Field(t.string({ minLength: 1 })) populacao!: string;
  @Field(t.optional(t.integer({ minimum: 1 }))) avaliacaoId?: number;
  @Field(t.string({ format: "uuid" })) submassaId!: string;
  @Field(t.optional(t.integer({ minimum: 1 }))) perfilMapeamentoId?: number;
  @Field(t.optional(t.string({ minLength: 1 }))) nomePerfil?: string;
  @Field(t.optional(t.boolean())) savePerfil?: boolean;
  @Field(t.optional(t.string({ minLength: 1 }))) nomeAba?: string;
  @Field(t.integer({ minimum: 1 })) linhaCabecalho!: number;
  @Field(t.string({ minLength: 2 })) regrasJson!: string;
}

@Dto({ name: "ImportacaoResult", description: "Completed Data Studio import with persisted RAW, normalized and canonical rows." })
export class ImportacaoResultDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) arquivoId!: string;
  @Field(t.nullable(t.integer())) perfilMapeamentoId!: number | null;
  @Field(t.nullable(t.string())) versaoPerfilMapeamento!: string | null;
  @Field(t.string()) nomeArquivo!: string;
  @Field(t.string()) arquivoSha256!: string;
  @Field(t.string()) populacao!: string;
  @Field(t.string()) nomeAba!: string;
  @Field(t.integer({ minimum: 0 })) quantidadeLinhas!: number;
  @Field(t.integer({ minimum: 0 })) linhasValidas!: number;
  @Field(t.integer({ minimum: 0 })) linhasInvalidas!: number;
  @Field(t.string()) situacao!: string;
}

@Dto({ name: "CriarExecucaoCritica", description: "Start deterministic cadastral critique for a persisted import." })
export class CriarExecucaoCriticaDto {
  @Field(t.string({ format: "uuid" })) importacaoId!: string;
  @Field(t.optional(t.string({ format: "uuid" }))) importacaoAnteriorId?: string;
}

@Dto({ name: "ExecucaoCritica", description: "Persisted cadastral critique execution summary." })
export class ExecucaoCriticaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) importacaoId!: string;
  @Field(t.nullable(t.string({ format: "uuid" }))) importacaoAnteriorId!: string | null;
  @Field(t.string()) situacao!: string;
  @Field(t.integer({ minimum: 0 })) quantidadeBloqueios!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeInconsistencias!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeAvisos!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeInformacoes!: number;
  @Field(t.integer({ minimum: 0 })) totalIssues!: number;
  @Field(t.boolean()) comparedWithPrevious!: boolean;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) concluidoEm!: string | null;
}

@Dto({ name: "ExecucaoCriticaParams" })
export class ExecucaoCriticaParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "InconsistenciaCritica", description: "Cadastral critique occurrence." })
export class InconsistenciaCriticaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigoRegra!: string;
  @Field(t.string()) severidade!: string;
  @Field(t.string()) categoria!: string;
  @Field(t.string()) situacao!: string;
  @Field(t.nullable(t.string())) matriculaParticipante!: string | null;
  @Field(t.nullable(t.string())) campoUnicoLgpd!: string | null;
  @Field(t.nullable(t.string())) caminhoCampo!: string | null;
  @Field(t.nullable(t.string())) jsonValorAtual!: string | null;
  @Field(t.nullable(t.string())) jsonValorAnterior!: string | null;
  @Field(t.string()) mensagem!: string;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
}

@Dto({ name: "InconsistenciaCriticaParams" })
export class InconsistenciaCriticaParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "InconsistenciaCriticaDetail", description: "Critica occurrence with complete source-data provenance." })
export class InconsistenciaCriticaDetailDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigoRegra!: string;
  @Field(t.string()) severidade!: string;
  @Field(t.string()) categoria!: string;
  @Field(t.string()) situacao!: string;
  @Field(t.nullable(t.string())) matriculaParticipante!: string | null;
  @Field(t.nullable(t.string())) campoUnicoLgpd!: string | null;
  @Field(t.nullable(t.string())) caminhoCampo!: string | null;
  @Field(t.nullable(t.string())) jsonValorAtual!: string | null;
  @Field(t.nullable(t.string())) jsonValorAnterior!: string | null;
  @Field(t.string()) mensagem!: string;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string()) jsonDetalhes!: string;
  @Field(t.nullable(t.string())) jsonBruto!: string | null;
  @Field(t.nullable(t.string())) jsonNormalizado!: string | null;
  @Field(t.nullable(t.string())) jsonCanonico!: string | null;
  @Field(t.nullable(t.string())) previousCanonicalJson!: string | null;
  @Field(t.nullable(t.string())) notaResolucao!: string | null;
  @Field(t.nullable(t.string({ format: "date-time" }))) resolvidoEm!: string | null;
}

@Dto({ name: "ResolverInconsistenciaCritica", description: "Resolve or justify a persisted cadastral critique occurrence." })
export class ResolverInconsistenciaCriticaDto {
  @Field(t.string({ minLength: 1 })) situacao!: string;
  @Field(t.string({ minLength: 1 })) nota!: string;
}

@Dto({ name: "ProvedorLlm", description: "OpenAI-compatible LLM provider configuration summary." })
export class ProvedorLlmDto {
  @Field(t.integer()) id!: number;
  @Field(t.string()) nome!: string;
  @Field(t.string({ format: "uri" })) urlBase!: string;
  @Field(t.string()) modelo!: string;
  @Field(t.integer({ minimum: 0 })) credentialCount!: number;
  @Field(t.boolean()) habilitado!: boolean;
}

@Dto({ name: "Dashboard", description: "Operational dashboard totals." })
export class DashboardDto {
  @Field(t.integer()) inProgress!: number;
  @Field(t.integer()) awaitingCorrections!: number;
  @Field(t.integer()) pendingStudies!: number;
  @Field(t.integer()) draftsAwaitingReview!: number;
}

import {
  SQLiteSchemaDialect,
  bootstrapEntities,
  getTableDefFromEntity,
  introspectSchema,
  synchronizeSchema,
  type DbExecutor
} from "metal-orm";
import {
  Evaluation,
  ImportFile,
  ImportJob,
  ImportRow,
  LlmProvider,
  LlmProviderCredential,
  MappingProfile,
  MappingRule
} from "./domain/entities.js";
import { User, UserSession } from "./domain/auth-entities.js";
import { Plan } from "./domain/plan-entities.js";
import { CritiqueIssue, CritiqueRule, CritiqueRun } from "./domain/critique-entities.js";
import {
  BiometricTable,
  BiometricTablePoint,
  BiometricTableVersion
} from "./domain/biometric-entities.js";
import {
  AdherenceCandidatePoint,
  AdherenceCandidateResult,
  AdherenceObservation,
  AdherenceStudy
} from "./domain/adherence-entities.js";
import {
  ActuarialHypothesisSelection,
  ActuarialParameterization,
  ActuarialParameterValue
} from "./domain/parameterization-entities.js";
import {
  CalculationInput,
  CalculationParticipantResult,
  CalculationResultMetric,
  CalculationRun
} from "./domain/calculation-entities.js";
import { ActuarialClosing, ActuarialClosingLine } from "./domain/closing-entities.js";
import {
  Beneficio,
  EntidadePrevidencia,
  Submassa,
  UnidadeReferencia,
  ValorUnidadeReferencia
} from "./domain/previdencia-entities.js";

const entityTypes = [
  User,
  UserSession,
  EntidadePrevidencia,
  Plan,
  Submassa,
  Beneficio,
  UnidadeReferencia,
  ValorUnidadeReferencia,
  Evaluation,
  MappingProfile,
  MappingRule,
  ImportFile,
  ImportJob,
  ImportRow,
  CritiqueRule,
  CritiqueRun,
  CritiqueIssue,
  BiometricTable,
  BiometricTableVersion,
  BiometricTablePoint,
  AdherenceStudy,
  AdherenceObservation,
  AdherenceCandidateResult,
  AdherenceCandidatePoint,
  ActuarialParameterization,
  ActuarialParameterValue,
  ActuarialHypothesisSelection,
  CalculationRun,
  CalculationInput,
  CalculationResultMetric,
  CalculationParticipantResult,
  ActuarialClosing,
  ActuarialClosingLine,
  LlmProvider,
  LlmProviderCredential
] as const;

bootstrapEntities();

const nomesTabelas: Record<string, string> = {
  users: "usuarios", user_sessions: "sessoes_usuario", plans: "planos",
  plan_rules_versions: "versoes_regras_plano", plan_rule_values: "valores_regras_plano",
  evaluations: "avaliacoes", mapping_profiles: "perfis_mapeamento", mapping_rules: "regras_mapeamento",
  import_files: "arquivos_importacao", import_jobs: "importacoes", import_rows: "linhas_importacao",
  critique_rules: "regras_critica", critique_runs: "execucoes_critica", critique_issues: "inconsistencias_critica",
  biometric_tables: "tabuas_biometricas", biometric_table_versions: "versoes_tabuas_biometricas", biometric_table_points: "pontos_tabuas_biometricas",
  adherence_studies: "estudos_aderencia", adherence_observations: "observacoes_aderencia", adherence_candidate_results: "resultados_candidatos_aderencia", adherence_candidate_points: "pontos_candidatos_aderencia",
  actuarial_parameterizations: "parametrizacoes_atuariais", actuarial_parameter_values: "valores_parametros_atuariais", actuarial_hypothesis_selections: "selecoes_hipoteses_atuariais",
  calculation_runs: "execucoes_calculo", calculation_inputs: "entradas_calculo", calculation_result_metrics: "metricas_resultado_calculo", calculation_participant_results: "resultados_participantes_calculo",
  actuarial_closings: "fechamentos_atuariais", actuarial_closing_lines: "linhas_fechamento_atuarial",
  llm_providers: "provedores_ia", llm_provider_credentials: "credenciais_provedores_ia"
};

const nomesColunas: Record<string, string> = {
  id: "id", active: "ativo", adherenceStudyId: "estudo_aderencia_id", age: "idade", alpha: "alfa", approvedAt: "aprovado_em", closingId: "fechamento_id", finalizedAt: "finalizado_em",
  baseUrl: "url_base", biometricVersionId: "versao_biometrica_id", blockingCount: "quantidade_bloqueios", blockingIssues: "inconsistencias_bloqueantes",
  calculationRunId: "execucao_calculo_id", candidateCount: "quantidade_candidatos", candidateRank: "posicao_candidato", candidateResultId: "resultado_candidato_id",
  canonicalFingerprint: "impressao_digital_canonica", canonicalJson: "json_canonico", category: "categoria", chiSquare: "qui_quadrado", chiSquareCritical: "qui_quadrado_critico", chiSquareDf: "graus_liberdade_qui_quadrado", chiSquareP: "p_qui_quadrado", chiSquarePass: "qui_quadrado_aprovado",
  cnpj: "cnpj", code: "codigo", completedAt: "concluido_em", configJson: "json_configuracao", createdAt: "criado_em", critiqueRunId: "execucao_critica_id", currentValueJson: "json_valor_atual",
  dataFingerprint: "impressao_digital_dados", derivationParametersJson: "json_parametros_derivacao", derivationType: "tipo_derivacao", description: "descricao", detailsJson: "json_detalhes", displayName: "nome_exibicao", dqm: "dqm",
  effectiveFrom: "vigencia_inicial", effectiveTo: "vigencia_final", email: "email", enabled: "habilitado", engineCode: "codigo_motor", engineVersion: "versao_motor", errorMessage: "mensagem_erro", evaluationId: "avaliacao_id", expectedEvents: "eventos_esperados", expiresAt: "expira_em", exposure: "exposicao", fieldPath: "caminho_campo", fileId: "arquivo_id", fileSha256: "arquivo_sha256", fisherP: "p_fisher", fisherPass: "fisher_aprovado", fisherSplitAge: "idade_divisao_fisher", headerRow: "linha_cabecalho", hypothesisType: "tipo_hipotese", importedAt: "importado_em", importJobId: "importacao_id", importRowId: "linha_importacao_id", inconsistencyCount: "quantidade_inconsistencias", infoCount: "quantidade_informacoes", inputFingerprint: "impressao_digital_entrada", inputImportCount: "quantidade_importacoes_entrada", inputRowCount: "quantidade_linhas_entrada", invalidRowCount: "quantidade_linhas_invalidas", invalidRows: "linhas_invalidas", kind: "tipo", ksCritical: "ks_critico", ksD: "ks_d", ksP: "p_ks", ksPass: "ks_aprovado", label: "rotulo", lastLoginAt: "ultimo_acesso_em", mappedFields: "campos_mapeados", mappingProfileId: "perfil_mapeamento_id", maxAge: "idade_maxima", message: "mensagem", mimeType: "tipo_mime", minAge: "idade_minima", modality: "modalidade", model: "modelo", name: "nome", normalizedJson: "json_normalizado", notes: "observacoes", observationCount: "quantidade_observacoes", observedEvents: "eventos_observados", ordinal: "ordem", originalName: "nome_original", parameterFingerprint: "impressao_digital_parametros", parameterizationId: "parametrizacao_id", parentVersionId: "versao_pai_id", participantRegistration: "matricula_participante", participantResultCount: "quantidade_resultados_participantes", passwordHash: "resumo_senha", periodEnd: "periodo_final", periodStart: "periodo_inicial", planId: "plano_id", planName: "nome_plano", planRulesFingerprint: "impressao_digital_regras_plano", planRulesVersionId: "versao_regras_plano_id", pointCount: "quantidade_pontos", population: "populacao", previousImportJobId: "importacao_anterior_id", previousImportRowId: "linha_importacao_anterior_id", previousValueJson: "json_valor_anterior", priority: "prioridade", profileId: "perfil_id", progress: "progresso", providerId: "provedor_id", qx: "qx", rank: "posicao", rawJson: "json_bruto", referenceDate: "data_referencia", rejectedTests: "testes_rejeitados", residual: "residuo", resolutionNote: "nota_resolucao", resolvedAt: "resolvido_em", resultFingerprint: "impressao_digital_resultado", resultJson: "json_resultado", revokedAt: "revogado_em", role: "perfil", rowCount: "quantidade_linhas", rowNumber: "numero_linha", ruleCode: "codigo_regra", ruleId: "regra_id", rulesFingerprint: "impressao_digital_regras", schemaFingerprint: "impressao_digital_esquema", secretRef: "referencia_segredo", selectedAt: "selecionado_em", severity: "severidade", sex: "sexo", sexScope: "escopo_sexo", sha256: "sha256", sheetName: "nome_aba", sizeBytes: "tamanho_bytes", source: "origem", sourceHeadersJson: "json_cabecalhos_origem", sourceRowNumber: "numero_linha_origem", sourcesJson: "json_origens", sponsorName: "nome_patrocinador", stage: "etapa", status: "situacao", storagePath: "caminho_armazenamento", studyId: "estudo_id", tableCode: "codigo_tabua", tableId: "tabua_id", tableName: "nome_tabua", targetsJson: "json_destinos", tokenHash: "resumo_token", totalFields: "total_campos", transform: "transformacao", unit: "unidade", updatedAt: "atualizado_em", userId: "usuario_id", validationErrorsJson: "json_erros_validacao", validationStatus: "situacao_validacao", validRowCount: "quantidade_linhas_validas", validRows: "linhas_validas", valueJson: "json_valor", valueType: "tipo_valor", version: "versao", versionId: "versao_id", versionLabel: "rotulo_versao", warningCount: "quantidade_avisos", year: "ano", zCritical: "z_critico", zP: "p_z", zPass: "z_aprovado", zStatistic: "estatistica_z",
  entidadePrevidenciaId: "entidade_previdencia_id", submassaId: "submassa_id", beneficioId: "beneficio_id", impressaoDigitalSubmassa: "impressao_digital_submassa"
  ,planoId: "plano_id", criadoEm: "criado_em", atualizadoEm: "atualizado_em", vigenciaInicial: "vigencia_inicial", vigenciaFinal: "vigencia_final", impressaoDigitalRegras: "impressao_digital_regras", observacoes: "observacoes", aprovadaEm: "aprovada_em", tipoBeneficio: "tipo_beneficio", regrasElegibilidadeJson: "json_regras_elegibilidade", formulaValorJson: "json_formula_valor", unidadeReferenciaId: "unidade_referencia_id", valor: "valor"
};

function localizarMetadados(tabela: ReturnType<typeof getTableDefFromEntity>) {
  if (!tabela) return;
  const nomeOriginal = tabela.name;
  tabela.name = nomesTabelas[nomeOriginal] ?? nomeOriginal;
  for (const [nome, coluna] of Object.entries(tabela.columns)) {
    coluna.name = nomesColunas[nome] ?? nome;
    coluna.table = tabela.name;
    if (coluna.references) {
      coluna.references.table = nomesTabelas[coluna.references.table] ?? coluna.references.table;
      coluna.references.column = nomesColunas[coluna.references.column] ?? coluna.references.column;
    }
  }
}

export const entityTables = entityTypes.map((entity) => {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM did not bootstrap ${entity.name}`);
  localizarMetadados(table);
  return table;
});

export async function synchronizeEntitySchema(executor: DbExecutor) {
  const actual = await introspectSchema(executor, "sqlite");
  if (actual.tables.length > 0) {
    const possuiModeloAtual = actual.tables.some((tabela) => tabela.name === "entidades_previdencia");
    if (!possuiModeloAtual) {
      throw new Error("A base atual usa o modelo anterior. Execute npm run banco:reiniciar -w @atuaria-previdenciaria/backend.");
    }
    return;
  }
  await synchronizeSchema(
    entityTables,
    actual,
    new SQLiteSchemaDialect(),
    executor,
    { allowDestructive: false }
  );
}

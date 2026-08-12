import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const schemaMap = {
  Plan: "Plano", CreatePlan: "CriarPlano", UpdatePlan: "AtualizarPlano",
  PlanRulesVersionSummary: "ResumoVersaoRegrasPlano", PlanRulesVersion: "VersaoRegrasPlano",
  CreatePlanRulesVersion: "CriarVersaoRegrasPlano", UpdatePlanRulesVersion: "AtualizarVersaoRegrasPlano",
  SetPlanRuleValue: "DefinirValorRegraPlano", PlanRuleValue: "ValorRegraPlano", Evaluation: "Avaliacao", MappingProfile: "PerfilMapeamento",
  MappingProfileMatch: "CorrespondenciaPerfilMapeamento", MappingProfileMatchRequest: "SolicitacaoCorrespondenciaPerfilMapeamento", ImportResult: "ResultadoImportacao",
  CritiqueRun: "ExecucaoCritica", CritiqueIssue: "InconsistenciaCritica", CritiqueIssueDetail: "DetalheInconsistenciaCritica",
  BiometricPoint: "PontoBiometria", BiometricVersion: "VersaoBiometria", BiometricTableSummary: "ResumoTabuaBiometria",
  BiometricTableDetail: "DetalheTabuaBiometria", BiometricVersionPoints: "PontosVersaoBiometria",
  CreateBiometricTable: "CriarTabuaBiometria", DeriveBiometricVersion: "DerivarVersaoBiometria",
  AdherenceObservation: "ObservacaoAderencia", CreateAdherenceStudy: "CriarEstudoAderencia",
  AdherenceStudySummary: "ResumoEstudoAderencia", AdherenceCandidateResult: "ResultadoCandidatoAderencia",
  AdherenceStudyDetail: "DetalheEstudoAderencia", AdherenceCandidatePoint: "PontoCandidatoAderencia",
  AdherenceCandidatePoints: "PontosCandidatoAderencia", ActuarialHypothesisSelection: "SelecaoHipoteseAtuarial", ActuarialParameterValue: "ValorParametroAtuarial", ActuarialParameterizationSummary: "ResumoParametrizacaoAtuarial",
  ActuarialParameterization: "ParametrizacaoAtuarial", CreateActuarialParameterization: "CriarParametrizacaoAtuarial",
  UpdateActuarialParameterization: "AtualizarParametrizacaoAtuarial", SetActuarialParameterValue: "DefinirValorParametroAtuarial",
  CalculationEngine: "MotorCalculo", CalculationInput: "EntradaCalculo", CalculationResultMetric: "MetricaResultadoCalculo", CalculationRunSummary: "ResumoExecucaoCalculo", CalculationRun: "ExecucaoCalculo",
  CalculationParticipantResult: "ResultadoParticipanteCalculo", CalculationParticipantResultPage: "PaginaResultadosParticipantesCalculo",
  CreateCalculationRun: "CriarExecucaoCalculo", LlmProvider: "ProvedorLlm", AuthUser: "UsuarioAutenticado",
  LoginResponse: "RespostaLogin", CreateUser: "CriarUsuario", UpdateUser: "AtualizarUsuario", Dashboard: "Painel", ApplicationConfig: "ConfiguracaoAplicacao",
  SetPlanRuleValues: "DefinirValoresRegrasPlano", CorrespondenceProfileMatchRequest: "SolicitacaoCorrespondenciaPerfilMapeamento",
  CorrespondenciaPerfilMapeamentoRequest: "SolicitacaoCorrespondenciaPerfilMapeamento", CreateCritiqueRun: "CriarExecucaoCritica",
  ResolveCritiqueIssue: "ResolverInconsistenciaCritica", PromoteAdherenceCandidate: "PromoverCandidatoAderencia",
  RemoveActuarialHypothesisSelection: "RemoverSelecaoHipoteseAtuarial", SetActuarialParameters: "DefinirParametrosAtuariais",
  LogoutResponse: "RespostaLogout", LoginRequest: "SolicitacaoLogin", Health: "SaudeSistema"
};

const propertyMap = {
  createdAt: "criadoEm", updatedAt: "atualizadoEm", completedAt: "concluidoEm", status: "situacao", evaluationId: "avaliacaoId", planId: "planoId",
  participantRegistration: "matriculaParticipante", code: "codigo", name: "nome", modality: "modalidade", sponsorName: "nomePatrocinador", planName: "nomePlano", referenceDate: "dataReferencia", baseUrl: "urlBase",
  population: "populacao", version: "versao", stage: "etapa", progress: "progresso", blockingIssues: "inconsistenciasBloqueantes", factor: "fator", years: "anos",
  source: "origem", description: "descricao", notes: "observacoes", displayName: "nomeExibicao", enabled: "habilitado", kind: "tipo", sex: "sexo", age: "idade", year: "ano", latestVersion: "ultimaVersao", latestVersionId: "ultimaVersaoId", versionCount: "quantidadeVersoes", parameterizationId: "parametrizacaoId", planRulesVersionId: "versaoRegrasPlanoId", candidateVersionIds: "idsVersoesCandidatas", resultKind: "tipoResultado", supportedModalities: "modalidadesSuportadas", requiresPlanRules: "exigeRegrasPlano", sourceRowNumber: "numeroLinhaOrigem", ruleCode: "codigoRegra", copyFromId: "copiarDeId", candidateResultId: "resultadoCandidatoId", biometricVersionId: "versaoBiometriaId", adherenceStudyId: "estudoAderenciaId", candidateRank: "posicaoCandidata", alpha: "alpha",
  candidateCount: "quantidadeCandidatos", inputImportCount: "quantidadeImportacoesEntrada", inputRowCount: "quantidadeLinhasEntrada",
  validRowCount: "quantidadeLinhasValidas", invalidRowCount: "quantidadeLinhasInvalidas", participantResultCount: "quantidadeResultadosParticipantes",
  dataFingerprint: "impressaoDigitalDados", canonicalFingerprint: "impressaoDigitalCanonica", rowCount: "quantidadeLinhas",
  validRows: "linhasValidas", invalidRows: "linhasInvalidas", category: "categoria", severity: "severidade", label: "rotulo",
  unit: "unidade", active: "ativo", priority: "prioridade", model: "modelo", providerId: "provedorId", mappingProfileId: "perfilMapeamentoId",
  previousImportJobId: "importacaoAnteriorId", previousImportRowId: "linhaImportacaoAnteriorId", parentVersionId: "versaoOrigemId",
  derivationType: "tipoDerivacao", derivationParametersJson: "parametrosDerivacaoJson", canonicalJson: "jsonCanonico", message: "mensagem",
  closingId: "fechamentoId", userId: "usuarioId", role: "perfil", expiresAt: "expiraEm", rulesJson: "regrasJson", profileName: "nomePerfil",
  profileId: "perfilMapeamentoId", fileId: "arquivoId", fileSha256: "arquivoSha256", fileName: "nomeArquivo", mappingProfileVersion: "versaoPerfilMapeamento", sheetName: "nomeAba", points: "pontos", candidates: "candidatos", observations: "observacoes",
  versions: "versoes", inputs: "entradas", metrics: "metricas", parameters: "parametros", hypotheses: "hipoteses", rules: "regras",
  lines: "linhas", previousCanonicalJson: "jsonCanonicoAnterior", note: "nota", selectionId: "selecaoId", calculationRunId: "execucaoCalculoId",
  importJobId: "importacaoId", inputFingerprint: "impressaoDigitalEntrada", parameterFingerprint: "impressaoDigitalParametros", resultFingerprint: "impressaoDigitalResultado", resultJson: "jsonResultado", valueJson: "jsonValor", valueType: "tipoValor", sourceHeadersJson: "jsonCabecalhosOrigem", mappedFields: "camposMapeados", totalFields: "quantidadeCampos", observationCount: "quantidadeObservacoes", observedEvents: "eventosObservados", expectedEvents: "eventosEsperados", pointCount: "quantidadePontos", minAge: "idadeMinima", maxAge: "idadeMaxima", versionLabel: "rotuloVersao", tableCode: "codigoTabua", tableName: "nomeTabua", tableId: "tabuaId", studyId: "estudoId", importRowId: "linhaImportacaoId", ordinal: "ordem", originalName: "nomeOriginal", mimeType: "tipoMime", sizeBytes: "tamanhoBytes", storagePath: "caminhoArmazenamento", errorMessage: "mensagemErro", validationStatus: "situacaoValidacao", validationErrorsJson: "jsonErrosValidacao", rawJson: "jsonBruto", normalizedJson: "jsonNormalizado", targetsJson: "jsonDestinos", sourcesJson: "jsonOrigens", transform: "transformacao", effectiveFrom: "vigenciaInicial", effectiveTo: "vigenciaFinal", finalizedAt: "finalizadoEm", approvedAt: "aprovadoEm", selectedAt: "selecionadoEm", fieldPath: "caminhoCampo", currentValueJson: "jsonValorAtual", previousValueJson: "jsonValorAnterior", detailsJson: "jsonDetalhes", configJson: "jsonConfiguracao", resolutionNote: "notaResolucao", resolvedAt: "resolvidoEm", revokedAt: "revogadoEm", lastLoginAt: "ultimoAcessoEm", passwordHash: "resumoSenha", tokenHash: "resumoToken", secretRef: "referenciaSegredo", engineCode: "codigoMotor", engineVersion: "versaoMotor", hypothesisType: "tipoHipotese", periodStart: "periodoInicial", periodEnd: "periodoFinal", sexScope: "escopoSexo", exposure: "exposicao", dqm: "dqm", residual: "residuo", rank: "posicao", chiSquare: "quiQuadrado", chiSquareCritical: "quiQuadradoCritico", chiSquareDf: "quiQuadradoDf", chiSquareP: "quiQuadradoP", chiSquarePass: "quiQuadradoPass", ksCritical: "ksCritico", ksD: "ksD", ksP: "pKs", ksPass: "pKsPass", fisherP: "pFisher", fisherPass: "pFisherPass", fisherSplitAge: "idadeDivisaoFisher", rejectedTests: "testesRejeitados", zCritical: "zCritico", zP: "pZ", zPass: "pZPass", zStatistic: "estatisticaZ", importadoAt: "importadoEm", createdAt: "criadoEm", updatedAt: "atualizadoEm"
};

const operationMap = {
  listPlans: "listarPlanos", getPlan: "obterPlano", createPlan: "criarPlano", updatePlan: "atualizarPlano",
  listEvaluations: "listarAvaliacoes", listMappingProfiles: "listarPerfisMapeamento", matchMappingProfile: "corresponderPerfilMapeamento",
  createImport: "criarImportacao", createCritiqueRun: "criarExecucaoCritica", getCritiqueRun: "obterExecucaoCritica",
  listCritiqueIssues: "listarInconsistenciasCriticas", getCritiqueIssue: "obterInconsistenciaCritica", resolveCritiqueIssue: "resolverInconsistenciaCritica",
  listBiometricTables: "listarTabuasBiometricas", createBiometricTable: "criarTabuaBiometria", getBiometricTable: "obterTabuaBiometria",
  deriveBiometricVersion: "derivarVersaoBiometria", getBiometricVersionPoints: "obterPontosVersaoBiometria",
  listAdherenceStudies: "listarEstudosAderencia", createAdherenceStudy: "criarEstudoAderencia", getAdherenceStudy: "obterEstudoAderencia",
  getAdherenceCandidatePoints: "obterPontosCandidatoAderencia", listParameterizations: "listarParametrizacoesAtuariais",
  createParameterization: "criarParametrizacaoAtuarial", getParameterization: "obterParametrizacaoAtuarial", updateParameterization: "atualizarParametrizacaoAtuarial",
  setActuarialParameters: "definirParametrosAtuariais", promoteAdherenceCandidate: "promoverCandidatoAderencia",
  removeActuarialHypothesis: "removerHipoteseAtuarial", approveParameterization: "aprovarParametrizacaoAtuarial",
  listCalculationEngines: "listarMotoresCalculo", listCalculationRuns: "listarExecucoesCalculo", createCalculationRun: "criarExecucaoCalculo",
  getCalculationRun: "obterExecucaoCalculo", listCalculationParticipants: "listarParticipantesCalculo", listCalculationParticipantResults: "listarParticipantesCalculo",
  listActuarialParameterizations: "listarParametrizacoesAtuariais", createActuarialParameterization: "criarParametrizacaoAtuarial", getActuarialParameterization: "obterParametrizacaoAtuarial", updateActuarialParameterization: "atualizarParametrizacaoAtuarial", removeActuarialHypothesisSelection: "removerHipoteseAtuarial", approveActuarialParameterization: "aprovarParametrizacaoAtuarial", listLlmProviders: "listarProvedoresLlm",
  listPlanRulesVersions: "listarVersoesRegrasPlano", createPlanRulesVersion: "criarVersaoRegrasPlano", getPlanRulesVersion: "obterVersaoRegrasPlano", updatePlanRulesVersion: "atualizarVersaoRegrasPlano", setPlanRuleValues: "definirValoresRegrasPlano", approvePlanRulesVersion: "aprovarVersaoRegrasPlano",
  getApplicationConfig: "obterConfiguracaoAplicacao", getDashboard: "obterPainel", systemHealth: "saudeSistema", currentUser: "usuarioAtual", listUsers: "listarUsuarios", createUser: "criarUsuario", updateUser: "atualizarUsuario",
  listCalculationEngines: "listarMotoresCalculo", createCalculationRun: "criarExecucaoCalculo", getCalculationRun: "obterExecucaoCalculo", listCalculationParticipants: "listarParticipantesCalculo",
  setActuarialParameters: "definirParametrosAtuariais", promoteAdherenceCandidate: "promoverCandidatoAderencia", removeActuarialHypothesis: "removerHipoteseAtuarial", approveParameterization: "aprovarParametrizacaoAtuarial",
  createAdherenceStudy: "criarEstudoAderencia", getAdherenceStudy: "obterEstudoAderencia", getAdherenceCandidatePoints: "obterPontosCandidatoAderencia",
  createCritiqueRun: "criarExecucaoCritica", getCritiqueRun: "obterExecucaoCritica", listCritiqueIssues: "listarInconsistenciasCriticas", getCritiqueIssue: "obterInconsistenciaCritica", resolveCritiqueIssue: "resolverInconsistenciaCritica",
  listBiometricTables: "listarTabuasBiometricas", createBiometricTable: "criarTabuaBiometria", getBiometricTable: "obterTabuaBiometria", deriveBiometricVersion: "derivarVersaoBiometria", getBiometricVersionPoints: "obterPontosVersaoBiometria"
};

const pathMap = {
  "/rules": "/regras", "/values": "/valores", "/approve": "/aprovar", "/finalize": "/finalizar", "/participants": "/participantes", "/derive": "/derivar", "/points": "/pontos", "/parameters": "/parametros", "/adherence-candidate": "/candidato-aderencia", "/hypothesis/remove": "/hipotese/remover", "/runs": "/execucoes", "/issues": "/inconsistencias", "/match": "/correspondencia", "/{evaluationId}": "/{avaliacaoId}", "{evaluationId}": "{avaliacaoId}", "{planId}": "{planoId}"
};

for (const name of await readdir("openapi")) {
  if (!name.endsWith(".json")) continue;
  const file = join("openapi", name);
  const document = JSON.parse(await readFile(file, "utf8"));
  const tagMap = { System: "Sistema", Evaluations: "Avaliacoes", Evaluation: "Avaliacoes", "Data Studio": "EstudioDados", Critique: "Critica", Biometrics: "Biometria", AI: "Ia", Plans: "Planos", "Plan Rules": "RegrasPlano", Adherence: "Aderencia", Calculation: "Calculo", Parameterization: "Parametrizacao", Authentication: "Autenticacao", Users: "Usuarios" };
  if (Array.isArray(document.tags)) document.tags = document.tags.map((tag) => ({ ...tag, name: tagMap[tag.name] ?? tag.name }));
  const schemas = document.components?.schemas;
  if (schemas) {
    const translateSchema = (value) => {
      if (Array.isArray(value)) return value.map(translateSchema);
      if (!value || typeof value !== "object") return value;
      const translatedValue = {};
      for (const [key, child] of Object.entries(value)) {
        if (key === "properties" && child && typeof child === "object" && !Array.isArray(child)) {
          translatedValue[key] = Object.fromEntries(Object.entries(child).map(([propertyName, propertyValue]) => [propertyMap[propertyName] ?? propertyName, translateSchema(propertyValue)]));
        } else if (key === "required" && Array.isArray(child)) {
          translatedValue[key] = child.map((propertyName) => propertyMap[propertyName] ?? propertyName);
        } else {
          translatedValue[key] = translateSchema(child);
        }
      }
      return translatedValue;
    };
    const translated = {};
    for (const [schemaName, schema] of Object.entries(schemas)) {
      translated[schemaMap[schemaName] ?? schemaName] = translateSchema(schema);
    }
    document.components.schemas = translated;
  }
  const translatedPaths = {};
  for (const [pathName, pathItem] of Object.entries(document.paths ?? {})) {
    let translatedPath = pathName;
    for (const [from, to] of Object.entries(pathMap)) translatedPath = translatedPath.replaceAll(from, to);
    translatedPaths[translatedPath] = pathItem;
  }
  document.paths = translatedPaths;
  for (const operation of Object.values(document.paths ?? {}).flatMap((path) => Object.values(path))) {
    if (!operation || typeof operation !== "object") continue;
    if (operation.operationId) operation.operationId = operationMap[operation.operationId] ?? operation.operationId;
    for (const parameter of operation.parameters ?? []) parameter.name = propertyMap[parameter.name] ?? parameter.name;
    operation.tags = operation.tags?.map((tag) => ({ Plans: "Planos", "Plan Rules": "RegrasPlano", Evaluations: "Avaliacoes", Evaluation: "Avaliacoes", "Data Studio": "EstudioDados", AI: "Ia", Biometrics: "Biometria", Adherence: "Aderencia", Calculation: "Calculo", Parameterization: "Parametrizacao", Critique: "Critica", System: "Sistema", Authentication: "Autenticacao", Users: "Usuarios" }[tag] ?? tag));
  }
  let output = JSON.stringify(document, null, 2);
  for (const [from, to] of Object.entries(schemaMap).sort(([a], [b]) => b.length - a.length)) {
    const pattern = new RegExp(`#/components/schemas/${from}(?=")`, "g");
    output = output.replace(pattern, `#/components/schemas/${to}`);
  }
  await writeFile(file, `${output}\n`, "utf8");
}

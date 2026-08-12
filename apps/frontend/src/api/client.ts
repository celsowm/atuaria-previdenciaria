import type { components as ApiComponents } from "./generated/index";

export type Avaliacao = ApiComponents["schemas"]["Avaliacao"];
export type Painel = ApiComponents["schemas"]["Painel"];
export type PerfilMapeamento = ApiComponents["schemas"]["PerfilMapeamento"];
export type CorrespondenciaPerfilMapeamento = ApiComponents["schemas"]["CorrespondenciaPerfilMapeamento"];
export type ResultadoImportacao = ApiComponents["schemas"]["ResultadoImportacao"];
export type ExecucaoCritica = ApiComponents["schemas"]["ExecucaoCritica"];
export type InconsistenciaCritica = ApiComponents["schemas"]["InconsistenciaCritica"];
export type DetalheInconsistenciaCritica = ApiComponents["schemas"]["DetalheInconsistenciaCritica"];
export type PontoBiometria = ApiComponents["schemas"]["PontoBiometria"];
export type VersaoBiometria = ApiComponents["schemas"]["VersaoBiometria"];
export type ResumoTabuaBiometria = ApiComponents["schemas"]["ResumoTabuaBiometria"];
export type DetalheTabuaBiometria = ApiComponents["schemas"]["DetalheTabuaBiometria"];
export type PontosVersaoBiometria = ApiComponents["schemas"]["PontosVersaoBiometria"];
export type CriarTabuaBiometria = ApiComponents["schemas"]["CriarTabuaBiometria"];
export type DerivarVersaoBiometria = ApiComponents["schemas"]["DerivarVersaoBiometria"];
export type ObservacaoAderencia = ApiComponents["schemas"]["ObservacaoAderencia"];
export type CriarEstudoAderencia = ApiComponents["schemas"]["CriarEstudoAderencia"];
export type ResumoEstudoAderencia = ApiComponents["schemas"]["ResumoEstudoAderencia"];
export type ResultadoCandidatoAderencia = ApiComponents["schemas"]["ResultadoCandidatoAderencia"];
export type DetalheEstudoAderencia = ApiComponents["schemas"]["DetalheEstudoAderencia"];
export type PontoCandidatoAderencia = ApiComponents["schemas"]["PontoCandidatoAderencia"];
export type PontosCandidatoAderencia = ApiComponents["schemas"]["PontosCandidatoAderencia"];
export type ResumoParametrizacaoAtuarial = ApiComponents["schemas"]["ResumoParametrizacaoAtuarial"];
export type ParametrizacaoAtuarial = ApiComponents["schemas"]["ParametrizacaoAtuarial"];
export type CriarParametrizacaoAtuarial = ApiComponents["schemas"]["CriarParametrizacaoAtuarial"];
export type AtualizarParametrizacaoAtuarial = ApiComponents["schemas"]["AtualizarParametrizacaoAtuarial"];
export type DefinirValorParametroAtuarial = ApiComponents["schemas"]["DefinirValorParametroAtuarial"];
export type MotorCalculo = ApiComponents["schemas"]["MotorCalculo"];
export type ResumoExecucaoCalculo = ApiComponents["schemas"]["ResumoExecucaoCalculo"];
export type ExecucaoCalculo = ApiComponents["schemas"]["ExecucaoCalculo"];
export type ResultadoParticipanteCalculo = ApiComponents["schemas"]["ResultadoParticipanteCalculo"];
export type PaginaResultadosParticipantesCalculo = ApiComponents["schemas"]["PaginaResultadosParticipantesCalculo"];
export type CriarExecucaoCalculo = ApiComponents["schemas"]["CriarExecucaoCalculo"];
export type ProvedorLlm = ApiComponents["schemas"]["ProvedorLlm"];
export type UsuarioAutenticado = ApiComponents["schemas"]["UsuarioAutenticado"];
export type RespostaLogin = ApiComponents["schemas"]["RespostaLogin"];
export type CriarUsuario = ApiComponents["schemas"]["CriarUsuario"];
export type AtualizarUsuario = ApiComponents["schemas"]["AtualizarUsuario"];
export type Plano = ApiComponents["schemas"]["Plano"];
export type CriarPlano = ApiComponents["schemas"]["CriarPlano"];
export type AtualizarPlano = ApiComponents["schemas"]["AtualizarPlano"];
export type ResumoVersaoRegrasPlano = ApiComponents["schemas"]["ResumoVersaoRegrasPlano"];
export type VersaoRegrasPlano = ApiComponents["schemas"]["VersaoRegrasPlano"];
export type CriarVersaoRegrasPlano = ApiComponents["schemas"]["CriarVersaoRegrasPlano"];
export type AtualizarVersaoRegrasPlano = ApiComponents["schemas"]["AtualizarVersaoRegrasPlano"];
export type DefinirValorRegraPlano = ApiComponents["schemas"]["DefinirValorRegraPlano"];
export type ConfiguracaoAplicacao = ApiComponents["schemas"]["ConfiguracaoAplicacao"];
export type CriarVersaoRegrasPlanoInput = CriarVersaoRegrasPlano;
export type AtualizarVersaoRegrasPlanoInput = AtualizarVersaoRegrasPlano;
export type DefinirValorRegraPlanoInput = DefinirValorRegraPlano;
export type CriarParametrizacaoAtuarialInput = CriarParametrizacaoAtuarial;
export type AtualizarParametrizacaoAtuarialInput = AtualizarParametrizacaoAtuarial;
export type DefinirValorParametroAtuarialInput = DefinirValorParametroAtuarial;
export type CriarExecucaoCalculoInput = CriarExecucaoCalculo;
export type CriarTabuaBiometriaInput = CriarTabuaBiometria;
export type DerivarVersaoBiometriaInput = DerivarVersaoBiometria;
export type CriarEstudoAderenciaInput = CriarEstudoAderencia;
export type FechamentoAtuarial = { id: string; avaliacaoId: number; execucaoCalculoId: string; situacao: "RASCUNHO" | "FINALIZADO"; observacoes: string | null; criadoEm: string; atualizadoEm: string; finalizadoEm: string | null; linhas: Array<{ id: string; codigo: string; categoria: string; rotulo: string; jsonValor: string; unidade: string | null; origem: string; ordem: number }> };

export const defaultApplicationConfig: ConfiguracaoAplicacao = {
  nome: "Atuária Previdenciária",
  shortName: "Atuária Previdenciária",
  organizationName: null
};

export type ImportMappingRule = {
  sources: string[];
  targets: string[];
  transformacao: string;
};

export type ImportWorkbookOptions = {
  populacao: string;
  submassaId: string;
  avaliacaoId?: number;
  perfilMapeamentoId?: number;
  nomePerfil?: string;
  salvarPerfil?: boolean;
  nomeAba?: string;
  linhaCabecalho: number;
  regras: ImportMappingRule[];
};

const tokenKey = "atuaria-previdenciaria.session.token";
const unauthorizedEventName = "atuaria-previdenciaria:unauthorized";

export { unauthorizedEventName };

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenKey);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
}

export function clearAuthToken() {
  if (typeof window !== "undefined") window.localStorage.removeItem(tokenKey);
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401 && url !== "/api/auth/login") {
      clearAuthToken();
      if (typeof window !== "undefined") window.dispatchEvent(new Event(unauthorizedEventName));
    }
    const detail = await response.text();
    throw new Error(detail || `API ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function getJson<T>(url: string) {
  return requestJson<T>(url);
}

function postJson<T>(url: string, body: unknown) {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function patchJson<T>(url: string, body: unknown) {
  return requestJson<T>(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function importWorkbook(file: File, options: ImportWorkbookOptions): Promise<ResultadoImportacao> {
  const form = new FormData();
  form.append("file", file);
  form.append("populacao", options.populacao);
  form.append("submassaId", options.submassaId);
  form.append("linhaCabecalho", String(options.linhaCabecalho));
  form.append("regrasJson", JSON.stringify(options.regras));
  form.append("salvarPerfil", String(options.salvarPerfil ?? true));
  if (options.avaliacaoId !== undefined) form.append("avaliacaoId", String(options.avaliacaoId));
  if (options.perfilMapeamentoId !== undefined) form.append("perfilMapeamentoId", String(options.perfilMapeamentoId));
  if (options.nomePerfil) form.append("nomePerfil", options.nomePerfil);
  if (options.nomeAba) form.append("nomeAba", options.nomeAba);

  return requestJson<ResultadoImportacao>("/api/importacoes/", { method: "POST", body: form });
}

export const api = {
  publicConfig: () => getJson<ConfiguracaoAplicacao>("/api/config"),
  login: (email: string, password: string) => postJson<RespostaLogin>("/api/auth/login", { email, password }),
  me: () => getJson<UsuarioAutenticado>("/api/auth/me"),
  logout: () => requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  usuarios: () => getJson<UsuarioAutenticado[]>("/api/usuarios/"),
  criarUsuario: (input: CriarUsuario) => postJson<UsuarioAutenticado>("/api/usuarios/", input),
  atualizarUsuario: (id: string, input: AtualizarUsuario) => patchJson<UsuarioAutenticado>(`/api/usuarios/${id}`, input),
  plans: () => getJson<Plano[]>("/api/planos/"),
  plan: (id: string) => getJson<Plano>(`/api/planos/${id}`),
  criarPlano: (input: CriarPlano) => postJson<Plano>("/api/planos/", input),
  atualizarPlano: (id: string, input: AtualizarPlano) => patchJson<Plano>(`/api/planos/${id}`, input),
  versoesRegrasPlano: (planoId: string) =>
    getJson<ResumoVersaoRegrasPlano[]>(`/api/planos/${planoId}/regras`),
  versaoRegrasPlano: (id: string) => getJson<VersaoRegrasPlano>(`/api/regras-plano/${id}`),
  criarVersaoRegrasPlano: (planoId: string, input: CriarVersaoRegrasPlanoInput = {}) =>
    postJson<VersaoRegrasPlano>(`/api/planos/${planoId}/regras`, input),
  atualizarVersaoRegrasPlano: (id: string, input: AtualizarVersaoRegrasPlanoInput) =>
    patchJson<VersaoRegrasPlano>(`/api/regras-plano/${id}`, input),
  definirValoresRegrasPlano: (id: string, regras: DefinirValorRegraPlanoInput[]) =>
    patchJson<VersaoRegrasPlano>(`/api/regras-plano/${id}/valores`, { regras }),
  aprovarVersaoRegrasPlano: (id: string) =>
    postJson<VersaoRegrasPlano>(`/api/regras-plano/${id}/aprovar`, {}),
  dashboard: () => getJson<Painel>("/api/dashboard"),
  avaliacoes: () => getJson<Avaliacao[]>("/api/avaliacoes/"),
  parametrizacoes: (avaliacaoId: number) =>
    getJson<ResumoParametrizacaoAtuarial[]>(`/api/avaliacoes/${avaliacaoId}/parametrizacoes`),
  parametrizacao: (id: string) => getJson<ParametrizacaoAtuarial>(`/api/parametrizacoes/${id}`),
  criarParametrizacao: (avaliacaoId: number, input: CriarParametrizacaoAtuarialInput = {}) =>
    postJson<ParametrizacaoAtuarial>(`/api/avaliacoes/${avaliacaoId}/parametrizacoes`, input),
  atualizarParametrizacao: (id: string, input: AtualizarParametrizacaoAtuarialInput) =>
    patchJson<ParametrizacaoAtuarial>(`/api/parametrizacoes/${id}`, input),
  definirParametrosAtuariais: (id: string, parametros: DefinirValorParametroAtuarialInput[]) =>
    patchJson<ParametrizacaoAtuarial>(`/api/parametrizacoes/${id}/parametros`, { parametros }),
  promoverCandidatoAderencia: (id: string, resultadoCandidatoId: string) =>
    postJson<ParametrizacaoAtuarial>(`/api/parametrizacoes/${id}/candidato-aderencia`, { resultadoCandidatoId: resultadoCandidatoId }),
  removerHipoteseAtuarial: (id: string, selecaoId: string) =>
    postJson<ParametrizacaoAtuarial>(`/api/parametrizacoes/${id}/hipotese/remover`, { selecaoId: selecaoId }),
  aprovarParametrizacao: (id: string) =>
    postJson<ParametrizacaoAtuarial>(`/api/parametrizacoes/${id}/aprovar`, {}),
  motoresCalculo: () => getJson<MotorCalculo[]>("/api/motores-calculo"),
  execucoesCalculo: (avaliacaoId: number) =>
    getJson<ResumoExecucaoCalculo[]>(`/api/avaliacoes/${avaliacaoId}/calculos`),
  execucaoCalculo: (id: string) => getJson<ExecucaoCalculo>(`/api/calculos/${id}`),
  resultadosParticipantesCalculo: (id: string, page = 1, pageSize = 50) =>
    getJson<PaginaResultadosParticipantesCalculo>(`/api/calculos/${id}/participantes?page=${page}&tamanhoPagina=${pageSize}`),
  criarExecucaoCalculo: (avaliacaoId: number, input: CriarExecucaoCalculoInput) =>
    postJson<ExecucaoCalculo>(`/api/avaliacoes/${avaliacaoId}/calculos`, input),
  fechamentos: (avaliacaoId: number) => getJson<FechamentoAtuarial[]>(`/api/avaliacoes/${avaliacaoId}/fechamentos`),
  criarFechamento: (avaliacaoId: number, execucaoCalculoId: string, observacoes?: string) => postJson<FechamentoAtuarial>(`/api/avaliacoes/${avaliacaoId}/fechamentos`, { execucaoCalculoId, observacoes }),
  finalizarFechamento: (id: string) => postJson<FechamentoAtuarial>(`/api/fechamentos/${id}/finalizar`, {}),
  perfisMapeamento: () => getJson<PerfilMapeamento[]>("/api/perfis-mapeamento/"),
  corresponderPerfilMapeamento: (headers: string[], populacao: string) =>
    postJson<CorrespondenciaPerfilMapeamento>("/api/perfis-mapeamento/correspondencia", { headers, populacao }),
  importWorkbook,
  criarExecucaoCritica: (importacaoId: string, importacaoAnteriorId?: string) =>
    postJson<ExecucaoCritica>("/api/critica/execucoes", { importacaoId, importacaoAnteriorId }),
  execucaoCritica: (id: string) => getJson<ExecucaoCritica>(`/api/critica/execucoes/${id}`),
  inconsistenciasCritica: (runId: string) => getJson<InconsistenciaCritica[]>(`/api/critica/execucoes/${runId}/inconsistencias`),
  inconsistenciaCritica: (id: string) => getJson<DetalheInconsistenciaCritica>(`/api/critica/inconsistencias/${id}`),
  resolverInconsistenciaCritica: (id: string, status: "JUSTIFICADO" | "RESOLVIDO" | "IGNORADO", note: string) =>
    patchJson<DetalheInconsistenciaCritica>(`/api/critica/inconsistencias/${id}`, { situacao: status, nota: note }),
  tabuasBiometricas: () => getJson<ResumoTabuaBiometria[]>("/api/tabuas-biometricas/"),
  tabuaBiometrica: (id: string) => getJson<DetalheTabuaBiometria>(`/api/tabuas-biometricas/${id}`),
  criarTabuaBiometrica: (input: CriarTabuaBiometriaInput) =>
    postJson<DetalheTabuaBiometria>("/api/tabuas-biometricas/", input),
  pontosVersaoBiometria: (id: string) =>
    getJson<PontosVersaoBiometria>(`/api/versoes-tabuas-biometricas/${id}/pontos`),
  derivarVersaoBiometria: (tabuaId: string, input: DerivarVersaoBiometriaInput) =>
    postJson<PontosVersaoBiometria>(`/api/tabuas-biometricas/${tabuaId}/derivar`, input),
  estudosAderencia: () => getJson<ResumoEstudoAderencia[]>("/api/estudos-aderencia/"),
  estudoAderencia: (id: string) => getJson<DetalheEstudoAderencia>(`/api/estudos-aderencia/${id}`),
  criarEstudoAderencia: (input: CriarEstudoAderenciaInput) =>
    postJson<DetalheEstudoAderencia>("/api/estudos-aderencia/", input),
  pontosCandidatoAderencia: (id: string) =>
    getJson<PontosCandidatoAderencia>(`/api/candidatos-aderencia/${id}/pontos`),
  provedoresLlm: () => getJson<ProvedorLlm[]>("/api/llm/providers/")
};

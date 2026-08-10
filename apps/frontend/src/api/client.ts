import type { components as ApiComponents } from "./generated/index";

export type Evaluation = ApiComponents["schemas"]["Evaluation"];
export type DashboardTotals = ApiComponents["schemas"]["Dashboard"];
export type MappingProfile = ApiComponents["schemas"]["MappingProfile"];
export type MappingProfileMatch = ApiComponents["schemas"]["MappingProfileMatch"];
export type ImportResult = ApiComponents["schemas"]["ImportResult"];
export type CritiqueRun = ApiComponents["schemas"]["CritiqueRun"];
export type CritiqueIssue = ApiComponents["schemas"]["CritiqueIssue"];
export type CritiqueIssueDetail = ApiComponents["schemas"]["CritiqueIssueDetail"];
export type BiometricPoint = ApiComponents["schemas"]["BiometricPoint"];
export type BiometricVersion = ApiComponents["schemas"]["BiometricVersion"];
export type BiometricTableSummary = ApiComponents["schemas"]["BiometricTableSummary"];
export type BiometricTableDetail = ApiComponents["schemas"]["BiometricTableDetail"];
export type BiometricVersionPoints = ApiComponents["schemas"]["BiometricVersionPoints"];
export type CreateBiometricTableInput = ApiComponents["schemas"]["CreateBiometricTable"];
export type DeriveBiometricVersionInput = ApiComponents["schemas"]["DeriveBiometricVersion"];
export type AdherenceObservation = ApiComponents["schemas"]["AdherenceObservation"];
export type CreateAdherenceStudyInput = ApiComponents["schemas"]["CreateAdherenceStudy"];
export type AdherenceStudySummary = ApiComponents["schemas"]["AdherenceStudySummary"];
export type AdherenceCandidateResult = ApiComponents["schemas"]["AdherenceCandidateResult"];
export type AdherenceStudyDetail = ApiComponents["schemas"]["AdherenceStudyDetail"];
export type AdherenceCandidatePoint = ApiComponents["schemas"]["AdherenceCandidatePoint"];
export type AdherenceCandidatePoints = ApiComponents["schemas"]["AdherenceCandidatePoints"];
export type ActuarialParameterizationSummary = ApiComponents["schemas"]["ActuarialParameterizationSummary"];
export type ActuarialParameterization = ApiComponents["schemas"]["ActuarialParameterization"];
export type CreateActuarialParameterizationInput = ApiComponents["schemas"]["CreateActuarialParameterization"];
export type UpdateActuarialParameterizationInput = ApiComponents["schemas"]["UpdateActuarialParameterization"];
export type SetActuarialParameterValueInput = ApiComponents["schemas"]["SetActuarialParameterValue"];
export type LlmProvider = ApiComponents["schemas"]["LlmProvider"];
export type AuthUser = ApiComponents["schemas"]["AuthUser"];
export type LoginResponse = ApiComponents["schemas"]["LoginResponse"];
export type CreateUserInput = ApiComponents["schemas"]["CreateUser"];
export type UpdateUserInput = ApiComponents["schemas"]["UpdateUser"];
export type Plan = ApiComponents["schemas"]["Plan"];
export type CreatePlanInput = ApiComponents["schemas"]["CreatePlan"];
export type UpdatePlanInput = ApiComponents["schemas"]["UpdatePlan"];
export type ApplicationConfig = ApiComponents["schemas"]["ApplicationConfig"];

export const defaultApplicationConfig: ApplicationConfig = {
  name: "Atuária Previdenciária",
  shortName: "Atuária Previdenciária",
  organizationName: null
};

export type ImportMappingRule = {
  sources: string[];
  targets: string[];
  transform: string;
};

export type ImportWorkbookOptions = {
  population: string;
  evaluationId?: number;
  profileId?: number;
  profileName?: string;
  saveProfile?: boolean;
  sheetName?: string;
  headerRow: number;
  rules: ImportMappingRule[];
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

async function importWorkbook(file: File, options: ImportWorkbookOptions): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("population", options.population);
  form.append("headerRow", String(options.headerRow));
  form.append("rulesJson", JSON.stringify(options.rules));
  form.append("saveProfile", String(options.saveProfile ?? true));
  if (options.evaluationId !== undefined) form.append("evaluationId", String(options.evaluationId));
  if (options.profileId !== undefined) form.append("profileId", String(options.profileId));
  if (options.profileName) form.append("profileName", options.profileName);
  if (options.sheetName) form.append("sheetName", options.sheetName);

  return requestJson<ImportResult>("/api/imports/", { method: "POST", body: form });
}

export const api = {
  publicConfig: () => getJson<ApplicationConfig>("/api/config"),
  login: (email: string, password: string) => postJson<LoginResponse>("/api/auth/login", { email, password }),
  me: () => getJson<AuthUser>("/api/auth/me"),
  logout: () => requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  users: () => getJson<AuthUser[]>("/api/users/"),
  createUser: (input: CreateUserInput) => postJson<AuthUser>("/api/users/", input),
  updateUser: (id: string, input: UpdateUserInput) => patchJson<AuthUser>(`/api/users/${id}`, input),
  plans: () => getJson<Plan[]>("/api/plans/"),
  plan: (id: string) => getJson<Plan>(`/api/plans/${id}`),
  createPlan: (input: CreatePlanInput) => postJson<Plan>("/api/plans/", input),
  updatePlan: (id: string, input: UpdatePlanInput) => patchJson<Plan>(`/api/plans/${id}`, input),
  dashboard: () => getJson<DashboardTotals>("/api/dashboard"),
  evaluations: () => getJson<Evaluation[]>("/api/evaluations/"),
  parameterizations: (evaluationId: number) =>
    getJson<ActuarialParameterizationSummary[]>(`/api/evaluations/${evaluationId}/parameterizations`),
  parameterization: (id: string) => getJson<ActuarialParameterization>(`/api/parameterizations/${id}`),
  createParameterization: (evaluationId: number, input: CreateActuarialParameterizationInput = {}) =>
    postJson<ActuarialParameterization>(`/api/evaluations/${evaluationId}/parameterizations`, input),
  updateParameterization: (id: string, input: UpdateActuarialParameterizationInput) =>
    patchJson<ActuarialParameterization>(`/api/parameterizations/${id}`, input),
  setActuarialParameters: (id: string, parameters: SetActuarialParameterValueInput[]) =>
    patchJson<ActuarialParameterization>(`/api/parameterizations/${id}/parameters`, { parameters }),
  promoteAdherenceCandidate: (id: string, candidateResultId: string) =>
    postJson<ActuarialParameterization>(`/api/parameterizations/${id}/adherence-candidate`, { candidateResultId }),
  approveParameterization: (id: string) =>
    postJson<ActuarialParameterization>(`/api/parameterizations/${id}/approve`, {}),
  mappingProfiles: () => getJson<MappingProfile[]>("/api/mapping-profiles/"),
  matchMappingProfile: (headers: string[], population: string) =>
    postJson<MappingProfileMatch>("/api/mapping-profiles/match", { headers, population }),
  importWorkbook,
  createCritiqueRun: (importJobId: string, previousImportJobId?: string) =>
    postJson<CritiqueRun>("/api/critique/runs", { importJobId, previousImportJobId }),
  critiqueRun: (id: string) => getJson<CritiqueRun>(`/api/critique/runs/${id}`),
  critiqueIssues: (runId: string) => getJson<CritiqueIssue[]>(`/api/critique/runs/${runId}/issues`),
  critiqueIssue: (id: string) => getJson<CritiqueIssueDetail>(`/api/critique/issues/${id}`),
  resolveCritiqueIssue: (id: string, status: "JUSTIFIED" | "RESOLVED" | "IGNORED", note: string) =>
    patchJson<CritiqueIssueDetail>(`/api/critique/issues/${id}`, { status, note }),
  biometricTables: () => getJson<BiometricTableSummary[]>("/api/biometric-tables/"),
  biometricTable: (id: string) => getJson<BiometricTableDetail>(`/api/biometric-tables/${id}`),
  createBiometricTable: (input: CreateBiometricTableInput) =>
    postJson<BiometricTableDetail>("/api/biometric-tables/", input),
  biometricVersionPoints: (id: string) =>
    getJson<BiometricVersionPoints>(`/api/biometric-versions/${id}/points`),
  deriveBiometricVersion: (tableId: string, input: DeriveBiometricVersionInput) =>
    postJson<BiometricVersionPoints>(`/api/biometric-tables/${tableId}/derive`, input),
  adherenceStudies: () => getJson<AdherenceStudySummary[]>("/api/adherence-studies/"),
  adherenceStudy: (id: string) => getJson<AdherenceStudyDetail>(`/api/adherence-studies/${id}`),
  createAdherenceStudy: (input: CreateAdherenceStudyInput) =>
    postJson<AdherenceStudyDetail>("/api/adherence-studies/", input),
  adherenceCandidatePoints: (id: string) =>
    getJson<AdherenceCandidatePoints>(`/api/adherence-candidates/${id}/points`),
  llmProviders: () => getJson<LlmProvider[]>("/api/llm/providers/")
};

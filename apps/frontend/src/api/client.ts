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
export type LlmProvider = ApiComponents["schemas"]["LlmProvider"];

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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `ATUAS API ${response.status}: ${response.statusText}`);
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
  dashboard: () => getJson<DashboardTotals>("/api/dashboard"),
  evaluations: () => getJson<Evaluation[]>("/api/evaluations/"),
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
  llmProviders: () => getJson<LlmProvider[]>("/api/llm/providers/")
};

export type Evaluation = {
  id: number;
  planName: string;
  referenceDate: string;
  status: string;
  stage: string;
  progress: number;
  blockingIssues: number;
  updatedAt: string;
};

export type DashboardTotals = {
  inProgress: number;
  awaitingCorrections: number;
  pendingStudies: number;
  draftsAwaitingReview: number;
};

export type MappingProfile = {
  id: number;
  name: string;
  population: string;
  version: string;
  mappedFields: number;
  totalFields: number;
  updatedAt: string;
};

export type MappingProfileMatch = {
  matched: boolean;
  profileId?: number;
  profileName?: string;
  version?: string;
  compatibility: number;
  exact: boolean;
  missingColumns: string[];
  newColumns: string[];
  rulesJson: string;
};

export type ImportResult = {
  id: string;
  fileId: string;
  mappingProfileId: number | null;
  mappingProfileVersion: string | null;
  fileName: string;
  fileSha256: string;
  population: string;
  sheetName: string;
  rowCount: number;
  validRows: number;
  invalidRows: number;
  status: string;
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

export type LlmProvider = {
  id: number;
  name: string;
  baseUrl: string;
  model: string;
  credentialCount: number;
  enabled: boolean;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ATUAS API ${response.status}: ${response.statusText}`);
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `ATUAS API ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
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

  const response = await fetch("/api/imports/", { method: "POST", body: form });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `ATUAS API ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<ImportResult>;
}

export const api = {
  dashboard: () => getJson<DashboardTotals>("/api/dashboard"),
  evaluations: () => getJson<Evaluation[]>("/api/evaluations/"),
  mappingProfiles: () => getJson<MappingProfile[]>("/api/mapping-profiles/"),
  matchMappingProfile: (headers: string[], population: string) =>
    postJson<MappingProfileMatch>("/api/mapping-profiles/match", { headers, population }),
  importWorkbook,
  llmProviders: () => getJson<LlmProvider[]>("/api/llm/providers/")
};
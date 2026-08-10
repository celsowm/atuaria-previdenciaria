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

export const api = {
  dashboard: () => getJson<DashboardTotals>("/api/dashboard"),
  evaluations: () => getJson<Evaluation[]>("/api/evaluations/"),
  mappingProfiles: () => getJson<MappingProfile[]>("/api/mapping-profiles/"),
  llmProviders: () => getJson<LlmProvider[]>("/api/llm/providers/")
};

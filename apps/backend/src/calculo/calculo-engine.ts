export type CalculationParameter = {
  code: string;
  category: string;
  label: string;
  valueType: string;
  valueJson: string;
  unit: string | null;
  source: string;
};

export type CalculationBiometricPoint = {
  age: number;
  sex: string;
  qx: number;
};

export type CalculationHypothesis = {
  hypothesisType: string;
  adherenceStudyId: string;
  candidateResultId: string;
  biometricVersionId: string;
  tableCode: string;
  tableName: string;
  versionLabel: string;
  candidateRank: number;
  points: CalculationBiometricPoint[];
};

export type CalculationPlanRule = {
  code: string;
  category: string;
  label: string;
  valueType: string;
  valueJson: string;
  unit: string | null;
  source: string;
};

export type CalculationCanonicalRow = {
  importJobId: string;
  population: string;
  rowNumber: number;
  data: Record<string, unknown>;
};

export type CalculationEngineContext = {
  evaluation: {
    id: number;
    planId: string | null;
    planName: string;
    referenceDate: string;
  };
  planRules: {
    id: string;
    version: number;
    modality: "BD" | "CD" | "CV";
    effectiveFrom: string;
    effectiveTo: string | null;
    fingerprint: string;
    rules: CalculationPlanRule[];
  } | null;
  parameterization: {
    id: string;
    version: number;
    parameters: CalculationParameter[];
    hypotheses: CalculationHypothesis[];
  };
  rows: CalculationCanonicalRow[];
  invalidRowCount: number;
  importCount: number;
};

export type CalculationMetric = {
  code: string;
  category: string;
  label: string;
  valueType: "NUMBER" | "INTEGER" | "TEXT" | "BOOLEAN";
  value: number | string | boolean;
  unit?: string | null;
};

export type CalculationParticipantOutput = {
  importJobId: string;
  population: string;
  sourceRowNumber: number;
  participantRegistration: string | null;
  campoUnicoLgpd: string | null;
  result: Record<string, string | number | boolean | null>;
};

export type CalculationEngineOutput = {
  metrics: CalculationMetric[];
  participantResults: CalculationParticipantOutput[];
};

export type CalculationEngine = {
  code: string;
  version: string;
  label: string;
  description: string;
  resultKind: "PRECALCULATION" | "ACTUARIAL";
  requiresPlanRules: boolean;
  supportedModalities: Array<"BD" | "CD" | "CV">;
  execute(context: CalculationEngineContext): Promise<CalculationEngineOutput>;
};

const engines = new Map<string, CalculationEngine>();

export function validateCalculationMetrics(metrics: CalculationMetric[]) {
  const codes = new Set<string>();
  for (const metric of metrics) {
    const code = metric.code.trim();
    if (!code) throw new Error("O motor retornou uma métrica sem código.");
    if (codes.has(code)) throw new Error(`O motor retornou a métrica duplicada ${code}.`);
    codes.add(code);
    if (!metric.category.trim()) throw new Error(`A métrica ${code} não possui categoria.`);
    if (!metric.label.trim()) throw new Error(`A métrica ${code} não possui rótulo.`);
    if (metric.valueType === "NUMBER" && (typeof metric.value !== "number" || !Number.isFinite(metric.value))) {
      throw new Error(`A métrica ${code} deve possuir número finito.`);
    }
    if (metric.valueType === "INTEGER" && (typeof metric.value !== "number" || !Number.isInteger(metric.value))) {
      throw new Error(`A métrica ${code} deve possuir valor inteiro.`);
    }
    if (metric.valueType === "TEXT" && typeof metric.value !== "string") {
      throw new Error(`A métrica ${code} deve possuir valor textual.`);
    }
    if (metric.valueType === "BOOLEAN" && typeof metric.value !== "boolean") {
      throw new Error(`A métrica ${code} deve possuir valor booleano.`);
    }
  }
  return metrics;
}

function validateParticipantValue(value: unknown, path: string) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new Error(`Resultado individual inválido em ${path}. Apenas string, number finito, boolean e null são permitidos.`);
}

export function validateCalculationOutput(output: CalculationEngineOutput) {
  const metrics = validateCalculationMetrics(output.metrics);
  const keys = new Set<string>();
  for (const item of output.participantResults) {
    if (!item.importJobId.trim()) throw new Error("Resultado individual sem importJobId.");
    if (!item.population.trim()) throw new Error("Resultado individual sem população.");
    if (!Number.isInteger(item.sourceRowNumber) || item.sourceRowNumber < 1) {
      throw new Error("Resultado individual possui sourceRowNumber inválido.");
    }
    const key = `${item.importJobId}:${item.sourceRowNumber}`;
    if (keys.has(key)) throw new Error(`Resultado individual duplicado para ${key}.`);
    keys.add(key);
    for (const [field, value] of Object.entries(item.result)) {
      if (!field.trim()) throw new Error(`Resultado individual ${key} possui campo vazio.`);
      validateParticipantValue(value, `${key}.${field}`);
    }
  }
  return { metrics, participantResults: output.participantResults };
}

export function registerCalculationEngine(engine: CalculationEngine) {
  const code = engine.code.trim();
  const version = engine.version.trim();
  if (!code || !version) throw new Error("Motor de cálculo precisa de code e version.");
  if (!engine.supportedModalities.length) throw new Error(`Motor ${code} precisa declarar ao menos uma modalidade.`);
  if (engine.resultKind === "ACTUARIAL" && !engine.requiresPlanRules) {
    throw new Error(`Motor atuarial ${code} precisa exigir uma versão aprovada das regras do plano.`);
  }
  if (engines.has(code)) {
    throw new Error(`Motor de cálculo duplicado: ${code}.`);
  }
  engines.set(code, engine);
}

export function listCalculationEngines() {
  return [...engines.values()].map(({ code, version, label, description, resultKind, requiresPlanRules, supportedModalities }) => ({
    code,
    version,
    label,
    description,
    resultKind,
    requiresPlanRules,
    supportedModalities
  }));
}

export function getCalculationEngine(code: string) {
  const engine = engines.get(code);
  if (!engine) throw new Error(`Motor de cálculo não encontrado: ${code}.`);
  return engine;
}

export type CalculationParameter = {
  code: string;
  category: string;
  label: string;
  valueType: string;
  valueJson: string;
  unit: string | null;
  source: string;
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
};

export type CalculationCanonicalRow = {
  population: string;
  rowNumber: number;
  data: Record<string, unknown>;
};

export type CalculationEngineContext = {
  evaluation: {
    id: number;
    planName: string;
    referenceDate: string;
  };
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

export type CalculationEngine = {
  code: string;
  version: string;
  label: string;
  description: string;
  resultKind: "PRECALCULATION" | "ACTUARIAL";
  execute(context: CalculationEngineContext): Promise<CalculationMetric[]>;
};

const engines = new Map<string, CalculationEngine>();

export function registerCalculationEngine(engine: CalculationEngine) {
  if (engines.has(engine.code)) {
    throw new Error(`Motor de cálculo duplicado: ${engine.code}.`);
  }
  engines.set(engine.code, engine);
}

export function listCalculationEngines() {
  return [...engines.values()].map(({ code, version, label, description, resultKind }) => ({
    code,
    version,
    label,
    description,
    resultKind
  }));
}

export function getCalculationEngine(code: string) {
  const engine = engines.get(code);
  if (!engine) throw new Error(`Motor de cálculo não encontrado: ${code}.`);
  return engine;
}

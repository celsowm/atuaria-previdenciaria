import {
  registerCalculationEngine,
  type CalculationEngineContext,
  type CalculationMetric
} from "./calculation-engine.js";

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageAt(referenceDate: string, birthDate: unknown) {
  const reference = parseIsoDate(referenceDate);
  const birth = parseIsoDate(birthDate);
  if (!reference || !birth || birth > reference) return null;
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    reference.getUTCMonth() < birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

function parameterNumber(context: CalculationEngineContext, code: string) {
  const parameter = context.parameterization.parameters.find((item) => item.code === code);
  if (!parameter) return null;
  try {
    const value = JSON.parse(parameter.valueJson) as unknown;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function integerMetric(code: string, category: string, label: string, value: number): CalculationMetric {
  return { code, category, label, valueType: "INTEGER", value };
}

function numberMetric(code: string, category: string, label: string, value: number, unit?: string): CalculationMetric {
  return { code, category, label, valueType: "NUMBER", value, unit: unit ?? null };
}

async function execute(context: CalculationEngineContext): Promise<CalculationMetric[]> {
  if (!context.rows.length) throw new Error("Não existem linhas canônicas válidas para cálculo.");

  let male = 0;
  let female = 0;
  let ageCount = 0;
  let ageSum = 0;
  const populations = new Set<string>();

  for (const row of context.rows) {
    populations.add(row.population);
    const sex = String(row.data["participant.sex"] ?? "").toUpperCase();
    if (sex === "MALE") male += 1;
    if (sex === "FEMALE") female += 1;
    const age = ageAt(context.evaluation.referenceDate, row.data["participant.birthDate"]);
    if (age !== null) {
      ageCount += 1;
      ageSum += age;
    }
  }

  const metrics: CalculationMetric[] = [
    integerMetric("INPUT.IMPORT_COUNT", "Base cadastral", "Imports congelados", context.importCount),
    integerMetric("INPUT.POPULATION_COUNT", "Base cadastral", "Populações", populations.size),
    integerMetric("INPUT.VALID_ROWS", "Base cadastral", "Registros válidos", context.rows.length),
    integerMetric("INPUT.INVALID_ROWS", "Base cadastral", "Registros inválidos excluídos", context.invalidRowCount),
    integerMetric("DEMOGRAPHIC.MALE_COUNT", "Demográficas", "Participantes masculinos", male),
    integerMetric("DEMOGRAPHIC.FEMALE_COUNT", "Demográficas", "Participantes femininos", female),
    integerMetric("PARAMETERIZATION.PARAMETER_COUNT", "Parametrização", "Parâmetros ativos", context.parameterization.parameters.length),
    integerMetric("PARAMETERIZATION.HYPOTHESIS_COUNT", "Parametrização", "Hipóteses selecionadas", context.parameterization.hypotheses.length)
  ];

  if (ageCount > 0) {
    metrics.push(numberMetric("DEMOGRAPHIC.AVERAGE_AGE", "Demográficas", "Idade média", ageSum / ageCount, "anos"));
  }

  const realInterestPercent = parameterNumber(context, "ECONOMIC.REAL_INTEREST_RATE");
  if (realInterestPercent !== null) {
    const annualRate = realInterestPercent / 100;
    if (annualRate <= -1) throw new Error("A taxa real de juros deve ser superior a -100% a.a.");
    metrics.push(numberMetric("FINANCE.REAL_INTEREST_RATE", "Financeiras", "Taxa real de juros", realInterestPercent, "% a.a."));
    for (const years of [1, 10, 30]) {
      metrics.push(numberMetric(
        `FINANCE.DISCOUNT_FACTOR_${years}Y`,
        "Financeiras",
        `Fator de desconto em ${years} ano${years === 1 ? "" : "s"}`,
        1 / Math.pow(1 + annualRate, years),
        null
      ));
    }
  }

  return metrics;
}

registerCalculationEngine({
  code: "CORE_PRECALCULATION",
  version: "core-precalculation-v1",
  label: "Pré-cálculo determinístico",
  description: "Consolida a base canônica congelada, métricas demográficas e fatores financeiros sem produzir reservas ou provisões oficiais.",
  resultKind: "PRECALCULATION",
  requiresPlanRules: false,
  supportedModalities: ["BD", "CD", "CV"],
  execute
});

import "./core-precalculation-engine.js";
import { getCalculationEngine, validateCalculationMetrics } from "./calculation-engine.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function metricNumber(metrics: ReturnType<typeof validateCalculationMetrics>, code: string) {
  const metric = metrics.find((item) => item.code === code);
  assert(metric, `Métrica ausente: ${code}`);
  assert(typeof metric.value === "number", `Métrica ${code} não é numérica.`);
  return metric.value;
}

const engine = getCalculationEngine("CORE_PRECALCULATION");
const metrics = validateCalculationMetrics(await engine.execute({
  evaluation: {
    id: 1,
    planName: "Plano Teste",
    referenceDate: "2025-12-31"
  },
  parameterization: {
    id: "00000000-0000-4000-8000-000000000001",
    version: 1,
    parameters: [{
      code: "ECONOMIC.REAL_INTEREST_RATE",
      category: "Econômicas",
      label: "Taxa real de juros",
      valueType: "NUMBER",
      valueJson: "5",
      unit: "% a.a.",
      source: "SELF_TEST"
    }],
    hypotheses: []
  },
  rows: [
    {
      population: "Ativos",
      rowNumber: 2,
      data: {
        "participant.registration": "1",
        "participant.birthDate": "1985-11-25",
        "participant.sex": "MALE"
      }
    },
    {
      population: "Ativos",
      rowNumber: 3,
      data: {
        "participant.registration": "2",
        "participant.birthDate": "1990-04-03",
        "participant.sex": "FEMALE"
      }
    }
  ],
  invalidRowCount: 0,
  importCount: 1
}));

assert(metricNumber(metrics, "INPUT.VALID_ROWS") === 2, "Quantidade de linhas válidas incorreta.");
assert(metricNumber(metrics, "DEMOGRAPHIC.MALE_COUNT") === 1, "Quantidade masculina incorreta.");
assert(metricNumber(metrics, "DEMOGRAPHIC.FEMALE_COUNT") === 1, "Quantidade feminina incorreta.");
assert(Math.abs(metricNumber(metrics, "DEMOGRAPHIC.AVERAGE_AGE") - 37.5) < 1e-12, "Idade média incorreta.");
assert(Math.abs(metricNumber(metrics, "FINANCE.DISCOUNT_FACTOR_1Y") - (1 / 1.05)) < 1e-12, "Fator de desconto de 1 ano incorreto.");
assert(Math.abs(metricNumber(metrics, "FINANCE.DISCOUNT_FACTOR_10Y") - (1 / Math.pow(1.05, 10))) < 1e-12, "Fator de desconto de 10 anos incorreto.");
assert(Math.abs(metricNumber(metrics, "FINANCE.DISCOUNT_FACTOR_30Y") - (1 / Math.pow(1.05, 30))) < 1e-12, "Fator de desconto de 30 anos incorreto.");

console.log("Calculation engine self-test: OK");

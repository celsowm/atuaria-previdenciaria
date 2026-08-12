import "./pre-calculo-nuclear-engine.js";
import { getCalculoEngine, validateCalculationOutput } from "./calculo-engine.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function metricNumber(metrics: ReturnType<typeof validateCalculationOutput>["metrics"], codigo: string) {
  const metric = metrics.find((item) => item.codigo === codigo);
  assert(metric, `Métrica ausente: ${codigo}`);
  assert(typeof metric.value === "number", `Métrica ${codigo} não é numérica.`);
  return metric.value;
}

const engine = getCalculoEngine("CORE_PRECALCULATION");
const output = validateCalculationOutput(await engine.execute({
  evaluation: {
    id: 1,
    planoId: null,
    nomePlano: "Plano Teste",
    dataReferencia: "2025-12-31"
  },
  planRules: null,
  parametrizacao: {
    id: "00000000-0000-4000-8000-000000000001",
    versao: 1,
    parameters: [{
      codigo: "ECONOMIC.REAL_INTEREST_RATE",
      categoria: "Econômicas",
      rotulo: "Taxa real de juros",
      tipoValor: "NUMBER",
      jsonValor: "5",
      unidade: "% a.a.",
      origem: "SELF_TEST"
    }],
    hypotheses: []
  },
  rows: [
    {
      importacaoId: "10000000-0000-4000-8000-000000000001",
      populacao: "Ativos",
      numeroLinha: 2,
      data: {
        "participant.registration": "1",
        "participant.birthDate": "1985-11-25",
        "participant.sexo": "MASCULINO"
      }
    },
    {
      importacaoId: "10000000-0000-4000-8000-000000000001",
      populacao: "Ativos",
      numeroLinha: 3,
      data: {
        "participant.registration": "2",
        "participant.birthDate": "1990-04-03",
        "participant.sexo": "FEMININO"
      }
    }
  ],
  quantidadeLinhasInvalidas: 0,
  importCount: 1
}));

const metrics = output.metrics;
assert(output.participantResults.length === 0, "Pré-cálculo não deve gerar resultados individuais atuariais.");
assert(metricNumber(metrics, "INPUT.VALID_ROWS") === 2, "Quantidade de linhas válidas incorreta.");
assert(metricNumber(metrics, "DEMOGRAPHIC.MALE_COUNT") === 1, "Quantidade masculina incorreta.");
assert(metricNumber(metrics, "DEMOGRAPHIC.FEMALE_COUNT") === 1, "Quantidade feminina incorreta.");
assert(Math.abs(metricNumber(metrics, "DEMOGRAPHIC.AVERAGE_AGE") - 37.5) < 1e-12, "Idade média incorreta.");
assert(Math.abs(metricNumber(metrics, "FINANCE.DISCOUNT_FACTOR_1Y") - (1 / 1.05)) < 1e-12, "Fator de desconto de 1 ano incorreto.");
assert(Math.abs(metricNumber(metrics, "FINANCE.DISCOUNT_FACTOR_10Y") - (1 / Math.pow(1.05, 10))) < 1e-12, "Fator de desconto de 10 anos incorreto.");
assert(Math.abs(metricNumber(metrics, "FINANCE.DISCOUNT_FACTOR_30Y") - (1 / Math.pow(1.05, 30))) < 1e-12, "Fator de desconto de 30 anos incorreto.");

console.log("Calculation engine self-test: OK");

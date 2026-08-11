import assert from "node:assert/strict";
import { executeBdPvfb } from "./bd-pvfb-engine.js";
import type { CalculationEngineContext } from "./calculation-engine.js";

const context: CalculationEngineContext = {
  evaluation: {
    id: 1,
    planId: "11111111-1111-4111-8111-111111111111",
    planName: "Plano BD de teste",
    referenceDate: "2026-12-31"
  },
  planRules: {
    id: "22222222-2222-4222-8222-222222222222",
    version: 1,
    modality: "BD",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    fingerprint: "a".repeat(64),
    rules: [
      {
        code: "ELIGIBILITY.NORMAL_RETIREMENT_AGE",
        category: "Elegibilidade",
        label: "Idade normal de aposentadoria",
        valueType: "INTEGER",
        valueJson: "65",
        unit: "anos",
        source: "SELF_TEST"
      },
      {
        code: "BENEFIT.CALCULATION_BASIS",
        category: "Benefícios",
        label: "Base de cálculo",
        valueType: "TEXT",
        valueJson: "\"FINAL_SALARY\"",
        unit: null,
        source: "SELF_TEST"
      },
      {
        code: "BENEFIT.REPLACEMENT_RATE",
        category: "Benefícios",
        label: "Taxa de reposição",
        valueType: "NUMBER",
        valueJson: "50",
        unit: "%",
        source: "SELF_TEST"
      },
      {
        code: "BENEFIT.PAYMENTS_PER_YEAR",
        category: "Benefícios",
        label: "Pagamentos por ano",
        valueType: "INTEGER",
        valueJson: "12",
        unit: "pagamentos",
        source: "SELF_TEST"
      }
    ]
  },
  parameterization: {
    id: "33333333-3333-4333-8333-333333333333",
    version: 1,
    parameters: [
      {
        code: "ECONOMIC.REAL_INTEREST_RATE",
        category: "Econômicas",
        label: "Taxa real de juros",
        valueType: "NUMBER",
        valueJson: "0",
        unit: "% a.a.",
        source: "SELF_TEST"
      },
      {
        code: "ECONOMIC.SALARY_GROWTH_RATE",
        category: "Econômicas",
        label: "Crescimento salarial",
        valueType: "NUMBER",
        valueJson: "0",
        unit: "% a.a.",
        source: "SELF_TEST"
      },
      {
        code: "ECONOMIC.BENEFIT_GROWTH_RATE",
        category: "Econômicas",
        label: "Crescimento de benefícios",
        valueType: "NUMBER",
        valueJson: "0",
        unit: "% a.a.",
        source: "SELF_TEST"
      }
    ],
    hypotheses: [
      {
        hypothesisType: "MORTALIDADE_GERAL",
        adherenceStudyId: "44444444-4444-4444-8444-444444444444",
        candidateResultId: "55555555-5555-4555-8555-555555555555",
        biometricVersionId: "66666666-6666-4666-8666-666666666666",
        tableCode: "SELFTEST",
        tableName: "Tábua self-test",
        versionLabel: "v1",
        candidateRank: 1,
        points: [
          { age: 65, sex: "MALE", qx: 0.5 },
          { age: 66, sex: "MALE", qx: 1 }
        ]
      }
    ]
  },
  rows: [
    {
      population: "Ativos",
      rowNumber: 2,
      data: {
        "participant.registration": "000001",
        "participant.birthDate": "1961-12-31",
        "participant.sex": "MALE",
        "participant.contributionSalary": "1.000,00"
      }
    }
  ],
  invalidRowCount: 0,
  importCount: 1
};

const metrics = await executeBdPvfb(context);
const metric = (code: string) => {
  const found = metrics.find((item) => item.code === code);
  assert.ok(found, `Métrica ausente: ${code}`);
  return found.value;
};

assert.equal(metric("BD.PVFB.ACTIVE_PARTICIPANTS"), 1);
assert.equal(metric("BD.PVFB.CURRENT_MONTHLY_SALARY_TOTAL"), 1000);
assert.equal(metric("BD.PVFB.PROJECTED_MONTHLY_BENEFIT_TOTAL"), 500);
assert.equal(metric("BD.PVFB.TOTAL"), 9000);
assert.equal(metric("BD.PVFB.AVERAGE"), 9000);
assert.equal(metric("BD.PVFB.AVERAGE_SURVIVAL_TO_RETIREMENT"), 1);

await assert.rejects(
  () => executeBdPvfb({ ...context, parameterization: { ...context.parameterization, hypotheses: [] } }),
  /exatamente uma hipótese biométrica/i
);

console.log("BD PVFB self-test: OK");

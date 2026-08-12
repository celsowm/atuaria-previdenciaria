import assert from "node:assert/strict";
import { executeBdPvfb } from "./bd-pvfb-engine.js";
import type { CalculoEngineContext } from "./calculo-engine.js";

const context: CalculoEngineContext = {
  evaluation: {
    id: 1,
    planoId: "11111111-1111-4111-8111-111111111111",
    nomePlano: "Plano BD de teste",
    dataReferencia: "2026-12-31"
  },
  planRules: {
    id: "22222222-2222-4222-8222-222222222222",
    versao: 1,
    modalidade: "BD",
    vigenciaInicial: "2026-01-01",
    vigenciaFinal: null,
    fingerprint: "a".repeat(64),
    rules: [
      {
        codigo: "ELIGIBILITY.NORMAL_RETIREMENT_AGE",
        categoria: "Elegibilidade",
        rotulo: "Idade normal de aposentadoria",
        tipoValor: "INTEGER",
        jsonValor: "65",
        unidade: "anos",
        origem: "SELF_TEST"
      },
      {
        codigo: "BENEFIT.CALCULATION_BASIS",
        categoria: "Benefícios",
        rotulo: "Base de cálculo",
        tipoValor: "TEXT",
        jsonValor: "\"FINAL_SALARY\"",
        unidade: null,
        origem: "SELF_TEST"
      },
      {
        codigo: "BENEFIT.REPLACEMENT_RATE",
        categoria: "Benefícios",
        rotulo: "Taxa de reposição",
        tipoValor: "NUMBER",
        jsonValor: "50",
        unidade: "%",
        origem: "SELF_TEST"
      },
      {
        codigo: "BENEFIT.PAYMENTS_PER_YEAR",
        categoria: "Benefícios",
        rotulo: "Pagamentos por ano",
        tipoValor: "INTEGER",
        jsonValor: "12",
        unidade: "pagamentos",
        origem: "SELF_TEST"
      }
    ]
  },
  parametrizacao: {
    id: "33333333-3333-4333-8333-333333333333",
    versao: 1,
    parameters: [
      {
        codigo: "ECONOMIC.REAL_INTEREST_RATE",
        categoria: "Econômicas",
        rotulo: "Taxa real de juros",
        tipoValor: "NUMBER",
        jsonValor: "0",
        unidade: "% a.a.",
        origem: "SELF_TEST"
      },
      {
        codigo: "ECONOMIC.SALARY_GROWTH_RATE",
        categoria: "Econômicas",
        rotulo: "Crescimento salarial",
        tipoValor: "NUMBER",
        jsonValor: "0",
        unidade: "% a.a.",
        origem: "SELF_TEST"
      },
      {
        codigo: "ECONOMIC.BENEFIT_GROWTH_RATE",
        categoria: "Econômicas",
        rotulo: "Crescimento de benefícios",
        tipoValor: "NUMBER",
        jsonValor: "0",
        unidade: "% a.a.",
        origem: "SELF_TEST"
      }
    ],
    hypotheses: [
      {
        tipoHipotese: "MORTALIDADE_GERAL",
        estudoAderenciaId: "44444444-4444-4444-8444-444444444444",
        resultadoCandidatoId: "55555555-5555-4555-8555-555555555555",
        versaoBiometriaId: "66666666-6666-4666-8666-666666666666",
        codigoTabua: "SELFTEST",
        nomeTabua: "Tábua self-test",
        rotuloVersao: "v1",
        posicaoCandidato: 1,
        points: [
          { idade: 65, sexo: "MASCULINO", qx: 0.5 },
          { idade: 66, sexo: "MASCULINO", qx: 1 }
        ]
      }
    ]
  },
  rows: [
    {
      importacaoId: "77777777-7777-4777-8777-777777777777",
      populacao: "Ativos",
      numeroLinha: 2,
      data: {
        "participant.registration": "000001",
        "participant.birthDate": "1961-12-31",
        "participant.sexo": "MASCULINO",
        "participant.contributionSalary": "1.000,00"
      }
    }
  ],
  quantidadeLinhasInvalidas: 0,
  importCount: 1
};

const output = await executeBdPvfb(context);
const metric = (codigo: string) => {
  const found = output.metrics.find((item) => item.codigo === codigo);
  assert.ok(found, `Métrica ausente: ${codigo}`);
  return found.value;
};

assert.equal(metric("BD.PVFB.ACTIVE_PARTICIPANTS"), 1);
assert.equal(metric("BD.PVFB.CURRENT_MONTHLY_SALARY_TOTAL"), 1000);
assert.equal(metric("BD.PVFB.PROJECTED_MONTHLY_BENEFIT_TOTAL"), 500);
assert.equal(metric("BD.PVFB.TOTAL"), 9000);
assert.equal(metric("BD.PVFB.AVERAGE"), 9000);
assert.equal(metric("BD.PVFB.AVERAGE_SURVIVAL_TO_RETIREMENT"), 1);

assert.equal(output.participantResults.length, 1);
const participant = output.participantResults[0];
assert.equal(participant.importacaoId, "77777777-7777-4777-8777-777777777777");
assert.equal(participant.numeroLinhaOrigem, 2);
assert.equal(participant.matriculaParticipante, "000001");
assert.equal(participant.result.currentMonthlySalary, 1000);
assert.equal(participant.result.projectedMonthlyBenefit, 500);
assert.equal(participant.result.pvfb, 9000);

await assert.rejects(
  () => executeBdPvfb({ ...context, parametrizacao: { ...context.parametrizacao, hypotheses: [] } }),
  /exatamente uma hipótese biométrica/i
);

console.log("BD PVFB self-test: OK");

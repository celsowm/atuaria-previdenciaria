import { normalizeToken, parseCanonicalNumber } from "../estudio-dados/mapeamento.js";
import {
  registerCalculoEngine,
  type CalculoEngineContext,
  type CalculoEngineOutput,
  type MetricaCalculo,
  type CalculationParticipanteOutput,
  type CalculationRegraPlano
} from "./calculo-engine.js";

const millisecondsPerActuarialYear = 365.2425 * 24 * 60 * 60 * 1000;

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const [ano, month, day] = value.split("-").map(Number);
  if (
    date.getUTCFullYear() !== ano ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function ageAt(date: Date, birth: Date) {
  let idade = date.getUTCFullYear() - birth.getUTCFullYear();
  if (
    date.getUTCMonth() < birth.getUTCMonth() ||
    (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate())
  ) idade -= 1;
  return idade;
}

function addYears(date: Date, years: number) {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function laterDate(...dates: Date[]) {
  return dates.reduce((latest, current) => current > latest ? current : latest);
}

function annualStepsUntil(from: Date, to: Date) {
  if (to <= from) return 0;
  return Math.ceil((to.getTime() - from.getTime()) / millisecondsPerActuarialYear);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseJson(rule: { codigo: string; jsonValor: string }) {
  try {
    return JSON.parse(rule.jsonValor) as unknown;
  } catch {
    throw new Error(`${rule.codigo} possui JSON inválido.`);
  }
}

function rule(context: CalculoEngineContext, codigo: string): CalculationRegraPlano {
  const value = context.planRules?.rules.find((item) => item.codigo === codigo);
  if (!value) throw new Error(`A regra obrigatória ${codigo} não foi informada na versão aprovada do plano.`);
  return value;
}

function ruleNumber(context: CalculoEngineContext, codigo: string) {
  const item = rule(context, codigo);
  const value = parseJson(item);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${codigo} precisa ser numérico.`);
  }
  return value;
}

function ruleInteger(context: CalculoEngineContext, codigo: string) {
  const value = ruleNumber(context, codigo);
  if (!Number.isInteger(value)) throw new Error(`${codigo} precisa ser inteiro.`);
  return value;
}

function optionalRuleInteger(context: CalculoEngineContext, codigo: string) {
  const item = context.planRules?.rules.find((candidate) => candidate.codigo === codigo);
  if (!item) return null;
  const value = parseJson(item);
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`${codigo} precisa ser inteiro.`);
  return value;
}

function ruleText(context: CalculoEngineContext, codigo: string) {
  const item = rule(context, codigo);
  const value = parseJson(item);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${codigo} precisa ser textual.`);
  return value.trim();
}

function optionalRuleText(context: CalculoEngineContext, codigo: string) {
  const item = context.planRules?.rules.find((candidate) => candidate.codigo === codigo);
  if (!item) return null;
  const value = parseJson(item);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parameterNumber(context: CalculoEngineContext, codigo: string) {
  const parameter = context.parametrizacao.parameters.find((item) => item.codigo === codigo);
  if (!parameter) throw new Error(`O parâmetro obrigatório ${codigo} não foi informado na parametrização aprovada.`);
  let value: unknown;
  try {
    value = JSON.parse(parameter.jsonValor) as unknown;
  } catch {
    throw new Error(`${codigo} possui JSON inválido.`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${codigo} precisa ser numérico.`);
  return value;
}

function canonicalNumber(numeroLinha: number, data: Record<string, unknown>, field: string) {
  const parsed = parseCanonicalNumber(data[field]);
  if (parsed === null) throw new Error(`Linha ${numeroLinha}: ${field} é obrigatório e precisa ser numérico.`);
  return parsed;
}

function canonicalDate(numeroLinha: number, data: Record<string, unknown>, field: string) {
  const parsed = parseIsoDate(data[field]);
  if (!parsed) throw new Error(`Linha ${numeroLinha}: ${field} é obrigatório e precisa estar em YYYY-MM-DD.`);
  return parsed;
}

function qxAt(
  points: CalculoEngineContext["parametrizacao"]["hypotheses"][number]["points"],
  idade: number,
  sexo: string
) {
  const exact = points.find((point) => point.idade === idade && point.sexo === sexo);
  const unisex = points.find((point) => point.idade === idade && point.sexo === "UNISSEX");
  const point = exact ?? unisex;
  if (!point) throw new Error(`A hipótese biométrica não possui qx para idade ${idade} e sexo ${sexo}.`);
  if (!Number.isFinite(point.qx) || point.qx < 0 || point.qx > 1) {
    throw new Error(`qx inválido na idade ${idade} e sexo ${point.sexo}.`);
  }
  return point.qx;
}

function maximumAgeFor(
  points: CalculoEngineContext["parametrizacao"]["hypotheses"][number]["points"],
  sexo: string
) {
  const ages = points
    .filter((point) => point.sexo === sexo || point.sexo === "UNISSEX")
    .map((point) => point.idade);
  if (!ages.length) throw new Error(`A hipótese biométrica não possui pontos aplicáveis ao sexo ${sexo}.`);
  return Math.max(...ages);
}

function numberMetric(codigo: string, rotulo: string, value: number, unidade?: string | null): MetricaCalculo {
  return { codigo, categoria: "BD · PVFB", rotulo, tipoValor: "NUMBER", value, unidade: unidade ?? null };
}

function integerMetric(codigo: string, rotulo: string, value: number): MetricaCalculo {
  return { codigo, categoria: "BD · PVFB", rotulo, tipoValor: "INTEGER", value };
}

function textMetric(codigo: string, rotulo: string, value: string): MetricaCalculo {
  return { codigo, categoria: "BD · PVFB", rotulo, tipoValor: "TEXT", value };
}

export async function executeBdPvfb(context: CalculoEngineContext): Promise<CalculoEngineOutput> {
  if (!context.planRules) throw new Error("BD_PVFB exige uma versão aprovada das regras do plano.");
  if (context.planRules.modalidade !== "BD") throw new Error("BD_PVFB só aceita regras de plano da modalidade BD.");

  const basis = ruleText(context, "BENEFIT.CALCULATION_BASIS");
  if (basis !== "FINAL_SALARY") {
    throw new Error("BD_PVFB v1 implementa somente BENEFIT.CALCULATION_BASIS = FINAL_SALARY.");
  }

  const normalRetirementAge = ruleInteger(context, "ELIGIBILITY.NORMAL_RETIREMENT_AGE");
  if (normalRetirementAge < 0 || normalRetirementAge > 130) {
    throw new Error("ELIGIBILITY.NORMAL_RETIREMENT_AGE deve estar entre 0 e 130 anos.");
  }
  const minimumPlanYears = optionalRuleInteger(context, "ELIGIBILITY.MINIMUM_PLAN_MEMBERSHIP_YEARS");
  const minimumSponsorYears = optionalRuleInteger(context, "ELIGIBILITY.MINIMUM_SPONSOR_SERVICE_YEARS");
  if (minimumPlanYears !== null && minimumPlanYears < 0) throw new Error("A carência mínima no plano não pode ser negativa.");
  if (minimumSponsorYears !== null && minimumSponsorYears < 0) throw new Error("O tempo mínimo no patrocinador não pode ser negativo.");

  const replacementRatePercent = ruleNumber(context, "BENEFIT.REPLACEMENT_RATE");
  if (replacementRatePercent <= 0) throw new Error("BENEFIT.REPLACEMENT_RATE deve ser maior que zero.");
  const paymentsPerYear = ruleInteger(context, "BENEFIT.PAYMENTS_PER_YEAR");
  if (paymentsPerYear <= 0 || paymentsPerYear > 366) {
    throw new Error("BENEFIT.PAYMENTS_PER_YEAR deve estar entre 1 e 366.");
  }

  const realInterestPercent = parameterNumber(context, "ECONOMIC.REAL_INTEREST_RATE");
  const salaryGrowthPercent = parameterNumber(context, "ECONOMIC.SALARY_GROWTH_RATE");
  const benefitGrowthPercent = parameterNumber(context, "ECONOMIC.BENEFIT_GROWTH_RATE");
  for (const [codigo, value] of [
    ["ECONOMIC.REAL_INTEREST_RATE", realInterestPercent],
    ["ECONOMIC.SALARY_GROWTH_RATE", salaryGrowthPercent],
    ["ECONOMIC.BENEFIT_GROWTH_RATE", benefitGrowthPercent]
  ] as const) {
    if (value <= -100) throw new Error(`${codigo} deve ser superior a -100% a.a.`);
  }

  if (context.parametrizacao.hypotheses.length !== 1) {
    throw new Error("BD_PVFB v1 exige exatamente uma hipótese biométrica selecionada na parametrização.");
  }
  const mortality = context.parametrizacao.hypotheses[0];
  if (!mortality.points.length) throw new Error("A hipótese biométrica selecionada não possui pontos qx.");

  const dataReferencia = parseIsoDate(context.evaluation.dataReferencia);
  if (!dataReferencia) throw new Error("A data-base da avaliação é inválida.");

  const activeRows = context.rows.filter((row) => normalizeToken(row.populacao) === "ATIVOS");
  if (!activeRows.length) throw new Error("BD_PVFB exige ao menos uma linha válida da população Ativos.");

  const interestRate = realInterestPercent / 100;
  const salaryGrowthRate = salaryGrowthPercent / 100;
  const benefitGrowthRate = benefitGrowthPercent / 100;
  const replacementRate = replacementRatePercent / 100;
  const currency = optionalRuleText(context, "FINANCIAL.CURRENCY_CODE");

  let totalCurrentMonthlySalary = 0;
  let totalProjectedMonthlyBenefit = 0;
  let totalPvfb = 0;
  let totalYearsToRetirement = 0;
  let totalSurvivalToRetirement = 0;
  const participantResults: CalculationParticipanteOutput[] = [];

  for (const row of activeRows) {
    const birth = canonicalDate(row.numeroLinha, row.data, "participant.birthDate");
    if (birth > dataReferencia) throw new Error(`Linha ${row.numeroLinha}: data de nascimento posterior à data-base.`);
    const currentAge = ageAt(dataReferencia, birth);
    if (currentAge < 0 || currentAge > 130) throw new Error(`Linha ${row.numeroLinha}: idade atuarial inválida.`);

    const sexo = String(row.data["participant.sexo"] ?? "").toUpperCase();
    if (sexo !== "MASCULINO" && sexo !== "FEMININO" && sexo !== "UNISSEX") {
      throw new Error(`Linha ${row.numeroLinha}: participant.sexo deve ser MASCULINO, FEMININO ou UNISSEX.`);
    }

    const salary = canonicalNumber(row.numeroLinha, row.data, "participant.contributionSalary");
    if (salary <= 0) throw new Error(`Linha ${row.numeroLinha}: salário de contribuição deve ser maior que zero.`);

    const eligibleDates = [addYears(birth, normalRetirementAge), dataReferencia];
    if (minimumPlanYears !== null) {
      eligibleDates.push(addYears(canonicalDate(row.numeroLinha, row.data, "participant.planJoinDate"), minimumPlanYears));
    }
    if (minimumSponsorYears !== null) {
      eligibleDates.push(addYears(canonicalDate(row.numeroLinha, row.data, "participant.admissionDate"), minimumSponsorYears));
    }
    const eligibilityDate = laterDate(...eligibleDates);
    const yearsToRetirement = annualStepsUntil(dataReferencia, eligibilityDate);
    const retirementAge = currentAge + yearsToRetirement;

    const idadeMaxima = maximumAgeFor(mortality.points, sexo);
    const terminalQx = qxAt(mortality.points, idadeMaxima, sexo);
    if (terminalQx < 0.999999) {
      throw new Error(`A hipótese biométrica precisa encerrar com qx = 1; último qx aplicável ao sexo ${sexo} é ${terminalQx} na idade ${idadeMaxima}.`);
    }

    let survivalToRetirement = 1;
    if (retirementAge > idadeMaxima) {
      survivalToRetirement = 0;
    } else {
      for (let idade = currentAge; idade < retirementAge; idade += 1) {
        survivalToRetirement *= 1 - qxAt(mortality.points, idade, sexo);
      }
    }

    const projectedMonthlySalary = salary * Math.pow(1 + salaryGrowthRate, yearsToRetirement);
    const projectedMonthlyBenefit = projectedMonthlySalary * replacementRate;
    const annualBenefitAtRetirement = projectedMonthlyBenefit * paymentsPerYear;

    let pvfb = 0;
    let survivalAtPayment = survivalToRetirement;
    if (retirementAge <= idadeMaxima) {
      for (let idade = retirementAge, elapsed = 0; idade <= idadeMaxima; idade += 1, elapsed += 1) {
        const annualBenefit = annualBenefitAtRetirement * Math.pow(1 + benefitGrowthRate, elapsed);
        const discount = Math.pow(1 + interestRate, yearsToRetirement + elapsed);
        pvfb += annualBenefit * survivalAtPayment / discount;
        survivalAtPayment *= 1 - qxAt(mortality.points, idade, sexo);
      }
    }

    totalCurrentMonthlySalary += salary;
    totalProjectedMonthlyBenefit += projectedMonthlyBenefit;
    totalPvfb += pvfb;
    totalYearsToRetirement += yearsToRetirement;
    totalSurvivalToRetirement += survivalToRetirement;

    participantResults.push({
      importacaoId: row.importacaoId,
      populacao: row.populacao,
      numeroLinhaOrigem: row.numeroLinha,
      matriculaParticipante: String(row.data["participant.registration"] ?? "").trim() || null,
      campoUnicoLgpd: String(row.data["participant.campo_unico_lgpd"] ?? row.data["campo_unico_lgpd"] ?? "").trim() || null,
      result: {
        currentAge,
        eligibilityDate: isoDate(eligibilityDate),
        retirementAge,
        yearsToRetirement,
        currentMonthlySalary: salary,
        projectedMonthlySalary,
        projectedMonthlyBenefit,
        survivalToRetirement,
        pvfb
      }
    });
  }

  const count = activeRows.length;
  const metrics: MetricaCalculo[] = [
    textMetric("BD.PVFB.SCOPE", "Escopo", "PVFB da renda de aposentadoria dos Ativos; não representa reserva matemática ou provisão técnica."),
    integerMetric("BD.PVFB.ACTIVE_PARTICIPANTS", "Participantees ativos calculados", count),
    numberMetric("BD.PVFB.CURRENT_MONTHLY_SALARY_TOTAL", "Salário de contribuição mensal atual total", totalCurrentMonthlySalary, currency),
    numberMetric("BD.PVFB.PROJECTED_MONTHLY_BENEFIT_TOTAL", "Benefício mensal projetado na aposentadoria", totalProjectedMonthlyBenefit, currency),
    numberMetric("BD.PVFB.TOTAL", "Valor presente dos benefícios futuros", totalPvfb, currency),
    numberMetric("BD.PVFB.AVERAGE", "PVFB médio por participante", totalPvfb / count, currency),
    numberMetric("BD.PVFB.AVERAGE_YEARS_TO_RETIREMENT", "Prazo médio até aposentadoria", totalYearsToRetirement / count, "anos"),
    numberMetric("BD.PVFB.AVERAGE_SURVIVAL_TO_RETIREMENT", "Probabilidade média de sobrevivência até aposentadoria", totalSurvivalToRetirement / count, null),
    numberMetric("BD.PVFB.REAL_INTEREST_RATE", "Taxa real de juros", realInterestPercent, "% a.a."),
    numberMetric("BD.PVFB.SALARY_GROWTH_RATE", "Crescimento real de salários", salaryGrowthPercent, "% a.a."),
    numberMetric("BD.PVFB.BENEFIT_GROWTH_RATE", "Crescimento real de benefícios", benefitGrowthPercent, "% a.a."),
    numberMetric("BD.PVFB.REPLACEMENT_RATE", "Taxa de reposição", replacementRatePercent, "%"),
    integerMetric("BD.PVFB.PAYMENTS_PER_YEAR", "Pagamentos de benefício por ano", paymentsPerYear)
  ];

  return { metrics, participantResults };
}

registerCalculoEngine({
  codigo: "BD_PVFB",
  versao: "bd-pvfb-v1",
  rotulo: "BD · PVFB de aposentadoria",
  descricao: "Calcula deterministicamente o valor presente esperado da renda futura de aposentadoria dos Ativos usando regras BD aprovadas, hipóteses econômicas e qx selecionado. Não calcula reserva matemática ou provisão técnica.",
  tipoResultado: "ATUARIAL",
  requiresRegrasPlano: true,
  modalidadesSuportadas: ["BD"],
  execute: executeBdPvfb
});

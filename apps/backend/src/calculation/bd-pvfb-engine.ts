import {
  registerCalculationEngine,
  type CalculationEngineContext,
  type CalculationMetric,
  type CalculationPlanRule
} from "./calculation-engine.js";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function ageAt(date: Date, birth: Date) {
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  if (
    date.getUTCMonth() < birth.getUTCMonth() ||
    (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate())
  ) age -= 1;
  return age;
}

function addYears(date: Date, years: number) {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function laterDate(...dates: Date[]) {
  return dates.reduce((latest, current) => current > latest ? current : latest);
}

function parseJson(rule: { code: string; valueJson: string }) {
  try {
    return JSON.parse(rule.valueJson) as unknown;
  } catch {
    throw new Error(`${rule.code} possui JSON inválido.`);
  }
}

function rule(context: CalculationEngineContext, code: string): CalculationPlanRule {
  const value = context.planRules?.rules.find((item) => item.code === code);
  if (!value) throw new Error(`A regra obrigatória ${code} não foi informada na versão aprovada do plano.`);
  return value;
}

function ruleNumber(context: CalculationEngineContext, code: string) {
  const item = rule(context, code);
  const value = parseJson(item);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${code} precisa ser numérico.`);
  }
  return value;
}

function ruleInteger(context: CalculationEngineContext, code: string) {
  const value = ruleNumber(context, code);
  if (!Number.isInteger(value)) throw new Error(`${code} precisa ser inteiro.`);
  return value;
}

function optionalRuleInteger(context: CalculationEngineContext, code: string) {
  const item = context.planRules?.rules.find((candidate) => candidate.code === code);
  if (!item) return null;
  const value = parseJson(item);
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`${code} precisa ser inteiro.`);
  return value;
}

function ruleText(context: CalculationEngineContext, code: string) {
  const item = rule(context, code);
  const value = parseJson(item);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${code} precisa ser textual.`);
  return value.trim();
}

function optionalRuleText(context: CalculationEngineContext, code: string) {
  const item = context.planRules?.rules.find((candidate) => candidate.code === code);
  if (!item) return null;
  const value = parseJson(item);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parameterNumber(context: CalculationEngineContext, code: string) {
  const parameter = context.parameterization.parameters.find((item) => item.code === code);
  if (!parameter) throw new Error(`O parâmetro obrigatório ${code} não foi informado na parametrização aprovada.`);
  let value: unknown;
  try {
    value = JSON.parse(parameter.valueJson) as unknown;
  } catch {
    throw new Error(`${code} possui JSON inválido.`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${code} precisa ser numérico.`);
  return value;
}

function canonicalNumber(rowNumber: number, data: Record<string, unknown>, field: string) {
  const raw = data[field];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = typeof raw === "string" && raw.trim() ? Number(raw.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Linha ${rowNumber}: ${field} é obrigatório e precisa ser numérico.`);
  return parsed;
}

function canonicalDate(rowNumber: number, data: Record<string, unknown>, field: string) {
  const parsed = parseIsoDate(data[field]);
  if (!parsed) throw new Error(`Linha ${rowNumber}: ${field} é obrigatório e precisa estar em YYYY-MM-DD.`);
  return parsed;
}

function qxAt(
  points: CalculationEngineContext["parameterization"]["hypotheses"][number]["points"],
  age: number,
  sex: string
) {
  const exact = points.find((point) => point.age === age && point.sex === sex);
  const unisex = points.find((point) => point.age === age && point.sex === "UNISEX");
  const point = exact ?? unisex;
  if (!point) throw new Error(`A hipótese biométrica não possui qx para idade ${age} e sexo ${sex}.`);
  if (!Number.isFinite(point.qx) || point.qx < 0 || point.qx > 1) {
    throw new Error(`qx inválido na idade ${age} e sexo ${point.sex}.`);
  }
  return point.qx;
}

function maximumAgeFor(
  points: CalculationEngineContext["parameterization"]["hypotheses"][number]["points"],
  sex: string
) {
  const ages = points
    .filter((point) => point.sex === sex || point.sex === "UNISEX")
    .map((point) => point.age);
  if (!ages.length) throw new Error(`A hipótese biométrica não possui pontos aplicáveis ao sexo ${sex}.`);
  return Math.max(...ages);
}

function numberMetric(code: string, label: string, value: number, unit?: string | null): CalculationMetric {
  return { code, category: "BD · PVFB", label, valueType: "NUMBER", value, unit: unit ?? null };
}

function integerMetric(code: string, label: string, value: number): CalculationMetric {
  return { code, category: "BD · PVFB", label, valueType: "INTEGER", value };
}

function textMetric(code: string, label: string, value: string): CalculationMetric {
  return { code, category: "BD · PVFB", label, valueType: "TEXT", value };
}

export async function executeBdPvfb(context: CalculationEngineContext): Promise<CalculationMetric[]> {
  if (!context.planRules) throw new Error("BD_PVFB exige uma versão aprovada das regras do plano.");
  if (context.planRules.modality !== "BD") throw new Error("BD_PVFB só aceita regras de plano da modalidade BD.");

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
  for (const [code, value] of [
    ["ECONOMIC.REAL_INTEREST_RATE", realInterestPercent],
    ["ECONOMIC.SALARY_GROWTH_RATE", salaryGrowthPercent],
    ["ECONOMIC.BENEFIT_GROWTH_RATE", benefitGrowthPercent]
  ] as const) {
    if (value <= -100) throw new Error(`${code} deve ser superior a -100% a.a.`);
  }

  if (context.parameterization.hypotheses.length !== 1) {
    throw new Error("BD_PVFB v1 exige exatamente uma hipótese biométrica selecionada na parametrização.");
  }
  const mortality = context.parameterization.hypotheses[0];
  if (!mortality.points.length) throw new Error("A hipótese biométrica selecionada não possui pontos qx.");

  const referenceDate = parseIsoDate(context.evaluation.referenceDate);
  if (!referenceDate) throw new Error("A data-base da avaliação é inválida.");

  const activeRows = context.rows.filter((row) => normalize(row.population) === "ATIVOS");
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

  for (const row of activeRows) {
    const birth = canonicalDate(row.rowNumber, row.data, "participant.birthDate");
    if (birth > referenceDate) throw new Error(`Linha ${row.rowNumber}: data de nascimento posterior à data-base.`);
    const currentAge = ageAt(referenceDate, birth);
    if (currentAge < 0 || currentAge > 130) throw new Error(`Linha ${row.rowNumber}: idade atuarial inválida.`);

    const sex = String(row.data["participant.sex"] ?? "").toUpperCase();
    if (sex !== "MALE" && sex !== "FEMALE" && sex !== "UNISEX") {
      throw new Error(`Linha ${row.rowNumber}: participant.sex deve ser MALE, FEMALE ou UNISEX.`);
    }

    const salary = canonicalNumber(row.rowNumber, row.data, "participant.contributionSalary");
    if (salary <= 0) throw new Error(`Linha ${row.rowNumber}: salário de contribuição deve ser maior que zero.`);

    const eligibleDates = [addYears(birth, normalRetirementAge), referenceDate];
    if (minimumPlanYears !== null) {
      eligibleDates.push(addYears(canonicalDate(row.rowNumber, row.data, "participant.planJoinDate"), minimumPlanYears));
    }
    if (minimumSponsorYears !== null) {
      eligibleDates.push(addYears(canonicalDate(row.rowNumber, row.data, "participant.admissionDate"), minimumSponsorYears));
    }
    const retirementDate = laterDate(...eligibleDates);
    const retirementAge = Math.max(currentAge, ageAt(retirementDate, birth));
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);

    const maxAge = maximumAgeFor(mortality.points, sex);
    const terminalQx = qxAt(mortality.points, maxAge, sex);
    if (terminalQx < 0.999999) {
      throw new Error(`A hipótese biométrica precisa encerrar com qx = 1; último qx aplicável ao sexo ${sex} é ${terminalQx} na idade ${maxAge}.`);
    }

    let survivalToRetirement = 1;
    if (retirementAge > maxAge) {
      survivalToRetirement = 0;
    } else {
      for (let age = currentAge; age < retirementAge; age += 1) {
        survivalToRetirement *= 1 - qxAt(mortality.points, age, sex);
      }
    }

    const projectedMonthlySalary = salary * Math.pow(1 + salaryGrowthRate, yearsToRetirement);
    const projectedMonthlyBenefit = projectedMonthlySalary * replacementRate;
    const annualBenefitAtRetirement = projectedMonthlyBenefit * paymentsPerYear;

    let pvfb = 0;
    let survivalAtPayment = survivalToRetirement;
    if (retirementAge <= maxAge) {
      for (let age = retirementAge, elapsed = 0; age <= maxAge; age += 1, elapsed += 1) {
        const annualBenefit = annualBenefitAtRetirement * Math.pow(1 + benefitGrowthRate, elapsed);
        const discount = Math.pow(1 + interestRate, yearsToRetirement + elapsed);
        pvfb += annualBenefit * survivalAtPayment / discount;
        survivalAtPayment *= 1 - qxAt(mortality.points, age, sex);
      }
    }

    totalCurrentMonthlySalary += salary;
    totalProjectedMonthlyBenefit += projectedMonthlyBenefit;
    totalPvfb += pvfb;
    totalYearsToRetirement += yearsToRetirement;
    totalSurvivalToRetirement += survivalToRetirement;
  }

  const count = activeRows.length;
  return [
    textMetric("BD.PVFB.SCOPE", "Escopo", "PVFB da renda de aposentadoria dos Ativos; não representa reserva matemática ou provisão técnica."),
    integerMetric("BD.PVFB.ACTIVE_PARTICIPANTS", "Participantes ativos calculados", count),
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
}

registerCalculationEngine({
  code: "BD_PVFB",
  version: "bd-pvfb-v1",
  label: "BD · PVFB de aposentadoria",
  description: "Calcula deterministicamente o valor presente esperado da renda futura de aposentadoria dos Ativos usando regras BD aprovadas, hipóteses econômicas e qx selecionado. Não calcula reserva matemática ou provisão técnica.",
  resultKind: "ACTUARIAL",
  requiresPlanRules: true,
  supportedModalities: ["BD"],
  execute: executeBdPvfb
});

import {
  registerCalculoEngine,
  type CalculoEngineContext,
  type CalculoEngineOutput,
  type MetricaCalculo
} from "./calculo-engine.js";

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageAt(dataReferencia: string, birthDate: unknown) {
  const reference = parseIsoDate(dataReferencia);
  const birth = parseIsoDate(birthDate);
  if (!reference || !birth || birth > reference) return null;
  let idade = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    reference.getUTCMonth() < birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) idade -= 1;
  return idade >= 0 && idade <= 130 ? idade : null;
}

function parameterNumber(context: CalculoEngineContext, codigo: string) {
  const parameter = context.parametrizacao.parameters.find((item) => item.codigo === codigo);
  if (!parameter) return null;
  try {
    const value = JSON.parse(parameter.jsonValor) as unknown;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function integerMetric(codigo: string, categoria: string, rotulo: string, value: number): MetricaCalculo {
  return { codigo, categoria, rotulo, tipoValor: "INTEGER", value };
}

function numberMetric(codigo: string, categoria: string, rotulo: string, value: number, unidade?: string | null): MetricaCalculo {
  return { codigo, categoria, rotulo, tipoValor: "NUMBER", value, unidade: unidade ?? null };
}

async function execute(context: CalculoEngineContext): Promise<CalculoEngineOutput> {
  if (!context.rows.length) throw new Error("Não existem linhas canônicas válidas para cálculo.");

  let male = 0;
  let female = 0;
  let ageCount = 0;
  let ageSum = 0;
  const populations = new Set<string>();

  for (const row of context.rows) {
    populations.add(row.populacao);
    const sexo = String(row.data["participant.sexo"] ?? "").toUpperCase();
    if (sexo === "MASCULINO") male += 1;
    if (sexo === "FEMININO") female += 1;
    const idade = ageAt(context.evaluation.dataReferencia, row.data["participant.birthDate"]);
    if (idade !== null) {
      ageCount += 1;
      ageSum += idade;
    }
  }

  const metrics: MetricaCalculo[] = [
    integerMetric("INPUT.IMPORT_COUNT", "Base cadastral", "Importacaos congelados", context.importCount),
    integerMetric("INPUT.POPULATION_COUNT", "Base cadastral", "Populações", populations.size),
    integerMetric("INPUT.VALID_ROWS", "Base cadastral", "Registros válidos", context.rows.length),
    integerMetric("INPUT.INVALID_ROWS", "Base cadastral", "Registros inválidos excluídos", context.quantidadeLinhasInvalidas),
    integerMetric("DEMOGRAPHIC.MALE_COUNT", "Demográficas", "Participantees masculinos", male),
    integerMetric("DEMOGRAPHIC.FEMALE_COUNT", "Demográficas", "Participantees femininos", female),
    integerMetric("PARAMETERIZATION.PARAMETER_COUNT", "Parametrização", "Parâmetros ativos", context.parametrizacao.parameters.length),
    integerMetric("PARAMETERIZATION.HYPOTHESIS_COUNT", "Parametrização", "Hipóteses selecionadas", context.parametrizacao.hypotheses.length)
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

  return { metrics, participantResults: [] };
}

registerCalculoEngine({
  codigo: "CORE_PRECALCULATION",
  versao: "core-precalculation-v1",
  rotulo: "Pré-cálculo determinístico",
  descricao: "Consolida a base canônica congelada, métricas demográficas e fatores financeiros sem produzir reservas ou provisões oficiais.",
  tipoResultado: "PRECALCULO",
  requiresRegrasPlano: false,
  modalidadesSuportadas: ["BD", "CD", "CV"],
  execute
});

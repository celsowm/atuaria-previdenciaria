export type CalculationParameter = {
  codigo: string;
  categoria: string;
  rotulo: string;
  tipoValor: string;
  jsonValor: string;
  unidade: string | null;
  origem: string;
};

export type CalculationPontoBiometria = {
  idade: number;
  sexo: string;
  qx: number;
};

export type CalculationHipotese = {
  tipoHipotese: string;
  estudoAderenciaId: string;
  resultadoCandidatoId: string;
  versaoBiometriaId: string;
  codigoTabua: string;
  nomeTabua: string;
  rotuloVersao: string;
  posicaoCandidato: number;
  points: CalculationPontoBiometria[];
};

export type CalculationRegraPlano = {
  codigo: string;
  categoria: string;
  rotulo: string;
  tipoValor: string;
  jsonValor: string;
  unidade: string | null;
  origem: string;
};

export type CalculationCanonicalRow = {
  importacaoId: string;
  populacao: string;
  numeroLinha: number;
  data: Record<string, unknown>;
};

export type CalculoEngineContext = {
  evaluation: {
    id: number;
    planoId: string | null;
    nomePlano: string;
    dataReferencia: string;
  };
  planRules: {
    id: string;
    versao: number;
    modalidade: "BD" | "CD" | "CV";
    vigenciaInicial: string;
    vigenciaFinal: string | null;
    fingerprint: string;
    rules: CalculationRegraPlano[];
  } | null;
  parametrizacao: {
    id: string;
    versao: number;
    parameters: CalculationParameter[];
    hypotheses: CalculationHipotese[];
  };
  rows: CalculationCanonicalRow[];
  quantidadeLinhasInvalidas: number;
  importCount: number;
};

export type MetricaCalculo = {
  codigo: string;
  categoria: string;
  rotulo: string;
  tipoValor: "NUMBER" | "INTEGER" | "TEXT" | "BOOLEAN";
  value: number | string | boolean;
  unidade?: string | null;
};

export type CalculationParticipanteOutput = {
  importacaoId: string;
  populacao: string;
  numeroLinhaOrigem: number;
  matriculaParticipante: string | null;
  campoUnicoLgpd: string | null;
  result: Record<string, string | number | boolean | null>;
};

export type CalculoEngineOutput = {
  metrics: MetricaCalculo[];
  participantResults: CalculationParticipanteOutput[];
};

export type CalculoEngine = {
  codigo: string;
  versao: string;
  rotulo: string;
  descricao: string;
  tipoResultado: "PRECALCULO" | "ATUARIAL";
  requiresRegrasPlano: boolean;
  modalidadesSuportadas: Array<"BD" | "CD" | "CV">;
  execute(context: CalculoEngineContext): Promise<CalculoEngineOutput>;
};

const engines = new Map<string, CalculoEngine>();

export function validateCalculationMetrics(metrics: MetricaCalculo[]) {
  const codes = new Set<string>();
  for (const metric of metrics) {
    const codigo = metric.codigo.trim();
    if (!codigo) throw new Error("O motor retornou uma métrica sem código.");
    if (codes.has(codigo)) throw new Error(`O motor retornou a métrica duplicada ${codigo}.`);
    codes.add(codigo);
    if (!metric.categoria.trim()) throw new Error(`A métrica ${codigo} não possui categoria.`);
    if (!metric.rotulo.trim()) throw new Error(`A métrica ${codigo} não possui rótulo.`);
    if (metric.tipoValor === "NUMBER" && (typeof metric.value !== "number" || !Number.isFinite(metric.value))) {
      throw new Error(`A métrica ${codigo} deve possuir número finito.`);
    }
    if (metric.tipoValor === "INTEGER" && (typeof metric.value !== "number" || !Number.isInteger(metric.value))) {
      throw new Error(`A métrica ${codigo} deve possuir valor inteiro.`);
    }
    if (metric.tipoValor === "TEXT" && typeof metric.value !== "string") {
      throw new Error(`A métrica ${codigo} deve possuir valor textual.`);
    }
    if (metric.tipoValor === "BOOLEAN" && typeof metric.value !== "boolean") {
      throw new Error(`A métrica ${codigo} deve possuir valor booleano.`);
    }
  }
  return metrics;
}

function validateParticipanteValue(value: unknown, path: string) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new Error(`Resultado individual inválido em ${path}. Apenas string, number finito, boolean e null são permitidos.`);
}

export function validateCalculationOutput(output: CalculoEngineOutput) {
  const metrics = validateCalculationMetrics(output.metrics);
  const keys = new Set<string>();
  for (const item of output.participantResults) {
    if (!item.importacaoId.trim()) throw new Error("Resultado individual sem importacaoId.");
    if (!item.populacao.trim()) throw new Error("Resultado individual sem população.");
    if (!Number.isInteger(item.numeroLinhaOrigem) || item.numeroLinhaOrigem < 1) {
      throw new Error("Resultado individual possui numeroLinhaOrigem inválido.");
    }
    const key = `${item.importacaoId}:${item.numeroLinhaOrigem}`;
    if (keys.has(key)) throw new Error(`Resultado individual duplicado para ${key}.`);
    keys.add(key);
    for (const [field, value] of Object.entries(item.result)) {
      if (!field.trim()) throw new Error(`Resultado individual ${key} possui campo vazio.`);
      validateParticipanteValue(value, `${key}.${field}`);
    }
  }
  return { metrics, participantResults: output.participantResults };
}

export function registerCalculoEngine(engine: CalculoEngine) {
  const codigo = engine.codigo.trim();
  const versao = engine.versao.trim();
  if (!codigo || !versao) throw new Error("Motor de cálculo precisa de codigo e versao.");
  if (!engine.modalidadesSuportadas.length) throw new Error(`Motor ${codigo} precisa declarar ao menos uma modalidade.`);
  if (engine.tipoResultado === "ATUARIAL" && !engine.requiresRegrasPlano) {
    throw new Error(`Motor atuarial ${codigo} precisa exigir uma versão aprovada das regras do plano.`);
  }
  if (engines.has(codigo)) {
    throw new Error(`Motor de cálculo duplicado: ${codigo}.`);
  }
  engines.set(codigo, engine);
}

export function listCalculoEngines() {
  return [...engines.values()].map(({ codigo, versao, rotulo, descricao, tipoResultado, requiresRegrasPlano, modalidadesSuportadas }) => ({
    codigo,
    versao,
    rotulo,
    descricao,
    tipoResultado,
    requiresRegrasPlano,
    modalidadesSuportadas
  }));
}

export function getCalculoEngine(codigo: string) {
  const engine = engines.get(codigo);
  if (!engine) throw new Error(`Motor de cálculo não encontrado: ${codigo}.`);
  return engine;
}

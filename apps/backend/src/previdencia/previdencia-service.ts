import { createHash, randomUUID } from "node:crypto";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession, consultarSql, executarSql } from "../db.js";
import { Plan } from "../domain/plan-entities.js";
import {
  Beneficio,
  EntidadePrevidencia,
  Submassa,
  UnidadeReferencia,
  ValorUnidadeReferencia
} from "../domain/previdencia-entities.js";

type Sessao = ReturnType<typeof createSession>;

async function comSessao<T>(acao: (sessao: Sessao) => Promise<T>) {
  const sessao = createSession();
  try { return await acao(sessao); } finally { await sessao.dispose(); }
}

function tabela(entidade: typeof EntidadePrevidencia | typeof Submassa | typeof Beneficio | typeof UnidadeReferencia | typeof ValorUnidadeReferencia) {
  const resultado = getTableDefFromEntity(entidade);
  if (!resultado) throw new Error(`Metadados indisponíveis para ${entidade.name}.`);
  return resultado;
}

function texto(valor: string | null | undefined) { return valor?.trim() || null; }
function codigo(valor: string) { return valor.trim().toUpperCase().replace(/\s+/g, "_"); }
function data(valor: string | null | undefined, obrigatoria = false) {
  const normalizada = texto(valor);
  if (!normalizada && obrigatoria) throw new Error("A data inicial de vigência é obrigatória.");
  if (!normalizada) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizada)) throw new Error("Data de vigência inválida.");
  return normalizada;
}
function validarPeriodo(inicial: string, final: string | null) {
  if (final && final < inicial) throw new Error("A vigência final não pode ser anterior à inicial.");
}

type NoElegibilidade = Record<string, unknown>;
type NoFormula = Record<string, unknown>;
const operadoresFormula = new Set(["SOMA", "SUBTRACAO", "MULTIPLICACAO", "DIVISAO", "MINIMO", "MAXIMO", "FAIXAS"]);
const componentes = new Set(["SALARIO_CONTRIBUICAO", "BENEFICIO_INSS", "UNIDADE_REFERENCIA"]);
const criterios = new Set(["IDADE_MINIMA", "IDADE_MAXIMA", "TEMPO_PLANO_MINIMO", "TEMPO_PATROCINADOR_MINIMO", "APOSENTADO_INSS"]);

function objetoJson(valor: string, campo: string): Record<string, unknown> {
  try {
    const resultado = JSON.parse(valor) as unknown;
    if (!resultado || Array.isArray(resultado) || typeof resultado !== "object") throw new Error();
    return resultado as Record<string, unknown>;
  } catch { throw new Error(`${campo} deve conter JSON válido.`); }
}

function validarElegibilidade(no: NoElegibilidade): void {
  if (typeof no.operador === "string") {
    if (no.operador !== "TODOS" && no.operador !== "QUALQUER") throw new Error("Operador de elegibilidade inválido.");
    if (!Array.isArray(no.itens) || !no.itens.length) throw new Error("Um grupo de elegibilidade precisa possuir itens.");
    no.itens.forEach((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Item de elegibilidade inválido.");
      validarElegibilidade(item as NoElegibilidade);
    });
    return;
  }
  if (typeof no.criterio !== "string" || !criterios.has(no.criterio)) throw new Error("Critério de elegibilidade inválido.");
  if (no.criterio !== "APOSENTADO_INSS" && (!Number.isFinite(no.valor) || Number(no.valor) < 0)) {
    throw new Error("Critério de elegibilidade requer valor numérico não negativo.");
  }
  if (no.criterio === "APOSENTADO_INSS" && typeof no.valor !== "boolean") throw new Error("APOSENTADO_INSS requer valor lógico.");
}

function validarFormula(no: NoFormula): void {
  if (typeof no.valor === "number" && Number.isFinite(no.valor)) return;
  if (typeof no.componente === "string") {
    if (!componentes.has(no.componente)) throw new Error("Componente de fórmula inválido.");
    if (no.componente === "UNIDADE_REFERENCIA" && typeof no.unidadeReferenciaId !== "string") {
      throw new Error("UNIDADE_REFERENCIA requer unidadeReferenciaId.");
    }
    return;
  }
  if (typeof no.operador !== "string" || !operadoresFormula.has(no.operador)) throw new Error("Operador de fórmula inválido.");
  if (no.operador === "FAIXAS") {
    if (typeof no.componenteFaixa !== "string" || !componentes.has(no.componenteFaixa) || !Array.isArray(no.faixas) || !no.faixas.length) {
      throw new Error("FAIXAS exige componenteFaixa e faixas válidas.");
    }
    for (const faixa of no.faixas) {
      if (!faixa || typeof faixa !== "object" || Array.isArray(faixa)) throw new Error("Faixa inválida.");
      const item = faixa as Record<string, unknown>;
      if (!Number.isFinite(item.minimo) || (item.maximo !== null && item.maximo !== undefined && !Number.isFinite(item.maximo))) throw new Error("Limites de faixa inválidos.");
      if (item.maximo !== null && item.maximo !== undefined && Number(item.maximo) <= Number(item.minimo)) throw new Error("A faixa deve possuir máximo maior que mínimo.");
      if (!item.resultado || typeof item.resultado !== "object") throw new Error("Faixa sem resultado.");
      validarFormula(item.resultado as NoFormula);
    }
    return;
  }
  if (!Array.isArray(no.itens) || no.itens.length < 2) throw new Error("Operador de fórmula requer ao menos dois itens.");
  no.itens.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Item de fórmula inválido.");
    validarFormula(item as NoFormula);
  });
}

function impressaoDigital(submassa: Submassa, beneficios: Beneficio[]) {
  const conteudo = JSON.stringify({
    planoId: submassa.planoId, codigo: submassa.codigo, nome: submassa.nome,
    vigenciaInicial: submassa.vigenciaInicial, vigenciaFinal: submassa.vigenciaFinal ?? null,
    beneficios: beneficios.sort((a, b) => a.codigo.localeCompare(b.codigo)).map((beneficio) => ({
      codigo: beneficio.codigo, tipo: beneficio.tipoBeneficio, elegibilidade: JSON.parse(beneficio.regrasElegibilidadeJson), formula: JSON.parse(beneficio.formulaValorJson), origem: beneficio.origem ?? null
    }))
  });
  return createHash("sha256").update(conteudo).digest("hex");
}

const camposSubmassa = "id, plano_id AS planoId, codigo, nome, vigencia_inicial AS vigenciaInicial, vigencia_final AS vigenciaFinal, situacao, impressao_digital_regras AS impressaoDigitalRegras, observacoes, criado_em AS criadoEm, atualizado_em AS atualizadoEm, aprovada_em AS aprovadaEm";
const camposBeneficio = "id, submassa_id AS submassaId, codigo, nome, tipo_beneficio AS tipoBeneficio, situacao, json_regras_elegibilidade AS regrasElegibilidadeJson, json_formula_valor AS formulaValorJson, origem, criado_em AS criadoEm, atualizado_em AS atualizadoEm";

export async function listarEntidades() {
  return consultarSql<EntidadePrevidencia>("SELECT id, codigo, nome, cnpj, situacao, criado_em AS criadoEm, atualizado_em AS atualizadoEm FROM entidades_previdencia ORDER BY nome");
}

export async function criarEntidade(entrada: { codigo: string; nome: string; cnpj?: string | null }) {
  const codigoNormalizado = codigo(entrada.codigo); const nome = entrada.nome.trim();
  if (!codigoNormalizado || !nome) throw new Error("Código e nome da entidade são obrigatórios.");
  return comSessao(async (sessao) => {
    const existentes = await consultarSql<EntidadePrevidencia>("SELECT id, codigo, nome, cnpj, situacao, criado_em AS criadoEm, atualizado_em AS atualizadoEm FROM entidades_previdencia WHERE codigo = ?", [codigoNormalizado]);
    if (existentes.some((item) => item.codigo === codigoNormalizado)) throw new Error("Já existe entidade com este código.");
    const agora = new Date().toISOString(); const entidade = new EntidadePrevidencia();
    entidade.id = randomUUID(); entidade.codigo = codigoNormalizado; entidade.nome = nome; entidade.cnpj = texto(entrada.cnpj); entidade.situacao = "ATIVA"; entidade.criadoEm = agora; entidade.atualizadoEm = agora;
    await executarSql("INSERT INTO entidades_previdencia (id, codigo, nome, cnpj, situacao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)", [entidade.id, entidade.codigo, entidade.nome, entidade.cnpj ?? null, entidade.situacao, entidade.criadoEm, entidade.atualizadoEm]);
    return entidade;
  });
}

export async function listarSubmassas(planoId: string) {
  return consultarSql<Submassa>(`SELECT ${camposSubmassa} FROM submassas WHERE plano_id = ? ORDER BY vigencia_inicial DESC`, [planoId]);
}

export async function obterSubmassa(id: string) {
  const [submassa] = await consultarSql<Submassa>(`SELECT ${camposSubmassa} FROM submassas WHERE id = ?`, [id]);
  if (!submassa) return null;
  const beneficios = await consultarSql<Beneficio>(`SELECT ${camposBeneficio} FROM beneficios WHERE submassa_id = ? ORDER BY codigo`, [id]);
  return { ...submassa, beneficios };
}

async function verificarSobreposicao(candidata: Submassa) {
  const existentes = await listarSubmassas(candidata.planoId);
  const fim = candidata.vigenciaFinal ?? "9999-12-31";
  if (existentes.some((item) => item.id !== candidata.id && item.codigo === candidata.codigo && item.situacao === "APROVADA" && item.vigenciaInicial <= fim && (item.vigenciaFinal ?? "9999-12-31") >= candidata.vigenciaInicial)) {
    throw new Error("Existe submassa aprovada com vigência sobreposta para este código.");
  }
}

export async function criarSubmassa(planoId: string, entrada: { codigo: string; nome: string; vigenciaInicial: string; vigenciaFinal?: string | null; observacoes?: string | null }) {
  const inicio = data(entrada.vigenciaInicial, true)!; const fim = data(entrada.vigenciaFinal); validarPeriodo(inicio, fim);
  return comSessao(async (_sessao) => {
    if (!(await consultarSql("SELECT id FROM planos WHERE id = ?", [planoId])).length) throw new Error("Plano não encontrado.");
    const agora = new Date().toISOString(); const submassa = new Submassa();
    submassa.id = randomUUID(); submassa.planoId = planoId; submassa.codigo = codigo(entrada.codigo); submassa.nome = entrada.nome.trim(); submassa.vigenciaInicial = inicio; submassa.vigenciaFinal = fim; submassa.situacao = "RASCUNHO"; submassa.impressaoDigitalRegras = null; submassa.observacoes = texto(entrada.observacoes); submassa.criadoEm = agora; submassa.atualizadoEm = agora; submassa.aprovadaEm = null;
    if (!submassa.codigo || !submassa.nome) throw new Error("Código e nome da submassa são obrigatórios.");
    await executarSql("INSERT INTO submassas (id, plano_id, codigo, nome, vigencia_inicial, vigencia_final, situacao, impressao_digital_regras, observacoes, criado_em, atualizado_em, aprovada_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [submassa.id, submassa.planoId, submassa.codigo, submassa.nome, submassa.vigenciaInicial, submassa.vigenciaFinal ?? null, submassa.situacao, null, submassa.observacoes ?? null, submassa.criadoEm, submassa.atualizadoEm, null]);
    return submassa;
  });
}

export async function definirBeneficios(submassaId: string, entradas: Array<{ codigo: string; nome: string; tipoBeneficio: string; regrasElegibilidadeJson: string; formulaValorJson: string; origem?: string | null }>) {
  return comSessao(async (_sessao) => {
    const submassa = await obterSubmassa(submassaId); if (!submassa) throw new Error("Submassa não encontrada.");
    if (submassa.situacao !== "RASCUNHO") throw new Error("Somente submassa em rascunho pode ser alterada.");
    const codigos = new Set<string>(); const normalizadas = entradas.map((entrada) => {
      const codigoNormalizado = codigo(entrada.codigo); if (!codigoNormalizado || codigos.has(codigoNormalizado)) throw new Error("Códigos de benefícios devem ser únicos."); codigos.add(codigoNormalizado);
      if (!["APOSENTADORIA", "PENSAO", "PECULIO"].includes(entrada.tipoBeneficio)) throw new Error("Tipo de benefício inválido.");
      const elegibilidade = objetoJson(entrada.regrasElegibilidadeJson, "regrasElegibilidadeJson"); validarElegibilidade(elegibilidade);
      const formula = objetoJson(entrada.formulaValorJson, "formulaValorJson"); validarFormula(formula);
      return { ...entrada, codigo: codigoNormalizado, nome: entrada.nome.trim(), regrasElegibilidadeJson: JSON.stringify(elegibilidade), formulaValorJson: JSON.stringify(formula) };
    });
    const existentes = submassa.beneficios;
    for (const existente of existentes) { await executarSql("DELETE FROM beneficios WHERE id = ?", [existente.id]); }
    const agora = new Date().toISOString(); const beneficios: Beneficio[] = [];
    for (const entrada of normalizadas) { if (!entrada.nome) throw new Error("Nome do benefício é obrigatório."); const beneficio = new Beneficio(); beneficio.id = randomUUID(); beneficio.submassaId = submassaId; beneficio.codigo = entrada.codigo; beneficio.nome = entrada.nome; beneficio.tipoBeneficio = entrada.tipoBeneficio; beneficio.situacao = "ATIVO"; beneficio.regrasElegibilidadeJson = entrada.regrasElegibilidadeJson; beneficio.formulaValorJson = entrada.formulaValorJson; beneficio.origem = texto(entrada.origem); beneficio.criadoEm = agora; beneficio.atualizadoEm = agora; await executarSql("INSERT INTO beneficios (id, submassa_id, codigo, nome, tipo_beneficio, situacao, json_regras_elegibilidade, json_formula_valor, origem, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [beneficio.id, beneficio.submassaId, beneficio.codigo, beneficio.nome, beneficio.tipoBeneficio, beneficio.situacao, beneficio.regrasElegibilidadeJson, beneficio.formulaValorJson, beneficio.origem ?? null, beneficio.criadoEm, beneficio.atualizadoEm]); beneficios.push(beneficio); }
    submassa.atualizadoEm = agora; await executarSql("UPDATE submassas SET atualizado_em = ? WHERE id = ?", [agora, submassa.id]); return { ...submassa, atualizadoEm: agora, beneficios };
  });
}

export async function aprovarSubmassa(id: string) {
  return comSessao(async (_sessao) => {
    const submassa = await obterSubmassa(id); if (!submassa) throw new Error("Submassa não encontrada.");
    if (submassa.situacao !== "RASCUNHO") throw new Error("A submassa já não está em rascunho.");
    const beneficios = submassa.beneficios;
    if (!beneficios.length) throw new Error("A submassa precisa possuir ao menos um benefício.");
    await verificarSobreposicao(submassa);
    const agora = new Date().toISOString(); submassa.situacao = "APROVADA"; submassa.impressaoDigitalRegras = impressaoDigital(submassa, beneficios); submassa.aprovadaEm = agora; submassa.atualizadoEm = agora; await executarSql("UPDATE submassas SET situacao = ?, impressao_digital_regras = ?, aprovada_em = ?, atualizado_em = ? WHERE id = ?", [submassa.situacao, submassa.impressaoDigitalRegras, agora, agora, submassa.id]); return { ...submassa, beneficios };
  });
}

export async function criarUnidadeReferencia(entrada: { codigo: string; nome: string }) {
  const codigoNormalizado = codigo(entrada.codigo); if (!codigoNormalizado || !entrada.nome.trim()) throw new Error("Código e nome da unidade são obrigatórios.");
  return comSessao(async (_sessao) => { const agora = new Date().toISOString(); const unidade = new UnidadeReferencia(); unidade.id = randomUUID(); unidade.codigo = codigoNormalizado; unidade.nome = entrada.nome.trim(); unidade.situacao = "ATIVA"; unidade.criadoEm = agora; unidade.atualizadoEm = agora; await executarSql("INSERT INTO unidades_referencia (id, codigo, nome, situacao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)", [unidade.id, unidade.codigo, unidade.nome, unidade.situacao, agora, agora]); return unidade; });
}

export async function definirValorUnidade(unidadeReferenciaId: string, entrada: { valor: number; vigenciaInicial: string; vigenciaFinal?: string | null }) {
  const inicio = data(entrada.vigenciaInicial, true)!; const fim = data(entrada.vigenciaFinal); validarPeriodo(inicio, fim); if (!Number.isFinite(entrada.valor) || entrada.valor < 0) throw new Error("Valor da unidade inválido.");
  return comSessao(async (sessao) => { if (!await sessao.find(UnidadeReferencia, unidadeReferenciaId)) throw new Error("Unidade de referência não encontrada."); const existentes = await selectFromEntity(ValorUnidadeReferencia).where(eq(entityRef(ValorUnidadeReferencia).$.unidadeReferenciaId, unidadeReferenciaId)).execute(sessao); const limite = fim ?? "9999-12-31"; if (existentes.some((item) => item.vigenciaInicial <= limite && (item.vigenciaFinal ?? "9999-12-31") >= inicio)) throw new Error("Já existe valor de unidade com vigência sobreposta."); const valor = new ValorUnidadeReferencia(); valor.id = randomUUID(); valor.unidadeReferenciaId = unidadeReferenciaId; valor.valor = entrada.valor; valor.vigenciaInicial = inicio; valor.vigenciaFinal = fim; valor.criadoEm = new Date().toISOString(); await executarSql("INSERT INTO valores_unidade_referencia (id, unidade_referencia_id, valor, vigencia_inicial, vigencia_final, criado_em) VALUES (?, ?, ?, ?, ?, ?)", [valor.id, valor.unidadeReferenciaId, valor.valor, valor.vigenciaInicial, valor.vigenciaFinal ?? null, valor.criadoEm]); return valor; });
}

type DadosCalculoBeneficio = { dataReferencia: string; idade: number; tempoPlano?: number; tempoPatrocinador?: number; aposentadoInss: boolean; salarioContribuicao: number; beneficioInss: number };

function elegivel(no: NoElegibilidade, dados: DadosCalculoBeneficio): boolean {
  if (typeof no.operador === "string") {
    const resultados = (no.itens as NoElegibilidade[]).map((item) => elegivel(item, dados));
    return no.operador === "TODOS" ? resultados.every(Boolean) : resultados.some(Boolean);
  }
  const valor = Number(no.valor);
  if (no.criterio === "IDADE_MINIMA") return dados.idade >= valor;
  if (no.criterio === "IDADE_MAXIMA") return dados.idade <= valor;
  if (no.criterio === "TEMPO_PLANO_MINIMO") return (dados.tempoPlano ?? 0) >= valor;
  if (no.criterio === "TEMPO_PATROCINADOR_MINIMO") return (dados.tempoPatrocinador ?? 0) >= valor;
  return dados.aposentadoInss === no.valor;
}

async function valorComponente(componente: string, no: NoFormula, dados: DadosCalculoBeneficio, unidades: Map<string, number>) {
  if (componente === "SALARIO_CONTRIBUICAO") return dados.salarioContribuicao;
  if (componente === "BENEFICIO_INSS") return dados.beneficioInss;
  const unidadeId = String(no.unidadeReferenciaId);
  if (unidades.has(unidadeId)) return unidades.get(unidadeId)!;
  const [valor] = await consultarSql<{ valor: number }>("SELECT valor FROM valores_unidade_referencia WHERE unidade_referencia_id = ? AND vigencia_inicial <= ? AND (vigencia_final IS NULL OR vigencia_final >= ?) ORDER BY vigencia_inicial DESC LIMIT 1", [unidadeId, dados.dataReferencia, dados.dataReferencia]);
  if (!valor) throw new Error("Não há valor vigente para a unidade de referência.");
  unidades.set(unidadeId, Number(valor.valor)); return Number(valor.valor);
}

async function calcularFormula(no: NoFormula, dados: DadosCalculoBeneficio, unidades: Map<string, number>): Promise<number> {
  if (typeof no.valor === "number") return no.valor;
  if (typeof no.componente === "string") return valorComponente(no.componente, no, dados, unidades);
  if (no.operador === "FAIXAS") {
    const base = await valorComponente(String(no.componenteFaixa), no, dados, unidades);
    const faixa = (no.faixas as Array<Record<string, unknown>>).find((item) => base >= Number(item.minimo) && (item.maximo === null || item.maximo === undefined || base < Number(item.maximo)));
    if (!faixa) throw new Error("Nenhuma faixa da fórmula cobre o valor informado.");
    return calcularFormula(faixa.resultado as NoFormula, dados, unidades);
  }
  const itens = await Promise.all((no.itens as NoFormula[]).map((item) => calcularFormula(item, dados, unidades)));
  if (no.operador === "SOMA") return itens.reduce((total, valor) => total + valor, 0);
  if (no.operador === "SUBTRACAO") return itens.slice(1).reduce((total, valor) => total - valor, itens[0]);
  if (no.operador === "MULTIPLICACAO") return itens.reduce((total, valor) => total * valor, 1);
  if (no.operador === "DIVISAO") return itens.slice(1).reduce((total, valor) => { if (valor === 0) throw new Error("Divisão por zero na fórmula do benefício."); return total / valor; }, itens[0]);
  if (no.operador === "MINIMO") return Math.min(...itens);
  return Math.max(...itens);
}

export async function avaliarBeneficio(id: string, dados: DadosCalculoBeneficio) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dataReferencia)) throw new Error("Data de referência inválida.");
  if (![dados.idade, dados.salarioContribuicao, dados.beneficioInss].every(Number.isFinite)) throw new Error("Dados numéricos do benefício inválidos.");
  const [beneficio] = await consultarSql<Beneficio>(`SELECT ${camposBeneficio} FROM beneficios WHERE id = ?`, [id]);
  if (!beneficio || beneficio.situacao !== "ATIVO") throw new Error("Benefício não encontrado ou inativo.");
  const [submassa] = await consultarSql<Submassa>(`SELECT ${camposSubmassa} FROM submassas WHERE id = ?`, [beneficio.submassaId]);
  if (!submassa || submassa.situacao !== "APROVADA" || dados.dataReferencia < submassa.vigenciaInicial || (submassa.vigenciaFinal && dados.dataReferencia > submassa.vigenciaFinal)) throw new Error("O benefício não está em submassa aprovada e vigente.");
  const atende = elegivel(JSON.parse(beneficio.regrasElegibilidadeJson) as NoElegibilidade, dados);
  return { beneficioId: beneficio.id, elegivel: atende, valor: atende ? await calcularFormula(JSON.parse(beneficio.formulaValorJson) as NoFormula, dados, new Map()) : null };
}

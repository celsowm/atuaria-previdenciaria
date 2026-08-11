import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const diretorio = await mkdtemp(join(tmpdir(), "atuaria-previdenciaria-submassas-"));
process.env.APP_DB_PATH = join(diretorio, "previdencia.sqlite");
process.env.APP_SEED_DEMO = "false";

const { closeDatabase, executarSql, initializeDatabase } = await import("../db.js");
const { aprovarSubmassa, avaliarBeneficio, criarEntidade, criarSubmassa, definirBeneficios, definirValorUnidade, criarUnidadeReferencia } = await import("./previdencia-service.js");

try {
  await initializeDatabase();
  const entidade = await criarEntidade({ codigo: "TESTE", nome: "Entidade de teste" });
  await executarSql("INSERT INTO planos (id, entidade_previdencia_id, codigo, nome, modalidade, nome_patrocinador, cnpj, situacao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ["plano-teste", entidade.id, "PLANO", "Plano de teste", "BD", null, null, "ATIVO", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]);
  const unidade = await criarUnidadeReferencia({ codigo: "UR", nome: "Unidade de referência" });
  await definirValorUnidade(unidade.id, { valor: 100, vigenciaInicial: "2026-01-01" });

  const submassa = await criarSubmassa("plano-teste", { codigo: "ATIVOS", nome: "Ativos", vigenciaInicial: "2026-01-01" });
  await definirBeneficios(submassa.id, [{
    codigo: "APOS", nome: "Aposentadoria", tipoBeneficio: "APOSENTADORIA",
    regrasElegibilidadeJson: JSON.stringify({ operador: "TODOS", itens: [{ criterio: "IDADE_MINIMA", valor: 55 }, { criterio: "APOSENTADO_INSS", valor: true }] }),
    formulaValorJson: JSON.stringify({ operador: "SOMA", itens: [{ operador: "SUBTRACAO", itens: [{ componente: "SALARIO_CONTRIBUICAO" }, { componente: "BENEFICIO_INSS" }] }, { componente: "UNIDADE_REFERENCIA", unidadeReferenciaId: unidade.id }] })
  }]);
  const aprovada = await aprovarSubmassa(submassa.id);
  assert.equal(aprovada.situacao, "APROVADA");
  assert.ok(aprovada.impressaoDigitalRegras);
  const calculado = await avaliarBeneficio(aprovada.beneficios[0].id, { dataReferencia: "2026-12-31", idade: 60, aposentadoInss: true, salarioContribuicao: 1000, beneficioInss: 300 });
  assert.deepEqual(calculado, { beneficioId: aprovada.beneficios[0].id, elegivel: true, valor: 800 });
  const sobreposta = await criarSubmassa("plano-teste", { codigo: "ATIVOS", nome: "Sobreposta", vigenciaInicial: "2026-06-01" });
  await definirBeneficios(sobreposta.id, [{
    codigo: "PEC", nome: "Pecúlio", tipoBeneficio: "PECULIO",
    regrasElegibilidadeJson: JSON.stringify({ criterio: "IDADE_MINIMA", valor: 55 }),
    formulaValorJson: JSON.stringify({ valor: 100 })
  }]);
  await assert.rejects(aprovarSubmassa(sobreposta.id), /sobreposta/);
} finally {
  await closeDatabase();
  await rm(diretorio, { recursive: true, force: true });
}

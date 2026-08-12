import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = await mkdtemp(join(tmpdir(), "atuaria-previdenciaria-plan-rules-"));
process.env.APP_DB_PATH = join(tempDir, "plan-rules.sqlite");
process.env.APP_SEED_DEMO = "false";

const { closeDatabase, initializeDatabase } = await import("../db.js");
const { criarPlano, atualizarPlano } = await import("./plano-service.js");
const { criarEntidade } = await import("../previdencia/previdencia-service.js");
const {
  approveVersaoRegrasPlano,
  createVersaoRegrasPlano,
  getVersaoRegrasPlano,
  setValorRegraPlanos,
  updateRegrasPlanoMetadata
} = await import("./regras-plano-service.js");

try {
  await initializeDatabase();

  const entidade = await criarEntidade({ codigo: "TESTE", nome: "Entidade de teste" });

  const plan = await criarPlano({
    entidadePrevidenciaId: entidade.id,
    codigo: "SELFTEST-BD",
    nome: "Plano self-test",
    modalidade: "BD"
  });

  const draftV1 = await createVersaoRegrasPlano(plan.id, {
    nome: "Regulamento inicial",
    vigenciaInicial: "2026-01-01",
    observacoes: "Fonte de teste"
  });
  assert.equal(draftV1.versao, 1);
  assert.equal(draftV1.situacao, "RASCUNHO");

  const populatedV1 = await setValorRegraPlanos(draftV1.id, [
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
      codigo: "CUSTOM.REGULATORY_FLAG",
      categoria: "Extensão",
      rotulo: "Regra adicional",
      tipoValor: "BOOLEAN",
      jsonValor: "true",
      origem: "SELF_TEST"
    }
  ]);
  assert.equal(populatedV1.regras.length, 2);

  const approvedV1 = await approveVersaoRegrasPlano(draftV1.id);
  assert.equal(approvedV1.situacao, "APROVADO");
  assert.match(approvedV1.impressaoDigitalRegras ?? "", /^[0-9a-f]{64}$/);

  const draftV2 = await createVersaoRegrasPlano(plan.id, { copiarDeId: approvedV1.id });
  assert.equal(draftV2.versao, 2);
  assert.equal(draftV2.situacao, "RASCUNHO");
  assert.equal(draftV2.vigenciaInicial, null, "A nova versão não deve herdar a vigência anterior.");
  assert.equal(draftV2.vigenciaFinal, null);
  assert.equal(draftV2.regras.length, 2, "A cópia deve preservar as regras ativas.");

  const trimmedV2 = await setValorRegraPlanos(draftV2.id, [
    {
      codigo: "CUSTOM.REGULATORY_FLAG",
      categoria: "Extensão",
      rotulo: "Regra adicional",
      tipoValor: "BOOLEAN",
      jsonValor: "false",
      origem: "SELF_TEST"
    }
  ]);
  assert.deepEqual(trimmedV2.regras.map((rule) => rule.codigo), ["CUSTOM.REGULATORY_FLAG"]);

  await assert.rejects(
    () => approveVersaoRegrasPlano(draftV2.id),
    /data inicial de vigência/i
  );

  await updateRegrasPlanoMetadata(draftV2.id, {
    vigenciaInicial: "2027-01-01",
    observacoes: "Segunda vigência"
  });
  const approvedV2 = await approveVersaoRegrasPlano(draftV2.id);
  assert.equal(approvedV2.situacao, "APROVADO");
  assert.notEqual(approvedV2.impressaoDigitalRegras, approvedV1.impressaoDigitalRegras);

  const storedV1 = await getVersaoRegrasPlano(approvedV1.id);
  assert.equal(storedV1?.situacao, "SUBSTITUIDO");
  assert.equal(storedV1?.regras.length, 2, "A versão histórica não pode ser alterada pela edição da v2.");

  await assert.rejects(
    () => atualizarPlano(plan.id, { modalidade: "CD" }),
    /modalidade não pode ser alterada/i
  );

  console.log("Plano rules self-test: OK");
} finally {
  await closeDatabase();
  await rm(tempDir, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = await mkdtemp(join(tmpdir(), "atuaria-previdenciaria-plan-rules-"));
process.env.APP_DB_PATH = join(tempDir, "plan-rules.sqlite");
process.env.APP_SEED_DEMO = "false";

const { closeDatabase, initializeDatabase } = await import("../db.js");
const { createPlan, updatePlan } = await import("./plan-service.js");
const {
  approvePlanRulesVersion,
  createPlanRulesVersion,
  getPlanRulesVersion,
  setPlanRuleValues,
  updatePlanRulesMetadata
} = await import("./plan-rules-service.js");

try {
  await initializeDatabase();

  const plan = await createPlan({
    code: "SELFTEST-BD",
    name: "Plano self-test",
    modality: "BD"
  });

  const draftV1 = await createPlanRulesVersion(plan.id, {
    name: "Regulamento inicial",
    effectiveFrom: "2026-01-01",
    notes: "Fonte de teste"
  });
  assert.equal(draftV1.version, 1);
  assert.equal(draftV1.status, "DRAFT");

  const populatedV1 = await setPlanRuleValues(draftV1.id, [
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
      code: "CUSTOM.REGULATORY_FLAG",
      category: "Extensão",
      label: "Regra adicional",
      valueType: "BOOLEAN",
      valueJson: "true",
      source: "SELF_TEST"
    }
  ]);
  assert.equal(populatedV1.rules.length, 2);

  const approvedV1 = await approvePlanRulesVersion(draftV1.id);
  assert.equal(approvedV1.status, "APPROVED");
  assert.match(approvedV1.rulesFingerprint ?? "", /^[0-9a-f]{64}$/);

  const draftV2 = await createPlanRulesVersion(plan.id, { copyFromId: approvedV1.id });
  assert.equal(draftV2.version, 2);
  assert.equal(draftV2.status, "DRAFT");
  assert.equal(draftV2.effectiveFrom, null, "A nova versão não deve herdar a vigência anterior.");
  assert.equal(draftV2.effectiveTo, null);
  assert.equal(draftV2.rules.length, 2, "A cópia deve preservar as regras ativas.");

  const trimmedV2 = await setPlanRuleValues(draftV2.id, [
    {
      code: "CUSTOM.REGULATORY_FLAG",
      category: "Extensão",
      label: "Regra adicional",
      valueType: "BOOLEAN",
      valueJson: "false",
      source: "SELF_TEST"
    }
  ]);
  assert.deepEqual(trimmedV2.rules.map((rule) => rule.code), ["CUSTOM.REGULATORY_FLAG"]);

  await assert.rejects(
    () => approvePlanRulesVersion(draftV2.id),
    /data inicial de vigência/i
  );

  await updatePlanRulesMetadata(draftV2.id, {
    effectiveFrom: "2027-01-01",
    notes: "Segunda vigência"
  });
  const approvedV2 = await approvePlanRulesVersion(draftV2.id);
  assert.equal(approvedV2.status, "APPROVED");
  assert.notEqual(approvedV2.rulesFingerprint, approvedV1.rulesFingerprint);

  const storedV1 = await getPlanRulesVersion(approvedV1.id);
  assert.equal(storedV1?.status, "SUPERSEDED");
  assert.equal(storedV1?.rules.length, 2, "A versão histórica não pode ser alterada pela edição da v2.");

  await assert.rejects(
    () => updatePlan(plan.id, { modality: "CD" }),
    /modalidade não pode ser alterada/i
  );

  console.log("Plan rules self-test: OK");
} finally {
  await closeDatabase();
  await rm(tempDir, { recursive: true, force: true });
}

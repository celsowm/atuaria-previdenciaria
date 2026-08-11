import { createHash } from "node:crypto";

export type FingerprintPlanRule = {
  code: string;
  category: string;
  label: string;
  valueType: string;
  valueJson: string;
  unit: string | null;
  source: string;
};

export function comparePlanRuleCode(a: { code: string }, b: { code: string }) {
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

export function calculatePlanRulesFingerprint(input: {
  planId: string;
  version: number;
  modality: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  rules: FingerprintPlanRule[];
}) {
  const canonical = {
    planId: input.planId,
    version: input.version,
    modality: input.modality,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    rules: [...input.rules].sort(comparePlanRuleCode).map((rule) => ({
      code: rule.code,
      category: rule.category,
      label: rule.label,
      valueType: rule.valueType,
      valueJson: rule.valueJson,
      unit: rule.unit,
      source: rule.source
    }))
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

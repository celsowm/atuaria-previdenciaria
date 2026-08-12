import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const forbidden = /\b(?:Plan|Plans|Evaluation|Evaluations|Adherence|Biometric|Biometrics|Calculation|Calculations|Parameterization|Parameterization|ActuarialParameterization|Critique|Closing|ImportJob|MappingProfile|UserSession|PlanRulesVersion|ActuarialClosing|CreatePlan|UpdatePlan|CreateCalculation|DeriveBiometric|AdherenceStudy|BiometricTable)\b/;
const technicalAllowlist = ["Controller", "Service", "Dto", "Engine", "SelfTest", "Params", "Session", "AuthUser", "LLM", "HTTP", "UUID", "CNPJ"];
const roots = ["apps/backend/src", "apps/frontend/src"].map((path) => join(process.cwd(), path));
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      await walk(path);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const source = await readFile(path, "utf8");
      const code = source.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").replace(/(['`"])(?:\\.|(?!\1)[^\\])*\1/g, "");
      const match = code.match(forbidden);
      if (match && !technicalAllowlist.includes(match[0])) findings.push(`${relative(process.cwd(), path)}: ${match[0]}`);
    }
  }
}

for (const root of roots) await walk(root);

for (const name of await readdir(join(process.cwd(), "openapi"))) {
  if (!name.endsWith(".json")) continue;
  const document = JSON.parse(await readFile(join(process.cwd(), "openapi", name), "utf8"));
  const structural = [
    ...(document.tags ?? []).map((tag) => tag.name),
    ...Object.keys(document.paths ?? {}),
    ...Object.values(document.paths ?? {}).flatMap((path) => Object.values(path).flatMap((operation) => operation?.operationId ? [operation.operationId, ...(operation.tags ?? [])] : [])),
    ...Object.keys(document.components?.schemas ?? {})
  ].join(" ");
  const match = structural.match(forbidden);
  if (match) findings.push(`openapi/${name}: ${match[0]}`);
}

if (findings.length) {
  console.error("Identificadores de domínio antigos encontrados:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("Verificação de nomenclatura: OK (termos técnicos permitidos pela allowlist preservados).");
}

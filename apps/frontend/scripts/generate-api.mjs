import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateTypes } from "better-openapi-typescript";

const basePath = resolve("../../openapi/core.openapi.json");
const fragments = [
  resolve("../../openapi/config.openapi.json"),
  resolve("../../openapi/auth.openapi.json"),
  resolve("../../openapi/plans.openapi.json"),
  resolve("../../openapi/adherence.openapi.json"),
  resolve("../../openapi/parameterization.openapi.json"),
  resolve("../../openapi/calculation.openapi.json")
];
const mergedPath = resolve("./.openapi.merged.json");

const base = JSON.parse(await readFile(basePath, "utf8"));
base.info = {
  ...(base.info ?? {}),
  title: "Atuária Previdenciária API"
};
for (const fragmentPath of fragments) {
  const fragment = JSON.parse(await readFile(fragmentPath, "utf8"));
  base.tags = [
    ...(base.tags ?? []),
    ...(fragment.tags ?? []).filter((tag) => !(base.tags ?? []).some((current) => current.name === tag.name))
  ];
  base.paths = { ...(base.paths ?? {}), ...(fragment.paths ?? {}) };
  base.components = base.components ?? {};
  base.components.schemas = {
    ...(base.components.schemas ?? {}),
    ...(fragment.components?.schemas ?? {})
  };
  base.components.securitySchemes = {
    ...(base.components.securitySchemes ?? {}),
    ...(fragment.components?.securitySchemes ?? {})
  };
}

await writeFile(mergedPath, `${JSON.stringify(base, null, 2)}\n`, "utf8");
try {
  await generateTypes({
    inputPath: mergedPath,
    outputDir: "./src/api/generated",
    cleanOutput: true,
    lineEnding: "\n",
    includeDoNotEditHeader: true,
    logLevel: "info",
    makePathsEnum: true
  });
} finally {
  await rm(mergedPath, { force: true });
}

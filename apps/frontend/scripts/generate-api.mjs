import { generateTypes } from "better-openapi-typescript";

await generateTypes({
  inputPath: "../../openapi/atuas.openapi.json",
  outputDir: "./src/api/generated",
  cleanOutput: true,
  lineEnding: "\n",
  includeDoNotEditHeader: true,
  logLevel: "info",
  makePathsEnum: true
});

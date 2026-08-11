import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { repositoryRoot } from "./runtime-paths.js";

const envFilePath = resolve(repositoryRoot, ".env");

if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

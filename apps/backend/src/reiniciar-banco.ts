import "./load-env.js";
import { rm } from "node:fs/promises";
import { relative } from "node:path";
import { initializeDatabase } from "./db.js";
import { databaseFilePath, repositoryRoot } from "./runtime-paths.js";

const arquivo = databaseFilePath();
const relativo = relative(repositoryRoot, arquivo);
if (!relativo || relativo.startsWith("..") || /^[A-Za-z]:/.test(relativo)) {
  throw new Error("A reinicialização só pode remover um banco localizado dentro do repositório.");
}

await Promise.all([arquivo, `${arquivo}-wal`, `${arquivo}-shm`].map((caminho) => rm(caminho, { force: true })));
process.env.APP_SEED_DEMO = "true";
await initializeDatabase();
console.log(`Banco reinicializado: ${arquivo}`);

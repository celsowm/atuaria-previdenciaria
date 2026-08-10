import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(moduleDirectory, "../../..");

export function resolveRepositoryPath(configuredPath: string | undefined, fallback: string) {
  return resolve(repositoryRoot, configuredPath?.trim() || fallback);
}

export function databaseFilePath() {
  return resolveRepositoryPath(process.env.ATUAS_DB_PATH, "data/atuas.sqlite");
}

export function storageRootPath() {
  return resolveRepositoryPath(process.env.ATUAS_STORAGE_PATH, "data/storage");
}

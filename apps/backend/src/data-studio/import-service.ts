import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { UploadedFileInfo } from "adorn-api";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  ImportFile,
  ImportJob,
  ImportRow,
  MappingProfile,
  MappingRule
} from "../domain/entities.js";
import {
  compareHeaders,
  fingerprintHeaders,
  fingerprintRules,
  normalizeSourceRow,
  parseWorkbookBuffer,
  rowToObject,
  toCanonicalRow,
  validateCanonicalRow,
  type MappingRuleInput
} from "./mapping.js";

type ImportOptions = {
  evaluationId?: number;
  population: string;
  profileId?: number;
  profileName?: string;
  saveProfile: boolean;
  sheetName?: string;
  headerRow: number;
  rules: MappingRuleInput[];
};

export type ImportResult = {
  id: string;
  fileId: string;
  mappingProfileId: number | null;
  mappingProfileVersion: string | null;
  fileName: string;
  fileSha256: string;
  population: string;
  sheetName: string;
  rowCount: number;
  validRows: number;
  invalidRows: number;
  status: string;
};

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function requireTable(entity: typeof MappingProfile | typeof MappingRule | typeof ImportFile | typeof ImportJob | typeof ImportRow) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function parseProfileVersion(version: string) {
  const match = /^v(\d+)$/i.exec(version.trim());
  return match ? Number(match[1]) : 0;
}

async function loadRules(profileId: number) {
  return withSession(async (session) => {
    const rows = await selectFromEntity(MappingRule).execute(session);
    return rows
      .filter((row) => row.profileId === profileId)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map<MappingRuleInput>((row) => ({
        sources: JSON.parse(row.sourcesJson) as string[],
        targets: JSON.parse(row.targetsJson) as string[],
        transform: row.transform as MappingRuleInput["transform"]
      }));
  });
}

export async function matchMappingProfile(headers: string[], population: string) {
  const profiles = await withSession((session) => selectFromEntity(MappingProfile).execute(session));
  const candidates = profiles
    .filter((profile) => profile.population === population && profile.sourceHeadersJson)
    .map((profile) => {
      const profileHeaders = JSON.parse(profile.sourceHeadersJson ?? "[]") as string[];
      return { profile, profileHeaders, ...compareHeaders(headers, profileHeaders) };
    })
    .sort((a, b) => b.compatibility - a.compatibility || b.profile.updatedAt.localeCompare(a.profile.updatedAt));

  const best = candidates[0];
  if (!best || best.compatibility < 50) {
    return {
      matched: false,
      compatibility: 0,
      exact: false,
      missingColumns: [] as string[],
      newColumns: [] as string[],
      rulesJson: "[]"
    };
  }

  const rules = await loadRules(best.profile.id);
  return {
    matched: true,
    profileId: best.profile.id,
    profileName: best.profile.name,
    version: best.profile.version,
    compatibility: best.compatibility,
    exact: best.exact,
    missingColumns: best.missingColumns,
    newColumns: best.newColumns,
    rulesJson: JSON.stringify(rules)
  };
}

async function resolveProfile(
  options: ImportOptions,
  headers: string[],
  schemaFingerprint: string
): Promise<MappingProfile | null> {
  if (!options.saveProfile && !options.profileId) return null;

  const rulesFingerprint = fingerprintRules(options.rules);
  const profiles = await withSession((session) => selectFromEntity(MappingProfile).execute(session));
  const requested = options.profileId
    ? profiles.find((profile) => profile.id === options.profileId)
    : undefined;
  const reusable = profiles.find(
    (profile) =>
      profile.population === options.population &&
      profile.schemaFingerprint === schemaFingerprint &&
      profile.rulesFingerprint === rulesFingerprint
  );
  if (reusable) return reusable;
  if (!options.saveProfile) return requested ?? null;

  const name = options.profileName?.trim() || requested?.name || `${options.population} mapping`;
  const siblings = profiles.filter(
    (profile) => profile.population === options.population && profile.name === name
  );
  const version = `v${Math.max(0, ...siblings.map((profile) => parseProfileVersion(profile.version))) + 1}`;
  const profile = new MappingProfile();
  profile.id = Math.max(0, ...profiles.map((item) => item.id)) + 1;
  profile.name = name;
  profile.population = options.population;
  profile.version = version;
  profile.schemaFingerprint = schemaFingerprint;
  profile.rulesFingerprint = rulesFingerprint;
  profile.sourceHeadersJson = JSON.stringify(headers);
  profile.mappedFields = new Set(options.rules.flatMap((rule) => rule.targets)).size;
  profile.totalFields = headers.length;
  profile.updatedAt = new Date().toISOString();

  await withSession(async (session) => {
    session.trackNew(requireTable(MappingProfile), profile, profile.id);
    await session.commit();
  });

  await withSession(async (session) => {
    const table = requireTable(MappingRule);
    for (const [index, input] of options.rules.entries()) {
      const rule = new MappingRule();
      rule.id = randomUUID();
      rule.profileId = profile.id;
      rule.ordinal = index;
      rule.sourcesJson = JSON.stringify(input.sources);
      rule.targetsJson = JSON.stringify(input.targets);
      rule.transform = input.transform;
      session.trackNew(table, rule, rule.id);
    }
    await session.commit();
  });

  return profile;
}

async function uploadedBuffer(file: UploadedFileInfo) {
  if (file.buffer) return file.buffer;
  if (file.path) return readFile(file.path);
  throw new Error("O upload não possui buffer nem caminho temporário.");
}

function safeName(name: string) {
  return basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function markJobFailed(jobId: string) {
  await withSession(async (session) => {
    const job = await session.find(ImportJob, jobId);
    if (!job) return;
    job.status = "FAILED";
    job.completedAt = new Date().toISOString();
    session.markDirty(job);
    await session.commit();
  });
}

export async function persistImport(file: UploadedFileInfo, options: ImportOptions): Promise<ImportResult> {
  const buffer = await uploadedBuffer(file);
  const parsed = parseWorkbookBuffer(buffer, {
    sheetName: options.sheetName,
    headerRow: options.headerRow
  });
  const schemaFingerprint = fingerprintHeaders(parsed.headers);
  const profile = await resolveProfile(options, parsed.headers, schemaFingerprint);

  const fileId = randomUUID();
  const jobId = randomUUID();
  const fileSha256 = createHash("sha256").update(buffer).digest("hex");
  const storageRoot = resolve(process.env.ATUAS_STORAGE_PATH ?? "./data/storage");
  const relativePath = join("imports", fileId, safeName(file.originalName));
  const absolutePath = join(storageRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const createdAt = new Date().toISOString();
  const sourceFile = new ImportFile();
  sourceFile.id = fileId;
  sourceFile.originalName = file.originalName;
  sourceFile.mimeType = file.mimeType || "application/octet-stream";
  sourceFile.sizeBytes = file.size;
  sourceFile.sha256 = fileSha256;
  sourceFile.storagePath = relativePath;
  sourceFile.createdAt = createdAt;

  const job = new ImportJob();
  job.id = jobId;
  job.evaluationId = options.evaluationId ?? null;
  job.fileId = fileId;
  job.mappingProfileId = profile?.id ?? null;
  job.population = options.population;
  job.sheetName = parsed.sheetName;
  job.headerRow = options.headerRow;
  job.sourceHeadersJson = JSON.stringify(parsed.headers);
  job.schemaFingerprint = schemaFingerprint;
  job.status = "PROCESSING";
  job.rowCount = parsed.rows.length;
  job.validRows = 0;
  job.invalidRows = 0;
  job.createdAt = createdAt;
  job.completedAt = null;

  await withSession(async (session) => {
    session.trackNew(requireTable(ImportFile), sourceFile, sourceFile.id);
    session.trackNew(requireTable(ImportJob), job, job.id);
    await session.commit();
  });

  let validRows = 0;
  let invalidRows = 0;
  const batchSize = 250;

  try {
    for (let offset = 0; offset < parsed.rows.length; offset += batchSize) {
      const batch = parsed.rows.slice(offset, offset + batchSize);
      await withSession(async (session) => {
        const table = requireTable(ImportRow);
        for (const [batchIndex, sourceRow] of batch.entries()) {
          const raw = rowToObject(parsed.headers, sourceRow);
          const normalized = normalizeSourceRow(raw);
          const canonical = toCanonicalRow(normalized, options.rules);
          const validationErrors = validateCanonicalRow(canonical);
          if (validationErrors.length) invalidRows += 1;
          else validRows += 1;

          const row = new ImportRow();
          row.id = randomUUID();
          row.importJobId = jobId;
          row.rowNumber = options.headerRow + offset + batchIndex + 1;
          row.rawJson = JSON.stringify(raw);
          row.normalizedJson = JSON.stringify(normalized);
          row.canonicalJson = JSON.stringify(canonical);
          row.validationStatus = validationErrors.length ? "INVALID" : "VALID";
          row.validationErrorsJson = JSON.stringify(validationErrors);
          session.trackNew(table, row, row.id);
        }
        await session.commit();
      });
    }

    await withSession(async (session) => {
      const storedJob = await session.find(ImportJob, jobId);
      if (!storedJob) throw new Error(`Import job ${jobId} desapareceu durante o processamento.`);
      storedJob.status = "COMPLETED";
      storedJob.validRows = validRows;
      storedJob.invalidRows = invalidRows;
      storedJob.completedAt = new Date().toISOString();
      session.markDirty(storedJob);
      await session.commit();
    });
  } catch (error) {
    await markJobFailed(jobId);
    throw error;
  }

  return {
    id: jobId,
    fileId,
    mappingProfileId: profile?.id ?? null,
    mappingProfileVersion: profile?.version ?? null,
    fileName: file.originalName,
    fileSha256,
    population: options.population,
    sheetName: parsed.sheetName,
    rowCount: parsed.rows.length,
    validRows,
    invalidRows,
    status: "COMPLETED"
  };
}
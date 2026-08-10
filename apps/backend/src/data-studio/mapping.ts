import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

export type Transform =
  | "auto"
  | "date-yyyymmdd"
  | "date-br"
  | "concat"
  | "sum"
  | "split-dash"
  | "sex";

export type MappingRuleInput = {
  sources: string[];
  targets: string[];
  transform: Transform;
};

export type ParsedSheet = {
  sheetName: string;
  headers: string[];
  rows: unknown[][];
};

const requiredCanonicalFields = [
  "participant.registration",
  "participant.birthDate",
  "participant.sex"
] as const;

export function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function fingerprintHeaders(headers: string[]) {
  return hashJson(headers.map(normalizeToken));
}

export function fingerprintRules(rules: MappingRuleInput[]) {
  return hashJson(
    rules.map((rule) => ({
      sources: rule.sources.map(normalizeToken),
      targets: rule.targets,
      transform: rule.transform
    }))
  );
}

export function compareHeaders(candidate: string[], profileHeaders: string[]) {
  const candidateNormalized = candidate.map(normalizeToken);
  const profileNormalized = profileHeaders.map(normalizeToken);
  const candidateSet = new Set(candidateNormalized);
  const profileSet = new Set(profileNormalized);
  const intersection = [...candidateSet].filter((header) => profileSet.has(header)).length;
  const denominator = Math.max(candidateSet.size, profileSet.size, 1);
  const compatibility = Math.round((intersection / denominator) * 100);
  const exact =
    candidateNormalized.length === profileNormalized.length &&
    candidateNormalized.every((header, index) => header === profileNormalized[index]);

  return {
    compatibility,
    exact,
    missingColumns: profileHeaders.filter((header) => !candidateSet.has(normalizeToken(header))),
    newColumns: candidate.filter((header) => !profileSet.has(normalizeToken(header)))
  };
}

export function parseWorkbookBuffer(
  buffer: Buffer,
  options: { sheetName?: string; headerRow: number }
): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName =
    options.sheetName && workbook.Sheets[options.sheetName]
      ? options.sheetName
      : workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não possui abas legíveis.");

  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false
  });
  const headerIndex = Math.max(0, options.headerRow - 1);
  const headers = (matrix[headerIndex] ?? []).map((value, index) =>
    String(value || `COL_${index + 1}`).trim()
  );
  const rows = matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""));

  return { sheetName, headers, rows };
}

export function rowToObject(headers: string[], row: unknown[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

export function normalizeSourceRow(raw: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      if (value === undefined || value === null) return [key, null];
      if (typeof value === "string") {
        const trimmed = value.trim().replace(/\s+/g, " ");
        return [key, trimmed === "" ? null : trimmed];
      }
      return [key, value];
    })
  );
}

function parsePtNumber(value: unknown) {
  if (typeof value === "number") return value;
  const text = String(value ?? "")
    .trim()
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBrazilianDate(value: unknown) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return value;
  let year = Number(match[3]);
  if (match[3].length === 2) {
    const currentTwoDigits = new Date().getUTCFullYear() % 100;
    year += year <= currentTwoDigits ? 2000 : 1900;
  }
  return `${year.toString().padStart(4, "0")}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function normalizeCompactDate(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 8
    ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    : value;
}

export function applyRule(
  rule: MappingRuleInput,
  normalizedRow: Record<string, unknown>
): Record<string, unknown> {
  const values = rule.sources.map((source) => normalizedRow[source] ?? "");
  const output: Record<string, unknown> = {};
  if (!rule.targets.length) return output;

  if (rule.transform === "split-dash") {
    const parts = String(values[0] ?? "").split("-");
    rule.targets.forEach((target, index) => {
      output[target] = parts[index]?.trim() ?? "";
    });
    return output;
  }

  let value: unknown = values[0] ?? "";
  if (rule.transform === "concat") value = values.filter(Boolean).join(" ").trim();
  if (rule.transform === "sum") {
    value = values.reduce<number>((total, item) => total + (parsePtNumber(item) ?? 0), 0);
  }
  if (rule.transform === "date-yyyymmdd") value = normalizeCompactDate(value);
  if (rule.transform === "date-br") value = normalizeBrazilianDate(value);
  if (rule.transform === "sex") {
    const sex = normalizeToken(String(value));
    value = ["M", "1", "MASC", "MASCULINO"].includes(sex)
      ? "MALE"
      : ["F", "2", "FEM", "FEMININO"].includes(sex)
        ? "FEMALE"
        : value;
  }
  if (rule.transform === "auto" && values.length > 1) {
    value = values.filter(Boolean).join(" ").trim();
  }

  output[rule.targets[0]] = value;
  return output;
}

export function toCanonicalRow(
  normalizedRow: Record<string, unknown>,
  rules: MappingRuleInput[]
) {
  return Object.assign({}, ...rules.map((rule) => applyRule(rule, normalizedRow)));
}

function isIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateCanonicalRow(row: Record<string, unknown>) {
  const errors: string[] = [];
  for (const field of requiredCanonicalFields) {
    const value = row[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      errors.push(`${field}: obrigatório`);
    }
  }
  if (row["participant.birthDate"] && !isIsoDate(row["participant.birthDate"])) {
    errors.push("participant.birthDate: data inválida");
  }
  if (
    row["participant.sex"] &&
    !["MALE", "FEMALE"].includes(String(row["participant.sex"]))
  ) {
    errors.push("participant.sex: valor não normalizado");
  }
  return errors;
}
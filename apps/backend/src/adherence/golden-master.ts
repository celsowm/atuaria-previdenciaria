import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { evaluateCandidate, type AdherenceCell } from "./statistics.js";

export type CellPointer = {
  sheet: string;
  cell: string;
};

export type GoldenMasterCandidate = {
  label: string;
  expectedColumn?: string;
  qxColumn?: string;
  summary?: Partial<Record<MetricName, CellPointer>>;
};

export type GoldenMasterManifest = {
  name: string;
  workbook: string;
  alpha: number;
  fisherSplitAge: number;
  tolerance?: {
    absolute?: number;
    relative?: number;
  };
  matrix: {
    sheet: string;
    startRow: number;
    endRow: number;
    ageColumn: string;
    sexColumn?: string;
    fixedSex?: "MALE" | "FEMALE" | "UNISEX";
    exposureColumn: string;
    observedColumn: string;
  };
  candidates: GoldenMasterCandidate[];
};

export type MetricName =
  | "expectedEvents"
  | "chiSquare"
  | "chiSquareCritical"
  | "chiSquareP"
  | "ksD"
  | "ksCritical"
  | "ksP"
  | "zStatistic"
  | "zCritical"
  | "zP"
  | "fisherP"
  | "dqm";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const DEFAULT_ABSOLUTE_TOLERANCE = 1e-8;
const DEFAULT_RELATIVE_TOLERANCE = 1e-6;

function normalizeSex(value: unknown, fallback: "MALE" | "FEMALE" | "UNISEX") {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return fallback;
  if (["M", "MALE", "MASC", "MASCULINO", "1"].includes(text)) return "MALE";
  if (["F", "FEMALE", "FEM", "FEMININO", "2"].includes(text)) return "FEMALE";
  if (["U", "UNISEX", "AMBOS", "BOTH"].includes(text)) return "UNISEX";
  throw new Error(`Sexo não reconhecido no golden master: ${text}.`);
}

function numeric(value: unknown, label: string) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} não é finito.`);
    return value;
  }
  let text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} está vazio.`);
  const percentage = text.endsWith("%");
  if (percentage) text = text.slice(0, -1).trim();
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`${label} não é numérico: ${String(value)}.`);
  return percentage ? parsed / 100 : parsed;
}

function cellValue(workbook: XLSX.WorkBook, pointer: CellPointer) {
  const sheet = workbook.Sheets[pointer.sheet];
  if (!sheet) throw new Error(`A aba ${pointer.sheet} não existe no workbook.`);
  const cell = sheet[pointer.cell];
  if (!cell) throw new Error(`A célula ${pointer.sheet}!${pointer.cell} está vazia.`);
  return cell.v ?? cell.w;
}

function matrixValue(sheet: XLSX.WorkSheet, column: string, row: number) {
  return sheet[`${column.toUpperCase()}${row}`]?.v ?? sheet[`${column.toUpperCase()}${row}`]?.w;
}

function resolvePrivatePath(input: string, manifestPath?: string) {
  const resolved = isAbsolute(input)
    ? resolve(input)
    : resolve(manifestPath ? dirname(manifestPath) : process.cwd(), input);
  const repoRelative = relative(REPO_ROOT, resolved).replaceAll("\\", "/");
  const insideRepo = repoRelative !== "" && !repoRelative.startsWith("../") && repoRelative !== "..";
  if (insideRepo && !repoRelative.startsWith("data/golden-master/")) {
    throw new Error(
      `Golden-master real não pode ficar em caminho versionável do repositório: ${repoRelative}. ` +
      "Use um diretório externo ou data/golden-master/, que é ignorado pelo Git."
    );
  }
  return resolved;
}

function closeEnough(actual: number, expected: number, absolute: number, relativeTolerance: number) {
  const delta = Math.abs(actual - expected);
  const limit = absolute + relativeTolerance * Math.max(1, Math.abs(expected));
  return { pass: delta <= limit, delta, limit };
}

function metricValue(metrics: ReturnType<typeof evaluateCandidate>, name: MetricName) {
  return metrics[name];
}

function buildCells(workbook: XLSX.WorkBook, manifest: GoldenMasterManifest, candidate: GoldenMasterCandidate) {
  const sheet = workbook.Sheets[manifest.matrix.sheet];
  if (!sheet) throw new Error(`A aba ${manifest.matrix.sheet} não existe no workbook.`);
  if (!candidate.expectedColumn && !candidate.qxColumn) {
    throw new Error(`Candidato ${candidate.label} precisa de expectedColumn ou qxColumn.`);
  }
  const fixedSex = manifest.matrix.fixedSex ?? "UNISEX";
  const cells: AdherenceCell[] = [];
  const workbookExpected: number[] = [];
  for (let row = manifest.matrix.startRow; row <= manifest.matrix.endRow; row += 1) {
    const ageRaw = matrixValue(sheet, manifest.matrix.ageColumn, row);
    const exposureRaw = matrixValue(sheet, manifest.matrix.exposureColumn, row);
    const observedRaw = matrixValue(sheet, manifest.matrix.observedColumn, row);
    if (ageRaw === undefined && exposureRaw === undefined && observedRaw === undefined) continue;
    const age = numeric(ageRaw, `${manifest.matrix.sheet}!${manifest.matrix.ageColumn}${row}`);
    const exposure = numeric(exposureRaw, `${manifest.matrix.sheet}!${manifest.matrix.exposureColumn}${row}`);
    const observed = numeric(observedRaw, `${manifest.matrix.sheet}!${manifest.matrix.observedColumn}${row}`);
    if (!Number.isInteger(age) || age < 0 || age > 130) throw new Error(`Idade inválida na linha ${row}: ${age}.`);
    if (exposure <= 0) throw new Error(`Exposição inválida na linha ${row}: ${exposure}.`);
    const sex = manifest.matrix.sexColumn
      ? normalizeSex(matrixValue(sheet, manifest.matrix.sexColumn, row), fixedSex)
      : fixedSex;
    const expected = candidate.expectedColumn
      ? numeric(matrixValue(sheet, candidate.expectedColumn, row), `${manifest.matrix.sheet}!${candidate.expectedColumn}${row}`)
      : undefined;
    const qx = candidate.qxColumn
      ? numeric(matrixValue(sheet, candidate.qxColumn, row), `${manifest.matrix.sheet}!${candidate.qxColumn}${row}`)
      : (expected as number) / exposure;
    const computedExpected = exposure * qx;
    cells.push({ age, sex, exposure, observed, qx, expected: computedExpected });
    workbookExpected.push(expected ?? computedExpected);
  }
  if (!cells.length) throw new Error(`Nenhuma célula de aderência foi lida para ${candidate.label}.`);
  return { cells, workbookExpected };
}

export async function compareGoldenMaster(manifestPathInput: string) {
  const manifestPath = resolvePrivatePath(manifestPathInput);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as GoldenMasterManifest;
  const workbookPath = resolvePrivatePath(manifest.workbook, manifestPath);
  const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellText: true, cellDates: false });
  const absolute = manifest.tolerance?.absolute ?? DEFAULT_ABSOLUTE_TOLERANCE;
  const relativeTolerance = manifest.tolerance?.relative ?? DEFAULT_RELATIVE_TOLERANCE;

  const candidates = manifest.candidates.map((candidate) => {
    const { cells, workbookExpected } = buildCells(workbook, manifest, candidate);
    const metrics = evaluateCandidate(cells, manifest.alpha, manifest.fisherSplitAge);
    const pointChecks = cells.map((cell, index) => {
      const expected = workbookExpected[index];
      const comparison = closeEnough(cell.expected, expected, absolute, relativeTolerance);
      return {
        age: cell.age,
        sex: cell.sex,
        actualExpected: cell.expected,
        excelExpected: expected,
        ...comparison
      };
    });
    const metricChecks = Object.entries(candidate.summary ?? {}).map(([name, pointer]) => {
      const metricName = name as MetricName;
      const excel = numeric(cellValue(workbook, pointer as CellPointer), `${(pointer as CellPointer).sheet}!${(pointer as CellPointer).cell}`);
      const actual = Number(metricValue(metrics, metricName));
      return { metric: metricName, actual, excel, ...closeEnough(actual, excel, absolute, relativeTolerance) };
    });
    return {
      label: candidate.label,
      passed: pointChecks.every((check) => check.pass) && metricChecks.every((check) => check.pass),
      metrics,
      pointChecks,
      metricChecks
    };
  });

  const report = {
    manifest: manifest.name,
    engine: "atuas-adherence-v1",
    generatedAt: new Date().toISOString(),
    passed: candidates.every((candidate) => candidate.passed),
    candidates
  };

  const reportRoot = resolvePrivatePath(process.env.ATUAS_GOLDEN_MASTER_REPORT_DIR ?? "data/golden-master/reports");
  await mkdir(reportRoot, { recursive: true });
  const safeName = manifest.name.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-|-$/g, "") || "golden-master";
  const reportPath = resolve(reportRoot, `${safeName}.report.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return { report, reportPath };
}

export function inspectWorkbook(workbookPathInput: string) {
  const workbookPath = resolvePrivatePath(workbookPathInput);
  const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellText: true, cellDates: false });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const ref = sheet?.["!ref"] ?? null;
    const range = ref ? XLSX.utils.decode_range(ref) : null;
    const headerCandidates: Array<{ row: number; values: string[] }> = [];
    if (sheet && range) {
      const lastProbeRow = Math.min(range.e.r, range.s.r + 19);
      for (let row = range.s.r; row <= lastProbeRow; row += 1) {
        const values: string[] = [];
        for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 24); col += 1) {
          const value = sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v;
          if (typeof value === "string" && value.trim()) values.push(value.trim());
        }
        if (values.length >= 2) headerCandidates.push({ row: row + 1, values: values.slice(0, 12) });
      }
    }
    return {
      name,
      ref,
      rows: range ? range.e.r - range.s.r + 1 : 0,
      columns: range ? range.e.c - range.s.c + 1 : 0,
      headerCandidates: headerCandidates.slice(0, 5)
    };
  });
}

async function selfTest() {
  const root = await mkdtemp(resolve(tmpdir(), "atuas-golden-master-"));
  const workbookPath = resolve(root, "synthetic.xlsx");
  const manifestPath = resolve(root, "synthetic.golden-master.local.json");
  const workbook = XLSX.utils.book_new();
  const matrix = XLSX.utils.aoa_to_sheet([
    ["AGE", "EXPOSURE", "OBSERVED", "EXPECTED"],
    [20, 1000, 1, 1],
    [21, 1000, 2, 2],
    [22, 1000, 3, 3]
  ]);
  const summary = XLSX.utils.aoa_to_sheet([
    ["METRIC", "VALUE"],
    ["expectedEvents", 6],
    ["chiSquare", 0],
    ["chiSquareP", 1],
    ["ksD", 0],
    ["ksP", 1],
    ["zStatistic", 0],
    ["zP", 1],
    ["fisherP", 1],
    ["dqm", 0]
  ]);
  XLSX.utils.book_append_sheet(workbook, matrix, "BASE");
  XLSX.utils.book_append_sheet(workbook, summary, "SUMMARY");
  XLSX.writeFile(workbook, workbookPath);
  const manifest: GoldenMasterManifest = {
    name: "synthetic-ci",
    workbook: workbookPath,
    alpha: 0.05,
    fisherSplitAge: 21,
    matrix: {
      sheet: "BASE",
      startRow: 2,
      endRow: 4,
      ageColumn: "A",
      exposureColumn: "B",
      observedColumn: "C",
      fixedSex: "UNISEX"
    },
    candidates: [{
      label: "synthetic",
      expectedColumn: "D",
      summary: {
        expectedEvents: { sheet: "SUMMARY", cell: "B2" },
        chiSquare: { sheet: "SUMMARY", cell: "B3" },
        chiSquareP: { sheet: "SUMMARY", cell: "B4" },
        ksD: { sheet: "SUMMARY", cell: "B5" },
        ksP: { sheet: "SUMMARY", cell: "B6" },
        zStatistic: { sheet: "SUMMARY", cell: "B7" },
        zP: { sheet: "SUMMARY", cell: "B8" },
        fisherP: { sheet: "SUMMARY", cell: "B9" },
        dqm: { sheet: "SUMMARY", cell: "B10" }
      }
    }]
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  process.env.ATUAS_GOLDEN_MASTER_REPORT_DIR = resolve(root, "reports");
  const result = await compareGoldenMaster(manifestPath);
  if (!result.report.passed) throw new Error(`Golden-master self-test falhou: ${result.reportPath}`);
  return result.reportPath;
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (command === "inspect") {
    if (!argument) throw new Error("Uso: golden-master inspect <workbook.xlsx>");
    console.log(JSON.stringify(inspectWorkbook(argument), null, 2));
    return;
  }
  if (command === "compare") {
    if (!argument) throw new Error("Uso: golden-master compare <manifest.local.json>");
    const { report, reportPath } = await compareGoldenMaster(argument);
    console.log(JSON.stringify({ passed: report.passed, reportPath }, null, 2));
    if (!report.passed) process.exitCode = 1;
    return;
  }
  if (command === "self-test") {
    const reportPath = await selfTest();
    console.log(`Golden-master self-test OK: ${reportPath}`);
    return;
  }
  throw new Error("Comandos: inspect | compare | self-test");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { evaluateCandidato, type AderenciaCell } from "./estatisticas.js";

export type CellPointer = {
  sheet: string;
  cell: string;
};

export type GoldenMasterCandidato = {
  rotulo: string;
  esperadoColumn?: string;
  qxColumn?: string;
  summary?: Partial<Record<MetricName, CellPointer>>;
};

export type GoldenMasterManifest = {
  nome: string;
  workbook: string;
  alpha: number;
  idadeDivisaoFisher: number;
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
    fixedSex?: "MASCULINO" | "FEMININO" | "UNISSEX";
    exposicaoColumn: string;
    observadoColumn: string;
  };
  candidatos: GoldenMasterCandidato[];
};

export type MetricName =
  | "eventosEsperados"
  | "quiQuadrado"
  | "quiQuadradoCritical"
  | "quiQuadradoP"
  | "ksD"
  | "ksCritico"
  | "pKs"
  | "estatisticaZ"
  | "zCritico"
  | "pZ"
  | "pFisher"
  | "dqm";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const DEFAULT_ABSOLUTE_TOLERANCE = 1e-8;
const DEFAULT_RELATIVE_TOLERANCE = 1e-6;

function normalizeSex(value: unknown, fallback: "MASCULINO" | "FEMININO" | "UNISSEX") {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return fallback;
  if (["M", "MASCULINO", "MASC", "MASCULINO", "1"].includes(text)) return "MASCULINO";
  if (["F", "FEMININO", "FEM", "FEMININO", "2"].includes(text)) return "FEMININO";
  if (["U", "UNISSEX", "AMBOS", "AMBOS"].includes(text)) return "UNISSEX";
  throw new Error(`Sexo não reconhecido no golden master: ${text}.`);
}

function numeric(value: unknown, rotulo: string) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${rotulo} não é finito.`);
    return value;
  }
  let text = String(value ?? "").trim();
  if (!text) throw new Error(`${rotulo} está vazio.`);
  const percentage = text.endsWith("%");
  if (percentage) text = text.slice(0, -1).trim();
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`${rotulo} não é numérico: ${String(value)}.`);
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

function closeEnough(actual: number, esperado: number, absolute: number, relativeTolerance: number) {
  const delta = Math.abs(actual - esperado);
  const limit = absolute + relativeTolerance * Math.max(1, Math.abs(esperado));
  return { pass: delta <= limit, delta, limit };
}

function metricValue(metrics: ReturnType<typeof evaluateCandidato>, nome: MetricName) {
  return metrics[nome];
}

function buildCells(workbook: XLSX.WorkBook, manifest: GoldenMasterManifest, candidato: GoldenMasterCandidato) {
  const sheet = workbook.Sheets[manifest.matrix.sheet];
  if (!sheet) throw new Error(`A aba ${manifest.matrix.sheet} não existe no workbook.`);
  if (!candidato.esperadoColumn && !candidato.qxColumn) {
    throw new Error(`Candidato ${candidato.rotulo} precisa de esperadoColumn ou qxColumn.`);
  }
  const fixedSex = manifest.matrix.fixedSex ?? "UNISSEX";
  const cells: AderenciaCell[] = [];
  const workbookExpected: number[] = [];
  for (let row = manifest.matrix.startRow; row <= manifest.matrix.endRow; row += 1) {
    const ageRaw = matrixValue(sheet, manifest.matrix.ageColumn, row);
    const exposicaoRaw = matrixValue(sheet, manifest.matrix.exposicaoColumn, row);
    const observadoRaw = matrixValue(sheet, manifest.matrix.observadoColumn, row);
    if (ageRaw === undefined && exposicaoRaw === undefined && observadoRaw === undefined) continue;
    const idade = numeric(ageRaw, `${manifest.matrix.sheet}!${manifest.matrix.ageColumn}${row}`);
    const exposicao = numeric(exposicaoRaw, `${manifest.matrix.sheet}!${manifest.matrix.exposicaoColumn}${row}`);
    const observado = numeric(observadoRaw, `${manifest.matrix.sheet}!${manifest.matrix.observadoColumn}${row}`);
    if (!Number.isInteger(idade) || idade < 0 || idade > 130) throw new Error(`Idade inválida na linha ${row}: ${idade}.`);
    if (exposicao <= 0) throw new Error(`Exposição inválida na linha ${row}: ${exposicao}.`);
    const sexo = manifest.matrix.sexColumn
      ? normalizeSex(matrixValue(sheet, manifest.matrix.sexColumn, row), fixedSex)
      : fixedSex;
    const esperado = candidato.esperadoColumn
      ? numeric(matrixValue(sheet, candidato.esperadoColumn, row), `${manifest.matrix.sheet}!${candidato.esperadoColumn}${row}`)
      : undefined;
    const qx = candidato.qxColumn
      ? numeric(matrixValue(sheet, candidato.qxColumn, row), `${manifest.matrix.sheet}!${candidato.qxColumn}${row}`)
      : (esperado as number) / exposicao;
    const computedExpected = exposicao * qx;
    cells.push({ idade, sexo, exposicao, observado, qx, esperado: computedExpected });
    workbookExpected.push(esperado ?? computedExpected);
  }
  if (!cells.length) throw new Error(`Nenhuma célula de aderência foi lida para ${candidato.rotulo}.`);
  return { cells, workbookExpected };
}

export async function compareGoldenMaster(manifestPathInput: string) {
  const manifestPath = resolvePrivatePath(manifestPathInput);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as GoldenMasterManifest;
  const workbookPath = resolvePrivatePath(manifest.workbook, manifestPath);
  const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellText: true, cellDates: false });
  const absolute = manifest.tolerance?.absolute ?? DEFAULT_ABSOLUTE_TOLERANCE;
  const relativeTolerance = manifest.tolerance?.relative ?? DEFAULT_RELATIVE_TOLERANCE;

  const candidatos = manifest.candidatos.map((candidato) => {
    const { cells, workbookExpected } = buildCells(workbook, manifest, candidato);
    const metrics = evaluateCandidato(cells, manifest.alpha, manifest.idadeDivisaoFisher);
    const pointChecks = cells.map((cell, index) => {
      const esperado = workbookExpected[index];
      const comparison = closeEnough(cell.esperado, esperado, absolute, relativeTolerance);
      return {
        idade: cell.idade,
        sexo: cell.sexo,
        actualExpected: cell.esperado,
        excelExpected: esperado,
        ...comparison
      };
    });
    const metricChecks = Object.entries(candidato.summary ?? {}).map(([nome, pointer]) => {
      const metricName = nome as MetricName;
      const excel = numeric(cellValue(workbook, pointer as CellPointer), `${(pointer as CellPointer).sheet}!${(pointer as CellPointer).cell}`);
      const actual = Number(metricValue(metrics, metricName));
      return { metric: metricName, actual, excel, ...closeEnough(actual, excel, absolute, relativeTolerance) };
    });
    return {
      rotulo: candidato.rotulo,
      passed: pointChecks.every((check) => check.pass) && metricChecks.every((check) => check.pass),
      metrics,
      pointChecks,
      metricChecks
    };
  });

  const report = {
    manifest: manifest.nome,
    engine: "atuas-adherence-v1",
    generatedAt: new Date().toISOString(),
    passed: candidatos.every((candidato) => candidato.passed),
    candidatos
  };

  const reportRoot = resolvePrivatePath(process.env.ATUAS_GOLDEN_MASTER_REPORT_DIR ?? "data/golden-master/reports");
  await mkdir(reportRoot, { recursive: true });
  const safeName = manifest.nome.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-|-$/g, "") || "golden-master";
  const reportPath = resolve(reportRoot, `${safeName}.report.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return { report, reportPath };
}

export function inspectWorkbook(workbookPathInput: string) {
  const workbookPath = resolvePrivatePath(workbookPathInput);
  const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellText: true, cellDates: false });
  return workbook.SheetNames.map((nome) => {
    const sheet = workbook.Sheets[nome];
    const ref = sheet?.["!ref"] ?? null;
    const range = ref ? XLSX.utils.decode_range(ref) : null;
    const headerCandidatos: Array<{ row: number; values: string[] }> = [];
    if (sheet && range) {
      const lastProbeRow = Math.min(range.e.r, range.s.r + 19);
      for (let row = range.s.r; row <= lastProbeRow; row += 1) {
        const values: string[] = [];
        for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 24); col += 1) {
          const value = sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v;
          if (typeof value === "string" && value.trim()) values.push(value.trim());
        }
        if (values.length >= 2) headerCandidatos.push({ row: row + 1, values: values.slice(0, 12) });
      }
    }
    return {
      nome,
      ref,
      rows: range ? range.e.r - range.s.r + 1 : 0,
      columns: range ? range.e.c - range.s.c + 1 : 0,
      headerCandidatos: headerCandidatos.slice(0, 5)
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
    ["eventosEsperados", 6],
    ["quiQuadrado", 0],
    ["quiQuadradoP", 1],
    ["ksD", 0],
    ["pKs", 1],
    ["estatisticaZ", 0],
    ["pZ", 1],
    ["pFisher", 1],
    ["dqm", 0]
  ]);
  XLSX.utils.book_append_sheet(workbook, matrix, "BASE");
  XLSX.utils.book_append_sheet(workbook, summary, "SUMMARY");
  XLSX.writeFile(workbook, workbookPath);
  const manifest: GoldenMasterManifest = {
    nome: "synthetic-ci",
    workbook: workbookPath,
    alpha: 0.05,
    idadeDivisaoFisher: 21,
    matrix: {
      sheet: "BASE",
      startRow: 2,
      endRow: 4,
      ageColumn: "A",
      exposicaoColumn: "B",
      observadoColumn: "C",
      fixedSex: "UNISSEX"
    },
    candidatos: [{
      rotulo: "synthetic",
      esperadoColumn: "D",
      summary: {
        eventosEsperados: { sheet: "SUMMARY", cell: "B2" },
        quiQuadrado: { sheet: "SUMMARY", cell: "B3" },
        quiQuadradoP: { sheet: "SUMMARY", cell: "B4" },
        ksD: { sheet: "SUMMARY", cell: "B5" },
        pKs: { sheet: "SUMMARY", cell: "B6" },
        estatisticaZ: { sheet: "SUMMARY", cell: "B7" },
        pZ: { sheet: "SUMMARY", cell: "B8" },
        pFisher: { sheet: "SUMMARY", cell: "B9" },
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

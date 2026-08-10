import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";

const steps = ["Arquivo", "Estrutura", "Mapping", "Transformações", "Preview", "Validação", "Concluir"];

const canonicalFields = [
  ["participant.registration", "Matrícula"],
  ["participant.cpf", "CPF"],
  ["participant.name", "Nome"],
  ["participant.birthDate", "Data de nascimento"],
  ["participant.sex", "Sexo"],
  ["participant.admissionDate", "Data de admissão"],
  ["participant.planJoinDate", "Ingresso no plano"],
  ["participant.contributionSalary", "Salário de contribuição"],
  ["participant.sponsorCode", "Patrocinador"]
] as const;

type Transform = "auto" | "date-yyyymmdd" | "date-br" | "concat" | "sum" | "split-dash" | "sex";
type Rule = { id: number; sources: string[]; targets: string[]; transform: Transform };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function suggestTarget(header: string): string[] {
  const value = normalize(header);
  if (/MATRIC|REGISTRO|MATR$/.test(value)) return ["participant.registration"];
  if (/CPF/.test(value)) return ["participant.cpf"];
  if (/NOME/.test(value)) return ["participant.name"];
  if (/NASC/.test(value)) return ["participant.birthDate"];
  if (/SEXO|GENERO/.test(value)) return ["participant.sex"];
  if (/ADMIS/.test(value)) return ["participant.admissionDate"];
  if (/ING.*PLANO|ADESAO|DTPLANO/.test(value)) return ["participant.planJoinDate"];
  if (/SAL|REMUN|CONTRIB/.test(value)) return ["participant.contributionSalary"];
  if (/PATROC/.test(value)) return ["participant.sponsorCode"];
  return [];
}

function parsePtNumber(value: unknown) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim().replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function applyRule(rule: Rule, row: unknown[], headers: string[]) {
  const values = rule.sources.map((source) => row[headers.indexOf(source)] ?? "");
  const output: Record<string, unknown> = {};
  if (!rule.targets.length) return output;

  if (rule.transform === "split-dash") {
    const parts = String(values[0] ?? "").split("-");
    rule.targets.forEach((target, index) => { output[target] = parts[index]?.trim() ?? ""; });
    return output;
  }

  let value: unknown = values[0] ?? "";
  if (rule.transform === "concat") value = values.filter(Boolean).join(" ").trim();
  if (rule.transform === "sum") value = values.reduce<number>((total, item) => total + (parsePtNumber(item) ?? 0), 0);
  if (rule.transform === "date-yyyymmdd") {
    const digits = String(value).replace(/\D/g, "");
    value = digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : value;
  }
  if (rule.transform === "date-br") {
    const match = String(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (match) value = `${match[3].length === 2 ? `19${match[3]}` : match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  if (rule.transform === "sex") {
    const sex = normalize(String(value));
    value = ["M", "1", "MASC", "MASCULINO"].includes(sex) ? "MALE" : ["F", "2", "FEM", "FEMININO"].includes(sex) ? "FEMALE" : value;
  }
  if (rule.transform === "auto" && values.length > 1) value = values.filter(Boolean).join(" ").trim();

  output[rule.targets[0]] = value;
  return output;
}

export function ImportWizardPage({ onClose }: { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [matrix, setMatrix] = useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const rebuild = (allRows: unknown[][], headerNumber: number) => {
    const index = Math.max(0, headerNumber - 1);
    const nextHeaders = (allRows[index] ?? []).map((value, i) => String(value || `COL_${i + 1}`).trim());
    setHeaders(nextHeaders);
    setRows(allRows.slice(index + 1).filter((row) => row.some((value) => String(value ?? "").trim() !== "")));
    setRules(nextHeaders.map((header, indexRule) => ({ id: indexRule + 1, sources: [header], targets: suggestTarget(header), transform: /NASC|ADMIS|PLANO/.test(normalize(header)) ? "date-br" : /SEXO|GENERO/.test(normalize(header)) ? "sex" : "auto" })));
  };

  const readFile = async (file: File) => {
    setParseError(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const allRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
      setFileName(file.name);
      setSheetName(firstSheet);
      setMatrix(allRows);
      setHeaderRow(1);
      rebuild(allRows, 1);
      setActiveStep(1);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    }
  };

  const canonicalPreview = useMemo(() => rows.slice(0, 8).map((row) => Object.assign({}, ...rules.map((rule) => applyRule(rule, row, headers)))), [rows, rules, headers]);
  const mappedTargets = new Set(rules.flatMap((rule) => rule.targets));
  const required = ["participant.registration", "participant.birthDate", "participant.sex"];
  const missingRequired = required.filter((field) => !mappedTargets.has(field));

  const changeRule = (id: number, patch: Partial<Rule>) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));

  return <Stack spacing={3}>
    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
      <Button onClick={onClose} startIcon={<ArrowBackRounded />}>Voltar</Button>
      <Box><Typography variant="overline" color="text.secondary">Data Studio</Typography><Typography variant="h4">Importar massa cadastral</Typography></Box>
    </Box>

    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider" }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      {parseError && <Alert severity="error" sx={{ mb: 2 }}>{parseError}</Alert>}

      {activeStep === 0 && <Box sx={{ py: 8, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 3 }}>
        <UploadFileRounded sx={{ fontSize: 48, color: "primary.main", mb: 1.5 }} />
        <Typography variant="h6">Arraste ou escolha sua planilha</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>.xlsx, .xls ou .csv</Typography>
        <Button component="label" variant="contained">Escolher arquivo<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} /></Button>
      </Box>}

      {activeStep === 1 && <Stack spacing={3}>
        <Box><Typography variant="h6">Estrutura detectada</Typography><Typography color="text.secondary">Confirme onde os dados realmente começam.</Typography></Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
          <TextField label="Arquivo" value={fileName} slotProps={{ input: { readOnly: true } }} />
          <TextField label="Aba" value={sheetName} slotProps={{ input: { readOnly: true } }} />
          <TextField label="Linha do cabeçalho" type="number" value={headerRow} onChange={(event) => { const value = Math.max(1, Number(event.target.value)); setHeaderRow(value); rebuild(matrix, value); }} />
        </Box>
        <Alert severity="info">{headers.length} colunas e {rows.length} registros detectados.</Alert>
        <PreviewTable headers={headers.slice(0, 8)} rows={rows.slice(0, 5).map((row) => row.slice(0, 8))} />
      </Stack>}

      {activeStep === 2 && <Stack spacing={2.5}>
        <Box><Typography variant="h6">Casar origem com o modelo ATUAS</Typography><Typography color="text.secondary">Uma regra pode usar várias colunas de origem e produzir um ou vários campos canônicos.</Typography></Box>
        {rules.map((rule) => <Box key={rule.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.5fr 48px 1.5fr 1fr 42px" }, gap: 1.5, alignItems: "center" }}>
          <MultiSelect label="Origem" values={rule.sources} options={headers.map((value) => [value, value] as const)} onChange={(values) => changeRule(rule.id, { sources: values })} />
          <Typography sx={{ textAlign: "center", color: "text.secondary" }}>→</Typography>
          <MultiSelect label="Destino ATUAS" values={rule.targets} options={canonicalFields} onChange={(values) => changeRule(rule.id, { targets: values })} />
          <TransformSelect value={rule.transform} onChange={(transform) => changeRule(rule.id, { transform })} />
          <Button color="inherit" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))} sx={{ minWidth: 42, px: 0 }}><DeleteOutlineRounded /></Button>
        </Box>)}
        <Box><Button variant="outlined" onClick={() => setRules((current) => [...current, { id: Math.max(0, ...current.map((rule) => rule.id)) + 1, sources: [], targets: [], transform: "auto" }])}>Adicionar regra</Button></Box>
      </Stack>}

      {activeStep === 3 && <Stack spacing={2}>
        <Box><Typography variant="h6">Transformações</Typography><Typography color="text.secondary">As transformações ficam salvas no perfil e são reproduzíveis nas próximas avaliações.</Typography></Box>
        {rules.filter((rule) => rule.targets.length).map((rule) => <Paper key={rule.id} variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}><Box sx={{ flex: 1 }}><Typography fontWeight={700}>{rule.sources.join(" + ")} → {rule.targets.map((target) => canonicalFields.find(([key]) => key === target)?.[1] ?? target).join(" + ")}</Typography><Typography variant="body2" color="text.secondary">{rule.transform}</Typography></Box><TransformSelect value={rule.transform} onChange={(transform) => changeRule(rule.id, { transform })} /></Stack></Paper>)}
      </Stack>}

      {activeStep === 4 && <Stack spacing={2}>
        <Box><Typography variant="h6">Preview canônico</Typography><Typography color="text.secondary">O original permanece intacto; esta é a representação normalizada que seguirá para as críticas atuariais.</Typography></Box>
        <PreviewObjects rows={canonicalPreview} />
      </Stack>}

      {activeStep === 5 && <Stack spacing={2}>
        <Typography variant="h6">Validação pré-importação</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}><Stat label="Registros" value={rows.length} /><Stat label="Campos canônicos" value={mappedTargets.size} /><Stat label="Regras" value={rules.length} /></Box>
        {missingRequired.length ? <Alert severity="error">Campos obrigatórios ainda sem mapping: {missingRequired.map((field) => canonicalFields.find(([key]) => key === field)?.[1] ?? field).join(", ")}.</Alert> : <Alert severity="success">Mapping mínimo válido. A massa pode seguir para a crítica cadastral.</Alert>}
      </Stack>}

      {activeStep === 6 && <Stack spacing={2} alignItems="flex-start"><Chip color="success" label="Pronto para importar" /><Typography variant="h5">Perfil de mapping preparado</Typography><Typography color="text.secondary">{fileName} será convertido para o modelo canônico ATUAS com {rules.length} regras. Na persistência, RAW, NORMALIZED e CANONICAL ficarão rastreáveis.</Typography><Button variant="contained" onClick={onClose}>Concluir importação</Button></Stack>}

      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button disabled={activeStep === 0} onClick={() => setActiveStep((step) => Math.max(0, step - 1))} startIcon={<ArrowBackRounded />}>Anterior</Button>
        {activeStep < steps.length - 1 && <Button variant="contained" disabled={activeStep === 0 || (activeStep === 5 && missingRequired.length > 0)} onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))} endIcon={<ArrowForwardRounded />}>Continuar</Button>}
      </Box>
    </Paper>
  </Stack>;
}

function MultiSelect({ label, values, options, onChange }: { label: string; values: string[]; options: readonly (readonly [string, string])[]; onChange: (values: string[]) => void }) {
  return <FormControl fullWidth><InputLabel>{label}</InputLabel><Select multiple label={label} value={values} onChange={(event) => onChange(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)} renderValue={(selected) => selected.map((value) => options.find(([key]) => key === value)?.[1] ?? value).join(" + ")}>{options.map(([key, text]) => <MenuItem key={key} value={key}>{text}</MenuItem>)}</Select></FormControl>;
}

function TransformSelect({ value, onChange }: { value: Transform; onChange: (value: Transform) => void }) {
  return <FormControl fullWidth><InputLabel>Transformação</InputLabel><Select label="Transformação" value={value} onChange={(event) => onChange(event.target.value as Transform)}><MenuItem value="auto">Automática</MenuItem><MenuItem value="date-br">Data DD/MM/YYYY</MenuItem><MenuItem value="date-yyyymmdd">Data YYYYMMDD</MenuItem><MenuItem value="concat">Concatenar</MenuItem><MenuItem value="sum">Somar campos</MenuItem><MenuItem value="split-dash">Separar por hífen</MenuItem><MenuItem value="sex">Normalizar sexo</MenuItem></Select></FormControl>;
}

function PreviewTable({ headers, rows }: { headers: string[]; rows: unknown[][] }) {
  return <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow>{headers.map((header) => <TableCell key={header} sx={{ fontWeight: 700 }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((row, index) => <TableRow key={index}>{headers.map((_, column) => <TableCell key={column}>{String(row[column] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table></Box>;
}

function PreviewObjects({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow>{keys.map((key) => <TableCell key={key} sx={{ fontWeight: 700 }}>{canonicalFields.find(([field]) => field === key)?.[1] ?? key}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((row, index) => <TableRow key={index}>{keys.map((key) => <TableCell key={key}>{String(row[key] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table></Box>;
}

function Stat({ label, value }: { label: string; value: number }) { return <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h5">{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Paper>; }

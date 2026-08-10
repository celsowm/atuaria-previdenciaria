import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddRounded from "@mui/icons-material/AddRounded";
import AutoGraphRounded from "@mui/icons-material/AutoGraphRounded";
import FileUploadOutlined from "@mui/icons-material/FileUploadOutlined";
import { api, type BiometricPoint, type BiometricTableDetail, type BiometricTableSummary, type BiometricVersionPoints } from "../../api/client";

const kinds = ["Mortalidade geral", "Mortalidade de inválidos", "Entrada em invalidez", "Rotatividade", "Outro"];
const sexScopes = ["BOTH", "MALE", "FEMALE", "UNISEX"] as const;
const importSteps = ["Identificação", "Mapeamento", "Revisão"];

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim().replace(/%$/, "");
  if (!text) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSex(value: unknown, fallback: BiometricPoint["sex"]): BiometricPoint["sex"] | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return fallback;
  if (["M", "MALE", "MASC", "MASCULINO", "1"].includes(text)) return "MALE";
  if (["F", "FEMALE", "FEM", "FEMININO", "2"].includes(text)) return "FEMALE";
  if (["U", "UNISEX", "AMBOS", "BOTH"].includes(text)) return "UNISEX";
  return null;
}

export function BiometricTablesPage() {
  const [tables, setTables] = useState<BiometricTableSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BiometricTableDetail | null>(null);
  const [points, setPoints] = useState<BiometricVersionPoints | null>(null);
  const [comparePoints, setComparePoints] = useState<BiometricVersionPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deriveOpen, setDeriveOpen] = useState(false);

  const refreshTables = async (selectId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.biometricTables();
      setTables(result);
      const nextId = selectId ?? selectedId ?? result[0]?.id ?? null;
      setSelectedId(nextId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as tábuas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshTables(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setPoints(null);
      return;
    }
    void (async () => {
      try {
        const next = await api.biometricTable(selectedId);
        setDetail(next);
        const latest = next.versions[0];
        setPoints(latest ? await api.biometricVersionPoints(latest.id) : null);
        setComparePoints(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível abrir a tábua.");
      }
    })();
  }, [selectedId]);

  const selectVersion = async (versionId: string) => {
    setPoints(await api.biometricVersionPoints(versionId));
    setComparePoints(null);
  };

  const selectComparison = async (versionId: string) => {
    setComparePoints(versionId ? await api.biometricVersionPoints(versionId) : null);
  };

  return <Stack spacing={3}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} alignItems={{ sm: "center" }}>
      <Box>
        <Typography variant="overline" color="text.secondary">Hipóteses & Tábuas</Typography>
        <Typography variant="h4">Biblioteca biométrica</Typography>
        <Typography color="text.secondary" sx={{ mt: .75 }}>Tábuas e versões imutáveis, prontas para estudos de aderência e rodadas atuariais.</Typography>
      </Box>
      <Button variant="contained" startIcon={<FileUploadOutlined />} onClick={() => setImportOpen(true)}>Importar tábua</Button>
    </Stack>

    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "360px minmax(0, 1fr)" }, gap: 3 }}>
      <Paper variant="outlined" sx={{ overflow: "hidden", alignSelf: "start" }}>
        <Box sx={{ p: 2.25 }}><Typography fontWeight={750}>Tábuas cadastradas</Typography><Typography variant="body2" color="text.secondary">{tables.length} disponíveis</Typography></Box>
        <Divider />
        {loading && <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>}
        {!loading && tables.length === 0 && <Box sx={{ p: 3 }}><Typography color="text.secondary">Nenhuma tábua cadastrada. Importe a primeira versão a partir de XLSX, XLS ou CSV.</Typography></Box>}
        <Stack divider={<Divider />}>
          {tables.map((table) => <Button key={table.id} color="inherit" onClick={() => setSelectedId(table.id)} sx={{ borderRadius: 0, textAlign: "left", justifyContent: "flex-start", p: 2, bgcolor: selectedId === table.id ? "action.selected" : undefined }}>
            <Box sx={{ width: "100%" }}>
              <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center"><Typography fontWeight={750}>{table.name}</Typography><Chip size="small" label={table.latestVersion ?? "—"} /></Stack>
              <Typography variant="caption" color="text.secondary">{table.code} · {table.kind}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>{table.pointCount} pontos · idades {table.minAge ?? "—"}–{table.maxAge ?? "—"}</Typography>
            </Box>
          </Button>)}
        </Stack>
      </Paper>

      <Box>
        {!detail && !loading && <Paper variant="outlined" sx={{ p: 5, textAlign: "center" }}><AutoGraphRounded sx={{ fontSize: 44, color: "text.secondary" }} /><Typography variant="h6" sx={{ mt: 1 }}>Selecione uma tábua</Typography></Paper>}
        {detail && <Stack spacing={2.5}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
              <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h5">{detail.name}</Typography><Chip size="small" label={detail.kind} /></Stack><Typography color="text.secondary" sx={{ mt: .5 }}>{detail.code} · {detail.sexScope}{detail.source ? ` · ${detail.source}` : ""}</Typography>{detail.description && <Typography sx={{ mt: 1.5 }}>{detail.description}</Typography>}</Box>
              <Button variant="outlined" startIcon={<AddRounded />} disabled={!points} onClick={() => setDeriveOpen(true)}>Derivar versão</Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }} sx={{ mb: 2.5 }}>
              <Box><Typography variant="h6">Curva qx</Typography><Typography variant="body2" color="text.secondary">Selecione versões para inspecionar ou comparar.</Typography></Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ minWidth: { md: 420 } }}>
                <FormControl size="small" fullWidth><InputLabel>Versão</InputLabel><Select label="Versão" value={points?.version.id ?? ""} onChange={(event) => void selectVersion(event.target.value)}>{detail.versions.map((version) => <MenuItem key={version.id} value={version.id}>{version.version}</MenuItem>)}</Select></FormControl>
                <FormControl size="small" fullWidth><InputLabel>Comparar com</InputLabel><Select label="Comparar com" value={comparePoints?.version.id ?? ""} onChange={(event) => void selectComparison(event.target.value)}><MenuItem value="">Nenhuma</MenuItem>{detail.versions.filter((version) => version.id !== points?.version.id).map((version) => <MenuItem key={version.id} value={version.id}>{version.version}</MenuItem>)}</Select></FormControl>
              </Stack>
            </Stack>
            {points && <QxChart primary={points} secondary={comparePoints} />}
          </Paper>

          {points && <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Box sx={{ p: 2.5 }}><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={750}>{points.version.version}</Typography>{points.version.derivationType && <Chip size="small" label={points.version.derivationType} />}</Stack><Typography variant="body2" color="text.secondary">{points.version.pointCount} pontos · idades {points.version.minAge}–{points.version.maxAge}{points.version.parentVersionId ? " · versão derivada" : " · versão original"}</Typography></Box>
            <Divider />
            <Box sx={{ maxHeight: 360, overflow: "auto" }}><Table size="small" stickyHeader><TableHead><TableRow><TableCell>Idade</TableCell><TableCell>Sexo</TableCell><TableCell align="right">qx</TableCell></TableRow></TableHead><TableBody>{points.points.map((point) => <TableRow key={`${point.sex}-${point.age}`}><TableCell>{point.age}</TableCell><TableCell>{point.sex}</TableCell><TableCell align="right" sx={{ fontFamily: "monospace" }}>{point.qx.toPrecision(8)}</TableCell></TableRow>)}</TableBody></Table></Box>
          </Paper>}
        </Stack>}
      </Box>
    </Box>

    <ImportTableDialog open={importOpen} onClose={() => setImportOpen(false)} onCreated={async (id) => { setImportOpen(false); await refreshTables(id); }} />
    {detail && points && <DeriveDialog table={detail} parent={points} open={deriveOpen} onClose={() => setDeriveOpen(false)} onCreated={async () => { setDeriveOpen(false); const next = await api.biometricTable(detail.id); setDetail(next); const latest = next.versions[0]; setPoints(latest ? await api.biometricVersionPoints(latest.id) : null); await refreshTables(detail.id); }} />}
  </Stack>;
}

function ImportTableDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState(kinds[0]);
  const [sexScope, setSexScope] = useState<(typeof sexScopes)[number]>("BOTH");
  const [source, setSource] = useState("");
  const [version, setVersion] = useState("v1");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [ageColumn, setAgeColumn] = useState("");
  const [qxColumn, setQxColumn] = useState("");
  const [sexColumn, setSexColumn] = useState("");
  const [fixedSex, setFixedSex] = useState<BiometricPoint["sex"]>("UNISEX");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setStep(0); setCode(""); setName(""); setKind(kinds[0]); setSexScope("BOTH"); setSource(""); setVersion("v1"); setHeaders([]); setRows([]); setAgeColumn(""); setQxColumn(""); setSexColumn(""); setFixedSex("UNISEX"); setFileName(""); setError(null); };
  const close = () => { reset(); onClose(); };

  const readFile = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }).filter((row) => row.some((value) => String(value ?? "").trim()));
      const nextHeaders = (matrix[0] ?? []).map((value, index) => String(value || `COL_${index + 1}`).trim());
      setHeaders(nextHeaders);
      setRows(matrix.slice(1));
      setFileName(file.name);
      const normalized = nextHeaders.map((header) => header.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      setAgeColumn(nextHeaders[normalized.findIndex((header) => /IDADE|AGE/.test(header))] ?? nextHeaders[0] ?? "");
      setQxColumn(nextHeaders[normalized.findIndex((header) => /^QX$|PROB|MORT/.test(header))] ?? nextHeaders[1] ?? "");
      setSexColumn(nextHeaders[normalized.findIndex((header) => /SEXO|SEX|GENERO/.test(header))] ?? "");
      if (!code) setCode(file.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "-").toUpperCase());
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
      setStep(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ler o arquivo.");
    }
  };

  const parsed = useMemo(() => {
    if (!ageColumn || !qxColumn) return { points: [] as BiometricPoint[], errors: ["Selecione as colunas de idade e qx."] };
    const ageIndex = headers.indexOf(ageColumn);
    const qxIndex = headers.indexOf(qxColumn);
    const sexIndex = sexColumn ? headers.indexOf(sexColumn) : -1;
    const points: BiometricPoint[] = [];
    const errors: string[] = [];
    rows.forEach((row, index) => {
      const age = parseNumber(row[ageIndex]);
      const qx = parseNumber(row[qxIndex]);
      const sex = normalizeSex(sexIndex >= 0 ? row[sexIndex] : "", fixedSex);
      if (age === null || !Number.isInteger(age) || age < 0 || age > 130 || qx === null || qx < 0 || qx > 1 || !sex) {
        errors.push(`Linha ${index + 2}: idade, sexo ou qx inválido.`);
        return;
      }
      points.push({ age, sex, qx });
    });
    const unique = new Set(points.map((point) => `${point.sex}:${point.age}`));
    if (unique.size !== points.length) errors.push("Existem combinações duplicadas de sexo e idade.");
    return { points, errors };
  }, [headers, rows, ageColumn, qxColumn, sexColumn, fixedSex]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const result = await api.createBiometricTable({ code, name, kind, sexScope, source: source || undefined, version, points: parsed.points });
      await onCreated(result.id);
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a tábua.");
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={close} fullWidth maxWidth="md">
    <DialogTitle>Importar tábua biométrica</DialogTitle>
    <DialogContent>
      <Stepper activeStep={step} alternativeLabel sx={{ my: 2 }}>{importSteps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {step === 0 && <Stack spacing={2.25} sx={{ pt: 1 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" }, gap: 2 }}><TextField label="Código" value={code} onChange={(event) => setCode(event.target.value)} /><TextField label="Nome" value={name} onChange={(event) => setName(event.target.value)} /></Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" }, gap: 2 }}><FormControl><InputLabel>Tipo</InputLabel><Select label="Tipo" value={kind} onChange={(event) => setKind(event.target.value)}>{kinds.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl><FormControl><InputLabel>Sexo</InputLabel><Select label="Sexo" value={sexScope} onChange={(event) => setSexScope(event.target.value as typeof sexScope)}>{sexScopes.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl><TextField label="Versão" value={version} onChange={(event) => setVersion(event.target.value)} /></Box>
        <TextField label="Fonte" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Documento, instituição ou referência da tábua" />
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderStyle: "dashed" }}><FileUploadOutlined sx={{ fontSize: 40, color: "text.secondary" }} /><Typography fontWeight={700} sx={{ mt: 1 }}>Carregue XLSX, XLS ou CSV</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>A primeira linha deve conter os cabeçalhos.</Typography><Button component="label" variant="outlined">Escolher arquivo<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} /></Button>{fileName && <Typography variant="caption" display="block" sx={{ mt: 1 }}>{fileName}</Typography>}</Paper>
      </Stack>}
      {step === 1 && <Stack spacing={2.5} sx={{ pt: 1 }}>
        <Alert severity="info">{rows.length} linhas e {headers.length} colunas detectadas em {fileName}.</Alert>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}><ColumnSelect label="Idade" value={ageColumn} headers={headers} onChange={setAgeColumn} /><ColumnSelect label="qx" value={qxColumn} headers={headers} onChange={setQxColumn} /><ColumnSelect label="Sexo (opcional)" value={sexColumn} headers={headers} onChange={setSexColumn} allowEmpty /></Box>
        {!sexColumn && <FormControl sx={{ maxWidth: 240 }}><InputLabel>Sexo fixo</InputLabel><Select label="Sexo fixo" value={fixedSex} onChange={(event) => setFixedSex(event.target.value as BiometricPoint["sex"])}><MenuItem value="UNISEX">UNISEX</MenuItem><MenuItem value="MALE">MALE</MenuItem><MenuItem value="FEMALE">FEMALE</MenuItem></Select></FormControl>}
        <PreviewRaw headers={headers.slice(0, 6)} rows={rows.slice(0, 5).map((row) => row.slice(0, 6))} />
      </Stack>}
      {step === 2 && <Stack spacing={2} sx={{ pt: 1 }}>
        {parsed.errors.length ? <Alert severity="error">{parsed.errors.slice(0, 4).join(" ")}{parsed.errors.length > 4 ? ` + ${parsed.errors.length - 4} problemas.` : ""}</Alert> : <Alert severity="success">{parsed.points.length} pontos válidos. A versão será persistida como snapshot imutável.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}><MiniStat label="Pontos" value={parsed.points.length} /><MiniStat label="Idade mínima" value={parsed.points.length ? Math.min(...parsed.points.map((point) => point.age)) : "—"} /><MiniStat label="Idade máxima" value={parsed.points.length ? Math.max(...parsed.points.map((point) => point.age)) : "—"} /></Box>
        <Table size="small"><TableHead><TableRow><TableCell>Idade</TableCell><TableCell>Sexo</TableCell><TableCell align="right">qx</TableCell></TableRow></TableHead><TableBody>{parsed.points.slice(0, 10).map((point) => <TableRow key={`${point.sex}-${point.age}`}><TableCell>{point.age}</TableCell><TableCell>{point.sex}</TableCell><TableCell align="right" sx={{ fontFamily: "monospace" }}>{point.qx}</TableCell></TableRow>)}</TableBody></Table>
      </Stack>}
    </DialogContent>
    <DialogActions><Button onClick={close}>Cancelar</Button>{step > 0 && <Button onClick={() => setStep((value) => value - 1)}>Anterior</Button>}{step < 2 ? <Button variant="contained" disabled={step === 0 || !headers.length} onClick={() => setStep((value) => value + 1)}>Continuar</Button> : <Button variant="contained" disabled={saving || parsed.errors.length > 0 || !code.trim() || !name.trim()} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar tábua"}</Button>}</DialogActions>
  </Dialog>;
}

function DeriveDialog({ table, parent, open, onClose, onCreated }: { table: BiometricTableDetail; parent: BiometricVersionPoints; open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const [version, setVersion] = useState("");
  const [transform, setTransform] = useState<"QX_SCALE" | "AGE_SHIFT">("QX_SCALE");
  const [factor, setFactor] = useState("0.9");
  const [years, setYears] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setError(null);
    try {
      await api.deriveBiometricVersion(table.id, { parentVersionId: parent.version.id, version, transform, factor: transform === "QX_SCALE" ? Number(factor) : undefined, years: transform === "AGE_SHIFT" ? Number(years) : undefined });
      setVersion(""); await onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível derivar a versão."); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Derivar de {parent.version.version}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<TextField label="Nova versão" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="ex.: v2 / -10% / deslocada +1" /><FormControl><InputLabel>Transformação</InputLabel><Select label="Transformação" value={transform} onChange={(event) => setTransform(event.target.value as typeof transform)}><MenuItem value="QX_SCALE">Escalar qx</MenuItem><MenuItem value="AGE_SHIFT">Deslocar idade</MenuItem></Select></FormControl>{transform === "QX_SCALE" ? <TextField label="Fator" type="number" value={factor} onChange={(event) => setFactor(event.target.value)} helperText="0,90 equivale a reduzir todos os qx em 10%." /> : <TextField label="Anos" type="number" value={years} onChange={(event) => setYears(event.target.value)} helperText="A nova qx(x) usa a qx da idade x + deslocamento na versão de origem." />}<Alert severity="info">A versão original nunca é alterada. O ATUAS grava a versão-mãe, transformação, parâmetros e todos os pontos resultantes.</Alert></Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancelar</Button><Button variant="contained" disabled={saving || !version.trim()} onClick={() => void save()}>{saving ? "Derivando…" : "Criar versão"}</Button></DialogActions></Dialog>;
}

function ColumnSelect({ label, value, headers, onChange, allowEmpty = false }: { label: string; value: string; headers: string[]; onChange: (value: string) => void; allowEmpty?: boolean }) {
  return <FormControl><InputLabel>{label}</InputLabel><Select label={label} value={value} onChange={(event) => onChange(event.target.value)}>{allowEmpty && <MenuItem value="">Nenhuma</MenuItem>}{headers.map((header) => <MenuItem key={header} value={header}>{header}</MenuItem>)}</Select></FormControl>;
}

function PreviewRaw({ headers, rows }: { headers: string[]; rows: unknown[][] }) {
  return <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow>{headers.map((header) => <TableCell key={header}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((row, index) => <TableRow key={index}>{headers.map((_, column) => <TableCell key={column}>{String(row[column] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table></Box>;
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6">{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Paper>;
}

function QxChart({ primary, secondary }: { primary: BiometricVersionPoints; secondary: BiometricVersionPoints | null }) {
  const series = [primary, ...(secondary ? [secondary] : [])];
  const all = series.flatMap((bundle) => bundle.points);
  if (!all.length) return <Alert severity="info">Esta versão não possui pontos.</Alert>;
  const minAge = Math.min(...all.map((point) => point.age));
  const maxAge = Math.max(...all.map((point) => point.age));
  const maxQx = Math.max(...all.map((point) => point.qx), 0.000001);
  const width = 900, height = 300, left = 54, right = 18, top = 18, bottom = 38;
  const x = (age: number) => left + ((age - minAge) / Math.max(1, maxAge - minAge)) * (width - left - right);
  const y = (qx: number) => top + (1 - qx / maxQx) * (height - top - bottom);
  const pathFor = (bundle: BiometricVersionPoints, sex: string) => bundle.points.filter((point) => point.sex === sex).sort((a, b) => a.age - b.age).map((point, index) => `${index ? "L" : "M"}${x(point.age).toFixed(1)},${y(point.qx).toFixed(1)}`).join(" ");
  const sexes = Array.from(new Set(primary.points.map((point) => point.sex)));
  return <Box><Box sx={{ width: "100%", overflowX: "auto", color: "primary.main" }}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Curva qx por idade" style={{ width: "100%", minWidth: 620, display: "block" }}><line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="currentColor" opacity=".22"/><line x1={left} y1={top} x2={left} y2={height - bottom} stroke="currentColor" opacity=".22"/>{[0,.25,.5,.75,1].map((ratio) => <g key={ratio}><line x1={left} y1={top + ratio * (height-top-bottom)} x2={width-right} y2={top + ratio * (height-top-bottom)} stroke="currentColor" opacity=".08"/><text x={left-8} y={top + ratio * (height-top-bottom)+4} textAnchor="end" fontSize="11" fill="currentColor" opacity=".65">{(maxQx*(1-ratio)).toPrecision(3)}</text></g>)}<text x={left} y={height-12} fontSize="11" fill="currentColor" opacity=".65">{minAge}</text><text x={width-right} y={height-12} textAnchor="end" fontSize="11" fill="currentColor" opacity=".65">{maxAge}</text>{series.flatMap((bundle, bundleIndex) => sexes.map((sex, sexIndex) => { const d = pathFor(bundle, sex); return d ? <path key={`${bundle.version.id}-${sex}`} d={d} fill="none" stroke="currentColor" strokeWidth={bundleIndex === 0 ? 2.2 : 1.7} opacity={bundleIndex === 0 ? 1 - sexIndex*.22 : .38 - sexIndex*.08} strokeDasharray={bundleIndex === 0 ? undefined : "7 5"}/> : null; }))}</svg></Box><Stack direction="row" spacing={2} sx={{ mt: 1 }}><Typography variant="caption"><strong>{primary.version.version}</strong> — linha contínua</Typography>{secondary && <Typography variant="caption" color="text.secondary"><strong>{secondary.version.version}</strong> — tracejada</Typography>}</Stack></Box>;
}

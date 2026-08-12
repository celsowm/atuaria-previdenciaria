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
import AnalyticsOutlined from "@mui/icons-material/AnalyticsOutlined";
import FileUploadOutlined from "@mui/icons-material/FileUploadOutlined";
import {
  api,
  type AdherenceCandidatePoints,
  type AdherenceCandidateResult,
  type AdherenceObservation,
  type AdherenceStudyDetail,
  type AdherenceStudySummary,
  type BiometricTableDetail
} from "../../api/client";

const studySteps = ["Estudo", "Base histórica", "Tábuas", "Executar"];
const hypothesisTypes = ["Mortalidade geral", "Mortalidade de inválidos", "Entrada em invalidez", "Rotatividade", "Outro"];
const sexScopes = ["BOTH", "MALE", "FEMALE", "UNISEX"] as const;

type VersionOption = { id: string; label: string; table: string };

type MappedHistorical = {
  observations: AdherenceObservation[];
  errors: string[];
};

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim();
  if (!text) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSex(value: unknown, fallback: AdherenceObservation["sex"]): AdherenceObservation["sex"] | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return fallback;
  if (["M", "MALE", "MASC", "MASCULINO", "1"].includes(text)) return "MALE";
  if (["F", "FEMALE", "FEM", "FEMININO", "2"].includes(text)) return "FEMALE";
  if (["U", "UNISEX", "AMBOS", "BOTH"].includes(text)) return "UNISEX";
  return null;
}

function fmt(value: number, digits = 4) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) > 0 && Math.abs(value) < 0.0001) return value.toExponential(2);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function testChip(pass: boolean, p: number) {
  return <Chip size="small" color={pass ? "success" : "error"} variant={pass ? "outlined" : "filled"} label={`p ${fmt(p, 5)}`} />;
}

export function AdherenceStudiesPage() {
  const [studies, setStudies] = useState<AdherenceStudySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdherenceStudyDetail | null>(null);
  const [candidatePoints, setCandidatePoints] = useState<AdherenceCandidatePoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = async (preferredId?: string) => {
    setLoading(true);
    try {
      const result = await api.adherenceStudies();
      setStudies(result);
      setSelectedId(preferredId ?? selectedId ?? result[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os estudos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setCandidatePoints(null);
      return;
    }
    void (async () => {
      try {
        const next = await api.adherenceStudy(selectedId);
        setDetail(next);
        const winner = next.candidates[0];
        setCandidatePoints(winner ? await api.adherenceCandidatePoints(winner.id) : null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível abrir o estudo.");
      }
    })();
  }, [selectedId]);

  const openCandidate = async (candidate: AdherenceCandidateResult) => {
    try {
      setCandidatePoints(await api.adherenceCandidatePoints(candidate.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir o detalhamento da tábua.");
    }
  };

  return <Stack spacing={3}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} alignItems={{ sm: "center" }}>
      <Box>
        <Typography variant="overline" color="text.secondary">Hypothesis Lab</Typography>
        <Typography variant="h4">Estudos de aderência</Typography>
        <Typography color="text.secondary" sx={{ mt: .75 }}>Exposição, eventos observados, tábuas candidatas e testes estatísticos reproduzíveis.</Typography>
      </Box>
      <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>Novo estudo</Button>
    </Stack>

    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "340px minmax(0, 1fr)" }, gap: 3 }}>
      <Paper variant="outlined" sx={{ alignSelf: "start", overflow: "hidden" }}>
        <Box sx={{ p: 2.25 }}><Typography fontWeight={750}>Histórico de estudos</Typography><Typography variant="body2" color="text.secondary">{studies.length} execuções persistidas</Typography></Box>
        <Divider />
        {loading && <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>}
        {!loading && studies.length === 0 && <Box sx={{ p: 3 }}><Typography color="text.secondary">Nenhum estudo ainda. Crie o primeiro usando a base histórica de exposição e eventos.</Typography></Box>}
        <Stack divider={<Divider />}>
          {studies.map((study) => <Button key={study.id} color="inherit" onClick={() => setSelectedId(study.id)} sx={{ p: 2, borderRadius: 0, justifyContent: "flex-start", textAlign: "left", bgcolor: selectedId === study.id ? "action.selected" : undefined }}>
            <Box sx={{ width: "100%" }}>
              <Typography fontWeight={750}>{study.name}</Typography>
              <Typography variant="caption" color="text.secondary">{study.hypothesisType} · {study.periodStart}–{study.periodEnd}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}><Chip size="small" label={`${study.candidateCount} tábuas`} /><Chip size="small" variant="outlined" label={study.engineVersion} /></Stack>
            </Box>
          </Button>)}
        </Stack>
      </Paper>

      <Box>
        {!detail && !loading && <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}><AnalyticsOutlined sx={{ fontSize: 48, color: "text.secondary" }} /><Typography variant="h6" sx={{ mt: 1 }}>Selecione ou crie um estudo</Typography></Paper>}
        {detail && <Stack spacing={2.5}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
              <Box><Typography variant="h5">{detail.name}</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>{detail.hypothesisType} · {detail.periodStart}–{detail.periodEnd} · α {detail.alpha}</Typography></Box>
              <Stack direction="row" spacing={1}><Chip label={detail.sexScope} /><Chip variant="outlined" label={detail.engineVersion} /></Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Box sx={{ p: 2.5 }}><Typography variant="h6">Ranking das tábuas</Typography><Typography variant="body2" color="text.secondary">Ordenação: menor número de testes rejeitados, menor DQM e maior p-value do χ².</Typography></Box>
            <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Rank</TableCell><TableCell>Tábua</TableCell><TableCell align="right">Obs.</TableCell><TableCell align="right">Esp.</TableCell><TableCell>χ²</TableCell><TableCell>KS</TableCell><TableCell>Z</TableCell><TableCell>Fisher</TableCell><TableCell align="right">DQM</TableCell></TableRow></TableHead><TableBody>{detail.candidates.map((candidate) => <TableRow key={candidate.id} hover selected={candidatePoints?.candidate.id === candidate.id} onClick={() => void openCandidate(candidate)} sx={{ cursor: "pointer" }}><TableCell><Chip size="small" color={candidate.rank === 1 ? "primary" : "default"} label={`#${candidate.rank}`} /></TableCell><TableCell><Typography variant="body2" fontWeight={700}>{candidate.tableName}</Typography><Typography variant="caption" color="text.secondary">{candidate.tableCode} · {candidate.versionLabel}</Typography></TableCell><TableCell align="right">{fmt(candidate.observedEvents, 2)}</TableCell><TableCell align="right">{fmt(candidate.expectedEvents, 2)}</TableCell><TableCell>{testChip(candidate.chiSquarePass, candidate.chiSquareP)}</TableCell><TableCell>{testChip(candidate.ksPass, candidate.ksP)}</TableCell><TableCell>{testChip(candidate.zPass, candidate.zP)}</TableCell><TableCell>{testChip(candidate.fisherPass, candidate.fisherP)}</TableCell><TableCell align="right" sx={{ fontFamily: "monospace" }}>{fmt(candidate.dqm, 8)}</TableCell></TableRow>)}</TableBody></Table></Box>
          </Paper>

          {candidatePoints && <CandidateDetail bundle={candidatePoints} />}
        </Stack>}
      </Box>
    </Box>

    <CreateStudyDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={async (id) => { setCreateOpen(false); await refresh(id); }} />
  </Stack>;
}

function CandidateDetail({ bundle }: { bundle: AdherenceCandidatePoints }) {
  const candidate = bundle.candidate;
  return <Paper variant="outlined" sx={{ p: 3 }}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2.5 }}>
      <Box><Typography variant="h6">Observado × esperado — {candidate.tableName} {candidate.versionLabel}</Typography><Typography variant="body2" color="text.secondary">Clique em outra linha do ranking para trocar a curva.</Typography></Box>
      <Chip color={candidate.rejectedTests === 0 ? "success" : "warning"} label={candidate.rejectedTests === 0 ? "Nenhum teste rejeitado" : `${candidate.rejectedTests} teste(s) rejeitado(s)`} />
    </Stack>
    <ObservedExpectedChart points={bundle.points} />
    <Box sx={{ maxHeight: 320, overflow: "auto", mt: 2 }}><Table size="small" stickyHeader><TableHead><TableRow><TableCell>Idade</TableCell><TableCell>Sexo</TableCell><TableCell align="right">Exposição</TableCell><TableCell align="right">Observado</TableCell><TableCell align="right">qx</TableCell><TableCell align="right">Esperado</TableCell><TableCell align="right">Resíduo</TableCell></TableRow></TableHead><TableBody>{bundle.points.map((point) => <TableRow key={`${point.sex}-${point.age}`}><TableCell>{point.age}</TableCell><TableCell>{point.sex}</TableCell><TableCell align="right">{fmt(point.exposure, 2)}</TableCell><TableCell align="right">{point.observedEvents}</TableCell><TableCell align="right" sx={{ fontFamily: "monospace" }}>{fmt(point.qx, 8)}</TableCell><TableCell align="right">{fmt(point.expectedEvents, 4)}</TableCell><TableCell align="right">{fmt(point.residual, 4)}</TableCell></TableRow>)}</TableBody></Table></Box>
  </Paper>;
}

function ObservedExpectedChart({ points }: { points: AdherenceCandidatePoints["points"] }) {
  if (!points.length) return <Alert severity="info">Sem pontos para exibir.</Alert>;
  const aggregated = new Map<number, { observed: number; expected: number }>();
  for (const point of points) {
    const current = aggregated.get(point.age) ?? { observed: 0, expected: 0 };
    current.observed += point.observedEvents;
    current.expected += point.expectedEvents;
    aggregated.set(point.age, current);
  }
  const data = [...aggregated.entries()].sort((a, b) => a[0] - b[0]);
  const width = 900, height = 290, left = 48, right = 16, top = 16, bottom = 36;
  const minAge = data[0][0], maxAge = data[data.length - 1][0];
  const maxY = Math.max(1, ...data.flatMap(([, value]) => [value.observed, value.expected]));
  const x = (age: number) => left + ((age - minAge) / Math.max(1, maxAge - minAge)) * (width - left - right);
  const y = (value: number) => top + (1 - value / maxY) * (height - top - bottom);
  const path = (key: "observed" | "expected") => data.map(([age, value], index) => `${index ? "L" : "M"}${x(age).toFixed(1)},${y(value[key]).toFixed(1)}`).join(" ");
  return <Box sx={{ overflowX: "auto", color: "primary.main" }}><svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 620, display: "block" }} role="img" aria-label="Eventos observados e esperados por idade"><line x1={left} y1={height-bottom} x2={width-right} y2={height-bottom} stroke="currentColor" opacity=".2"/><line x1={left} y1={top} x2={left} y2={height-bottom} stroke="currentColor" opacity=".2"/><path d={path("observed")} fill="none" stroke="currentColor" strokeWidth="2.4"/><path d={path("expected")} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="7 5" opacity=".55"/><text x={left} y={height-10} fontSize="11" fill="currentColor" opacity=".65">{minAge}</text><text x={width-right} y={height-10} textAnchor="end" fontSize="11" fill="currentColor" opacity=".65">{maxAge}</text></svg><Stack direction="row" spacing={2}><Typography variant="caption"><strong>Observado</strong> — contínua</Typography><Typography variant="caption" color="text.secondary"><strong>Esperado</strong> — tracejada</Typography></Stack></Box>;
}

function CreateStudyDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [hypothesisType, setHypothesisType] = useState(hypothesisTypes[0]);
  const [periodStart, setPeriodStart] = useState(new Date().getFullYear() - 5);
  const [periodEnd, setPeriodEnd] = useState(new Date().getFullYear() - 1);
  const [sexScope, setSexScope] = useState<(typeof sexScopes)[number]>("BOTH");
  const [alpha, setAlpha] = useState("0.05");
  const [fisherSplitAge, setFisherSplitAge] = useState("70");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [fileName, setFileName] = useState("");
  const [yearColumn, setYearColumn] = useState("");
  const [ageColumn, setAgeColumn] = useState("");
  const [sexColumn, setSexColumn] = useState("");
  const [exposureColumn, setExposureColumn] = useState("");
  const [observedColumn, setObservedColumn] = useState("");
  const [fixedSex, setFixedSex] = useState<AdherenceObservation["sex"]>("UNISEX");
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const summaries = await api.biometricTables();
        const details = await Promise.all(summaries.map((table) => api.biometricTable(table.id)));
        setVersions(details.flatMap((table: BiometricTableDetail) => table.versions.map((version) => ({ id: version.id, label: `${table.name} · ${version.version}`, table: table.code }))));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar as tábuas candidatas.");
      }
    })();
  }, [open]);

  const reset = () => {
    setStep(0); setName(""); setHypothesisType(hypothesisTypes[0]); setPeriodStart(new Date().getFullYear() - 5); setPeriodEnd(new Date().getFullYear() - 1); setSexScope("BOTH"); setAlpha("0.05"); setFisherSplitAge("70"); setHeaders([]); setRows([]); setFileName(""); setYearColumn(""); setAgeColumn(""); setSexColumn(""); setExposureColumn(""); setObservedColumn(""); setFixedSex("UNISEX"); setSelectedVersions([]); setError(null);
  };
  const close = () => { reset(); onClose(); };

  const readFile = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }).filter((row) => row.some((value) => String(value ?? "").trim()));
      const nextHeaders = (matrix[0] ?? []).map((value, index) => String(value || `COL_${index + 1}`).trim());
      const normalized = nextHeaders.map((header) => header.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, ""));
      const find = (pattern: RegExp, fallback = "") => nextHeaders[normalized.findIndex((header) => pattern.test(header))] ?? fallback;
      setHeaders(nextHeaders); setRows(matrix.slice(1)); setFileName(file.name);
      setYearColumn(find(/ANO|YEAR/, nextHeaders[0] ?? ""));
      setAgeColumn(find(/IDADE|AGE/, nextHeaders[1] ?? ""));
      setSexColumn(find(/SEXO|SEX|GENERO/));
      setExposureColumn(find(/EXPOS|POPUL|VIVOS|ALIVE/, nextHeaders[2] ?? ""));
      setObservedColumn(find(/OBITO|MORTE|EVENT|OBSERV|DEATH/, nextHeaders[3] ?? ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ler a base histórica.");
    }
  };

  const mapped = useMemo<MappedHistorical>(() => {
    if (!headers.length || !yearColumn || !ageColumn || !exposureColumn || !observedColumn) return { observations: [], errors: ["Mapeie ano, idade, exposição e eventos observados."] };
    const indexes = { year: headers.indexOf(yearColumn), age: headers.indexOf(ageColumn), exposure: headers.indexOf(exposureColumn), observed: headers.indexOf(observedColumn), sex: sexColumn ? headers.indexOf(sexColumn) : -1 };
    const observations: AdherenceObservation[] = [];
    const errors: string[] = [];
    rows.forEach((row, index) => {
      const year = parseNumber(row[indexes.year]);
      const age = parseNumber(row[indexes.age]);
      const exposure = parseNumber(row[indexes.exposure]);
      const observed = parseNumber(row[indexes.observed]);
      const sex = normalizeSex(indexes.sex >= 0 ? row[indexes.sex] : "", fixedSex);
      if (year === null || !Number.isInteger(year) || age === null || !Number.isInteger(age) || exposure === null || exposure <= 0 || observed === null || !Number.isInteger(observed) || observed < 0 || !sex) {
        errors.push(`Linha ${index + 2}: ano, idade, sexo, exposição ou eventos inválidos.`);
        return;
      }
      if (year < periodStart || year > periodEnd) {
        errors.push(`Linha ${index + 2}: ano ${year} fora do período ${periodStart}–${periodEnd}.`);
        return;
      }
      if (sexScope !== "BOTH" && sex !== sexScope) {
        errors.push(`Linha ${index + 2}: sexo ${sex} fora do escopo ${sexScope}.`);
        return;
      }
      observations.push({ year, age, sex, exposure, observedEvents: observed });
    });
    return { observations, errors };
  }, [headers, rows, yearColumn, ageColumn, sexColumn, exposureColumn, observedColumn, fixedSex, periodStart, periodEnd, sexScope]);

  const execute = async () => {
    setSaving(true); setError(null);
    try {
      const result = await api.createAdherenceStudy({
        name: name.trim(), hypothesisType, periodStart, periodEnd, sexScope,
        alpha: Number(alpha), fisherSplitAge: Number(fisherSplitAge), candidateVersionIds: selectedVersions, observations: mapped.observations
      });
      await onCreated(result.id); reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar o estudo.");
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={close} fullWidth maxWidth="lg">
    <DialogTitle>Novo estudo de aderência</DialogTitle>
    <DialogContent>
      <Stepper activeStep={step} alternativeLabel sx={{ my: 2 }}>{studySteps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {step === 0 && <Stack spacing={2.25} sx={{ pt: 1 }}>
        <TextField label="Nome do estudo" value={name} onChange={(event) => setName(event.target.value)} placeholder="Mortalidade geral 2021–2025" />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 1fr" }, gap: 2 }}><FormControl><InputLabel>Hipótese</InputLabel><Select label="Hipótese" value={hypothesisType} onChange={(event) => setHypothesisType(event.target.value)}>{hypothesisTypes.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl><TextField label="Ano inicial" type="number" value={periodStart} onChange={(event) => setPeriodStart(Number(event.target.value))} /><TextField label="Ano final" type="number" value={periodEnd} onChange={(event) => setPeriodEnd(Number(event.target.value))} /><FormControl><InputLabel>Sexo</InputLabel><Select label="Sexo" value={sexScope} onChange={(event) => setSexScope(event.target.value as typeof sexScope)}>{sexScopes.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl></Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}><TextField label="Significância α" type="number" value={alpha} onChange={(event) => setAlpha(event.target.value)} helperText="Ex.: 0,05 para 5%." /><TextField label="Idade de corte Fisher" type="number" value={fisherSplitAge} onChange={(event) => setFisherSplitAge(event.target.value)} helperText="Compara alocação de eventos abaixo/acima do corte." /></Box>
      </Stack>}
      {step === 1 && <Stack spacing={2.25} sx={{ pt: 1 }}>
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}><FileUploadOutlined sx={{ fontSize: 38, color: "text.secondary" }} /><Typography fontWeight={700} sx={{ mt: 1 }}>Base histórica XLSX / CSV</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Uma linha por ano, idade e sexo, com exposição e eventos observados.</Typography><Button component="label" variant="outlined">Escolher arquivo<input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} /></Button>{fileName && <Typography variant="caption" display="block" sx={{ mt: 1 }}>{fileName}</Typography>}</Paper>
        {headers.length > 0 && <><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" }, gap: 1.5 }}><ColumnSelect label="Ano" value={yearColumn} headers={headers} onChange={setYearColumn} /><ColumnSelect label="Idade" value={ageColumn} headers={headers} onChange={setAgeColumn} /><ColumnSelect label="Sexo" value={sexColumn} headers={headers} onChange={setSexColumn} allowEmpty /><ColumnSelect label="Exposição" value={exposureColumn} headers={headers} onChange={setExposureColumn} /><ColumnSelect label="Eventos" value={observedColumn} headers={headers} onChange={setObservedColumn} /></Box>{!sexColumn && <FormControl sx={{ maxWidth: 240 }}><InputLabel>Sexo fixo</InputLabel><Select label="Sexo fixo" value={fixedSex} onChange={(event) => setFixedSex(event.target.value as AdherenceObservation["sex"])}><MenuItem value="UNISEX">UNISEX</MenuItem><MenuItem value="MALE">MALE</MenuItem><MenuItem value="FEMALE">FEMALE</MenuItem></Select></FormControl>}<Alert severity={mapped.errors.length ? "warning" : "success"}>{mapped.observations.length} observações válidas{mapped.errors.length ? `; ${mapped.errors.length} linha(s) precisam de revisão.` : "."}</Alert></>}
      </Stack>}
      {step === 2 && <Stack spacing={2.25} sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary">Escolha uma ou mais versões imutáveis da Biblioteca Biométrica. O estudo grava exatamente os IDs usados.</Typography>
        <FormControl fullWidth><InputLabel>Tábuas candidatas</InputLabel><Select multiple label="Tábuas candidatas" value={selectedVersions} onChange={(event) => setSelectedVersions(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)} renderValue={(selected) => selected.map((id) => versions.find((item) => item.id === id)?.label ?? id).join(", ")}>{versions.map((option) => <MenuItem key={option.id} value={option.id}>{option.label} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{option.table}</Typography></MenuItem>)}</Select></FormControl>
        {versions.length === 0 && <Alert severity="warning">Nenhuma versão biométrica disponível. Importe tábuas em Hipóteses & Tábuas primeiro.</Alert>}
      </Stack>}
      {step === 3 && <Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity={mapped.errors.length ? "error" : "info"}>{mapped.errors.length ? `Existem ${mapped.errors.length} erros na base histórica.` : "O cálculo será executado no backend e todos os resultados serão persistidos."}</Alert>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}><MiniStat label="Observações" value={mapped.observations.length} /><MiniStat label="Candidatas" value={selectedVersions.length} /><MiniStat label="Alpha" value={alpha} /><MiniStat label="Fisher split" value={fisherSplitAge} /></Box>
        <Typography variant="body2" color="text.secondary">Serão calculados χ², Kolmogorov-Smirnov, Z, Fisher e DQM. O ranking não substitui a análise técnica; ele apenas ordena os resultados persistidos.</Typography>
      </Stack>}
    </DialogContent>
    <DialogActions><Button onClick={close}>Cancelar</Button>{step > 0 && <Button disabled={saving} onClick={() => setStep((value) => value - 1)}>Anterior</Button>}{step < 3 ? <Button variant="contained" disabled={(step === 0 && (!name.trim() || periodStart > periodEnd)) || (step === 1 && (!headers.length || !mapped.observations.length)) || (step === 2 && !selectedVersions.length)} onClick={() => setStep((value) => value + 1)}>Continuar</Button> : <Button variant="contained" disabled={saving || mapped.errors.length > 0 || !mapped.observations.length || !selectedVersions.length} onClick={() => void execute()}>{saving ? "Calculando…" : "Executar estudo"}</Button>}</DialogActions>
  </Dialog>;
}

function ColumnSelect({ label, value, headers, onChange, allowEmpty = false }: { label: string; value: string; headers: string[]; onChange: (value: string) => void; allowEmpty?: boolean }) {
  return <FormControl fullWidth><InputLabel>{label}</InputLabel><Select label={label} value={value} onChange={(event) => onChange(event.target.value)}>{allowEmpty && <MenuItem value="">Nenhuma</MenuItem>}{headers.map((header) => <MenuItem key={header} value={header}>{header}</MenuItem>)}</Select></FormControl>;
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6">{value}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Paper>;
}

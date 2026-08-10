import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import { api, type CritiqueIssue, type CritiqueIssueDetail, type CritiqueRun } from "../../api/client";

type Props = {
  importJobId: string;
  onBack: () => void;
};

function severityColor(severity: string): "error" | "warning" | "info" | "default" {
  if (severity === "BLOCKING") return "error";
  if (severity === "INCONSISTENCY" || severity === "WARNING") return "warning";
  if (severity === "INFO") return "info";
  return "default";
}

function severityLabel(severity: string) {
  return ({ BLOCKING: "Bloqueante", INCONSISTENCY: "Inconsistência", WARNING: "Alerta", INFO: "Informativo" } as Record<string, string>)[severity] ?? severity;
}

function statusLabel(status: string) {
  return ({ OPEN: "Aberta", JUSTIFIED: "Justificada", RESOLVED: "Resolvida", IGNORED: "Ignorada" } as Record<string, string>)[status] ?? status;
}

function prettyJson(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function displayJsonValue(value: string | null) {
  if (!value) return "—";
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  } catch {
    return value;
  }
}

export function CritiquePage({ importJobId, onBack }: Props) {
  const [run, setRun] = useState<CritiqueRun | null>(null);
  const [issues, setIssues] = useState<CritiqueIssue[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [detail, setDetail] = useState<CritiqueIssueDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const execute = async () => {
    setRunning(true);
    setError(null);
    try {
      const nextRun = await api.createCritiqueRun(importJobId);
      const nextIssues = await api.critiqueIssues(nextRun.id);
      setRun(nextRun);
      setIssues(nextIssues);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar a crítica cadastral.");
    } finally {
      setRunning(false);
    }
  };

  const openIssue = async (id: string) => {
    setDetailLoading(true);
    try {
      const value = await api.critiqueIssue(id);
      setDetail(value);
      setResolutionNote(value.resolutionNote ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir a ocorrência.");
    } finally {
      setDetailLoading(false);
    }
  };

  const resolve = async (nextStatus: "JUSTIFIED" | "RESOLVED" | "IGNORED") => {
    if (!detail || !resolutionNote.trim()) return;
    setResolving(true);
    try {
      const updated = await api.resolveCritiqueIssue(detail.id, nextStatus, resolutionNote.trim());
      setDetail(updated);
      setIssues((current) => current.map((issue) => issue.id === updated.id ? { ...issue, status: updated.status } : issue));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível resolver a ocorrência.");
    } finally {
      setResolving(false);
    }
  };

  const filtered = useMemo(
    () => issues.filter((issue) => (severity === "ALL" || issue.severity === severity) && (status === "ALL" || issue.status === status)),
    [issues, severity, status]
  );

  return <Stack spacing={3}>
    <Stack direction="row" spacing={2} alignItems="center">
      <Button onClick={onBack} startIcon={<ArrowBackRounded />}>Voltar</Button>
      <Box sx={{ flex: 1 }}>
        <Typography variant="overline" color="text.secondary">Qualidade cadastral</Typography>
        <Typography variant="h4">Crítica da massa</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", mt: .5 }}>{importJobId}</Typography>
      </Box>
      {!run && <Button variant="contained" onClick={() => void execute()} disabled={running} startIcon={running ? <CircularProgress size={18} color="inherit" /> : <FactCheckOutlined />}>
        {running ? "Executando…" : "Executar crítica"}
      </Button>}
    </Stack>

    {error && <Alert severity="error">{error}</Alert>}

    {!run && <Paper variant="outlined" sx={{ p: 4 }}>
      <Stack spacing={2} sx={{ maxWidth: 760 }}>
        <Typography variant="h5">A massa está pronta para a crítica determinística</Typography>
        <Typography color="text.secondary">O ATUAS verificará consistência cadastral e atuarial sobre o CANONICAL persistido. Quando a importação estiver vinculada a uma avaliação, ele também procura automaticamente a avaliação anterior do mesmo plano e da mesma população.</Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {["Matrícula", "Duplicidade", "Nascimento / idade", "Tempo plano × empresa", "Salário", "Sexo", "Variação histórica", "Entradas / saídas"].map((item) => <Chip key={item} label={item} variant="outlined" />)}
        </Stack>
      </Stack>
    </Paper>}

    {run && <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
        <Metric label="Bloqueantes" value={run.blockingCount} severity="BLOCKING" />
        <Metric label="Inconsistências" value={run.inconsistencyCount} severity="INCONSISTENCY" />
        <Metric label="Alertas" value={run.warningCount} severity="WARNING" />
        <Metric label="Informativos" value={run.infoCount} severity="INFO" />
      </Box>

      <Alert severity={run.comparedWithPrevious ? "success" : "info"}>
        {run.comparedWithPrevious
          ? "Comparação histórica executada automaticamente contra a massa anterior do mesmo plano e população."
          : "Nenhuma massa anterior comparável foi encontrada. As regras do exercício atual foram executadas normalmente."}
      </Alert>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Typography variant="h6" sx={{ flex: 1 }}>{filtered.length} ocorrências</Typography>
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Severidade</InputLabel><Select label="Severidade" value={severity} onChange={(event) => setSeverity(event.target.value)}><MenuItem value="ALL">Todas</MenuItem><MenuItem value="BLOCKING">Bloqueantes</MenuItem><MenuItem value="INCONSISTENCY">Inconsistências</MenuItem><MenuItem value="WARNING">Alertas</MenuItem><MenuItem value="INFO">Informativos</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><MenuItem value="ALL">Todos</MenuItem><MenuItem value="OPEN">Abertas</MenuItem><MenuItem value="JUSTIFIED">Justificadas</MenuItem><MenuItem value="RESOLVED">Resolvidas</MenuItem><MenuItem value="IGNORED">Ignoradas</MenuItem></Select></FormControl>
      </Stack>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Severidade</TableCell><TableCell>Matrícula</TableCell><TableCell>Campo</TableCell><TableCell>Ocorrência</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {filtered.map((issue) => <TableRow key={issue.id} hover sx={{ cursor: "pointer" }} onClick={() => void openIssue(issue.id)}>
                <TableCell><Chip size="small" color={severityColor(issue.severity)} label={severityLabel(issue.severity)} /></TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{issue.participantRegistration ?? "—"}</TableCell>
                <TableCell>{issue.fieldPath?.replace("participant.", "") ?? issue.category}</TableCell>
                <TableCell sx={{ minWidth: 300 }}>{issue.message}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={statusLabel(issue.status)} /></TableCell>
                <TableCell><Button size="small">Abrir</Button></TableCell>
              </TableRow>)}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>Nenhuma ocorrência neste filtro.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </>}

    <Drawer anchor="right" open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} slotProps={{ paper: { sx: { width: { xs: "100%", md: 720 }, p: 3 } } }}>
      {detailLoading && !detail ? <Box sx={{ display: "grid", placeItems: "center", minHeight: 300 }}><CircularProgress size={28} /></Box> : detail && <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Chip size="small" color={severityColor(detail.severity)} label={severityLabel(detail.severity)} /><Chip size="small" variant="outlined" label={statusLabel(detail.status)} /></Stack>
          <Typography variant="h5">{detail.message}</Typography>
          <Typography color="text.secondary" sx={{ mt: .75 }}>Matrícula {detail.participantRegistration ?? "não identificada"} · {detail.ruleCode}</Typography>
        </Box>

        {(detail.currentValueJson || detail.previousValueJson) && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Valor criticado</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Box><Typography variant="caption" color="text.secondary">Anterior</Typography><Typography>{displayJsonValue(detail.previousValueJson)}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Atual</Typography><Typography>{displayJsonValue(detail.currentValueJson)}</Typography></Box>
          </Box>
        </Paper>}

        <Typography variant="h6">Proveniência do dado</Typography>
        <Provenance title="RAW · como chegou" value={detail.rawJson} />
        <Provenance title="NORMALIZED · após normalização" value={detail.normalizedJson} />
        <Provenance title="CANONICAL · usado pela crítica" value={detail.canonicalJson} />
        {detail.previousCanonicalJson && <Provenance title="CANONICAL · exercício anterior" value={detail.previousCanonicalJson} />}

        {detail.status === "OPEN" ? <Stack spacing={2}>
          <TextField label="Justificativa / providência" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} multiline minRows={3} placeholder="Registre por que a ocorrência é aceitável ou qual correção foi realizada." />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" disabled={resolving || !resolutionNote.trim()} onClick={() => void resolve("RESOLVED")} startIcon={<CheckCircleOutlineRounded />}>Marcar resolvida</Button>
            <Button variant="outlined" disabled={resolving || !resolutionNote.trim()} onClick={() => void resolve("JUSTIFIED")}>Justificar exceção</Button>
            <Button color="inherit" disabled={resolving || !resolutionNote.trim()} onClick={() => void resolve("IGNORED")}>Ignorar</Button>
          </Stack>
        </Stack> : <Alert severity="success">{statusLabel(detail.status)}: {detail.resolutionNote}</Alert>}
      </Stack>}
    </Drawer>
  </Stack>;
}

function Metric({ label, value, severity }: { label: string; value: number; severity: string }) {
  return <Paper variant="outlined" sx={{ p: 2.25 }}><Chip size="small" color={severityColor(severity)} label={severityLabel(severity)} sx={{ mb: 1.5 }} /><Typography variant="h4">{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Paper>;
}

function Provenance({ title, value }: { title: string; value: string | null }) {
  return <Box><Typography variant="subtitle2" sx={{ mb: .75 }}>{title}</Typography><Paper component="pre" variant="outlined" sx={{ m: 0, p: 2, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere", bgcolor: "action.hover" }}>{prettyJson(value)}</Paper></Box>;
}

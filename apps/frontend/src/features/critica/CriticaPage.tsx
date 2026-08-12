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
import { api, type InconsistenciaCritica, type DetalheInconsistenciaCritica, type ExecucaoCritica } from "../../api/client";

type Props = {
  importacaoId: string;
  onBack: () => void;
};

function severityColor(severidade: string): "error" | "warning" | "info" | "default" {
  if (severidade === "BLOCKING") return "error";
  if (severidade === "INCONSISTENCY" || severidade === "WARNING") return "warning";
  if (severidade === "INFO") return "info";
  return "default";
}

function severityLabel(severidade: string) {
  return ({ BLOCKING: "Bloqueante", INCONSISTENCY: "Inconsistência", WARNING: "Alerta", INFO: "Informativo" } as Record<string, string>)[severidade] ?? severidade;
}

function statusLabel(status: string) {
  return ({ ABERTO: "Aberta", JUSTIFICADO: "Justificada", RESOLVIDO: "Resolvida", IGNORADO: "Ignorada" } as Record<string, string>)[status] ?? status;
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

export function CriticaPage({ importacaoId, onBack }: Props) {
  const [run, setRun] = useState<ExecucaoCritica | null>(null);
  const [issues, setIssues] = useState<InconsistenciaCritica[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severidade, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [detail, setDetail] = useState<DetalheInconsistenciaCritica | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notaResolucao, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const execute = async () => {
    setRunning(true);
    setError(null);
    try {
      const nextRun = await api.criarExecucaoCritica(importacaoId);
      const nextIssues = await api.inconsistenciasCritica(nextRun.id);
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
      const value = await api.inconsistenciaCritica(id);
      setDetail(value);
      setResolutionNote(value.notaResolucao ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir a ocorrência.");
    } finally {
      setDetailLoading(false);
    }
  };

  const resolve = async (nextStatus: "JUSTIFICADO" | "RESOLVIDO" | "IGNORADO") => {
    if (!detail || !notaResolucao.trim()) return;
    setResolving(true);
    try {
      const updated = await api.resolverInconsistenciaCritica(detail.id, nextStatus, notaResolucao.trim());
      setDetail(updated);
      setIssues((current) => current.map((issue) => issue.id === updated.id ? { ...issue, status: updated.situacao } : issue));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível resolver a ocorrência.");
    } finally {
      setResolving(false);
    }
  };

  const filtered = useMemo(
    () => issues.filter((issue) => (severidade === "ALL" || issue.severidade === severidade) && (status === "ALL" || issue.situacao === status)),
    [issues, severidade, status]
  );

  return <Stack spacing={3}>
    <Stack direction="row" spacing={2} alignItems="center">
      <Button onClick={onBack} startIcon={<ArrowBackRounded />}>Voltar</Button>
      <Box sx={{ flex: 1 }}>
        <Typography variant="overline" color="text.secondary">Qualidade cadastral</Typography>
        <Typography variant="h4">Crítica da massa</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", mt: .5 }}>{importacaoId}</Typography>
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
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Severidade</InputLabel><Select label="Severidade" value={severidade} onChange={(event) => setSeverity(event.target.value)}><MenuItem value="ALL">Todas</MenuItem><MenuItem value="BLOCKING">Bloqueantes</MenuItem><MenuItem value="INCONSISTENCY">Inconsistências</MenuItem><MenuItem value="WARNING">Alertas</MenuItem><MenuItem value="INFO">Informativos</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><MenuItem value="ALL">Todos</MenuItem><MenuItem value="ABERTO">Abertas</MenuItem><MenuItem value="JUSTIFICADO">Justificadas</MenuItem><MenuItem value="RESOLVIDO">Resolvidas</MenuItem><MenuItem value="IGNORADO">Ignoradas</MenuItem></Select></FormControl>
      </Stack>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Severidade</TableCell><TableCell>Matrícula</TableCell><TableCell>Campo</TableCell><TableCell>Ocorrência</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {filtered.map((issue) => <TableRow key={issue.id} hover sx={{ cursor: "pointer" }} onClick={() => void openIssue(issue.id)}>
                <TableCell><Chip size="small" color={severityColor(issue.severidade)} label={severityLabel(issue.severidade)} /></TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{issue.matriculaParticipante ?? "—"}</TableCell>
                <TableCell>{issue.caminhoCampo?.replace("participant.", "") ?? issue.categoria}</TableCell>
                <TableCell sx={{ minWidth: 300 }}>{issue.mensagem}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={statusLabel(issue.situacao)} /></TableCell>
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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Chip size="small" color={severityColor(detail.severidade)} label={severityLabel(detail.severidade)} /><Chip size="small" variant="outlined" label={statusLabel(detail.situacao)} /></Stack>
          <Typography variant="h5">{detail.mensagem}</Typography>
          <Typography color="text.secondary" sx={{ mt: .75 }}>Matrícula {detail.matriculaParticipante ?? "não identificada"} · {detail.codigoRegra}</Typography>
        </Box>

        {(detail.jsonValorAtual || detail.jsonValorAnterior) && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Valor criticado</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Box><Typography variant="caption" color="text.secondary">Anterior</Typography><Typography>{displayJsonValue(detail.jsonValorAnterior)}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Atual</Typography><Typography>{displayJsonValue(detail.jsonValorAtual)}</Typography></Box>
          </Box>
        </Paper>}

        <Typography variant="h6">Proveniência do dado</Typography>
        <Provenance title="RAW · como chegou" value={detail.jsonBruto} />
        <Provenance title="NORMALIZED · após normalização" value={detail.jsonNormalizado} />
        <Provenance title="CANONICAL · usado pela crítica" value={detail.jsonCanonico} />
        {detail.jsonCanonicoAnterior && <Provenance title="CANONICAL · exercício anterior" value={detail.jsonCanonicoAnterior} />}

        {detail.situacao === "ABERTO" ? <Stack spacing={2}>
          <TextField label="Justificativa / providência" value={notaResolucao} onChange={(event) => setResolutionNote(event.target.value)} multiline minRows={3} placeholder="Registre por que a ocorrência é aceitável ou qual correção foi realizada." />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" disabled={resolving || !notaResolucao.trim()} onClick={() => void resolve("RESOLVIDO")} startIcon={<CheckCircleOutlineRounded />}>Marcar resolvida</Button>
            <Button variant="outlined" disabled={resolving || !notaResolucao.trim()} onClick={() => void resolve("JUSTIFICADO")}>Justificar exceção</Button>
            <Button color="inherit" disabled={resolving || !notaResolucao.trim()} onClick={() => void resolve("IGNORADO")}>Ignorar</Button>
          </Stack>
        </Stack> : <Alert severity="success">{statusLabel(detail.situacao)}: {detail.notaResolucao}</Alert>}
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

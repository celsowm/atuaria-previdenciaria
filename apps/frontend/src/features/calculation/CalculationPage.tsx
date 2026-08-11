import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CalculateOutlined from "@mui/icons-material/CalculateOutlined";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import {
  api,
  type ActuarialParameterizationSummary,
  type CalculationEngine,
  type CalculationRun,
  type CalculationRunSummary
} from "../../api/client";

function statusColor(status: string): "default" | "success" | "error" | "warning" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "error";
  if (status === "PROCESSING") return "warning";
  return "default";
}

function parseMetric(valueJson: string) {
  try {
    const value = JSON.parse(valueJson) as unknown;
    if (typeof value === "number") return value.toLocaleString("pt-BR", { maximumFractionDigits: 10 });
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    return String(value ?? "—");
  } catch {
    return valueJson;
  }
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : "—";
}

export function CalculationPage({
  evaluationId,
  calculationId,
  onOpen,
  onBack,
  onOpenParameterization
}: {
  evaluationId: number;
  calculationId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
  onOpenParameterization: () => void;
}) {
  const [runs, setRuns] = useState<CalculationRunSummary[]>([]);
  const [engines, setEngines] = useState<CalculationEngine[]>([]);
  const [parameterizations, setParameterizations] = useState<ActuarialParameterizationSummary[]>([]);
  const [detail, setDetail] = useState<CalculationRun | null>(null);
  const [parameterizationId, setParameterizationId] = useState("");
  const [engineCode, setEngineCode] = useState("CORE_PRECALCULATION");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [nextRuns, nextEngines, nextParameterizations] = await Promise.all([
      api.calculationRuns(evaluationId),
      api.calculationEngines(),
      api.parameterizations(evaluationId)
    ]);
    setRuns(nextRuns);
    setEngines(nextEngines);
    setParameterizations(nextParameterizations);
    const approved = nextParameterizations.filter((item) => item.status === "APPROVED");
    setParameterizationId((current) => current || approved[0]?.id || "");
    setEngineCode((current) => current || nextEngines[0]?.code || "CORE_PRECALCULATION");
    return nextRuns;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void reload()
      .then(async (nextRuns) => {
        if (cancelled) return;
        const id = calculationId ?? nextRuns[0]?.id;
        if (!id) {
          setDetail(null);
          return;
        }
        if (!calculationId) {
          onOpen(id);
          return;
        }
        const next = await api.calculationRun(id);
        if (!cancelled) setDetail(next);
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Não foi possível carregar os cálculos."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [evaluationId, calculationId]);

  const approved = useMemo(
    () => parameterizations.filter((item) => item.status === "APPROVED"),
    [parameterizations]
  );
  const selectedEngine = engines.find((item) => item.code === engineCode) ?? null;
  const metricsByCategory = useMemo(() => {
    const grouped = new Map<string, CalculationRun["metrics"]>();
    for (const metric of detail?.metrics ?? []) {
      const list = grouped.get(metric.category) ?? [];
      list.push(metric);
      grouped.set(metric.category, list);
    }
    return [...grouped.entries()];
  }, [detail]);

  const execute = async () => {
    if (!parameterizationId) {
      setError("Aprove uma parametrização antes de executar o cálculo.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const run = await api.createCalculationRun(evaluationId, { parameterizationId, engineCode });
      await reload();
      setDetail(run);
      onOpen(run.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar o cálculo.");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <Box sx={{ minHeight: 420, display: "grid", placeItems: "center" }}><CircularProgress size={30} /></Box>;

  return <Stack spacing={3.5}>
    <Box>
      <Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ mb: 2 }}>Avaliação</Button>
      <Typography variant="overline" color="text.secondary">Avaliação #{evaluationId}</Typography>
      <Typography variant="h4">Motor de Cálculo</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 840 }}>
        Cada execução congela parametrização, imports, fingerprints e versão do motor. Repetir exatamente os mesmos inputs reaproveita a execução determinística já persistida.
      </Typography>
    </Box>

    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

    <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }}>
        <TextField select label="Parametrização aprovada" value={parameterizationId} onChange={(event) => setParameterizationId(event.target.value)} sx={{ minWidth: { lg: 300 } }}>
          {approved.map((item) => <MenuItem key={item.id} value={item.id}>v{item.version} · {item.name}</MenuItem>)}
        </TextField>
        <TextField select label="Motor" value={engineCode} onChange={(event) => setEngineCode(event.target.value)} sx={{ minWidth: { lg: 280 } }}>
          {engines.map((engine) => <MenuItem key={engine.code} value={engine.code}>{engine.label} · {engine.version}</MenuItem>)}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<PlayArrowRounded />} disabled={running || !parameterizationId || !engineCode} onClick={() => void execute()}>
          {running ? "Executando…" : "Executar cálculo"}
        </Button>
      </Stack>
      {approved.length === 0 && <Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={onOpenParameterization}>Abrir parametrização</Button>}>
        Não há parametrização aprovada nesta avaliação.
      </Alert>}
      {selectedEngine?.resultKind === "PRECALCULATION" && <Alert severity="info" sx={{ mt: 2 }}>
        Este motor é um pré-cálculo determinístico. Ele valida e consolida os inputs, calcula métricas demográficas e fatores financeiros, mas ainda não produz reservas ou provisões oficiais.
      </Alert>}
    </Paper>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "330px minmax(0, 1fr)" }, gap: 3 }}>
      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", alignSelf: "start", overflow: "hidden" }}>
        <Box sx={{ p: 2.25 }}><Typography fontWeight={750}>Execuções</Typography><Typography variant="body2" color="text.secondary">{runs.length} execução(ões) persistida(s)</Typography></Box>
        <Divider />
        {runs.length === 0 ? <Box sx={{ p: 3 }}><Typography color="text.secondary">Nenhum cálculo executado.</Typography></Box> : <Stack divider={<Divider />}>
          {runs.map((run) => <Button key={run.id} color="inherit" onClick={() => onOpen(run.id)} sx={{ p: 2, borderRadius: 0, justifyContent: "flex-start", textAlign: "left", bgcolor: detail?.id === run.id ? "action.selected" : undefined }}>
            <Box sx={{ width: "100%" }}>
              <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={750}>{run.engineVersion}</Typography><Chip size="small" color={statusColor(run.status)} label={run.status} /></Stack>
              <Typography variant="caption" color="text.secondary">{new Date(run.createdAt).toLocaleString("pt-BR")}</Typography>
              <Typography variant="caption" display="block" sx={{ mt: .75 }}>{run.validRowCount.toLocaleString("pt-BR")} registros válidos</Typography>
            </Box>
          </Button>)}
        </Stack>}
      </Paper>

      <Box>
        {!detail && <Paper elevation={0} sx={{ p: 6, border: "1px dashed", borderColor: "divider", textAlign: "center" }}><CalculateOutlined sx={{ fontSize: 46, color: "text.secondary" }} /><Typography variant="h6" sx={{ mt: 1 }}>Execute o primeiro cálculo</Typography></Paper>}
        {detail && <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
              <Box><Typography variant="h5">{detail.engineVersion}</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Execução {detail.id}</Typography></Box>
              <Chip color={statusColor(detail.status)} label={detail.status} />
            </Stack>
            {detail.status === "FAILED" && <Alert severity="error" sx={{ mt: 2 }}>{detail.errorMessage ?? "Falha no motor de cálculo."}</Alert>}
          </Paper>

          {metricsByCategory.map(([category, metrics]) => <Paper key={category} elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>{category}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
              {metrics.map((metric) => <Box key={metric.id} sx={{ py: 1 }}><Typography variant="body2" color="text.secondary">{metric.label}</Typography><Typography variant="h6" sx={{ mt: .25 }}>{parseMetric(metric.valueJson)}{metric.unit ? ` ${metric.unit}` : ""}</Typography><Typography variant="caption" color="text.disabled">{metric.code}</Typography></Box>)}
            </Box>
          </Paper>)}

          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><FingerprintRounded color="primary" /><Typography variant="h6">Reprodutibilidade</Typography></Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <Hash label="Parametrização" value={detail.parameterFingerprint} />
              <Hash label="Dados canônicos" value={detail.dataFingerprint} />
              <Hash label="Input completo" value={detail.inputFingerprint} />
              <Hash label="Resultado" value={detail.resultFingerprint} />
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6">Imports congelados</Typography>
            <Stack divider={<Divider />} sx={{ mt: 1 }}>
              {detail.inputs.map((input) => <Box key={input.id} sx={{ py: 1.5 }}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}><Box><Typography fontWeight={700}>{input.population}</Typography><Typography variant="body2" color="text.secondary">Import {input.importJobId}</Typography></Box><Typography variant="body2">{input.validRows.toLocaleString("pt-BR")} válidos · {input.invalidRows.toLocaleString("pt-BR")} inválidos</Typography></Stack>
                <Typography variant="caption" color="text.secondary">canonical {shortHash(input.canonicalFingerprint)}</Typography>
              </Box>)}
            </Stack>
          </Paper>
        </Stack>}
      </Box>
    </Box>
  </Stack>;
}

function Hash({ label, value }: { label: string; value: string | null | undefined }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ fontFamily: "monospace", fontSize: 13, overflowWrap: "anywhere" }}>{shortHash(value)}</Typography></Box>;
}

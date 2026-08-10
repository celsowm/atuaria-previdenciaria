import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import { api, type DashboardTotals, type Evaluation } from "../../api/client";

type Props = { onOpenEvaluation: (id: number) => void; onImport: () => void };
const emptyTotals: DashboardTotals = { inProgress: 0, awaitingCorrections: 0, pendingStudies: 0, draftsAwaitingReview: 0 };

export function DashboardPage({ onOpenEvaluation, onImport }: Props) {
  const [totals, setTotals] = useState(emptyTotals);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.dashboard(), api.evaluations()])
      .then(([dashboard, rows]) => { setTotals(dashboard); setEvaluations(rows); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Falha ao carregar dados"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: 420 }}><CircularProgress size={28} /></Box>;

  return <Stack spacing={4}>
    <Box sx={{ display: "flex", alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
      <Box><Typography variant="overline" color="text.secondary">Visão operacional</Typography><Typography variant="h4">Avaliações atuariais</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>Da massa cadastral ao fechamento e aos documentos.</Typography></Box>
      <Button variant="contained" onClick={onImport}>Importar nova massa</Button>
    </Box>
    {error && <Alert severity="warning">Backend indisponível: {error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
      <Metric icon={<TimelineRounded />} label="Em andamento" value={totals.inProgress} />
      <Metric icon={<ErrorOutlineRounded />} label="Aguardando correção" value={totals.awaitingCorrections} />
      <Metric icon={<ScienceOutlined />} label="Estudos pendentes" value={totals.pendingStudies} />
      <Metric icon={<DescriptionOutlined />} label="Minutas em revisão" value={totals.draftsAwaitingReview} />
    </Box>
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><Typography variant="h6">Trabalho em andamento</Typography><Typography variant="body2" color="text.secondary">{evaluations.length} avaliações recentes</Typography></Box>
      {evaluations.map((evaluation) => <Paper key={evaluation.id} elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1.6fr) minmax(180px, 1fr) 130px 36px" }, gap: 2.5, alignItems: "center" }}>
          <Box><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .6 }}><Typography fontWeight={700}>{evaluation.planName}</Typography>{evaluation.blockingIssues > 0 && <Chip size="small" color="warning" label={`${evaluation.blockingIssues} críticas`} />}</Stack><Typography variant="body2" color="text.secondary">Data-base {new Date(`${evaluation.referenceDate}T12:00:00`).toLocaleDateString("pt-BR")}</Typography></Box>
          <Box><Typography variant="body2" fontWeight={650}>{evaluation.stage}</Typography><LinearProgress variant="determinate" value={evaluation.progress} sx={{ mt: 1, height: 7 }} /></Box>
          <Chip size="small" variant="outlined" label={`${evaluation.progress}%`} sx={{ justifySelf: { md: "end" } }} />
          <Button onClick={() => onOpenEvaluation(evaluation.id)} sx={{ minWidth: 36, px: 0 }}><ArrowForwardRounded /></Button>
        </Box>
      </Paper>)}
    </Stack>
  </Stack>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <Paper elevation={0} sx={{ p: 2.25, border: "1px solid", borderColor: "divider" }}><Box sx={{ color: "primary.main", mb: 1.5 }}>{icon}</Box><Typography variant="h5">{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Paper>;
}

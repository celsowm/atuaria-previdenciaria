import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import { api, type Evaluation } from "../../api/client";

const workflow = [
  ["Dados", "Massa cadastral preparada", "done"],
  ["Crítica cadastral", "Consistências cadastrais", "done"],
  ["Hipóteses", "Hipóteses e tábuas", "done"],
  ["Aderência", "Estudos biométricos", "done"],
  ["Parametrização", "Parâmetros da rodada", "done"],
  ["Cálculo", "Execução atuarial", "done"],
  ["Fechamento", "Análise de resultados", "current"],
  ["Documentos", "Pareceres e minutas", "next"],
  ["Regulatório", "Entregas regulatórias", "next"]
] as const;

export function EvaluationPage({ evaluationId, onBack }: { evaluationId: number; onBack: () => void }) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.evaluations()
      .then((rows) => {
        const found = rows.find((item) => item.id === evaluationId) ?? null;
        setEvaluation(found);
        if (!found) setError("Avaliação não encontrada.");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar a avaliação."))
      .finally(() => setLoading(false));
  }, [evaluationId]);

  if (loading) return <Box sx={{ minHeight: 360, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>;
  if (!evaluation) return <Stack spacing={2}><Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ alignSelf: "flex-start" }}>Avaliações</Button><Alert severity="warning">{error ?? "Avaliação não encontrada."}</Alert></Stack>;

  return <Stack spacing={4}>
    <Box><Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ mb: 2 }}>Avaliações</Button><Typography variant="overline" color="text.secondary">Avaliação atuarial · #{evaluation.id}</Typography><Typography variant="h4">{evaluation.planName}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1.5 }}><Chip label={`Data-base ${new Date(`${evaluation.referenceDate}T12:00:00`).toLocaleDateString("pt-BR")}`} variant="outlined" /><Chip label={evaluation.stage} color="primary" /></Stack></Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.6fr) minmax(300px, .8fr)" }, gap: 3 }}>
      <Stack spacing={1.2}>
        <Typography variant="h6" sx={{ mb: 1 }}>Ciclo da avaliação</Typography>
        {workflow.map(([title, detail, state], index) => <Box key={title} sx={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 1.5, alignItems: "center", py: 1.4 }}>
          <Box sx={{ display: "grid", placeItems: "center", color: state === "done" ? "success.main" : state === "current" ? "warning.main" : "text.disabled" }}>{state === "done" ? <CheckCircleRounded /> : state === "current" ? <WarningAmberRounded /> : <RadioButtonUncheckedRounded />}</Box>
          <Box><Typography fontWeight={700}>{index + 1}. {title}</Typography><Typography variant="body2" color="text.secondary">{title === evaluation.stage ? `Etapa atual · ${detail}` : detail}</Typography></Box>
          {title === evaluation.stage && <Button size="small" variant="contained">Abrir</Button>}
        </Box>)}
      </Stack>

      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}><Typography variant="overline" color="text.secondary">Progresso</Typography><Typography variant="h4" sx={{ mt: .5 }}>{evaluation.progress}%</Typography><LinearProgress variant="determinate" value={evaluation.progress} sx={{ mt: 2, height: 8 }} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{evaluation.stage} · {evaluation.status}</Typography></Paper>
        {evaluation.blockingIssues > 0 && <Alert severity="warning">{evaluation.blockingIssues} ocorrência(s) bloqueante(s) ainda precisam ser tratadas.</Alert>}
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}><Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeRounded color="primary" /><Typography variant="h6">Assistente contextual</Typography></Stack><Typography color="text.secondary" sx={{ my: 2 }}>A IA recebe apenas fatos estruturados da rodada e pode ajudar a explicar variações ou preparar a minuta.</Typography><Stack spacing={1}><Button variant="outlined" startIcon={<AutoAwesomeRounded />}>Explicar variações</Button><Button variant="outlined" startIcon={<AutoAwesomeRounded />}>Preparar minuta do parecer</Button><Button variant="text">Comparar com exercício anterior</Button></Stack></Paper>
      </Stack>
    </Box>
  </Stack>;
}

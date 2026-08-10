import { Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";

const workflow = [
  ["Dados", "Massa v4 aprovada", "done"],
  ["Crítica cadastral", "17 ocorrências tratadas", "done"],
  ["Hipóteses", "Snapshot 2026.3", "done"],
  ["Aderência", "Mortalidade geral concluída", "done"],
  ["Parametrização", "Rodada #7", "done"],
  ["Cálculo", "Motor legado validado", "done"],
  ["Fechamento", "3 variações para justificar", "current"],
  ["Documentos", "Parecer ainda não iniciado", "next"],
  ["Regulatório", "DA/XML pendente", "next"]
] as const;

export function EvaluationPage({ onBack }: { onBack: () => void }) {
  return <Stack spacing={4}>
    <Box><Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ mb: 2 }}>Avaliações</Button><Typography variant="overline" color="text.secondary">Avaliação Atuarial 2026</Typography><Typography variant="h4">Plano Previdenciário Alfa</Typography><Stack direction="row" spacing={1} sx={{ mt: 1.5 }}><Chip label="Data-base 31/12/2025" variant="outlined" /><Chip label="Fechamento" color="primary" /></Stack></Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.6fr) minmax(300px, .8fr)" }, gap: 3 }}>
      <Stack spacing={1.2}>
        <Typography variant="h6" sx={{ mb: 1 }}>Ciclo da avaliação</Typography>
        {workflow.map(([title, detail, state], index) => <Box key={title} sx={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 1.5, alignItems: "center", py: 1.4 }}>
          <Box sx={{ display: "grid", placeItems: "center", color: state === "done" ? "success.main" : state === "current" ? "warning.main" : "text.disabled" }}>{state === "done" ? <CheckCircleRounded /> : state === "current" ? <WarningAmberRounded /> : <RadioButtonUncheckedRounded />}</Box>
          <Box><Typography fontWeight={700}>{index + 1}. {title}</Typography><Typography variant="body2" color="text.secondary">{detail}</Typography></Box>
          {state === "current" && <Button size="small" variant="contained">Abrir</Button>}
        </Box>)}
      </Stack>

      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}><Typography variant="overline" color="text.secondary">Progresso</Typography><Typography variant="h4" sx={{ mt: .5 }}>82%</Typography><LinearProgress variant="determinate" value={82} sx={{ mt: 2, height: 8 }} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Fechamento em andamento</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}><Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeRounded color="primary" /><Typography variant="h6">Assistente contextual</Typography></Stack><Typography color="text.secondary" sx={{ my: 2 }}>A IA recebe apenas fatos estruturados da rodada e pode ajudar a explicar variações ou preparar a minuta.</Typography><Stack spacing={1}><Button variant="outlined" startIcon={<AutoAwesomeRounded />}>Explicar variações do fechamento</Button><Button variant="outlined" startIcon={<AutoAwesomeRounded />}>Preparar minuta do parecer</Button><Button variant="text">Comparar com 2025</Button></Stack></Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}><Typography variant="h6">Última rodada</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Rodada #7 · Massa v4 · Hipóteses 2026.3</Typography><Typography variant="body2" color="text.secondary">Motor: Legacy Delphi · concluída e registrada</Typography></Paper>
      </Stack>
    </Box>
  </Stack>;
}

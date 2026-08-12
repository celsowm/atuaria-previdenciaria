import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Pagination,
  Paper,
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
import CalculateOutlined from "@mui/icons-material/CalculateOutlined";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import {
  api,
  type ActuarialParameterizationSummary,
  type CalculationEngine,
  type CalculationParticipantResultPage,
  type CalculationRun,
  type CalculationRunSummary,
  type CreateCalculationRunInput,
  type Evaluation,
  type Plan,
  type PlanRulesVersionSummary
} from "../../api/client";

const participantPageSize = 25;

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

function parseParticipantResult(valueJson: string): Record<string, unknown> {
  try {
    const value = JSON.parse(valueJson) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function formatNumber(value: unknown, maximumFractionDigits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { maximumFractionDigits })
    : "—";
}

function formatProbability(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`
    : "—";
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : "—";
}

function immutableSnapshot(status: string) {
  return status === "APPROVED" || status === "SUPERSEDED";
}

export function CalculationPage({
  evaluationId,
  calculationId,
  onOpen,
  onBack,
  onOpenParameterization,
  onOpenPlanRules
}: {
  evaluationId: number;
  calculationId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
  onOpenParameterization: () => void;
  onOpenPlanRules: (planId: string) => void;
}) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [runs, setRuns] = useState<CalculationRunSummary[]>([]);
  const [engines, setEngines] = useState<CalculationEngine[]>([]);
  const [parameterizations, setParameterizations] = useState<ActuarialParameterizationSummary[]>([]);
  const [planRulesVersions, setPlanRulesVersions] = useState<PlanRulesVersionSummary[]>([]);
  const [detail, setDetail] = useState<CalculationRun | null>(null);
  const [parameterizationId, setParameterizationId] = useState("");
  const [planRulesVersionId, setPlanRulesVersionId] = useState("");
  const [engineCode, setEngineCode] = useState("CORE_PRECALCULATION");
  const [participantPage, setParticipantPage] = useState<CalculationParticipantResultPage | null>(null);
  const [participantPageNumber, setParticipantPageNumber] = useState(1);
  const [participantLoading, setParticipantLoading] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [nextRuns, nextEngines, nextParameterizations, evaluations] = await Promise.all([
      api.calculationRuns(evaluationId),
      api.calculationEngines(),
      api.parameterizations(evaluationId),
      api.evaluations()
    ]);
    const nextEvaluation = evaluations.find((item) => item.id === evaluationId) ?? null;
    let nextPlan: Plan | null = null;
    let nextRules: PlanRulesVersionSummary[] = [];
    if (nextEvaluation?.planId) {
      [nextPlan, nextRules] = await Promise.all([
        api.plan(nextEvaluation.planId),
        api.planRulesVersions(nextEvaluation.planId)
      ]);
    }

    setEvaluation(nextEvaluation);
    setPlan(nextPlan);
    setRuns(nextRuns);
    setEngines(nextEngines);
    setParameterizations(nextParameterizations);
    setPlanRulesVersions(nextRules);

    const approvedParameterizations = nextParameterizations.filter((item) => immutableSnapshot(item.status));
    setParameterizationId((current) =>
      approvedParameterizations.some((item) => item.id === current) ? current : approvedParameterizations[0]?.id ?? ""
    );

    const applicableRules = nextRules.filter((item) =>
      immutableSnapshot(item.status) &&
      (!nextEvaluation || item.effectiveFrom === null || item.effectiveFrom <= nextEvaluation.referenceDate) &&
      (!nextEvaluation || item.effectiveTo === null || item.effectiveTo >= nextEvaluation.referenceDate)
    );
    setPlanRulesVersionId((current) =>
      applicableRules.some((item) => item.id === current) ? current : applicableRules[0]?.id ?? ""
    );

    const compatibleEngines = nextPlan
      ? nextEngines.filter((engine) => engine.supportedModalities.includes(nextPlan.modality))
      : nextEngines;
    setEngineCode((current) =>
      compatibleEngines.some((engine) => engine.code === current) ? current : compatibleEngines[0]?.code ?? "CORE_PRECALCULATION"
    );
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

  useEffect(() => {
    setParticipantPageNumber(1);
    setParticipantPage(null);
    setParticipantError(null);
  }, [detail?.id]);

  useEffect(() => {
    if (!detail || detail.participantResultCount === 0) {
      setParticipantPage(null);
      setParticipantLoading(false);
      return;
    }
    let cancelled = false;
    setParticipantLoading(true);
    setParticipantError(null);
    void api.calculationParticipantResults(detail.id, participantPageNumber, participantPageSize)
      .then((page) => {
        if (!cancelled) setParticipantPage(page);
      })
      .catch((reason) => {
        if (!cancelled) setParticipantError(reason instanceof Error ? reason.message : "Não foi possível carregar a reconciliação por participante.");
      })
      .finally(() => {
        if (!cancelled) setParticipantLoading(false);
      });
    return () => { cancelled = true; };
  }, [detail?.id, detail?.participantResultCount, participantPageNumber]);

  const approved = useMemo(
    () => parameterizations.filter((item) => immutableSnapshot(item.status)),
    [parameterizations]
  );
  const applicablePlanRules = useMemo(
    () => planRulesVersions.filter((item) =>
      immutableSnapshot(item.status) &&
      (!evaluation || item.effectiveFrom === null || item.effectiveFrom <= evaluation.referenceDate) &&
      (!evaluation || item.effectiveTo === null || item.effectiveTo >= evaluation.referenceDate)
    ),
    [evaluation, planRulesVersions]
  );
  const compatibleEngines = useMemo(
    () => plan ? engines.filter((engine) => engine.supportedModalities.includes(plan.modality)) : engines,
    [engines, plan]
  );
  const selectedEngine = compatibleEngines.find((item) => item.code === engineCode) ?? null;
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
    if (selectedEngine?.requiresPlanRules && !planRulesVersionId) {
      setError("Selecione uma versão aprovada das regras do plano vigente na data-base.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const input: CreateCalculationRunInput = { parameterizationId, engineCode };
      if (selectedEngine?.requiresPlanRules) input.planRulesVersionId = planRulesVersionId;
      const run = await api.createCalculationRun(evaluationId, input);
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
      <Typography variant="overline" color="text.secondary">Avaliação #{evaluationId}{plan ? ` · ${plan.code}` : ""}</Typography>
      <Typography variant="h4">Motor de Cálculo</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 840 }}>
        Cada execução congela parametrização, regras do plano quando aplicáveis, qx biométricos, imports, fingerprints e versão do motor.
      </Typography>
    </Box>

    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

    <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }}>
        <TextField select label="Parametrização imutável" value={parameterizationId} onChange={(event) => setParameterizationId(event.target.value)} sx={{ minWidth: { lg: 290 } }}>
          {approved.map((item) => <MenuItem key={item.id} value={item.id}>v{item.version} · {item.name} · {item.status}</MenuItem>)}
        </TextField>
        <TextField select label="Motor" value={engineCode} onChange={(event) => setEngineCode(event.target.value)} sx={{ minWidth: { lg: 280 } }}>
          {compatibleEngines.map((engine) => <MenuItem key={engine.code} value={engine.code}>{engine.label} · {engine.version}</MenuItem>)}
        </TextField>
        {selectedEngine?.requiresPlanRules && <TextField select label="Regras do plano" value={planRulesVersionId} onChange={(event) => setPlanRulesVersionId(event.target.value)} sx={{ minWidth: { lg: 280 } }}>
          {applicablePlanRules.map((item) => <MenuItem key={item.id} value={item.id}>v{item.version} · {item.name} · {item.status}</MenuItem>)}
        </TextField>}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          startIcon={<PlayArrowRounded />}
          disabled={running || !parameterizationId || !engineCode || Boolean(selectedEngine?.requiresPlanRules && !planRulesVersionId)}
          onClick={() => void execute()}
        >
          {running ? "Executando…" : "Executar cálculo"}
        </Button>
      </Stack>
      {approved.length === 0 && <Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={onOpenParameterization}>Abrir parametrização</Button>}>
        Não há snapshot aprovado ou substituído de parametrização nesta avaliação.
      </Alert>}
      {selectedEngine?.requiresPlanRules && !evaluation?.planId && <Alert severity="error" sx={{ mt: 2 }}>
        Esta avaliação ainda não possui `planId`. Um cálculo atuarial não pode inferir o plano apenas pelo nome textual.
      </Alert>}
      {selectedEngine?.requiresPlanRules && evaluation?.planId && applicablePlanRules.length === 0 && <Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => onOpenPlanRules(evaluation.planId!)}>Abrir regras do plano</Button>}>
        Não há versão imutável das regras do plano vigente na data-base {evaluation.referenceDate}.
      </Alert>}
      {selectedEngine?.resultKind === "PRECALCULATION" && <Alert severity="info" sx={{ mt: 2 }}>
        Este motor é um pré-cálculo determinístico. Ele valida e consolida os inputs, calcula métricas demográficas e fatores financeiros, mas não produz resultado atuarial de benefício ou provisão.
      </Alert>}
      {selectedEngine?.resultKind === "ACTUARIAL" && <Alert severity="info" sx={{ mt: 2 }}>
        {selectedEngine.description}
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
              {run.participantResultCount > 0 && <Typography variant="caption" display="block" color="text.secondary">{run.participantResultCount.toLocaleString("pt-BR")} resultados individuais</Typography>}
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

          {detail.participantResultCount > 0 && <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <Box sx={{ p: 3, pb: 2 }}>
              <Typography variant="h6">Reconciliação por participante</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
                {detail.participantResultCount.toLocaleString("pt-BR")} resultado(s) persistido(s) para conferência participante a participante sem recalcular a execução.
              </Typography>
            </Box>
            {participantError && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>{participantError}</Alert>}
            {participantLoading && !participantPage ? <Box sx={{ minHeight: 140, display: "grid", placeItems: "center" }}><CircularProgress size={26} /></Box> : participantPage && <>
              <Box sx={{ overflowX: "auto" }}>
                {detail.engineCode === "BD_PVFB" ? <Table size="small" sx={{ minWidth: 980 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Matrícula</TableCell>
                      <TableCell align="right">Linha</TableCell>
                      <TableCell align="right">Idade atual</TableCell>
                      <TableCell align="right">Idade aposent.</TableCell>
                      <TableCell align="right">Anos</TableCell>
                      <TableCell align="right">Salário atual</TableCell>
                      <TableCell align="right">Benefício proj.</TableCell>
                      <TableCell align="right">Sobrevivência</TableCell>
                      <TableCell align="right">PVFB</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {participantPage.items.map((item) => {
                      const result = parseParticipantResult(item.resultJson);
                      return <TableRow key={item.id} hover>
                        <TableCell>{item.participantRegistration ?? "—"}</TableCell>
                        <TableCell align="right">{item.sourceRowNumber}</TableCell>
                        <TableCell align="right">{formatNumber(result.currentAge, 0)}</TableCell>
                        <TableCell align="right">{formatNumber(result.retirementAge, 0)}</TableCell>
                        <TableCell align="right">{formatNumber(result.yearsToRetirement, 0)}</TableCell>
                        <TableCell align="right">{formatNumber(result.currentMonthlySalary)}</TableCell>
                        <TableCell align="right">{formatNumber(result.projectedMonthlyBenefit)}</TableCell>
                        <TableCell align="right">{formatProbability(result.survivalToRetirement)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatNumber(result.pvfb)}</TableCell>
                      </TableRow>;
                    })}
                  </TableBody>
                </Table> : <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead><TableRow><TableCell>Matrícula</TableCell><TableCell>População</TableCell><TableCell align="right">Linha</TableCell><TableCell>Resultado</TableCell></TableRow></TableHead>
                  <TableBody>{participantPage.items.map((item) => <TableRow key={item.id} hover><TableCell>{item.participantRegistration ?? "—"}</TableCell><TableCell>{item.population}</TableCell><TableCell align="right">{item.sourceRowNumber}</TableCell><TableCell sx={{ fontFamily: "monospace", fontSize: 12, overflowWrap: "anywhere" }}>{item.resultJson}</TableCell></TableRow>)}</TableBody>
                </Table>}
              </Box>
              {participantPage.totalItems > participantPage.pageSize && <Stack direction="row" justifyContent="center" sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
                <Pagination
                  page={participantPage.page}
                  count={Math.ceil(participantPage.totalItems / participantPage.pageSize)}
                  onChange={(_, page) => setParticipantPageNumber(page)}
                  disabled={participantLoading}
                />
              </Stack>}
            </>}
          </Paper>}

          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><FingerprintRounded color="primary" /><Typography variant="h6">Reprodutibilidade</Typography></Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <Hash label="Regras do plano" value={detail.planRulesFingerprint} />
              <Hash label="Parametrização + qx" value={detail.parameterFingerprint} />
              <Hash label="Dados canônicos" value={detail.dataFingerprint} />
              <Hash label="Input completo" value={detail.inputFingerprint} />
              <Hash label="Resultado agregado + individual" value={detail.resultFingerprint} />
            </Box>
            {detail.planRulesVersionId && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>PlanRulesVersion: {detail.planRulesVersionId}</Typography>}
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

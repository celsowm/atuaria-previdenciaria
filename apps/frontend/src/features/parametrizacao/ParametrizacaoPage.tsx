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
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import SaveRounded from "@mui/icons-material/SaveRounded";
import {
  api,
  type ActuarialParameterization,
  type ActuarialParameterizationSummary,
  type AdherenceStudyDetail,
  type SetActuarialParameterValueInput
} from "../../api/client";

const numericSpecs = [
  { code: "ECONOMIC.REAL_INTEREST_RATE", category: "Econômicas", label: "Taxa real de juros", unit: "% a.a." },
  { code: "ECONOMIC.SALARY_GROWTH_RATE", category: "Econômicas", label: "Crescimento real de salários", unit: "% a.a." },
  { code: "ECONOMIC.BENEFIT_GROWTH_RATE", category: "Econômicas", label: "Crescimento real de benefícios", unit: "% a.a." },
  { code: "DEMOGRAPHIC.TURNOVER_RATE", category: "Demográficas", label: "Rotatividade", unit: "% a.a." }
] as const;

const financingMethods = ["AGGREGATE", "ENTRY_AGE_NORMAL", "INDIVIDUAL_AGGREGATE", "UNIT_CREDIT", "PROJECTED_UNIT_CREDIT"];

function statusLabel(status: string) {
  if (status === "DRAFT") return "Rascunho";
  if (status === "APPROVED") return "Aprovada";
  if (status === "SUPERSEDED") return "Substituída";
  return status;
}

function statusColor(status: string): "default" | "warning" | "success" {
  if (status === "DRAFT") return "warning";
  if (status === "APPROVED") return "success";
  return "default";
}

function parseStoredValue(valueJson: string) {
  try {
    const value = JSON.parse(valueJson) as unknown;
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  } catch {
    return "";
  }
}

export function ParameterizationPage({
  evaluationId,
  parameterizationId,
  onOpen,
  onBack
}: {
  evaluationId: number;
  parameterizationId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const [versions, setVersions] = useState<ActuarialParameterizationSummary[]>([]);
  const [parameterization, setParameterization] = useState<ActuarialParameterization | null>(null);
  const [studies, setStudies] = useState<AdherenceStudyDetail[]>([]);
  const [numericValues, setNumericValues] = useState<Record<string, string>>({});
  const [financingMethod, setFinancingMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadVersions = async () => {
    const rows = await api.parameterizations(evaluationId);
    setVersions(rows);
    return rows;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadVersions(), api.adherenceStudies()])
      .then(async ([rows, studySummaries]) => {
        if (cancelled) return;
        if (!parameterizationId && rows.length > 0) {
          onOpen(rows[0].id);
          return;
        }

        if (parameterizationId) {
          const detail = await api.parameterization(parameterizationId);
          if (cancelled) return;
          if (detail.evaluationId !== evaluationId) throw new Error("A parametrização não pertence a esta avaliação.");
          setParameterization(detail);
          setNotes(detail.notes ?? "");
          const values: Record<string, string> = {};
          for (const item of detail.parameters) values[item.code] = parseStoredValue(item.valueJson);
          setNumericValues(values);
          const method = detail.parameters.find((item) => item.code === "FINANCING.METHOD");
          setFinancingMethod(method ? parseStoredValue(method.valueJson) : "");
        } else {
          setParameterization(null);
        }

        const usable = studySummaries.filter(
          (study) => study.evaluationId === evaluationId || study.evaluationId === null
        );
        const details = await Promise.all(usable.map((study) => api.adherenceStudy(study.id)));
        if (!cancelled) setStudies(details);
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Não foi possível carregar a parametrização."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [evaluationId, parameterizationId]);

  const selectedByHypothesis = useMemo(
    () => new Map((parameterization?.hypotheses ?? []).map((selection) => [selection.hypothesisType, selection] as const)),
    [parameterization]
  );

  const createVersion = async (copyFromId?: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api.createParameterization(evaluationId, copyFromId ? { copyFromId } : {});
      await loadVersions();
      onOpen(created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a parametrização.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!parameterization) return;
    const parameters: SetActuarialParameterValueInput[] = numericSpecs
      .filter((spec) => numericValues[spec.code]?.trim())
      .map((spec) => ({
        code: spec.code,
        category: spec.category,
        label: spec.label,
        valueType: "NUMBER" as const,
        valueJson: JSON.stringify(Number(numericValues[spec.code].replace(",", "."))),
        unit: spec.unit,
        source: "MANUAL"
      }));
    if (financingMethod) {
      parameters.push({
        code: "FINANCING.METHOD",
        category: "Financiamento",
        label: "Método de financiamento",
        valueType: "TEXT",
        valueJson: JSON.stringify(financingMethod),
        unit: null,
        source: "MANUAL"
      });
    }
    if (!parameters.length) {
      setError("Preencha ao menos um parâmetro antes de salvar.");
      return;
    }
    if (parameters.some((item) => item.valueType === "NUMBER" && !Number.isFinite(JSON.parse(item.valueJson)))) {
      setError("Existe um parâmetro numérico inválido.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.updateParameterization(parameterization.id, { notes: notes || null });
      const updated = await api.setActuarialParameters(parameterization.id, parameters);
      setParameterization(updated);
      await loadVersions();
      setSuccess("Rascunho salvo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const promote = async (candidateResultId: string) => {
    if (!parameterization) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.promoteAdherenceCandidate(parameterization.id, candidateResultId);
      setParameterization(updated);
      setSuccess("Hipótese promovida para a parametrização e vinculada a esta avaliação.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível promover a hipótese.");
    } finally {
      setSaving(false);
    }
  };

  const removeHypothesis = async (selectionId: string) => {
    if (!parameterization) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.removeActuarialHypothesis(parameterization.id, selectionId);
      setParameterization(updated);
      setSuccess("Hipótese removida do rascunho.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover a hipótese.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!parameterization) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.approveParameterization(parameterization.id);
      setParameterization(updated);
      await loadVersions();
      setSuccess("Parametrização aprovada e congelada para uso em cálculo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível aprovar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ minHeight: 420, display: "grid", placeItems: "center" }}><CircularProgress size={30} /></Box>;

  return <Stack spacing={3.5}>
    <Box>
      <Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ mb: 2 }}>Avaliação</Button>
      <Typography variant="overline" color="text.secondary">Avaliação #{evaluationId}</Typography>
      <Typography variant="h4">Parametrização Atuarial</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 820 }}>
        Hipóteses e parâmetros são versionados. Uma versão aprovada fica imutável; qualquer alteração posterior deve gerar uma nova versão.
      </Typography>
    </Box>

    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
    {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}

    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }}>
        <Typography fontWeight={750} sx={{ mr: 1 }}>Versões</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
          {versions.map((version) => <Chip
            key={version.id}
            clickable
            onClick={() => onOpen(version.id)}
            variant={version.id === parameterization?.id ? "filled" : "outlined"}
            color={version.status === "APPROVED" ? "success" : version.status === "DRAFT" ? "warning" : "default"}
            label={`v${version.version} · ${statusLabel(version.status)}`}
          />)}
          {versions.length === 0 && <Typography variant="body2" color="text.secondary">Nenhuma versão criada.</Typography>}
        </Stack>
        {!parameterization || parameterization.status !== "DRAFT" ? <Button disabled={saving} variant="outlined" onClick={() => void createVersion(parameterization?.id)} startIcon={parameterization ? <ContentCopyRounded /> : undefined}>
          {parameterization ? "Nova versão" : "Criar parametrização"}
        </Button> : <Typography variant="caption" color="text.secondary">Conclua o rascunho atual antes de criar outra versão.</Typography>}
      </Stack>
    </Paper>

    {!parameterization ? <Paper elevation={0} sx={{ p: 5, textAlign: "center", border: "1px dashed", borderColor: "divider" }}>
      <Typography variant="h6">A avaliação ainda não possui parametrização.</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Crie a versão inicial para consolidar hipóteses e parâmetros da rodada.</Typography>
      <Button variant="contained" disabled={saving} onClick={() => void createVersion()}>Criar versão 1</Button>
    </Paper> : <>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h5">{parameterization.name}</Typography><Chip size="small" color={statusColor(parameterization.status)} label={statusLabel(parameterization.status)} /></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>Versão {parameterization.version} · atualizada em {new Date(parameterization.updatedAt).toLocaleString("pt-BR")}</Typography>
        </Box>
        {parameterization.status === "DRAFT" && <Stack alignItems={{ md: "flex-end" }}><Button variant="contained" color="success" disabled={saving} onClick={() => void approve()} startIcon={<CheckCircleRounded />}>Aprovar snapshot salvo</Button><Typography variant="caption" color="text.secondary">Salve alterações de parâmetros antes de aprovar.</Typography></Stack>}
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.15fr) minmax(420px, .85fr)" }, gap: 3 }}>
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6">Parâmetros da rodada</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2.5 }}>Os valores abaixo são fatos estruturados do snapshot e serão consumidos pelo motor de cálculo.</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              {numericSpecs.map((spec) => <TextField
                key={spec.code}
                label={spec.label}
                value={numericValues[spec.code] ?? ""}
                onChange={(event) => setNumericValues((current) => ({ ...current, [spec.code]: event.target.value }))}
                disabled={parameterization.status !== "DRAFT"}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                helperText={spec.unit}
              />)}
              <TextField
                select
                label="Método de financiamento"
                value={financingMethod}
                onChange={(event) => setFinancingMethod(event.target.value)}
                disabled={parameterization.status !== "DRAFT"}
              >
                <MenuItem value="">Não definido</MenuItem>
                {financingMethods.map((method) => <MenuItem key={method} value={method}>{method.replace(/_/g, " ")}</MenuItem>)}
              </TextField>
            </Box>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Notas técnicas da parametrização"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={parameterization.status !== "DRAFT"}
              sx={{ mt: 2 }}
            />
            {parameterization.status === "DRAFT" && <Button sx={{ mt: 2.5 }} variant="contained" disabled={saving} onClick={() => void saveDraft()} startIcon={<SaveRounded />}>Salvar rascunho</Button>}
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6">Hipóteses selecionadas</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>A promoção registra exatamente o estudo, candidato e versão biométrica utilizados.</Typography>
            {parameterization.hypotheses.length === 0 ? <Typography color="text.secondary">Nenhuma hipótese de aderência foi promovida.</Typography> : <Stack divider={<Divider flexItem />}>
              {parameterization.hypotheses.map((selection) => <Box key={selection.id} sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                  <Box><Typography fontWeight={750}>{selection.hypothesisType}</Typography><Typography variant="body2" color="text.secondary">{selection.tableName} · {selection.versionLabel}</Typography></Box>
                  <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={`rank #${selection.candidateRank}`} />{parameterization.status === "DRAFT" && <Button size="small" color="error" disabled={saving} onClick={() => void removeHypothesis(selection.id)}>Remover</Button>}</Stack>
                </Stack>
              </Box>)}
            </Stack>}
          </Paper>
        </Stack>

        <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", alignSelf: "start" }}>
          <Stack direction="row" spacing={1} alignItems="center"><ScienceOutlined color="primary" /><Typography variant="h6">Promover estudo de aderência</Typography></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .75, mb: 2.5 }}>Estudos já vinculados à avaliação e estudos ainda sem vínculo podem ser promovidos. Um estudo sem vínculo passa a pertencer a esta avaliação na promoção.</Typography>
          {studies.length === 0 ? <Alert severity="info">Ainda não há estudo de aderência disponível para a avaliação #{evaluationId}.</Alert> : <Stack spacing={2.5}>
            {studies.map((study) => <Box key={study.id}>
              <Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={800}>{study.name}</Typography><Chip size="small" variant="outlined" label={study.evaluationId === null ? "Sem vínculo" : `Avaliação #${study.evaluationId}`} /></Stack>
              <Typography variant="body2" color="text.secondary">{study.hypothesisType} · {study.periodStart}–{study.periodEnd}</Typography>
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {study.candidates.map((candidate) => {
                  const selected = selectedByHypothesis.get(study.hypothesisType)?.candidateResultId === candidate.id;
                  return <Paper key={candidate.id} elevation={0} sx={{ p: 1.5, bgcolor: selected ? "action.selected" : "background.default" }}>
                    <Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ flex: 1 }}><Typography variant="body2" fontWeight={750}>#{candidate.rank} · {candidate.tableName}</Typography><Typography variant="caption" color="text.secondary">{candidate.versionLabel} · {candidate.rejectedTests} teste(s) rejeitado(s) · DQM {candidate.dqm.toPrecision(4)}</Typography></Box>{selected ? <Chip size="small" color="success" label="Selecionada" /> : parameterization.status === "DRAFT" ? <Button size="small" disabled={saving} onClick={() => void promote(candidate.id)}>Promover</Button> : null}</Stack>
                  </Paper>;
                })}
              </Stack>
            </Box>)}
          </Stack>}
        </Paper>
      </Box>
    </>}
  </Stack>;
}

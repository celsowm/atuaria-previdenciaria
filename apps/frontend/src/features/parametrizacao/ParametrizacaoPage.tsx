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
  type ParametrizacaoAtuarial,
  type ResumoParametrizacaoAtuarial,
  type DetalheEstudoAderencia,
  type DefinirValorParametroAtuarialInput
} from "../../api/client";

const numericSpecs = [
  { codigo: "ECONOMIC.REAL_INTEREST_RATE", categoria: "Econômicas", rotulo: "Taxa real de juros", unidade: "% a.a." },
  { codigo: "ECONOMIC.SALARY_GROWTH_RATE", categoria: "Econômicas", rotulo: "Crescimento real de salários", unidade: "% a.a." },
  { codigo: "ECONOMIC.BENEFIT_GROWTH_RATE", categoria: "Econômicas", rotulo: "Crescimento real de benefícios", unidade: "% a.a." },
  { codigo: "DEMOGRAPHIC.TURNOVER_RATE", categoria: "Demográficas", rotulo: "Rotatividade", unidade: "% a.a." }
] as const;

const financingMethods = ["AGGREGATE", "ENTRY_AGE_NORMAL", "INDIVIDUAL_AGGREGATE", "UNIT_CREDIT", "PROJECTED_UNIT_CREDIT"];

function statusLabel(status: string) {
  if (status === "RASCUNHO") return "Rascunho";
  if (status === "APROVADO") return "Aprovada";
  if (status === "SUBSTITUIDO") return "Substituída";
  return status;
}

function statusColor(status: string): "default" | "warning" | "success" {
  if (status === "RASCUNHO") return "warning";
  if (status === "APROVADO") return "success";
  return "default";
}

function parseStoredValue(jsonValor: string) {
  try {
    const value = JSON.parse(jsonValor) as unknown;
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  } catch {
    return "";
  }
}

export function ParametrizacaoPage({
  avaliacaoId,
  parameterizationId,
  onOpen,
  onBack
}: {
  avaliacaoId: number;
  parameterizationId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const [versoes, setVersions] = useState<ResumoParametrizacaoAtuarial[]>([]);
  const [parametrizacao, setParametrizacao] = useState<ParametrizacaoAtuarial | null>(null);
  const [studies, setStudies] = useState<DetalheEstudoAderencia[]>([]);
  const [numericValues, setNumericValues] = useState<Record<string, string>>({});
  const [financingMethod, setFinancingMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadVersions = async () => {
    const rows = await api.parametrizacoes(avaliacaoId);
    setVersions(rows);
    return rows;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadVersions(), api.estudosAderencia()])
      .then(async ([rows, studySummaries]) => {
        if (cancelled) return;
        if (!parameterizationId && rows.length > 0) {
          onOpen(rows[0].id);
          return;
        }

        if (parameterizationId) {
          const detail = await api.parametrizacao(parameterizationId);
          if (cancelled) return;
          if (detail.avaliacaoId !== avaliacaoId) throw new Error("A parametrização não pertence a esta avaliação.");
          setParametrizacao(detail);
          setNotes(detail.observacoes ?? "");
          const values: Record<string, string> = {};
          for (const item of detail.parametros) values[item.codigo] = parseStoredValue(item.jsonValor);
          setNumericValues(values);
          const method = detail.parametros.find((item) => item.codigo === "FINANCING.METHOD");
          setFinancingMethod(method ? parseStoredValue(method.jsonValor) : "");
        } else {
          setParametrizacao(null);
        }

        const usable = studySummaries.filter(
          (study) => study.avaliacaoId === avaliacaoId || study.avaliacaoId === null
        );
        const details = await Promise.all(usable.map((study) => api.estudoAderencia(study.id)));
        if (!cancelled) setStudies(details);
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Não foi possível carregar a parametrização."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [avaliacaoId, parameterizationId]);

  const selectedByHypothesis = useMemo(
    () => new Map((parametrizacao?.hipoteses ?? []).map((selection) => [selection.tipoHipotese, selection] as const)),
    [parametrizacao]
  );

  const createVersion = async (copyFromId?: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api.criarParametrizacao(avaliacaoId, copyFromId ? { copiarDeId: copyFromId } : {});
      await loadVersions();
      onOpen(created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a parametrização.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!parametrizacao) return;
    const parametros: DefinirValorParametroAtuarialInput[] = numericSpecs
      .filter((spec) => numericValues[spec.codigo]?.trim())
      .map((spec) => ({
        codigo: spec.codigo,
        categoria: spec.categoria,
        rotulo: spec.rotulo,
        tipoValor: "NUMBER" as const,
        jsonValor: JSON.stringify(Number(numericValues[spec.codigo].replace(",", "."))),
        unidade: spec.unidade,
        origem: "MANUAL"
      }));
    if (financingMethod) {
      parametros.push({
        codigo: "FINANCING.METHOD",
        categoria: "Financiamento",
        rotulo: "Método de financiamento",
        tipoValor: "TEXT",
        jsonValor: JSON.stringify(financingMethod),
        unidade: null,
        origem: "MANUAL"
      });
    }
    if (!parametros.length) {
      setError("Preencha ao menos um parâmetro antes de salvar.");
      return;
    }
    if (parametros.some((item) => item.tipoValor === "NUMBER" && !Number.isFinite(JSON.parse(item.jsonValor)))) {
      setError("Existe um parâmetro numérico inválido.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.atualizarParametrizacao(parametrizacao.id, { observacoes: notes || null });
      const updated = await api.definirParametrosAtuariais(parametrizacao.id, parametros);
      setParametrizacao(updated);
      await loadVersions();
      setSuccess("Rascunho salvo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const promote = async (candidateResultId: string) => {
    if (!parametrizacao) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.promoverCandidatoAderencia(parametrizacao.id, candidateResultId);
      setParametrizacao(updated);
      setSuccess("Hipótese promovida para a parametrização e vinculada a esta avaliação.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível promover a hipótese.");
    } finally {
      setSaving(false);
    }
  };

  const removeHypothesis = async (selectionId: string) => {
    if (!parametrizacao) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.removerHipoteseAtuarial(parametrizacao.id, selectionId);
      setParametrizacao(updated);
      setSuccess("Hipótese removida do rascunho.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover a hipótese.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!parametrizacao) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.aprovarParametrizacao(parametrizacao.id);
      setParametrizacao(updated);
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
      <Typography variant="overline" color="text.secondary">Avaliação #{avaliacaoId}</Typography>
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
          {versoes.map((version) => <Chip
            key={version.id}
            clickable
            onClick={() => onOpen(version.id)}
            variant={version.id === parametrizacao?.id ? "filled" : "outlined"}
            color={version.situacao === "APROVADO" ? "success" : version.situacao === "RASCUNHO" ? "warning" : "default"}
            label={`v${version.versao} · ${statusLabel(version.situacao)}`}
          />)}
          {versoes.length === 0 && <Typography variant="body2" color="text.secondary">Nenhuma versão criada.</Typography>}
        </Stack>
        {!parametrizacao || parametrizacao.situacao !== "RASCUNHO" ? <Button disabled={saving} variant="outlined" onClick={() => void createVersion(parametrizacao?.id)} startIcon={parametrizacao ? <ContentCopyRounded /> : undefined}>
          {parametrizacao ? "Nova versão" : "Criar parametrização"}
        </Button> : <Typography variant="caption" color="text.secondary">Conclua o rascunho atual antes de criar outra versão.</Typography>}
      </Stack>
    </Paper>

    {!parametrizacao ? <Paper elevation={0} sx={{ p: 5, textAlign: "center", border: "1px dashed", borderColor: "divider" }}>
      <Typography variant="h6">A avaliação ainda não possui parametrização.</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Crie a versão inicial para consolidar hipóteses e parâmetros da rodada.</Typography>
      <Button variant="contained" disabled={saving} onClick={() => void createVersion()}>Criar versão 1</Button>
    </Paper> : <>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h5">{parametrizacao.nome}</Typography><Chip size="small" color={statusColor(parametrizacao.situacao)} label={statusLabel(parametrizacao.situacao)} /></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>Versão {parametrizacao.versao} · atualizada em {new Date(parametrizacao.atualizadoEm).toLocaleString("pt-BR")}</Typography>
        </Box>
        {parametrizacao.situacao === "RASCUNHO" && <Stack alignItems={{ md: "flex-end" }}><Button variant="contained" color="success" disabled={saving} onClick={() => void approve()} startIcon={<CheckCircleRounded />}>Aprovar snapshot salvo</Button><Typography variant="caption" color="text.secondary">Salve alterações de parâmetros antes de aprovar.</Typography></Stack>}
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.15fr) minmax(420px, .85fr)" }, gap: 3 }}>
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6">Parâmetros da rodada</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2.5 }}>Os valores abaixo são fatos estruturados do snapshot e serão consumidos pelo motor de cálculo.</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              {numericSpecs.map((spec) => <TextField
                key={spec.codigo}
                label={spec.rotulo}
                value={numericValues[spec.codigo] ?? ""}
                onChange={(event) => setNumericValues((current) => ({ ...current, [spec.codigo]: event.target.value }))}
                disabled={parametrizacao.situacao !== "RASCUNHO"}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                helperText={spec.unidade}
              />)}
              <TextField
                select
                label="Método de financiamento"
                value={financingMethod}
                onChange={(event) => setFinancingMethod(event.target.value)}
                disabled={parametrizacao.situacao !== "RASCUNHO"}
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
              disabled={parametrizacao.situacao !== "RASCUNHO"}
              sx={{ mt: 2 }}
            />
            {parametrizacao.situacao === "RASCUNHO" && <Button sx={{ mt: 2.5 }} variant="contained" disabled={saving} onClick={() => void saveDraft()} startIcon={<SaveRounded />}>Salvar rascunho</Button>}
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6">Hipóteses selecionadas</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>A promoção registra exatamente o estudo, candidato e versão biométrica utilizados.</Typography>
            {parametrizacao.hipoteses.length === 0 ? <Typography color="text.secondary">Nenhuma hipótese de aderência foi promovida.</Typography> : <Stack divider={<Divider flexItem />}>
              {parametrizacao.hipoteses.map((selection) => <Box key={selection.id} sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                  <Box><Typography fontWeight={750}>{selection.tipoHipotese}</Typography><Typography variant="body2" color="text.secondary">{selection.nomeTabua} · {selection.rotuloVersao}</Typography></Box>
                  <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={`posicao #${selection.posicaoCandidata}`} />{parametrizacao.situacao === "RASCUNHO" && <Button size="small" color="error" disabled={saving} onClick={() => void removeHypothesis(selection.id)}>Remover</Button>}</Stack>
                </Stack>
              </Box>)}
            </Stack>}
          </Paper>
        </Stack>

        <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", alignSelf: "start" }}>
          <Stack direction="row" spacing={1} alignItems="center"><ScienceOutlined color="primary" /><Typography variant="h6">Promover estudo de aderência</Typography></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .75, mb: 2.5 }}>Estudos já vinculados à avaliação e estudos ainda sem vínculo podem ser promovidos. Um estudo sem vínculo passa a pertencer a esta avaliação na promoção.</Typography>
          {studies.length === 0 ? <Alert severity="info">Ainda não há estudo de aderência disponível para a avaliação #{avaliacaoId}.</Alert> : <Stack spacing={2.5}>
            {studies.map((study) => <Box key={study.id}>
              <Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={800}>{study.nome}</Typography><Chip size="small" variant="outlined" label={study.avaliacaoId === null ? "Sem vínculo" : `Avaliação #${study.avaliacaoId}`} /></Stack>
              <Typography variant="body2" color="text.secondary">{study.tipoHipotese} · {study.periodoInicial}–{study.periodoFinal}</Typography>
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {study.candidatos.map((candidate) => {
                  const selected = selectedByHypothesis.get(study.tipoHipotese)?.resultadoCandidatoId === candidate.id;
                  return <Paper key={candidate.id} elevation={0} sx={{ p: 1.5, bgcolor: selected ? "action.selected" : "background.default" }}>
                    <Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ flex: 1 }}><Typography variant="body2" fontWeight={750}>#{candidate.posicao} · {candidate.nomeTabua}</Typography><Typography variant="caption" color="text.secondary">{candidate.rotuloVersao} · {candidate.testesRejeitados} teste(s) rejeitado(s) · DQM {candidate.dqm.toPrecision(4)}</Typography></Box>{selected ? <Chip size="small" color="success" label="Selecionada" /> : parametrizacao.situacao === "RASCUNHO" ? <Button size="small" disabled={saving} onClick={() => void promote(candidate.id)}>Promover</Button> : null}</Stack>
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

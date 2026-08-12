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
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import {
  api,
  type Plano,
  type VersaoRegrasPlano,
  type ResumoVersaoRegrasPlano,
  type DefinirValorRegraPlanoInput
} from "../../api/client";

type RuleSpec = {
  codigo: string;
  categoria: string;
  rotulo: string;
  tipoValor: "NUMBER" | "INTEGER" | "TEXT" | "BOOLEAN";
  unidade?: string;
  helper?: string;
  options?: Array<{ value: string; rotulo: string }>;
};

const commonRules: RuleSpec[] = [
  { codigo: "ELIGIBILITY.NORMAL_RETIREMENT_AGE", categoria: "Elegibilidade", rotulo: "Idade normal de aposentadoria", tipoValor: "INTEGER", unidade: "anos" },
  { codigo: "ELIGIBILITY.MINIMUM_PLAN_MEMBERSHIP_YEARS", categoria: "Elegibilidade", rotulo: "Carência mínima no plano", tipoValor: "INTEGER", unidade: "anos" },
  { codigo: "ELIGIBILITY.MINIMUM_SPONSOR_SERVICE_YEARS", categoria: "Elegibilidade", rotulo: "Tempo mínimo de vínculo com patrocinador", tipoValor: "INTEGER", unidade: "anos" },
  { codigo: "CONTRIBUTION.PARTICIPANT_RATE", categoria: "Contribuições", rotulo: "Alíquota de contribuição do participante", tipoValor: "NUMBER", unidade: "%" },
  { codigo: "CONTRIBUTION.SPONSOR_RATE", categoria: "Contribuições", rotulo: "Alíquota de contribuição do patrocinador", tipoValor: "NUMBER", unidade: "%" },
  { codigo: "BENEFIT.PAYMENTS_PER_YEAR", categoria: "Benefícios", rotulo: "Pagamentos de benefício por ano", tipoValor: "INTEGER", unidade: "pagamentos" }
];

const modalityRules: Record<"BD" | "CD" | "CV", RuleSpec[]> = {
  BD: [
    {
      codigo: "BENEFIT.CALCULATION_BASIS",
      categoria: "Benefícios",
      rotulo: "Base de cálculo do benefício",
      tipoValor: "TEXT",
      options: [
        { value: "FINAL_SALARY", rotulo: "Salário final" },
        { value: "AVERAGE_SALARY", rotulo: "Média salarial" },
        { value: "FIXED_AMOUNT", rotulo: "Valor fixo" }
      ]
    },
    { codigo: "BENEFIT.REPLACEMENT_RATE", categoria: "Benefícios", rotulo: "Taxa-alvo de reposição", tipoValor: "NUMBER", unidade: "%" },
    { codigo: "BENEFIT.SALARY_AVERAGING_MONTHS", categoria: "Benefícios", rotulo: "Período de média salarial", tipoValor: "INTEGER", unidade: "meses" }
  ],
  CD: [
    {
      codigo: "BENEFIT.CALCULATION_BASIS",
      categoria: "Benefícios",
      rotulo: "Base de cálculo do benefício",
      tipoValor: "TEXT",
      options: [{ value: "ACCOUNT_BALANCE", rotulo: "Saldo de conta" }]
    },
    { codigo: "CONTRIBUTION.MATCHING_LIMIT_RATE", categoria: "Contribuições", rotulo: "Limite de matching do patrocinador", tipoValor: "NUMBER", unidade: "%" },
    { codigo: "BENEFIT.ANNUITY_CONVERSION_ENABLED", categoria: "Benefícios", rotulo: "Conversão atuarial do saldo em renda", tipoValor: "BOOLEAN" }
  ],
  CV: [
    {
      codigo: "BENEFIT.CALCULATION_BASIS",
      categoria: "Benefícios",
      rotulo: "Base de cálculo do benefício",
      tipoValor: "TEXT",
      options: [{ value: "HYBRID", rotulo: "Componente híbrido" }]
    },
    { codigo: "CONTRIBUTION.VARIABLE_RATE", categoria: "Contribuições", rotulo: "Alíquota variável de contribuição", tipoValor: "NUMBER", unidade: "%" },
    { codigo: "BENEFIT.DEFINED_COMPONENT_REPLACEMENT_RATE", categoria: "Benefícios", rotulo: "Taxa de reposição do componente definido", tipoValor: "NUMBER", unidade: "%" },
    { codigo: "BENEFIT.ACCOUNT_BALANCE_COMPONENT_ENABLED", categoria: "Benefícios", rotulo: "Possui componente baseado em saldo de conta", tipoValor: "BOOLEAN" }
  ]
};

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
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string" || typeof value === "number") return String(value);
  } catch {
    return "";
  }
  return "";
}

export function RegrasPlanoPage({
  planoId,
  rulesVersionId,
  onOpen,
  onBack
}: {
  planoId: string;
  rulesVersionId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const [plan, setPlan] = useState<Plano | null>(null);
  const [versoes, setVersions] = useState<ResumoVersaoRegrasPlano[]>([]);
  const [detail, setDetail] = useState<VersaoRegrasPlano | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [vigenciaInicial, setEffectiveFrom] = useState("");
  const [vigenciaFinal, setEffectiveTo] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const specs = useMemo(() => {
    const modality = (detail?.modalidade ?? plan?.modalidade) as "BD" | "CD" | "CV" | undefined;
    return modality ? [...commonRules, ...modalityRules[modality]] : commonRules;
  }, [detail?.modalidade, plan?.modalidade]);

  const knownCodes = useMemo(() => new Set(specs.map((spec) => spec.codigo)), [specs]);
  const additionalRules = useMemo(
    () => (detail?.regras ?? []).filter((rule) => !knownCodes.has(rule.codigo)),
    [detail?.regras, knownCodes]
  );

  const loadVersions = async () => {
    const rows = await api.versoesRegrasPlano(planoId);
    setVersions(rows);
    return rows;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.plan(planoId), loadVersions()])
      .then(async ([proximoPlano, rows]) => {
        if (cancelled) return;
        setPlan(proximoPlano);
        if (!rulesVersionId && rows.length > 0) {
          onOpen(rows[0].id);
          return;
        }
        if (!rulesVersionId) {
          setDetail(null);
          return;
        }
        const next = await api.versaoRegrasPlano(rulesVersionId);
        if (cancelled) return;
        if (next.planoId !== planoId) throw new Error("A versão de regras não pertence a este plano.");
        setDetail(next);
        setEffectiveFrom(next.vigenciaInicial ?? "");
        setEffectiveTo(next.vigenciaFinal ?? "");
        setNotes(next.observacoes ?? "");
        setValues(Object.fromEntries(next.regras.map((rule) => [rule.codigo, parseStoredValue(rule.jsonValor)])));
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Não foi possível carregar as regras do plano."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [planoId, rulesVersionId]);

  const createVersion = async (copyFromId?: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api.criarVersaoRegrasPlano(planoId, copyFromId ? { copiarDeId: copyFromId } : {});
      await loadVersions();
      onOpen(created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a versão de regras.");
    } finally {
      setSaving(false);
    }
  };

  const buildRules = (): DefinirValorRegraPlanoInput[] => {
    const catalogRules = specs.flatMap<DefinirValorRegraPlanoInput>((spec) => {
      const raw = values[spec.codigo]?.trim() ?? "";
      if (!raw) return [];

      let parsed: number | string | boolean;
      if (spec.tipoValor === "NUMBER") {
        parsed = Number(raw.replace(",", "."));
        if (!Number.isFinite(parsed)) throw new Error(`${spec.rotulo}: informe um número válido.`);
      } else if (spec.tipoValor === "INTEGER") {
        parsed = Number(raw);
        if (!Number.isInteger(parsed)) throw new Error(`${spec.rotulo}: informe um número inteiro.`);
      } else if (spec.tipoValor === "BOOLEAN") {
        if (!["true", "false"].includes(raw)) throw new Error(`${spec.rotulo}: selecione Sim ou Não.`);
        parsed = raw === "true";
      } else {
        parsed = raw;
      }

      return [{
        codigo: spec.codigo,
        categoria: spec.categoria,
        rotulo: spec.rotulo,
        tipoValor: spec.tipoValor,
        jsonValor: JSON.stringify(parsed),
        unidade: spec.unidade ?? null,
        origem: "PLAN_REGULATION"
      }];
    });

    const preservedExtensions: DefinirValorRegraPlanoInput[] = additionalRules.map((rule) => ({
      codigo: rule.codigo,
      categoria: rule.categoria,
      rotulo: rule.rotulo,
      tipoValor: rule.tipoValor as DefinirValorRegraPlanoInput["tipoValor"],
      jsonValor: rule.jsonValor,
      unidade: rule.unidade,
      origem: rule.origem
    }));

    return [...catalogRules, ...preservedExtensions];
  };

  const persistDraft = async () => {
    if (!detail) throw new Error("Versão de regras não carregada.");
    const regras = buildRules();
    await api.atualizarVersaoRegrasPlano(detail.id, {
      vigenciaInicial: vigenciaInicial || null,
      vigenciaFinal: vigenciaFinal || null,
      observacoes: notes || null
    });
    const updated = await api.definirValoresRegrasPlano(detail.id, regras);
    setDetail(updated);
    await loadVersions();
    return updated;
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await persistDraft();
      setSuccess("Rascunho das regras salvo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar as regras.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!detail) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await persistDraft();
      const approved = await api.aprovarVersaoRegrasPlano(saved.id);
      setDetail(approved);
      await loadVersions();
      setSuccess("Regras aprovadas, versionadas e congeladas.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível aprovar as regras.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ minHeight: 420, display: "grid", placeItems: "center" }}><CircularProgress size={30} /></Box>;
  }

  if (!plan) {
    return <Stack spacing={2}><Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ alignSelf: "flex-start" }}>Plano</Button><Alert severity="warning">{error ?? "Plano não encontrado."}</Alert></Stack>;
  }

  return <Stack spacing={3.5}>
    <Box>
      <Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ mb: 2 }}>Plano</Button>
      <Typography variant="overline" color="text.secondary">{plan.codigo} · {plan.modalidade}</Typography>
      <Typography variant="h4">Regras atuariais do plano</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 860 }}>
        Regulamento, elegibilidade, contribuições e fórmulas ficam em versões próprias. Uma versão aprovada é imutável e pode ser referenciada por uma execução atuarial histórica.
      </Typography>
    </Box>

    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
    {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
    <Alert severity="info">
      O sistema não preenche valores regulatórios por conta própria. Os campos abaixo devem refletir o regulamento e a nota técnica do plano; o catálogo é um contrato inicial e não limita regras adicionais expostas pela API.
    </Alert>

    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }}>
        <Typography fontWeight={750} sx={{ mr: 1 }}>Versões</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
          {versoes.map((version) => <Chip
            key={version.id}
            clickable
            onClick={() => onOpen(version.id)}
            variant={version.id === detail?.id ? "filled" : "outlined"}
            color={version.situacao === "APROVADO" ? "success" : version.situacao === "RASCUNHO" ? "warning" : "default"}
            label={`v${version.versao} · ${statusLabel(version.situacao)}`}
          />)}
          {versoes.length === 0 && <Typography variant="body2" color="text.secondary">Nenhuma versão criada.</Typography>}
        </Stack>
        <Button
          disabled={saving || versoes.some((version) => version.situacao === "RASCUNHO")}
          variant="outlined"
          onClick={() => void createVersion(detail?.id)}
          startIcon={detail ? <ContentCopyRounded /> : undefined}
        >
          {detail ? "Nova versão" : "Criar regras"}
        </Button>
      </Stack>
    </Paper>

    {!detail ? <Paper elevation={0} sx={{ p: 5, textAlign: "center", border: "1px dashed", borderColor: "divider" }}>
      <Typography variant="h6">O plano ainda não possui regras versionadas.</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Crie a versão 1 e transcreva somente os parâmetros confirmados no regulamento/nota técnica.</Typography>
      <Button variant="contained" disabled={saving} onClick={() => void createVersion()}>Criar versão 1</Button>
    </Paper> : <>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h5">{detail.nome}</Typography>
            <Chip size="small" color={statusColor(detail.situacao)} label={statusLabel(detail.situacao)} />
            <Chip size="small" variant="outlined" label={detail.modalidade} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>
            Versão {detail.versao} · atualizada em {new Date(detail.atualizadoEm).toLocaleString("pt-BR")}
          </Typography>
        </Box>
        {detail.situacao === "RASCUNHO" && <Stack direction="row" spacing={1}>
          <Button variant="outlined" disabled={saving} onClick={() => void saveDraft()} startIcon={<SaveRounded />}>Salvar</Button>
          <Button variant="contained" color="success" disabled={saving} onClick={() => void approve()} startIcon={<CheckCircleRounded />}>Aprovar e congelar</Button>
        </Stack>}
      </Stack>

      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">Vigência e referência</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mt: 2 }}>
          <TextField type="date" label="Início da vigência" value={vigenciaInicial} onChange={(event) => setEffectiveFrom(event.target.value)} disabled={detail.situacao !== "RASCUNHO"} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Fim da vigência" value={vigenciaFinal} onChange={(event) => setEffectiveTo(event.target.value)} disabled={detail.situacao !== "RASCUNHO"} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <TextField fullWidth multiline minRows={3} label="Notas e referências do regulamento / nota técnica" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={detail.situacao !== "RASCUNHO"} sx={{ mt: 2 }} />
      </Paper>

      {[...new Set(specs.map((spec) => spec.categoria))].map((categoria) => <Paper key={categoria} elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">{categoria}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 2 }}>
          {specs.filter((spec) => spec.categoria === categoria).map((spec) => {
            const value = values[spec.codigo] ?? "";
            const disabled = detail.situacao !== "RASCUNHO";
            if (spec.tipoValor === "BOOLEAN") {
              return <TextField key={spec.codigo} select label={spec.rotulo} value={value} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, [spec.codigo]: event.target.value }))} helperText={spec.helper}>
                <MenuItem value="">Não informado</MenuItem>
                <MenuItem value="true">Sim</MenuItem>
                <MenuItem value="false">Não</MenuItem>
              </TextField>;
            }
            if (spec.options) {
              return <TextField key={spec.codigo} select label={spec.rotulo} value={value} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, [spec.codigo]: event.target.value }))} helperText={spec.helper}>
                <MenuItem value="">Não informado</MenuItem>
                {spec.options.map((option) => <MenuItem key={option.value} value={option.value}>{option.rotulo}</MenuItem>)}
              </TextField>;
            }
            return <TextField
              key={spec.codigo}
              label={spec.rotulo}
              value={value}
              disabled={disabled}
              inputMode={spec.tipoValor === "NUMBER" || spec.tipoValor === "INTEGER" ? "decimal" : undefined}
              onChange={(event) => setValues((current) => ({ ...current, [spec.codigo]: event.target.value }))}
              helperText={spec.unidade ?? spec.helper}
            />;
          })}
        </Box>
      </Paper>)}

      {additionalRules.length > 0 && <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">Regras adicionais</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 1.5 }}>
          Extensões fora do catálogo visual são preservadas integralmente ao salvar este formulário. A edição dessas regras continua disponível pela API até que ganhem um componente específico na interface.
        </Typography>
        <Stack divider={<Divider />}>
          {additionalRules.map((rule) => <Box key={rule.id} sx={{ py: 1.25 }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
              <Box><Typography fontWeight={700}>{rule.rotulo}</Typography><Typography variant="body2" color="text.secondary">{rule.codigo} · {rule.categoria}</Typography></Box>
              <Chip size="small" variant="outlined" label={rule.tipoValor} />
            </Stack>
            <Typography variant="body2" sx={{ mt: .75, fontFamily: "monospace", overflowWrap: "anywhere" }}>{rule.jsonValor}{rule.unidade ? ` · ${rule.unidade}` : ""}</Typography>
            <Typography variant="caption" color="text.secondary">Origem: {rule.origem}</Typography>
          </Box>)}
        </Stack>
      </Paper>}

      {detail.rulesFingerprint && <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center"><FingerprintRounded color="primary" /><Typography variant="h6">Fingerprint das regras</Typography></Stack>
        <Typography sx={{ mt: 1.5, fontFamily: "monospace", fontSize: 13, overflowWrap: "anywhere" }}>{detail.rulesFingerprint}</Typography>
      </Paper>}

      {detail.situacao !== "RASCUNHO" && <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">Snapshot congelado</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 1.5 }}>Esta versão não pode mais ser editada. Para qualquer alteração, crie uma nova versão.</Typography>
        <Stack divider={<Divider />}>
          {detail.regras.map((rule) => <Box key={rule.id} sx={{ py: 1.25 }}>
            <Typography fontWeight={700}>{rule.rotulo}</Typography>
            <Typography variant="body2" color="text.secondary">{rule.codigo} · {rule.jsonValor}{rule.unidade ? ` · ${rule.unidade}` : ""}</Typography>
          </Box>)}
        </Stack>
      </Paper>}
    </>}
  </Stack>;
}

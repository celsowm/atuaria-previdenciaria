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
  type Plan,
  type PlanRulesVersion,
  type PlanRulesVersionSummary,
  type SetPlanRuleValueInput
} from "../../api/client";

type RuleSpec = {
  code: string;
  category: string;
  label: string;
  valueType: "NUMBER" | "INTEGER" | "TEXT" | "BOOLEAN";
  unit?: string;
  helper?: string;
  options?: Array<{ value: string; label: string }>;
};

const commonRules: RuleSpec[] = [
  { code: "ELIGIBILITY.NORMAL_RETIREMENT_AGE", category: "Elegibilidade", label: "Idade normal de aposentadoria", valueType: "INTEGER", unit: "anos" },
  { code: "ELIGIBILITY.MINIMUM_PLAN_MEMBERSHIP_YEARS", category: "Elegibilidade", label: "Carência mínima no plano", valueType: "INTEGER", unit: "anos" },
  { code: "ELIGIBILITY.MINIMUM_SPONSOR_SERVICE_YEARS", category: "Elegibilidade", label: "Tempo mínimo de vínculo com patrocinador", valueType: "INTEGER", unit: "anos" },
  { code: "CONTRIBUTION.PARTICIPANT_RATE", category: "Contribuições", label: "Alíquota de contribuição do participante", valueType: "NUMBER", unit: "%" },
  { code: "CONTRIBUTION.SPONSOR_RATE", category: "Contribuições", label: "Alíquota de contribuição do patrocinador", valueType: "NUMBER", unit: "%" },
  { code: "BENEFIT.PAYMENTS_PER_YEAR", category: "Benefícios", label: "Pagamentos de benefício por ano", valueType: "INTEGER", unit: "pagamentos" }
];

const modalityRules: Record<"BD" | "CD" | "CV", RuleSpec[]> = {
  BD: [
    {
      code: "BENEFIT.CALCULATION_BASIS",
      category: "Benefícios",
      label: "Base de cálculo do benefício",
      valueType: "TEXT",
      options: [
        { value: "FINAL_SALARY", label: "Salário final" },
        { value: "AVERAGE_SALARY", label: "Média salarial" },
        { value: "FIXED_AMOUNT", label: "Valor fixo" }
      ]
    },
    { code: "BENEFIT.REPLACEMENT_RATE", category: "Benefícios", label: "Taxa-alvo de reposição", valueType: "NUMBER", unit: "%" },
    { code: "BENEFIT.SALARY_AVERAGING_MONTHS", category: "Benefícios", label: "Período de média salarial", valueType: "INTEGER", unit: "meses" }
  ],
  CD: [
    {
      code: "BENEFIT.CALCULATION_BASIS",
      category: "Benefícios",
      label: "Base de cálculo do benefício",
      valueType: "TEXT",
      options: [{ value: "ACCOUNT_BALANCE", label: "Saldo de conta" }]
    },
    { code: "CONTRIBUTION.MATCHING_LIMIT_RATE", category: "Contribuições", label: "Limite de matching do patrocinador", valueType: "NUMBER", unit: "%" },
    { code: "BENEFIT.ANNUITY_CONVERSION_ENABLED", category: "Benefícios", label: "Conversão atuarial do saldo em renda", valueType: "BOOLEAN" }
  ],
  CV: [
    {
      code: "BENEFIT.CALCULATION_BASIS",
      category: "Benefícios",
      label: "Base de cálculo do benefício",
      valueType: "TEXT",
      options: [{ value: "HYBRID", label: "Componente híbrido" }]
    },
    { code: "CONTRIBUTION.VARIABLE_RATE", category: "Contribuições", label: "Alíquota variável de contribuição", valueType: "NUMBER", unit: "%" },
    { code: "BENEFIT.DEFINED_COMPONENT_REPLACEMENT_RATE", category: "Benefícios", label: "Taxa de reposição do componente definido", valueType: "NUMBER", unit: "%" },
    { code: "BENEFIT.ACCOUNT_BALANCE_COMPONENT_ENABLED", category: "Benefícios", label: "Possui componente baseado em saldo de conta", valueType: "BOOLEAN" }
  ]
};

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
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string" || typeof value === "number") return String(value);
  } catch {
    return "";
  }
  return "";
}

export function PlanRulesPage({
  planId,
  rulesVersionId,
  onOpen,
  onBack
}: {
  planId: string;
  rulesVersionId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [versions, setVersions] = useState<PlanRulesVersionSummary[]>([]);
  const [detail, setDetail] = useState<PlanRulesVersion | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const specs = useMemo(() => {
    const modality = (detail?.modality ?? plan?.modality) as "BD" | "CD" | "CV" | undefined;
    return modality ? [...commonRules, ...modalityRules[modality]] : commonRules;
  }, [detail?.modality, plan?.modality]);

  const loadVersions = async () => {
    const rows = await api.planRulesVersions(planId);
    setVersions(rows);
    return rows;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.plan(planId), loadVersions()])
      .then(async ([nextPlan, rows]) => {
        if (cancelled) return;
        setPlan(nextPlan);
        if (!rulesVersionId && rows.length > 0) {
          onOpen(rows[0].id);
          return;
        }
        if (!rulesVersionId) {
          setDetail(null);
          return;
        }
        const next = await api.planRulesVersion(rulesVersionId);
        if (cancelled) return;
        if (next.planId !== planId) throw new Error("A versão de regras não pertence a este plano.");
        setDetail(next);
        setEffectiveFrom(next.effectiveFrom ?? "");
        setEffectiveTo(next.effectiveTo ?? "");
        setNotes(next.notes ?? "");
        setValues(Object.fromEntries(next.rules.map((rule) => [rule.code, parseStoredValue(rule.valueJson)])));
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Não foi possível carregar as regras do plano."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [planId, rulesVersionId]);

  const createVersion = async (copyFromId?: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api.createPlanRulesVersion(planId, copyFromId ? { copyFromId } : {});
      await loadVersions();
      onOpen(created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a versão de regras.");
    } finally {
      setSaving(false);
    }
  };

  const buildRules = (): SetPlanRuleValueInput[] => {
    return specs.flatMap((spec) => {
      const raw = values[spec.code]?.trim() ?? "";
      if (!raw) return [];

      let parsed: number | string | boolean;
      if (spec.valueType === "NUMBER") {
        parsed = Number(raw.replace(",", "."));
        if (!Number.isFinite(parsed)) throw new Error(`${spec.label}: informe um número válido.`);
      } else if (spec.valueType === "INTEGER") {
        parsed = Number(raw);
        if (!Number.isInteger(parsed)) throw new Error(`${spec.label}: informe um número inteiro.`);
      } else if (spec.valueType === "BOOLEAN") {
        if (!['true', 'false'].includes(raw)) throw new Error(`${spec.label}: selecione Sim ou Não.`);
        parsed = raw === "true";
      } else {
        parsed = raw;
      }

      return [{
        code: spec.code,
        category: spec.category,
        label: spec.label,
        valueType: spec.valueType,
        valueJson: JSON.stringify(parsed),
        unit: spec.unit ?? null,
        source: "PLAN_REGULATION"
      }];
    });
  };

  const persistDraft = async () => {
    if (!detail) throw new Error("Versão de regras não carregada.");
    const rules = buildRules();
    await api.updatePlanRulesVersion(detail.id, {
      effectiveFrom: effectiveFrom || null,
      effectiveTo: effectiveTo || null,
      notes: notes || null
    });
    const updated = await api.setPlanRuleValues(detail.id, rules);
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
      const approved = await api.approvePlanRulesVersion(saved.id);
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
      <Typography variant="overline" color="text.secondary">{plan.code} · {plan.modality}</Typography>
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
          {versions.map((version) => <Chip
            key={version.id}
            clickable
            onClick={() => onOpen(version.id)}
            variant={version.id === detail?.id ? "filled" : "outlined"}
            color={version.status === "APPROVED" ? "success" : version.status === "DRAFT" ? "warning" : "default"}
            label={`v${version.version} · ${statusLabel(version.status)}`}
          />)}
          {versions.length === 0 && <Typography variant="body2" color="text.secondary">Nenhuma versão criada.</Typography>}
        </Stack>
        <Button
          disabled={saving || versions.some((version) => version.status === "DRAFT")}
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
            <Typography variant="h5">{detail.name}</Typography>
            <Chip size="small" color={statusColor(detail.status)} label={statusLabel(detail.status)} />
            <Chip size="small" variant="outlined" label={detail.modality} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>
            Versão {detail.version} · atualizada em {new Date(detail.updatedAt).toLocaleString("pt-BR")}
          </Typography>
        </Box>
        {detail.status === "DRAFT" && <Stack direction="row" spacing={1}>
          <Button variant="outlined" disabled={saving} onClick={() => void saveDraft()} startIcon={<SaveRounded />}>Salvar</Button>
          <Button variant="contained" color="success" disabled={saving} onClick={() => void approve()} startIcon={<CheckCircleRounded />}>Aprovar e congelar</Button>
        </Stack>}
      </Stack>

      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">Vigência e referência</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mt: 2 }}>
          <TextField type="date" label="Início da vigência" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} disabled={detail.status !== "DRAFT"} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Fim da vigência" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} disabled={detail.status !== "DRAFT"} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <TextField fullWidth multiline minRows={3} label="Notas e referências do regulamento / nota técnica" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={detail.status !== "DRAFT"} sx={{ mt: 2 }} />
      </Paper>

      {[...new Set(specs.map((spec) => spec.category))].map((category) => <Paper key={category} elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">{category}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 2 }}>
          {specs.filter((spec) => spec.category === category).map((spec) => {
            const value = values[spec.code] ?? "";
            const disabled = detail.status !== "DRAFT";
            if (spec.valueType === "BOOLEAN") {
              return <TextField key={spec.code} select label={spec.label} value={value} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, [spec.code]: event.target.value }))} helperText={spec.helper}>
                <MenuItem value="">Não informado</MenuItem>
                <MenuItem value="true">Sim</MenuItem>
                <MenuItem value="false">Não</MenuItem>
              </TextField>;
            }
            if (spec.options) {
              return <TextField key={spec.code} select label={spec.label} value={value} disabled={disabled} onChange={(event) => setValues((current) => ({ ...current, [spec.code]: event.target.value }))} helperText={spec.helper}>
                <MenuItem value="">Não informado</MenuItem>
                {spec.options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
              </TextField>;
            }
            return <TextField
              key={spec.code}
              label={spec.label}
              value={value}
              disabled={disabled}
              inputMode={spec.valueType === "NUMBER" || spec.valueType === "INTEGER" ? "decimal" : undefined}
              onChange={(event) => setValues((current) => ({ ...current, [spec.code]: event.target.value }))}
              helperText={spec.unit ?? spec.helper}
            />;
          })}
        </Box>
      </Paper>)}

      {detail.rulesFingerprint && <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center"><FingerprintRounded color="primary" /><Typography variant="h6">Fingerprint das regras</Typography></Stack>
        <Typography sx={{ mt: 1.5, fontFamily: "monospace", fontSize: 13, overflowWrap: "anywhere" }}>{detail.rulesFingerprint}</Typography>
      </Paper>}

      {detail.status !== "DRAFT" && <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">Snapshot congelado</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 1.5 }}>Esta versão não pode mais ser editada. Para qualquer alteração, crie uma nova versão.</Typography>
        <Stack divider={<Divider />}>
          {detail.rules.map((rule) => <Box key={rule.id} sx={{ py: 1.25 }}>
            <Typography fontWeight={700}>{rule.label}</Typography>
            <Typography variant="body2" color="text.secondary">{rule.code} · {rule.valueJson}{rule.unit ? ` · ${rule.unit}` : ""}</Typography>
          </Box>)}
        </Stack>
      </Paper>}
    </>}
  </Stack>;
}

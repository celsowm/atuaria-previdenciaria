import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { api, type Plan } from "../../api/client";

type Props = {
  planId?: string;
  onOpenPlan: (id: string) => void;
  onOpenRules: (id: string) => void;
  onBack: () => void;
};

const modalityLabels: Record<string, string> = {
  BD: "Benefício Definido",
  CD: "Contribuição Definida",
  CV: "Contribuição Variável"
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  CLOSED: "Encerrado"
};

export function PlansPage({ planId, onOpenPlan, onOpenRules, onBack }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setPlans(await api.plans());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os planos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const selected = useMemo(() => plans.find((plan) => plan.id === planId), [plans, planId]);

  if (loading && plans.length === 0) {
    return <Box sx={{ minHeight: 360, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>;
  }

  if (planId && !selected) {
    return <Stack spacing={2}><Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ alignSelf: "flex-start" }}>Planos</Button><Alert severity="warning">Plano não encontrado.</Alert></Stack>;
  }

  if (selected) {
    return <PlanDetail plan={selected} onBack={onBack} onOpenRules={() => onOpenRules(selected.id)} onUpdated={(updated) => setPlans((current) => current.map((plan) => plan.id === updated.id ? updated : plan))} />;
  }

  return (
    <Stack spacing={3.5}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" } }}>
        <Box>
          <Typography variant="overline" color="text.secondary">Cadastro mestre</Typography>
          <Typography variant="h4">Planos</Typography>
          <Typography color="text.secondary" sx={{ mt: .75 }}>Planos previdenciários que organizam avaliações, massas, hipóteses, regras atuariais e documentos.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Novo plano</Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {plans.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, border: "1px dashed", borderColor: "divider", textAlign: "center" }}>
          <Typography variant="h6">Nenhum plano cadastrado</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>Cadastre o primeiro plano para iniciar a estrutura atuarial.</Typography>
          <Button variant="contained" onClick={() => setOpen(true)}>Cadastrar plano</Button>
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          {plans.map((plan) => (
            <Paper key={plan.id} elevation={0} sx={{ p: 2.25, border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(280px,1.5fr) 180px 180px 120px 40px" }, gap: 2, alignItems: "center" }}>
                <Box minWidth={0}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={750} noWrap>{plan.name}</Typography>
                    <Chip size="small" variant="outlined" label={plan.code} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: .4 }}>{plan.sponsorName || "Patrocinador não informado"}</Typography>
                </Box>
                <Box><Typography variant="caption" color="text.secondary">Modalidade</Typography><Typography variant="body2" fontWeight={650}>{modalityLabels[plan.modality] ?? plan.modality}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">CNPJ</Typography><Typography variant="body2">{plan.cnpj || "—"}</Typography></Box>
                <Chip size="small" label={statusLabels[plan.status] ?? plan.status} color={plan.status === "ACTIVE" ? "success" : "default"} variant={plan.status === "ACTIVE" ? "filled" : "outlined"} />
                <Button aria-label={`Abrir ${plan.name}`} onClick={() => onOpenPlan(plan.id)} sx={{ minWidth: 36, px: 0 }}><ArrowForwardRounded /></Button>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      <CreatePlanDialog open={open} onClose={() => setOpen(false)} onCreated={(plan) => {
        setPlans((current) => [...current, plan].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
        setOpen(false);
        onOpenPlan(plan.id);
      }} />
    </Stack>
  );
}

function PlanDetail({ plan, onBack, onOpenRules, onUpdated }: { plan: Plan; onBack: () => void; onOpenRules: () => void; onUpdated: (plan: Plan) => void }) {
  const [status, setStatus] = useState(plan.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveStatus = async (next: string) => {
    setStatus(next as Plan["status"]);
    setSaving(true);
    try {
      const updated = await api.updatePlan(plan.id, { status: next as Plan["status"] });
      onUpdated(updated);
      setError(null);
    } catch (reason) {
      setStatus(plan.status);
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Button onClick={onBack} startIcon={<ArrowBackRounded />} sx={{ alignSelf: "flex-start" }}>Planos</Button>
      {error && <Alert severity="error">{error}</Alert>}
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Chip size="small" variant="outlined" label={plan.code} /><Chip size="small" label={modalityLabels[plan.modality] ?? plan.modality} /></Stack>
        <Typography variant="h4">{plan.name}</Typography>
        <Typography color="text.secondary" sx={{ mt: .75 }}>{plan.sponsorName || "Patrocinador não informado"}</Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.25, border: "1px solid", borderColor: "divider" }}><Typography variant="caption" color="text.secondary">Modalidade</Typography><Typography fontWeight={700} sx={{ mt: .5 }}>{modalityLabels[plan.modality] ?? plan.modality}</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.25, border: "1px solid", borderColor: "divider" }}><Typography variant="caption" color="text.secondary">CNPJ</Typography><Typography fontWeight={700} sx={{ mt: .5 }}>{plan.cnpj || "Não informado"}</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.25, border: "1px solid", borderColor: "divider" }}><TextField select fullWidth size="small" label="Situação" value={status} disabled={saving} onChange={(event) => void saveStatus(event.target.value)}><MenuItem value="ACTIVE">Ativo</MenuItem><MenuItem value="INACTIVE">Inativo</MenuItem><MenuItem value="CLOSED">Encerrado</MenuItem></TextField></Paper>
      </Box>
      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} alignItems={{ sm: "center" }}>
          <Box><Typography variant="h6">Regras atuariais</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Versione vigência, elegibilidade, contribuições e regras de benefício sem alterar o cadastro mestre.</Typography></Box>
          <Button variant="contained" onClick={onOpenRules}>Abrir regras</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

function CreatePlanDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (plan: Plan) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [modality, setModality] = useState<"BD" | "CD" | "CV">("BD");
  const [sponsorName, setSponsorName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const plan = await api.createPlan({ code, name, modality, sponsorName: sponsorName || undefined, cnpj: cnpj || undefined });
      setCode("");
      setName("");
      setModality("BD");
      setSponsorName("");
      setCnpj("");
      onCreated(plan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ component: "form", onSubmit: submit }}>
      <DialogTitle>Novo plano</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Código" value={code} onChange={(event) => setCode(event.target.value)} required autoFocus />
          <TextField label="Nome do plano" value={name} onChange={(event) => setName(event.target.value)} required />
          <TextField select label="Modalidade" value={modality} onChange={(event) => setModality(event.target.value as "BD" | "CD" | "CV")}><MenuItem value="BD">Benefício Definido (BD)</MenuItem><MenuItem value="CD">Contribuição Definida (CD)</MenuItem><MenuItem value="CV">Contribuição Variável (CV)</MenuItem></TextField>
          <TextField label="Patrocinador" value={sponsorName} onChange={(event) => setSponsorName(event.target.value)} />
          <TextField label="CNPJ" value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Criando…" : "Criar plano"}</Button></DialogActions>
    </Dialog>
  );
}

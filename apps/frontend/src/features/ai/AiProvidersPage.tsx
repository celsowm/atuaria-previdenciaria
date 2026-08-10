import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import MemoryRounded from "@mui/icons-material/MemoryRounded";
import { api, type LlmProvider } from "../../api/client";

export function AiProvidersPage() {
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.llmProviders()
      .then(setProviders)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Falha ao carregar providers"))
      .finally(() => setLoading(false));
  }, []);

  return <Stack spacing={4}>
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: { xs: "flex-start", md: "center" }, flexDirection: { xs: "column", md: "row" } }}>
      <Box><Typography variant="overline" color="text.secondary">Inteligência Artificial</Typography><Typography variant="h4">Providers OpenAI-compatible</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>Modelos, múltiplas credenciais e roteamento ficam desacoplados das funcionalidades do ATUAS.</Typography></Box>
      <Button variant="contained" startIcon={<AddRounded />}>Novo provider</Button>
    </Box>

    {error && <Alert severity="warning">{error}</Alert>}
    {loading ? <Box sx={{ py: 8, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box> : <Stack spacing={1.5}>
      {providers.map((provider) => <Paper key={provider.id} elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 1.5fr 1fr auto" }, gap: 2.5, alignItems: "center" }}>
          <Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.main" }}><MemoryRounded /></Box><Box><Typography fontWeight={750}>{provider.name}</Typography><Chip size="small" color={provider.enabled ? "success" : "default"} label={provider.enabled ? "Ativo" : "Desativado"} sx={{ mt: .6 }} /></Box></Stack>
          <Box><Typography variant="body2" color="text.secondary">Endpoint</Typography><Typography variant="body2" fontWeight={650} sx={{ overflowWrap: "anywhere" }}>{provider.baseUrl}</Typography></Box>
          <Box><Typography variant="body2" color="text.secondary">Modelo padrão</Typography><Typography variant="body2" fontWeight={650}>{provider.model}</Typography></Box>
          <Stack direction="row" spacing={.7} alignItems="center" sx={{ color: "text.secondary" }}><KeyRounded fontSize="small" /><Typography variant="body2">{provider.credentialCount} {provider.credentialCount === 1 ? "credencial" : "credenciais"}</Typography></Stack>
        </Box>
      </Paper>)}
    </Stack>}

    <Alert severity="info">As credenciais são referências de segredo; a chave real não precisa ficar armazenada em texto puro no SQLite.</Alert>
  </Stack>;
}

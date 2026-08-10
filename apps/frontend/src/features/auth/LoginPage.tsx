import { useState, type FormEvent } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { api, setAuthToken, type AuthUser } from "../../api/client";

type Props = {
  onAuthenticated: (user: AuthUser) => void;
};

export function LoginPage({ onAuthenticated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(email, password);
      setAuthToken(result.token);
      onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2, py: 6, bgcolor: "background.default" }}>
      <Paper elevation={0} sx={{ width: "100%", maxWidth: 420, p: { xs: 3, sm: 4 }, border: "1px solid", borderColor: "divider", borderRadius: 4 }}>
        <Stack spacing={3} component="form" onSubmit={submit}>
          <Stack spacing={1.5} alignItems="center" textAlign="center">
            <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: "primary.main", fontWeight: 800 }}>A</Avatar>
            <Box>
              <Typography variant="h5" fontWeight={800}>Entrar no ATUAS</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: .75 }}>Atuária Previdenciária</Typography>
            </Box>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={2}>
            <TextField
              label="E-mail"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
            <TextField
              label="Senha"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Stack>

          <Button type="submit" variant="contained" size="large" disabled={loading} startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LockOutlined />}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>

          <Typography variant="caption" color="text.secondary" textAlign="center">
            O primeiro administrador é criado pelo backend a partir das variáveis ATUAS_BOOTSTRAP_ADMIN_*.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}

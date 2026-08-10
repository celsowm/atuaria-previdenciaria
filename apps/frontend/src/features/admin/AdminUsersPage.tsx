import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import { api, type AuthUser } from "../../api/client";

type UserRole = AuthUser["role"];

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "actuary", label: "Atuário" },
  { value: "reviewer", label: "Revisor" }
] as const satisfies ReadonlyArray<{ value: UserRole; label: string }>;

function roleLabel(role: UserRole) {
  return roles.find((candidate) => candidate.value === role)?.label ?? role;
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setUsers(await api.users());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const update = async (user: AuthUser, patch: { role?: UserRole; active?: boolean }) => {
    try {
      const updated = await api.updateUser(user.id, patch);
      setUsers((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o usuário.");
    }
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" } }}>
        <Box>
          <Typography variant="overline" color="text.secondary">Administração</Typography>
          <Typography variant="h4">Usuários</Typography>
          <Typography color="text.secondary" sx={{ mt: .75 }}>Contas locais, perfis de acesso e ativação.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Novo usuário</Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {loading && users.length === 0 ? (
        <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>
      ) : (
        <Stack spacing={1.25}>
          {users.map((user) => (
            <Paper key={user.id} elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px,1fr) 180px 130px 150px" }, gap: 2, alignItems: "center" }}>
                <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                  <Avatar sx={{ width: 38, height: 38 }}>{user.displayName.slice(0, 2).toUpperCase()}</Avatar>
                  <Box minWidth={0}>
                    <Typography fontWeight={700} noWrap>{user.displayName}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
                  </Box>
                </Stack>
                <TextField
                  select
                  size="small"
                  label="Perfil"
                  value={user.role}
                  onChange={(event) => void update(user, { role: event.target.value as UserRole })}
                >
                  {roles.map((role) => <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>)}
                </TextField>
                <Chip size="small" variant="outlined" label={roleLabel(user.role)} />
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={<Switch checked={user.active} onChange={(_, checked) => void update(user, { active: checked })} />}
                  label={user.active ? "Ativo" : "Inativo"}
                />
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      <CreateUserDialog open={open} onClose={() => setOpen(false)} onCreated={(user) => {
        setUsers((current) => [...current, user].sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR")));
        setOpen(false);
      }} />
    </Stack>
  );
}

function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (user: AuthUser) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("actuary");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const user = await api.createUser({ displayName, email, password, role });
      setDisplayName("");
      setEmail("");
      setPassword("");
      setRole("actuary");
      onCreated(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o usuário.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Novo usuário</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nome" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoFocus />
            <TextField label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <TextField label="Senha inicial" type="password" helperText="Mínimo de 10 caracteres." value={password} onChange={(event) => setPassword(event.target.value)} required inputProps={{ minLength: 10 }} />
            <TextField select label="Perfil" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {roles.map((candidate) => <MenuItem key={candidate.value} value={candidate.value}>{candidate.label}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? "Criando…" : "Criar usuário"}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

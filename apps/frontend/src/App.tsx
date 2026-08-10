import { useEffect, useState } from "react";
import { Avatar, Box, ButtonBase, CircularProgress, Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import ApartmentOutlined from "@mui/icons-material/ApartmentOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import BiotechOutlined from "@mui/icons-material/BiotechOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import HubOutlined from "@mui/icons-material/HubOutlined";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import TableViewOutlined from "@mui/icons-material/TableViewOutlined";
import { api, clearAuthToken, getAuthToken, type AuthUser } from "./api/client";
import { AdherenceStudiesPage } from "./features/adherence/AdherenceStudiesPage";
import { AdminUsersPage } from "./features/admin/AdminUsersPage";
import { AiProvidersPage } from "./features/ai/AiProvidersPage";
import { LoginPage } from "./features/auth/LoginPage";
import { BiometricTablesPage } from "./features/biometrics/BiometricTablesPage";
import { CritiquePage } from "./features/critique/CritiquePage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { EvaluationPage } from "./features/evaluations/EvaluationPage";
import { ImportWizardPage } from "./features/data-studio/ImportWizardPage";

type Page = "dashboard" | "evaluation" | "import" | "critique" | "plans" | "assumptions" | "studies" | "documents" | "library" | "ai" | "admin";

const nav = [
  ["dashboard", "Avaliações", <AssessmentOutlined />],
  ["plans", "Planos", <ApartmentOutlined />],
  ["import", "Data Studio", <TableViewOutlined />],
  ["assumptions", "Hipóteses & Tábuas", <HubOutlined />],
  ["studies", "Estudos", <BiotechOutlined />],
  ["documents", "Documentos", <DescriptionOutlined />],
  ["library", "Biblioteca", <FolderOutlined />],
  ["ai", "IA", <AutoAwesomeOutlined />]
] as const;

const pageNames: Record<Page, string> = {
  dashboard: "Avaliações",
  evaluation: "Avaliação",
  import: "Data Studio",
  critique: "Crítica cadastral",
  plans: "Planos",
  assumptions: "Hipóteses & Tábuas",
  studies: "Estudos de Aderência",
  documents: "Documentos",
  library: "Biblioteca",
  ai: "Inteligência Artificial",
  admin: "Administração"
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "actuary") return "Atuário";
  if (role === "reviewer") return "Revisor";
  return role;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");
  const [critiqueImportJobId, setCritiqueImportJobId] = useState<string | null>(null);

  useEffect(() => {
    const unauthorized = () => setUser(null);
    window.addEventListener("atuas:unauthorized", unauthorized);

    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return () => window.removeEventListener("atuas:unauthorized", unauthorized);
    }

    api.me()
      .then(setUser)
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setAuthLoading(false));

    return () => window.removeEventListener("atuas:unauthorized", unauthorized);
  }, []);

  const openCritique = (importJobId: string) => {
    setCritiqueImportJobId(importJobId);
    setPage("critique");
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      clearAuthToken();
      setUser(null);
      setPage("dashboard");
    }
  };

  if (authLoading) {
    return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><CircularProgress size={30} /></Box>;
  }

  if (!user) {
    return <LoginPage onAuthenticated={(authenticated) => {
      setUser(authenticated);
      setPage("dashboard");
    }} />;
  }

  return <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "248px minmax(0, 1fr)" } }}>
    <Box component="aside" sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", p: 2, borderRight: "1px solid", borderColor: "divider", bgcolor: "background.paper", minHeight: "100vh", position: "sticky", top: 0, height: "100vh" }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1, py: 1.5, mb: 2 }}>
        <Avatar variant="rounded" sx={{ width: 34, height: 34, bgcolor: "primary.main", fontWeight: 800 }}>A</Avatar>
        <Box><Typography fontWeight={800} letterSpacing="-.02em">ATUAS</Typography><Typography variant="caption" color="text.secondary">Atuária Previdenciária</Typography></Box>
      </Stack>
      <Stack spacing={.5} sx={{ flex: 1 }}>
        {nav.map(([key, label, icon]) => <NavItem key={key} selected={page === key || (key === "dashboard" && page === "evaluation") || (key === "import" && page === "critique")} icon={icon} label={label} onClick={() => setPage(key)} />)}
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      {user.role === "admin" && <NavItem selected={page === "admin"} icon={<SettingsOutlined />} label="Administração" onClick={() => setPage("admin")} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 1, mt: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32 }}>{initials(user.displayName)}</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" fontWeight={700} noWrap>{user.displayName}</Typography><Typography variant="caption" color="text.secondary">{roleLabel(user.role)}</Typography></Box>
        <Tooltip title="Sair"><IconButton size="small" onClick={() => void logout()}><LogoutRounded fontSize="small" /></IconButton></Tooltip>
      </Stack>
    </Box>

    <Box component="main" sx={{ minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 3, lg: 4 }, maxWidth: 1480, mx: "auto" }}>
        {page === "dashboard" && <DashboardPage onOpenEvaluation={() => setPage("evaluation")} onImport={() => setPage("import")} />}
        {page === "evaluation" && <EvaluationPage onBack={() => setPage("dashboard")} />}
        {page === "import" && <ImportWizardPage onClose={() => setPage("dashboard")} onCritique={openCritique} />}
        {page === "critique" && critiqueImportJobId && <CritiquePage importJobId={critiqueImportJobId} onBack={() => setPage("import")} />}
        {page === "assumptions" && <BiometricTablesPage />}
        {page === "studies" && <AdherenceStudiesPage />}
        {page === "ai" && <AiProvidersPage />}
        {page === "admin" && user.role === "admin" && <AdminUsersPage />}
        {!(["dashboard", "evaluation", "import", "critique", "assumptions", "studies", "ai", "admin"] as Page[]).includes(page) && <Placeholder title={pageNames[page]} />}
      </Box>
    </Box>
  </Box>;
}

function NavItem({ selected, icon, label, onClick }: { selected: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <ButtonBase onClick={onClick} sx={{ width: "100%", borderRadius: 2, px: 1.25, py: 1, justifyContent: "flex-start", gap: 1.25, color: selected ? "primary.main" : "text.secondary", bgcolor: selected ? "primary.light" : "transparent", "&:hover": { bgcolor: selected ? "primary.light" : "action.hover" } }}><Box sx={{ display: "grid", placeItems: "center", "& svg": { fontSize: 20 } }}>{icon}</Box><Typography variant="body2" fontWeight={selected ? 750 : 600}>{label}</Typography></ButtonBase>;
}

function Placeholder({ title }: { title: string }) {
  return <Stack spacing={2} sx={{ py: 3 }}><Typography variant="overline" color="text.secondary">ATUAS</Typography><Typography variant="h4">{title}</Typography><Typography color="text.secondary" sx={{ maxWidth: 620 }}>Módulo reservado na arquitetura da v0.0.1. A fundação visual e de navegação já está pronta para receber o próximo slice funcional.</Typography></Stack>;
}

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  api,
  clearAuthToken,
  defaultApplicationConfig,
  getAuthToken,
  unauthorizedEventName,
  type ApplicationConfig,
  type AuthUser
} from "./api/client";
import { AdherenceStudiesPage } from "./features/adherence/AdherenceStudiesPage";
import { AdminUsersPage } from "./features/admin/AdminUsersPage";
import { AiProvidersPage } from "./features/ai/AiProvidersPage";
import { LoginPage } from "./features/auth/LoginPage";
import { BiometricTablesPage } from "./features/biometrics/BiometricTablesPage";
import { CritiquePage } from "./features/critique/CritiquePage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { EvaluationPage } from "./features/evaluations/EvaluationPage";
import { ImportWizardPage } from "./features/data-studio/ImportWizardPage";
import { PlansPage } from "./features/plans/PlansPage";
import { navigate, parseRoute, usePathname, type AppRoute } from "./routing";

const nav: Array<{ path: string; label: string; icon: ReactNode; active: AppRoute["name"][] }> = [
  { path: "/avaliacoes", label: "Avaliações", icon: <AssessmentOutlined />, active: ["evaluations"] },
  { path: "/planos", label: "Planos", icon: <ApartmentOutlined />, active: ["plans"] },
  { path: "/data-studio", label: "Data Studio", icon: <TableViewOutlined />, active: ["data-studio", "critique"] },
  { path: "/hipoteses-e-tabuas", label: "Hipóteses & Tábuas", icon: <HubOutlined />, active: ["assumptions"] },
  { path: "/estudos-de-aderencia", label: "Estudos", icon: <BiotechOutlined />, active: ["studies"] },
  { path: "/documentos", label: "Documentos", icon: <DescriptionOutlined />, active: ["documents"] },
  { path: "/biblioteca", label: "Biblioteca", icon: <FolderOutlined />, active: ["library"] },
  { path: "/inteligencia-artificial", label: "IA", icon: <AutoAwesomeOutlined />, active: ["ai"] }
];

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
  const pathname = usePathname();
  const route = parseRoute(pathname);
  const requestedPath = useRef(pathname === "/" || pathname === "/login" ? "/avaliacoes" : pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appConfig, setAppConfig] = useState<ApplicationConfig>(defaultApplicationConfig);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    void api.publicConfig()
      .then((config) => {
        setAppConfig(config);
        document.title = config.organizationName ? `${config.name} — ${config.organizationName}` : config.name;
      })
      .catch(() => {
        document.title = defaultApplicationConfig.name;
      });
  }, []);

  useEffect(() => {
    const unauthorized = () => {
      if (window.location.pathname !== "/login") requestedPath.current = window.location.pathname;
      setUser(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener(unauthorizedEventName, unauthorized);

    const token = getAuthToken();
    if (!token) {
      if (window.location.pathname !== "/login") navigate("/login", { replace: true });
      setAuthLoading(false);
      return () => window.removeEventListener(unauthorizedEventName, unauthorized);
    }

    api.me()
      .then((authenticated) => {
        setUser(authenticated);
        if (window.location.pathname === "/login" || window.location.pathname === "/") {
          navigate(requestedPath.current, { replace: true });
        }
      })
      .catch(() => {
        clearAuthToken();
        setUser(null);
        navigate("/login", { replace: true });
      })
      .finally(() => setAuthLoading(false));

    return () => window.removeEventListener(unauthorizedEventName, unauthorized);
  }, []);

  useEffect(() => {
    if (!authLoading && user && route.name === "admin-users" && user.role !== "admin") {
      navigate("/avaliacoes", { replace: true });
    }
  }, [authLoading, route.name, user]);

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      clearAuthToken();
      requestedPath.current = "/avaliacoes";
      setUser(null);
      navigate("/login", { replace: true });
    }
  };

  if (authLoading) {
    return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><CircularProgress size={30} /></Box>;
  }

  if (!user) {
    return <LoginPage config={appConfig} onAuthenticated={(authenticated) => {
      setUser(authenticated);
      navigate(requestedPath.current, { replace: true });
    }} />;
  }

  return <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "248px minmax(0, 1fr)" } }}>
    <Box component="aside" sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", p: 2, borderRight: "1px solid", borderColor: "divider", bgcolor: "background.paper", minHeight: "100vh", position: "sticky", top: 0, height: "100vh" }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1, py: 1.5, mb: 2 }}>
        <Avatar variant="rounded" sx={{ width: 34, height: 34, bgcolor: "primary.main", fontWeight: 800 }}>{initials(appConfig.name).slice(0, 1)}</Avatar>
        <Box sx={{ minWidth: 0 }}><Typography fontWeight={800} letterSpacing="-.02em" lineHeight={1.15}>{appConfig.name}</Typography><Typography variant="caption" color="text.secondary">{appConfig.organizationName ?? "Previdência Complementar"}</Typography></Box>
      </Stack>
      <Stack spacing={.5} sx={{ flex: 1 }}>
        {nav.map((item) => <NavItem key={item.path} selected={item.active.includes(route.name)} icon={item.icon} label={item.label} onClick={() => navigate(item.path)} />)}
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      {user.role === "admin" && <NavItem selected={route.name === "admin-users"} icon={<SettingsOutlined />} label="Administração" onClick={() => navigate("/administracao/usuarios")} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 1, mt: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32 }}>{initials(user.displayName)}</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" fontWeight={700} noWrap>{user.displayName}</Typography><Typography variant="caption" color="text.secondary">{roleLabel(user.role)}</Typography></Box>
        <Tooltip title="Sair"><IconButton size="small" onClick={() => void logout()}><LogoutRounded fontSize="small" /></IconButton></Tooltip>
      </Stack>
    </Box>

    <Box component="main" sx={{ minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 3, lg: 4 }, maxWidth: 1480, mx: "auto" }}>
        {route.name === "evaluations" && route.evaluationId === undefined && <DashboardPage onOpenEvaluation={(id) => navigate(`/avaliacoes/${id}`)} onImport={() => navigate("/data-studio")} />}
        {route.name === "evaluations" && route.evaluationId !== undefined && <EvaluationPage evaluationId={route.evaluationId} onBack={() => navigate("/avaliacoes")} />}
        {route.name === "plans" && <PlansPage planId={route.planId} onOpenPlan={(id) => navigate(`/planos/${id}`)} onBack={() => navigate("/planos")} />}
        {route.name === "data-studio" && <ImportWizardPage onClose={() => navigate("/avaliacoes")} onCritique={(id) => navigate(`/data-studio/criticas/${id}`)} />}
        {route.name === "critique" && <CritiquePage importJobId={route.importJobId} onBack={() => navigate("/data-studio")} />}
        {route.name === "assumptions" && <BiometricTablesPage />}
        {route.name === "studies" && <AdherenceStudiesPage />}
        {route.name === "ai" && <AiProvidersPage />}
        {route.name === "admin-users" && user.role === "admin" && <AdminUsersPage />}
        {route.name === "documents" && <Placeholder config={appConfig} title="Documentos" />}
        {route.name === "library" && <Placeholder config={appConfig} title="Biblioteca" />}
        {route.name === "not-found" && <NotFound />}
      </Box>
    </Box>
  </Box>;
}

function NavItem({ selected, icon, label, onClick }: { selected: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <ButtonBase onClick={onClick} sx={{ width: "100%", borderRadius: 2, px: 1.25, py: 1, justifyContent: "flex-start", gap: 1.25, color: selected ? "primary.main" : "text.secondary", bgcolor: selected ? "primary.light" : "transparent", "&:hover": { bgcolor: selected ? "primary.light" : "action.hover" } }}><Box sx={{ display: "grid", placeItems: "center", "& svg": { fontSize: 20 } }}>{icon}</Box><Typography variant="body2" fontWeight={selected ? 750 : 600}>{label}</Typography></ButtonBase>;
}

function Placeholder({ config, title }: { config: ApplicationConfig; title: string }) {
  return <Stack spacing={2} sx={{ py: 3 }}><Typography variant="overline" color="text.secondary">{config.name}</Typography><Typography variant="h4">{title}</Typography><Typography color="text.secondary" sx={{ maxWidth: 620 }}>Módulo reservado na arquitetura atual. A URL já é estável e pode ser compartilhada ou reaberta diretamente.</Typography></Stack>;
}

function NotFound() {
  return <Stack spacing={2} sx={{ py: 8, alignItems: "flex-start" }}><Typography variant="overline" color="text.secondary">404</Typography><Typography variant="h4">Página não encontrada</Typography><Typography color="text.secondary">A rota informada não existe nesta aplicação.</Typography><ButtonBase onClick={() => navigate("/avaliacoes")} sx={{ color: "primary.main", fontWeight: 700 }}>Voltar para avaliações</ButtonBase></Stack>;
}

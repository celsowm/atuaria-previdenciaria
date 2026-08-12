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
  type ConfiguracaoAplicacao,
  type UsuarioAutenticado
} from "./api/client";
import { EstudosAderenciaPage } from "./features/aderencia/EstudosAderenciaPage";
import { AdminUsersPage } from "./features/admin/AdminUsersPage";
import { AiProvidersPage } from "./features/ai/AiProvidersPage";
import { LoginPage } from "./features/auth/LoginPage";
import { TabuasBiometricasPage } from "./features/biometria/TabuasBiometricasPage";
import { CalculoPage } from "./features/calculo/CalculoPage";
import { FechamentoPage } from "./features/fechamento/FechamentoPage";
import { CriticaPage } from "./features/critica/CriticaPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { AvaliacaoPage } from "./features/avaliacoes/AvaliacaoPage";
import { AssistenteImportacaoPage } from "./features/estudio-dados/AssistenteImportacaoPage";
import { ParametrizacaoPage } from "./features/parametrizacao/ParametrizacaoPage";
import { RegrasPlanoPage } from "./features/planos/RegrasPlanoPage";
import { PlanosPage } from "./features/planos/PlanosPage";
import { navigate, parseRoute, usePathname, type AppRoute } from "./routing";

const nav: Array<{ path: string; rotulo: string; icon: ReactNode; active: AppRoute["name"][] }> = [
  { path: "/avaliacoes", rotulo: "Avaliações", icon: <AssessmentOutlined />, active: ["avaliacoes", "parametrizacao", "calculation", "closing"] },
  { path: "/planos", rotulo: "Planos", icon: <ApartmentOutlined />, active: ["plans", "plan-regras"] },
  { path: "/data-studio", rotulo: "Data Studio", icon: <TableViewOutlined />, active: ["data-studio", "critique"] },
  { path: "/hipoteses-e-tabuas", rotulo: "Hipóteses & Tábuas", icon: <HubOutlined />, active: ["assumptions"] },
  { path: "/estudos-de-aderencia", rotulo: "Estudos", icon: <BiotechOutlined />, active: ["studies"] },
  { path: "/documentos", rotulo: "Documentos", icon: <DescriptionOutlined />, active: ["documents"] },
  { path: "/biblioteca", rotulo: "Biblioteca", icon: <FolderOutlined />, active: ["library"] },
  { path: "/inteligencia-artificial", rotulo: "IA", icon: <AutoAwesomeOutlined />, active: ["ai"] }
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
  const [user, setUser] = useState<UsuarioAutenticado | null>(null);
  const [appConfig, setAppConfig] = useState<ConfiguracaoAplicacao>(defaultApplicationConfig);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    void api.publicConfig()
      .then((config) => {
        setAppConfig(config);
        document.title = config.organizationName ? `${config.nome} — ${config.organizationName}` : config.nome;
      })
      .catch(() => {
        document.title = defaultApplicationConfig.nome;
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
    if (!authLoading && user && route.name === "admin-usuarios" && user.perfil !== "admin") {
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
        <Avatar variant="rounded" sx={{ width: 34, height: 34, bgcolor: "primary.main", fontWeight: 800 }}>{initials(appConfig.nome).slice(0, 1)}</Avatar>
        <Box sx={{ minWidth: 0 }}><Typography fontWeight={800} letterSpacing="-.02em" lineHeight={1.15}>{appConfig.nome}</Typography><Typography variant="caption" color="text.secondary">{appConfig.organizationName ?? "Previdência Complementar"}</Typography></Box>
      </Stack>
      <Stack spacing={.5} sx={{ flex: 1 }}>
        {nav.map((item) => <NavItem key={item.path} selected={item.active.includes(route.name)} icon={item.icon} label={item.rotulo} onClick={() => navigate(item.path)} />)}
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      {user.perfil === "admin" && <NavItem selected={route.name === "admin-usuarios"} icon={<SettingsOutlined />} label="Administração" onClick={() => navigate("/administracao/usuarios")} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 1, mt: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32 }}>{initials(user.nomeExibicao)}</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" fontWeight={700} noWrap>{user.nomeExibicao}</Typography><Typography variant="caption" color="text.secondary">{roleLabel(user.perfil)}</Typography></Box>
        <Tooltip title="Sair"><IconButton size="small" onClick={() => void logout()}><LogoutRounded fontSize="small" /></IconButton></Tooltip>
      </Stack>
    </Box>

    <Box component="main" sx={{ minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 3, lg: 4 }, maxWidth: 1480, mx: "auto" }}>
        {route.name === "avaliacoes" && route.avaliacaoId === undefined && <DashboardPage onAbrirAvaliacao={(id) => navigate(`/avaliacoes/${id}`)} onImport={() => navigate("/data-studio")} />}
        {route.name === "avaliacoes" && route.avaliacaoId !== undefined && <AvaliacaoPage avaliacaoId={route.avaliacaoId} onBack={() => navigate("/avaliacoes")} onAbrirParametrizacao={() => navigate(`/avaliacoes/${route.avaliacaoId}/parametrizacao`)} onAbrirCalculo={() => navigate(`/avaliacoes/${route.avaliacaoId}/calculos`)} onOpenClosing={() => navigate(`/avaliacoes/${route.avaliacaoId}/fechamento`)} />}
        {route.name === "parametrizacao" && <ParametrizacaoPage avaliacaoId={route.avaliacaoId} parameterizationId={route.parameterizationId} onOpen={(id) => navigate(`/avaliacoes/${route.avaliacaoId}/parametrizacao/${id}`, { replace: route.parameterizationId === undefined })} onBack={() => navigate(`/avaliacoes/${route.avaliacaoId}`)} />}
        {route.name === "calculation" && <CalculoPage avaliacaoId={route.avaliacaoId} execucaoCalculoId={route.execucaoCalculoId} onOpen={(id) => navigate(`/avaliacoes/${route.avaliacaoId}/calculos/${id}`, { replace: route.execucaoCalculoId === undefined })} onBack={() => navigate(`/avaliacoes/${route.avaliacaoId}`)} onAbrirParametrizacao={() => navigate(`/avaliacoes/${route.avaliacaoId}/parametrizacao`)} onAbrirRegrasPlano={(planoId) => navigate(`/planos/${planoId}/regras`)} />}
        {route.name === "closing" && <FechamentoPage avaliacaoId={route.avaliacaoId} onBack={() => navigate(`/avaliacoes/${route.avaliacaoId}`)} />}
        {route.name === "plans" && <PlanosPage planoId={route.planoId} onAbrirPlano={(id) => navigate(`/planos/${id}`)} onOpenRules={(id) => navigate(`/planos/${id}/regras`)} onBack={() => navigate("/planos")} />}
        {route.name === "plan-regras" && <RegrasPlanoPage planoId={route.planoId} rulesVersionId={route.rulesVersionId} onOpen={(id) => navigate(`/planos/${route.planoId}/regras/${id}`, { replace: route.rulesVersionId === undefined })} onBack={() => navigate(`/planos/${route.planoId}`)} />}
        {route.name === "data-studio" && <AssistenteImportacaoPage onClose={() => navigate("/avaliacoes")} onCritique={(id) => navigate(`/data-studio/criticas/${id}`)} />}
        {route.name === "critique" && <CriticaPage importacaoId={route.importacaoId} onBack={() => navigate("/data-studio")} />}
        {route.name === "assumptions" && <TabuasBiometricasPage />}
        {route.name === "studies" && <EstudosAderenciaPage />}
        {route.name === "ai" && <AiProvidersPage />}
        {route.name === "admin-usuarios" && user.perfil === "admin" && <AdminUsersPage />}
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

function Placeholder({ config, title }: { config: ConfiguracaoAplicacao; title: string }) {
  return <Stack spacing={2} sx={{ py: 3 }}><Typography variant="overline" color="text.secondary">{config.nome}</Typography><Typography variant="h4">{title}</Typography><Typography color="text.secondary" sx={{ maxWidth: 620 }}>Módulo reservado na arquitetura atual. A URL já é estável e pode ser compartilhada ou reaberta diretamente.</Typography></Stack>;
}

function NotFound() {
  return <Stack spacing={2} sx={{ py: 8, alignItems: "flex-start" }}><Typography variant="overline" color="text.secondary">404</Typography><Typography variant="h4">Página não encontrada</Typography><Typography color="text.secondary">A rota informada não existe nesta aplicação.</Typography><ButtonBase onClick={() => navigate("/avaliacoes")} sx={{ color: "primary.main", fontWeight: 700 }}>Voltar para avaliações</ButtonBase></Stack>;
}

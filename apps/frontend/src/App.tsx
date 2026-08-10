import { useState } from "react";
import { Avatar, Box, ButtonBase, Divider, Stack, Typography } from "@mui/material";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import ApartmentOutlined from "@mui/icons-material/ApartmentOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import BiotechOutlined from "@mui/icons-material/BiotechOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import HubOutlined from "@mui/icons-material/HubOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import TableViewOutlined from "@mui/icons-material/TableViewOutlined";
import { AiProvidersPage } from "./features/ai/AiProvidersPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { EvaluationPage } from "./features/evaluations/EvaluationPage";
import { ImportWizardPage } from "./features/data-studio/ImportWizardPage";

type Page = "dashboard" | "evaluation" | "import" | "plans" | "assumptions" | "studies" | "documents" | "library" | "ai" | "admin";

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
  plans: "Planos",
  assumptions: "Hipóteses & Tábuas",
  studies: "Estudos de Aderência",
  documents: "Documentos",
  library: "Biblioteca",
  ai: "Inteligência Artificial",
  admin: "Administração"
};

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "248px minmax(0, 1fr)" } }}>
    <Box component="aside" sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", p: 2, borderRight: "1px solid", borderColor: "divider", bgcolor: "background.paper", minHeight: "100vh", position: "sticky", top: 0, height: "100vh" }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1, py: 1.5, mb: 2 }}>
        <Avatar variant="rounded" sx={{ width: 34, height: 34, bgcolor: "primary.main", fontWeight: 800 }}>A</Avatar>
        <Box><Typography fontWeight={800} letterSpacing="-.02em">ATUAS</Typography><Typography variant="caption" color="text.secondary">Atuária Previdenciária</Typography></Box>
      </Stack>
      <Stack spacing={.5} sx={{ flex: 1 }}>
        {nav.map(([key, label, icon]) => <NavItem key={key} selected={page === key || (key === "dashboard" && page === "evaluation")} icon={icon} label={label} onClick={() => setPage(key)} />)}
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <NavItem selected={page === "admin"} icon={<SettingsOutlined />} label="Administração" onClick={() => setPage("admin")} />
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 1, mt: 1.5 }}><Avatar sx={{ width: 32, height: 32 }}>CF</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700} noWrap>Usuário ATUAS</Typography><Typography variant="caption" color="text.secondary">Atuário</Typography></Box></Stack>
    </Box>

    <Box component="main" sx={{ minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 3, lg: 4 }, maxWidth: 1480, mx: "auto" }}>
        {page === "dashboard" && <DashboardPage onOpenEvaluation={() => setPage("evaluation")} onImport={() => setPage("import")} />}
        {page === "evaluation" && <EvaluationPage onBack={() => setPage("dashboard")} />}
        {page === "import" && <ImportWizardPage onClose={() => setPage("dashboard")} />}
        {page === "ai" && <AiProvidersPage />}
        {!(["dashboard", "evaluation", "import", "ai"] as Page[]).includes(page) && <Placeholder title={pageNames[page]} />}
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

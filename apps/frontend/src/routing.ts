import { useEffect, useState } from "react";

export type AppRoute =
  | { name: "login" }
  | { name: "avaliacoes"; avaliacaoId?: number }
  | { name: "parametrizacao"; avaliacaoId: number; parameterizationId?: string }
  | { name: "calculation"; avaliacaoId: number; execucaoCalculoId?: string }
  | { name: "closing"; avaliacaoId: number }
  | { name: "plans"; planoId?: string }
  | { name: "plan-regras"; planoId: string; rulesVersionId?: string }
  | { name: "data-studio" }
  | { name: "critique"; importacaoId: string }
  | { name: "assumptions" }
  | { name: "studies" }
  | { name: "documents" }
  | { name: "library" }
  | { name: "ai" }
  | { name: "admin-usuarios" }
  | { name: "not-found" };

function normalizedPath(pathname: string) {
  const withoutTrailing = pathname.replace(/\/+$/, "");
  return withoutTrailing || "/";
}

export function parseRoute(pathname: string): AppRoute {
  const path = normalizedPath(pathname);
  if (path === "/login") return { name: "login" };
  if (path === "/" || path === "/avaliacoes") return { name: "avaliacoes" };

  let match = /^\/avaliacoes\/(\d+)\/parametrizacao$/.exec(path);
  if (match) return { name: "parametrizacao", avaliacaoId: Number(match[1]) };
  match = /^\/avaliacoes\/(\d+)\/parametrizacao\/([0-9a-f-]+)$/i.exec(path);
  if (match) return { name: "parametrizacao", avaliacaoId: Number(match[1]), parameterizationId: match[2] };

  match = /^\/avaliacoes\/(\d+)\/calculos$/.exec(path);
  if (match) return { name: "calculation", avaliacaoId: Number(match[1]) };
  match = /^\/avaliacoes\/(\d+)\/calculos\/([0-9a-f-]+)$/i.exec(path);
  if (match) return { name: "calculation", avaliacaoId: Number(match[1]), execucaoCalculoId: match[2] };
  match = /^\/avaliacoes\/(\d+)\/fechamento$/.exec(path);
  if (match) return { name: "closing", avaliacaoId: Number(match[1]) };

  match = /^\/avaliacoes\/(\d+)$/.exec(path);
  if (match) return { name: "avaliacoes", avaliacaoId: Number(match[1]) };

  if (path === "/planos") return { name: "plans" };
  match = /^\/planos\/([0-9a-f-]+)\/regras$/i.exec(path);
  if (match) return { name: "plan-regras", planoId: match[1] };
  match = /^\/planos\/([0-9a-f-]+)\/regras\/([0-9a-f-]+)$/i.exec(path);
  if (match) return { name: "plan-regras", planoId: match[1], rulesVersionId: match[2] };
  match = /^\/planos\/([0-9a-f-]+)$/i.exec(path);
  if (match) return { name: "plans", planoId: match[1] };

  if (path === "/data-studio") return { name: "data-studio" };
  match = /^\/data-studio\/criticas\/([0-9a-f-]+)$/i.exec(path);
  if (match) return { name: "critique", importacaoId: match[1] };

  if (path === "/hipoteses-e-tabuas") return { name: "assumptions" };
  if (path === "/estudos-de-aderencia") return { name: "studies" };
  if (path === "/documentos") return { name: "documents" };
  if (path === "/biblioteca") return { name: "library" };
  if (path === "/inteligencia-artificial") return { name: "ai" };
  if (path === "/administracao/usuarios") return { name: "admin-usuarios" };
  return { name: "not-found" };
}

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (typeof window === "undefined") return;
  if (options.replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return pathname;
}

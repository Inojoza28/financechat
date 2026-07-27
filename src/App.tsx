import { useEffect, useState } from "react";
import { ChatPage } from "@/routes";
import { DashboardPage } from "@/routes/dashboard";
import { SettingsPage } from "@/routes/settings";

const titles: Record<string, string> = {
  "/": "HeyFin",
  "/dashboard": "Dashboard financeiro - HeyFin",
  "/settings": "Ajustes - HeyFin",
};

function normalizePath(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/settings") return pathname;
  return "/";
}

function usePathname() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const update = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener("popstate", update);
    window.addEventListener("finance-chat:navigate", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("finance-chat:navigate", update);
    };
  }, []);

  return pathname;
}

export function App() {
  const pathname = usePathname();

  useEffect(() => {
    document.title = titles[pathname] ?? "HeyFin";
    const canonicalUrl = `${window.location.origin}${pathname}`;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = canonicalUrl;
  }, [pathname]);

  if (pathname === "/dashboard") return <DashboardPage />;
  if (pathname === "/settings") return <SettingsPage />;
  return <ChatPage />;
}

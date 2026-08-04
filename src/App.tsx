import { useEffect, useState } from "react";
import { ChatPage } from "@/routes";
import { DashboardPage } from "@/routes/dashboard";
import { SettingsPage } from "@/routes/settings";
import { SupportPage } from "@/routes/support";
import { useFinance } from "@/lib/finance-store";

const titles: Record<string, string> = {
  "/": "HeyFin",
  "/dashboard": "Dashboard financeiro - HeyFin",
  "/settings": "Ajustes - HeyFin",
  "/support": "Apoiar - HeyFin",
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function normalizePath(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/settings" || pathname === "/support") {
    return pathname;
  }
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
  const { theme } = useFinance();

  useEffect(() => {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    const themeColor = isDark ? "#181b22" : "#1684d8";
    let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement("meta");
      metaTheme.name = "theme-color";
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = themeColor;
  }, [theme]);

  useEffect(() => {
    const pageTitle = titles[pathname] ?? "HeyFin";
    document.title = pageTitle;
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

    window.gtag?.("event", "page_view", {
      page_title: pageTitle,
      page_location: canonicalUrl,
      page_path: pathname,
    });
  }, [pathname]);

  if (pathname === "/dashboard") return <DashboardPage />;
  if (pathname === "/settings") return <SettingsPage />;
  if (pathname === "/support") return <SupportPage />;
  return <ChatPage />;
}

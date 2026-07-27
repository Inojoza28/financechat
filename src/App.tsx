import { useEffect, useState } from "react";
import { ChatPage } from "@/routes";
import { DashboardPage } from "@/routes/dashboard";
import { SettingsPage } from "@/routes/settings";

const titles: Record<string, string> = {
  "/": "Finance Chat",
  "/dashboard": "Dashboard financeiro - Finance Chat",
  "/settings": "Ajustes - Finance Chat",
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
    document.title = titles[pathname] ?? "Finance Chat";
  }, [pathname]);

  if (pathname === "/dashboard") return <DashboardPage />;
  if (pathname === "/settings") return <SettingsPage />;
  return <ChatPage />;
}

import { useEffect, useState } from "react";
import { HeartHandshake, MessageCircle, PieChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const logo = "/assets/imgs/logo.png";

const links = [
  { to: "/", label: "Chat", icon: MessageCircle },
  { to: "/dashboard", label: "Dashboard", icon: PieChart },
  { to: "/settings", label: "Ajustes", icon: Settings },
  { to: "/support", label: "Apoiar", icon: HeartHandshake },
] as const;

function normalizePath(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/settings" || pathname === "/support") {
    return pathname;
  }
  return "/";
}

function navigate(to: string) {
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("finance-chat:navigate"));
}

export function AppNav({ title }: { title?: string }) {
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

  return (
    <header className="glass sticky top-0 z-30 border-b border-border/50">
      <div className="mx-auto flex h-[58px] w-full max-w-3xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src={logo}
            alt="HeyFin chat"
            width={380}
            height={298}
            className="size-7 drop-shadow-sm"
          />
          <span className="truncate text-[15px] font-semibold">{title ?? "HeyFin"}</span>
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-border/40 bg-secondary/65 p-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <a
                key={to}
                href={to}
                aria-label={label}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(to);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-300",
                  active
                    ? "bg-surface text-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-surface/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

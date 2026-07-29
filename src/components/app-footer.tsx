import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mx-auto w-full max-w-3xl px-4 pb-7 pt-1">
      <div className="flex flex-col items-center justify-center gap-1.5 border-t border-border/45 pt-5 text-center">
        <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Dados salvos neste navegador
        </div>
        <p className="text-[11.5px] font-semibold tracking-[0.18em] text-muted-foreground/45">
          HEYFIN
        </p>
      </div>
    </footer>
  );
}

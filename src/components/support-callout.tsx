import { ArrowRight, HeartHandshake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

function navigate(to: string) {
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("finance-chat:navigate"));
}

export function SupportCallout() {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate("/support")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate("/support");
        }
      }}
      className="group w-full rounded-[18px] border border-primary/20 bg-surface p-4 text-left shadow-[0_8px_26px_-24px_oklch(0.2_0.02_260_/_24%)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_32px_-28px_oklch(0.45_0.12_245_/_34%)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.06] text-primary">
            <HeartHandshake className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-foreground">Apoiar o projeto</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.06] px-2 py-0.5 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" />
                voluntário
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Conheça uma forma simples de contribuir com a continuidade do HeyFin.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="pointer-events-none h-10 w-full justify-center gap-2 rounded-full border-primary/20 bg-background/80 px-4 text-[13px] text-primary shadow-[0_8px_20px_-24px_oklch(0.45_0.12_245_/_28%)] transition-colors group-hover:border-primary/35 group-hover:bg-primary/[0.045] sm:w-auto"
          tabIndex={-1}
        >
          Ver opções
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Button>
      </div>
    </div>
  );
}

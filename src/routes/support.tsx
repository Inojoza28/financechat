import { useState } from "react";
import { Check, Copy, HeartHandshake, KeyRound, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { MASKED_PIX_KEY, PIX_KEY } from "@/lib/support";

const logo = "/assets/imgs/logo.png";

const highlights = [
  {
    icon: Wrench,
    title: "Manutenção",
    text: "Ajuda a manter o HeyFin funcionando com cuidado, estabilidade e atenção aos detalhes.",
  },
  {
    icon: Sparkles,
    title: "Evolução",
    text: "Fortalece o desenvolvimento de melhorias úteis para o controle financeiro do dia a dia.",
  },
  {
    icon: ShieldCheck,
    title: "Voluntário",
    text: "Você contribui somente se quiser, no valor que fizer sentido para o seu momento.",
  },
];

export function SupportPage() {
  const [copied, setCopied] = useState(false);

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      toast.success("Chave Pix copiada! 💙 Obrigado por fortalecer o HeyFin.");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Não consegui copiar a chave Pix.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppNav title="Apoiar" />
      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:py-7">
        <section className="animate-rise overflow-hidden rounded-[20px] border border-primary/15 bg-surface p-5 shadow-soft sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/[0.055] px-2.5 py-1 text-[12px] font-medium text-primary">
                <HeartHandshake className="size-3.5 text-primary" />
                Apoio voluntário
              </div>
              <h1 className="mt-3 text-[29px] font-semibold leading-tight tracking-tight sm:text-[35px]">
                Apoie o HeyFin. 💙
              </h1>
              <p className="mt-2 max-w-[34rem] text-[15px] leading-relaxed text-muted-foreground">
                O HeyFin nasceu para tornar o controle financeiro mais simples, leve e humano.
                Se ele está ajudando você a se organizar melhor, seu apoio voluntário ajuda esse
                cuidado a continuar virando melhorias reais, com mais estabilidade, evolução e novas
                ideias para o app.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Contribua apenas se fizer sentido para você. Qualquer valor já fortalece o projeto.
              </p>
              <Button
                type="button"
                className="mt-4 h-11 w-full gap-2 rounded-full px-4 text-[13px] sm:h-10 sm:w-auto"
                onClick={copyPixKey}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copiado" : "Copiar chave Pix"}
              </Button>
            </div>

            <div className="hidden size-[104px] shrink-0 items-center justify-center rounded-[22px] border border-border/55 bg-background/70 shadow-[0_10px_28px_-24px_oklch(0.2_0.02_260_/_26%)] lg:flex">
              <img
                src={logo}
                alt="HeyFin"
                width={380}
                height={298}
                className="h-auto w-[76px] object-contain"
              />
            </div>
          </div>
        </section>

        <section className="mt-4 animate-rise rounded-[18px] border border-primary/20 bg-surface p-5 shadow-soft sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold text-foreground">
                Pix para apoiar o HeyFin:
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Basta copiar a chave Pix completa e escolher o valor que desejar no seu aplicativo
                bancário.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border/55 bg-background/75 p-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <KeyRound className="size-3.5 text-primary" />
              Chave Pix
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer rounded-2xl border border-border/55 bg-surface px-3.5 py-3 text-left transition-colors hover:border-primary/25 hover:bg-background sm:px-3 sm:py-2.5"
                onClick={copyPixKey}
                aria-label="Copiar chave Pix completa"
              >
                <code className="block break-all text-[12px] font-medium leading-relaxed text-foreground sm:text-[13px]">
                  {MASKED_PIX_KEY}
                </code>
              </button>
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 gap-2 rounded-2xl border-primary/32 bg-primary/[0.045] px-3 text-[12.5px] font-semibold text-primary shadow-[0_8px_22px_-22px_oklch(0.42_0.12_245_/_18%)] transition-all hover:border-primary/45 hover:bg-primary/[0.075] hover:!text-primary hover:shadow-[0_10px_24px_-22px_oklch(0.42_0.12_245_/_28%)] sm:h-auto"
                onClick={copyPixKey}
                aria-label="Copiar chave Pix completa"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </Button>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              A chave aparece mascarada por segurança, mas o botão copia o valor completo.
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="animate-rise rounded-[18px] border border-border/55 border-t-2 border-t-primary/50 bg-surface p-4 shadow-[0_8px_24px_-26px_oklch(0.24_0.03_260_/_18%)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-secondary/70 text-primary">
                  <Icon className="size-4" />
                </span>
                <p className="text-[14px] font-semibold text-foreground">{title}</p>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <footer className="flex items-center justify-center py-8 text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-border/60 bg-surface px-3.5 py-2 shadow-[0_8px_24px_-26px_oklch(0.24_0.03_260_/_20%)]">
            <img
              src={logo}
              alt=""
              width={380}
              height={298}
              className="h-auto w-9 object-contain opacity-95"
            />
            <p className="text-[14px] font-semibold text-foreground">HeyFin</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

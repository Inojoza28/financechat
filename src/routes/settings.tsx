import {
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Gauge,
  Info,
  Moon,
  PiggyBank,
  CircleOff,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  SunMedium,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { AppFooter } from "@/components/app-footer";
import { AppNav } from "@/components/app-nav";
import { SupportCallout } from "@/components/support-callout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  buildCSV,
  buildJSON,
  buildTXT,
  downloadFile,
  financeActions,
  formatBRL,
  getFinanceState,
  incomeLabel,
  localISODate,
  recommendedSpendingLimit,
  useFinance,
  validateImportableFinanceState,
  type IncomePeriod,
} from "@/lib/finance-store";

const PERIODS: { value: IncomePeriod; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "weekly", label: "Semanal" },
];

function moneyFromInput(value: string) {
  const cleanValue = value.replace(/[^\d,.-]/g, "");
  if (!cleanValue) return Number.NaN;

  const hasComma = cleanValue.includes(",");
  if (hasComma) {
    return Number(cleanValue.replace(/\./g, "").replace(",", "."));
  }

  const dotDecimalMatch = cleanValue.match(/^\d+\.\d{1,2}$/);
  if (dotDecimalMatch) {
    return Number(cleanValue);
  }

  return Number(cleanValue.replace(/\./g, ""));
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  return formatBRL(Number(digits) / 100);
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
          <p className="text-[13px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingsContent() {
  const state = useFinance();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(state.assistantName);
  const [amount, setAmount] = useState(state.income ? String(state.income.amount) : "");
  const [period, setPeriod] = useState<IncomePeriod>(state.income?.period ?? "monthly");
  const [firstAmount, setFirstAmount] = useState(String(state.income?.firstAmount ?? ""));
  const [secondAmount, setSecondAmount] = useState(String(state.income?.secondAmount ?? ""));
  const [autoDeposit, setAutoDeposit] = useState(state.income?.autoDeposit ?? true);
  const [payday, setPayday] = useState(String(state.income?.payday ?? 1));
  const [firstPaymentDate, setFirstPaymentDate] = useState(
    state.income?.firstPaymentDate ?? localISODate(),
  );
  const [firstPayday, setFirstPayday] = useState(String(state.income?.firstPayday ?? 5));
  const [secondPayday, setSecondPayday] = useState(String(state.income?.secondPayday ?? 20));
  const [spendingLimit, setSpendingLimit] = useState(
    state.spendingLimit != null ? formatBRL(state.spendingLimit) : "",
  );
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [backupHelpOpen, setBackupHelpOpen] = useState(false);
  const suggestedLimit = recommendedSpendingLimit(state.income);
  const configuredLimit = state.spendingLimit;

  const saveName = () => {
    financeActions.setAssistantName(name);
    toast.success("Nome do assistente atualizado.");
  };

  const saveIncome = () => {
    if (period === "biweekly") {
      const first = moneyFromInput(firstAmount);
      const second = moneyFromInput(secondAmount);
      const dayOne = Number(firstPayday);
      const dayTwo = Number(secondPayday);

      if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(second) || second < 0) {
        toast.error("Informe os dois valores da renda quinzenal.");
        return;
      }

      financeActions.setIncome(first + second, "biweekly", {
        autoDeposit,
        firstAmount: first,
        secondAmount: second,
        firstPayday: dayOne,
        secondPayday: dayTwo,
      });
      toast.success("Renda quinzenal atualizada.");
      return;
    }

    const value = moneyFromInput(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor de renda válido.");
      return;
    }
    financeActions.setIncome(value, period, {
      autoDeposit,
      payday: Number(payday),
      firstPaymentDate,
    });
    toast.success("Renda atualizada.");
  };

  const saveSpendingLimit = () => {
    const value = moneyFromInput(spendingLimit);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um limite de gastos válido.");
      return;
    }

    financeActions.setSpendingLimit(value);
    toast.success("Limite de gastos atualizado.");
  };

  const useSuggestedLimit = () => {
    if (suggestedLimit <= 0) {
      toast.error("Cadastre sua renda antes de usar a sugestão automática.");
      return;
    }

    setSpendingLimit(formatBRL(suggestedLimit));
    financeActions.setSpendingLimit(suggestedLimit);
    toast.success("Limite sugerido aplicado.");
  };

  const exportData = (kind: "csv" | "txt" | "json") => {
    const s = getFinanceState();
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "csv") {
      downloadFile(`finance-chat-${stamp}.csv`, `\uFEFF${buildCSV(s)}`, "text/csv");
    } else if (kind === "json") {
      downloadFile(`heyfin-backup-${stamp}.json`, buildJSON(s), "application/json");
    } else {
      downloadFile(`finance-chat-${stamp}.txt`, buildTXT(s), "text/plain");
    }
    toast.success(kind === "json" ? "Backup JSON exportado." : "Relatório gerado.");
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      validateImportableFinanceState(parsed);
      setPendingImport(parsed);
      setImportDialogOpen(true);
    } catch {
      toast.error("Esse arquivo não parece ser um backup válido do HeyFin.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const confirmImport = () => {
    try {
      financeActions.importState(pendingImport);
      setPendingImport(null);
      setImportDialogOpen(false);
      toast.success("Dados restaurados com sucesso.");
    } catch {
      toast.error("Esse arquivo não parece ser um backup válido do HeyFin.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-[26px] font-semibold">Ajustes</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Configure sua renda, exporte seus dados e controle o que fica salvo no navegador.
        </p>
      </div>

      <SupportCallout />

      <Section
        icon={state.theme === "dark" ? Moon : SunMedium}
        title="Aparência"
        description="Escolha entre modo claro e modo dark. O HeyFin mantém sua preferência neste navegador."
      >
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/65 p-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] sm:grid-cols-2 dark:bg-surface-muted/45 dark:shadow-none">
          {[
            {
              theme: "light" as const,
              title: "Modo Claro",
              description: "Visual limpo para o dia.",
              icon: SunMedium,
            },
            {
              theme: "dark" as const,
              title: "Modo Dark",
              description: "Mais confortável com pouca luz.",
              icon: Moon,
            },
          ].map((option) => {
            const selected = state.theme === option.theme;
            const OptionIcon = option.icon;

            return (
              <button
                key={option.theme}
                type="button"
                onClick={() => {
                  if (selected) return;
                  financeActions.setTheme(option.theme);
                  toast.success(
                    option.theme === "dark" ? "Modo Dark ativado." : "Modo claro ativado.",
                  );
                }}
                className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 ${
                  selected
                    ? "border-primary/35 bg-primary/[0.08] text-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.10)] dark:border-primary/35 dark:bg-primary/[0.12] dark:shadow-none"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-surface/80 hover:text-foreground dark:hover:border-border/60 dark:hover:bg-background/35"
                }`}
                aria-pressed={selected}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    selected
                      ? "border-primary/25 bg-primary text-primary-foreground"
                      : "border-border/60 bg-surface text-muted-foreground group-hover:text-foreground dark:bg-background/45"
                  }`}
                >
                  <OptionIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-tight">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/70 text-transparent group-hover:text-muted-foreground"
                  }`}
                  aria-hidden="true"
                >
                  <Check className="size-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        icon={Sparkles}
        title="Sugestões inteligentes"
        description="Ative ou desative atalhos sugeridos pelo Fin no chat."
      >
        <div className="rounded-2xl border border-border/55 bg-background/65 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.035)] dark:bg-surface-muted/35 dark:shadow-none">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-tight">
              Mostrar sugestões inteligentes da IA
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              Elas aparecem abaixo da resposta do Fin em horários ou períodos importantes.
            </p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              {
                enabled: true,
                title: "Ativadas",
                description: "Mostra atalhos no chat.",
                icon: Sparkles,
              },
              {
                enabled: false,
                title: "Desativadas",
                description: "O chat fica sem recomendações automáticas.",
                icon: X,
              },
            ].map((option) => {
              const selected = state.showSmartSuggestions === option.enabled;
              const OptionIcon = option.icon;

              return (
                <button
                  key={option.title}
                  type="button"
                  onClick={() => {
                    if (selected) return;
                    financeActions.setShowSmartSuggestions(option.enabled);
                    toast.success(
                      option.enabled ? "Sugestões ativadas." : "Sugestões desativadas.",
                    );
                  }}
                  className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 ${
                    selected
                      ? "border-emerald-400/28 bg-emerald-500/[0.075] text-foreground shadow-[0_8px_24px_hsl(155_70%_38%/0.08)] dark:bg-emerald-300/[0.09] dark:shadow-none"
                      : "border-border/45 bg-surface/55 text-muted-foreground hover:border-emerald-400/20 hover:bg-surface hover:text-foreground dark:bg-background/25 dark:hover:bg-background/40"
                  }`}
                  aria-pressed={selected}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      selected
                        ? "border-emerald-400/24 bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-200"
                        : "border-border/55 bg-background/65 text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <OptionIcon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold leading-tight">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                      selected
                        ? "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-slate-950"
                        : "bg-secondary/70 text-transparent group-hover:text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="size-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section
        icon={PiggyBank}
        title="Cofrinho"
        description="Ative metas financeiras quando quiser separar dinheiro para objetivos específicos."
      >
        <div className="rounded-2xl border border-border/55 bg-background/65 p-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.035)] dark:bg-surface-muted/35 dark:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-semibold leading-tight">Metas financeiras</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${
                    state.goalsEnabled
                      ? "border-emerald-300/55 bg-emerald-50 text-emerald-700 dark:border-success/30 dark:bg-success/[0.12] dark:text-success"
                      : "border-border/60 bg-secondary/70 text-muted-foreground"
                  }`}
                >
                  {state.goalsEnabled ? "Ativado" : "Desativado"}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Quando ativo, você pode visualizar e cadastrar metas no Dashboard. O Fin também pode sugerir guardar
                parte das entradas recebidas.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-1.5 rounded-2xl border border-border/55 bg-secondary/45 p-1.5 dark:bg-background/25 lg:w-[236px] lg:shrink-0">
              {[
                { enabled: false, label: "Desativado", icon: CircleOff },
                { enabled: true, label: "Ativado", icon: Check },
              ].map((option) => {
                const selected = state.goalsEnabled === option.enabled;
                const OptionIcon = option.icon;

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      if (selected) return;
                      financeActions.setGoalsEnabled(option.enabled);
                      toast.success(option.enabled ? "Cofrinho ativado." : "Cofrinho desativado.");
                    }}
                    className={`inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[12px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:gap-2 sm:px-3 ${
                      selected
                        ? option.enabled
                          ? "border-emerald-400/35 bg-emerald-500/[0.10] text-emerald-700 shadow-[0_8px_18px_hsl(155_70%_38%/0.07)] dark:bg-success/[0.13] dark:text-success dark:shadow-none"
                          : "border-border/70 bg-background text-foreground shadow-[0_6px_16px_hsl(var(--foreground)/0.045)] dark:bg-surface-muted/60 dark:shadow-none"
                        : "border-transparent bg-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground dark:hover:bg-surface-muted/45"
                    }`}
                    aria-pressed={selected}
                  >
                    <OptionIcon className="size-3.5 shrink-0 sm:size-4" strokeWidth={2.35} />
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section
        icon={UserRound}
        title="Seu assistente"
        description="Escolha o nome que aparece nas conversas e nos atalhos do chat."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="assistant" className="text-[13px]">
              Nome
            </Label>
            <Input
              id="assistant"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 rounded-xl"
            />
          </div>
          <Button onClick={saveName} className="w-full rounded-xl sm:w-auto">
            Salvar
          </Button>
        </div>
      </Section>

      <Section
        icon={Gauge}
        title="Limite de gastos"
        description="Defina o valor máximo que você quer usar como referência no período."
      >
        <div className="rounded-2xl border border-border/55 bg-background/65 p-3.5 dark:bg-surface-muted/35 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="min-w-0 rounded-xl border border-border/45 bg-surface/70 px-3 py-3 sm:border-0 sm:bg-transparent sm:p-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground sm:text-[12px] sm:normal-case sm:tracking-normal">
                Limite atual
              </p>
              <p className="mt-1.5 text-[21px] font-semibold leading-none tracking-tight sm:mt-1 sm:text-[22px]">
                {configuredLimit != null ? formatBRL(configuredLimit) : "Não definido"}
              </p>
            </div>
            {suggestedLimit > 0 && (
              <button
                type="button"
                onClick={useSuggestedLimit}
                className="inline-flex w-full items-center justify-center rounded-xl border border-primary/18 bg-primary/[0.04] px-3 py-2 text-center text-[12px] font-medium text-primary transition-colors hover:border-primary/30 hover:bg-primary/[0.07] sm:w-auto sm:rounded-full sm:py-1.5"
              >
                Usar sugestão {formatBRL(suggestedLimit)}
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="min-w-0">
              <Label htmlFor="spending-limit" className="text-[13px]">
                Novo limite
              </Label>
              <Input
                id="spending-limit"
                inputMode="decimal"
                placeholder={suggestedLimit > 0 ? formatBRL(suggestedLimit) : "R$ 1.800,00"}
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(formatMoneyInput(e.target.value))}
                className="mt-1.5 rounded-xl bg-surface"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={saveSpendingLimit} className="h-11 w-full rounded-xl px-5 sm:w-auto">
                {configuredLimit != null ? "Atualizar" : "Definir"}
              </Button>
              {configuredLimit != null && (
                <Button
                  variant="ghost"
                  className="hidden h-11 justify-center rounded-xl border border-destructive/18 bg-destructive/[0.045] px-4 text-[13px] font-medium text-destructive transition-colors hover:border-destructive/28 hover:bg-destructive/[0.09] hover:text-destructive sm:inline-flex"
                  onClick={() => {
                    setSpendingLimit("");
                    financeActions.setSpendingLimit(null);
                    toast.success("Limite removido.");
                  }}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Esse valor será usado nos alertas e projeções do HeyFin.
            </p>
            {configuredLimit != null && (
              <Button
                variant="ghost"
                className="h-9 w-full justify-center rounded-xl border border-destructive/18 bg-destructive/[0.045] px-3 text-[13px] font-medium text-destructive transition-colors hover:border-destructive/28 hover:bg-destructive/[0.09] hover:text-destructive sm:hidden"
                onClick={() => {
                  setSpendingLimit("");
                  financeActions.setSpendingLimit(null);
                  toast.success("Limite removido.");
                }}
              >
                Remover limite
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section
        icon={WalletCards}
        title="Renda"
        description="Defina valores, recorrência e datas exatas para que o saldo e as projeções respeitem seus pagamentos."
      >
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 p-3">
          <div>
            <Label htmlFor="auto-deposit" className="text-[13px] font-semibold">
              Lançar renda automaticamente
            </Label>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Quando ativo, cada pagamento entra no saldo apenas na data configurada.
            </p>
          </div>
          <Switch id="auto-deposit" checked={autoDeposit} onCheckedChange={setAutoDeposit} />
        </div>

        <div className="flex flex-wrap gap-1 rounded-full bg-secondary p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-300 ${
                period === p.value
                  ? "bg-surface text-foreground shadow-soft"
                  : "text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "biweekly" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="first-payday" className="text-[13px]">
                Primeira data
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="first-payday"
                  type="number"
                  min={1}
                  max={31}
                  value={firstPayday}
                  onChange={(e) => setFirstPayday(e.target.value)}
                  className="w-20 rounded-xl"
                />
                <Input
                  inputMode="decimal"
                  placeholder="2000"
                  value={firstAmount}
                  onChange={(e) => setFirstAmount(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="second-payday" className="text-[13px]">
                Segunda data
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="second-payday"
                  type="number"
                  min={1}
                  max={31}
                  value={secondPayday}
                  onChange={(e) => setSecondPayday(e.target.value)}
                  className="w-20 rounded-xl"
                />
                <Input
                  inputMode="decimal"
                  placeholder="1800"
                  value={secondAmount}
                  onChange={(e) => setSecondAmount(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="income" className="text-[13px]">
                Valor
              </Label>
              <Input
                id="income"
                inputMode="decimal"
                placeholder={period === "weekly" ? "700" : "4500"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 rounded-xl"
              />
            </div>
            {period === "monthly" ? (
              <div>
                <Label htmlFor="monthly-payday" className="text-[13px]">
                  Dia de recebimento
                </Label>
                <Input
                  id="monthly-payday"
                  type="number"
                  min={1}
                  max={31}
                  value={payday}
                  onChange={(e) => setPayday(e.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="weekly-first-payment" className="text-[13px]">
                  Primeira data de recebimento
                </Label>
                <Input
                  id="weekly-first-payment"
                  type="date"
                  value={firstPaymentDate}
                  onChange={(e) => setFirstPaymentDate(e.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
          <Button onClick={saveIncome} className="w-full rounded-xl sm:w-auto">
            <CalendarDays className="size-4" />
            Salvar renda
          </Button>
          {state.income && (
            <span className="text-center text-[13px] text-muted-foreground sm:text-left">
              Atual: {incomeLabel(state.income)}
            </span>
          )}
        </div>
      </Section>

      <Section
        icon={Download}
        title="Exportar e importar"
        description="Baixe relatórios ou salve um backup JSON para restaurar seus dados depois."
      >
        <div className="grid gap-3">
          <div className="rounded-2xl border border-primary/14 bg-primary/[0.035] p-3">
            <div className="mb-3">
              <p className="text-[13px] font-semibold text-foreground">Backup completo</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Use JSON para salvar ou restaurar renda, despesas, receitas, conversas e ajustes.
              </p>
            </div>
            <div className="mb-3 rounded-xl border border-border/55 bg-surface/80">
              <button
                type="button"
                onClick={() => setBackupHelpOpen((open) => !open)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                aria-expanded={backupHelpOpen}
                aria-controls="backup-json-help"
              >
                <Info className="size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">Entenda como salvar e restaurar seus dados.</span>
                <ChevronDown
                  className={`size-3.5 shrink-0 transition-transform duration-200 ${
                    backupHelpOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>
              <div
                id="backup-json-help"
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  backupHelpOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-border/45 px-3 pb-3 pt-2 text-[12px] leading-relaxed text-muted-foreground">
                    <p>
                      Ao exportar, o HeyFin cria um arquivo com uma cópia das suas informações, como
                      renda, despesas, receitas, conversas e ajustes.
                    </p>
                    <p className="mt-1.5">
                      Guarde esse arquivo em um local seguro. Se precisar recuperar seus dados
                      depois ou acessar em outro dispositivo, use <strong>Importar JSON</strong> e
                      selecione o backup salvo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full rounded-xl border-primary/25 bg-surface text-primary hover:bg-primary/[0.06] hover:text-primary"
                onClick={() => exportData("json")}
              >
                <FileJson className="size-4" /> Exportar JSON
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl bg-surface"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="size-4" /> Importar JSON
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Baixar relatórios rápidos</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Arquivos simples para consulta fora do HeyFin.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                onClick={() => exportData("csv")}
              >
                <FileSpreadsheet className="size-4" /> Planilha
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                onClick={() => exportData("txt")}
              >
                <FileText className="size-4" /> Texto
              </Button>
            </div>
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
        </div>
      </Section>

      <Section
        icon={ShieldAlert}
        title="Dados"
        description="Tudo fica salvo apenas neste navegador. Ações de limpeza pedem confirmação antes de continuar."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full rounded-xl">
                <RotateCcw className="size-4" /> Limpar conversa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[20px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar conversa atual?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação remove apenas as mensagens do mês atual. Renda e despesas continuam
                  salvas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:space-x-0">
                <AlertDialogCancel className="mt-0 rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-xl"
                  onClick={() => {
                    financeActions.resetConversation();
                    toast.success("Conversa limpa.");
                  }}
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full rounded-xl">
                <Trash2 className="size-4" /> Apagar todos os dados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[20px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação apaga renda, despesas e conversas deste navegador. Não dá para desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:space-x-0">
                <AlertDialogCancel className="mt-0 rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    financeActions.resetAll();
                    toast.success("Tudo apagado.");
                  }}
                >
                  Apagar definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>
      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent className="rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar dados do backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação substituirá os dados atuais deste navegador pelo conteúdo do arquivo JSON
              selecionado. Exporte um backup antes de continuar caso queira guardar o estado atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel className="mt-0 rounded-xl" onClick={() => setPendingImport(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={confirmImport}>
              Restaurar backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppNav title="Ajustes" />
      {mounted ? (
        <>
          <SettingsContent />
          <AppFooter />
        </>
      ) : null}
    </div>
  );
}

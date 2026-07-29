import {
  CalendarDays,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Gauge,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
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
  return Number(value.replace(/\./g, "").replace(",", "."));
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
  const [spendingLimit, setSpendingLimit] = useState(String(state.spendingLimit ?? ""));
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const suggestedLimit = recommendedSpendingLimit(state.income);

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

    setSpendingLimit(String(suggestedLimit));
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
        description="Defina um teto para o período. O app acompanha o consumo e avisa quando você se aproxima do limite."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="spending-limit" className="text-[13px]">
              Valor máximo por período
            </Label>
            <Input
              id="spending-limit"
              inputMode="decimal"
              placeholder={suggestedLimit > 0 ? String(suggestedLimit) : "1800"}
              value={spendingLimit}
              onChange={(e) => setSpendingLimit(e.target.value)}
              className="mt-1.5 rounded-xl"
            />
          </div>
          <Button onClick={saveSpendingLimit} className="w-full rounded-xl sm:w-auto">
            Salvar limite
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-center">
          <Button
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={useSuggestedLimit}
          >
            Usar 80% da renda
          </Button>
          {state.spendingLimit && (
            <Button
              variant="ghost"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => {
                setSpendingLimit("");
                financeActions.setSpendingLimit(null);
                toast.success("Limite removido.");
              }}
            >
              Remover limite
            </Button>
          )}
          <span className="text-center text-[13px] text-muted-foreground sm:text-left">
            Atual: {state.spendingLimit ? formatBRL(state.spendingLimit) : "não definido"}
          </span>
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
            <AlertDialogCancel
              className="mt-0 rounded-xl"
              onClick={() => setPendingImport(null)}
            >
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

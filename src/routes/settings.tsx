import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
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
import {
  buildCSV,
  buildTXT,
  downloadFile,
  financeActions,
  formatBRL,
  getFinanceState,
  incomeLabel,
  useFinance,
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
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingsContent() {
  const state = useFinance();
  const [name, setName] = useState(state.assistantName);
  const [amount, setAmount] = useState(state.income ? String(state.income.amount) : "");
  const [period, setPeriod] = useState<IncomePeriod>(state.income?.period ?? "monthly");
  const [firstAmount, setFirstAmount] = useState(String(state.income?.firstAmount ?? ""));
  const [secondAmount, setSecondAmount] = useState(String(state.income?.secondAmount ?? ""));
  const [firstPayday, setFirstPayday] = useState(String(state.income?.firstPayday ?? 5));
  const [secondPayday, setSecondPayday] = useState(String(state.income?.secondPayday ?? 20));

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
      toast.error("Informe um valor de renda valido.");
      return;
    }
    financeActions.setIncome(value, period);
    toast.success("Renda atualizada.");
  };

  const exportData = (kind: "csv" | "txt") => {
    const s = getFinanceState();
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "csv") {
      downloadFile(`finance-chat-${stamp}.csv`, `\uFEFF${buildCSV(s)}`, "text/csv");
    } else {
      downloadFile(`finance-chat-${stamp}.txt`, buildTXT(s), "text/plain");
    }
    toast.success("Relatorio gerado.");
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-[26px] font-semibold">Ajustes</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Configure sua renda, exporte seus dados e controle o que fica salvo no navegador.
        </p>
      </div>

      <Section
        icon={UserRound}
        title="Seu assistente"
        description="Escolha o nome que aparece nas conversas e nos atalhos do chat."
      >
        <div className="flex flex-wrap items-end gap-3">
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
          <Button onClick={saveName} className="rounded-xl">
            Salvar
          </Button>
        </div>
      </Section>

      <Section
        icon={WalletCards}
        title="Renda"
        description="Para renda quinzenal, informe as duas datas de recebimento e o valor de cada entrada."
      >
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
          <div className="mt-4 max-w-xs">
            <Label htmlFor="income" className="text-[13px]">
              Valor
            </Label>
            <Input
              id="income"
              inputMode="decimal"
              placeholder="4500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5 rounded-xl"
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={saveIncome} className="rounded-xl">
            <CalendarDays className="size-4" />
            Salvar renda
          </Button>
          {state.income && (
            <span className="text-[13px] text-muted-foreground">
              Atual: {incomeLabel(state.income)}
            </span>
          )}
        </div>
      </Section>

      <Section
        icon={Download}
        title="Exportar relatorio"
        description="Baixe receitas, despesas, saldos e resumos em um arquivo completo."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => exportData("csv")}>
            <FileSpreadsheet className="size-4" /> Planilha
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => exportData("txt")}>
            <FileText className="size-4" /> Texto
          </Button>
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {state.expenses.length} despesas e {state.revenues.length} receitas extras registradas
          </span>
        </div>
      </Section>

      <Section
        icon={ShieldAlert}
        title="Dados"
        description="Tudo fica salvo apenas neste navegador. Acoes de limpeza pedem confirmacao antes de continuar."
      >
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="rounded-xl">
                <RotateCcw className="size-4" /> Limpar conversa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[20px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar conversa atual?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa acao remove apenas as mensagens do mes atual. Renda e despesas continuam
                  salvas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
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
              <Button variant="destructive" className="rounded-xl">
                <Trash2 className="size-4" /> Apagar todos os dados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[20px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa acao apaga renda, despesas e conversas deste navegador. Nao da para desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
    </div>
  );
}

export function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppNav title="Ajustes" />
      {mounted ? <SettingsContent /> : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORIES,
  chatMonthKeys,
  currentMonthKey,
  financeActions,
  formatBRL,
  incomeLabel,
  lastMonths,
  monthKey,
  monthLabel,
  monthlyIncome,
  summarize,
  useFinance,
  type Expense,
  type FinanceState,
} from "@/lib/finance-store";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function moneyFromInput(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "positive" | "negative";
}) {
  return (
    <div className="animate-rise flex min-h-[138px] flex-col rounded-[18px] border border-border/55 bg-surface p-4 shadow-soft sm:min-h-[150px] sm:p-5">
      <p className="text-[12.5px] font-medium leading-snug text-muted-foreground sm:text-[13px]">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-[clamp(1.45rem,6.7vw,2rem)] font-semibold leading-[1.08] tracking-tight tabular-nums sm:text-2xl ${
          accent === "positive"
            ? "text-success"
            : accent === "negative"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-auto pt-2 text-[12px] leading-snug text-muted-foreground sm:text-[12.5px]">
          {hint}
        </p>
      )}
    </div>
  );
}

function DashboardContent({ state }: { state: FinanceState }) {
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<string>("Geral");
  const [editDate, setEditDate] = useState("");
  const s = summarize(state, selectedMonth);
  const budgetIncome = monthlyIncome(state.income);
  const months = lastMonths(state, 6);
  const monthOptions = useMemo(() => chatMonthKeys(state), [state]);
  const recent = state.expenses
    .filter((expense) => monthKey(expense.date) === selectedMonth)
    .slice()
    .reverse()
    .slice(0, 8);

  const openExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditDescription(expense.description);
    setEditAmount(String(expense.amount).replace(".", ","));
    setEditCategory(expense.category);
    setEditDate(expense.date);
  };

  const closeExpense = () => {
    setSelectedExpense(null);
  };

  const saveExpense = () => {
    if (!selectedExpense) return;
    const amount = moneyFromInput(editAmount);
    const description = editDescription.trim();

    if (!description) {
      toast.error("Informe uma descrição para a despesa.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor válido para a despesa.");
      return;
    }

    financeActions.updateExpense(selectedExpense.id, {
      description,
      amount,
      category: editCategory,
      date: editDate || selectedExpense.date,
    });
    toast.success("Despesa atualizada.");
    closeExpense();
  };

  const deleteSelectedExpense = () => {
    if (!selectedExpense) return;
    financeActions.removeExpense(selectedExpense.id);
    toast.success("Despesa excluída.");
    closeExpense();
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Seu panorama</h1>
          <p className="mt-1 text-[15px] capitalize text-muted-foreground">
            {monthLabel(selectedMonth)}
          </p>
        </div>
        <select
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="h-9 rounded-full border border-border/70 bg-surface px-3 text-[13px] font-medium shadow-soft outline-none transition-colors hover:border-primary/30 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20"
          aria-label="Filtrar dashboard por competência"
        >
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {monthLabel(month)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Stat
          label="Renda recorrente"
          value={formatBRL(budgetIncome)}
          hint={state.income ? incomeLabel(state.income) : "Ainda não cadastrada"}
        />
        <Stat
          label="Receitas extras"
          value={formatBRL(s.extraIncome)}
          hint={`${s.revenueCount} registro${s.revenueCount === 1 ? "" : "s"}`}
        />
        <Stat label="Gasto no mês" value={formatBRL(s.spent)} hint={`${s.count} lançamentos`} />
        <Stat
          label="Saldo disponível"
          value={formatBRL(s.balance)}
          hint="acumulado até este período"
          accent={s.balance >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Limite de gastos"
          value={s.spendingLimit ? formatBRL(s.spendingLimit) : "Não definido"}
          hint={
            s.spendingLimit
              ? `${s.limitUsedPercent}% usado · ${formatBRL(Math.max(0, s.limitRemaining ?? 0))} livres`
              : `Sugestão: ${formatBRL(s.recommendedSpendingLimit)}`
          }
          accent={s.limitStatus === "exceeded" ? "negative" : undefined}
        />
        <Stat
          label="Projeção do mês"
          value={formatBRL(s.projection)}
          hint={`Média: ${formatBRL(s.dailyAverage)}/dia`}
        />
      </div>

      {s.spendingLimit && (
        <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">Consumo do limite</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {s.limitStatus === "exceeded"
                  ? `Você passou ${formatBRL(Math.abs(s.limitRemaining ?? 0))} do limite definido.`
                  : `Ainda restam ${formatBRL(Math.max(0, s.limitRemaining ?? 0))} dentro do teto.`}
              </p>
            </div>
            <p
              className={`text-[13px] font-semibold tabular-nums ${
                s.limitStatus === "exceeded"
                  ? "text-destructive"
                  : s.limitStatus === "warning"
                    ? "text-warning"
                    : "text-foreground"
              }`}
            >
              {s.limitUsedPercent}%
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                s.limitStatus === "exceeded"
                  ? "bg-destructive"
                  : s.limitStatus === "warning"
                    ? "bg-warning"
                    : "bg-success"
              }`}
              style={{ width: `${Math.min(100, s.limitUsedPercent ?? 0)}%` }}
            />
          </div>
        </div>
      )}

      {budgetIncome > 0 && (
        <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-muted-foreground">Orçamento utilizado</p>
            <p className="text-[13px] font-semibold tabular-nums">
              {Math.round((s.spent / budgetIncome) * 100)}%
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (s.spent / budgetIncome) * 100)}%`,
                background: "var(--gradient-brand)",
              }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
          <p className="text-[13px] font-medium text-muted-foreground">Evolução (6 meses)</p>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#area)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
          <p className="text-[13px] font-medium text-muted-foreground">Por categoria</p>
          {s.byCategory.length === 0 ? (
            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              Nenhuma despesa este mês.
            </p>
          ) : (
            <div className="mt-3 flex items-center gap-4">
              <div className="h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={s.byCategory}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={38}
                      outerRadius={62}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {s.byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {s.byCategory.slice(0, 5).map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground">{c.category}</span>
                    <span className="ml-auto font-medium tabular-nums">{formatBRL(c.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
        <p className="text-[13px] font-medium text-muted-foreground">Últimos lançamentos</p>
        {recent.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Registre um gasto pelo chat para ver seus lançamentos aqui.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {recent.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => openExpense(e)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
                >
                  <div className="min-w-0 px-2">
                    <p className="truncate text-[14px] font-medium">{e.description}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {e.category} · {new Date(`${e.date}T12:00:00`).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 px-2 text-[14px] font-semibold tabular-nums">
                    {formatBRL(e.amount)}
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={Boolean(selectedExpense)} onOpenChange={(open) => !open && closeExpense()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar despesa</DialogTitle>
            <DialogDescription>
              Ajuste os dados do lançamento. Os resumos e gráficos são atualizados na hora.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label htmlFor="expense-description" className="text-[13px]">
                Descrição
              </Label>
              <Input
                id="expense-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="expense-amount" className="text-[13px]">
                  Valor
                </Label>
                <Input
                  id="expense-amount"
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="expense-date" className="text-[13px]">
                  Data
                </Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="expense-category" className="text-[13px]">
                Categoria
              </Label>
              <select
                id="expense-category"
                value={editCategory}
                onChange={(event) => setEditCategory(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-[14px] outline-none transition-colors focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <div className="order-2 flex w-full gap-2 sm:order-1 sm:w-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1 rounded-xl sm:flex-none">
                    <Trash2 className="size-4" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[20px]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir esta despesa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação remove o lançamento e atualiza saldo, limite, gráficos e projeções.
                      Não dá para desfazer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 sm:space-x-0">
                    <AlertDialogCancel className="mt-0 rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={deleteSelectedExpense}
                    >
                      Excluir definitivamente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="outline"
                className="flex-1 rounded-xl sm:flex-none"
                onClick={closeExpense}
              >
                Cancelar
              </Button>
            </div>

            <Button
              className="order-1 w-full rounded-xl sm:order-2 sm:w-auto"
              onClick={saveExpense}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DashboardPage() {
  const state = useFinance();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppNav title="Dashboard" />
      {mounted ? <DashboardContent state={state} /> : null}
    </div>
  );
}

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
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
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
  localISODate,
  monthKey,
  monthLabel,
  monthlyIncome,
  summarize,
  useFinance,
  type Expense,
  type FinanceState,
  type FixedExpense,
} from "@/lib/finance-store";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localISODate(date);
}

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
  const isMoney = value.startsWith("R$ ");
  const [currency, amount] = isMoney ? ["R$", value.replace("R$ ", "")] : ["", value];
  const valueLength = value.length;
  const valueFontSize = isMoney
    ? `clamp(1.18rem, ${valueLength > 12 ? "4.65vw" : "5.2vw"}, 1.9rem)`
    : `clamp(1.35rem, ${valueLength > 10 ? "5vw" : "5.8vw"}, 1.9rem)`;

  return (
    <div className="animate-rise flex min-h-[138px] min-w-0 flex-col overflow-hidden rounded-[18px] border border-border/55 bg-surface px-3.5 py-4 shadow-soft sm:min-h-[150px] sm:p-5">
      <p className="text-[12.5px] font-medium leading-snug text-muted-foreground sm:text-[13px]">
        {label}
      </p>
      <p
        className={`mt-2 flex min-w-0 max-w-full items-baseline gap-1 overflow-hidden whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums sm:gap-1.5 ${
          accent === "positive"
            ? "text-success"
            : accent === "negative"
              ? "text-destructive"
              : "text-foreground"
        }`}
        style={{ fontSize: valueFontSize }}
        title={value}
      >
        {isMoney ? (
          <>
            <span className="shrink-0">{currency}</span>
            <span className="min-w-0 overflow-hidden text-ellipsis">{amount}</span>
          </>
        ) : (
          <span className="min-w-0 overflow-hidden text-ellipsis">{value}</span>
        )}
      </p>
      {hint && (
        <p className="mt-auto min-w-0 pt-2 text-[12px] leading-snug text-muted-foreground sm:text-[12.5px]">
          {hint}
        </p>
      )}
    </div>
  );
}

function DashboardContent({ state }: { state: FinanceState }) {
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [fixedExpenseModalOpen, setFixedExpenseModalOpen] = useState(false);
  const [selectedFixedExpense, setSelectedFixedExpense] = useState<FixedExpense | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<string>("Geral");
  const [editDate, setEditDate] = useState("");
  const [fixedDescription, setFixedDescription] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedCategory, setFixedCategory] = useState<string>("Contas");
  const [fixedPayday, setFixedPayday] = useState("1");
  const [fixedStartsAtMonth, setFixedStartsAtMonth] = useState(currentMonthKey());
  const s = summarize(state, selectedMonth);
  const budgetIncome = monthlyIncome(state.income);
  const months = lastMonths(state, 6);
  const monthOptions = useMemo(() => chatMonthKeys(state), [state]);
  const recentCutoff = isoDateDaysAgo(38);
  const today = localISODate();
  const recent = state.expenses
    .filter((expense) => expense.date >= recentCutoff && expense.date <= today)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

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

  const openNewFixedExpense = () => {
    setSelectedFixedExpense(null);
    setFixedDescription("");
    setFixedAmount("");
    setFixedCategory("Contas");
    setFixedPayday("1");
    setFixedStartsAtMonth(selectedMonth);
    setFixedExpenseModalOpen(true);
  };

  const openFixedExpense = (expense: FixedExpense) => {
    setSelectedFixedExpense(expense);
    setFixedDescription(expense.description);
    setFixedAmount(String(expense.amount).replace(".", ","));
    setFixedCategory(expense.category);
    setFixedPayday(String(expense.payday));
    setFixedStartsAtMonth(expense.startsAtMonth);
    setFixedExpenseModalOpen(true);
  };

  const closeFixedExpense = () => {
    setFixedExpenseModalOpen(false);
    setSelectedFixedExpense(null);
  };

  const saveFixedExpense = () => {
    const amount = moneyFromInput(fixedAmount);
    const description = fixedDescription.trim();
    const payday = Number(fixedPayday);

    if (!description) {
      toast.error("Informe uma descrição para a despesa fixa.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor válido para a despesa fixa.");
      return;
    }

    if (!Number.isFinite(payday) || payday < 1 || payday > 31) {
      toast.error("Informe um dia de vencimento entre 1 e 31.");
      return;
    }

    if (selectedFixedExpense) {
      financeActions.updateFixedExpense(selectedFixedExpense.id, {
        description,
        amount,
        category: fixedCategory,
        payday,
        startsAtMonth: fixedStartsAtMonth,
      });
      toast.success("Despesa fixa atualizada.");
    } else {
      financeActions.addFixedExpense({
        description,
        amount,
        category: fixedCategory,
        payday,
        startsAtMonth: fixedStartsAtMonth,
      });
      toast.success("Despesa fixa cadastrada.");
    }

    closeFixedExpense();
  };

  const deleteSelectedFixedExpense = () => {
    if (!selectedFixedExpense) return;
    financeActions.removeFixedExpense(selectedFixedExpense.id);
    toast.success("Despesa fixa excluída.");
    closeFixedExpense();
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

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
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
        <Stat
          label="Gasto no mês"
          value={formatBRL(s.spent)}
          hint={`${s.manualExpenseCount} avulso${s.manualExpenseCount === 1 ? "" : "s"} · ${s.fixedExpenseCount} fixo${s.fixedExpenseCount === 1 ? "" : "s"}`}
        />
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

      <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              <p className="text-[13px] font-medium text-muted-foreground">Despesas fixas</p>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Entram automaticamente no saldo quando o vencimento chega em cada mês.
            </p>
          </div>
          <Button className="h-9 rounded-xl" onClick={openNewFixedExpense}>
            <Plus className="size-4" />
            Adicionar
          </Button>
        </div>

        {state.fixedExpenses.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-secondary/50 px-3 py-3 text-[13px] leading-relaxed text-muted-foreground">
            Nenhuma despesa fixa cadastrada. Use este espaço para aluguel, internet, assinaturas,
            parcelas e outros compromissos recorrentes.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {state.fixedExpenses
              .slice()
              .sort((a, b) => a.payday - b.payday)
              .map((expense) => (
                <li key={expense.id}>
                  <button
                    type="button"
                    onClick={() => openFixedExpense(expense)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
                  >
                    <div className="min-w-0 px-2">
                      <p className="truncate text-[14px] font-medium">{expense.description}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {expense.category} · dia {expense.payday} · desde{" "}
                        {monthLabel(expense.startsAtMonth)}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 px-2 text-[14px] font-semibold tabular-nums">
                      {formatBRL(expense.amount)}
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

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
            Registre um gasto pelo chat para ver os lançamentos recentes aqui.
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

      <Dialog open={fixedExpenseModalOpen} onOpenChange={(open) => !open && closeFixedExpense()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedFixedExpense ? "Editar despesa fixa" : "Nova despesa fixa"}
            </DialogTitle>
            <DialogDescription>
              Configure um gasto recorrente mensal. Ele será considerado automaticamente no saldo a
              partir do mês escolhido.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label htmlFor="fixed-description" className="text-[13px]">
                Nome ou descrição
              </Label>
              <Input
                id="fixed-description"
                value={fixedDescription}
                onChange={(event) => setFixedDescription(event.target.value)}
                placeholder="Internet, aluguel, assinatura..."
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="fixed-amount" className="text-[13px]">
                  Valor
                </Label>
                <Input
                  id="fixed-amount"
                  inputMode="decimal"
                  value={fixedAmount}
                  onChange={(event) => setFixedAmount(event.target.value)}
                  placeholder="120,00"
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="fixed-payday" className="text-[13px]">
                  Dia de vencimento
                </Label>
                <Input
                  id="fixed-payday"
                  type="number"
                  min={1}
                  max={31}
                  value={fixedPayday}
                  onChange={(event) => setFixedPayday(event.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="fixed-category" className="text-[13px]">
                  Categoria
                </Label>
                <select
                  id="fixed-category"
                  value={fixedCategory}
                  onChange={(event) => setFixedCategory(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-[14px] outline-none transition-colors focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="fixed-starts-at" className="text-[13px]">
                  A partir de
                </Label>
                <Input
                  id="fixed-starts-at"
                  type="month"
                  value={fixedStartsAtMonth}
                  onChange={(event) => setFixedStartsAtMonth(event.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <div className="order-2 flex w-full gap-2 sm:order-1 sm:w-auto">
              {selectedFixedExpense && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1 rounded-xl sm:flex-none">
                      <Trash2 className="size-4" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[20px]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir esta despesa fixa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação remove a recorrência e atualiza saldo, limite, gráficos e
                        projeções. Não dá para desfazer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:space-x-0">
                      <AlertDialogCancel className="mt-0 rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={deleteSelectedFixedExpense}
                      >
                        Excluir definitivamente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Button
                variant="outline"
                className="flex-1 rounded-xl sm:flex-none"
                onClick={closeFixedExpense}
              >
                Cancelar
              </Button>
            </div>

            <Button
              className="order-1 w-full rounded-xl sm:order-2 sm:w-auto"
              onClick={saveFixedExpense}
            >
              Salvar
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

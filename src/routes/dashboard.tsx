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
import {
  CalendarClock,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  LayoutDashboard,
  Pencil,
  PencilLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppFooter } from "@/components/app-footer";
import { AppNav } from "@/components/app-nav";
import { FloatingCalculator } from "@/components/floating-calculator";
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
  fixedExpenseOccurrencesForMonth,
  formatBRL,
  incomeLabel,
  isIncomeAutoDepositEnabled,
  lastMonths,
  localISODate,
  monthKey,
  monthLabel,
  monthlyIncome,
  recurringIncomeOccurrencesForMonth,
  summarize,
  useFinance,
  type Expense,
  type FinanceState,
  type FixedExpense,
  type IncomeOccurrence,
  type Revenue,
} from "@/lib/finance-store";
import { Badge } from "@/components/ui/badge";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const DASHBOARD_CARDS_HIDDEN_KEY = "heyfin.dashboard.cardsHidden";
const FUTURE_LAUNCHES_COLLAPSED_KEY = "heyfin.dashboard.futureLaunchesCollapsed";
const RECENT_LAUNCH_PAGE_SIZE = 7;

type EditableStatKey = "income" | "extraIncome" | "spent" | "limit";

type RecentLaunch =
  | ({ kind: "expense" } & Expense)
  | ({ kind: "revenue" } & Revenue)
  | ({ kind: "income"; createdAt: string; category: string } & IncomeOccurrence)
  | {
      kind: "fixedExpense";
      id: string;
      occurrenceId: string;
      description: string;
      amount: number;
      date: string;
      createdAt: string;
      category: string;
    };

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localISODate(date);
}

function monthKeysInRange(startIso: string, endIso: string) {
  const start = new Date(`${monthKey(startIso)}-01T12:00:00`);
  const end = new Date(`${monthKey(endIso)}-01T12:00:00`);
  const keys: string[] = [];

  for (const date = new Date(start); date <= end; date.setMonth(date.getMonth() + 1)) {
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  return keys;
}

function moneyFromInput(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function moneyToInput(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? String(value).replace(".", ",") : "";
}

function Stat({
  label,
  value,
  hint,
  accent,
  hidden,
  editing,
  editable,
  editValue,
  onEditChange,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "positive" | "negative";
  hidden?: boolean;
  editing?: boolean;
  editable?: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
}) {
  const isMoney = value.startsWith("R$ ");
  const [currency, amount] = isMoney ? ["R$", value.replace("R$ ", "")] : ["", value];
  const valueLength = value.length;
  const valueFontSize = isMoney
    ? `clamp(1.18rem, ${valueLength > 12 ? "4.65vw" : "5.2vw"}, 1.9rem)`
    : `clamp(1.35rem, ${valueLength > 10 ? "5vw" : "5.8vw"}, 1.9rem)`;

  return (
    <div
      className={`animate-rise flex min-h-[138px] min-w-0 flex-col overflow-hidden rounded-[18px] border bg-surface px-3.5 py-4 shadow-soft transition-colors sm:min-h-[150px] sm:p-5 ${
        editing && editable ? "border-primary/35 ring-2 ring-primary/10" : "border-border/55"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium leading-snug text-muted-foreground sm:text-[13px]">
          {label}
        </p>
        {editing && !editable && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            auto
          </span>
        )}
      </div>
      {editing && editable ? (
        <Input
          inputMode="decimal"
          value={editValue ?? ""}
          onChange={(event) => onEditChange?.(event.target.value)}
          className="mt-2 h-10 rounded-xl border-primary/30 bg-background/80 text-[18px] font-semibold tabular-nums"
          aria-label={`Editar ${label}`}
        />
      ) : (
        <p
          className={`mt-2 flex min-w-0 max-w-full items-baseline gap-1 overflow-hidden whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums sm:gap-1.5 ${
            hidden
              ? "text-muted-foreground"
              : accent === "positive"
                ? "text-success"
                : accent === "negative"
                  ? "text-destructive"
                  : "text-foreground"
          }`}
          style={{ fontSize: hidden ? "clamp(1.35rem, 5vw, 1.9rem)" : valueFontSize }}
          title={hidden ? "Conteúdo oculto" : value}
        >
          {hidden ? (
            <span className="tracking-[0.18em]">••••</span>
          ) : isMoney ? (
            <>
              <span className="shrink-0">{currency}</span>
              <span className="min-w-0 overflow-hidden text-ellipsis">{amount}</span>
            </>
          ) : (
            <span className="min-w-0 overflow-hidden text-ellipsis">{value}</span>
          )}
        </p>
      )}
      {hint && (
        <p className="mt-auto min-w-0 pt-2 text-[12px] leading-snug text-muted-foreground sm:text-[12.5px]">
          {hidden ? "Conteúdo oculto" : hint}
        </p>
      )}
    </div>
  );
}

function DashboardContent({ state }: { state: FinanceState }) {
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
  const [cardsHidden, setCardsHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DASHBOARD_CARDS_HIDDEN_KEY) === "true";
  });
  const [cardsEditing, setCardsEditing] = useState(false);
  const [futureLaunchesCollapsed, setFutureLaunchesCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FUTURE_LAUNCHES_COLLAPSED_KEY) === "true";
  });
  const [cardEditValues, setCardEditValues] = useState<Record<EditableStatKey, string>>({
    income: "",
    extraIncome: "",
    spent: "",
    limit: "",
  });
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeEntryModalOpen, setIncomeEntryModalOpen] = useState(false);
  const [selectedIncomeEntry, setSelectedIncomeEntry] = useState<Extract<
    RecentLaunch,
    { kind: "revenue" | "income" }
  > | null>(null);
  const [visibleLaunchCount, setVisibleLaunchCount] = useState(RECENT_LAUNCH_PAGE_SIZE);
  const [fixedExpenseModalOpen, setFixedExpenseModalOpen] = useState(false);
  const [selectedFixedExpense, setSelectedFixedExpense] = useState<FixedExpense | null>(null);
  const [selectedFixedOccurrence, setSelectedFixedOccurrence] = useState<Extract<
    RecentLaunch,
    { kind: "fixedExpense" }
  > | null>(null);
  const [visibleFutureLaunchCount, setVisibleFutureLaunchCount] = useState(RECENT_LAUNCH_PAGE_SIZE);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<string>("Geral");
  const [editDate, setEditDate] = useState("");
  const [incomeEntryDescription, setIncomeEntryDescription] = useState("");
  const [incomeEntryAmount, setIncomeEntryAmount] = useState("");
  const [incomeEntryDate, setIncomeEntryDate] = useState("");
  const [fixedDescription, setFixedDescription] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedOccurrenceAmount, setFixedOccurrenceAmount] = useState("");
  const [fixedCategory, setFixedCategory] = useState<string>("Contas");
  const [fixedPayday, setFixedPayday] = useState("1");
  const [fixedStartsAtMonth, setFixedStartsAtMonth] = useState(currentMonthKey());
  const s = summarize(state, selectedMonth);
  const budgetIncome = monthlyIncome(state.income);
  const months = lastMonths(state, 6);
  const monthOptions = useMemo(() => chatMonthKeys(state), [state]);
  const recentCutoff = isoDateDaysAgo(38);
  const today = localISODate();
  const activeFixedExpenses = state.fixedExpenses.filter((expense) => !expense.canceledAt);
  const futureLaunches = state.expenses
    .filter((expense) => expense.date > today)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const visibleFutureLaunches = futureLaunches.slice(0, visibleFutureLaunchCount);
  const hasMoreFutureLaunches = visibleFutureLaunchCount < futureLaunches.length;
  const recentExpenses: RecentLaunch[] = state.expenses
    .filter((expense) => expense.date >= recentCutoff && expense.date <= today)
    .map((expense) => ({ ...expense, kind: "expense" }));
  const recentRevenues: RecentLaunch[] = state.revenues
    .filter((revenue) => revenue.date >= recentCutoff && revenue.date <= today)
    .map((revenue) => ({ ...revenue, kind: "revenue" }));
  const recentIncomePayments: RecentLaunch[] =
    state.income && isIncomeAutoDepositEnabled(state.income)
      ? monthKeysInRange(recentCutoff, today)
          .flatMap((month) =>
            recurringIncomeOccurrencesForMonth(state.income, state.incomeOverrides, month),
          )
          .filter((payment) => payment.date >= recentCutoff && payment.date <= today)
          .map((payment) => ({
            ...payment,
            kind: "income",
            createdAt: `${payment.date}T12:00:00.000Z`,
            category: "Renda automática",
          }))
      : [];
  const recentFixedExpenses: RecentLaunch[] = monthKeysInRange(recentCutoff, today)
    .flatMap((month) =>
      fixedExpenseOccurrencesForMonth(
        state.fixedExpenses,
        month,
        state.deletedFixedExpenseOccurrences,
        state.fixedExpenseOccurrenceOverrides,
      ),
    )
    .filter((expense) => expense.date >= recentCutoff && expense.date <= today)
    .map((expense) => ({
      kind: "fixedExpense",
      id: `fixed-${expense.id}`,
      occurrenceId: expense.id,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      createdAt: `${expense.date}T12:00:00.000Z`,
      category: expense.category,
    }));
  const recentLaunches = [
    ...recentExpenses,
    ...recentRevenues,
    ...recentIncomePayments,
    ...recentFixedExpenses,
  ]
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const visibleRecentLaunches = recentLaunches.slice(0, visibleLaunchCount);
  const hasMoreRecentLaunches = visibleLaunchCount < recentLaunches.length;
  const selectedExpenseIsFuture = Boolean(selectedExpense && selectedExpense.date > today);

  useEffect(() => {
    setCardsEditing(false);
  }, [selectedMonth]);

  useEffect(() => {
    setVisibleLaunchCount(RECENT_LAUNCH_PAGE_SIZE);
  }, [recentLaunches.length]);

  useEffect(() => {
    setVisibleFutureLaunchCount(RECENT_LAUNCH_PAGE_SIZE);
  }, [futureLaunches.length]);

  const setCardValue = (key: EditableStatKey, value: string) => {
    setCardEditValues((current) => ({ ...current, [key]: value }));
  };

  const toggleCardsHidden = () => {
    setCardsHidden((current) => {
      const next = !current;
      window.localStorage.setItem(DASHBOARD_CARDS_HIDDEN_KEY, String(next));
      return next;
    });
  };

  const toggleFutureLaunches = () => {
    setFutureLaunchesCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(FUTURE_LAUNCHES_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const startCardEditing = () => {
    setCardEditValues({
      income: moneyToInput(budgetIncome),
      extraIncome: moneyToInput(s.extraIncome),
      spent: moneyToInput(s.spent),
      limit: moneyToInput(s.spendingLimit),
    });
    setCardsEditing(true);
  };

  const cancelCardEditing = () => {
    setCardsEditing(false);
  };

  const saveCardEditing = () => {
    const nextIncome = moneyFromInput(cardEditValues.income);
    const nextExtraIncome = moneyFromInput(cardEditValues.extraIncome);
    const nextSpent = moneyFromInput(cardEditValues.spent);
    const nextLimit =
      cardEditValues.limit.trim() === "" ? null : moneyFromInput(cardEditValues.limit);

    if (!Number.isFinite(nextIncome) || nextIncome < 0) {
      toast.error("Informe uma renda recorrente válida.");
      return;
    }
    if (!Number.isFinite(nextExtraIncome) || nextExtraIncome < 0) {
      toast.error("Informe um valor válido para receitas extras.");
      return;
    }
    if (!Number.isFinite(nextSpent) || nextSpent < 0) {
      toast.error("Informe um valor válido para gastos.");
      return;
    }
    if (nextLimit != null && (!Number.isFinite(nextLimit) || nextLimit <= 0)) {
      toast.error("Informe um limite válido ou deixe em branco para remover.");
      return;
    }
    const spentDifference = Math.round((nextSpent - s.spent) * 100) / 100;

    if (nextIncome > 0 || state.income) {
      if (!state.income) {
        financeActions.setIncome(nextIncome, "monthly", {
          autoDeposit: true,
          payday: 1,
          startsAtMonth: selectedMonth,
        });
      } else if (state.income.period === "biweekly") {
        const currentFirst = state.income.firstAmount ?? state.income.amount;
        const currentSecond = state.income.secondAmount ?? 0;
        const currentTotal = currentFirst + currentSecond;
        const firstRatio = currentTotal > 0 ? currentFirst / currentTotal : 1;
        const firstAmount = Math.round(nextIncome * firstRatio * 100) / 100;
        const secondAmount = Math.max(0, Math.round((nextIncome - firstAmount) * 100) / 100);
        financeActions.setIncome(nextIncome, "biweekly", {
          autoDeposit: state.income.autoDeposit,
          startsAtMonth: state.income.startsAtMonth,
          firstPayday: state.income.firstPayday,
          secondPayday: state.income.secondPayday,
          firstAmount,
          secondAmount,
        });
      } else if (state.income.period === "weekly") {
        financeActions.setIncome((nextIncome * 12) / 52, "weekly", {
          autoDeposit: state.income.autoDeposit,
          startsAtMonth: state.income.startsAtMonth,
          firstPaymentDate: state.income.firstPaymentDate,
        });
      } else {
        financeActions.setIncome(nextIncome, "monthly", {
          autoDeposit: state.income.autoDeposit,
          startsAtMonth: state.income.startsAtMonth,
          payday: state.income.payday,
        });
      }
    }

    financeActions.setMonthlyExtraIncome(selectedMonth, nextExtraIncome);
    financeActions.addMonthlyExpenseAdjustment(selectedMonth, spentDifference);
    financeActions.setSpendingLimit(nextLimit);

    setCardsEditing(false);
    toast.success("Cards atualizados.");
  };

  const openExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditDescription(expense.description);
    setEditAmount(String(expense.amount).replace(".", ","));
    setEditCategory(expense.category);
    setEditDate(expense.date);
    setExpenseModalOpen(true);
  };

  const openNewExpense = () => {
    setSelectedExpense(null);
    setEditDescription("");
    setEditAmount("");
    setEditCategory("Geral");
    setEditDate(localISODate());
    setExpenseModalOpen(true);
  };

  const closeExpense = () => {
    setExpenseModalOpen(false);
    setSelectedExpense(null);
  };

  const openIncomeEntry = (entry: Extract<RecentLaunch, { kind: "revenue" | "income" }>) => {
    setSelectedIncomeEntry(entry);
    setIncomeEntryDescription(entry.description);
    setIncomeEntryAmount(String(entry.amount).replace(".", ","));
    setIncomeEntryDate(entry.date);
    setIncomeEntryModalOpen(true);
  };

  const closeIncomeEntry = () => {
    setIncomeEntryModalOpen(false);
    setSelectedIncomeEntry(null);
  };

  const saveIncomeEntry = () => {
    if (!selectedIncomeEntry) return;

    const amount = moneyFromInput(incomeEntryAmount);
    const description = incomeEntryDescription.trim();

    if (!description) {
      toast.error("Informe uma descrição.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    if (selectedIncomeEntry.kind === "revenue") {
      financeActions.updateRevenue(selectedIncomeEntry.id, {
        description,
        amount,
        date: incomeEntryDate || selectedIncomeEntry.date,
      });
      toast.success("Receita extra atualizada.");
    } else {
      financeActions.upsertIncomeOverride({
        paymentId: selectedIncomeEntry.id,
        description,
        amount,
      });
      toast.success("Salário atualizado.");
    }

    closeIncomeEntry();
  };

  const deleteSelectedIncomeEntry = () => {
    if (!selectedIncomeEntry) return;

    if (selectedIncomeEntry.kind === "revenue") {
      financeActions.removeRevenue(selectedIncomeEntry.id);
      toast.success("Receita extra excluída.");
    } else {
      financeActions.removeIncomeOccurrence(selectedIncomeEntry.id);
      toast.success("Salário removido deste histórico.");
    }

    closeIncomeEntry();
  };

  const saveExpense = () => {
    const amount = moneyFromInput(editAmount);
    const description = editDescription.trim();

    if (!description) {
      toast.error("Informe uma descrição para a despesa.");
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount === 0 ||
      ((!selectedExpense || !selectedExpense.adjustment) && amount < 0)
    ) {
      toast.error("Informe um valor válido para a despesa.");
      return;
    }

    if (selectedExpense?.date > today && (editDate || selectedExpense.date) <= today) {
      toast.error("Lançamentos futuros precisam permanecer em uma data futura.");
      return;
    }

    if (selectedExpense) {
      financeActions.updateExpense(selectedExpense.id, {
        description,
        amount,
        category: editCategory,
        date: editDate || selectedExpense.date,
      });
      toast.success("Despesa atualizada.");
    } else {
      financeActions.addExpense({
        description,
        amount,
        category: editCategory,
        date: editDate || localISODate(),
        manual: true,
      });
      toast.success("Lançamento manual adicionado.");
    }
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
    toast.success("Recorrência cancelada. Débitos já vencidos foram preservados.");
    closeFixedExpense();
  };

  const openFixedOccurrence = (entry: Extract<RecentLaunch, { kind: "fixedExpense" }>) => {
    setSelectedFixedOccurrence(entry);
    setFixedOccurrenceAmount(String(entry.amount).replace(".", ","));
  };

  const closeFixedOccurrence = () => {
    setSelectedFixedOccurrence(null);
    setFixedOccurrenceAmount("");
  };

  const saveFixedOccurrence = () => {
    if (!selectedFixedOccurrence) return;

    const amount = moneyFromInput(fixedOccurrenceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor válido para este débito.");
      return;
    }

    financeActions.updateFixedExpenseOccurrenceAmount(selectedFixedOccurrence.occurrenceId, amount);
    toast.success("Valor do débito atualizado.");
    closeFixedOccurrence();
  };

  const deleteFixedOccurrence = () => {
    if (!selectedFixedOccurrence) return;
    financeActions.removeFixedExpenseOccurrence(selectedFixedOccurrence.occurrenceId);
    toast.success("Débito de despesa fixa removido do histórico.");
    closeFixedOccurrence();
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-border/70 bg-surface px-3 py-2.5 shadow-[0_4px_14px_-12px_oklch(0.24_0.03_260_/_22%)]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <LayoutDashboard className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[12px] font-semibold text-foreground">Cards do resumo</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {cardsEditing ? "Edite os valores liberados." : "Oculte ou edite valores."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleCardsHidden}
            className="size-8 rounded-full"
            aria-label={cardsHidden ? "Exibir valores dos cards" : "Ocultar valores dos cards"}
            title={cardsHidden ? "Exibir valores" : "Ocultar valores"}
          >
            {cardsHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>

          {cardsEditing ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={cancelCardEditing}
                className="size-8 rounded-full"
                aria-label="Cancelar edição dos cards"
                title="Cancelar"
              >
                <X className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                onClick={saveCardEditing}
                className="size-8 rounded-full"
                aria-label="Salvar edição dos cards"
                title="Salvar"
              >
                <Check className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={startCardEditing}
              className="size-8 rounded-full"
              aria-label="Editar valores dos cards"
              title="Editar valores"
            >
              <PencilLine className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <Stat
          label="Renda recorrente"
          value={formatBRL(budgetIncome)}
          hint={state.income ? incomeLabel(state.income) : "Ainda não cadastrada"}
          hidden={cardsHidden}
          editing={cardsEditing}
          editable
          editValue={cardEditValues.income}
          onEditChange={(value) => setCardValue("income", value)}
        />
        <Stat
          label="Receitas extras"
          value={formatBRL(s.extraIncome)}
          hint={`${s.revenueCount} registro${s.revenueCount === 1 ? "" : "s"}`}
          hidden={cardsHidden}
          editing={cardsEditing}
          editable
          editValue={cardEditValues.extraIncome}
          onEditChange={(value) => setCardValue("extraIncome", value)}
        />
        <Stat
          label="Gasto no mês"
          value={formatBRL(s.spent)}
          hint={`${s.manualExpenseCount} avulso${s.manualExpenseCount === 1 ? "" : "s"} · ${s.fixedExpenseCount} fixo${s.fixedExpenseCount === 1 ? "" : "s"}`}
          hidden={cardsHidden}
          editing={cardsEditing}
          editable
          editValue={cardEditValues.spent}
          onEditChange={(value) => setCardValue("spent", value)}
        />
        <Stat
          label="Saldo disponível"
          value={formatBRL(s.balance)}
          hint="acumulado até este período"
          accent={s.balance >= 0 ? "positive" : "negative"}
          hidden={cardsHidden}
          editing={cardsEditing}
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
          hidden={cardsHidden}
          editing={cardsEditing}
          editable
          editValue={cardEditValues.limit}
          onEditChange={(value) => setCardValue("limit", value)}
        />
        <Stat
          label="Projeção do mês"
          value={formatBRL(s.projection)}
          hint={`Média: ${formatBRL(s.dailyAverage)}/dia`}
          hidden={cardsHidden}
          editing={cardsEditing}
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

        {activeFixedExpenses.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-secondary/50 px-3 py-3 text-[13px] leading-relaxed text-muted-foreground">
            Nenhuma despesa fixa cadastrada. Use este espaço para aluguel, internet, assinaturas,
            parcelas e outros compromissos recorrentes.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {activeFixedExpenses
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
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleFutureLaunches}
            className="flex min-w-0 items-center gap-2 rounded-xl text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            aria-expanded={!futureLaunchesCollapsed}
            aria-controls="future-launches-list"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-primary/[0.12] dark:text-primary dark:ring-primary/20">
              <CalendarClock className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-muted-foreground">
                Lançamentos futuros
              </span>
              <span className="block text-[12px] leading-snug text-muted-foreground/75">
                Despesas programadas que ainda não foram debitadas.
              </span>
            </span>
          </button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 rounded-full text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            onClick={toggleFutureLaunches}
            aria-label={
              futureLaunchesCollapsed
                ? "Mostrar lançamentos futuros"
                : "Ocultar lançamentos futuros"
            }
            title={futureLaunchesCollapsed ? "Mostrar" : "Ocultar"}
          >
            <ChevronDown
              className={`size-4 transition-transform duration-300 ${
                futureLaunchesCollapsed ? "-rotate-90" : "rotate-0"
              }`}
            />
          </Button>
        </div>

        {!futureLaunchesCollapsed && (
          <div id="future-launches-list" className="mt-3 space-y-3">
            {futureLaunches.length === 0 ? (
              <p className="rounded-2xl bg-secondary/45 px-3 py-3 text-[13px] leading-relaxed text-muted-foreground">
                Nenhuma despesa futura ainda. Ao registrar algo como{" "}
                <span className="font-medium text-foreground">R$ 50 para agosto</span>, ela fica
                aqui até chegar a competência.
              </p>
            ) : (
              <>
                <ul className="space-y-1">
                  {visibleFutureLaunches.map((expense, index) => {
                    const previous = visibleFutureLaunches[index - 1];
                    const showMonth =
                      !previous || monthKey(previous.date) !== monthKey(expense.date);

                    return (
                      <li key={`future-${expense.id}`}>
                        {showMonth && (
                          <div className="flex items-center gap-2 px-2 pb-1 pt-2 first:pt-0">
                            <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                              {monthLabel(monthKey(expense.date))}
                            </span>
                            <span className="h-px flex-1 bg-border/55" />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => openExpense(expense)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl bg-sky-50/35 py-2.5 text-left ring-1 ring-sky-100/60 transition-colors hover:bg-sky-50/60 focus-visible:bg-sky-50/60 dark:bg-primary/[0.08] dark:ring-primary/20 dark:hover:bg-primary/[0.12] dark:focus-visible:bg-primary/[0.12]"
                        >
                          <div className="min-w-0 px-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-[14px] font-medium">
                                {expense.description}
                              </p>
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border border-sky-200/75 bg-sky-100/65 px-2 py-0 text-[10px] font-medium text-sky-700 shadow-none dark:border-primary/25 dark:bg-primary/[0.14] dark:text-primary"
                              >
                                Futuro
                              </Badge>
                            </div>
                            <p className="text-[12px] text-muted-foreground">
                              {expense.category} ·{" "}
                              {new Date(`${expense.date}T12:00:00`).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-2 px-2 text-[14px] font-semibold text-sky-700 tabular-nums dark:text-primary">
                            {formatBRL(expense.amount)}
                            <Pencil className="size-3.5 text-sky-600/70 dark:text-primary/75" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {hasMoreFutureLaunches && (
                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-border/70 bg-transparent px-4 text-[12.5px] font-medium text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-transparent hover:text-primary"
                      onClick={() =>
                        setVisibleFutureLaunchCount((current) => current + RECENT_LAUNCH_PAGE_SIZE)
                      }
                    >
                      Ver mais lançamentos
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">Últimos lançamentos</p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 rounded-full text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            onClick={openNewExpense}
            aria-label="Adicionar lançamento manual"
            title="Adicionar lançamento manual"
          >
            <Plus className="size-3" />
          </Button>
        </div>
        {recentLaunches.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Registre um gasto pelo chat ou adicione manualmente pelo botão acima.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <ul className="space-y-1">
              {visibleRecentLaunches.map((entry, index) => {
                const previous = visibleRecentLaunches[index - 1];
                const showMonth = !previous || monthKey(previous.date) !== monthKey(entry.date);

                return (
                  <li key={`${entry.kind}-${entry.id}`}>
                    {showMonth && (
                      <div className="flex items-center gap-2 px-2 pb-1 pt-2 first:pt-0">
                        <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                          {monthLabel(monthKey(entry.date))}
                        </span>
                        <span className="h-px flex-1 bg-border/55" />
                      </div>
                    )}

                    {entry.kind === "expense" ? (
                      <button
                        type="button"
                        onClick={() => openExpense(entry)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
                      >
                        <div className="min-w-0 px-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-[14px] font-medium">{entry.description}</p>
                            {entry.manual && (
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border border-sky-200/70 bg-sky-50 px-2 py-0 text-[10px] font-medium text-sky-700 shadow-none dark:border-primary/25 dark:bg-primary/[0.12] dark:text-primary"
                              >
                                Manual
                              </Badge>
                            )}
                          </div>
                          <p className="text-[12px] text-muted-foreground">
                            {entry.category} ·{" "}
                            {new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 px-2 text-[14px] font-semibold tabular-nums">
                          {formatBRL(entry.amount)}
                          <Pencil className="size-3.5 text-muted-foreground" />
                        </span>
                      </button>
                    ) : entry.kind === "revenue" ? (
                      <button
                        type="button"
                        onClick={() => openIncomeEntry(entry)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-emerald-50/40 py-2.5 text-left ring-1 ring-emerald-100/60 transition-colors hover:bg-emerald-50/65 focus-visible:bg-emerald-50/65 dark:bg-success/[0.08] dark:ring-success/20 dark:hover:bg-success/[0.12] dark:focus-visible:bg-success/[0.12]"
                      >
                        <div className="min-w-0 px-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-[14px] font-medium">{entry.description}</p>
                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-full border border-emerald-200/75 bg-emerald-100/65 px-2 py-0 text-[10px] font-medium text-emerald-700 shadow-none dark:border-success/25 dark:bg-success/[0.14] dark:text-success"
                            >
                              Receita extra
                            </Badge>
                          </div>
                          <p className="text-[12px] text-muted-foreground">
                            Entrada ·{" "}
                            {new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 px-2 text-[14px] font-semibold text-emerald-700 tabular-nums dark:text-success">
                          + {formatBRL(entry.amount)}
                          <Pencil className="size-3.5 text-emerald-600/70 dark:text-success/75" />
                        </span>
                      </button>
                    ) : entry.kind === "income" ? (
                      <button
                        type="button"
                        onClick={() => openIncomeEntry(entry)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-emerald-50/55 py-2.5 text-left ring-1 ring-emerald-100/70 transition-colors hover:bg-emerald-50/75 focus-visible:bg-emerald-50/75 dark:bg-success/[0.09] dark:ring-success/[0.22] dark:hover:bg-success/[0.13] dark:focus-visible:bg-success/[0.13]"
                      >
                        <div className="min-w-0 px-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-[14px] font-medium">{entry.description}</p>
                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-full border border-emerald-200/80 bg-emerald-100/80 px-2 py-0 text-[10px] font-medium text-emerald-700 shadow-none dark:border-success/[0.28] dark:bg-success/[0.16] dark:text-success"
                            >
                              Salário
                            </Badge>
                          </div>
                          <p className="text-[12px] text-muted-foreground">
                            {entry.category} ·{" "}
                            {new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 px-2 text-[14px] font-semibold text-emerald-700 tabular-nums dark:text-success">
                          + {formatBRL(entry.amount)}
                          <Pencil className="size-3.5 text-emerald-600/70 dark:text-success/75" />
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openFixedOccurrence(entry)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-rose-50/45 py-2.5 text-left ring-1 ring-rose-100/70 transition-colors hover:bg-rose-50/70 focus-visible:bg-rose-50/70 dark:bg-destructive/[0.08] dark:ring-destructive/[0.22] dark:hover:bg-destructive/[0.12] dark:focus-visible:bg-destructive/[0.12]"
                      >
                        <div className="min-w-0 px-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-[14px] font-medium">{entry.description}</p>
                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-full border border-rose-200/80 bg-rose-100/75 px-2 py-0 text-[10px] font-medium text-rose-700 shadow-none dark:border-destructive/[0.28] dark:bg-destructive/[0.14] dark:text-destructive"
                            >
                              Despesa fixa
                            </Badge>
                          </div>
                          <p className="text-[12px] text-muted-foreground">
                            {entry.category} ·{" "}
                            {new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 px-2 text-[14px] font-semibold text-rose-700 tabular-nums dark:text-destructive">
                          {formatBRL(entry.amount)}
                          <Pencil className="size-3.5 text-rose-600/70 dark:text-destructive/75" />
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {hasMoreRecentLaunches && (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-border/70 bg-transparent px-4 text-[12.5px] font-medium text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-transparent hover:text-primary"
                  onClick={() =>
                    setVisibleLaunchCount((current) => current + RECENT_LAUNCH_PAGE_SIZE)
                  }
                >
                  Ver mais lançamentos
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={expenseModalOpen} onOpenChange={(open) => !open && closeExpense()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedExpense ? "Editar despesa" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>
              {selectedExpenseIsFuture
                ? "Ajuste esta despesa programada. Ela continua sem afetar o saldo atual enquanto permanecer em uma data futura."
                : selectedExpense
                  ? "Ajuste os dados do lançamento. Os resumos e gráficos são atualizados na hora."
                  : "Adicione uma despesa manualmente. Ela aparecerá nos últimos lançamentos com identificação própria."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-w-0 gap-3">
            <div className="min-w-0">
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

            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
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
              <div className="min-w-0 pr-1 sm:pr-0">
                <Label htmlFor="expense-date" className="text-[13px]">
                  Data
                </Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                  className="date-input-contained mt-1.5 min-w-0 max-w-full rounded-xl"
                />
              </div>
            </div>

            <div className="min-w-0">
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
              {selectedExpense && (
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
                        {selectedExpenseIsFuture
                          ? "Essa ação remove apenas esta despesa programada. Como ela ainda não foi debitada, o saldo atual não será alterado."
                          : "Essa ação remove o lançamento e atualiza saldo, limite, gráficos e projeções. Não dá para desfazer."}
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
              )}

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
              {selectedExpense ? "Salvar alterações" : "Adicionar lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incomeEntryModalOpen} onOpenChange={(open) => !open && closeIncomeEntry()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedIncomeEntry?.kind === "income" ? "Editar salário" : "Editar receita extra"}
            </DialogTitle>
            <DialogDescription>
              Ajuste descrição e valor. A identificação do lançamento permanece bloqueada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label htmlFor="income-entry-description" className="text-[13px]">
                Descrição
              </Label>
              <Input
                id="income-entry-description"
                value={incomeEntryDescription}
                onChange={(event) => setIncomeEntryDescription(event.target.value)}
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="income-entry-amount" className="text-[13px]">
                  Valor
                </Label>
                <Input
                  id="income-entry-amount"
                  inputMode="decimal"
                  value={incomeEntryAmount}
                  onChange={(event) => setIncomeEntryAmount(event.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="income-entry-date" className="text-[13px]">
                  Data
                </Label>
                <Input
                  id="income-entry-date"
                  type="date"
                  value={incomeEntryDate}
                  disabled={selectedIncomeEntry?.kind === "income"}
                  onChange={(event) => setIncomeEntryDate(event.target.value)}
                  className="mt-1.5 rounded-xl disabled:opacity-70"
                />
              </div>
            </div>

            <div>
              <Label className="text-[13px]">Categoria</Label>
              <div className="mt-1.5 rounded-xl border border-border/70 bg-secondary/45 px-3 py-2 text-[13px] font-medium text-muted-foreground">
                {selectedIncomeEntry?.kind === "income" ? "Salário" : "Receita extra"}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <div className="order-2 flex w-full gap-2 sm:order-1 sm:w-auto">
              {selectedIncomeEntry && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1 rounded-xl sm:flex-none">
                      <Trash2 className="size-4" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[20px]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Excluir este{" "}
                        {selectedIncomeEntry.kind === "income" ? "salário" : "lançamento"}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação atualiza o saldo, os cards, gráficos e projeções. Não dá para
                        desfazer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:space-x-0">
                      <AlertDialogCancel className="mt-0 rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={deleteSelectedIncomeEntry}
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
                onClick={closeIncomeEntry}
              >
                Cancelar
              </Button>
            </div>

            <Button
              className="order-1 w-full rounded-xl sm:order-2 sm:w-auto"
              onClick={saveIncomeEntry}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedFixedOccurrence)}
        onOpenChange={(open) => !open && closeFixedOccurrence()}
      >
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar débito fixo</DialogTitle>
            <DialogDescription>
              Ajuste apenas este lançamento de despesa fixa. A recorrência original e os outros
              meses não serão modificados.
            </DialogDescription>
          </DialogHeader>

          {selectedFixedOccurrence && (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/45 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">
                      {selectedFixedOccurrence.description}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {selectedFixedOccurrence.category} ·{" "}
                      {new Date(`${selectedFixedOccurrence.date}T12:00:00`).toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 rounded-full border border-rose-200/80 bg-rose-100/75 px-2 py-0 text-[10px] font-medium text-rose-700 shadow-none"
                  >
                    Despesa fixa
                  </Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="fixed-occurrence-amount" className="text-[13px]">
                  Valor deste débito
                </Label>
                <Input
                  id="fixed-occurrence-amount"
                  inputMode="decimal"
                  value={fixedOccurrenceAmount}
                  onChange={(event) => setFixedOccurrenceAmount(event.target.value)}
                  placeholder="120,00"
                  className="mt-1.5 rounded-xl"
                />
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  Essa alteração vale somente para este lançamento em Últimos lançamentos.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <div className="order-2 flex w-full gap-2 sm:order-1 sm:w-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1 rounded-xl sm:flex-none">
                    <Trash2 className="size-4" />
                    Excluir débito
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[20px]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir este débito?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso remove apenas este lançamento do histórico e devolve o valor ao saldo. A
                      despesa fixa recorrente não será alterada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 sm:space-x-0">
                    <AlertDialogCancel className="mt-0 rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={deleteFixedOccurrence}
                    >
                      Excluir débito
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="outline"
                className="flex-1 rounded-xl sm:flex-none"
                onClick={closeFixedOccurrence}
              >
                Cancelar
              </Button>
            </div>

            <Button
              className="order-1 w-full rounded-xl sm:order-2 sm:w-auto"
              onClick={saveFixedOccurrence}
            >
              Salvar valor
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
                        Essa ação cancela apenas a recorrência para os próximos períodos. Débitos
                        que já aconteceram continuam no histórico financeiro.
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
      {mounted ? (
        <>
          <DashboardContent state={state} />
          <AppFooter />
          <FloatingCalculator />
        </>
      ) : null}
    </div>
  );
}

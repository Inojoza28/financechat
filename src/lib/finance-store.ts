import { useSyncExternalStore } from "react";
import type { UIMessage } from "ai";

export type IncomePeriod = "monthly" | "biweekly" | "weekly";

export type Income = {
  amount: number;
  period: IncomePeriod;
  autoDeposit?: boolean;
  startsAtMonth?: string;
  payday?: number;
  firstPaymentDate?: string;
  firstPayday?: number;
  secondPayday?: number;
  firstAmount?: number;
  secondAmount?: number;
};

export type RecurringIncomePayment = {
  date: string;
  amount: number;
  label: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string; // ISO date (yyyy-mm-dd)
  createdAt: string;
};

export type Revenue = {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO date (yyyy-mm-dd)
  createdAt: string;
};

export type PendingAssistantAction = {
  type: "deleteExpense";
  expenseId: string;
  month: string;
  createdAt: string;
};

export type FinanceState = {
  assistantName: string;
  currency: string;
  income: Income | null;
  spendingLimit: number | null;
  pendingAction: PendingAssistantAction | null;
  expenses: Expense[];
  revenues: Revenue[];
  messages: UIMessage[];
  messagesByMonth: Record<string, UIMessage[]>;
};

export const CATEGORIES = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Lazer",
  "Contas",
  "Educação",
  "Compras",
  "Geral",
] as const;

const STORAGE_KEY = "finance-chat.v1";

const initialState: FinanceState = {
  assistantName: "Fin",
  currency: "BRL",
  income: null,
  spendingLimit: null,
  pendingAction: null,
  expenses: [],
  revenues: [],
  messages: [],
  messagesByMonth: {},
};

const LEGACY_GENERAL_CATEGORY = String.fromCharCode(79, 117, 116, 114, 111, 115);

const normalizeCategory = (category?: string) =>
  category === LEGACY_GENERAL_CATEGORY || !category ? "Geral" : category;

const normalizeMoney = (value: number | undefined) =>
  Math.round(Math.abs(Number(value) || 0) * 100) / 100;

const clampPayday = (value: number | undefined, fallback: number) => {
  const day = Math.trunc(Number(value));
  return Number.isFinite(day) ? Math.min(31, Math.max(1, day)) : fallback;
};

function isValidMonthKey(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

export function localISODate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function earliestMonthKey(keys: string[]) {
  return keys.filter(isValidMonthKey).sort()[0] ?? currentMonthKey();
}

let state: FinanceState = initialState;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): FinanceState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<FinanceState>;
    const fallbackMonth = currentMonthKey();
    const messagesByMonth =
      parsed.messagesByMonth && typeof parsed.messagesByMonth === "object"
        ? parsed.messagesByMonth
        : parsed.messages?.length
          ? { [fallbackMonth]: parsed.messages }
          : {};
    const expenses = (parsed.expenses ?? []).map((expense) => ({
      ...expense,
      category: normalizeCategory(expense.category),
    }));
    const revenues = (parsed.revenues ?? []).map((revenue) => ({
      ...revenue,
      amount: normalizeMoney(revenue.amount),
      description: revenue.description?.trim() || "Receita extra",
    }));
    const income = parsed.income
      ? {
          ...parsed.income,
          autoDeposit: parsed.income.autoDeposit ?? true,
          startsAtMonth:
            parsed.income.startsAtMonth ??
            earliestMonthKey([
              currentMonthKey(),
              ...expenses.map((expense) => monthKey(expense.date)),
              ...revenues.map((revenue) => monthKey(revenue.date)),
            ]),
          payday: clampPayday(parsed.income.payday, 1),
          firstPaymentDate: parsed.income.firstPaymentDate,
          amount:
            parsed.income.period === "biweekly" &&
            (parsed.income.firstAmount != null || parsed.income.secondAmount != null)
              ? normalizeMoney((parsed.income.firstAmount ?? 0) + (parsed.income.secondAmount ?? 0))
              : parsed.income.amount,
        }
      : null;
    const spendingLimit =
      parsed.spendingLimit != null
        ? normalizeMoney(parsed.spendingLimit)
        : initialState.spendingLimit;
    return {
      ...initialState,
      ...parsed,
      income,
      spendingLimit,
      expenses,
      revenues,
      messagesByMonth,
    };
  } catch {
    return initialState;
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = read();
}

function write(next: FinanceState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or unavailable */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): FinanceState {
  ensureHydrated();
  return state;
}

function getServerSnapshot(): FinanceState {
  return initialState;
}

export function useFinance() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getFinanceState(): FinanceState {
  ensureHydrated();
  return state;
}

/* ---------------- actions ---------------- */

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const financeActions = {
  setIncome(
    amount: number,
    period: IncomePeriod,
    details?: {
      autoDeposit?: boolean;
      payday?: number;
      firstPaymentDate?: string;
      startsAtMonth?: string;
      firstPayday?: number;
      secondPayday?: number;
      firstAmount?: number;
      secondAmount?: number;
    },
  ) {
    const autoDeposit = details?.autoDeposit ?? true;
    const startsAtMonth =
      details?.startsAtMonth ??
      getFinanceState().income?.startsAtMonth ??
      currentMonthKey();
    const income: Income =
      period === "biweekly"
        ? {
            amount: normalizeMoney((details?.firstAmount ?? amount) + (details?.secondAmount ?? 0)),
            period,
            autoDeposit,
            startsAtMonth,
            firstPayday: clampPayday(details?.firstPayday, 5),
            secondPayday: clampPayday(details?.secondPayday, 20),
            firstAmount: normalizeMoney(details?.firstAmount ?? amount),
            secondAmount: normalizeMoney(details?.secondAmount ?? 0),
          }
        : {
            amount: normalizeMoney(amount),
            period,
            autoDeposit,
            startsAtMonth,
            payday: period === "monthly" ? clampPayday(details?.payday, 1) : undefined,
            firstPaymentDate:
              period === "weekly"
                ? details?.firstPaymentDate || localISODate()
                : undefined,
          };
    write({ ...getFinanceState(), income });
  },
  clearIncome() {
    write({ ...getFinanceState(), income: null });
  },
  setSpendingLimit(amount: number | null) {
    write({
      ...getFinanceState(),
      spendingLimit: amount != null && amount > 0 ? normalizeMoney(amount) : null,
    });
  },
  setPendingAction(pendingAction: PendingAssistantAction | null) {
    write({ ...getFinanceState(), pendingAction });
  },
  addExpense(input: {
    description: string;
    amount: number;
    category?: string;
    date?: string | null;
  }): Expense {
    const expense: Expense = {
      id: uid(),
      description: input.description.trim().slice(0, 120),
      amount: normalizeMoney(input.amount),
      category: normalizeCategory(input.category?.trim()),
      date: input.date || localISODate(),
      createdAt: new Date().toISOString(),
    };
    const s = getFinanceState();
    write({ ...s, expenses: [...s.expenses, expense] });
    return expense;
  },
  addRevenue(input: { description: string; amount: number; date?: string | null }): Revenue {
    const revenue: Revenue = {
      id: uid(),
      description: input.description.trim().slice(0, 120) || "Receita extra",
      amount: normalizeMoney(input.amount),
      date: input.date || localISODate(),
      createdAt: new Date().toISOString(),
    };
    const s = getFinanceState();
    write({ ...s, revenues: [...s.revenues, revenue] });
    return revenue;
  },
  updateExpense(id: string, patch: Partial<Omit<Expense, "id" | "createdAt">>) {
    const s = getFinanceState();
    write({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      pendingAction: s.pendingAction?.expenseId === id ? null : s.pendingAction,
    });
  },
  removeExpense(id: string) {
    const s = getFinanceState();
    write({
      ...s,
      expenses: s.expenses.filter((e) => e.id !== id),
      pendingAction: s.pendingAction?.expenseId === id ? null : s.pendingAction,
    });
  },
  removeRevenue(id: string) {
    const s = getFinanceState();
    write({ ...s, revenues: s.revenues.filter((r) => r.id !== id) });
  },
  setAssistantName(name: string) {
    write({ ...getFinanceState(), assistantName: name.trim().slice(0, 30) || "Fin" });
  },
  setMessages(messages: UIMessage[]) {
    write({ ...getFinanceState(), messages });
  },
  setMessagesForMonth(month: string, messages: UIMessage[]) {
    const s = getFinanceState();
    write({
      ...s,
      messages,
      messagesByMonth: { ...s.messagesByMonth, [month]: messages },
    });
  },
  resetAll() {
    write({ ...initialState });
  },
  resetConversation() {
    const month = currentMonthKey();
    const s = getFinanceState();
    write({
      ...s,
      messages: [],
      messagesByMonth: { ...s.messagesByMonth, [month]: [] },
    });
  },
};

/* ---------------- derived data ---------------- */

export function monthlyIncome(income: Income | null): number {
  if (!income) return 0;
  switch (income.period) {
    case "weekly":
      return (income.amount * 52) / 12;
    case "biweekly":
      return income.firstAmount != null || income.secondAmount != null
        ? normalizeMoney((income.firstAmount ?? 0) + (income.secondAmount ?? 0))
        : (income.amount * 26) / 12;
    default:
      return income.amount;
  }
}

export function isIncomeAutoDepositEnabled(income: Income | null) {
  return income?.autoDeposit ?? true;
}

export function incomeLabel(income: Income | null) {
  if (!income) return "não informada";
  const autoText = isIncomeAutoDepositEnabled(income) ? "automático ativo" : "automático inativo";
  if (income.period === "biweekly") {
    return `${formatBRL(income.firstAmount ?? income.amount)} no dia ${income.firstPayday ?? 5} e ${formatBRL(income.secondAmount ?? 0)} no dia ${income.secondPayday ?? 20} (${autoText})`;
  }
  const periodLabel: Record<IncomePeriod, string> = {
    monthly: "mensal",
    biweekly: "quinzenal",
    weekly: "semanal",
  };
  if (income.period === "monthly") {
    return `${formatBRL(income.amount)} no dia ${income.payday ?? 1} (${periodLabel[income.period]}, ${autoText})`;
  }
  return `${formatBRL(income.amount)} (${periodLabel[income.period]}, a partir de ${formatDate(income.firstPaymentDate)}, ${autoText})`;
}

export function recommendedSpendingLimit(income: Income | null) {
  const incomeAmount = monthlyIncome(income);
  return incomeAmount > 0 ? normalizeMoney(incomeAmount * 0.8) : 0;
}

export const monthKey = (iso: string) => iso.slice(0, 7);

export const currentMonthKey = () => localISODate().slice(0, 7);

export function offsetMonthKey(month: string, offset: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return currentMonthKey();
  const date = new Date(year, monthIndex - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeysBetween(startMonth: string, endMonth: string) {
  if (!isValidMonthKey(startMonth) || !isValidMonthKey(endMonth) || startMonth > endMonth) {
    return [];
  }

  const [startYear, startIndex] = startMonth.split("-").map(Number);
  const [endYear, endIndex] = endMonth.split("-").map(Number);
  const keys: string[] = [];
  const date = new Date(startYear, startIndex - 1, 1);
  const end = new Date(endYear, endIndex - 1, 1);

  while (date <= end) {
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    date.setMonth(date.getMonth() + 1);
  }

  return keys;
}

export function monthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return month;
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function chatMonthKeys(state: FinanceState) {
  const keys = new Set<string>([currentMonthKey()]);
  Object.entries(state.messagesByMonth).forEach(([month, messages]) => {
    if (messages.length) keys.add(month);
  });
  state.expenses.forEach((expense) => keys.add(monthKey(expense.date)));
  state.revenues.forEach((revenue) => keys.add(monthKey(revenue.date)));
  return Array.from(keys).sort((a, b) => b.localeCompare(a));
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 0).getDate();
}

function isoFromParts(year: number, monthIndex: number, day: number) {
  const clampedDay = Math.min(day, daysInMonth(year, monthIndex));
  return `${year}-${String(monthIndex).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

function biweeklyPaymentsForMonth(income: Income, year: number, monthIndex: number) {
  return [
    {
      date: isoFromParts(year, monthIndex, income.firstPayday ?? 5),
      amount: normalizeMoney(income.firstAmount ?? income.amount),
      label: "primeiro pagamento",
    },
    {
      date: isoFromParts(year, monthIndex, income.secondPayday ?? 20),
      amount: normalizeMoney(income.secondAmount ?? 0),
      label: "segundo pagamento",
    },
  ].filter((payment) => payment.amount > 0);
}

function isValidIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00`);
}

function compareMonthToDate(month: string, date: Date) {
  return month.localeCompare(localISODate(date).slice(0, 7));
}

function monthEndISO(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return localISODate();
  return isoFromParts(year, monthIndex, daysInMonth(year, monthIndex));
}

function cutoffForMonth(month: string, date = new Date()) {
  const today = localISODate(date);
  const currentMonth = monthKey(today);
  if (month < currentMonth) return monthEndISO(month);
  if (month > currentMonth) return monthEndISO(month);
  return today;
}

export function formatDate(iso?: string) {
  if (!isValidIsoDate(iso)) return "data não definida";
  return dateFromIso(iso).toLocaleDateString("pt-BR");
}

function weeklyPaymentsForMonth(income: Income, year: number, monthIndex: number) {
  const start = dateFromIso(isoFromParts(year, monthIndex, 1));
  const end = dateFromIso(isoFromParts(year, monthIndex, daysInMonth(year, monthIndex)));
  const anchor = dateFromIso(
    isValidIsoDate(income.firstPaymentDate)
      ? income.firstPaymentDate!
      : isoFromParts(year, monthIndex, 1),
  );
  const first = new Date(anchor);
  const diffDays = Math.floor((start.getTime() - first.getTime()) / 86400000);
  if (diffDays > 0) first.setDate(first.getDate() + Math.ceil(diffDays / 7) * 7);

  const payments: RecurringIncomePayment[] = [];
  for (const date = new Date(first); date <= end; date.setDate(date.getDate() + 7)) {
    if (date >= start) {
      payments.push({
        date: localISODate(date),
        amount: normalizeMoney(income.amount),
        label: "pagamento semanal",
      });
    }
  }
  return payments;
}

export function recurringPaymentsForMonth(
  income: Income | null,
  month = currentMonthKey(),
): RecurringIncomePayment[] {
  if (!income) return [];
  if (income.startsAtMonth && month < income.startsAtMonth) return [];
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return [];

  if (income.period === "biweekly") return biweeklyPaymentsForMonth(income, year, monthIndex);
  if (income.period === "weekly") return weeklyPaymentsForMonth(income, year, monthIndex);

  return [
    {
      date: isoFromParts(year, monthIndex, income.payday ?? 1),
      amount: normalizeMoney(income.amount),
      label: "pagamento mensal",
    },
  ].filter((payment) => payment.amount > 0);
}

export function plannedRecurringIncomeForMonth(income: Income | null, month = currentMonthKey()) {
  return recurringPaymentsForMonth(income, month).reduce((sum, payment) => sum + payment.amount, 0);
}

export function recurringIncomeReceivedUntil(
  income: Income | null,
  date = new Date(),
  month = currentMonthKey(),
) {
  if (!income || !isIncomeAutoDepositEnabled(income)) return 0;
  const cutoff = localISODate(date);
  if (compareMonthToDate(month, date) > 0) return 0;
  if (compareMonthToDate(month, date) < 0) return plannedRecurringIncomeForMonth(income, month);
  return recurringPaymentsForMonth(income, month)
    .filter((payment) => payment.date <= cutoff)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function cashBalanceUntil(
  state: FinanceState,
  date = new Date(),
) {
  const cutoff = localISODate(date);
  const cutoffMonth = monthKey(cutoff);
  const startMonth = state.income?.startsAtMonth ?? currentMonthKey();
  const recurringReceived = monthKeysBetween(startMonth, cutoffMonth).reduce(
    (sum, month) => sum + recurringIncomeReceivedUntil(state.income, date, month),
    0,
  );
  const extraIncome = state.revenues
    .filter((revenue) => revenue.date <= cutoff)
    .reduce((sum, revenue) => sum + revenue.amount, 0);
  const spent = state.expenses
    .filter((expense) => expense.date <= cutoff)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    month: cutoffMonth,
    recurringReceived,
    extraIncome,
    spent,
    balance: recurringReceived + extraIncome - spent,
  };
}

function cashBalanceUntilISO(state: FinanceState, isoDate: string) {
  return cashBalanceUntil(state, dateFromIso(isoDate));
}

export function nextIncomePayment(income: Income | null, from = new Date()) {
  if (!income) return null;
  const today = localISODate(from);
  const candidates = Array.from({ length: 6 }, (_, offset) => {
    const monthDate = new Date(from.getFullYear(), from.getMonth() + offset, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    return recurringPaymentsForMonth(income, key);
  }).flat();

  return candidates
    .filter((payment) => payment.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

export function forecastNextMonth(state: FinanceState, fromMonth = currentMonthKey()) {
  const nextMonth = offsetMonthKey(fromMonth, 1);
  const next = summarize(state, nextMonth);
  const projectedStartBalance = cashBalanceUntilISO(state, monthEndISO(fromMonth)).balance;
  const projectedAvailable = projectedStartBalance + next.plannedIncome - next.spent;

  return {
    currentMonth: fromMonth,
    nextMonth,
    projectedStartBalance,
    recurringIncome: next.recurringIncome,
    plannedRecurringIncome: next.plannedRecurringIncome,
    extraIncome: next.extraIncome,
    projectedIncome: next.plannedIncome,
    registeredExpenses: next.spent,
    registeredExpenseCount: next.count,
    projectedAvailable,
  };
}

export function summarize(state: FinanceState, month = currentMonthKey()) {
  const cutoff = cutoffForMonth(month);
  const cutoffDate = dateFromIso(cutoff);
  const cumulativeCash = cashBalanceUntilISO(state, cutoff);
  const recurringIncome = recurringIncomeReceivedUntil(state.income, cutoffDate, month);
  const plannedRecurringIncome = plannedRecurringIncomeForMonth(state.income, month);
  const monthExpenses = state.expenses.filter((e) => monthKey(e.date) === month);
  const monthRevenues = state.revenues.filter((r) => monthKey(r.date) === month);
  const spent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const extraIncome = monthRevenues.reduce((sum, r) => sum + r.amount, 0);
  const income = recurringIncome + extraIncome;
  const plannedIncome = plannedRecurringIncome + extraIncome;
  const spendingLimit = state.spendingLimit;
  const limitUsedPercent = spendingLimit ? Math.round((spent / spendingLimit) * 100) : null;
  const limitRemaining = spendingLimit != null ? spendingLimit - spent : null;
  const limitStatus =
    spendingLimit == null
      ? "unset"
      : spent > spendingLimit
        ? "exceeded"
        : spent >= spendingLimit * 0.9
          ? "warning"
          : "ok";
  const totalAllTime = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenueAllTime = state.revenues.reduce((sum, r) => sum + r.amount, 0);
  const byCategory = Object.entries(
    monthExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  )
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const now = new Date();
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth =
    year && monthIndex
      ? new Date(year, monthIndex, 0).getDate()
      : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = month === currentMonthKey() ? now.getDate() : daysInMonth;
  const dailyAverage = spent / dayOfMonth;
  const projection = dailyAverage * daysInMonth;

  return {
    month,
    income,
    plannedIncome,
    recurringIncome,
    plannedRecurringIncome,
    extraIncome,
    spent,
    spendingLimit,
    recommendedSpendingLimit: recommendedSpendingLimit(state.income),
    limitUsedPercent,
    limitRemaining,
    limitStatus,
    balance: cumulativeCash.balance,
    cumulativeIncome: cumulativeCash.recurringReceived + cumulativeCash.extraIncome,
    cumulativeRecurringIncome: cumulativeCash.recurringReceived,
    cumulativeExtraIncome: cumulativeCash.extraIncome,
    cumulativeSpent: cumulativeCash.spent,
    totalAllTime,
    totalRevenueAllTime,
    count: monthExpenses.length,
    revenueCount: monthRevenues.length,
    byCategory,
    dailyAverage,
    projection,
    dailyBudgetLeft:
      dayOfMonth < daysInMonth ? cumulativeCash.balance / (daysInMonth - dayOfMonth) : cumulativeCash.balance,
  };
}

export function lastMonths(state: FinanceState, n = 6) {
  const out: { month: string; label: string; total: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      month: key,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      total: state.expenses
        .filter((e) => monthKey(e.date) === key)
        .reduce((s, e) => s + e.amount, 0),
    });
  }
  return out;
}

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

/* ---------------- export ---------------- */

export function buildCSV(state: FinanceState) {
  const s = summarize(state);
  const rows: string[][] = [
    ["HeyFin - Relatório financeiro"],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
    ["Renda", incomeLabel(state.income)],
    ["Período da renda", state.income?.period ?? "-"],
    [
      "Lançamento automático da renda",
      isIncomeAutoDepositEnabled(state.income) ? "ativo" : "inativo",
    ],
    ["Renda recorrente no mês", s.recurringIncome.toFixed(2)],
    ["Receitas extras no mês", s.extraIncome.toFixed(2)],
    ["Limite de gastos", s.spendingLimit?.toFixed(2) ?? "-"],
    ["Uso do limite", s.limitUsedPercent != null ? `${s.limitUsedPercent}%` : "-"],
    ["Total gasto no mês", s.spent.toFixed(2)],
    ["Saldo disponível acumulado", s.balance.toFixed(2)],
    ["Total gasto (histórico)", s.totalAllTime.toFixed(2)],
    [],
    ["Data", "Descrição", "Categoria", "Valor"],
    ...state.expenses
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [e.date, e.description, e.category, e.amount.toFixed(2)]),
    [],
    ["RECEITAS EXTRAS"],
    ["Data", "Descrição", "Valor"],
    ...state.revenues
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => [r.date, r.description, r.amount.toFixed(2)]),
  ];
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

export function buildTXT(state: FinanceState) {
  const s = summarize(state);
  const lines = [
    "HeyFin - RELATÓRIO FINANCEIRO",
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    "",
    "RESUMO",
    `  Renda registrada......: ${incomeLabel(state.income)}`,
    `  Lançamento automático.: ${isIncomeAutoDepositEnabled(state.income) ? "ativo" : "inativo"}`,
    `  Renda recorrente mês..: ${formatBRL(s.recurringIncome)}`,
    `  Receitas extras.......: ${formatBRL(s.extraIncome)}`,
    `  Limite de gastos......: ${s.spendingLimit ? formatBRL(s.spendingLimit) : "não definido"}`,
    `  Uso do limite.........: ${s.limitUsedPercent != null ? `${s.limitUsedPercent}%` : "-"}`,
    `  Gasto no mês..........: ${formatBRL(s.spent)}`,
    `  Saldo acumulado.......: ${formatBRL(s.balance)}`,
    `  Total histórico.......: ${formatBRL(s.totalAllTime)}`,
    "",
    "POR CATEGORIA (mês atual)",
    ...(s.byCategory.length
      ? s.byCategory.map((c) => `  ${c.category.padEnd(16, ".")}: ${formatBRL(c.total)}`)
      : ["  nenhuma despesa registrada"]),
    "",
    "DESPESAS",
    ...(state.expenses.length
      ? state.expenses
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(
            (e) =>
              `  ${e.date}  ${formatBRL(e.amount).padStart(12)}  ${e.category} - ${e.description}`,
          )
      : ["  nenhuma despesa registrada"]),
    "",
    "RECEITAS EXTRAS",
    ...(state.revenues.length
      ? state.revenues
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((r) => `  ${r.date}  ${formatBRL(r.amount).padStart(12)}  ${r.description}`)
      : ["  nenhuma receita extra registrada"]),
    "",
  ];
  return lines.join("\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

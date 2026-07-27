import { createFileRoute } from "@tanstack/react-router";
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
import { AppNav } from "@/components/app-nav";
import {
  chatMonthKeys,
  currentMonthKey,
  formatBRL,
  incomeLabel,
  lastMonths,
  monthKey,
  monthLabel,
  summarize,
  useFinance,
  type FinanceState,
} from "@/lib/finance-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard financeiro - Finance Chat" },
      {
        name: "description",
        content:
          "Veja renda, gastos por categoria, evolução mensal e projeções do seu orçamento em um painel claro e minimalista.",
      },
      { property: "og:title", content: "Dashboard financeiro - Finance Chat" },
      {
        property: "og:description",
        content: "Indicadores, gráficos e resumos do seu controle financeiro pessoal.",
      },
    ],
  }),
  component: DashboardPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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
    <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums ${
          accent === "positive"
            ? "text-success"
            : accent === "negative"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DashboardContent({ state }: { state: FinanceState }) {
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
  const s = summarize(state, selectedMonth);
  const months = lastMonths(state, 6);
  const monthOptions = useMemo(() => chatMonthKeys(state), [state]);
  const recent = state.expenses
    .filter((expense) => monthKey(expense.date) === selectedMonth)
    .slice()
    .reverse()
    .slice(0, 8);

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
          aria-label="Filtrar dashboard por competencia"
        >
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {monthLabel(month)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Receita total"
          value={formatBRL(s.income)}
          hint={
            state.income
              ? `${incomeLabel(state.income)} + ${formatBRL(s.extraIncome)} extras`
              : "ainda não cadastrada"
          }
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
          accent={s.balance >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Projeção do mês"
          value={formatBRL(s.projection)}
          hint={`média de ${formatBRL(s.dailyAverage)}/dia`}
        />
      </div>

      {s.income > 0 && (
        <div className="animate-rise rounded-[18px] border border-border/55 bg-surface p-5 shadow-soft">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-muted-foreground">Orçamento utilizado</p>
            <p className="text-[13px] font-semibold tabular-nums">
              {Math.round((s.spent / s.income) * 100)}%
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (s.spent / s.income) * 100)}%`,
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
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{e.description}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {e.category} · {new Date(`${e.date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                  {formatBRL(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
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

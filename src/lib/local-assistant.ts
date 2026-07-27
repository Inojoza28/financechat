import {
  cashBalanceUntil,
  financeActions,
  forecastNextMonth,
  formatBRL,
  getFinanceState,
  monthKey,
  monthLabel,
  nextIncomePayment,
  summarize,
  type Expense,
  type FinanceState,
  type IncomePeriod,
  type Revenue,
} from "@/lib/finance-store";

type AssistantResult = {
  text: string;
};

type ConversationContext = {
  messages?: Array<{
    role?: string;
    parts?: Array<{ type?: string; text?: string }>;
  }>;
};

const EXPENSE_WORDS = [
  "gastei",
  "gasto",
  "gastos",
  "paguei",
  "pagar",
  "comprei",
  "compra",
  "despesa",
  "lance",
  "registra",
  "registre",
  "anota",
  "anote",
];

const BASE_INCOME_WORDS = ["renda", "salario", "recebo"];

const EXTRA_REVENUE_WORDS = [
  "ganhei",
  "ganho extra",
  "recebi",
  "entrou",
  "entrada extra",
  "bonus",
  "bonificacao",
  "comissao",
  "freela",
  "a mais",
];

const NEXT_PAYMENT_WORDS = [
  "proximo pagamento",
  "proximo recebimento",
  "proximo salario",
  "quando receber",
  "depois de receber",
  "depois do proximo",
  "apos o proximo",
  "apos o recebimento",
  "vou receber",
  "vou ficar quando receber",
  "vou ficar apos",
  "vou ficar depois",
];

const NEXT_MONTH_WORDS = [
  "proximo mes",
  "ate o proximo mes",
  "mes que vem",
  "mes seguinte",
  "saldo no proximo",
  "saldo para o proximo",
  "comecar o mes",
  "comeco do mes",
  "quanto vou ter no mes",
  "quanto vou ter proximo",
  "quanto vai sobrar para o proximo",
  "nao gastar mais nada",
  "se eu nao gastar",
];

const SPENDING_UNTIL_NEXT_MONTH_WORDS = [
  "quanto posso gastar ate",
  "quanto da para gastar ate",
  "quanto ainda posso gastar ate",
  "posso gastar ate o proximo mes",
  "gastar ate o proximo mes",
];

const REMOVE_WORDS = [
  "apague",
  "apagar",
  "remova",
  "remover",
  "delete",
  "cancele",
  "cancelar",
  "nao gastei",
];

const CATEGORY_HINTS: Record<string, string[]> = {
  Alimentação: ["almoco", "jantar", "lanche", "mercado", "restaurante", "ifood", "comida", "cafe"],
  Moradia: ["aluguel", "condominio", "casa", "apartamento"],
  Transporte: ["uber", "99", "taxi", "gasolina", "combustivel", "onibus", "metro", "transporte"],
  Saúde: ["remedio", "farmacia", "medico", "consulta", "exame", "saude"],
  Lazer: ["cinema", "bar", "show", "viagem", "game", "jogo", "lazer"],
  Contas: ["internet", "luz", "agua", "telefone", "energia", "boleto", "conta"],
  Educação: ["curso", "faculdade", "livro", "escola", "educacao"],
  Compras: ["roupa", "tenis", "shopping", "presente", "compra"],
};

export function parseMoney(text: string): number | null {
  const match = text.match(
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:([,.])(\d{1,2}))?\s*(?:reais?|brl)?/i,
  );
  if (!match) return null;

  const integerPart = match[1];
  const decimalSeparator = match[2];
  const decimalPart = match[3];
  const normalizedInteger = /^\d{1,3}(?:\.\d{3})+$/.test(integerPart)
    ? integerPart.replace(/\./g, "")
    : integerPart;
  const normalized = decimalSeparator
    ? `${normalizedInteger.replace(/\./g, "")}.${decimalPart}`
    : normalizedInteger;
  const amount = Number(normalized);

  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseMoneyValues(text: string) {
  const matches = text.matchAll(
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:([,.])(\d{1,2}))?\s*(?:reais?|brl)?/gi,
  );

  return Array.from(matches)
    .filter((match) => !/\bdia\s*$/i.test(text.slice(Math.max(0, match.index - 6), match.index)))
    .map((match) => parseMoney(match[0]))
    .filter((value): value is number => value != null);
}

function parsePaydays(text: string) {
  const normalized = normalize(text);
  const matches = normalized.matchAll(/\bdia\s+([1-9]|[12]\d|3[01])\b/g);
  return Array.from(matches).map((match) => Number(match[1]));
}

export function parseStandaloneExpenseAmount(text: string): number | null {
  const trimmed = text.trim();
  const amountOnly = /^(?:r\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?\s*(?:reais?|brl)?$/i;

  return amountOnly.test(trimmed) ? parseMoney(trimmed) : null;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function textFromMessage(message: NonNullable<ConversationContext["messages"]>[number]) {
  return (
    message.parts?.map((part) => (part.type === "text" ? (part.text ?? "") : "")).join(" ") ?? ""
  );
}

function recentConversationText(context?: ConversationContext) {
  return (context?.messages ?? []).slice(-4).map(textFromMessage).join(" ");
}

function isVagueFollowUpAboutBalance(text: string) {
  return (
    includesAny(text, ["quanto eu vou ficar", "quanto vou ficar", "quanto vou ter", "e quanto"]) &&
    !includesAny(text, ["gastei", "ganhei", "recebi", "entrou"])
  );
}

function inferCategory(text: string) {
  const normalized = normalize(text);
  for (const [category, hints] of Object.entries(CATEGORY_HINTS)) {
    if (hints.some((hint) => normalized.includes(hint))) return category;
  }
  return "Geral";
}

function cleanDescription(text: string, amount: number) {
  const withoutAmount = text
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:[,.]\d{1,2})?\s*(?:reais?|brl)?/i, "")
    .replace(
      /\b(eu|gastei|gasto|paguei|comprei|compra|despesa|registre|registra|anote|anota|lance)\b/gi,
      "",
    )
    .replace(/\b(com|de|do|da|no|na|em|para)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return withoutAmount || `Gasto de ${formatBRL(amount)}`;
}

function cleanRevenueDescription(text: string, amount: number) {
  const withoutAmount = text
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:[,.]\d{1,2})?\s*(?:reais?|brl)?/i, "")
    .replace(
      /\b(eu|ganhei|recebi|entrou|entrada|extra|bonus|bonificacao|comissao|freela|a mais|um|uma|de)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  return withoutAmount || `Receita extra de ${formatBRL(amount)}`;
}

function formatSummary(month: string) {
  const s = summarize(getFinanceState(), month);
  const categories = s.byCategory.slice(0, 3);
  const categoryText = categories.length
    ? `\n\nMaiores categorias: ${categories.map((c) => `${c.category} (${formatBRL(c.total)})`).join(", ")}.`
    : "";
  const extraText =
    s.extraIncome > 0 ? `\n\nReceitas extras no período: **${formatBRL(s.extraIncome)}**.` : "";

  return `Em ${monthLabel(month)}, você gastou **${formatBRL(s.spent)}** em ${s.count} lançamento${s.count === 1 ? "" : "s"}.\n\nReceita total considerada: **${formatBRL(s.income)}**. Saldo disponível: **${formatBRL(s.balance)}**.${extraText}${categoryText}`;
}

function formatExpenseConfirmation(expense: Expense, month: string) {
  const s = summarize(getFinanceState(), month);
  return `Pronto, registrei a despesa de **${formatBRL(expense.amount)}** em ${expense.category}.\n\nTotal gasto no período: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.`;
}

function formatRevenueConfirmation(revenue: Revenue, month: string) {
  const s = summarize(getFinanceState(), month);
  return `Receita extra registrada: **${formatBRL(revenue.amount)}**.\n\nEla foi somada ao período sem alterar sua renda base. Receita total em ${monthLabel(month)}: **${formatBRL(s.income)}**. Saldo disponível: **${formatBRL(s.balance)}**.`;
}

function incomePeriod(text: string): IncomePeriod {
  const normalized = normalize(text);
  if (normalized.includes("semana")) return "weekly";
  if (normalized.includes("quinzena") || normalized.includes("15 dias")) return "biweekly";
  return "monthly";
}

function registerIncome(text: string) {
  const amounts = parseMoneyValues(text);
  const amount = amounts[0] ?? null;
  if (!amount) {
    return "Consigo cadastrar sua renda, sim. Me diga o valor, por exemplo: `Minha renda é R$ 4.500 por mês`.";
  }

  const period = incomePeriod(text);
  if (period === "biweekly") {
    const days = parsePaydays(text);
    const secondAmount = amounts[1];
    if (!secondAmount) {
      return "Para renda quinzenal, me diga as duas entradas e as datas. Exemplo: `Recebo R$ 2.000 no dia 5 e R$ 1.800 no dia 20`.";
    }
    financeActions.setIncome(amount + secondAmount, period, {
      firstAmount: amount,
      secondAmount,
      firstPayday: days[0] ?? 5,
      secondPayday: days[1] ?? 20,
    });
  } else {
    financeActions.setIncome(amount, period);
  }
  const labels: Record<IncomePeriod, string> = {
    monthly: "mensal",
    biweekly: "quinzenal",
    weekly: "semanal",
  };
  const s = summarize(getFinanceState());

  const income = getFinanceState().income;
  const detail =
    income?.period === "biweekly"
      ? `: **${formatBRL(income.firstAmount ?? 0)}** no dia ${income.firstPayday} e **${formatBRL(income.secondAmount ?? 0)}** no dia ${income.secondPayday}`
      : `: **${formatBRL(amount)}**`;

  return `Renda ${labels[period]} registrada${detail}.\n\nRenda mensal considerada: **${formatBRL(s.income)}**.`;
}

function registerRevenue(text: string, amount: number, month: string) {
  const revenue = financeActions.addRevenue({
    amount,
    description: cleanRevenueDescription(text, amount),
    date: month === monthKey(new Date().toISOString().slice(0, 10)) ? null : `${month}-01`,
  });

  return formatRevenueConfirmation(revenue, month);
}

function registerExpense(text: string, amount: number, month: string) {
  const expense = financeActions.addExpense({
    amount,
    category: inferCategory(text),
    description: cleanDescription(text, amount),
    date: month === monthKey(new Date().toISOString().slice(0, 10)) ? null : `${month}-01`,
  });

  return formatExpenseConfirmation(expense, month);
}

function findExpenseToRemove(text: string, state: FinanceState, month: string) {
  const amount = parseMoney(text);
  const candidates = state.expenses
    .filter((expense) => monthKey(expense.date) === month)
    .slice()
    .reverse();

  if (amount) {
    return candidates.find((expense) => Math.abs(expense.amount - amount) < 0.01) ?? null;
  }

  return candidates[0] ?? null;
}

function removeExpense(text: string, month: string) {
  const expense = findExpenseToRemove(text, getFinanceState(), month);
  if (!expense) return "Não encontrei um lançamento desse período para remover.";

  financeActions.removeExpense(expense.id);
  const s = summarize(getFinanceState(), month);

  return `Removi **${formatBRL(expense.amount)}** de ${expense.category}.\n\nTotal do período agora: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.`;
}

function answerNextPayment(text: string) {
  const state = getFinanceState();
  const payment = nextIncomePayment(state.income);
  if (!payment) {
    return "Ainda não encontrei uma renda recorrente cadastrada. Cadastre sua renda primeiro para eu calcular o próximo pagamento com precisão.";
  }

  const currentCash = cashBalanceUntil(state);
  const currentMonth = monthKey(new Date().toISOString().slice(0, 10));
  const currentSummary = summarize(state, currentMonth);
  const registeredCashBalance =
    currentCash.recurringReceived + currentSummary.extraIncome - currentSummary.spent;
  const afterPayment = registeredCashBalance + payment.amount;
  const dateLabel = new Date(`${payment.date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const normalized = normalize(text);

  if (normalized.includes("quanto vou receber") || normalized.includes("valor")) {
    return `Seu próximo recebimento está previsto para **${dateLabel}**.\n\nValor esperado: **${formatBRL(payment.amount)}**.`;
  }

  return `Seu próximo recebimento está previsto para **${dateLabel}**, no valor de **${formatBRL(payment.amount)}**.\n\nConsiderando as receitas extras e todas as despesas já registradas em ${monthLabel(currentMonth)}, você tem **${formatBRL(registeredCashBalance)}** disponível antes desse pagamento. Após receber, a estimativa fica em **${formatBRL(afterPayment)}**.\n\nCálculo: ${formatBRL(currentCash.recurringReceived)} de renda recorrente já recebida + ${formatBRL(currentSummary.extraIncome)} em receitas extras - ${formatBRL(currentSummary.spent)} em despesas registradas + ${formatBRL(payment.amount)} do próximo pagamento.`;
}

function answerNextMonthProjection(month: string) {
  const state = getFinanceState();
  const forecast = forecastNextMonth(state, month);
  const expenseText =
    forecast.registeredExpenseCount > 0
      ? `${formatBRL(forecast.registeredExpenses)} em despesas já registradas`
      : "nenhuma despesa já registrada";

  return `Se nada mais for registrado até lá, você deve chegar a **${formatBRL(forecast.projectedAvailable)}** em ${monthLabel(forecast.nextMonth)}.\n\nComo cheguei nesse valor:\n- Saldo projetado ao fim de ${monthLabel(forecast.currentMonth)}: **${formatBRL(forecast.projectedStartBalance)}**\n- Renda recorrente prevista para ${monthLabel(forecast.nextMonth)}: **${formatBRL(forecast.recurringIncome)}**\n- Receitas extras já registradas para ${monthLabel(forecast.nextMonth)}: **${formatBRL(forecast.extraIncome)}**\n- Despesas já registradas para ${monthLabel(forecast.nextMonth)}: **${expenseText}**\n\nCálculo: ${formatBRL(forecast.projectedStartBalance)} + ${formatBRL(forecast.projectedIncome)} - ${formatBRL(forecast.registeredExpenses)} = **${formatBRL(forecast.projectedAvailable)}**.`;
}

function answerSpendingUntilNextMonth(month: string) {
  const state = getFinanceState();
  const current = summarize(state, month);
  const forecast = forecastNextMonth(state, month);
  const ifSpendAllCurrentBalance =
    forecast.projectedAvailable - Math.max(0, forecast.projectedStartBalance);

  return `Você pode gastar até **${formatBRL(Math.max(0, current.balance))}** até o fim de ${monthLabel(month)} sem deixar o período negativo.\n\nSe não gastar mais nada, a projeção para ${monthLabel(forecast.nextMonth)} fica em **${formatBRL(forecast.projectedAvailable)}**.\n\nSe gastar todo o saldo disponível deste mês, você começaria ${monthLabel(forecast.nextMonth)} com cerca de **${formatBRL(ifSpendAllCurrentBalance)}**, considerando a renda prevista, receitas extras e despesas já registradas para o próximo mês.`;
}

function simulateSpend(text: string, month: string) {
  const amount = parseMoney(text);
  if (!amount) return null;

  const s = summarize(getFinanceState(), month);
  const after = s.balance - amount;
  const verdict =
    after >= 0
      ? `Sim. Depois desse gasto, ainda sobrariam **${formatBRL(after)}**.`
      : `Do jeito que está, esse gasto deixaria o saldo em **${formatBRL(after)}**.`;

  return `${verdict}\n\nHoje o saldo disponível em ${monthLabel(month)} é **${formatBRL(s.balance)}**.`;
}

function listRecent(month: string) {
  const expenses = getFinanceState()
    .expenses.filter((expense) => monthKey(expense.date) === month)
    .slice()
    .reverse()
    .slice(0, 5);

  if (!expenses.length) return `Ainda não há despesas registradas em ${monthLabel(month)}.`;

  return [
    `Últimos lançamentos de ${monthLabel(month)}:`,
    ...expenses.map(
      (expense) => `- ${formatBRL(expense.amount)} em ${expense.category}: ${expense.description}`,
    ),
  ].join("\n");
}

export function answerLocally(
  text: string,
  month: string,
  context?: ConversationContext,
): AssistantResult {
  const normalized = normalize(text);
  const recentText = normalize(recentConversationText(context));
  const standaloneAmount = parseStandaloneExpenseAmount(text);
  const amount = standaloneAmount ?? parseMoney(text);
  const vagueBalanceFollowUp = isVagueFollowUpAboutBalance(normalized);

  if (includesAny(normalized, REMOVE_WORDS)) {
    return { text: removeExpense(text, month) };
  }

  if (
    includesAny(normalized, NEXT_PAYMENT_WORDS) ||
    (vagueBalanceFollowUp && includesAny(recentText, NEXT_PAYMENT_WORDS))
  ) {
    return { text: answerNextPayment(text) };
  }

  if (includesAny(normalized, SPENDING_UNTIL_NEXT_MONTH_WORDS)) {
    return { text: answerSpendingUntilNextMonth(month) };
  }

  if (
    includesAny(normalized, NEXT_MONTH_WORDS) ||
    (vagueBalanceFollowUp && includesAny(recentText, NEXT_MONTH_WORDS))
  ) {
    return { text: answerNextMonthProjection(month) };
  }

  if (amount && includesAny(normalized, EXTRA_REVENUE_WORDS)) {
    return { text: registerRevenue(text, amount, month) };
  }

  if (includesAny(normalized, BASE_INCOME_WORDS)) {
    return { text: registerIncome(text) };
  }

  if (
    normalized.includes("consigo") ||
    normalized.includes("posso") ||
    normalized.includes("da para") ||
    normalized.includes("simula")
  ) {
    const simulation = simulateSpend(text, month);
    if (simulation) return { text: simulation };
  }

  if (standaloneAmount !== null || (amount && includesAny(normalized, EXPENSE_WORDS))) {
    return { text: registerExpense(text, amount, month) };
  }

  if (
    normalized.includes("resumo") ||
    normalized.includes("como esta") ||
    normalized.includes("mes") ||
    normalized.includes("panorama")
  ) {
    return { text: formatSummary(month) };
  }

  if (normalized.includes("saldo") || normalized.includes("disponivel")) {
    const s = summarize(getFinanceState(), month);
    return { text: `Seu saldo disponível em ${monthLabel(month)} é **${formatBRL(s.balance)}**.` };
  }

  if (
    normalized.includes("projecao") ||
    normalized.includes("estimativa") ||
    normalized.includes("media")
  ) {
    const s = summarize(getFinanceState(), month);
    return {
      text: `Sua média diária está em **${formatBRL(s.dailyAverage)}**. Mantendo esse ritmo, a projeção do período fica em **${formatBRL(s.projection)}**.`,
    };
  }

  if (
    normalized.includes("ultimos") ||
    normalized.includes("lancamentos") ||
    normalized.includes("despesas") ||
    normalized.includes("gastos")
  ) {
    return { text: listRecent(month) };
  }

  const examples = [
    "`Gastei R$ 35 com almoço`",
    "`40 reais`",
    "`Ganhei R$ 100`",
    "`Quanto terei após o próximo pagamento?`",
    "`Quanto vou ter no próximo mês?`",
    "`Minha renda é R$ 4.500 por mês`",
  ].join(", ");

  return {
    text: `Desculpe, não consegui entender essa solicitação com segurança.\n\nPosso ajudar você a registrar receitas e despesas, consultar saldo, fazer projeções financeiras, mostrar seus gastos e simular decisões. Tente reformular usando algo como ${examples}.`,
  };
}

export function buildTextMessage(role: "user" | "assistant", text: string) {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    role,
    parts: [{ type: "text", text }],
  };
}

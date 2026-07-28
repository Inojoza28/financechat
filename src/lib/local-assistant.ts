import {
  cashBalanceUntil,
  financeActions,
  forecastNextMonth,
  formatBRL,
  getFinanceState,
  incomeLabel,
  isIncomeAutoDepositEnabled,
  localISODate,
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

const ADD_TO_BALANCE_WORDS = [
  "adicione",
  "adicionar",
  "adiciona",
  "coloque",
  "colocar",
  "coloca",
  "some",
  "somar",
  "soma",
  "deposite",
  "depositar",
  "deposita",
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

const LIMIT_WORDS = ["limite", "orcamento", "teto"];

const FIXED_EXPENSE_WORDS = [
  "despesa fixa",
  "despesas fixas",
  "gasto fixo",
  "gastos fixos",
  "conta fixa",
  "contas fixas",
  "recorrente",
  "recorrentes",
  "todo mes",
  "mensal fixa",
];

const LIST_FIXED_EXPENSE_WORDS = [
  "listar",
  "liste",
  "lista",
  "mostrar",
  "mostre",
  "quais",
  "consultar",
  "consulta",
  "ver despesas fixas",
  "minhas despesas fixas",
  "despesas fixas cadastradas",
  "gastos fixos cadastrados",
  "contas fixas cadastradas",
];

const REMOVE_WORDS = [
  "apague",
  "apagar",
  "remova",
  "remover",
  "delete",
  "cancele",
  "cancelar",
  "cancela",
  "desconsidere",
  "desconsidera",
  "exclui",
  "excluir",
  "nao gastei",
];

const EDIT_HELP_WORDS = [
  "editar despesa",
  "editar uma despesa",
  "editar um gasto",
  "edito despesa",
  "edito uma despesa",
  "edito um gasto",
  "edito gasto",
  "alterar despesa",
  "alterar uma despesa",
  "alterar um gasto",
  "altero despesa",
  "altero uma despesa",
  "altero um gasto",
  "altero gasto",
  "mudar despesa",
  "mudar uma despesa",
  "mudar um gasto",
  "corrigir despesa",
  "corrigir uma despesa",
  "corrigir um gasto",
  "posso alterar um gasto",
  "posso alterar uma despesa",
  "posso editar um gasto",
  "posso editar uma despesa",
  "como faco para editar",
  "como editar uma despesa",
  "como editar um gasto",
];

const CONFIRM_WORDS = ["sim", "confirmo", "confirmar", "pode apagar", "pode excluir", "isso"];

const DENY_WORDS = ["nao", "não", "cancela", "cancelar", "deixa", "desistir", "mantem"];

const GREETING_PHRASES = [
  "oi",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite",
  "opa",
  "e ai",
  "eae",
  "fala",
  "salve",
];

const CLOSING_PHRASES = [
  "ok",
  "okay",
  "ta certo",
  "tá certo",
  "certo",
  "beleza",
  "blz",
  "show",
  "perfeito",
  "combinado",
  "entendi",
  "valeu",
  "obrigado",
  "obrigada",
  "obg",
  "ate mais",
  "até mais",
  "tchau",
  "falou",
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
  const matches = normalized.matchAll(/\bdia\s+(0?[1-9]|[12]\d|3[01])\b/g);
  return Array.from(matches).map((match) => Number(match[1]));
}

export function parseStandaloneExpenseAmount(text: string): number | null {
  const trimmed = text.trim();
  const amountOnly = /^(?:r\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?\s*(?:reais?|brl)?$/i;

  return amountOnly.test(trimmed) ? parseMoney(trimmed) : null;
}

function hasExpenseDescriptionWithAmount(text: string) {
  const withoutAmount = text
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:[,.]\d{1,2})?\s*(?:reais?|brl)?/i, "")
    .trim();
  const normalized = normalize(withoutAmount);
  const questionWords = [
    "quanto",
    "qual",
    "como",
    "quando",
    "posso",
    "consigo",
    "simula",
    "simule",
  ];

  return /[a-zA-ZÀ-ÿ]/.test(withoutAmount) && !questionWords.some((word) => normalized.startsWith(word));
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function compactMessage(text: string) {
  return normalize(text)
    .replace(/[!?.,;:()[\]{}'"`´~^]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function isShortConversationalPhrase(text: string, phrases: string[]) {
  const words = text.split(" ").filter(Boolean);
  return (
    words.length <= 4 &&
    phrases.some((phrase) => text === phrase || text === `${phrase} fin` || text === `${phrase} heyfin`)
  );
}

function isClosingPhrase(text: string) {
  if (isShortConversationalPhrase(text, CLOSING_PHRASES)) return true;

  const withoutAssistantName = text.replace(/\b(fin|heyfin)\b/g, "").replace(/\s+/g, " ").trim();
  const words = withoutAssistantName.split(" ").filter(Boolean);

  return words.length <= 6 && includesAny(withoutAssistantName, CLOSING_PHRASES);
}

function isGreetingPhrase(text: string) {
  if (isShortConversationalPhrase(text, GREETING_PHRASES)) return true;

  const withoutAssistantName = text.replace(/\b(fin|heyfin)\b/g, "").replace(/\s+/g, " ").trim();
  const parts = withoutAssistantName.split(" ").filter(Boolean);
  if (parts.length > 4) return false;

  const greetingPattern =
    /^(?:(?:oi|ola|opa|e ai|eae|fala|salve)\s+)?(?:bom dia|boa tarde|boa noite)$/;

  return greetingPattern.test(withoutAssistantName);
}

function hasFinancialSignal(text: string, amount: number | null) {
  return (
    amount != null ||
    includesAny(text, [
      ...EXPENSE_WORDS,
      ...BASE_INCOME_WORDS,
      ...EXTRA_REVENUE_WORDS,
      ...ADD_TO_BALANCE_WORDS,
      ...NEXT_PAYMENT_WORDS,
      ...NEXT_MONTH_WORDS,
      ...SPENDING_UNTIL_NEXT_MONTH_WORDS,
      ...LIMIT_WORDS,
      ...FIXED_EXPENSE_WORDS,
      ...REMOVE_WORDS,
      "saldo",
      "disponivel",
      "receita",
      "receitas",
      "despesa",
      "despesas",
      "gasto",
      "gastos",
      "lancamento",
      "lancamentos",
      "projecao",
      "estimativa",
      "media",
      "dashboard",
    ])
  );
}

function answerSmallTalk(text: string, amount: number | null) {
  const compact = compactMessage(text);
  if (!compact || hasFinancialSignal(compact, amount)) return null;

  if (isGreetingPhrase(compact)) {
    if (compact.startsWith("bom dia")) {
      return "Bom dia! Estou por aqui para te ajudar a registrar gastos, receitas e acompanhar seu saldo com clareza.";
    }

    if (compact.includes("boa tarde")) {
      return "Boa tarde! Pode me contar um gasto, uma receita ou perguntar como estão suas finanças.";
    }

    if (compact.includes("boa noite")) {
      return "Boa noite! Quando quiser, posso registrar seus lançamentos ou consultar seu saldo para você.";
    }

    return "Oi! Estou por aqui para te ajudar com seu controle financeiro. Pode me contar um gasto, uma receita ou perguntar sobre saldo e projeções.";
  }

  if (isClosingPhrase(compact)) {
    if (includesAny(compact, ["obrigado", "obrigada", "obg", "valeu"])) {
      return "De nada! Sempre que precisar, posso te ajudar a acompanhar receitas, despesas, saldo e projeções.";
    }

    if (includesAny(compact, ["tchau", "ate mais", "falou"])) {
      return "Até mais! Quando voltar, continuo te ajudando a manter suas finanças organizadas.";
    }

    return "Combinado. Quando quiser, é só me chamar para registrar algo ou consultar sua situação financeira.";
  }

  return null;
}

function isConfirmation(text: string) {
  const normalized = normalize(text).trim();
  return CONFIRM_WORDS.some((word) => normalized === word || normalized.includes(word));
}

function isDenial(text: string) {
  const normalized = normalize(text).trim();
  return DENY_WORDS.some((word) => normalized === word || normalized.includes(word));
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
      /\b(eu|ganhei|recebi|entrou|entrada|extra|bonus|bonificacao|comissao|freela|a mais|adicione|adicionar|adiciona|coloque|colocar|coloca|some|somar|soma|deposite|depositar|deposita|saldo|um|uma|de|ao|no|na)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  return withoutAmount || `Receita extra de ${formatBRL(amount)}`;
}

function isAddToBalanceIntent(text: string) {
  return includesAny(text, ADD_TO_BALANCE_WORDS) && !includesAny(text, EXPENSE_WORDS);
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localISODate(date);
}

function expenseLine(expense: Expense) {
  return `${formatBRL(expense.amount)} em ${expense.category}: ${expense.description}`;
}

function formatSummary(month: string) {
  const s = summarize(getFinanceState(), month);
  const categories = s.byCategory.slice(0, 3);
  const categoryText = categories.length
    ? `\n\nMaiores categorias: ${categories.map((c) => `${c.category} (${formatBRL(c.total)})`).join(", ")}.`
    : "";
  const fixedText = s.plannedFixedExpenseCount
    ? `\n\nDespesas fixas consideradas neste mês: **${formatBRL(s.fixedSpent)}** de **${formatBRL(s.plannedFixedSpent)}** previstos.`
    : "";
  const limitText = s.spendingLimit
    ? `\n\nLimite de gastos: **${formatBRL(s.spendingLimit)}**. Você já usou **${s.limitUsedPercent}%** e ainda tem **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}** dentro do limite.`
    : "";

  return `Em ${monthLabel(month)}, você gastou **${formatBRL(s.spent)}** em ${s.count} lançamento${s.count === 1 ? "" : "s"}.\n\nRenda recorrente recebida nesta competência: **${formatBRL(s.recurringIncome)}**. Receitas extras do mês: **${formatBRL(s.extraIncome)}**. Saldo disponível acumulado: **${formatBRL(s.balance)}**.${fixedText}${limitText}${categoryText}`;
}

function formatExpenseConfirmation(expense: Expense, month: string) {
  const s = summarize(getFinanceState(), month);
  const limitText =
    s.spendingLimit == null
      ? ""
      : s.limitStatus === "exceeded"
        ? `\n\nAtenção: você passou do limite de gastos em **${formatBRL(Math.abs(s.limitRemaining ?? 0))}**.`
        : s.limitStatus === "warning"
          ? `\n\nAtenção: você já usou **${s.limitUsedPercent}%** do seu limite. Ainda restam **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}**.`
          : `\n\nVocê usou **${s.limitUsedPercent}%** do limite e ainda tem **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}** para gastar dentro do teto definido.`;

  return `Pronto, registrei a despesa de **${formatBRL(expense.amount)}** em ${expense.category}.\n\nTotal gasto no período: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.${limitText}`;
}

function formatRevenueConfirmation(revenue: Revenue, month: string) {
  const s = summarize(getFinanceState(), month);
  return `Receita extra registrada: **${formatBRL(revenue.amount)}**.\n\nEla foi somada ao seu saldo sem alterar a renda recorrente cadastrada. Extras em ${monthLabel(month)}: **${formatBRL(s.extraIncome)}**. Saldo disponível acumulado: **${formatBRL(s.balance)}**.`;
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
  const days = parsePaydays(text);
  if (period === "biweekly") {
    const secondAmount = amounts[1];
    if (!secondAmount) {
      return "Para renda quinzenal, me diga as duas entradas e as datas. Exemplo: `Recebo R$ 2.000 no dia 5 e R$ 1.800 no dia 20`.";
    }
    financeActions.setIncome(amount + secondAmount, period, {
      autoDeposit: true,
      firstAmount: amount,
      secondAmount,
      firstPayday: days[0] ?? 5,
      secondPayday: days[1] ?? 20,
    });
  } else {
    financeActions.setIncome(amount, period, {
      autoDeposit: true,
      payday: days[0] ?? 1,
      firstPaymentDate: localISODate(),
    });
  }
  const labels: Record<IncomePeriod, string> = {
    monthly: "mensal",
    biweekly: "quinzenal",
    weekly: "semanal",
  };
  const s = summarize(getFinanceState());

  const income = getFinanceState().income;
  const detail = income ? `: ${incomeLabel(income)}` : `: **${formatBRL(amount)}**`;

  return `Renda ${labels[period]} registrada${detail}.\n\nO lançamento automático ficou ativo. A renda recorrente será considerada no saldo quando cada data de pagamento chegar, sem alterar as receitas extras.`;
}

function setSpendingLimit(text: string, month: string) {
  const amount = parseMoney(text);
  if (!amount) {
    const s = summarize(getFinanceState(), month);
    const suggestion =
      s.recommendedSpendingLimit > 0
        ? ` Uma boa referência inicial, baseada em 80% da sua renda recorrente, é **${formatBRL(s.recommendedSpendingLimit)}**.`
        : "";
    return `Consigo configurar seu limite de gastos. Me diga o valor máximo para o período, por exemplo: \`Meu limite de gastos é R$ 1.800\`.${suggestion}`;
  }

  financeActions.setSpendingLimit(amount);
  const s = summarize(getFinanceState(), month);

  return `Limite de gastos definido em **${formatBRL(amount)}** por período.\n\nEm ${monthLabel(month)}, você já gastou **${formatBRL(s.spent)}**, o que representa **${s.limitUsedPercent}%** do limite. Ainda restam **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}** dentro do teto.`;
}

function clearSpendingLimit() {
  financeActions.setSpendingLimit(null);
  return "Pronto, removi o limite de gastos. Suas despesas e receitas continuam salvas normalmente.";
}

function answerSpendingLimit(month: string) {
  const s = summarize(getFinanceState(), month);
  if (!s.spendingLimit) {
    const suggestion =
      s.recommendedSpendingLimit > 0
        ? `\n\nPela sua renda atual, uma sugestão conservadora seria começar com **${formatBRL(s.recommendedSpendingLimit)}**.`
        : "";
    return `Você ainda não definiu um limite de gastos para o período.${suggestion}\n\nPara cadastrar, diga algo como: \`Meu limite de gastos é R$ 1.800\`.`;
  }

  const statusText =
    s.limitStatus === "exceeded"
      ? `Você ultrapassou o limite em **${formatBRL(Math.abs(s.limitRemaining ?? 0))}**.`
      : s.limitStatus === "warning"
        ? `Você está perto do limite: já usou **${s.limitUsedPercent}%**.`
        : `Você está dentro do limite: usou **${s.limitUsedPercent}%**.`;

  return `Seu limite de gastos em ${monthLabel(month)} é **${formatBRL(s.spendingLimit)}**.\n\n${statusText} Total gasto: **${formatBRL(s.spent)}**. Ainda disponível dentro do limite: **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}**.`;
}

function registerRevenue(text: string, amount: number, month: string) {
  const revenue = financeActions.addRevenue({
    amount,
    description: cleanRevenueDescription(text, amount),
    date: month === monthKey(localISODate()) ? null : `${month}-01`,
  });

  return formatRevenueConfirmation(revenue, month);
}

function registerExpense(text: string, amount: number, month: string) {
  const expense = financeActions.addExpense({
    amount,
    category: inferCategory(text),
    description: cleanDescription(text, amount),
    date: month === monthKey(localISODate()) ? null : `${month}-01`,
  });

  return formatExpenseConfirmation(expense, month);
}

function findExpenseCandidatesToRemove(text: string, state: FinanceState, month: string) {
  const normalized = normalize(text);
  const amount = parseMoney(text);
  const candidates = state.expenses
    .filter((expense) => monthKey(expense.date) === month)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (normalized.includes("ontem")) {
    return candidates.filter((expense) => expense.date === isoDateDaysAgo(1));
  }

  if (
    includesAny(normalized, [
      "ultimo",
      "ultima",
      "anterior",
      "acabei",
      "essa despesa",
      "esse gasto",
      "aquele gasto",
      "aquela despesa",
    ])
  ) {
    return candidates.slice(0, 1);
  }

  if (amount) {
    return candidates.filter((expense) => Math.abs(expense.amount - amount) < 0.01);
  }

  return candidates;
}

function removeExpense(text: string, month: string) {
  const state = getFinanceState();
  const candidates = findExpenseCandidatesToRemove(text, state, month);
  if (!candidates.length) {
    financeActions.setPendingAction(null);
    return "Não encontrei uma despesa correspondente nesse período. Você pode conferir os lançamentos no Dashboard ou me dizer o valor exato, por exemplo: `Apaga a despesa de R$ 25,27`.";
  }

  if (candidates.length > 1) {
    financeActions.setPendingAction(null);
    return [
      "Encontrei mais de uma despesa possível. Para evitar apagar o lançamento errado, me diga qual delas você quer remover:",
      ...candidates.slice(0, 5).map((expense) => `- ${expenseLine(expense)}`),
    ].join("\n");
  }

  const expense = candidates[0];
  financeActions.setPendingAction({
    type: "deleteExpense",
    expenseId: expense.id,
    month,
    createdAt: new Date().toISOString(),
  });

  return `Só para confirmar: você quer excluir **${expenseLine(expense)}**?\n\nResponda **sim** para confirmar ou **não** para manter o lançamento.`;
}

function answerPendingAction(text: string, month: string) {
  const state = getFinanceState();
  const pending = state.pendingAction;
  if (!pending || pending.type !== "deleteExpense") return null;

  const expense = state.expenses.find((item) => item.id === pending.expenseId);
  if (!expense) {
    financeActions.setPendingAction(null);
    return "Essa despesa já não está mais disponível. Não apaguei nada.";
  }

  if (isDenial(text)) {
    financeActions.setPendingAction(null);
    return "Tudo certo, mantive a despesa registrada.";
  }

  if (!isConfirmation(text)) return null;

  financeActions.removeExpense(expense.id);
  const s = summarize(getFinanceState(), pending.month);

  return `Pronto, excluí **${expenseLine(expense)}**.\n\nTotal de ${monthLabel(pending.month)} agora: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.`;
}

function answerEditHelp() {
  return "Sim. Para editar uma despesa, entre no **Dashboard**, vá até **Últimos lançamentos** e clique na despesa que quer ajustar. Vai abrir um modal onde você pode alterar descrição, valor e categoria, salvar as mudanças ou excluir o lançamento com confirmação.";
}

function isEditHelpRequest(text: string) {
  if (includesAny(text, EDIT_HELP_WORDS)) return true;

  const asksHow = includesAny(text, ["como", "onde", "por onde", "de que forma"]);
  const editVerb = /\b(edito|editar|altero|alterar|mudo|mudar|corrijo|corrigir|ajusto|ajustar)\b/.test(text);
  const expenseTarget = /\b(despesa|despesas|gasto|gastos|lancamento|lancamentos)\b/.test(text);

  return asksHow && editVerb && expenseTarget;
}

function answerFixedExpenseHelp(text: string) {
  const amount = parseMoney(text);
  const days = parsePaydays(text);
  const detail =
    amount || days.length
      ? `\n\nPelo que você informou, a despesa parece ser ${amount ? `de **${formatBRL(amount)}**` : "mensal"}${days[0] ? ` com vencimento no dia **${days[0]}**` : ""}. Para salvar com nome, categoria e início correto, use o Dashboard.`
      : "\n\nSe quiser cadastrar uma despesa mensal fixa, informe valor, nome e dia de vencimento no Dashboard. Exemplo: internet, R$ 120,00, vencimento dia 10.";

  return `As despesas fixas são gerenciadas pelo **Dashboard**, na seção **Despesas fixas**. Lá você pode adicionar, editar ou excluir recorrências mensais com segurança.\n\nQuando a data de vencimento chega em cada mês, essa despesa passa a ser considerada automaticamente no saldo, nos limites e nas projeções.${detail}`;
}

function isFixedExpenseListRequest(text: string) {
  return includesAny(text, LIST_FIXED_EXPENSE_WORDS);
}

function listFixedExpenses(month: string) {
  const fixedExpenses = getFinanceState()
    .fixedExpenses.slice()
    .sort((a, b) => a.payday - b.payday || a.description.localeCompare(b.description, "pt-BR"));

  if (!fixedExpenses.length) {
    return "Você ainda não tem despesas fixas cadastradas.\n\nPara adicionar uma, entre no **Dashboard** e use a seção **Despesas fixas**.";
  }

  const activeInMonth = fixedExpenses.filter((expense) => month >= expense.startsAtMonth);
  const totalActive = activeInMonth.reduce((sum, expense) => sum + expense.amount, 0);
  const intro =
    activeInMonth.length === fixedExpenses.length
      ? `Você tem ${fixedExpenses.length} despesa${fixedExpenses.length === 1 ? "" : "s"} fixa${fixedExpenses.length === 1 ? "" : "s"} cadastrada${fixedExpenses.length === 1 ? "" : "s"}.`
      : `Você tem ${fixedExpenses.length} despesa${fixedExpenses.length === 1 ? "" : "s"} fixa${fixedExpenses.length === 1 ? "" : "s"} cadastrada${fixedExpenses.length === 1 ? "" : "s"}, sendo ${activeInMonth.length} ativa${activeInMonth.length === 1 ? "" : "s"} em ${monthLabel(month)}.`;

  return [
    `${intro}\n\nTotal ativo em ${monthLabel(month)}: **${formatBRL(totalActive)}**.`,
    ...fixedExpenses.map((expense) => {
      const status = month >= expense.startsAtMonth ? "" : `, começa em ${monthLabel(expense.startsAtMonth)}`;
      return `- **${expense.description}**: ${formatBRL(expense.amount)}, vencimento dia ${String(expense.payday).padStart(2, "0")}${status}`;
    }),
    "\nPara editar ou excluir alguma delas, acesse o **Dashboard**, na seção **Despesas fixas**.",
  ].join("\n");
}

function answerNextPayment(text: string) {
  const state = getFinanceState();
  const payment = nextIncomePayment(state.income);
  if (!payment) {
    return "Ainda não encontrei uma renda recorrente cadastrada. Cadastre sua renda primeiro para eu calcular o próximo pagamento com precisão.";
  }

  const currentCash = cashBalanceUntil(state);
  const paymentDate = new Date(`${payment.date}T12:00:00`);
  const projectedCash = cashBalanceUntil(state, paymentDate);
  const registeredCashBalance = currentCash.balance;
  const afterPayment = isIncomeAutoDepositEnabled(state.income)
    ? projectedCash.balance
    : projectedCash.balance + payment.amount;
  const deductionsUntilPayment = Math.max(0, projectedCash.spent - currentCash.spent);
  const extraUntilPayment = Math.max(0, projectedCash.extraIncome - currentCash.extraIncome);
  const deductionText =
    deductionsUntilPayment > 0
      ? ` - ${formatBRL(deductionsUntilPayment)} em despesas previstas até essa data`
      : "";
  const extraText =
    extraUntilPayment > 0 ? ` + ${formatBRL(extraUntilPayment)} em receitas extras previstas` : "";
  const autoText = isIncomeAutoDepositEnabled(state.income)
    ? ""
    : "\n\nObservação: o lançamento automático da renda está desativado. Este cálculo mostra uma projeção após o recebimento, mas o saldo só será atualizado automaticamente se você ativar essa opção em Ajustes.";
  const dateLabel = new Date(`${payment.date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const normalized = normalize(text);

  if (normalized.includes("quanto vou receber") || normalized.includes("valor")) {
    return `Seu próximo recebimento está previsto para **${dateLabel}**.\n\nValor esperado: **${formatBRL(payment.amount)}**.${autoText}`;
  }

  return `Seu próximo recebimento está previsto para **${dateLabel}**, no valor de **${formatBRL(payment.amount)}**.\n\nSeu saldo disponível acumulado hoje é **${formatBRL(registeredCashBalance)}**. Após esse pagamento, a estimativa fica em **${formatBRL(afterPayment)}**.\n\nCálculo: saldo acumulado atual de ${formatBRL(registeredCashBalance)} + ${formatBRL(payment.amount)} do próximo pagamento${extraText}${deductionText}.\n\nAs despesas previstas incluem despesas fixas com vencimento até a data do pagamento.${autoText}`;
}

function answerNextMonthProjection(month: string) {
  const state = getFinanceState();
  const forecast = forecastNextMonth(state, month);
  const expenseText =
    forecast.registeredExpenseCount > 0
      ? `${formatBRL(forecast.registeredExpenses)} em despesas já registradas e fixas previstas`
      : "nenhuma despesa registrada ou fixa prevista";

  return `Se nada mais for registrado até lá, você deve chegar a **${formatBRL(forecast.projectedAvailable)}** em ${monthLabel(forecast.nextMonth)}.\n\nComo cheguei nesse valor:\n- Saldo acumulado projetado ao fim de ${monthLabel(forecast.currentMonth)}: **${formatBRL(forecast.projectedStartBalance)}**\n- Renda recorrente de ${monthLabel(forecast.nextMonth)}: **${formatBRL(forecast.plannedRecurringIncome)}**\n- Receitas extras já registradas para ${monthLabel(forecast.nextMonth)}: **${formatBRL(forecast.extraIncome)}**\n- Despesas registradas e fixas previstas para ${monthLabel(forecast.nextMonth)}: **${expenseText}**\n\nCálculo: ${formatBRL(forecast.projectedStartBalance)} + ${formatBRL(forecast.projectedIncome)} - ${formatBRL(forecast.registeredExpenses)} = **${formatBRL(forecast.projectedAvailable)}**.`;
}

function answerSpendingUntilNextMonth(month: string) {
  const state = getFinanceState();
  const current = summarize(state, month);
  const forecast = forecastNextMonth(state, month);
  const ifSpendAllCurrentBalance =
    forecast.projectedAvailable - Math.max(0, forecast.projectedStartBalance);

  return `Você pode gastar até **${formatBRL(Math.max(0, current.balance))}** sem deixar seu saldo acumulado negativo.\n\nSe não gastar mais nada, a projeção para ${monthLabel(forecast.nextMonth)} fica em **${formatBRL(forecast.projectedAvailable)}**.\n\nSe gastar todo o saldo disponível, você começaria ${monthLabel(forecast.nextMonth)} com cerca de **${formatBRL(ifSpendAllCurrentBalance)}**, considerando a renda recorrente, receitas extras, despesas já registradas e despesas fixas previstas para o próximo mês.`;
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

  return `${verdict}\n\nHoje seu saldo disponível acumulado é **${formatBRL(s.balance)}**.`;
}

function listRecent() {
  const today = localISODate();
  const cutoff = isoDateDaysAgo(38);
  const expenses = getFinanceState()
    .expenses.filter((expense) => expense.date >= cutoff && expense.date <= today)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  if (!expenses.length) return "Ainda não há despesas registradas nos últimos 38 dias.";

  return [
    "Últimos lançamentos dos últimos 38 dias:",
    ...expenses.map(
      (expense) =>
        `- ${formatBRL(expense.amount)} em ${expense.category}: ${expense.description} (${new Date(`${expense.date}T12:00:00`).toLocaleDateString("pt-BR")})`,
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
  const pendingResponse = answerPendingAction(text, month);

  if (pendingResponse) {
    return { text: pendingResponse };
  }

  const smallTalkResponse = answerSmallTalk(text, amount);
  if (smallTalkResponse) {
    return { text: smallTalkResponse };
  }

  if (isEditHelpRequest(normalized)) {
    return { text: answerEditHelp() };
  }

  if (includesAny(normalized, FIXED_EXPENSE_WORDS)) {
    if (isFixedExpenseListRequest(normalized)) {
      return { text: listFixedExpenses(month) };
    }

    return { text: answerFixedExpenseHelp(text) };
  }

  if (includesAny(normalized, LIMIT_WORDS)) {
    if (includesAny(normalized, ["remover", "remova", "apagar", "apague", "tirar", "limpar"])) {
      return { text: clearSpendingLimit() };
    }

    if (
      amount ||
      includesAny(normalized, ["definir", "defina", "cadastrar", "cadastre", "meu limite e"])
    ) {
      return { text: setSpendingLimit(text, month) };
    }

    return { text: answerSpendingLimit(month) };
  }

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

  if (amount && (includesAny(normalized, EXTRA_REVENUE_WORDS) || isAddToBalanceIntent(normalized))) {
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

  if (
    standaloneAmount !== null ||
    (amount && (includesAny(normalized, EXPENSE_WORDS) || hasExpenseDescriptionWithAmount(text)))
  ) {
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
    return { text: `Seu saldo disponível acumulado até ${monthLabel(month)} é **${formatBRL(s.balance)}**.` };
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
    return { text: listRecent() };
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

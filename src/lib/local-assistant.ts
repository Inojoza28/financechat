import {
  cashBalanceUntil,
  currentMonthKey,
  financeActions,
  fixedExpenseOccurrencesForMonth,
  forecastFutureMonth,
  forecastNextMonth,
  forecastUntilDate,
  formatBRL,
  getFinanceState,
  goalProgress,
  goalsWithProgress,
  incomeLabel,
  isIncomeAutoDepositEnabled,
  localISODate,
  monthKey,
  monthLabel,
  nextIncomePayment,
  offsetMonthKey,
  recurringIncomeOccurrencesForMonth,
  summarize,
  type Expense,
  type FinancialGoal,
  type FinanceState,
  type IncomePeriod,
  type Revenue,
} from "@/lib/finance-store";
import { normalizeSpokenMoneyText } from "@/lib/spoken-money";
import { SUPPORT_COMMAND } from "@/lib/support";

type AssistantResult = {
  text: string;
};

const SEQUENTIAL_SPENDING_ALERT_KEY = "heyfin.sequential-spending-alerts.v1";
const SEQUENTIAL_SPENDING_WINDOW_HOURS = 4;

type ConversationContext = {
  messages?: Array<{
    role?: string;
    parts?: Array<{ type?: string; text?: string }>;
  }>;
};

type ParsedExpenseEntry = {
  amount: number;
  description: string;
  category: string;
  month?: string;
  targetStatus?: "current-or-future" | "past-explicit" | "ambiguous-past";
  monthLabel?: string;
};

type ParsedMixedEntry =
  | { kind: "revenue"; amount: number; description: string }
  | ({ kind: "expense" } & ParsedExpenseEntry);

const MONTH_ALIASES = [
  { index: 1, names: ["janeiro", "jan"] },
  { index: 2, names: ["fevereiro", "fev"] },
  { index: 3, names: ["marco", "março", "mar"] },
  { index: 4, names: ["abril", "abr"] },
  { index: 5, names: ["maio", "mai"] },
  { index: 6, names: ["junho", "jun"] },
  { index: 7, names: ["julho", "jul"] },
  { index: 8, names: ["agosto", "ago"] },
  { index: 9, names: ["setembro", "set"] },
  { index: 10, names: ["outubro", "out"] },
  { index: 11, names: ["novembro", "nov"] },
  { index: 12, names: ["dezembro", "dez"] },
] as const;

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

const FUTURE_MONTH_PROJECTION_WORDS = [
  "quanto vou ficar",
  "quanto vou ter",
  "quanto terei",
  "quanto vai ficar",
  "qual sera meu saldo",
  "saldo no mes",
  "saldo em",
  "saldo para",
  "vou ficar no mes",
  "vou ter no mes",
  "projecao",
  "estimativa",
  "disponivel",
];

const PAYMENT_PROJECTION_WORDS = [
  "pagamento",
  "recebimento",
  "salario",
  "semana",
  "inicio",
  "comeco",
  "primeiro pagamento",
  "segundo pagamento",
  "ultimo pagamento",
  "próximo salário",
  "proximo salario",
];

const SPENDING_UNTIL_NEXT_MONTH_WORDS = [
  "quanto posso gastar ate",
  "quanto da para gastar ate",
  "quanto ainda posso gastar ate",
  "posso gastar ate o proximo mes",
  "gastar ate o proximo mes",
];

const LIMIT_WORDS = ["limite", "orcamento", "teto"];

const SAVINGS_GOAL_WORDS = [
  "juntar dinheiro",
  "juntar grana",
  "quero juntar",
  "pretendo juntar",
  "guardar dinheiro",
  "guardar grana",
  "quero guardar",
  "pretendo guardar",
  "economizar",
  "poupar",
  "reservar dinheiro",
  "meta de economia",
  "meta para juntar",
];

const GOAL_WORDS = [
  "meta",
  "metas",
  "cofrinho",
  "cofrinhos",
  "juntar",
  "guardar",
  "economizar",
  "poupar",
  "reservar",
];

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

function answerSupportCommand() {
  return `Claro!!! 💙\n\nSe você está gostando do HeyFin e acredita na ideia do projeto, seu apoio pode fazer uma grande diferença.\n\nA contribuição é **totalmente voluntária**, mas cada ajuda fortalece o projeto e me ajuda a continuar evoluindo, melhorando e trazendo novas funcionalidades para você.\n\nSe o HeyFin está sendo útil no seu dia a dia e você quiser fazer parte dessa evolução, vou ficar muito feliz com o seu apoio! 🚀\n\n**Pix para apoiar o HeyFin:**`;
}

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

const MONEY_PATTERN =
  /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:([,.])(\d{1,2}))?\s*(?:reais?|brl)?/gi;

function isIgnoredMoneyMatch(text: string, match: RegExpMatchArray) {
  const index = match.index ?? 0;
  const before = normalize(text.slice(Math.max(0, index - 24), index));
  const value = match[1];

  return (
    /\bdia\s*$/.test(before) ||
    (/^20\d{2}$/.test(value) && new RegExp(`\\b(${monthAliasPattern()})\\s+de\\s*$`).test(before))
  );
}

function parseMoneyValues(text: string) {
  const matches = text.matchAll(MONEY_PATTERN);

  return Array.from(matches)
    .filter((match) => !isIgnoredMoneyMatch(text, match))
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

  return (
    /[a-zA-ZÀ-ÿ]/.test(withoutAmount) && !questionWords.some((word) => normalized.startsWith(word))
  );
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactMessage(text: string) {
  return normalize(text)
    .replace(/[!?.,;:()[\]{}'"`´~^]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assistantCallNames(state: FinanceState) {
  return Array.from(
    new Set(
      ["chat", "fin", "heyfin", state.assistantName, normalize(state.assistantName)]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => b.length - a.length);
}

function stripAssistantAddress(text: string, state: FinanceState) {
  const names = assistantCallNames(state)
    .map((name) => escapeRegExp(name).replace(/\s+/g, "\\s+"))
    .join("|");

  if (!names) return text;

  const greetings = [
    "oi",
    "ola",
    "olá",
    "bom\\s+dia",
    "boa\\s+tarde",
    "boa\\s+noite",
    "opa",
    "fala",
    "salve",
  ].join("|");
  let clean = text.trim();

  clean = clean
    .replace(
      new RegExp(`^\\s*((?:(?:${greetings})\\b[\\s,!?.:;-]*)+)(?:${names})\\b[\\s,!?.:;-]*`, "iu"),
      "$1",
    )
    .replace(new RegExp(`^\\s*(?:${names})\\b[\\s,!?.:;-]*`, "iu"), "")
    .trim();

  const withoutLeadingGreeting = clean.replace(
    new RegExp(`^\\s*(?:${greetings})\\b[\\s,!?.:;-]+`, "iu"),
    "",
  );

  if (withoutLeadingGreeting.trim()) {
    clean = withoutLeadingGreeting.trim();
  }

  return clean || text;
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function financialActionRegex(words: string[]) {
  return new RegExp(
    `\\b(?:${words.map((word) => escapeRegExp(normalize(word))).join("|")})\\b`,
    "g",
  );
}

const REVENUE_ACTION_REGEX = financialActionRegex([
  ...EXTRA_REVENUE_WORDS,
  ...ADD_TO_BALANCE_WORDS,
]);
const EXPENSE_ACTION_REGEX = financialActionRegex(EXPENSE_WORDS);

function lastFinancialAction(text: string): "revenue" | "expense" | null {
  const normalized = normalize(text);
  let last: { kind: "revenue" | "expense"; index: number } | null = null;

  for (const match of normalized.matchAll(REVENUE_ACTION_REGEX)) {
    if (last == null || (match.index ?? 0) >= last.index) {
      last = { kind: "revenue", index: match.index ?? 0 };
    }
  }

  for (const match of normalized.matchAll(EXPENSE_ACTION_REGEX)) {
    if (last == null || (match.index ?? 0) >= last.index) {
      last = { kind: "expense", index: match.index ?? 0 };
    }
  }

  return last?.kind ?? null;
}

function prefixFromLastFinancialAction(text: string) {
  const normalized = normalize(text);
  let lastIndex = -1;

  for (const match of normalized.matchAll(REVENUE_ACTION_REGEX)) {
    lastIndex = Math.max(lastIndex, match.index ?? -1);
  }

  for (const match of normalized.matchAll(EXPENSE_ACTION_REGEX)) {
    lastIndex = Math.max(lastIndex, match.index ?? -1);
  }

  return lastIndex >= 0 ? text.slice(lastIndex) : text;
}

function trimBeforeNextFinancialAction(text: string) {
  const normalized = normalize(text);
  const indexes = [
    ...Array.from(normalized.matchAll(REVENUE_ACTION_REGEX), (match) => match.index ?? -1),
    ...Array.from(normalized.matchAll(EXPENSE_ACTION_REGEX), (match) => match.index ?? -1),
  ].filter((index) => index >= 0);
  const firstIndex = Math.min(...indexes);

  return Number.isFinite(firstIndex) ? text.slice(0, firstIndex) : text;
}

function monthKeyFromParts(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

function monthAliasPattern() {
  return MONTH_ALIASES.flatMap((month) => month.names)
    .sort((a, b) => b.length - a.length)
    .join("|");
}

function parseTargetMonth(text: string): {
  month: string;
  status: "current-or-future" | "past-explicit" | "ambiguous-past";
  label: string;
  explicitYear: boolean;
} | null {
  const normalized = normalize(text);
  const pattern = monthAliasPattern();
  const match = normalized.match(new RegExp(`\\b(${pattern})\\b(?:\\s+(?:de\\s+)?(20\\d{2}))?`));
  if (!match) return null;

  const alias = match[1];
  const monthIndex = MONTH_ALIASES.find((month) =>
    month.names.some((name) => normalize(name) === alias),
  )?.index;
  if (!monthIndex) return null;

  const todayMonth = monthKey(localISODate());
  const [currentYear] = todayMonth.split("-").map(Number);
  const explicitYear = Boolean(match[2]);
  const year = explicitYear ? Number(match[2]) : currentYear;
  const candidate = monthKeyFromParts(year, monthIndex);

  if (candidate >= todayMonth) {
    return {
      month: candidate,
      status: "current-or-future",
      label: monthLabel(candidate),
      explicitYear,
    };
  }

  if (explicitYear) {
    return {
      month: candidate,
      status: "past-explicit",
      label: monthLabel(candidate),
      explicitYear,
    };
  }

  const nextYearMonth = monthKeyFromParts(currentYear + 1, monthIndex);
  return {
    month: nextYearMonth,
    status: "ambiguous-past",
    label: monthLabel(nextYearMonth),
    explicitYear,
  };
}

function stripTargetMonthText(text: string) {
  const pattern = monthAliasPattern();
  return text
    .replace(
      new RegExp(
        `\\b(?:para|em|no|na|pro|pra|coloca(?:r)?\\s+para)?\\s*(?:${pattern})\\b(?:\\s+(?:de\\s+)?20\\d{2})?`,
        "gi",
      ),
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function isShortConversationalPhrase(text: string, phrases: string[], callNames: string[] = []) {
  const words = text.split(" ").filter(Boolean);
  const names = ["chat", "fin", "heyfin", ...callNames].map(normalize).filter(Boolean);
  return (
    words.length <= 4 &&
    phrases.some(
      (phrase) =>
        text === phrase ||
        names.some((name) => text === `${phrase} ${name}` || text === `${name} ${phrase}`),
    )
  );
}

function isClosingPhrase(text: string, state: FinanceState) {
  const names = assistantCallNames(state).map(normalize).filter(Boolean);
  if (isShortConversationalPhrase(text, CLOSING_PHRASES, names)) return true;

  const assistantPattern = names.map(escapeRegExp).join("|");
  const withoutAssistantName = text
    .replace(new RegExp(`\\b(${assistantPattern})\\b`, "g"), "")
    .replace(/\s+/g, " ")
    .trim();
  const words = withoutAssistantName.split(" ").filter(Boolean);

  return words.length <= 6 && includesAny(withoutAssistantName, CLOSING_PHRASES);
}

function isGreetingPhrase(text: string, state: FinanceState) {
  const names = assistantCallNames(state).map(normalize).filter(Boolean);
  if (isShortConversationalPhrase(text, GREETING_PHRASES, names)) return true;

  const assistantPattern = names.map(escapeRegExp).join("|");
  const withoutAssistantName = text
    .replace(new RegExp(`\\b(${assistantPattern})\\b`, "g"), "")
    .replace(/\s+/g, " ")
    .trim();
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

function answerSmallTalk(text: string, amount: number | null, state: FinanceState) {
  const compact = compactMessage(text);
  if (!compact || hasFinancialSignal(compact, amount)) return null;

  if (isGreetingPhrase(compact, state)) {
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

  if (isClosingPhrase(compact, state)) {
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
  const withoutAmount = stripTargetMonthText(text)
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:[,.]\d{1,2})?\s*(?:reais?|brl)?/i, "")
    .replace(
      /\b(eu|mas|gastei|gasto|paguei|comprei|compra|despesa|adiciona|adicione|adicionar|coloca|coloque|colocar|registre|registra|anote|anota|lance)\b/gi,
      "",
    )
    .replace(/\b(com|de|do|da|no|na|em|para)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return withoutAmount || `Gasto de ${formatBRL(amount)}`;
}

function cleanExpenseSegment(segment: string, amount: number) {
  const description = stripTargetMonthText(segment)
    .replace(
      /\b(eu|mas|gastei|gasto|paguei|comprei|compra|despesa|adiciona|adicione|adicionar|coloca|coloque|colocar|registre|registra|anote|anota|lance)\b/gi,
      "",
    )
    .replace(/^[\s,.;:–-]*(?:e\s+)?(?:com|de|do|da|no|na|em|para)\s+/i, "")
    .replace(/\s+(?:e|,|;|\.|com|de|do|da|no|na|em|para)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return description || `Gasto de ${formatBRL(amount)}`;
}

function parseMultipleExpenseEntries(text: string): ParsedExpenseEntry[] {
  const matches = Array.from(text.matchAll(MONEY_PATTERN)).filter(
    (match) => !isIgnoredMoneyMatch(text, match),
  );

  if (matches.length < 2) return [];

  return matches
    .map<ParsedExpenseEntry | null>((match, index) => {
      const amount = parseMoney(match[0]);
      if (!amount) return null;

      const currentEnd = (match.index ?? 0) + match[0].length;
      const nextStart = matches[index + 1]?.index ?? text.length;
      const previousEnd =
        index === 0 ? 0 : (matches[index - 1].index ?? 0) + matches[index - 1][0].length;
      const afterAmount = text.slice(currentEnd, nextStart);
      const beforeAmount = index === 0 ? text.slice(previousEnd, match.index) : "";
      const segment = `${beforeAmount} ${afterAmount}`;
      const target = parseTargetMonth(segment) ?? parseTargetMonth(afterAmount);
      const description = cleanExpenseSegment(segment, amount);

      return {
        amount,
        description,
        category: inferCategory(description),
        month: target?.month,
        targetStatus: target?.status,
        monthLabel: target?.label,
      };
    })
    .filter((entry): entry is ParsedExpenseEntry => entry != null);
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

function cleanRevenueSegment(segment: string, amount: number) {
  const description = segment
    .replace(
      /\b(eu|ganhei|recebi|entrou|entrada|extra|bonus|bonificacao|comissao|freela|a mais|adicione|adicionar|adiciona|coloque|colocar|coloca|some|somar|soma|deposite|depositar|deposita|saldo|um|uma)\b/gi,
      "",
    )
    .replace(/^[\s,.;:–-]*(?:e\s+)?(?:de|do|da|no|na|em|com|para|ao)\s+/i, "")
    .replace(/\s+(?:e|,|;|\.|de|do|da|no|na|em|com|para|ao)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return description || `Receita extra de ${formatBRL(amount)}`;
}

function parseMultipleRevenueEntries(text: string): Array<{ amount: number; description: string }> {
  const matches = Array.from(text.matchAll(MONEY_PATTERN)).filter(
    (match) => !isIgnoredMoneyMatch(text, match),
  );

  if (matches.length < 2) return [];

  return matches
    .map((match, index) => {
      const amount = parseMoney(match[0]);
      if (!amount) return null;

      const currentEnd = (match.index ?? 0) + match[0].length;
      const nextStart = matches[index + 1]?.index ?? text.length;
      const previousEnd =
        index === 0 ? 0 : (matches[index - 1].index ?? 0) + matches[index - 1][0].length;
      const afterAmount = text.slice(currentEnd, nextStart);
      const beforeAmount = index === 0 ? text.slice(previousEnd, match.index) : "";
      const segment = `${beforeAmount} ${afterAmount}`;

      return {
        amount,
        description: cleanRevenueSegment(segment, amount),
      };
    })
    .filter((entry): entry is { amount: number; description: string } => entry != null);
}

function parseMixedFinancialEntries(text: string): ParsedMixedEntry[] {
  const normalized = normalize(text);
  if (
    !(
      includesAny(normalized, EXTRA_REVENUE_WORDS) || includesAny(normalized, ADD_TO_BALANCE_WORDS)
    ) ||
    !includesAny(normalized, EXPENSE_WORDS)
  ) {
    return [];
  }

  const matches = Array.from(text.matchAll(MONEY_PATTERN)).filter(
    (match) => !isIgnoredMoneyMatch(text, match),
  );

  if (matches.length < 2) return [];

  const entries: ParsedMixedEntry[] = [];
  let activeKind: "revenue" | "expense" | null = null;

  matches.forEach((match, index) => {
    const amount = parseMoney(match[0]);
    if (!amount) return;

    const matchStart = match.index ?? 0;
    const currentEnd = matchStart + match[0].length;
    const previousEnd =
      index === 0 ? 0 : (matches[index - 1].index ?? 0) + matches[index - 1][0].length;
    const nextStart = matches[index + 1]?.index ?? text.length;
    const localPrefix = text.slice(previousEnd, matchStart);
    const explicitPrefix = prefixFromLastFinancialAction(
      index === 0 ? text.slice(0, matchStart) : localPrefix,
    );
    const suffix = trimBeforeNextFinancialAction(text.slice(currentEnd, nextStart));
    const explicitKind = lastFinancialAction(explicitPrefix);
    const kind = explicitKind ?? activeKind;
    const segment = `${explicitKind ? explicitPrefix : ""} ${suffix}`;

    if (!kind) return;
    activeKind = kind;

    if (kind === "revenue") {
      entries.push({
        kind,
        amount,
        description: cleanRevenueSegment(segment, amount),
      });
      return;
    }

    const target = parseTargetMonth(segment) ?? parseTargetMonth(suffix);
    const description = cleanExpenseSegment(segment, amount);

    entries.push({
      kind,
      amount,
      description,
      category: inferCategory(description),
      month: target?.month,
      targetStatus: target?.status,
      monthLabel: target?.label,
    });
  });

  return entries;
}

function isAddToBalanceIntent(text: string) {
  return (
    includesAny(text, ADD_TO_BALANCE_WORDS) &&
    includesAny(text, ["saldo", "receita", "entrada", "ganho", "ganhos"]) &&
    !includesAny(text, EXPENSE_WORDS)
  );
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localISODate(date);
}

function expenseLine(expense: Expense) {
  if (expense.balanceAdjustment) {
    const difference = -expense.amount;
    return `Ajuste de saldo: ${difference >= 0 ? "+" : "-"} ${formatBRL(Math.abs(difference))} — ${expense.description}`;
  }

  if (expense.goalContribution) {
    return `Aporte para meta: ${formatBRL(expense.amount)} — ${expense.description}`;
  }

  return `${formatBRL(expense.amount)} em ${expense.category}: ${expense.description}`;
}

function readSequentialSpendingAlertKeys() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEQUENTIAL_SPENDING_ALERT_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberSequentialSpendingAlert(key: string) {
  if (typeof window === "undefined") return;

  const next = Array.from(new Set([...readSequentialSpendingAlertKeys(), key])).slice(-80);
  try {
    window.localStorage.setItem(SEQUENTIAL_SPENDING_ALERT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

function buildSequentialSpendingAlert(newExpenses: Expense[]) {
  const today = localISODate();
  const hasCurrentExpense = newExpenses.some(
    (expense) =>
      expense.amount > 0 &&
      !expense.adjustment &&
      !expense.goalContribution &&
      expense.date === today,
  );

  if (!hasCurrentExpense) return "";

  const now = new Date();
  const nowMs = now.getTime();
  const windowStartMs = nowMs - SEQUENTIAL_SPENDING_WINDOW_HOURS * 60 * 60 * 1000;
  const state = getFinanceState();
  const recentExpenses = state.expenses
    .filter((expense) => {
      if (
        expense.amount <= 0 ||
        expense.adjustment ||
        expense.goalContribution ||
        expense.date > today
      ) {
        return false;
      }
      const createdAtMs = new Date(expense.createdAt).getTime();
      return (
        Number.isFinite(createdAtMs) &&
        createdAtMs >= windowStartMs &&
        createdAtMs <= nowMs + 60_000
      );
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (recentExpenses.length < 2) return "";

  const recentTotal = recentExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const currentBalance = cashBalanceUntil(state, now).balance;
  const estimatedBalanceBeforeRecentExpenses = currentBalance + recentTotal;
  const recentShare =
    estimatedBalanceBeforeRecentExpenses > 0
      ? Math.round((recentTotal / estimatedBalanceBeforeRecentExpenses) * 100)
      : 0;
  const dynamicThreshold =
    estimatedBalanceBeforeRecentExpenses > 0
      ? Math.max(120, Math.min(300, estimatedBalanceBeforeRecentExpenses * 0.15))
      : 120;
  const shouldAlert =
    recentTotal >= 300 ||
    (recentTotal >= 80 &&
      estimatedBalanceBeforeRecentExpenses > 0 &&
      recentTotal >= dynamicThreshold);

  if (!shouldAlert) return "";

  const alertBucket = Math.floor(now.getHours() / SEQUENTIAL_SPENDING_WINDOW_HOURS);
  const alertKey = `${today}:${alertBucket}`;
  if (readSequentialSpendingAlertKeys().includes(alertKey)) return "";

  rememberSequentialSpendingAlert(alertKey);

  const percentageText =
    recentShare > 0
      ? ` Isso representa cerca de **${recentShare}%** do saldo que você tinha antes desses gastos recentes.`
      : "";
  const limitText =
    state.spendingLimit && recentTotal >= state.spendingLimit * 0.15
      ? ` Também é uma fatia relevante do seu limite de gastos do período.`
      : "";

  return `\n\n**Alerta de consumo rápido:** nas últimas ${SEQUENTIAL_SPENDING_WINDOW_HOURS} horas, você registrou **${formatBRL(recentTotal)}** em **${recentExpenses.length} gastos**.${percentageText}${limitText}\n\nVale dar uma respirada antes do próximo gasto para manter o orçamento sob controle.`;
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

function formatExpenseConfirmation(expense: Expense, month: string, isFuture = false) {
  const s = summarize(getFinanceState(), month);
  if (isFuture) {
    return `Pronto, deixei programada a despesa de **${formatBRL(expense.amount)}** em ${expense.category} para **${monthLabel(month)}**.\n\nEla ainda não foi debitada do seu saldo atual. Você pode acompanhar esse lançamento em **Lançamentos futuros**, no **Dashboard**. Quando essa competência chegar, ele passa a entrar no histórico e será considerado nos cálculos normalmente.`;
  }

  const limitText =
    s.spendingLimit == null
      ? ""
      : s.limitStatus === "exceeded"
        ? `\n\nAtenção: você passou do limite de gastos em **${formatBRL(Math.abs(s.limitRemaining ?? 0))}**.`
        : s.limitStatus === "warning"
          ? `\n\nAtenção: você já usou **${s.limitUsedPercent}%** do seu limite. Ainda restam **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}**.`
          : `\n\nVocê usou **${s.limitUsedPercent}%** do limite e ainda tem **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}** para gastar dentro do teto definido.`;

  return `Pronto, registrei a despesa de **${formatBRL(expense.amount)}** em ${expense.category} para **${monthLabel(month)}**.\n\nTotal gasto no período: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.${limitText}${buildSequentialSpendingAlert([expense])}`;
}

function formatRevenueConfirmation(revenue: Revenue, month: string) {
  const s = summarize(getFinanceState(), month);
  return `Receita extra registrada: **${formatBRL(revenue.amount)}**.\n\nEla foi somada ao seu saldo sem alterar a renda recorrente cadastrada. Extras em ${monthLabel(month)}: **${formatBRL(s.extraIncome)}**. Saldo disponível acumulado: **${formatBRL(s.balance)}**.${buildGoalContributionSuggestion(revenue.amount, month)}`;
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

function answerDailySummary() {
  const state = getFinanceState();
  const today = localISODate();
  const month = monthKey(today);
  const expenses = state.expenses.filter((expense) => expense.date === today);
  const revenues = state.revenues.filter((revenue) => revenue.date === today);
  const fixedExpenses = fixedExpenseOccurrencesForMonth(
    state.fixedExpenses,
    month,
    state.deletedFixedExpenseOccurrences,
    state.fixedExpenseOccurrenceOverrides,
  ).filter((expense) => expense.date === today);
  const automaticIncome = recurringIncomeOccurrencesForMonth(
    state.income,
    state.incomeOverrides,
    month,
  ).filter((income) => income.date === today);
  const spent = [...expenses, ...fixedExpenses].reduce((sum, expense) => sum + expense.amount, 0);
  const income = [...revenues, ...automaticIncome].reduce(
    (sum, revenue) => sum + revenue.amount,
    0,
  );
  const s = summarize(state, month);
  const balanceText = `Saldo disponível acumulado: **${formatBRL(s.balance)}**.`;

  if (!spent && !income) {
    return `Hoje ainda não encontrei movimentações registradas.\n\n${balanceText}`;
  }

  const entriesText = income > 0 ? `Entradas de hoje: **${formatBRL(income)}**.` : "";
  const expensesText = spent > 0 ? `Saídas de hoje: **${formatBRL(spent)}**.` : "";

  return [`Resumo de hoje:`, entriesText, expensesText, balanceText].filter(Boolean).join("\n\n");
}

function answerIdealDailySpend(month: string) {
  const s = summarize(getFinanceState(), month);
  const today = new Date();
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth =
    year && monthIndex
      ? new Date(year, monthIndex, 0).getDate()
      : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = month === currentMonthKey() ? today.getDate() : daysInMonth;
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);
  const balanceDailyReference = Math.max(0, s.balance) / remainingDays;
  const limitDailyReference =
    s.spendingLimit != null ? Math.max(0, s.limitRemaining ?? 0) / remainingDays : null;
  const ideal = Math.max(
    0,
    limitDailyReference != null
      ? Math.min(balanceDailyReference, limitDailyReference)
      : balanceDailyReference,
  );
  const limitText =
    limitDailyReference != null
      ? `\n\nTambém considerei seu limite de gastos: ainda restam **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}** dentro do teto.`
      : "\n\nComo você ainda não definiu um limite de gastos, usei seu saldo acumulado como referência.";

  return `Para manter o mês equilibrado, o ideal seria gastar até cerca de **${formatBRL(ideal)} hoje**.\n\nUsei como base seu saldo disponível de **${formatBRL(s.balance)}** e os **${remainingDays} dia${remainingDays === 1 ? "" : "s"}** restantes em ${monthLabel(month)}.${limitText}`;
}

function isMonthlyWeightQuestion(text: string) {
  return (
    /\b(o que|qual|quais)\b.*\b(pesou|mais pesou|mais gastei|maior gasto|maiores gastos)\b/.test(
      text,
    ) || /\b(categoria|categorias)\b.*\b(mais|maior|pesou|gastei)\b/.test(text)
  );
}

function answerMonthlyWeight(month: string) {
  const s = summarize(getFinanceState(), month);
  if (!s.byCategory.length || s.spent <= 0) {
    return `Ainda não há gastos suficientes em ${monthLabel(month)} para identificar o que mais pesou no mês.`;
  }

  const top = s.byCategory[0];
  const topPercent = Math.round((top.total / s.spent) * 100);
  const next = s.byCategory.slice(1, 3);
  const nextText = next.length
    ? `\n\nDepois aparecem ${next
        .map((item) => `**${item.category}** com ${formatBRL(item.total)}`)
        .join(" e ")}.`
    : "";

  return `O que mais pesou em ${monthLabel(month)} foi **${top.category}**: **${formatBRL(top.total)}**, cerca de **${topPercent}%** dos seus gastos do período.\n\nTotal gasto no mês: **${formatBRL(s.spent)}**.${nextText}\n\nSe quiser reduzir impacto, essa é a primeira categoria que vale acompanhar com mais atenção.`;
}

function isFutureReminderQuestion(text: string) {
  return (
    /\b(tenho|existe|ha|há|tem)\b.*\b(despesa|despesas|gasto|gastos|lancamento|lançamento)\b.*\b(futura|futuras|futuro|futuros|prevista|previstas|programada|programadas|lembrar)\b/.test(
      text,
    ) ||
    /\b(o que|quais)\b.*\b(vem por ai|vem por aí|esta previsto|está previsto|programado)\b/.test(
      text,
    )
  );
}

function assistantDateLabel(iso: string) {
  return localDateFromISO(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function answerFutureReminder(month: string) {
  const state = getFinanceState();
  const today = localISODate();
  const nextMonth = offsetMonthKey(month, 1);
  const futureUntil = monthEndISOForAssistant(nextMonth);
  const months = Array.from(new Set([month, nextMonth]));
  const futureExpenses = state.expenses
    .filter(
      (expense) =>
        !expense.balanceAdjustment &&
        !expense.goalContribution &&
        expense.date > today &&
        expense.date <= futureUntil,
    )
    .map((expense) => ({
      date: expense.date,
      description: expense.description,
      amount: expense.amount,
      source: "lançamento futuro",
    }));
  const fixedExpenses = months
    .flatMap((entryMonth) =>
      fixedExpenseOccurrencesForMonth(
        state.fixedExpenses,
        entryMonth,
        state.deletedFixedExpenseOccurrences,
        state.fixedExpenseOccurrenceOverrides,
      ),
    )
    .filter((expense) => expense.date > today && expense.date <= futureUntil)
    .map((expense) => ({
      date: expense.date,
      description: expense.description,
      amount: expense.amount,
      source: "despesa fixa",
    }));
  const entries = [...futureExpenses, ...fixedExpenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (!entries.length) {
    return "Não encontrei despesas futuras ou fixas próximas para lembrar agora.";
  }

  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const lines = entries.map(
    (entry) =>
      `- **${entry.description}**: ${formatBRL(entry.amount)} em ${assistantDateLabel(entry.date)} (${entry.source})`,
  );

  return `Você tem **${entries.length} despesa${entries.length === 1 ? "" : "s"} prevista${entries.length === 1 ? "" : "s"}** para lembrar:\n\n${lines.join("\n")}\n\nTotal previsto nessa lista: **${formatBRL(total)}**. Esses valores ajudam nas projeções, mas só entram no saldo quando a data correspondente chegar.`;
}

function isSpendingPaceQuestion(text: string) {
  return /\b(estou|to|tô)\b.*\b(gastando)\b.*\b(rapido|rápido|mais rapido|mais rápido|normal)\b/.test(
    text,
  );
}

function answerSpendingPace(month: string) {
  const state = getFinanceState();
  const s = summarize(state, month);
  const previousMonth = offsetMonthKey(month, -1);
  const previous = summarize(state, previousMonth);
  const today = new Date();
  const currentDay = month === currentMonthKey() ? today.getDate() : 0;

  if (month !== currentMonthKey() || currentDay < 7 || s.manualExpenseCount < 3) {
    return "Ainda preciso de mais alguns lançamentos neste mês para comparar seu ritmo de gastos com segurança.";
  }

  if (previous.spent <= 0 || previous.count < 3) {
    return `Seu gasto médio em ${monthLabel(month)} está em **${formatBRL(s.dailyAverage)} por dia**.\n\nAinda não há histórico suficiente no mês anterior para dizer com segurança se esse ritmo está acima do normal.`;
  }

  const previousMonthDays = new Date(
    Number(previousMonth.slice(0, 4)),
    Number(previousMonth.slice(5, 7)),
    0,
  ).getDate();
  const previousDailyAverage = previous.spent / previousMonthDays;
  const differencePercent =
    previousDailyAverage > 0
      ? Math.round(((s.dailyAverage - previousDailyAverage) / previousDailyAverage) * 100)
      : 0;

  if (differencePercent >= 15) {
    return `Sim, seu ritmo está mais acelerado.\n\nEm ${monthLabel(month)}, você está gastando em média **${formatBRL(s.dailyAverage)} por dia**. No mês anterior, a média foi **${formatBRL(previousDailyAverage)} por dia**.\n\nIsso representa cerca de **${differencePercent}% acima** do ritmo anterior. Vale acompanhar os próximos gastos para não perder margem no fim do mês.`;
  }

  if (differencePercent <= -15) {
    return `Seu ritmo está mais leve que no mês anterior.\n\nAgora você está gastando em média **${formatBRL(s.dailyAverage)} por dia**. No mês anterior, a média foi **${formatBRL(previousDailyAverage)} por dia**.\n\nIsso representa cerca de **${Math.abs(differencePercent)}% abaixo** do ritmo anterior.`;
  }

  return `Seu ritmo está parecido com o mês anterior.\n\nEm ${monthLabel(month)}, sua média está em **${formatBRL(s.dailyAverage)} por dia**. No mês anterior, foi **${formatBRL(previousDailyAverage)} por dia**.`;
}

function isBalanceAdjustmentRequest(text: string) {
  const hasBalanceTarget = /\bsaldo\b/.test(text);
  const hasAdjustmentVerb =
    /\b(ajuste|ajustar|ajusta|corrige|corrigir|corrija|sincroniza|sincronizar|atualiza|atualizar)\b/.test(
      text,
    );
  const hasCurrentBalanceStatement =
    /\b(meu\s+)?saldo\s+(atual\s+)?(e|esta|ta|ficou|deve ficar)\b/.test(text);
  const hasTargetPreposition = /\bsaldo\b.*\b(para|pra|em)\b/.test(text);

  return (
    hasBalanceTarget && (hasAdjustmentVerb || hasCurrentBalanceStatement || hasTargetPreposition)
  );
}

function requestBalanceAdjustment(text: string) {
  const normalized = normalize(text);
  const targetBalance = parseMoneyValues(text)[0] ?? null;
  if (!targetBalance || !isBalanceAdjustmentRequest(normalized)) return null;

  const month = currentMonthKey();
  const currentBalance = summarize(getFinanceState(), month).balance;
  const difference = Math.round((targetBalance - currentBalance) * 100) / 100;

  if (Math.abs(difference) < 0.01) {
    return `Seu saldo já está em **${formatBRL(targetBalance)}**. Não preciso criar nenhum ajuste.`;
  }

  financeActions.setPendingAction({
    type: "balanceAdjustment",
    targetBalance,
    currentBalance,
    difference,
    month,
    createdAt: new Date().toISOString(),
  });

  const actionText =
    difference > 0
      ? `criar um ajuste de entrada de **${formatBRL(difference)}**`
      : `criar um ajuste de saída de **${formatBRL(Math.abs(difference))}**`;

  return `Entendi. Seu saldo registrado hoje está em **${formatBRL(currentBalance)}** e você quer ajustar para **${formatBRL(targetBalance)}**.\n\nPara sincronizar, vou ${actionText} como **Ajuste de saldo** em **Últimos lançamentos**. Esse registro é uma correção manual, não uma despesa ou receita comum.\n\nDeseja confirmar esse ajuste? Responda **sim** para confirmar ou **não** para cancelar.`;
}

function registerRevenue(text: string, amount: number, month: string) {
  const revenue = financeActions.addRevenue({
    amount,
    description: cleanRevenueDescription(text, amount),
    date: month === monthKey(localISODate()) ? null : `${month}-01`,
  });

  return formatRevenueConfirmation(revenue, month);
}

function registerMultipleRevenues(text: string, month: string) {
  const entries = parseMultipleRevenueEntries(text);
  if (entries.length < 2) return null;

  const revenues = entries.map((entry) =>
    financeActions.addRevenue({
      amount: entry.amount,
      description: entry.description,
      date: month === monthKey(localISODate()) ? null : `${month}-01`,
    }),
  );
  const total = revenues.reduce((sum, revenue) => sum + revenue.amount, 0);
  const s = summarize(getFinanceState(), month);

  return [
    `Pronto, registrei **${revenues.length} receitas extras** no total de **${formatBRL(total)}**:`,
    "",
    ...revenues.map((revenue) => `- ${formatBRL(revenue.amount)}: ${revenue.description}`),
    "",
    `Extras em ${monthLabel(month)}: **${formatBRL(s.extraIncome)}**. Saldo disponível acumulado: **${formatBRL(s.balance)}**.`,
    "",
    "Essas entradas foram somadas ao saldo sem alterar a renda recorrente cadastrada.",
    buildGoalContributionSuggestion(total, month).trim(),
  ].join("\n");
}

function registerMixedFinancialEntries(text: string, month: string) {
  const entries = parseMixedFinancialEntries(text);
  const hasRevenue = entries.some((entry) => entry.kind === "revenue");
  const hasExpense = entries.some((entry) => entry.kind === "expense");
  if (entries.length < 2 || !hasRevenue || !hasExpense) return null;
  const registeredExpenses: Expense[] = [];

  const expenseEntries = entries.filter(
    (entry): entry is Extract<ParsedMixedEntry, { kind: "expense" }> => entry.kind === "expense",
  );
  const pastExplicit = expenseEntries.find((entry) => entry.targetStatus === "past-explicit");
  if (pastExplicit) {
    return `Encontrei uma despesa para **${pastExplicit.monthLabel}**, mas essa competência já passou.\n\nPara manter o histórico consistente, cadastros pelo chat só podem ser feitos na competência atual ou em períodos futuros.`;
  }

  const ambiguous = expenseEntries.find((entry) => entry.targetStatus === "ambiguous-past");
  if (ambiguous) {
    return `Encontrei uma despesa para **${ambiguous.monthLabel}**, mas preciso que você confirme o ano com mais clareza antes de cadastrar a mensagem inteira.\n\nTente enviar novamente especificando o ano, por exemplo: \`R$ 20 para ${ambiguous.monthLabel}\`.`;
  }

  const movements = entries.map((entry) => {
    if (entry.kind === "revenue") {
      const revenue = financeActions.addRevenue({
        amount: entry.amount,
        description: entry.description,
        date: month === monthKey(localISODate()) ? null : `${month}-01`,
      });

      return {
        kind: entry.kind,
        amount: revenue.amount,
        date: revenue.date,
        line: `- Entrada: **+ ${formatBRL(revenue.amount)}** — ${revenue.description}`,
      };
    }

    const expense = registerExpenseForEntry(entry, month);
    registeredExpenses.push(expense);

    return {
      kind: entry.kind,
      amount: expense.amount,
      date: expense.date,
      line: `- Despesa: **- ${formatBRL(expense.amount)}** em ${expense.category} — ${expense.description}`,
    };
  });

  const totalRevenue = movements
    .filter((entry) => entry.kind === "revenue")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = movements
    .filter((entry) => entry.kind === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const futureExpense = movements.some(
    (entry) => entry.kind === "expense" && monthKey(entry.date) > monthKey(localISODate()),
  );
  const s = summarize(getFinanceState(), month);
  const sequentialAlert = buildSequentialSpendingAlert(registeredExpenses);

  return [
    `Pronto, registrei **${movements.length} movimentações** separando entradas e saídas:`,
    "",
    ...movements.map((entry) => entry.line),
    "",
    `Entradas: **${formatBRL(totalRevenue)}**. Despesas: **${formatBRL(totalExpense)}**.`,
    futureExpense
      ? "As despesas futuras ficaram em **Lançamentos futuros** no Dashboard e ainda não foram debitadas do saldo atual."
      : `Saldo disponível acumulado: **${formatBRL(s.balance)}**.`,
    sequentialAlert,
    buildGoalContributionSuggestion(totalRevenue, month).trim(),
  ].join("\n");
}

function registerExpenseForEntry(entry: ParsedExpenseEntry, fallbackMonth: string) {
  const targetMonth = entry.month ?? fallbackMonth;
  const expense = financeActions.addExpense({
    amount: entry.amount,
    category: entry.category,
    description: entry.description,
    date: targetMonth === monthKey(localISODate()) ? null : `${targetMonth}-01`,
  });

  return expense;
}

function registerExpense(text: string, amount: number, month: string) {
  const target = parseTargetMonth(text);
  const description = cleanDescription(text, amount);
  const category = inferCategory(stripTargetMonthText(text));

  if (target?.status === "past-explicit") {
    return `Entendi a despesa de **${formatBRL(amount)}**, mas **${target.label}** já passou.\n\nPara manter o histórico financeiro consistente, só consigo cadastrar novas despesas na competência atual ou em períodos futuros.`;
  }

  if (target?.status === "ambiguous-past") {
    financeActions.setPendingAction({
      type: "futureExpense",
      amount,
      description,
      category,
      month: target.month,
      createdAt: new Date().toISOString(),
    });

    return `Você está se referindo a **${target.label}**?\n\nComo esse mês já passou neste ano, preciso confirmar antes de registrar a despesa de **${formatBRL(amount)}** para essa competência futura. Responda **sim** para confirmar ou **não** para cancelar.`;
  }

  const targetMonth = target?.month ?? month;
  const expense = financeActions.addExpense({
    amount,
    category,
    description,
    date: targetMonth === monthKey(localISODate()) ? null : `${targetMonth}-01`,
  });

  return formatExpenseConfirmation(expense, targetMonth, targetMonth > monthKey(localISODate()));
}

function registerMultipleExpenses(text: string, month: string) {
  const entries = parseMultipleExpenseEntries(text);
  if (entries.length < 2) return null;

  const pastExplicit = entries.find((entry) => entry.targetStatus === "past-explicit");
  if (pastExplicit) {
    return `Encontrei uma despesa para **${pastExplicit.monthLabel}**, mas essa competência já passou.\n\nPara manter o histórico consistente, cadastros pelo chat só podem ser feitos na competência atual ou em períodos futuros.`;
  }

  const ambiguous = entries.find((entry) => entry.targetStatus === "ambiguous-past");
  if (ambiguous) {
    return `Encontrei um lançamento para **${ambiguous.monthLabel}**, mas preciso que você confirme o ano com mais clareza antes de cadastrar múltiplas despesas.\n\nTente enviar novamente especificando o ano, por exemplo: \`R$ 20 para ${ambiguous.monthLabel}\`.`;
  }

  const expenses = entries.map((entry) => registerExpenseForEntry(entry, month));
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const months = Array.from(new Set(expenses.map((expense) => monthKey(expense.date)))).sort();
  const summaryMonth = months.length === 1 ? months[0] : month;
  const s = summarize(getFinanceState(), summaryMonth);
  const hasFutureExpense = months.some((entryMonth) => entryMonth > monthKey(localISODate()));
  const sequentialAlert = buildSequentialSpendingAlert(expenses);
  const limitText =
    s.spendingLimit == null
      ? ""
      : s.limitStatus === "exceeded"
        ? `\n\nAtenção: você passou do limite de gastos em **${formatBRL(Math.abs(s.limitRemaining ?? 0))}**.`
        : s.limitStatus === "warning"
          ? `\n\nAtenção: você já usou **${s.limitUsedPercent}%** do seu limite. Ainda restam **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}**.`
          : `\n\nVocê usou **${s.limitUsedPercent}%** do limite e ainda tem **${formatBRL(Math.max(0, s.limitRemaining ?? 0))}** para gastar dentro do teto definido.`;

  return [
    `Pronto, registrei **${expenses.length} despesas** no total de **${formatBRL(total)}**:`,
    "",
    ...expenses.map(
      (expense) => `- ${expenseLine(expense)} (${monthLabel(monthKey(expense.date))})`,
    ),
    "",
    hasFutureExpense
      ? `Lançamentos futuros não foram descontados do saldo atual. Eles entram nas projeções e passam a impactar o saldo quando a competência correspondente chegar.`
      : `Total gasto no período: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.${limitText}`,
    sequentialAlert,
  ].join("\n");
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
  if (!pending) return null;

  if (pending.type === "futureExpense") {
    if (isDenial(text)) {
      financeActions.setPendingAction(null);
      return "Tudo certo, não registrei essa despesa futura.";
    }

    if (!isConfirmation(text)) return null;

    const expense = registerExpenseForEntry(
      {
        amount: pending.amount,
        description: pending.description,
        category: pending.category,
        month: pending.month,
      },
      month,
    );
    financeActions.setPendingAction(null);

    return formatExpenseConfirmation(
      expense,
      pending.month,
      pending.month > monthKey(localISODate()),
    );
  }

  if (pending.type === "balanceAdjustment") {
    if (isDenial(text)) {
      financeActions.setPendingAction(null);
      return "Tudo certo, não fiz nenhum ajuste no saldo.";
    }

    if (!isConfirmation(text)) return null;

    financeActions.addBalanceAdjustment(pending.difference);
    financeActions.setPendingAction(null);
    const s = summarize(getFinanceState(), pending.month);
    const actionText =
      pending.difference > 0
        ? `somei **${formatBRL(pending.difference)}**`
        : `reduzi **${formatBRL(Math.abs(pending.difference))}**`;

    return `Pronto, criei o lançamento **Ajuste de saldo** e ${actionText} para sincronizar seu saldo.\n\nEle aparece em **Últimos lançamentos** como uma correção manual, sem entrar como gasto do mês ou receita extra.\n\nSaldo disponível atualizado: **${formatBRL(s.balance)}**.`;
  }

  if (pending.type === "goalContribution") {
    if (!getFinanceState().goalsEnabled) {
      financeActions.setPendingAction(null);
      return "O Cofrinho está desativado em Ajustes, então não registrei nenhum aporte. Você pode ativar as Metas financeiras quando quiser usar esse recurso.";
    }

    if (isDenial(text)) {
      financeActions.setPendingAction(null);
      return "Tudo certo, deixei o dinheiro disponível no saldo por enquanto.";
    }

    if (!isConfirmation(text)) return null;

    const goal = getFinanceState().goals.find((item) => item.id === pending.goalId);
    if (!goal) {
      financeActions.setPendingAction(null);
      return "Essa meta não está mais disponível. Não registrei nenhum aporte.";
    }

    const contribution = financeActions.addGoalContribution({
      goalId: goal.id,
      amount: pending.amount,
      description: `Aporte para ${goal.name}`,
    });
    financeActions.setPendingAction(null);

    if (!contribution) {
      return "Não consegui registrar esse aporte agora. Confira suas metas no Dashboard e tente novamente.";
    }

    const progress = goalProgress(getFinanceState(), goal);
    const s = summarize(getFinanceState(), pending.month);

    return `Pronto, separei **${formatBRL(contribution.amount)}** para a meta **${goal.name}**.\n\nProgresso atual: **${progress.percent}%** (${formatBRL(progress.saved)} de ${formatBRL(progress.targetAmount)}). Ainda faltam **${formatBRL(progress.remaining)}**.\n\nSaldo disponível acumulado: **${formatBRL(s.balance)}**.`;
  }

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
  financeActions.setPendingAction(null);
  const s = summarize(getFinanceState(), pending.month);

  return `Pronto, excluí **${expenseLine(expense)}**.\n\nTotal de ${monthLabel(pending.month)} agora: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.`;
}

function answerEditHelp() {
  return "Sim. Para editar uma despesa, entre no **Dashboard**, vá até **Últimos lançamentos** e clique na despesa que quer ajustar. Vai abrir um modal onde você pode alterar descrição, valor e categoria, salvar as mudanças ou excluir o lançamento com confirmação.";
}

function isEditHelpRequest(text: string) {
  if (includesAny(text, EDIT_HELP_WORDS)) return true;

  const asksHow = includesAny(text, ["como", "onde", "por onde", "de que forma"]);
  const editVerb =
    /\b(edito|editar|altero|alterar|mudo|mudar|corrijo|corrigir|ajusto|ajustar)\b/.test(text);
  const expenseTarget = /\b(despesa|despesas|gasto|gastos|lancamento|lancamentos)\b/.test(text);

  return asksHow && editVerb && expenseTarget;
}

function isSavingsGoalRequest(text: string) {
  if (includesAny(text, SAVINGS_GOAL_WORDS)) return true;

  const savingsVerb = /\b(juntar|guardar|economizar|poupar|reservar)\b/.test(text);
  const financialTarget = /\b(dinheiro|grana|valor|reais|real|r\$|saldo|mes|meta)\b/.test(text);

  return savingsVerb && financialTarget;
}

function answerSavingsGoalHelp() {
  if (!getFinanceState().goalsEnabled) {
    return "O recurso de **Metas financeiras** está desativado no momento.\n\nSe quiser usar o Cofrinho para criar objetivos, acompanhar progresso e registrar aportes, ative essa opção em **Ajustes > Cofrinho**.";
  }

  return "Sim. Agora você pode usar **Metas financeiras** no Dashboard para criar cofrinhos, acompanhar progresso e registrar aportes.\n\nPelo chat, também consigo ajudar com comandos como `Quero juntar R$ 1.000 para viagem`, `Adicionar R$ 100 para minha meta viagem` ou `Quais metas eu tenho?`.";
}

function normalizedGoalName(goal: Pick<FinancialGoal, "name">) {
  return normalize(goal.name).replace(/\s+/g, " ").trim();
}

function findGoalMention(text: string, goals: FinancialGoal[]) {
  const normalized = normalize(text);
  const orderedGoals = goals.slice().sort((a, b) => b.name.length - a.name.length);
  return (
    orderedGoals.find((goal) => {
      const name = normalizedGoalName(goal);
      return name.length >= 2 && normalized.includes(name);
    }) ?? null
  );
}

function extractGoalName(text: string, amount: number) {
  const normalizedAmount = formatBRL(amount)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(".", "\\.")
    .replace(",", "[,.]");
  const cleaned = text
    .replace(new RegExp(`(?:r\\$\\s*)?${normalizedAmount}\\s*(?:reais?|brl)?`, "i"), " ")
    .replace(
      /\b(quero|pretendo|preciso|vou|para|pra|pro|minha|meu|meta|cofrinho|de|uma|um)\b/gi,
      " ",
    )
    .replace(
      /\b(juntar|guardar|economizar|poupar|reservar|adicionar|adiciona|colocar|coloca)\b/gi,
      " ",
    )
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const afterPara = text.match(
    /\b(?:para|pra|pro)\s+(?:minha\s+meta\s+|meu\s+cofrinho\s+)?(.+)$/i,
  )?.[1];
  const candidate = (afterPara || cleaned)
    .replace(/(?:r\$\s*)?\d+(?:[,.]\d{1,2})?\s*(?:reais?|brl)?/gi, " ")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return candidate.slice(0, 80) || "Meta financeira";
}

function isGoalListRequest(text: string) {
  return (
    includesAny(text, ["quais metas", "listar metas", "minhas metas", "metas que tenho"]) ||
    /\b(quais|listar|liste|mostrar|mostre|ver)\b.*\b(metas|cofrinhos)\b/.test(text)
  );
}

function isGoalQuery(text: string) {
  const hasGoalMention = Boolean(findGoalMention(text, getFinanceState().goals));
  return (
    /\b(quanto falta|quanto ja guardei|quanto já guardei|progresso)\b/.test(text) &&
    (includesAny(text, GOAL_WORDS) || hasGoalMention)
  );
}

function isGoalMonthlyPlanQuery(text: string) {
  return /\bquanto\b.*\b(guardar|juntar|economizar|poupar)\b.*\bpor mes\b/.test(text);
}

function answerGoalsList() {
  const goals = goalsWithProgress(getFinanceState());
  if (!goals.length) {
    return "Você ainda não tem metas financeiras cadastradas.\n\nPara começar, vá ao **Dashboard** e crie uma meta, ou me diga algo como `Quero juntar R$ 1.000 para viagem`.";
  }

  return [
    `Você tem **${goals.length} meta${goals.length === 1 ? "" : "s"} financeira${goals.length === 1 ? "" : "s"}**:`,
    "",
    ...goals.map(
      (goal) =>
        `- **${goal.name}**: ${goal.percent}% concluída, ${formatBRL(goal.saved)} guardados de ${formatBRL(goal.targetAmount)}. Faltam ${formatBRL(goal.remaining)}.`,
    ),
  ].join("\n");
}

function answerGoalProgressQuery(text: string) {
  const goals = getFinanceState().goals;
  if (!goals.length) return answerGoalsList();

  const goal = findGoalMention(text, goals) ?? (goals.length === 1 ? goals[0] : null);
  if (!goal) {
    return "Qual meta você quer consultar? Me diga o nome, por exemplo: `Quanto falta para minha viagem?`.";
  }

  const progress = goalProgress(getFinanceState(), goal);

  return `Sua meta **${progress.name}** está em **${progress.percent}%**.\n\nVocê já guardou **${formatBRL(progress.saved)}** de **${formatBRL(progress.targetAmount)}**. Ainda faltam **${formatBRL(progress.remaining)}** para concluir.`;
}

function answerGoalMonthlyPlan(text: string) {
  const state = getFinanceState();
  const goals = state.goals;
  if (!goals.length) return answerGoalsList();

  const goal = findGoalMention(text, goals) ?? (goals.length === 1 ? goals[0] : null);
  if (!goal) {
    return "Consigo calcular isso. Qual meta você quer planejar?";
  }

  const target = parseTargetMonth(text);
  if (!target || target.status !== "current-or-future") {
    return "Consigo calcular quanto guardar por mês, sim. Me diga até qual mês, por exemplo: `Quanto preciso guardar por mês para minha viagem até dezembro?`.";
  }

  const progress = goalProgress(state, goal);
  const current = monthKey(localISODate());
  const [currentYear, currentMonth] = current.split("-").map(Number);
  const [targetYear, targetMonth] = target.month.split("-").map(Number);
  const monthsLeft = Math.max(1, (targetYear - currentYear) * 12 + targetMonth - currentMonth + 1);
  const monthly = progress.remaining / monthsLeft;

  return `Para alcançar **${progress.name}** até **${monthLabel(target.month)}**, você precisaria guardar cerca de **${formatBRL(monthly)} por mês**.\n\nBase do cálculo: faltam **${formatBRL(progress.remaining)}** divididos em **${monthsLeft} mês${monthsLeft === 1 ? "" : "es"}**.`;
}

function createGoalFromChat(text: string, amount: number) {
  const name = extractGoalName(text, amount);
  const goal = financeActions.addGoal({ name, targetAmount: amount });

  return `Meta criada: **${goal.name}** com objetivo de **${formatBRL(goal.targetAmount)}**.\n\nEla já aparece em **Metas financeiras**, no Dashboard. Quando quiser separar dinheiro para ela, você pode usar **Aportar** no Dashboard ou me dizer algo como \`Adicionar R$ 100 para minha meta ${goal.name}\`.`;
}

function addGoalContributionFromChat(text: string, amount: number, month: string) {
  const state = getFinanceState();
  const goals = state.goals;
  if (!goals.length) {
    return "Você ainda não tem metas cadastradas.\n\nCrie uma em **Metas financeiras**, no Dashboard, ou me diga algo como `Quero juntar R$ 1.000 para viagem`.";
  }

  const goal = findGoalMention(text, goals) ?? (goals.length === 1 ? goals[0] : null);
  if (!goal) {
    return `Para qual meta você quer enviar esse aporte de **${formatBRL(amount)}**?\n\n${goals.map((item) => `- ${item.name}`).join("\n")}`;
  }

  const currentBalance = summarize(state, month).balance;
  if (amount > currentBalance) {
    return `Esse aporte é maior que seu saldo disponível atual (**${formatBRL(currentBalance)}**).\n\nPara manter o controle seguro, não registrei a movimentação. Você pode escolher um valor menor ou ajustar o saldo antes.`;
  }

  const contribution = financeActions.addGoalContribution({
    goalId: goal.id,
    amount,
    description: `Aporte para ${goal.name}`,
  });
  if (!contribution)
    return "Não consegui registrar esse aporte agora. Confira a meta no Dashboard.";

  const progress = goalProgress(getFinanceState(), goal);
  const s = summarize(getFinanceState(), month);

  return `Aporte registrado: **${formatBRL(amount)}** para **${goal.name}**.\n\nProgresso da meta: **${progress.percent}%** (${formatBRL(progress.saved)} de ${formatBRL(progress.targetAmount)}). Ainda faltam **${formatBRL(progress.remaining)}**.\n\nEsse aporte apareceu em **Últimos lançamentos** com o badge **Meta**. Saldo disponível acumulado: **${formatBRL(s.balance)}**.`;
}

function answerGoalCommand(text: string, amount: number | null, month: string) {
  const normalized = normalize(text);
  if (!getFinanceState().goalsEnabled) {
    return includesAny(normalized, GOAL_WORDS) || isGoalListRequest(normalized)
      ? answerSavingsGoalHelp()
      : null;
  }

  if (isGoalListRequest(normalized)) return answerGoalsList();
  if (isGoalMonthlyPlanQuery(normalized)) return answerGoalMonthlyPlan(text);
  if (isGoalQuery(normalized)) return answerGoalProgressQuery(text);

  if (!amount || !includesAny(normalized, GOAL_WORDS)) return null;

  const hasContributionVerb =
    /\b(adicionar|adiciona|colocar|coloca|botar|bota|aporte|aportar)\b/.test(normalized);
  const hasCreationSignal =
    (/\b(quero|pretendo|preciso|meta para|meta de)\b/.test(normalized) ||
      /^(juntar|guardar|economizar|poupar)\b/.test(normalized)) &&
    /\b(juntar|guardar|economizar|poupar)\b/.test(normalized);
  const hasGoalMention = Boolean(findGoalMention(text, getFinanceState().goals));

  if (hasContributionVerb || hasGoalMention || normalized.includes("cofrinho")) {
    return addGoalContributionFromChat(text, amount, month);
  }

  if (hasCreationSignal) {
    return createGoalFromChat(text, amount);
  }

  return null;
}

function buildGoalContributionSuggestion(revenueAmount: number, month: string) {
  const state = getFinanceState();
  if (!state.goalsEnabled) return "";
  if (revenueAmount < 50) return "";

  const suggestedAmount = Math.max(10, Math.round(revenueAmount * 0.1 * 100) / 100);
  if (suggestedAmount <= 0) return "";

  const openGoals = goalsWithProgress(state).filter((goal) => goal.remaining > 0);
  const candidate = pickGoalForContributionSuggestion(openGoals, suggestedAmount);
  if (!candidate) return "";

  const finalSuggestedAmount = Math.min(candidate.remaining, suggestedAmount);
  if (finalSuggestedAmount <= 0) return "";

  financeActions.setPendingAction({
    type: "goalContribution",
    goalId: candidate.id,
    amount: finalSuggestedAmount,
    month,
    createdAt: new Date().toISOString(),
  });

  return `\n\nVocê acabou de receber **${formatBRL(revenueAmount)}**. Que tal separar **${formatBRL(finalSuggestedAmount)}** para sua meta **${candidate.name}**? Responda **sim** para confirmar ou **não** para deixar para depois.`;
}

function pickGoalForContributionSuggestion(
  goals: ReturnType<typeof goalsWithProgress>,
  amount: number,
) {
  return goals.slice().sort((a, b) => {
    const aCompletes = a.remaining <= amount;
    const bCompletes = b.remaining <= amount;

    if (aCompletes !== bCompletes) return aCompletes ? -1 : 1;
    if (aCompletes && bCompletes && a.remaining !== b.remaining) {
      return a.remaining - b.remaining;
    }
    if (a.percent !== b.percent) return b.percent - a.percent;
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return b.createdAt.localeCompare(a.createdAt);
  })[0];
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
    .fixedExpenses.filter((expense) => !expense.canceledAt)
    .slice()
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
      const status =
        month >= expense.startsAtMonth ? "" : `, começa em ${monthLabel(expense.startsAtMonth)}`;
      return `- **${expense.description}**: ${formatBRL(expense.amount)}, vencimento dia ${String(expense.payday).padStart(2, "0")}${status}`;
    }),
    "\nPara editar ou excluir alguma delas, acesse o **Dashboard**, na seção **Despesas fixas**.",
  ].join("\n");
}

function parsePaymentOrdinal(text: string): number | "last" | null {
  if (/\b(ultimo|ultima|último|última)\b/.test(text)) return "last";
  if (/\b(primeiro|primeira|1o|1º|1)\b/.test(text)) return 1;
  if (/\b(segundo|segunda|2o|2º|2)\b/.test(text)) return 2;
  if (/\b(terceiro|terceira|3o|3º|3)\b/.test(text)) return 3;
  if (/\b(quarto|quarta|4o|4º|4)\b/.test(text)) return 4;
  if (/\b(quinto|quinta|5o|5º|5)\b/.test(text)) return 5;
  return null;
}

function isStartOfMonthPaymentReference(text: string) {
  return /\b(inicio|comeco|começo|inicial)\b/.test(text);
}

function isWeeklyPaymentReference(text: string) {
  return /\bsemana\b/.test(text);
}

function hasPaymentMomentReference(text: string) {
  return (
    includesAny(text, PAYMENT_PROJECTION_WORDS) || /\bdia\s+(0?[1-9]|[12]\d|3[01])\b/.test(text)
  );
}

function paymentProjectionIntent(text: string, recentText: string) {
  const directReference = hasPaymentMomentReference(text);
  const contextualReference =
    hasPaymentMomentReference(recentText) &&
    includesAny(text, [
      "primeiro",
      "segundo",
      "terceiro",
      "quarto",
      "quinto",
      "ultimo",
      "último",
      "semana",
      "inicio",
      "comeco",
    ]);

  return directReference || contextualReference;
}

function paymentDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function paymentOptionsText(payments: ReturnType<typeof recurringIncomeOccurrencesForMonth>) {
  return payments
    .map((payment, index) => {
      const isWeekly = payment.label.toLowerCase().includes("semanal");
      const label = isWeekly
        ? index === payments.length - 1
          ? "última semana"
          : `${index + 1}ª semana`
        : index === payments.length - 1
          ? "último"
          : `${index + 1}º`;
      return `${label}: ${paymentDateLabel(payment.date)} (${formatBRL(payment.amount)})`;
    })
    .join("; ");
}

function weeklyPaymentClarification(
  month: string,
  payments: ReturnType<typeof recurringIncomeOccurrencesForMonth>,
) {
  return `Você quer considerar o pagamento de qual semana de **${monthLabel(month)}**?\n\nOpções: ${paymentOptionsText(payments)}.`;
}

function answerProjectionUntilPaymentDate(
  payment: ReturnType<typeof recurringIncomeOccurrencesForMonth>[number],
) {
  const forecast = forecastUntilDate(getFinanceState(), payment.date);
  const incomeText =
    forecast.projectedIncome > 0
      ? `${formatBRL(forecast.projectedIncome)} em receitas previstas`
      : "nenhuma receita prevista";
  const expenseText =
    forecast.projectedExpenses > 0
      ? `${formatBRL(forecast.projectedExpenses)} em despesas previstas`
      : "nenhuma despesa prevista";
  const details: string[] = [];

  if (forecast.recurringIncome > 0) {
    details.push(`renda automática até essa data: **${formatBRL(forecast.recurringIncome)}**`);
  }
  if (forecast.extraIncome > 0) {
    details.push(`receitas extras já registradas: **${formatBRL(forecast.extraIncome)}**`);
  }
  if (forecast.manualExpenses > 0) {
    details.push(`lançamentos futuros: **${formatBRL(forecast.manualExpenses)}**`);
  }
  if (forecast.fixedExpenses > 0) {
    details.push(`despesas fixas: **${formatBRL(forecast.fixedExpenses)}**`);
  }
  if (forecast.goalContributions > 0) {
    details.push(`aportes para metas: **${formatBRL(forecast.goalContributions)}**`);
  }

  const detailsText = details.length ? `\n\nDetalhes considerados: ${details.join("; ")}.` : "";

  return `Projetando até **${paymentDateLabel(payment.date)}**, após o recebimento de **${formatBRL(payment.amount)}**, a estimativa é você ficar com **${formatBRL(forecast.projectedBalance)}**.\n\nComo cheguei nesse valor:\n- Saldo acumulado atual: **${formatBRL(forecast.currentBalance)}**\n- Entradas previstas até essa data: **${incomeText}**\n- Saídas previstas até essa data: **${expenseText}**\n\nCálculo: ${formatBRL(forecast.currentBalance)} + ${formatBRL(forecast.projectedIncome)} - ${formatBRL(forecast.projectedExpenses)} = **${formatBRL(forecast.projectedBalance)}**.${detailsText}\n\nEssa é uma projeção: novos gastos, receitas ou ajustes podem mudar esse valor.`;
}

function findNextPaymentByDay(day: number) {
  const state = getFinanceState();
  const today = localISODate();

  return (
    Array.from({ length: 12 }, (_, offset) => offsetMonthKey(monthKey(today), offset))
      .flatMap((paymentMonth) =>
        recurringIncomeOccurrencesForMonth(state.income, state.incomeOverrides, paymentMonth),
      )
      .filter((payment) => payment.date > today && Number(payment.date.slice(8, 10)) === day)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

function answerPaymentProjection(text: string, recentText: string) {
  const normalized = normalize(text);
  if (!paymentProjectionIntent(normalized, recentText)) return null;

  const state = getFinanceState();
  if (!state.income || !isIncomeAutoDepositEnabled(state.income)) {
    return "Ainda não encontrei uma renda automática ativa. Configure sua renda em **Ajustes** para eu projetar saldos por pagamento.";
  }

  const day = parsePaydays(text)[0] ?? null;
  const target = parseTargetMonth(text) ?? parseTargetMonth(recentText);
  const startOfMonthPayment = isStartOfMonthPaymentReference(normalized);
  const weeklyReference = isWeeklyPaymentReference(normalized);
  const ordinal = startOfMonthPayment ? 1 : parsePaymentOrdinal(normalized);

  if (day && !target) {
    const payment = findNextPaymentByDay(day);
    if (!payment) {
      return `Não encontrei um recebimento futuro no dia **${day}**. Confira as datas da sua renda em **Ajustes** ou me diga o mês desejado.`;
    }

    return answerProjectionUntilPaymentDate(payment);
  }

  if (!target) {
    if (normalized.includes("proximo") || normalized.includes("próximo")) return null;
    return "Consigo projetar por pagamento, sim. Me diga o mês ou a data, por exemplo: `Quanto vou ter no primeiro pagamento de setembro?`";
  }

  if (target.status === "past-explicit") {
    return `**${target.label}** já passou. Para projeções por pagamento, escolha a competência atual ou um mês futuro.`;
  }

  if (target.status === "ambiguous-past") {
    return `Você quer calcular um pagamento de **${target.label}**?\n\nComo esse mês já passou neste ano, me diga o ano desejado para eu projetar com segurança.`;
  }

  const payments = recurringIncomeOccurrencesForMonth(
    state.income,
    state.incomeOverrides,
    target.month,
  ).sort((a, b) => a.date.localeCompare(b.date));

  if (!payments.length) {
    return `Não encontrei recebimentos automáticos em **${monthLabel(target.month)}**. Confira a configuração da sua renda em **Ajustes**.`;
  }

  if (
    state.income.period === "weekly" &&
    payments.length > 1 &&
    !day &&
    !ordinal &&
    (weeklyReference || normalized.includes("pagamento") || normalized.includes("recebimento"))
  ) {
    return weeklyPaymentClarification(target.month, payments);
  }

  const payment = day
    ? payments.find((item) => Number(item.date.slice(8, 10)) === day)
    : ordinal === "last"
      ? payments[payments.length - 1]
      : typeof ordinal === "number"
        ? payments[ordinal - 1]
        : payments.length === 1
          ? payments[0]
          : null;

  if (!payment) {
    if (day) {
      return `Não encontrei um pagamento no dia **${day}** em **${monthLabel(target.month)}**. Recebimentos previstos: ${paymentOptionsText(payments)}.`;
    }

    if (typeof ordinal === "number") {
      return `Em **${monthLabel(target.month)}**, encontrei apenas **${payments.length}** recebimento${payments.length === 1 ? "" : "s"}. Recebimentos previstos: ${paymentOptionsText(payments)}.`;
    }

    return `Encontrei mais de um recebimento em **${monthLabel(target.month)}**. Qual deles você quer considerar? ${paymentOptionsText(payments)}.`;
  }

  if (payment.date <= localISODate()) {
    return `Esse pagamento de **${monthLabel(target.month)}** já passou. Para projeção por pagamento, escolha uma data futura.`;
  }

  return answerProjectionUntilPaymentDate(payment);
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

function isFutureMonthProjectionRequest(text: string) {
  return (
    includesAny(text, FUTURE_MONTH_PROJECTION_WORDS) &&
    (text.includes("quanto") ||
      text.includes("saldo") ||
      text.includes("projecao") ||
      text.includes("estimativa") ||
      text.includes("disponivel") ||
      text.includes("ficar") ||
      text.includes("ter"))
  );
}

function answerSpecificFutureMonthProjection(text: string) {
  const target = parseTargetMonth(text);
  if (!target || !isFutureMonthProjectionRequest(normalize(text))) return null;

  const currentMonth = monthKey(localISODate());

  if (target.status === "past-explicit") {
    return `**${target.label}** já passou. Posso consultar o histórico dessa competência, mas projeções são calculadas para o mês atual ou meses futuros.`;
  }

  if (target.status === "ambiguous-past") {
    return `Você quer uma projeção para **${target.label}**?\n\nComo esse mês já passou neste ano, me diga o ano desejado para eu calcular com segurança.`;
  }

  if (target.month < currentMonth) return null;

  const forecast = forecastFutureMonth(getFinanceState(), target.month);
  const incomeText =
    forecast.projectedIncome > 0
      ? `${formatBRL(forecast.projectedIncome)} em receitas previstas`
      : "nenhuma receita prevista";
  const expenseText =
    forecast.projectedExpenses > 0
      ? `${formatBRL(forecast.projectedExpenses)} em despesas previstas`
      : "nenhuma despesa prevista";
  const details: string[] = [];
  if (forecast.recurringIncome > 0) {
    details.push(`renda automática: **${formatBRL(forecast.recurringIncome)}**`);
  }
  if (forecast.extraIncome > 0) {
    details.push(`receitas extras já registradas: **${formatBRL(forecast.extraIncome)}**`);
  }
  if (forecast.manualExpenses > 0) {
    details.push(`lançamentos futuros: **${formatBRL(forecast.manualExpenses)}**`);
  }
  if (forecast.fixedExpenses > 0) {
    details.push(`despesas fixas: **${formatBRL(forecast.fixedExpenses)}**`);
  }
  if (forecast.goalContributions > 0) {
    details.push(`aportes para metas: **${formatBRL(forecast.goalContributions)}**`);
  }
  const detailsText = details.length ? `\n\nDetalhes considerados: ${details.join("; ")}.` : "";

  return `Projetando até o fim de **${monthLabel(forecast.targetMonth)}**, a estimativa é você ficar com **${formatBRL(forecast.projectedBalance)}**.\n\nComo cheguei nesse valor:\n- Saldo acumulado atual: **${formatBRL(forecast.currentBalance)}**\n- Entradas previstas até lá: **${incomeText}**\n- Saídas previstas até lá: **${expenseText}**\n\nCálculo: ${formatBRL(forecast.currentBalance)} + ${formatBRL(forecast.projectedIncome)} - ${formatBRL(forecast.projectedExpenses)} = **${formatBRL(forecast.projectedBalance)}**.${detailsText}\n\nEssa é uma projeção: novos gastos, receitas ou ajustes podem mudar esse valor.`;
}

function isoDateFromLocalDate(date: Date) {
  return localISODate(date);
}

function localDateFromISO(iso: string) {
  return new Date(`${iso}T12:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function monthStartISO(targetMonth: string) {
  return `${targetMonth}-01`;
}

function monthEndISOForAssistant(targetMonth: string) {
  const [year, monthIndex] = targetMonth.split("-").map(Number);
  return isoDateFromLocalDate(new Date(year, monthIndex, 0));
}

function parseMonthForSpendingQuery(text: string) {
  const normalized = normalize(text);
  const pattern = monthAliasPattern();
  const match = normalized.match(new RegExp(`\\b(${pattern})\\b(?:\\s+(?:de\\s+)?(20\\d{2}))?`));
  if (!match) return null;

  const alias = match[1];
  const monthIndex = MONTH_ALIASES.find((month) =>
    month.names.some((name) => normalize(name) === alias),
  )?.index;
  if (!monthIndex) return null;

  const todayMonth = monthKey(localISODate());
  const [currentYear] = todayMonth.split("-").map(Number);
  const year = match[2] ? Number(match[2]) : currentYear;
  const targetMonth = monthKeyFromParts(year, monthIndex);

  return {
    month: targetMonth,
    label: monthLabel(targetMonth),
    explicitYear: Boolean(match[2]),
  };
}

function isSpendingQuery(text: string) {
  if (includesAny(text, ["quanto posso gastar", "quanto da para gastar", "quanto ainda posso"])) {
    return false;
  }

  return (
    /\bquanto\b.*\b(gastei|gasto|gastos|despesas)\b/.test(text) ||
    /\b(total|valor)\b.*\b(gasto|gastos|despesas)\b/.test(text)
  );
}

function spendingPeriodFromText(text: string): {
  start: string;
  end: string;
  label: string;
  future?: boolean;
} | null {
  const normalized = normalize(text);
  const todayISO = localISODate();
  const today = localDateFromISO(todayISO);
  const currentMonth = monthKey(todayISO);

  if (/\b(ultimos|ultimas)\s+7\s+dias\b/.test(normalized)) {
    return {
      start: isoDateFromLocalDate(addDays(today, -6)),
      end: todayISO,
      label: "nos últimos 7 dias",
    };
  }

  if (includesAny(normalized, ["semana passada", "ultima semana", "última semana"])) {
    const currentWeekStart = startOfWeek(today);
    const previousWeekStart = addDays(currentWeekStart, -7);
    const previousWeekEnd = addDays(currentWeekStart, -1);
    return {
      start: isoDateFromLocalDate(previousWeekStart),
      end: isoDateFromLocalDate(previousWeekEnd),
      label: "na semana passada",
    };
  }

  if (includesAny(normalized, ["esta semana", "essa semana", "semana atual"])) {
    return {
      start: isoDateFromLocalDate(startOfWeek(today)),
      end: todayISO,
      label: "esta semana",
    };
  }

  if (includesAny(normalized, ["mes passado", "mês passado"])) {
    const previousMonth = offsetMonthKey(currentMonth, -1);
    return {
      start: monthStartISO(previousMonth),
      end: monthEndISOForAssistant(previousMonth),
      label: `em ${monthLabel(previousMonth)}`,
    };
  }

  const target = parseMonthForSpendingQuery(text);
  if (target) {
    const end = target.month === currentMonth ? todayISO : monthEndISOForAssistant(target.month);
    return {
      start: monthStartISO(target.month),
      end,
      label: `em ${target.label}`,
      future: target.month > currentMonth,
    };
  }

  if (includesAny(normalized, ["este mes", "esse mes", "mes atual", "este mês", "esse mês"])) {
    return {
      start: monthStartISO(currentMonth),
      end: todayISO,
      label: `em ${monthLabel(currentMonth)}`,
    };
  }

  return null;
}

function answerSpendingQuery(text: string) {
  const normalized = normalize(text);
  if (!isSpendingQuery(normalized)) return null;

  const period = spendingPeriodFromText(text);
  if (!period) return null;

  if (period.future) {
    return `Essa competência ainda não chegou, então não há gastos realizados para consultar ${period.label}.\n\nSe quiser, posso fazer uma **projeção** para esse mês considerando renda automática, despesas fixas e lançamentos futuros.`;
  }

  const state = getFinanceState();
  const expenses = state.expenses.filter(
    (expense) =>
      !expense.balanceAdjustment &&
      !expense.goalContribution &&
      expense.date >= period.start &&
      expense.date <= period.end,
  );
  const months = Array.from(new Set([monthKey(period.start), monthKey(period.end)]));
  const fixedExpenses = months
    .flatMap((entryMonth) =>
      fixedExpenseOccurrencesForMonth(
        state.fixedExpenses,
        entryMonth,
        state.deletedFixedExpenseOccurrences,
        state.fixedExpenseOccurrenceOverrides,
      ),
    )
    .filter((expense) => expense.date >= period.start && expense.date <= period.end);
  const manualTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const fixedTotal = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const total = manualTotal + fixedTotal;
  const count = expenses.length + fixedExpenses.length;
  const detail =
    fixedTotal > 0
      ? `\n\nDetalhes: ${formatBRL(manualTotal)} em lançamentos registrados e ${formatBRL(fixedTotal)} em despesas fixas debitadas.`
      : "";

  return `Você gastou **${formatBRL(total)}** ${period.label}.\n\nForam considerados **${count} lançamento${count === 1 ? "" : "s"}** já registrado${count === 1 ? "" : "s"} no histórico financeiro.${detail}`;
}

function answerSpendingUntilNextMonth(month: string) {
  const state = getFinanceState();
  const current = summarize(state, month);
  const forecast = forecastNextMonth(state, month);
  const ifSpendAllCurrentBalance =
    forecast.projectedAvailable - Math.max(0, forecast.projectedStartBalance);

  return `Você pode gastar até **${formatBRL(Math.max(0, current.balance))}** sem deixar seu saldo acumulado negativo.\n\nSe não gastar mais nada, a projeção para ${monthLabel(forecast.nextMonth)} fica em **${formatBRL(forecast.projectedAvailable)}**.\n\nSe gastar todo o saldo disponível, você começaria ${monthLabel(forecast.nextMonth)} com cerca de **${formatBRL(ifSpendAllCurrentBalance)}**, considerando a renda recorrente, receitas extras, despesas já registradas e despesas fixas previstas para o próximo mês.`;
}

function isImpactSimulationRequest(text: string) {
  const hasConditionalIntent = /\b(e\s+se|se\s+eu)\b/.test(text);
  const hasSimulationIntent = /\b(simula|simule|simular|simulacao)\b/.test(text);
  const hasDecisionIntent = /\b(posso|consigo|da para|vale a pena)\b/.test(text);
  const hasPurchaseIntent =
    /\b(comprar|compra|gastar|gastasse|gastaria|gasto|pagar|pagamento|adquirir|item|produto)\b/.test(
      text,
    );

  return hasPurchaseIntent && (hasConditionalIntent || hasSimulationIntent || hasDecisionIntent);
}

function simulateSpend(text: string, month: string) {
  const amount = parseMoney(text);
  if (!amount) return null;

  const s = summarize(getFinanceState(), month);
  const after = s.balance - amount;
  const balanceVerdict =
    after >= 0
      ? `Depois dessa compra, seu saldo ficaria em **${formatBRL(after)}**.`
      : `Essa compra deixaria seu saldo em **${formatBRL(after)}**, ou seja, abaixo de zero.`;

  if (!s.spendingLimit) {
    return `Simulei esse gasto sem registrar nada no histórico.\n\nValor da compra: **${formatBRL(amount)}**\nSaldo atual: **${formatBRL(s.balance)}**\nSaldo após a compra: **${formatBRL(after)}**\n\n${after >= 0 ? "Pelo saldo disponível, ela cabe no momento." : "Pelo saldo disponível, eu não recomendaria agora."}\n\nVocê ainda não definiu um limite de gastos. Se quiser uma análise mais precisa do orçamento do período, cadastre um limite em **Ajustes**.`;
  }

  const projectedSpent = s.spent + amount;
  const projectedLimitRemaining = s.spendingLimit - projectedSpent;
  const projectedLimitPercent = Math.round((projectedSpent / s.spendingLimit) * 100);
  const limitVerdict =
    projectedLimitRemaining < 0
      ? `Ela ultrapassaria seu limite de gastos em **${formatBRL(Math.abs(projectedLimitRemaining))}**.`
      : projectedLimitPercent >= 90
        ? `Ela ainda cabe no limite, mas deixaria você perto do teto: **${projectedLimitPercent}%** usado.`
        : `Ela cabe no seu limite. Depois da compra, ainda restariam **${formatBRL(projectedLimitRemaining)}** dentro do teto.`;

  const recommendation =
    after < 0
      ? "Eu evitaria essa compra agora, porque ela deixaria seu saldo negativo."
      : projectedLimitRemaining < 0
        ? "Eu teria cautela: seu saldo ainda pode comportar, mas o limite do período seria ultrapassado."
        : projectedLimitPercent >= 90
          ? "Dá para fazer, mas vale pensar com calma porque ela deixaria pouca margem no orçamento."
          : "A simulação parece confortável dentro do saldo e do limite atual.";

  return `Simulei esse gasto sem registrar nada no histórico.\n\nValor da compra: **${formatBRL(amount)}**\nSaldo atual: **${formatBRL(s.balance)}**\n${balanceVerdict}\n\nLimite do período: **${formatBRL(s.spendingLimit)}**\nGasto atual no período: **${formatBRL(s.spent)}**\nGasto projetado: **${formatBRL(projectedSpent)}** (${projectedLimitPercent}% do limite)\n\n${limitVerdict}\n\n${recommendation}`;
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
        `- ${expenseLine(expense)} (${new Date(`${expense.date}T12:00:00`).toLocaleDateString("pt-BR")})`,
    ),
  ].join("\n");
}

export function answerLocally(
  text: string,
  month: string,
  context?: ConversationContext,
): AssistantResult {
  const state = getFinanceState();
  text = stripAssistantAddress(normalizeSpokenMoneyText(text), state);
  const normalized = normalize(text);
  const recentText = normalize(recentConversationText(context));
  const standaloneAmount = parseStandaloneExpenseAmount(text);
  const amount = standaloneAmount ?? parseMoneyValues(text)[0] ?? null;
  const vagueBalanceFollowUp = isVagueFollowUpAboutBalance(normalized);
  const pendingResponse = answerPendingAction(text, month);

  if (text.trim() === SUPPORT_COMMAND) {
    return { text: answerSupportCommand() };
  }

  if (pendingResponse) {
    return { text: pendingResponse };
  }

  const smallTalkResponse = answerSmallTalk(text, amount, state);
  if (smallTalkResponse) {
    return { text: smallTalkResponse };
  }

  if (isEditHelpRequest(normalized)) {
    return { text: answerEditHelp() };
  }

  const goalCommand = answerGoalCommand(text, amount, month);
  if (goalCommand) {
    return { text: goalCommand };
  }

  if (isSavingsGoalRequest(normalized)) {
    return { text: answerSavingsGoalHelp() };
  }

  if (
    includesAny(normalized, [
      "resumo do dia",
      "resumo de hoje",
      "como foi meu dia",
      "como esta meu dia",
      "como está meu dia",
      "movimentacoes de hoje",
      "movimentações de hoje",
    ])
  ) {
    return { text: answerDailySummary() };
  }

  if (
    includesAny(normalized, [
      "ideal para gastar hoje",
      "quanto seria o ideal para gastar hoje",
      "quanto devo gastar hoje",
      "quanto posso gastar hoje",
      "quanto posso gastar por dia",
      "quanto ainda posso gastar por dia",
    ])
  ) {
    return { text: answerIdealDailySpend(month) };
  }

  if (isMonthlyWeightQuestion(normalized)) {
    return { text: answerMonthlyWeight(month) };
  }

  if (isFutureReminderQuestion(normalized)) {
    return { text: answerFutureReminder(month) };
  }

  if (isSpendingPaceQuestion(normalized)) {
    return { text: answerSpendingPace(month) };
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

  const balanceAdjustment = requestBalanceAdjustment(text);
  if (balanceAdjustment) {
    return { text: balanceAdjustment };
  }

  const spendingQuery = answerSpendingQuery(text);
  if (spendingQuery) {
    return { text: spendingQuery };
  }

  const paymentProjection = answerPaymentProjection(text, recentText);
  if (paymentProjection) {
    return { text: paymentProjection };
  }

  const futureMonthProjection = answerSpecificFutureMonthProjection(text);
  if (futureMonthProjection) {
    return { text: futureMonthProjection };
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

  if (
    isImpactSimulationRequest(normalized) ||
    normalized.includes("consigo") ||
    normalized.includes("posso") ||
    normalized.includes("da para") ||
    normalized.includes("simula")
  ) {
    const simulation = simulateSpend(text, month);
    if (simulation) return { text: simulation };
  }

  const mixedMovements = registerMixedFinancialEntries(text, month);
  if (mixedMovements) return { text: mixedMovements };

  if (
    amount &&
    (includesAny(normalized, EXTRA_REVENUE_WORDS) || isAddToBalanceIntent(normalized))
  ) {
    const multipleRevenues = registerMultipleRevenues(text, month);
    if (multipleRevenues) return { text: multipleRevenues };

    return { text: registerRevenue(text, amount, month) };
  }

  if (includesAny(normalized, BASE_INCOME_WORDS)) {
    return { text: registerIncome(text) };
  }

  if (
    standaloneAmount !== null ||
    (amount && (includesAny(normalized, EXPENSE_WORDS) || hasExpenseDescriptionWithAmount(text)))
  ) {
    const multipleExpenses = registerMultipleExpenses(text, month);
    if (multipleExpenses) return { text: multipleExpenses };

    return { text: registerExpense(text, amount, month) };
  }

  if (
    normalized.includes("resumo") ||
    normalized.includes("como esta") ||
    normalized.includes("como foi meu mes") ||
    normalized.includes("como foi o meu mes") ||
    normalized.includes("mes") ||
    normalized.includes("panorama")
  ) {
    return { text: formatSummary(month) };
  }

  if (normalized.includes("saldo") || normalized.includes("disponivel")) {
    const s = summarize(getFinanceState(), month);
    return {
      text: `Seu saldo disponível acumulado até ${monthLabel(month)} é **${formatBRL(s.balance)}**.`,
    };
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

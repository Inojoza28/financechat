import {
  cashBalanceUntil,
  financeActions,
  forecastFutureMonth,
  forecastNextMonth,
  forecastUntilDate,
  formatBRL,
  getFinanceState,
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
  type FinanceState,
  type IncomePeriod,
  type Revenue,
} from "@/lib/finance-store";
import { normalizeSpokenMoneyText } from "@/lib/spoken-money";
import { SUPPORT_COMMAND } from "@/lib/support";

type AssistantResult = {
  text: string;
};

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

  return `Pronto, registrei a despesa de **${formatBRL(expense.amount)}** em ${expense.category} para **${monthLabel(month)}**.\n\nTotal gasto no período: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.${limitText}`;
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
  ].join("\n");
}

function registerMixedFinancialEntries(text: string, month: string) {
  const entries = parseMixedFinancialEntries(text);
  const hasRevenue = entries.some((entry) => entry.kind === "revenue");
  const hasExpense = entries.some((entry) => entry.kind === "expense");
  if (entries.length < 2 || !hasRevenue || !hasExpense) return null;

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

  return [
    `Pronto, registrei **${movements.length} movimentações** separando entradas e saídas:`,
    "",
    ...movements.map((entry) => entry.line),
    "",
    `Entradas: **${formatBRL(totalRevenue)}**. Despesas: **${formatBRL(totalExpense)}**.`,
    futureExpense
      ? "As despesas futuras ficaram em **Lançamentos futuros** no Dashboard e ainda não foram debitadas do saldo atual."
      : `Saldo disponível acumulado: **${formatBRL(s.balance)}**.`,
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
    months.some((entryMonth) => entryMonth > monthKey(localISODate()))
      ? `Lançamentos futuros não foram descontados do saldo atual. Eles entram nas projeções e passam a impactar o saldo quando a competência correspondente chegar.`
      : `Total gasto no período: **${formatBRL(s.spent)}**. Saldo disponível: **${formatBRL(s.balance)}**.${limitText}`,
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
  return "Entendi. Hoje eu ainda não consigo criar uma meta para juntar dinheiro diretamente pelo chat.\n\nPara calcular isso com mais precisão, vá até o **Dashboard** e use a calculadora no canto inferior direito. Ela pode te ajudar a simular quanto guardar, dividir valores por período e planejar melhor esse objetivo.";
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

function paymentProjectionIntent(text: string, recentText: string) {
  return (
    includesAny(text, PAYMENT_PROJECTION_WORDS) ||
    (includesAny(recentText, PAYMENT_PROJECTION_WORDS) &&
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
      ]))
  );
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

  if (target.month <= currentMonth) return null;

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
  const detailsText = details.length ? `\n\nDetalhes considerados: ${details.join("; ")}.` : "";

  return `Projetando até o fim de **${monthLabel(forecast.targetMonth)}**, a estimativa é você ficar com **${formatBRL(forecast.projectedBalance)}**.\n\nComo cheguei nesse valor:\n- Saldo acumulado atual: **${formatBRL(forecast.currentBalance)}**\n- Entradas previstas até lá: **${incomeText}**\n- Saídas previstas até lá: **${expenseText}**\n\nCálculo: ${formatBRL(forecast.currentBalance)} + ${formatBRL(forecast.projectedIncome)} - ${formatBRL(forecast.projectedExpenses)} = **${formatBRL(forecast.projectedBalance)}**.${detailsText}\n\nEssa é uma projeção: novos gastos, receitas ou ajustes podem mudar esse valor.`;
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

  if (isSavingsGoalRequest(normalized)) {
    return { text: answerSavingsGoalHelp() };
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
    const multipleExpenses = registerMultipleExpenses(text, month);
    if (multipleExpenses) return { text: multipleExpenses };

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

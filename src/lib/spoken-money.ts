const NUMBER_WORDS = [
  "zero",
  "um",
  "uma",
  "dois",
  "duas",
  "tres",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
  "cem",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
  "mil",
  "e",
];

const WORD_PATTERN = NUMBER_WORDS.join("|");
const MONEY_WORD_PATTERN = new RegExp(
  `\\b((?:(?:${WORD_PATTERN})\\s+){0,12}(?:${WORD_PATTERN}))\\s+reais?\\b(?:\\s+e\\s+((?:(?:${WORD_PATTERN})\\s+){0,8}(?:${WORD_PATTERN}))\\s+centavos?)?`,
  "giu",
);

function normalizeWord(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

function parseNumberWords(text: string) {
  const words = normalizeWord(text)
    .split(/\s+/)
    .filter((word) => word && word !== "e");

  if (!words.length) return null;

  let total = 0;
  let current = 0;

  for (const word of words) {
    if (word === "mil") {
      total += (current || 1) * 1000;
      current = 0;
      continue;
    }

    const value = SMALL_NUMBERS[word];
    if (value == null) return null;
    current += value;
  }

  const result = total + current;
  return Number.isFinite(result) && result > 0 ? result : null;
}

function formatSpokenBRL(amount: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function capitalizeFirst(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function normalizeSpokenMoneyText(text: string) {
  const normalized = text.replace(MONEY_WORD_PATTERN, (_match, reaisText, centavosText) => {
    const reais = parseNumberWords(reaisText);
    if (reais == null) return _match;

    const centavos = centavosText ? parseNumberWords(centavosText) : 0;
    if (centavos == null || centavos > 99) return _match;

    return formatSpokenBRL(reais + centavos / 100);
  });

  return capitalizeFirst(normalized.replace(/\s+/g, " ").trim());
}

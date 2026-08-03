import type { UIMessage } from "ai";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  Gauge,
  HeartHandshake,
  Info,
  KeyRound,
  Loader2,
  Mic,
  Moon,
  Sparkles,
  Square,
  TrendingUp,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  chatMonthKeys,
  currentMonthKey,
  financeActions,
  fixedExpenseOccurrencesForMonth,
  formatBRL,
  getFinanceState,
  localISODate,
  monthKey,
  monthLabel,
  offsetMonthKey,
  summarize,
  useFinance,
} from "@/lib/finance-store";
import { answerLocally, buildTextMessage } from "@/lib/local-assistant";
import { normalizeSpokenMoneyText } from "@/lib/spoken-money";
import { MASKED_PIX_KEY, PIX_KEY, SUPPORT_COMMAND } from "@/lib/support";

const logo = "/assets/imgs/logo.png";

const SUGGESTIONS = [
  "Minha renda é R$ 4.500 por mês",
  "Gastei R$ 35,90 com almoço",
  "Como está meu mês?",
  "Quanto vou ter no próximo mês?",
];

const FALLBACK_RESPONSE =
  "Desculpe, não consegui entender ou responder essa solicitação. Posso ajudar você a registrar receitas e despesas, consultar seu saldo, fazer projeções financeiras, mostrar seus gastos e responder dúvidas relacionadas ao seu controle financeiro. Tente reformular a pergunta com um valor, período ou objetivo financeiro.";

const SMART_SUGGESTIONS_SEEN_KEY = "heyfin.smart-suggestions.seen.v1";
const RECENT_SPENDING_WINDOW_MS = 4 * 60 * 60 * 1000;
const SMART_SUGGESTION_IDLE_MS = 8 * 60 * 1000;

type SpeechRecognitionResult = ArrayLike<{ transcript: string }> & {
  isFinal?: boolean;
};

type SpeechRecognitionResultLike = {
  results: ArrayLike<SpeechRecognitionResult>;
  resultIndex?: number;
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeechRecognition = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

type QuickAction = {
  id: string;
  label: string;
  command: string;
  icon: typeof Gauge;
  tone?: "default" | "warning" | "success";
};

function readSeenSmartSuggestions() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SMART_SUGGESTIONS_SEEN_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeSeenSmartSuggestions(keys: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SMART_SUGGESTIONS_SEEN_KEY, JSON.stringify(keys.slice(-120)));
  } catch {
    /* storage unavailable */
  }
}

function messageText(message?: UIMessage) {
  return (
    message?.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim() ?? ""
  );
}

function dateTimeValue(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-secondary/80 px-3 py-2 text-[13px] text-muted-foreground">
      <span>Digitando</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </span>
    </div>
  );
}

function ScrollToLatestMessage({ trigger }: { trigger: string }) {
  const { scrollToBottom } = useStickToBottomContext();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [scrollToBottom, trigger]);

  return null;
}

export function ChatWindow() {
  const state = useFinance();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseInputRef = useRef("");
  const voiceFinalTranscriptRef = useRef("");
  const voiceReceivedTranscriptRef = useRef(false);
  const voiceSessionIdRef = useRef(0);
  const [input, setInput] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
  const [status, setStatus] = useState<"ready" | "submitted">("ready");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [copiedSupportMessageId, setCopiedSupportMessageId] = useState<string | null>(null);
  const [seenSmartSuggestions, setSeenSmartSuggestions] =
    useState<string[]>(readSeenSmartSuggestions);
  const [activeSmartSuggestion, setActiveSmartSuggestion] = useState<QuickAction | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>(
    () => getFinanceState().messagesByMonth[currentMonthKey()] ?? [],
  );
  const monthOptions = useMemo(() => chatMonthKeys(state), [state]);

  useEffect(() => {
    setMessages(getFinanceState().messagesByMonth[selectedMonth] ?? []);
  }, [selectedMonth]);

  useEffect(() => {
    financeActions.setMessagesForMonth(selectedMonth, messages);
  }, [messages, selectedMonth]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const busy = status === "submitted";
  const summary = summarize(state, selectedMonth);
  const lastMessage = messages.at(-1);
  const lastAssistantMessage = lastMessage?.role === "assistant" ? lastMessage : null;
  const contextualAction = useMemo<QuickAction | null>(() => {
    if (!state.showSmartSuggestions || !lastAssistantMessage) return null;

    const now = new Date();
    const nowTime = now.getTime();
    const todayKey = localISODate(now);
    const [year, monthIndex] = selectedMonth.split("-").map(Number);
    const daysInMonth =
      year && monthIndex
        ? new Date(year, monthIndex, 0).getDate()
        : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isCurrentMonth = selectedMonth === currentMonthKey();
    const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;
    const assistantText = messageText(lastAssistantMessage).toLowerCase();
    const actions: Array<QuickAction & { priority: number }> = [];

    const addAction = (action: QuickAction & { priority: number }) => {
      if (actions.some((item) => item.command === action.command || item.label === action.label)) {
        return;
      }
      actions.push(action);
    };

    const isMorning = now.getHours() >= 6 && now.getHours() < 12;
    const isEndOfDay = now.getHours() >= 18;
    const isMonthClosing = isCurrentMonth && dayOfMonth >= Math.max(24, daysInMonth - 4);
    const answeredDailySummary = assistantText.includes("resumo de hoje");
    const answeredMonthlySummary =
      assistantText.includes("resumo atualizado") || assistantText.includes("gasto no mês");
    const hasLimit = summary.spendingLimit != null && summary.spendingLimit > 0;
    const currentMonthExpenses = state.expenses.filter(
      (expense) =>
        !expense.balanceAdjustment &&
        !expense.goalContribution &&
        expense.date <= todayKey &&
        monthKey(expense.date) === selectedMonth,
    );
    const recentSpending = currentMonthExpenses
      .filter((expense) => nowTime - dateTimeValue(expense.createdAt) <= RECENT_SPENDING_WINDOW_MS)
      .reduce((total, expense) => total + expense.amount, 0);
    const latestExpense = currentMonthExpenses
      .slice()
      .sort((a, b) => dateTimeValue(b.createdAt) - dateTimeValue(a.createdAt))[0];
    const latestExpenseIsFresh =
      latestExpense && nowTime - dateTimeValue(latestExpense.createdAt) <= 8 * 60 * 1000;
    const largeExpenseReference = hasLimit
      ? Math.max(100, (summary.spendingLimit ?? 0) * 0.12)
      : Math.max(100, Math.max(0, summary.balance) * 0.08);
    const recentSpendingReference = hasLimit
      ? Math.max(300, (summary.spendingLimit ?? 0) * 0.18)
      : Math.max(300, Math.max(0, summary.balance) * 0.12);
    const nextMonth = offsetMonthKey(selectedMonth, 1);
    const nextMonthEnd = `${nextMonth}-${String(new Date(Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
    const futureExpenseCount = state.expenses.filter(
      (expense) =>
        !expense.balanceAdjustment &&
        !expense.goalContribution &&
        expense.date > todayKey &&
        expense.date <= nextMonthEnd,
    ).length;
    const upcomingFixedExpenseCount = [selectedMonth, nextMonth]
      .flatMap((entryMonth) =>
        fixedExpenseOccurrencesForMonth(
          state.fixedExpenses,
          entryMonth,
          state.deletedFixedExpenseOccurrences,
          state.fixedExpenseOccurrenceOverrides,
        ),
      )
      .filter((expense) => expense.date > todayKey && expense.date <= nextMonthEnd).length;
    const hasFutureReminder = futureExpenseCount + upcomingFixedExpenseCount > 0;
    const previousMonthSummary = summarize(state, offsetMonthKey(selectedMonth, -1));
    const canCompareSpendingPace =
      isCurrentMonth &&
      dayOfMonth >= 7 &&
      summary.manualExpenseCount >= 3 &&
      previousMonthSummary.count >= 3 &&
      previousMonthSummary.spent > 0;

    if (isCurrentMonth && hasLimit && summary.limitStatus === "exceeded") {
      addAction({
        id: `limit-exceeded:${selectedMonth}`,
        label: "Ver situação do limite",
        command: "Meu limite de gastos",
        icon: Gauge,
        tone: "warning",
        priority: 100,
      });
    }

    if (isCurrentMonth && hasLimit && summary.limitStatus === "warning") {
      addAction({
        id: `limit-warning:${selectedMonth}`,
        label: "Quanto ainda tenho no limite?",
        command: "Meu limite de gastos",
        icon: Gauge,
        tone: "warning",
        priority: 90,
      });
    }

    if (
      isCurrentMonth &&
      recentSpending >= recentSpendingReference &&
      currentMonthExpenses.length >= 2
    ) {
      addAction({
        id: `recent-spending:${todayKey}`,
        label: "Ver gastos dos últimos 7 dias",
        command: "Quanto gastei nos últimos 7 dias?",
        icon: CalendarDays,
        priority: 80,
      });
    }

    if (
      isCurrentMonth &&
      hasLimit &&
      latestExpense &&
      latestExpenseIsFresh &&
      latestExpense.amount >= largeExpenseReference &&
      summary.limitStatus !== "exceeded"
    ) {
      addAction({
        id: `large-expense-limit:${todayKey}`,
        label: "Ver impacto no limite",
        command: "Meu limite de gastos",
        icon: Gauge,
        priority: 70,
      });
    }

    if (isCurrentMonth && summary.count >= 5 && summary.byCategory.length > 0 && dayOfMonth >= 7) {
      addAction({
        id: `monthly-weight:${selectedMonth}`,
        label: "O que mais pesou no meu mês?",
        command: "O que mais pesou no meu mês?",
        icon: Info,
        priority: 62,
      });
    }

    if (isCurrentMonth && (hasLimit || dayOfMonth >= 10) && summary.balance > 0) {
      addAction({
        id: `daily-spend-plan:${todayKey}`,
        label: "Quanto posso gastar por dia?",
        command: "Quanto posso gastar por dia até o fim do mês?",
        icon: Gauge,
        tone: "success",
        priority: 58,
      });
    }

    if (hasFutureReminder) {
      addAction({
        id: `future-reminder:${selectedMonth}`,
        label: "Tenho alguma despesa futura para lembrar?",
        command: "Tenho alguma despesa futura para lembrar?",
        icon: CalendarDays,
        priority: 56,
      });
    }

    if (canCompareSpendingPace) {
      addAction({
        id: `spending-pace:${selectedMonth}`,
        label: "Estou gastando mais rápido que o normal?",
        command: "Estou gastando mais rápido que o normal?",
        icon: TrendingUp,
        priority: 54,
      });
    }

    if (isMonthClosing && answeredMonthlySummary) {
      addAction({
        id: `month-closing-projection:${selectedMonth}`,
        label: "Qual a projeção para o próximo mês?",
        command: "Quanto vou ter no próximo mês?",
        icon: TrendingUp,
        tone: "success",
        priority: 55,
      });
    } else if (isMonthClosing) {
      addAction({
        id: `month-closing-summary:${selectedMonth}`,
        label: "Como foi o meu mês?",
        command: "Como foi o meu mês?",
        icon: CalendarDays,
        priority: 50,
      });
    } else if (isEndOfDay && !answeredDailySummary) {
      addAction({
        id: `evening-summary:${todayKey}`,
        label: "Como foi o meu dia?",
        command: "Resumo do dia",
        icon: Moon,
        priority: 40,
      });
    } else if (isMorning && !assistantText.includes("ideal para gastar hoje")) {
      addAction({
        id: `morning-plan:${todayKey}`,
        label: "Quanto seria o ideal para gastar hoje?",
        command: "Quanto seria o ideal para gastar hoje?",
        icon: Gauge,
        tone: "success",
        priority: 30,
      });
    }

    return actions.sort((a, b) => b.priority - a.priority)[0] ?? null;
  }, [
    lastAssistantMessage,
    selectedMonth,
    state.deletedFixedExpenseOccurrences,
    state.expenses,
    state.fixedExpenseOccurrenceOverrides,
    state.fixedExpenses,
    state.showSmartSuggestions,
    summary.balance,
    summary.byCategory.length,
    summary.count,
    summary.limitStatus,
    summary.manualExpenseCount,
    summary.spendingLimit,
  ]);

  useEffect(() => {
    if (
      !state.showSmartSuggestions ||
      !lastAssistantMessage ||
      !contextualAction ||
      input.trim() ||
      busy
    ) {
      setActiveSmartSuggestion(null);
      return;
    }

    if (seenSmartSuggestions.includes(contextualAction.id)) {
      setActiveSmartSuggestion(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveSmartSuggestion(contextualAction);
      setSeenSmartSuggestions((current) => {
        if (current.includes(contextualAction.id)) return current;
        const next = [...current, contextualAction.id].slice(-120);
        writeSeenSmartSuggestions(next);
        return next;
      });
    }, SMART_SUGGESTION_IDLE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    contextualAction,
    busy,
    input,
    lastAssistantMessage,
    seenSmartSuggestions,
    state.showSmartSuggestions,
  ]);
  const voiceFeedbackLabel =
    voiceStatus === "recording"
      ? "Ouvindo..."
      : voiceStatus === "processing"
        ? "Finalizando..."
        : "";

  const send = (text: string) => {
    const trimmed = normalizeSpokenMoneyText(text.trim());
    if (!trimmed || busy) return;

    if (voiceStatus !== "idle" || recognitionRef.current) {
      voiceSessionIdRef.current += 1;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          recognition.stop();
        } catch {
          recognition.abort();
        }
      }
      voiceBaseInputRef.current = "";
      voiceFinalTranscriptRef.current = "";
      voiceReceivedTranscriptRef.current = false;
      setVoiceStatus("idle");
    }

    const contextMessages = messages;
    const userMessage = buildTextMessage("user", trimmed) as UIMessage;
    const responseDelay = Math.min(1100, Math.max(560, 420 + trimmed.length * 8));

    setInput("");
    setActiveSmartSuggestion(null);
    setStatus("submitted");
    setMessages((current) => [...current, userMessage]);

    window.setTimeout(() => {
      let responseText = FALLBACK_RESPONSE;
      try {
        const response = answerLocally(trimmed, selectedMonth, { messages: contextMessages });
        responseText = response.text?.trim() || FALLBACK_RESPONSE;
      } catch (error) {
        console.error("Erro ao responder no assistente local:", error);
      }
      setMessages((current) => [
        ...current,
        buildTextMessage("assistant", responseText) as UIMessage,
      ]);
      setStatus("ready");
    }, responseDelay);
  };

  const copyPixKey = async (messageId: string) => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopiedSupportMessageId(messageId);
      toast.success("Chave Pix copiada! 💙 Obrigado por fortalecer o HeyFin.");
      window.setTimeout(() => setCopiedSupportMessageId(null), 2200);
    } catch {
      toast.error("Não consegui copiar a chave Pix.");
    }
  };

  const insertSupportCommand = () => {
    setInput(SUPPORT_COMMAND);
  };

  const toggleVoiceInput = () => {
    if (voiceStatus === "recording") {
      setVoiceStatus("processing");
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      (window as WindowWithSpeechRecognition).SpeechRecognition ??
      (window as WindowWithSpeechRecognition).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta transcrição por voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    const sessionId = voiceSessionIdRef.current + 1;
    voiceSessionIdRef.current = sessionId;
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    voiceBaseInputRef.current = input.trim();
    voiceFinalTranscriptRef.current = "";
    voiceReceivedTranscriptRef.current = false;

    recognition.onstart = () => {
      if (voiceSessionIdRef.current !== sessionId) return;
      setVoiceStatus("recording");
    };

    recognition.onresult = (event) => {
      if (voiceSessionIdRef.current !== sessionId) return;

      let finalTranscript = voiceFinalTranscriptRef.current;
      let interimTranscript = "";
      const startIndex = event.resultIndex ?? 0;

      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;

        voiceReceivedTranscriptRef.current = true;

        if ("isFinal" in result && result.isFinal) {
          finalTranscript = [finalTranscript, transcript].filter(Boolean).join(" ");
        } else {
          interimTranscript = [interimTranscript, transcript].filter(Boolean).join(" ");
        }
      }

      voiceFinalTranscriptRef.current = finalTranscript.trim();
      const nextInput = [
        voiceBaseInputRef.current,
        voiceFinalTranscriptRef.current,
        interimTranscript.trim(),
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      setInput(normalizeSpokenMoneyText(nextInput));
    };

    recognition.onerror = (event) => {
      if (voiceSessionIdRef.current !== sessionId) return;

      const blocked = event.error === "not-allowed" || event.error === "service-not-allowed";
      if (event.error !== "no-speech") {
        toast.error(
          blocked ? "Permita o uso do microfone para transcrever." : "Não consegui captar o áudio.",
        );
      }
      setVoiceStatus("idle");
    };

    recognition.onend = () => {
      if (voiceSessionIdRef.current !== sessionId) return;

      recognitionRef.current = null;
      setVoiceStatus("idle");
      if (voiceReceivedTranscriptRef.current) {
        toast.success("Transcrição finalizada. Você pode revisar antes de enviar.");
      }
    };

    try {
      recognition.start();
    } catch {
      setVoiceStatus("idle");
      toast.error("Não consegui iniciar a gravação.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="glass border-b border-border/50">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 leading-none">
              <p className="text-[11px] font-medium uppercase leading-none tracking-[0.08em] text-muted-foreground">
                Competência
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Entender como funciona a competência"
                  >
                    <Info className="size-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[22px] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Como funciona a competência?</DialogTitle>
                    <DialogDescription className="pt-1 leading-relaxed">
                      A competência organiza apenas o histórico visual do chat por mês. Quando um
                      novo mês começa, a conversa inicia uma nova página de mensagens para manter
                      tudo mais leve e fácil de consultar.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 text-[14px] leading-relaxed text-muted-foreground">
                    <p>
                      As mensagens dos meses anteriores continuam salvas e você pode voltar a elas
                      pelo filtro de competência.
                    </p>
                    <p>
                      O saldo financeiro não é reiniciado ao trocar de mês. Ele permanece
                      acumulativo, considerando todas as receitas e despesas registradas ao longo do
                      tempo.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="truncate text-[14px] font-semibold leading-tight capitalize">
              {monthLabel(selectedMonth)}
            </p>
          </div>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="h-9 rounded-full border border-border/70 bg-surface px-3 text-[13px] font-medium shadow-soft outline-none transition-colors hover:border-primary/30 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20"
            aria-label="Filtrar conversa por competência"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto min-h-full w-full max-w-3xl gap-5 px-4 pt-3 pb-5 sm:pt-5 sm:pb-6">
          <ScrollToLatestMessage trigger={`${selectedMonth}:${messages.length}:${status}`} />
          {messages.length === 0 ? (
            <div className="animate-fade-in flex min-h-full flex-1 flex-col items-center justify-center px-2 py-4 text-center sm:py-12">
              <img src={logo} alt="" width={512} height={512} className="size-14 drop-shadow-sm" />
              <h1 className="mt-3 text-[22px] font-semibold tracking-tight sm:mt-5 sm:text-[25px]">
                Olá, sou o {state.assistantName}.
              </h1>
              <p className="mt-1.5 max-w-[20rem] text-[14px] leading-snug text-muted-foreground sm:mt-2 sm:max-w-sm sm:text-[15px] sm:leading-relaxed">
                Conte o que você ganhou ou gastou, do jeito que falaria com um amigo. Eu organizo o
                resto.
              </p>
              <div className="mt-4 flex w-full max-w-[22rem] flex-wrap justify-center gap-1.5 sm:mt-7 sm:max-w-md sm:gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-border/70 bg-surface/90 px-3 py-1.5 text-[12.5px] text-muted-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:text-foreground sm:px-3.5 sm:py-2 sm:text-[13px]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const text = message.parts
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("");
              if (!text.trim()) return null;
              const showSupportCopy =
                message.role === "assistant" && text.includes("Pix para apoiar o HeyFin");
              const supportCopied = copiedSupportMessageId === message.id;
              const showSuggestionActions =
                message.role === "assistant" &&
                lastAssistantMessage?.id === message.id &&
                Boolean(activeSmartSuggestion);
              return (
                <Fragment key={message.id}>
                  <Message from={message.role} className="animate-rise">
                    <MessageContent
                      className={
                        message.role === "user"
                          ? "group-[.is-user]:bg-chat-bubble group-[.is-user]:text-chat-bubble-foreground group-[.is-user]:rounded-[22px] group-[.is-user]:rounded-br-lg group-[.is-user]:px-4 group-[.is-user]:py-2.5 group-[.is-user]:shadow-soft"
                          : "text-[15px] leading-relaxed"
                      }
                    >
                      <MessageResponse>{text}</MessageResponse>
                      {showSupportCopy && (
                        <div className="mt-3 max-w-full rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 shadow-[0_14px_34px_-28px_oklch(0.45_0.12_245_/_42%)]">
                          <p className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground/75">
                            <KeyRound className="size-3.5 text-primary" />
                            Chave Pix
                          </p>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <button
                              type="button"
                              className="min-w-0 flex-1 cursor-pointer rounded-2xl border border-primary/15 bg-surface px-3 py-2.5 text-left shadow-[0_8px_22px_-20px_oklch(0.25_0.03_260_/_24%)] transition-colors hover:border-primary/25 hover:bg-background"
                              onClick={() => copyPixKey(message.id)}
                              aria-label="Copiar chave Pix completa"
                            >
                              <code className="block break-all text-[12.5px] font-medium leading-relaxed text-foreground">
                                {MASKED_PIX_KEY}
                              </code>
                            </button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 shrink-0 gap-2 rounded-2xl border-primary/32 bg-primary/[0.045] px-3 text-[12.5px] font-semibold text-primary shadow-[0_8px_22px_-22px_oklch(0.42_0.12_245_/_18%)] transition-all hover:border-primary/45 hover:bg-primary/[0.075] hover:!text-primary hover:shadow-[0_10px_24px_-22px_oklch(0.42_0.12_245_/_28%)] sm:h-auto"
                              onClick={() => copyPixKey(message.id)}
                              aria-label="Copiar chave Pix completa"
                            >
                              {supportCopied ? (
                                <Check className="size-4" />
                              ) : (
                                <Copy className="size-4" />
                              )}
                              <span>{supportCopied ? "Copiado" : "Copiar"}</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </MessageContent>
                  </Message>
                  {showSuggestionActions && (
                    <Message from="user" className="animate-rise">
                      <MessageContent className="group-[.is-user]:rounded-[22px] group-[.is-user]:rounded-br-lg group-[.is-user]:border group-[.is-user]:border-emerald-500/25 group-[.is-user]:bg-emerald-600 group-[.is-user]:px-3 group-[.is-user]:py-3 group-[.is-user]:text-white group-[.is-user]:shadow-[0_16px_38px_-24px_oklch(0.55_0.14_155_/_52%)] dark:group-[.is-user]:border-emerald-300/18 dark:group-[.is-user]:bg-emerald-700">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/16 px-2 py-1 text-[11px] font-semibold text-white">
                              <Sparkles className="size-3" />
                              Sugestão da IA
                            </span>
                            <p className="mt-2 text-[12px] leading-snug text-white/78">
                              Um próximo passo rápido para este momento.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSmartSuggestion(null)}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white/72 transition-colors hover:bg-white/14 hover:text-white"
                            aria-label="Fechar sugestão"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        {activeSmartSuggestion
                          ? [activeSmartSuggestion].map((action) => {
                              const Icon = action.icon;

                              return (
                                <button
                                  key={action.command}
                                  type="button"
                                  onClick={() => {
                                    setActiveSmartSuggestion(null);
                                    send(action.command);
                                  }}
                                  disabled={busy}
                                  className="mt-2 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/35 bg-white px-3 py-2 text-[12.5px] font-semibold text-emerald-700 shadow-[0_10px_24px_-18px_oklch(0.25_0.03_260_/_35%)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/70 hover:bg-emerald-50 hover:text-emerald-800 disabled:pointer-events-none disabled:opacity-50 dark:border-white/20 dark:bg-white/92 dark:text-emerald-800 dark:hover:bg-white"
                                >
                                  <Icon className="size-3.5" />
                                  <span>{action.label}</span>
                                </button>
                              );
                            })
                          : null}
                      </MessageContent>
                    </Message>
                  )}
                </Fragment>
              );
            })
          )}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <TypingIndicator />
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="glass border-t border-border/50">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-5 sm:pb-4">
          {state.income && (
            <p className="mb-2 text-center text-[12px] text-muted-foreground">
              Saldo acumulado até {monthLabel(selectedMonth)}:{" "}
              <span className="font-semibold text-foreground">{formatBRL(summary.balance)}</span> ·
              extras do mês {formatBRL(summary.extraIncome)} · gasto do mês{" "}
              {formatBRL(summary.spent)}
              {summary.spendingLimit
                ? ` · limite ${summary.limitUsedPercent}% (${formatBRL(Math.max(0, summary.limitRemaining ?? 0))} livres)`
                : ""}
            </p>
          )}
          <PromptInput
            className="rounded-[16px] bg-transparent shadow-float transition-shadow duration-300 focus-within:shadow-[0_8px_32px_-18px_oklch(0.2_0.02_260_/_36%)]"
            onSubmit={() => send(input)}
          >
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voiceStatus === "recording"
                  ? "Estou ouvindo..."
                  : `Fale com o ${state.assistantName}...`
              }
              className="chat-message-textarea min-h-[56px] py-2 text-[15px] sm:min-h-[54px]"
            />
            <PromptInputFooter className="justify-between gap-2 border-0 p-1.5">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={insertSupportCommand}
                  disabled={busy}
                  aria-label="Inserir comando para apoiar o projeto"
                  title="Apoiar o projeto"
                >
                  <HeartHandshake className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant={voiceStatus === "recording" ? "default" : "ghost"}
                  size="icon-sm"
                  className={`size-9 rounded-full transition-all duration-300 ${
                    voiceStatus === "recording"
                      ? "shadow-[0_10px_26px_-16px_oklch(0.55_0.15_245_/_55%)] ring-4 ring-primary/10"
                      : voiceStatus === "processing"
                        ? "bg-secondary text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                  onClick={toggleVoiceInput}
                  disabled={busy || voiceStatus === "processing"}
                  aria-label={
                    voiceStatus === "recording"
                      ? "Parar gravação e manter transcrição"
                      : "Transcrever mensagem por áudio"
                  }
                  title={
                    voiceStatus === "recording"
                      ? "Parar e manter transcrição"
                      : voiceStatus === "processing"
                        ? "Processando áudio"
                        : "Falar mensagem"
                  }
                >
                  {voiceStatus === "processing" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : voiceStatus === "recording" ? (
                    <Square className="size-3.5" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </Button>
                {voiceStatus !== "idle" && (
                  <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground sm:text-[12px]">
                    {voiceFeedbackLabel}
                  </span>
                )}
                <PromptInputSubmit
                  status={status}
                  disabled={!input.trim() && !busy}
                  className="rounded-full"
                >
                  {status === "ready" ? <ArrowRight className="size-4" /> : undefined}
                </PromptInputSubmit>
              </div>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

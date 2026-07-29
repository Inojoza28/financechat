import type { UIMessage } from "ai";
import {
  ArrowRight,
  Check,
  Copy,
  HeartHandshake,
  Info,
  KeyRound,
  Loader2,
  Mic,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  formatBRL,
  getFinanceState,
  monthLabel,
  summarize,
  useFinance,
} from "@/lib/finance-store";
import { answerLocally, buildTextMessage } from "@/lib/local-assistant";
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

type SpeechRecognitionResultLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
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
  const [input, setInput] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
  const [status, setStatus] = useState<"ready" | "submitted">("ready");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [copiedSupportMessageId, setCopiedSupportMessageId] = useState<string | null>(null);
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

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const contextMessages = messages;
    const userMessage = buildTextMessage("user", trimmed) as UIMessage;
    const responseDelay = Math.min(1100, Math.max(560, 420 + trimmed.length * 8));

    setInput("");
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
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let receivedTranscript = false;

    recognition.onstart = () => {
      setVoiceStatus("recording");
    };

    recognition.onresult = (event) => {
      receivedTranscript = true;
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (!transcript) {
        toast.error("Não consegui transcrever o áudio.");
        return;
      }

      setInput((current) => [current.trim(), transcript].filter(Boolean).join(" "));
      toast.success("Transcrição concluída.");
    };

    recognition.onerror = (event) => {
      const blocked = event.error === "not-allowed" || event.error === "service-not-allowed";
      toast.error(blocked ? "Permita o uso do microfone para transcrever." : "Não consegui captar o áudio.");
      setVoiceStatus("idle");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceStatus("idle");
      if (!receivedTranscript) return;
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
              <img
                src={logo}
                alt=""
                width={512}
                height={512}
                className="size-14 drop-shadow-sm"
              />
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
              return (
                <Message key={message.id} from={message.role} className="animate-rise">
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
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto w-full justify-between gap-2 rounded-2xl border-primary/15 bg-surface px-3 py-2.5 text-left shadow-[0_8px_22px_-20px_oklch(0.25_0.03_260_/_30%)] hover:border-primary/25 hover:bg-background"
                          onClick={() => copyPixKey(message.id)}
                          aria-label="Copiar chave Pix completa"
                        >
                          <code className="min-w-0 flex-1 break-all text-[12.5px] font-medium leading-relaxed text-foreground">
                            {MASKED_PIX_KEY}
                          </code>
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            {supportCopied ? (
                              <Check className="size-4" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </span>
                        </Button>
                      </div>
                    )}
                  </MessageContent>
                </Message>
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
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-4">
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
            className="rounded-[26px] border-border/70 bg-surface shadow-float transition-shadow duration-300 focus-within:shadow-[0_8px_32px_-18px_oklch(0.2_0.02_260_/_36%)]"
            onSubmit={() => send(input)}
          >
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Fale com o ${state.assistantName}...`}
              className="text-[16px] sm:text-[15px]"
            />
            <PromptInputFooter className="justify-between gap-2 border-0 p-2">
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
                  className="size-9 rounded-full"
                  onClick={toggleVoiceInput}
                  disabled={busy || voiceStatus === "processing"}
                  aria-label={
                    voiceStatus === "recording"
                      ? "Parar gravação"
                      : "Transcrever mensagem por áudio"
                  }
                  title={
                    voiceStatus === "recording"
                      ? "Parar gravação"
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
                  <span className="hidden text-[12px] text-muted-foreground sm:inline">
                    {voiceStatus === "recording" ? "Gravando..." : "Processando..."}
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

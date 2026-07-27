import type { UIMessage } from "ai";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

const logo = "/assets/imgs/logo.png";

const SUGGESTIONS = [
  "Minha renda é R$ 4.500 por mês",
  "Gastei R$ 35,90 com almoço",
  "Como está meu mês?",
  "Quanto vou ter no próximo mês?",
];

const FALLBACK_RESPONSE =
  "Desculpe, não consegui entender ou responder essa solicitação. Posso ajudar você a registrar receitas e despesas, consultar seu saldo, fazer projeções financeiras, mostrar seus gastos e responder dúvidas relacionadas ao seu controle financeiro. Tente reformular a pergunta com um valor, período ou objetivo financeiro.";

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

export function ChatWindow() {
  const state = useFinance();
  const [input, setInput] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());
  const [status, setStatus] = useState<"ready" | "submitted">("ready");
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="glass border-b border-border/50">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Competência
            </p>
            <p className="truncate text-[14px] font-semibold capitalize">
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
        <ConversationContent className="mx-auto w-full max-w-3xl gap-5 px-4 pt-5 pb-2">
          {messages.length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center justify-center px-2 py-12 text-center">
              <img src={logo} alt="" width={512} height={512} className="size-14 drop-shadow-sm" />
              <h1 className="mt-5 text-[25px] font-semibold tracking-tight">
                Olá, sou o {state.assistantName}.
              </h1>
              <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                Conte o que você ganhou ou gastou, do jeito que falaria com um amigo. Eu organizo o
                resto.
              </p>
              <div className="mt-7 flex w-full max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-border/70 bg-surface/90 px-3.5 py-2 text-[13px] text-muted-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:text-foreground"
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
            <PromptInputFooter className="justify-end border-0 p-2">
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() && !busy}
                className="rounded-full"
              >
                {status === "ready" ? <ArrowRight className="size-4" /> : undefined}
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

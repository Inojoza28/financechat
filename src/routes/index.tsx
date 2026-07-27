import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ChatWindow } from "@/components/chat/chat-window";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finance Chat — Organize seu dinheiro conversando" },
      {
        name: "description",
        content:
          "Registre despesas, acompanhe seu saldo e simule cenários financeiros conversando naturalmente com seu assistente pessoal.",
      },
      { property: "og:title", content: "Finance Chat — Organize seu dinheiro conversando" },
      {
        property: "og:description",
        content:
          "Controle financeiro pessoal por chat: registre gastos em uma mensagem e veja seu saldo atualizado na hora.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <AppNav />
      <main className="min-h-0 flex-1">{mounted ? <ChatWindow /> : null}</main>
    </div>
  );
}

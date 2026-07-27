import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ChatWindow } from "@/components/chat/chat-window";

export function ChatPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <AppNav />
      <main className="min-h-0 flex-1">{mounted ? <ChatWindow /> : null}</main>
    </div>
  );
}

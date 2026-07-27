import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async () =>
        Response.json({
          ok: true,
          mode: "local",
          message: "O assistente financeiro agora e processado localmente no navegador.",
        }),
    },
  },
});

import { z } from "zod";

import { audit, gate, parseBody } from "@/lib/admin/api";
import { streamCrmAssistant } from "@/lib/ai/crm-assistant";
import { isOpenRouterConfigured } from "@/lib/ai/providers/openrouter";

export const maxDuration = 60;

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(30),
});

/**
 * Streams the CRM assistant's answer as Server-Sent Events: `text` deltas,
 * `tool` notices (so the UI can show "checking deals…"), then `done` or
 * `error`. The admin session cookie is set with path "/", so this route
 * under /api/admin receives it like every other admin API route.
 */
export async function POST(request: Request) {
  const auth = await gate("viewer");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  if (!isOpenRouterConfigured()) {
    return Response.json({ error: "ai_not_configured" }, { status: 503 });
  }

  await audit("assistant.query", body.data.messages.at(-1)?.content.slice(0, 120) ?? null);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const ev of streamCrmAssistant(body.data.messages)) {
          if (ev.type === "text") send("text", { text: ev.text });
          else send("tool", { name: ev.name });
        }
        send("done", {});
      } catch (err) {
        console.error("[admin/assistant] stream failed:", err);
        const noCredits = Boolean(err && typeof err === "object" && "status" in err && (err as { status: unknown }).status === 402);
        send("error", { error: noCredits ? "no_credits" : "upstream_failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

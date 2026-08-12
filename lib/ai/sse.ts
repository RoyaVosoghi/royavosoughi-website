import "server-only";

import type { BrainStreamEvent } from "./brain";

/**
 * Wraps a streamBrainTurn() generator as a text/event-stream Response —
 * shared by the web and widget chat routes (Telegram doesn't stream, see
 * runBrainTurn in brain.ts). A mid-stream failure becomes an "error" SSE
 * event rather than an HTTP error status, since headers are already flushed
 * by the time a model/tool call can fail.
 */
export function createChatStreamResponse(events: AsyncGenerator<BrainStreamEvent>, extraHeaders?: HeadersInit): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const ev of events) {
          if (ev.type === "chunk") send("chunk", { text: ev.text });
          else send("done", ev.result);
        }
      } catch (err) {
        console.error("[chat] streamBrainTurn failed:", err);
        send("error", { error: "upstream_failed" });
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
      // Disables buffering on nginx-fronted deploys so chunks flush immediately.
      "X-Accel-Buffering": "no",
      ...extraHeaders,
    },
  });
}

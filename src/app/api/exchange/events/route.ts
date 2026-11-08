import { marketplaceStore } from "@/lib/server/marketplace-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      let last = new Date().toISOString();
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("ready", { observedAt: last });
      const timer = setInterval(async () => {
        if (closed) return;
        try {
          const events = await marketplaceStore.eventsSince(last);
          if (events.length) { last = events[events.length - 1].at; send("marketplace", events); }
          else send("heartbeat", { observedAt: new Date().toISOString() });
        } catch { send("heartbeat", { observedAt: new Date().toISOString() }); }
      }, 5000);
      request.signal.addEventListener("abort", () => { closed = true; clearInterval(timer); try { controller.close(); } catch { /* already closed */ } });
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" } });
}

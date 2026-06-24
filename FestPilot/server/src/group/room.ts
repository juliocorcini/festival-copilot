// GroupRoom — one Durable Object instance per squad (DEC-037). The DB stays the source of
// truth; this object's only job is realtime fan-out: when any member writes (join/leave now;
// plan + board in 4.3/4.4), the Worker POSTs `/notify` here and we broadcast a tiny
// `{ type:"changed", rev, topic }` to every connected client, which then re-fetches.
//
// Uses the **SQLite storage backend** (the only Durable Object backend on the Workers Free
// plan — free per DEC-037), declared via `new_sqlite_classes` in wrangler.toml. We use the
// hibernatable WebSocket API (`acceptWebSocket` / `getWebSockets`) so idle rooms cost nothing.

import type { Env } from "../env";

interface ChangedMessage {
  type: "changed";
  rev: number;
  topic: string;
}

export class GroupRoom implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    // env is unused today; kept for the Firebase/push-fan-out work that lands later.
    _env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Client subscription — upgrade to a hibernatable WebSocket.
    if (url.pathname.endsWith("/socket")) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // Server-side fan-out trigger (called by the Worker after a write).
    if (url.pathname.endsWith("/notify") && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { topic?: string };
      const topic = body.topic ?? "group";
      const rev = ((await this.state.storage.get<number>("rev")) ?? 0) + 1;
      await this.state.storage.put("rev", rev);
      const payload = JSON.stringify({ type: "changed", rev, topic } satisfies ChangedMessage);
      const sockets = this.state.getWebSockets();
      for (const ws of sockets) {
        try {
          ws.send(payload);
        } catch {
          // A dead socket will be reaped by the runtime; ignore.
        }
      }
      return Response.json({ ok: true, rev, clients: sockets.length });
    }

    return new Response("not found", { status: 404 });
  }

  // Hibernation handlers. We only need a lightweight keepalive ("ping" -> "pong").
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === "ping") ws.send("pong");
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _clean: boolean): Promise<void> {
    try {
      ws.close(code < 1000 || code > 4999 ? 1000 : code);
    } catch {
      // already closed
    }
  }
}

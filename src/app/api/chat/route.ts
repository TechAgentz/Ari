import { generateDemoReply } from "@/lib/agent/demo-engine";
import { parseChatRequest, type ChatRequestBody } from "@/lib/agent/protocol";
import { prepareTurn } from "@/lib/agent/turn";
import { crisisReply } from "@/lib/safety/crisis";
import { getServerEnv } from "@/lib/server/env";
import { GroqError, streamGroqChat } from "@/lib/server/groq";
import { clientKey, rateLimit, readBody } from "@/lib/server/rate-limit";
import type { MessageMeta, ReplyEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 200_000;
const encoder = new TextEncoder();
const line = (e: ReplyEvent) => encoder.encode(`${JSON.stringify(e)}\n`);

async function* simulateStream(text: string, signal: AbortSignal) {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const part of parts) {
    if (signal.aborted) return;
    yield part;
    await new Promise((r) => setTimeout(r, 14 + Math.min(40, part.length * 3)));
  }
}

export async function POST(req: Request) {
  const limited = rateLimit(clientKey(req, "chat"), 40);
  if (!limited.ok) {
    return Response.json({ error: "Too many messages — please wait a moment." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  // The size limit holds with or without a Content-Length header (e.g. a chunked upload).
  let raw: Uint8Array | null;
  try {
    raw = await readBody(req, MAX_BODY_BYTES);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!raw) return Response.json({ error: "Request too large" }, { status: 413 });

  let body: ChatRequestBody | null = null;
  try {
    body = parseChatRequest(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    body = null;
  }
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  // Redaction (defence in depth — the client redacts too), withholding earlier crisis
  // messages, risk screening, knowledge retrieval and the system prompt all happen in prepareTurn.
  const env = getServerEnv();
  const turn = prepareTurn(body);
  const { state, risk, chatMessages } = turn;
  const mode = body.mode;

  // Stops the work, and any further writes, once the client has gone (Stop, an interruption or a closed tab).
  const cancelled = new AbortController();
  const signal = AbortSignal.any([req.signal, cancelled.signal]);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (e: ReplyEvent) => {
        if (closed || signal.aborted) return;
        try {
          controller.enqueue(line(e));
        } catch {
          closed = true;
        }
      };
      const streamText = async (text: string, meta: MessageMeta) => {
        send({ type: "meta", meta });
        for await (const d of simulateStream(text, signal)) send({ type: "delta", text: d });
        send({ type: "done", meta });
      };

      try {
        // 1. High-risk messages (and a "yes" to a safety check) never go to the AI provider.
        if (risk.level === "crisis") {
          const reply = crisisReply(risk.categories, mode);
          await streamText(reply.text, reply.meta);
          return;
        }

        const runDemo = async (fallbackReason?: string) => {
          const reply = generateDemoReply(chatMessages, state, mode);
          await streamText(reply.text, { ...reply.meta, fallback: !!fallbackReason, fallbackReason });
        };

        if (env.provider !== "groq" || !env.apiKey) {
          await runDemo();
          return;
        }

        // 2. Groq conversation with retrieved knowledge. If the model is rate-limited
        //    before any text arrives, retry once on the paired model (separate quota).
        const primary = mode === "voice" ? env.voiceModel : env.model;
        const models = [primary, env.fallbackModelFor(primary)].filter((m): m is string => Boolean(m));
        const groqSignal = AbortSignal.any([signal, AbortSignal.timeout(env.timeoutMs)]);

        for (let attempt = 0; attempt < models.length; attempt++) {
          const model = models[attempt];
          const meta: MessageMeta = {
            provider: "groq",
            model,
            stage: state.stage,
            sources: turn.sources,
            strategy: turn.strategy?.move,
            safety: risk.level === "distress" || turn.priorCrisis ? "distress" : undefined,
          };
          let started = false;
          try {
            for await (const delta of streamGroqChat({
              apiKey: env.apiKey,
              model,
              signal: groqSignal,
              maxTokens: mode === "voice" ? 400 : 800,
              messages: turn.providerMessages,
            })) {
              if (!started) {
                send({ type: "meta", meta });
                started = true;
              }
              send({ type: "delta", text: delta });
            }
            if (!started) {
              await runDemo("empty-response");
              return;
            }
            send({ type: "done", meta });
            return;
          } catch (err) {
            const reason = err instanceof GroqError ? err.reason : "unavailable";
            if (signal.aborted) return;
            console.warn(`[chat] Groq request failed on ${model} (${reason}):`, err instanceof Error ? err.message : err);
            if (started) {
              // The reply was cut off: mark it, so it isn't saved or spoken as a complete answer.
              send({ type: "error", message: "The connection to the AI provider was interrupted." });
              send({ type: "done", meta: { ...meta, interrupted: true } });
              return;
            }
            if (reason === "rate-limit" && attempt < models.length - 1) continue;
            await runDemo(reason);
            return;
          }
        }
      } catch (err) {
        if (!signal.aborted) {
          console.error("[chat] unexpected error", err);
          send({ type: "error", message: "Something went wrong." });
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      cancelled.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

import { getServerEnv } from "@/lib/server/env";
import { GroqError, groqSpeech } from "@/lib/server/groq";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Optional server text-to-speech (Groq Orpheus, preview). Client falls back to browser voices on any error. */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "tts"), 150).ok) return Response.json({ error: "Too many requests" }, { status: 429 });
  const env = getServerEnv();
  if (env.provider !== "groq" || !env.apiKey || !env.ttsModel) {
    return Response.json({ error: "Server text-to-speech is not configured." }, { status: 503 });
  }
  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    /* handled below */
  }
  if (!text) return Response.json({ error: "No text" }, { status: 400 });
  // Orpheus accepts up to 200 characters per request; the client sends sentence-sized chunks.
  text = text.slice(0, 200);

  try {
    const res = await groqSpeech({ apiKey: env.apiKey, model: env.ttsModel, voice: env.ttsVoice, text, signal: AbortSignal.timeout(15000) });
    return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type") ?? "audio/wav", "Cache-Control": "no-store" } });
  } catch (err) {
    const reason = err instanceof GroqError ? err.reason : "unavailable";
    console.warn(`[tts] failed (${reason})`, err instanceof Error ? err.message : err);
    return Response.json({ error: "Speech synthesis failed", reason }, { status: 502 });
  }
}

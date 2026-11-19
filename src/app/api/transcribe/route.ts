import { getServerEnv } from "@/lib/server/env";
import { GroqError, groqTranscribe } from "@/lib/server/groq";
import { clientKey, rateLimit, readBody } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Speech-to-text fallback for browsers without built-in speech recognition.
 * Audio is forwarded to Groq Whisper and is not stored.
 */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "stt"), 30).ok) return Response.json({ error: "Too many requests" }, { status: 429 });
  const env = getServerEnv();
  if (env.provider !== "groq" || !env.apiKey) {
    return Response.json({ error: "Server speech-to-text needs a Groq API key." }, { status: 503 });
  }
  // Read with a byte cap (works without Content-Length), then parse the multipart body.
  const raw = await readBody(req, MAX_BYTES + 64 * 1024);
  if (!raw) return Response.json({ error: "Recording too long" }, { status: 413 });
  let form: FormData;
  try {
    form = await new Response(raw as BodyInit, { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "No audio received" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Recording too long" }, { status: 413 });
  if (!/^audio\/|^video\/webm/.test(file.type || "audio/webm")) return Response.json({ error: "Unsupported audio type" }, { status: 415 });

  const ext = file.type.includes("mp4") ? "m4a" : file.type.includes("ogg") ? "ogg" : file.type.includes("wav") ? "wav" : "webm";
  try {
    const text = await groqTranscribe({ apiKey: env.apiKey, model: env.sttModel, file, filename: `speech.${ext}`, signal: AbortSignal.timeout(20000) });
    return Response.json({ text });
  } catch (err) {
    const reason = err instanceof GroqError ? err.reason : "unavailable";
    console.warn(`[transcribe] failed (${reason})`, err instanceof Error ? err.message : err);
    return Response.json({ error: "Transcription failed", reason }, { status: 502 });
  }
}

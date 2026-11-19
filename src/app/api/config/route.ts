import { getServerEnv, publicConfig } from "@/lib/server/env";
import { GroqError, groqListModels } from "@/lib/server/groq";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GROQ_MODEL ("x")` and `GROQ_VOICE_MODEL ("y")`, for messages. */
const describe = (models: { name: string; id: string }[]) => models.map((m) => `${m.name} ("${m.id}")`).join(" and ");

/** Public, secret-free view of the server's AI configuration. `?check=1` verifies the Groq key and models. */
export async function GET(req: Request) {
  const env = getServerEnv();
  const config = publicConfig(env);
  const url = new URL(req.url);
  if (url.searchParams.get("check") !== "1") return Response.json(config);

  if (!rateLimit(clientKey(req, "config-check"), 10).ok) {
    return Response.json({ ...config, check: { ok: false, error: "Too many checks, try again shortly." } });
  }
  if (!env.apiKey) {
    return Response.json({ ...config, check: { ok: false, error: "No Groq API key configured — running in demo mode." } });
  }
  if (env.provider !== "groq") {
    return Response.json({ ...config, check: { ok: false, error: "AI_PROVIDER is set to demo, so the Groq key isn't used. Remove it (or set it to groq) to use Groq." } });
  }
  try {
    const available = await groqListModels({ apiKey: env.apiKey, signal: AbortSignal.timeout(8000) });
    // Chat and voice conversations can use different models; both must be available.
    const required = [{ name: "GROQ_MODEL", id: env.model }, ...(env.voiceModel !== env.model ? [{ name: "GROQ_VOICE_MODEL", id: env.voiceModel }] : [])];
    const missing = required.filter((m) => !available.includes(m.id));
    // Speech models are optional extras with their own fallbacks: reported, but they don't fail the check.
    const optional = [{ name: "GROQ_STT_MODEL", id: env.sttModel }, ...(env.ttsModel ? [{ name: "GROQ_TTS_MODEL", id: env.ttsModel }] : [])];
    const missingOptional = optional.filter((m) => !available.includes(m.id));
    const ok = missing.length === 0;
    return Response.json({
      ...config,
      check: {
        ok,
        modelAvailable: available.includes(env.model),
        voiceModelAvailable: available.includes(env.voiceModel),
        error: ok
          ? undefined
          : missing.length === 1
            ? `${describe(missing)} isn't available for this key. Set it to a supported model.`
            : `${describe(missing)} aren't available for this key. Set them to supported models.`,
        warning: missingOptional.length ? `${describe(missingOptional)} ${missingOptional.length === 1 ? "isn't" : "aren't"} available for this key, so the app falls back to browser speech.` : undefined,
      },
    });
  } catch (err) {
    const reason = err instanceof GroqError ? err.reason : "network";
    const messages: Record<string, string> = {
      auth: "Groq rejected the API key. Check GROQ_API_KEY.",
      "rate-limit": "Groq rate limit reached. Try again shortly.",
      network: "Couldn't reach Groq. Check your internet connection.",
      timeout: "Groq didn't respond in time.",
    };
    return Response.json({ ...config, check: { ok: false, error: messages[reason] ?? "Groq is unavailable right now." } });
  }
}

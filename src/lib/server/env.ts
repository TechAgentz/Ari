import "server-only";
import type { ProviderId, ServerConfig } from "../types";

/** Server-only configuration. The Groq API key never leaves the server. */
export interface ServerEnv {
  provider: ProviderId;
  requestedProvider: string;
  apiKey?: string;
  model: string;
  voiceModel: string;
  sttModel: string;
  ttsModel?: string;
  ttsVoice: string;
  timeoutMs: number;
  /** Model to retry with when the primary model is rate-limited (separate per-model quota). */
  fallbackModelFor: (model: string) => string | undefined;
  /** TRUST_PROXY=1: a reverse proxy sets X-Forwarded-For, so it can identify clients. */
  trustProxy: boolean;
}

const GPT_OSS_PAIR: Record<string, string> = {
  "openai/gpt-oss-120b": "openai/gpt-oss-20b",
  "openai/gpt-oss-20b": "openai/gpt-oss-120b",
};

const DEFAULT_MODEL = "openai/gpt-oss-120b";

export function getServerEnv(): ServerEnv {
  const apiKey = process.env.GROQ_API_KEY?.trim() || undefined;
  const requestedProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const provider: ProviderId = requestedProvider === "demo" ? "demo" : apiKey ? "groq" : "demo";
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const timeout = Number.parseInt(process.env.GROQ_TIMEOUT_MS ?? "", 10);
  const fallbackSetting = process.env.GROQ_FALLBACK_MODEL?.trim();
  return {
    provider,
    requestedProvider: requestedProvider || (apiKey ? "groq" : "demo"),
    apiKey,
    model,
    voiceModel: process.env.GROQ_VOICE_MODEL?.trim() || model,
    sttModel: process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo",
    ttsModel: process.env.GROQ_TTS_MODEL?.trim() || undefined,
    ttsVoice: process.env.GROQ_TTS_VOICE?.trim() || "hannah",
    timeoutMs: Number.isFinite(timeout) && timeout > 1000 ? timeout : 20000,
    fallbackModelFor: (m: string) => {
      if (fallbackSetting === "none") return undefined;
      const candidate = fallbackSetting || GPT_OSS_PAIR[m];
      return candidate && candidate !== m ? candidate : undefined;
    },
    trustProxy: /^(1|true|yes)$/i.test(process.env.TRUST_PROXY?.trim() ?? ""),
  };
}

export function publicConfig(env = getServerEnv()): ServerConfig & { requestedProvider: string; misconfigured: boolean } {
  const groq = env.provider === "groq" && !!env.apiKey;
  return {
    provider: env.provider,
    requestedProvider: env.requestedProvider,
    misconfigured: env.requestedProvider === "groq" && !env.apiKey,
    model: groq ? env.model : "scripted-demo",
    voiceModel: groq ? env.voiceModel : "scripted-demo",
    groqConfigured: groq,
    stt: groq,
    tts: groq && !!env.ttsModel,
    ttsVoice: groq && env.ttsModel ? env.ttsVoice : undefined,
  };
}

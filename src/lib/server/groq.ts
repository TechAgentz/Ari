import "server-only";

const BASE_URL = "https://api.groq.com/openai/v1";

export class GroqError extends Error {
  constructor(
    public status: number,
    public reason: "auth" | "rate-limit" | "bad-request" | "unavailable" | "timeout" | "network",
    message: string,
  ) {
    super(message);
  }
}

function classify(status: number): GroqError["reason"] {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate-limit";
  if (status === 400 || status === 404 || status === 422) return "bad-request";
  return "unavailable";
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

const isReasoningModel = (model: string) => model.startsWith("openai/gpt-oss");

/**
 * Streams a chat completion from Groq's OpenAI-compatible endpoint and yields
 * content deltas. Reasoning output is excluded for gpt-oss models.
 */
export async function* streamGroqChat(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessageInput[];
  signal: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}): AsyncGenerator<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
    temperature: opts.temperature ?? 0.7,
    max_completion_tokens: opts.maxTokens ?? 700,
  };
  if (isReasoningModel(opts.model)) {
    body.include_reasoning = false;
    body.reasoning_effort = "low";
  }

  const send = (payload: Record<string, unknown>) =>
    fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });

  let res: Response;
  try {
    res = await send(body);
    // Defensive: if the reasoning parameters are rejected, retry once without them.
    if (res.status === 400 && isReasoningModel(opts.model)) {
      const message = await readError(res);
      if (/reasoning/i.test(message)) {
        delete body.include_reasoning;
        delete body.reasoning_effort;
        res = await send(body);
      } else {
        throw new GroqError(400, "bad-request", message);
      }
    }
  } catch (err) {
    if (err instanceof GroqError) throw err;
    if (opts.signal.aborted) throw new GroqError(408, "timeout", "Request timed out or was cancelled");
    throw new GroqError(0, "network", err instanceof Error ? err.message : "Network error");
  }

  if (!res.ok || !res.body) {
    throw new GroqError(res.status, classify(res.status), await readError(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string | null } }[];
            error?: { message?: string };
          };
          if (json.error) throw new GroqError(500, "unavailable", json.error.message ?? "Stream error");
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch (e) {
          if (e instanceof GroqError) throw e;
          // ignore malformed keep-alive lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function groqTranscribe(opts: { apiKey: string; model: string; file: Blob; filename: string; signal: AbortSignal }) {
  const form = new FormData();
  form.append("file", opts.file, opts.filename);
  form.append("model", opts.model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: form,
    signal: opts.signal,
  });
  if (!res.ok) throw new GroqError(res.status, classify(res.status), await readError(res));
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

export async function groqSpeech(opts: { apiKey: string; model: string; voice: string; text: string; signal: AbortSignal }) {
  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: opts.model, voice: opts.voice, input: opts.text, response_format: "wav" }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new GroqError(res.status, classify(res.status), await readError(res));
  return res;
}

export async function groqListModels(opts: { apiKey: string; signal: AbortSignal }): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    signal: opts.signal,
  });
  if (!res.ok) throw new GroqError(res.status, classify(res.status), await readError(res));
  const json = (await res.json()) as { data?: { id: string }[] };
  return (json.data ?? []).map((m) => m.id);
}

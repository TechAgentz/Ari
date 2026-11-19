"use client";

/**
 * Text-to-speech queue. Speaks sentence-sized chunks as they stream in.
 * Engines: the browser's built-in voices, or Groq Orpheus via /api/tts
 * (falls back to the browser automatically on any error).
 */

const PREFERRED_VOICE_HINTS = [
  "natural",
  "neural",
  "premium",
  "enhanced",
  "samantha",
  "google us english",
  "google uk english female",
  "aria",
  "jenny",
  "serena",
  "karen",
  "moira",
  "daniel",
];

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferredName?: string): SpeechSynthesisVoice | undefined {
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en-US").slice(0, 2).toLowerCase();
  const sameLang = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  const pool = sameLang.length ? sameLang : voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const hint of PREFERRED_VOICE_HINTS) {
    const match = pool.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  return pool.find((v) => v.default) ?? pool[0] ?? voices[0];
}

/** Resolves once voices are loaded (Chrome loads them asynchronously). */
export function voicesReady(timeout = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve([]);
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener?.("voiceschanged", done);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, timeout);
    synth.addEventListener?.("voiceschanged", done, { once: true });
  });
}

export interface SpeakerOptions {
  engine: "browser" | "groq";
  voiceName?: string;
  rate: number;
  onStart: () => void;
  onEnd: () => void;
  onEngineFallback?: (reason: string) => void;
}

export class Speaker {
  private queue: string[] = [];
  private ended = false;
  private cancelled = false;
  private started = false;
  private busy = false;
  private engine: "browser" | "groq";
  private keep: SpeechSynthesisUtterance[] = [];
  private audio: HTMLAudioElement | null = null;
  private prefetch = new Map<string, Promise<string | null>>();
  private objectUrls: string[] = [];
  private finished = false;

  constructor(private opts: SpeakerOptions) {
    this.engine = opts.engine;
  }

  enqueue(text: string) {
    if (this.cancelled || !text.trim()) return;
    this.queue.push(text);
    if (this.engine === "groq") this.prefetchAudio(text);
    void this.pump();
  }

  /** No more text is coming; onEnd fires once everything queued has been spoken. */
  end() {
    this.ended = true;
    void this.pump();
  }

  /** Stops speaking now and drops anything queued; onStart and onEnd won't fire afterwards. */
  cancel() {
    this.cancelled = true;
    this.queue = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
    }
    this.objectUrls.forEach((u) => URL.revokeObjectURL(u));
    this.objectUrls = [];
    this.keep = [];
  }

  private markStarted() {
    if (!this.started && !this.cancelled) {
      this.started = true;
      this.opts.onStart();
    }
  }

  private finish() {
    if (this.finished || this.cancelled) return;
    this.finished = true;
    this.objectUrls.forEach((u) => URL.revokeObjectURL(u));
    this.objectUrls = [];
    this.keep = [];
    this.opts.onEnd();
  }

  private async pump() {
    if (this.busy || this.cancelled) return;
    this.busy = true;
    try {
      while (this.queue.length && !this.cancelled) {
        const next = this.queue.shift()!;
        if (this.engine === "groq") {
          const ok = await this.playServer(next);
          if (!ok && !this.cancelled) await this.playBrowser(next);
        } else {
          await this.playBrowser(next);
        }
      }
    } finally {
      this.busy = false;
    }
    if (this.ended && !this.queue.length && !this.cancelled) this.finish();
  }

  private playBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        this.markStarted();
        return resolve();
      }
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(synth.getVoices(), this.opts.voiceName);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.rate = this.opts.rate;
      u.pitch = 1;
      this.keep.push(u); // prevent Chrome from garbage-collecting the utterance mid-speech
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearInterval(keepAlive);
        clearTimeout(guard);
        resolve();
      };
      u.onstart = () => this.markStarted();
      u.onend = done;
      u.onerror = done;
      // Chrome pauses long speech after ~15s; nudging resume keeps it going.
      const keepAlive = setInterval(() => {
        if (synth.speaking && !synth.paused) {
          synth.pause();
          synth.resume();
        }
      }, 10000);
      // Safety net in case onend never fires.
      const guard = setTimeout(done, Math.max(4000, text.length * 120));
      synth.resume();
      synth.speak(u);
      if (!synth.getVoices().length) this.markStarted();
    });
  }

  private prefetchAudio(text: string) {
    if (this.prefetch.has(text)) return;
    this.prefetch.set(
      text,
      fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
        .then(async (res) => {
          if (!res.ok) throw new Error(`TTS ${res.status}`);
          const url = URL.createObjectURL(await res.blob());
          this.objectUrls.push(url);
          return url;
        })
        .catch(() => null),
    );
  }

  private async playServer(text: string): Promise<boolean> {
    this.prefetchAudio(text);
    const url = await this.prefetch.get(text)!;
    if (this.cancelled) return true;
    if (!url) {
      this.engine = "browser";
      this.opts.onEngineFallback?.("Server voice unavailable — using the browser voice instead.");
      return false;
    }
    return new Promise((resolve) => {
      const audio = this.audio ?? new Audio();
      this.audio = audio;
      audio.src = url;
      audio.playbackRate = Math.min(1.5, Math.max(0.75, this.opts.rate));
      audio.onplay = () => this.markStarted();
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });
  }
}

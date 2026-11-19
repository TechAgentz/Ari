"use client";

/**
 * Speech-to-text.
 * 1. Browser speech recognition (Chrome, Edge, Safari) with live interim transcripts.
 * 2. Fallback: record with MediaRecorder and transcribe on the server (Groq Whisper).
 */

// Minimal typings for the Web Speech API (not in TypeScript's DOM lib).
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecordAudio(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export interface ListenerHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string, message: string) => void;
  onSpeechStart?: () => void;
  onLevel?: (level: number) => void;
  onProcessing?: () => void;
}

export interface SpeechListener {
  start(): void;
  /** Stop and deliver what was heard so far. */
  finish(): void;
  /** Stop and discard. */
  abort(): void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings to talk by voice.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser. You can type instead.",
  "audio-capture": "No microphone was found. Check that one is connected.",
  network: "The browser's speech service couldn't be reached. Check your connection or type instead.",
  "language-not-supported": "Speech recognition doesn't support your language setting.",
};

/** Browser speech recognition with end-of-turn detection on a short pause. */
export class BrowserListener implements SpeechListener {
  private rec: SpeechRecognitionLike | null = null;
  private active = false;
  private finalText = "";
  private interimText = "";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private delivered = false;

  constructor(
    private handlers: ListenerHandlers,
    private lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US",
    private pauseMs = 1300,
  ) {}

  start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return this.handlers.onError("unsupported", "Speech recognition isn't available in this browser.");
    this.active = true;
    this.delivered = false;
    this.finalText = "";
    this.interimText = "";
    this.spawn(Ctor);
  }

  private spawn(Ctor: SpeechRecognitionCtor) {
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onspeechstart = () => this.handlers.onSpeechStart?.();
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finalText += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      this.interimText = interim;
      this.handlers.onInterim(`${this.finalText}${interim}`.trim());
      this.armSilenceTimer();
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // handled by onend restart
      this.active = false;
      this.clearTimer();
      this.handlers.onError(e.error, ERROR_MESSAGES[e.error] ?? `Speech recognition error (${e.error}).`);
    };
    rec.onend = () => {
      this.rec = null;
      if (!this.active) return;
      const heard = `${this.finalText}${this.interimText}`.trim();
      if (heard) this.deliver();
      else this.spawn(Ctor); // keep listening through silence timeouts
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      // "already started" race — ignore
    }
  }

  private armSilenceTimer() {
    this.clearTimer();
    this.silenceTimer = setTimeout(() => this.finish(), this.pauseMs);
  }

  private clearTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private deliver() {
    if (this.delivered) return;
    this.delivered = true;
    this.active = false;
    this.clearTimer();
    const text = `${this.finalText}${this.interimText}`.replace(/\s+/g, " ").trim();
    this.handlers.onFinal(text);
  }

  finish() {
    if (!this.active) return;
    const heard = `${this.finalText}${this.interimText}`.trim();
    if (!heard) return;
    this.deliver();
    try {
      this.rec?.stop();
    } catch {
      /* ignore */
    }
  }

  abort() {
    this.active = false;
    this.delivered = true;
    this.clearTimer();
    try {
      this.rec?.abort();
    } catch {
      /* ignore */
    }
    this.rec = null;
  }
}

/** getUserMedia failure → listener error code. */
function micErrorCode(err: unknown): "audio-capture" | "not-allowed" {
  const name = (err as { name?: string } | null)?.name;
  return name === "NotFoundError" || name === "OverconstrainedError" ? "audio-capture" : "not-allowed";
}

/** Records audio and transcribes it on the server; stops automatically after a pause. */
export class RecorderListener implements SpeechListener {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private raf = 0;
  private aborted = false;
  private heardSpeech = false;
  private silentSince = 0;
  private startedAt = 0;
  private request: AbortController | null = null;

  constructor(
    private handlers: ListenerHandlers,
    private transcribeTimeoutMs = 30000,
  ) {}

  async start() {
    this.aborted = false;
    this.heardSpeech = false;
    this.chunks = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      // Ended, muted or switched to typing while the permission prompt was open: nothing to report.
      if (this.aborted) return;
      const code = micErrorCode(err);
      return this.handlers.onError(code, ERROR_MESSAGES[code]);
    }
    this.stream = stream;
    if (this.aborted) return this.cleanup();
    try {
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
      this.recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.recorder.onstop = () => void this.upload();
      this.recorder.start(250);
    } catch {
      this.cleanup();
      return this.handlers.onError("unsupported", "Recording isn't supported in this browser.");
    }
    this.startedAt = performance.now();
    this.handlers.onInterim("Listening… (recording)");
    this.monitor();
  }

  private monitor() {
    if (!this.stream) return;
    try {
      this.ctx = new AudioContext();
      const source = this.ctx.createMediaStreamSource(this.stream);
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        this.handlers.onLevel?.(Math.min(1, rms * 6));
        const now = performance.now();
        if (rms > 0.035) {
          if (!this.heardSpeech) this.handlers.onSpeechStart?.();
          this.heardSpeech = true;
          this.silentSince = now;
        } else if (this.heardSpeech && now - this.silentSince > 1500) {
          return this.finish();
        }
        if (now - this.startedAt > 30000) return this.finish();
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } catch {
      /* level meter optional — user can tap to send */
    }
  }

  finish() {
    cancelAnimationFrame(this.raf);
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
  }

  private async upload() {
    const type = this.recorder?.mimeType || "audio/webm";
    const blob = new Blob(this.chunks, { type });
    this.cleanup(); // the microphone is released before anything is sent
    if (this.aborted) return;
    if (!this.heardSpeech || blob.size < 2000) {
      this.handlers.onFinal("");
      return;
    }
    this.handlers.onProcessing?.();
    const request = new AbortController();
    this.request = request;
    const timer = setTimeout(() => request.abort(), this.transcribeTimeoutMs);
    try {
      const form = new FormData();
      form.append("audio", blob, "speech");
      const res = await fetch("/api/transcribe", { method: "POST", body: form, signal: request.signal });
      const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Transcription failed.");
      if (!this.aborted) this.handlers.onFinal(json.text ?? "");
    } catch (err) {
      if (this.aborted) return;
      const message = request.signal.aborted ? "Transcription took too long." : err instanceof Error ? err.message : "Transcription failed.";
      this.handlers.onError("transcribe", message);
    } finally {
      clearTimeout(timer);
      this.request = null;
    }
  }

  private cleanup() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  abort() {
    this.aborted = true;
    this.request?.abort();
    const recorder = this.recorder;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    this.cleanup();
  }
}

/** Optional microphone level meter for the browser-recognition path (visual only). */
export class LevelMeter {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private raf = 0;
  /** Bumped by every start() and stop(); a start() that was overtaken releases what it opened. */
  private gen = 0;
  constructor(private onLevel: (level: number) => void) {}

  /** Starts (or restarts) the meter. Safe to call repeatedly; a stop() during the permission prompt wins. */
  async start() {
    this.release();
    const gen = ++this.gen;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      if (gen === this.gen) this.onLevel(0);
      return;
    }
    if (gen !== this.gen) {
      // Stopped or restarted while the permission prompt was open.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (gen !== this.gen) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        this.onLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } catch {
      this.stop();
    }
  }

  /** Releases the microphone, the audio context and the animation loop (including a pending start). */
  stop() {
    this.gen++;
    this.release();
    this.onLevel(0);
  }

  private release() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

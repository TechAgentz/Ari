"use client";

import { openingMessage } from "../agent/demo-engine";
import { streamReply, usesRemoteAI } from "../agent/client";
import { assessRisk } from "../safety/crisis";
import type { ChatMessage, Conversation, MessageMeta, SafetyCategory, ServerConfig, Settings } from "../types";
import { titleFromMessage, uid } from "../utils";
import { BrowserListener, LevelMeter, RecorderListener, canRecordAudio, getRecognitionCtor, type ListenerHandlers, type SpeechListener } from "./recognition";
import { Speaker, voicesReady } from "./speaker";
import { MAX_CHECK_INS, checkInMessage } from "./check-in";
import { createSentenceChunker } from "./text";

export type VoiceStatus = "idle" | "starting" | "listening" | "transcribing" | "thinking" | "speaking" | "muted" | "ended" | "error";
export type InputMode = "browser" | "server" | "text";

export interface VoiceSnapshot {
  status: VoiceStatus;
  messages: ChatMessage[];
  interim: string;
  streaming: string;
  streamingMeta: MessageMeta | null;
  error: string | null;
  notice: string | null;
  micMuted: boolean;
  speakerOn: boolean;
  inputMode: InputMode;
  conversationId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  /** Distress or crisis came up in this session: keep support details on screen. */
  crisis: boolean;
  /** Crisis categories seen in this session (e.g. "abuse"), so the screen can show matching helplines. */
  crisisCategories: SafetyCategory[];
}

interface Deps {
  getSettings: () => Settings;
  getConfig: () => ServerConfig | null;
  persist: (conv: Conversation) => void;
  onLevel?: (level: number) => void;
}

/**
 * Groq speech services (Whisper speech-to-text, Orpheus voices) are used only when AI replies are,
 * so offline demo mode never sends audio or conversation text to Groq.
 */
export function serverVoiceAllowed(settings: Settings | null | undefined, config: ServerConfig | null): boolean {
  return !!settings && usesRemoteAI(settings, config);
}

/** The voice engine replies will actually use: Groq Orpheus only when chosen, configured and allowed. */
export function voiceEngine(settings: Settings, config: ServerConfig | null): "browser" | "groq" {
  return settings.voice.engine === "groq" && !!config?.tts && serverVoiceAllowed(settings, config) ? "groq" : "browser";
}

/** Whether recordings could be transcribed by Groq Whisper if AI replies were on. */
function serverSttAvailable(config: ServerConfig | null): boolean {
  return !!config?.stt && canRecordAudio();
}

/**
 * How the user's turns are captured. Without `settings` (proof that AI replies are allowed),
 * recordings are never sent to the server.
 */
export function detectInputMode(config: ServerConfig | null, settings?: Settings): InputMode {
  const whisper = serverSttAvailable(config) && serverVoiceAllowed(settings, config);
  // Whisper is far more reliable than built-in recognisers on phones (iOS especially) and with accents,
  // so it's the default whenever it may be used; the browser's recogniser is the fallback.
  if (whisper && settings?.voice.recognition !== "browser") return "server";
  if (getRecognitionCtor()) return "browser";
  if (whisper) return "server";
  return "text";
}

function typingNotice(config: ServerConfig | null): string {
  return serverSttAvailable(config)
    ? "This browser has no built-in speech recognition, and recordings are only sent to Groq Whisper when smart replies are on. You can type your replies and Ari will still speak."
    : "Voice input isn't supported in this browser — you can type your replies and Ari will still speak.";
}

/**
 * Drives a turn-based voice conversation:
 * listen → (user pauses) → think → speak → listen …
 * Supports mic mute, speaker mute, interrupting the companion, and ending the session.
 * The microphone is only open while it's the user's turn to speak.
 */
export class VoiceController {
  private snap: VoiceSnapshot;
  private listeners = new Set<() => void>();
  private listener: SpeechListener | null = null;
  private speaker: Speaker | null = null;
  private abort: AbortController | null = null;
  private meter: LevelMeter | null = null;
  private createdAt = 0;
  /** A reply is still streaming in. */
  private inFlight = false;
  /** Bumped by start() and end(), so async work from an earlier session can tell it's stale. */
  private session = 0;
  /** Silence timer while listening; Ari checks in when it fires. */
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Check-ins in a row with no reply from the user. */
  private checkIns = 0;

  constructor(private deps: Deps) {
    const settings = deps.getSettings();
    this.snap = {
      status: "idle",
      messages: [],
      interim: "",
      streaming: "",
      streamingMeta: null,
      error: null,
      notice: null,
      micMuted: false,
      speakerOn: settings.voice.output,
      inputMode: "text",
      conversationId: null,
      startedAt: null,
      endedAt: null,
      crisis: false,
      crisisCategories: [],
    };
  }

  // ── external store plumbing ──
  getSnapshot = () => this.snap;
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  private set(patch: Partial<VoiceSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }
  private get active() {
    return this.snap.status !== "idle" && this.snap.status !== "ended";
  }

  // ── lifecycle ──
  async start() {
    if (this.active) return;
    const session = ++this.session;
    const settings = this.deps.getSettings();
    const config = this.deps.getConfig();
    const inputMode = detectInputMode(config, settings);
    const opening = openingMessage("voice");
    const first: ChatMessage = { id: uid("m_"), role: "assistant", content: opening.text, createdAt: Date.now(), meta: opening.meta };
    this.createdAt = Date.now();
    this.set({
      status: "starting",
      messages: [first],
      conversationId: uid("c_"),
      startedAt: Date.now(),
      endedAt: null,
      error: null,
      notice: inputMode === "text" ? typingNotice(config) : null,
      inputMode,
      interim: "",
      streaming: "",
      streamingMeta: null,
      crisis: false,
      crisisCategories: [],
    });
    this.checkIns = 0;
    this.save();
    await voicesReady();
    // Ended (End, or leaving the page), restarted, or already answered by typing while voices loaded.
    if (session !== this.session || this.snap.status !== "starting") return;
    this.speak(opening.text, () => this.listen());
  }

  end() {
    this.session++;
    this.stopReply();
    this.stopListening();
    this.set({ status: this.snap.messages.length > 1 ? "ended" : "idle", endedAt: Date.now(), interim: "" });
    this.save();
  }

  dispose() {
    if (this.active) this.end();
    else {
      this.session++;
      this.stopListening();
    }
    this.listeners.clear();
  }

  // ── controls ──
  toggleMic() {
    if (this.snap.inputMode === "text") return; // typed replies: the microphone isn't in use
    const muted = !this.snap.micMuted;
    const status = this.snap.status;
    this.set({ micMuted: muted });
    if (muted) {
      // A finished recording that's being transcribed is still delivered (its mic is already closed);
      // the next turn starts muted.
      if (status === "transcribing") return;
      this.stopListening();
      if (status === "listening" || status === "error") this.set({ status: "muted", interim: "", error: null });
    } else if (status === "muted") {
      this.listen();
    }
  }

  toggleSpeaker() {
    const on = !this.snap.speakerOn;
    this.set({ speakerOn: on });
    if (on) return;
    // Silence the reply whatever its stage (starting, thinking or speaking); the text stays on screen.
    const speaker = this.speaker;
    this.speaker = null;
    if (!speaker) return;
    speaker.cancel();
    const status = this.snap.status;
    if (this.inFlight) {
      // Still streaming: respond() hands the floor back once the text is complete.
      if (status === "speaking") this.set({ status: "thinking" });
    } else if (status === "speaking" || status === "thinking" || status === "starting") {
      // Speech was all that was left: carry on as if it had finished.
      this.abort = null;
      this.listen();
    }
  }

  /** Try the microphone again (e.g. after granting permission). */
  retryMic() {
    if (!this.active) return;
    const config = this.deps.getConfig();
    const inputMode = detectInputMode(config, this.deps.getSettings());
    this.set({ inputMode, error: null, micMuted: false, notice: inputMode === "text" ? typingNotice(config) : this.snap.notice });
    this.listen();
  }

  /** Switch to typed replies for the rest of the session. */
  useTyping() {
    if (!this.active) return;
    this.stopListening();
    const status = this.snap.status;
    this.set({ inputMode: "text", error: null, interim: "", status: status === "error" || status === "muted" || status === "transcribing" ? "listening" : status });
  }

  /** Stop the companion mid-reply and hand the floor back to the user. */
  interrupt() {
    if (this.snap.status !== "speaking" && this.snap.status !== "thinking") return;
    this.stopReply();
    this.listen();
  }

  /** Finish the user's turn now (instead of waiting for the pause). */
  sendNow() {
    this.listener?.finish();
  }

  /** Typed input (fallback, or by preference). */
  sendText(text: string) {
    const clean = text.trim();
    if (!clean || !this.active) return;
    // Typing takes the floor: stop any reply and release the mic until it's the user's turn again.
    this.stopReply();
    this.stopListening();
    this.handleUserTurn(clean, "text");
  }

  // ── internals ──
  /** Stop recognition or recording and the level meter, releasing the microphone. */
  private stopListening() {
    this.clearSilence();
    this.listener?.abort();
    this.listener = null;
    this.meter?.stop();
  }

  /** Stop the reply in progress (stream and speech), keeping any text already shown. */
  private stopReply() {
    this.abort?.abort();
    this.abort = null;
    this.inFlight = false;
    this.speaker?.cancel();
    this.speaker = null;
    if (this.snap.streaming.trim()) this.commitPartial();
    if (this.snap.streaming || this.snap.streamingMeta) this.set({ streaming: "", streamingMeta: null });
  }

  private listen() {
    if (!this.active) return;
    this.stopListening();
    if (this.snap.inputMode === "text") return this.set({ status: "listening", interim: "" });
    if (this.snap.micMuted) return this.set({ status: "muted", interim: "" });
    const config = this.deps.getConfig();
    if (this.snap.inputMode === "server" && !serverVoiceAllowed(this.deps.getSettings(), config)) {
      // AI replies were switched off mid-session: recordings must not go to Groq any more.
      return this.set({ inputMode: "text", status: "listening", interim: "", notice: typingNotice(config) });
    }

    let listener: SpeechListener | null = null;
    // Ignore callbacks from a listener that was replaced or aborted, or that outlived the session.
    const current = () => listener !== null && this.listener === listener && this.active;
    const handlers: ListenerHandlers = {
      onInterim: (t) => {
        if (!current()) return;
        if (t.trim()) this.clearSilence(); // they're talking
        this.set({ interim: t });
      },
      onSpeechStart: () => {
        if (current()) this.clearSilence();
      },
      onFinal: (t) => {
        if (!current()) return;
        this.listener = null;
        this.meter?.stop();
        if (!t.trim()) return this.listen();
        this.handleUserTurn(t, "voice");
      },
      onError: (code, message) => {
        if (!current()) return;
        this.listener = null;
        this.meter?.stop();
        if (code === "network" || code === "unsupported" || code === "service-not-allowed" || code === "transcribe") {
          // Degrade gracefully to typing.
          this.set({ inputMode: "text", status: "listening", interim: "", notice: `${message} Switched to typing.` });
          return;
        }
        this.set({ status: "error", error: message, interim: "" });
      },
      onLevel: this.deps.onLevel,
      onProcessing: () => {
        if (current()) this.set({ status: "transcribing", interim: "Transcribing…" });
      },
    };
    if (this.snap.inputMode === "browser") {
      listener = new BrowserListener(handlers, undefined, this.turnPauseMs());
      // Visual mic level (skipped on iOS where a second mic stream can interfere).
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (!ios && this.deps.onLevel) {
        this.meter = this.meter ?? new LevelMeter(this.deps.onLevel);
        void this.meter.start();
      }
    } else {
      listener = new RecorderListener(handlers, undefined, this.turnPauseMs());
    }
    this.listener = listener;
    this.set({ status: "listening", interim: "", error: null });
    void listener.start();
    this.armSilence(listener);
  }

/**
   * How long a pause ends the user's turn. After a reflective or emotional question people
   * often pause mid-thought, so Ari waits longer before replying; light chat keeps a brisk pace.
   */
  private turnPauseMs(): number {
    const lastAri = [...this.snap.messages].reverse().find((m) => m.role === "assistant");
    const reflective = ["reflect-explore", "reflect-only", "comfort", "summarize", "safety", "ask-permission"];
    if (this.snap.crisis || (lastAri?.meta?.strategy && reflective.includes(lastAri.meta.strategy)) || lastAri?.meta?.safety) return 2200;
    return 1400;
  }

  private clearSilence() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  /** If the user stays quiet, Ari gently checks in (at most MAX_CHECK_INS times in a row). */
  private armSilence(listener: SpeechListener) {
    this.clearSilence();
    const { checkIns, checkInSeconds } = this.deps.getSettings().voice;
    if (!checkIns || this.checkIns >= MAX_CHECK_INS) return;
    const ms = Math.min(30, Math.max(4, checkInSeconds || 8)) * 1000;
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      if (this.listener !== listener || this.snap.status !== "listening" || this.snap.interim.trim()) return;
      this.checkIn();
    }, ms);
  }

  private checkIn() {
    if (!this.active) return;
    this.stopListening();
    this.checkIns += 1;
    const { text, meta } = checkInMessage(this.snap.messages, this.checkIns, this.snap.crisis);
    const msg: ChatMessage = { id: uid("m_"), role: "assistant", content: text, createdAt: Date.now(), meta };
    this.set({ messages: [...this.snap.messages, msg], interim: "", status: "speaking" });
    this.save();
    this.speak(text, () => this.listen());
  }

  /** Remember that distress or crisis came up (never cleared within a session). */
  private safetyPatch(flag: boolean, categories: SafetyCategory[] = []): Pick<VoiceSnapshot, "crisis" | "crisisCategories"> {
    const known = this.snap.crisisCategories;
    const added = categories.filter((c) => !known.includes(c));
    return { crisis: this.snap.crisis || flag || added.length > 0, crisisCategories: added.length ? [...known, ...added] : known };
  }

  private handleUserTurn(text: string, via: "voice" | "text") {
    this.stopListening(); // the mic stays closed while Ari thinks and speaks
    this.checkIns = 0;
    const userMsg: ChatMessage = { id: uid("m_"), role: "user", content: text, createdAt: Date.now(), meta: { via } };
    const messages = [...this.snap.messages, userMsg];
    const risk = assessRisk(text);
    this.set({ messages, interim: "", status: "thinking", ...this.safetyPatch(risk.level !== "none", risk.categories) });
    this.save();
    void this.respond(messages);
  }

  private async respond(messages: ChatMessage[]) {
    const abort = new AbortController();
    this.abort = abort;
    this.inFlight = true;
    const session = this.session;
    const settings = this.deps.getSettings();
    let speaker: Speaker | null = null;
    let streamDone = false;

    const afterSpeech = () => {
      if (this.speaker === speaker) this.speaker = null;
      if (streamDone && this.abort === abort) {
        this.abort = null;
        this.listen();
      }
    };

    if (this.snap.speakerOn) {
      speaker = this.makeSpeaker(settings, afterSpeech);
      this.speaker = speaker;
    }
    // Only the current speaker gets text: Voice off or an interruption silences the rest of the reply.
    const chunker = createSentenceChunker((s) => {
      if (speaker && this.speaker === speaker) speaker.enqueue(s);
    }, this.chunkLimit(settings));

    let acc = "";
    const result = await streamReply({
      messages,
      mode: "voice",
      settings,
      config: this.deps.getConfig(),
      signal: abort.signal,
      onMeta: (meta) => {
        if (session !== this.session) return;
        const safety = this.safetyPatch(meta.safety === "crisis" || meta.safety === "distress", meta.safetyCategories);
        this.set(this.abort === abort ? { streamingMeta: meta, ...safety } : safety);
      },
      onDelta: (d) => {
        acc += d;
        if (this.abort !== abort) return;
        this.set({ streaming: acc });
        chunker.push(d);
      },
    });

    if (this.abort === abort) this.inFlight = false;
    if (abort.signal.aborted || this.abort !== abort) return; // interrupted or ended — handled elsewhere

    // A reply cut off by a provider failure: drop the unfinished sentence and say so, instead of speaking a fragment.
    const cutOff = !!result.meta.interrupted;
    if (cutOff) speaker?.enqueue("Sorry, I lost my connection for a moment. Could you say that again?");
    else chunker.flush();
    streamDone = true;
    const assistant: ChatMessage = {
      id: uid("m_"),
      role: "assistant",
      content: cutOff ? `${result.text.trim()}…` : result.text.trim(),
      createdAt: Date.now(),
      meta: cutOff ? { ...result.meta, via: "voice", questionId: undefined, techniqueGiven: undefined } : { ...result.meta, via: "voice" },
    };
    this.set({
      messages: [...this.snap.messages, assistant],
      streaming: "",
      streamingMeta: null,
      notice: result.meta.fallback ? "Groq was unavailable, so Ari answered in offline mode." : this.snap.notice,
      ...this.safetyPatch(result.meta.safety === "crisis" || result.meta.safety === "distress", result.meta.safetyCategories),
    });
    this.save();

    if (speaker && this.speaker === speaker) {
      speaker.end(); // → afterSpeech once everything has been spoken
    } else {
      // Voice output off (or switched off mid-reply): hand the floor back right away.
      this.abort = null;
      this.listen();
    }
  }

  private chunkLimit(settings: Settings) {
    return voiceEngine(settings, this.deps.getConfig()) === "groq" ? 180 : 400;
  }

  private makeSpeaker(settings: Settings, onDone: () => void): Speaker {
    const speaker: Speaker = new Speaker({
      // Groq voices only when AI replies are allowed: offline mode never sends reply text to Groq.
      engine: voiceEngine(settings, this.deps.getConfig()),
      voiceName: settings.voice.voiceName,
      rate: settings.voice.rate,
      onStart: () => {
        if (this.speaker === speaker && this.active && this.snap.status !== "muted") this.set({ status: "speaking" });
      },
      onEnd: onDone,
      onEngineFallback: (reason) => {
        if (this.speaker === speaker) this.set({ notice: reason });
      },
    });
    return speaker;
  }

  private speak(text: string, then: () => void) {
    if (!this.snap.speakerOn) return then();
    const settings = this.deps.getSettings();
    const speaker = this.makeSpeaker(settings, () => {
      if (this.speaker === speaker) {
        this.speaker = null;
        then();
      }
    });
    this.speaker = speaker;
    const chunker = createSentenceChunker((s) => speaker.enqueue(s), this.chunkLimit(settings));
    chunker.push(text);
    chunker.flush();
    speaker.end();
  }

  private commitPartial() {
    const partial = this.snap.streaming.trim();
    if (!partial) return;
    const msg: ChatMessage = {
      id: uid("m_"),
      role: "assistant",
      content: `${partial}…`,
      createdAt: Date.now(),
      meta: { ...(this.snap.streamingMeta ?? {}), interrupted: true, via: "voice", topic: undefined, techniqueOffered: undefined, questionId: undefined, techniqueGiven: undefined },
    };
    this.set({ messages: [...this.snap.messages, msg], streaming: "" });
    this.save();
  }

  private save() {
    const { conversationId, messages } = this.snap;
    if (!conversationId || messages.length < 2) return; // don't store sessions where the user never spoke
    const firstUser = messages.find((m) => m.role === "user");
    this.deps.persist({
      id: conversationId,
      mode: "voice",
      title: firstUser ? titleFromMessage(firstUser.content, assessRisk(firstUser.content).level !== "none") : "Voice conversation",
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      messages,
    });
  }
}

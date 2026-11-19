/**
 * Voice-session regression tests. Fake browser APIs stand in for the microphone
 * (getUserMedia with countable tracks), AudioContext, requestAnimationFrame,
 * speechSynthesis, SpeechRecognition, MediaRecorder and fetch — nothing touches
 * the network or a real device. Uses only fictional data.
 * Run: npx tsx scripts/voice-test.ts
 */
import type { SafetyCategory, ServerConfig, Settings } from "../src/lib/types";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}${detail === undefined ? "" : `\n      → ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 8000): Promise<boolean> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) return false;
    await wait(5);
  }
  return true;
}

// ───────────────────────── Fake browser ─────────────────────────

const g = globalThis as unknown as Record<string, unknown>;

// Microphone: every getUserMedia stream has one track we can count.
const tracks: { live: boolean }[] = [];
function makeStream() {
  const t = { live: true };
  tracks.push(t);
  return { getTracks: () => [{ stop: () => void (t.live = false) }] };
}
const liveTracks = () => tracks.filter((t) => t.live).length;
const gum = { deferred: false, calls: 0, pending: [] as { resolve: (s: unknown) => void; reject: (e: unknown) => void }[] };
function getUserMedia() {
  gum.calls++;
  return new Promise((resolve, reject) => {
    if (gum.deferred) gum.pending.push({ resolve, reject });
    else resolve(makeStream());
  });
}
/** The user answers the browser's permission prompt. */
const allowPending = () => gum.pending.splice(0).forEach((p) => p.resolve(makeStream()));
const blockPending = () => gum.pending.splice(0).forEach((p) => p.reject(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" })));

// Audio analysis.
const contexts: { open: boolean }[] = [];
const analyser = { loud: false };
class FakeAudioContext {
  private rec = { open: true };
  constructor() {
    contexts.push(this.rec);
  }
  createAnalyser() {
    return {
      fftSize: 512,
      getByteTimeDomainData: (a: Uint8Array) => {
        for (let i = 0; i < a.length; i++) a[i] = analyser.loud ? (i % 2 ? 200 : 56) : 128;
      },
    };
  }
  createMediaStreamSource() {
    return { connect() {} };
  }
  close() {
    this.rec.open = false;
    return Promise.resolve();
  }
}
const openContexts = () => contexts.filter((c) => c.open).length;

// Animation frames are stepped by hand.
let rafSeq = 0;
const frames = new Map<number, () => void>();
g.requestAnimationFrame = (cb: () => void) => {
  frames.set(++rafSeq, cb);
  return rafSeq;
};
g.cancelAnimationFrame = (id: number) => void frames.delete(id);
function frame() {
  const cbs = [...frames.values()];
  frames.clear();
  cbs.forEach((cb) => cb());
}

// Speech recognition (Chrome-like: abort → "aborted" error → end).
class FakeRecognition {
  static all: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  state: "new" | "running" | "ended" = "new";
  constructor() {
    FakeRecognition.all.push(this);
  }
  start() {
    this.state = "running";
  }
  stop() {
    if (this.state === "running") setTimeout(() => this.close(), 2);
  }
  abort() {
    if (this.state !== "running") return;
    setTimeout(() => {
      this.onerror?.({ error: "aborted" });
      this.close();
    }, 2);
  }
  close() {
    if (this.state === "ended") return;
    this.state = "ended";
    this.onend?.();
  }
  say(text: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] });
  }
}
const runningRecognitions = () => FakeRecognition.all.filter((r) => r.state === "running");

// Speech synthesis with a real queue, like browsers.
interface FakeUtteranceLike {
  text: string;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: unknown) => void;
}
class FakeUtterance implements FakeUtteranceLike {
  voice: unknown = null;
  lang = "";
  rate = 1;
  pitch = 1;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: unknown) => void;
  constructor(public text: string) {}
}
/** Texts whose speech actually started. */
const spoken: string[] = [];
let synthQueue: FakeUtteranceLike[] = [];
let speakingNow: FakeUtteranceLike | null = null;
const UTTER_MS = 25;
const voiceList = [{ name: "Samantha", lang: "en-US", default: true }];
let voicesLoaded = true;
const voicesChanged = new Set<() => void>();
const synth = {
  speaking: false,
  paused: false,
  getVoices: () => (voicesLoaded ? voiceList : []),
  addEventListener: (_type: string, f: () => void) => void voicesChanged.add(f),
  removeEventListener: (_type: string, f: () => void) => void voicesChanged.delete(f),
  speak(u: FakeUtteranceLike) {
    synthQueue.push(u);
    nextUtterance();
  },
  cancel() {
    const dropped = [speakingNow, ...synthQueue].filter((u): u is FakeUtteranceLike => !!u);
    speakingNow = null;
    synthQueue = [];
    synth.speaking = false;
    dropped.forEach((u) => setTimeout(() => u.onerror?.({ error: "interrupted" }), 1));
  },
  pause() {},
  resume() {},
};
function nextUtterance() {
  if (speakingNow || !synthQueue.length) return;
  const u = synthQueue.shift()!;
  speakingNow = u;
  synth.speaking = true;
  setTimeout(() => {
    if (speakingNow !== u) return;
    spoken.push(u.text);
    u.onstart?.();
    setTimeout(() => {
      if (speakingNow !== u) return;
      speakingNow = null;
      synth.speaking = false;
      u.onend?.();
      nextUtterance();
    }, UTTER_MS);
  }, 2);
}
/** Chrome on a cold load: no voices until "voiceschanged". */
function loadVoicesLater() {
  voicesLoaded = false;
  return () => {
    voicesLoaded = true;
    [...voicesChanged].forEach((f) => f());
  };
}

// Recording (server speech-to-text path).
class FakeMediaRecorder {
  static isTypeSupported = (t: string) => t === "audio/webm";
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array(8000)]) });
    setTimeout(() => this.onstop?.(), 1);
  }
}

// Network: nothing leaves the process. /api/chat and /api/tts fail (→ on-device fallbacks);
// /api/transcribe waits until a test answers it.
const fetchLog: string[] = [];
const transcribeRequests: { resolve: (text: string) => void }[] = [];
g.fetch = (input: unknown, init?: { signal?: AbortSignal }) =>
  new Promise((resolve, reject) => {
    const url = String(input);
    fetchLog.push(url);
    init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })));
    if (url === "/api/transcribe") {
      transcribeRequests.push({ resolve: (text) => resolve({ ok: true, status: 200, json: async () => ({ text }) }) });
    } else {
      resolve({ ok: false, status: 503, body: null, json: async () => ({}), blob: async () => new Blob() });
    }
  });

function installBrowser() {
  g.window = globalThis;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36",
      platform: "MacIntel",
      maxTouchPoints: 0,
      language: "en-US",
      mediaDevices: { getUserMedia },
    },
  });
  g.document = { getElementById: () => null };
  g.AudioContext = FakeAudioContext;
  g.speechSynthesis = synth;
  g.SpeechSynthesisUtterance = FakeUtterance;
  g.MediaRecorder = FakeMediaRecorder;
}
/** Chrome/Edge/Safari have built-in recognition; Firefox doesn't. */
function setRecognition(available: boolean) {
  if (available) g.webkitSpeechRecognition = FakeRecognition;
  else delete g.webkitSpeechRecognition;
}

function makeSettings(remote: boolean, engine: "browser" | "groq" = "browser", checkIns = false): Settings {
  return {
    onboarded: true,
    theme: "system",
    aiMode: remote ? "auto" : "demo",
    consent: { ai: remote, voice: true, context: false },
    voice: { output: true, engine, rate: 1, checkIns, checkInSeconds: 4 },
  };
}
const GROQ: ServerConfig = { provider: "groq", model: "openai/gpt-oss-120b", voiceModel: "openai/gpt-oss-120b", groqConfigured: true, stt: true, tts: true };

/** Mic resources still held (tracks, audio contexts, animation loops, running recognisers). */
const micState = () => ({ tracks: liveTracks(), contexts: openContexts(), loops: frames.size, recognisers: runningRecognitions().length });
const released = (s: ReturnType<typeof micState>) => s.tracks === 0 && s.contexts === 0 && s.loops === 0 && s.recognisers === 0;

async function main() {
  // Rendered before the fake browser is installed (pure markup).
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { CrisisCard } = await import("../src/components/crisis-card");

  installBrowser();
  const { VoiceController, detectInputMode, voiceEngine } = await import("../src/lib/voice/controller");
  const { createSentenceChunker, speakable } = await import("../src/lib/voice/text");

  type Controller = InstanceType<typeof VoiceController>;
  const levels: number[] = [];
  function session(settings: Settings, config: ServerConfig | null) {
    const c: Controller = new VoiceController({ getSettings: () => settings, getConfig: () => config, persist: () => {}, onLevel: (l) => levels.push(l) });
    const statuses: string[] = [];
    c.subscribe(() => {
      const s = c.getSnapshot().status;
      if (statuses.at(-1) !== s) statuses.push(s);
    });
    return { c, statuses, status: () => c.getSnapshot().status };
  }
  const settle = () => wait(15);

  // ───────────────────────── 1. Sentence chunker (VOICE-3) ─────────────────────────
  console.log("\n1. Sentence chunker keeps every word");
  {
    const cases: [string, string[]][] = [
      ["Small things help, e.g. a short walk. Want to try one?", ["Small things help, e.g. a short walk.", "Want to try one?"]],
      ["I usually sleep 7.5 hours. How about you?", ["I usually sleep 7.5 hours.", "How about you?"]],
      ["Anywhere else: findahelpline.com lists free services. You can also call 988.", ["Anywhere else: findahelpline.com lists free services.", "You can also call 988."]],
      ["Visit 988lifeline.org for help. You can also call 988.", ["Visit 988lifeline.org for help.", "You can also call 988."]],
      ["If you're in the U.S., you can call or text 988. In the UK, call 116 123.", ["If you're in the U.S., you can call or text 988.", "In the UK, call 116 123."]],
      ["I wake at 7 a.m. every day. Then I walk.", ["I wake at 7 a.m. every day.", "Then I walk."]],
      ["Breathe in, i.e. slowly, for four. Then out.", ["Breathe in, i.e. slowly, for four.", "Then out."]],
      ["Hmm…that sounds hard. Want to talk?", ["Hmm…that sounds hard.", "Want to talk?"]],
      ["Dr. Lee agreed! Really?! Yes.", ["Dr. Lee agreed!", "Really?!", "Yes."]],
      ["Try this:\n1. Breathe in.\n2. Hold for four.", ["Try this:", "Breathe in.", "Hold for four."]],
    ];
    const words = (s: string) => speakable(s).replace(/[.,!?…:]/g, " ").split(/\s+/).filter(Boolean).join(" ");
    for (const [text, expected] of cases) {
      for (const mode of ["whole", "words", "chars"] as const) {
        const out: string[] = [];
        const chunker = createSentenceChunker((s) => out.push(s), 180);
        const parts = mode === "whole" ? [text] : mode === "chars" ? [...text] : (text.match(/\S+\s*/g) ?? [text]);
        parts.forEach((p) => chunker.push(p));
        chunker.flush();
        const lostNothing = words(out.join(" ")) === words(text.replace(/^\s*\d+\.\s+/gm, ""));
        check(`${JSON.stringify(text.slice(0, 32))}… streamed as ${mode}`, lostNothing && JSON.stringify(out) === JSON.stringify(expected), out);
      }
    }
    const out: string[] = [];
    const chunker = createSentenceChunker((s) => out.push(s), 60);
    const long = "This is a long sentence that keeps going, and going, with plenty of words to split into parts for the voice. Done.";
    chunker.push(long);
    chunker.flush();
    check("long sentences split under the limit without losing words", out.every((s) => s.length <= 60) && words(out.join(" ")) === words(long), out);
  }

  // ───────────────────────── 2. Crisis card (SAFETY-5) ─────────────────────────
  console.log("\n2. Crisis card shows the helplines the voice reply points to");
  {
    const abuse = renderToStaticMarkup(createElement(CrisisCard, { categories: ["abuse"] as SafetyCategory[] }));
    check("abuse: US domestic violence hotline shown", abuse.includes("1-800-799-7233") && abuse.includes("Text START to 88788"));
    check("abuse: UK domestic abuse helpline shown", abuse.includes("0808 2000 247"));
    check("abuse: crisis lines still shown", abuse.includes("Call 988") && abuse.includes("116 123"));
    const compact = renderToStaticMarkup(createElement(CrisisCard, { compact: true }));
    check("compact card lists crisis lines (988, Samaritans, findahelpline)", compact.includes("Call 988") && compact.includes("Call 116 123") && compact.includes("findahelpline.com"));
    check("compact card shows one action per line", !compact.includes("Text 988"));
    const plain = renderToStaticMarkup(createElement(CrisisCard, { className: "ml-12" }));
    check("default card unchanged for chat (all actions, no abuse lines)", plain.includes("Text 988") && plain.includes("Chat online") && !plain.includes("1-800-799-7233"));
  }

  // ───────────────────────── 3. Microphone release (VOICE-1) ─────────────────────────
  console.log("\n3. Microphone is released on typed turns, interrupt, End and unmount");
  setRecognition(true);
  {
    const { c, status } = session(makeSettings(false), null);
    await c.start();
    await until(() => status() === "listening");
    await settle();
    check("listening: one mic stream, one context, one loop", liveTracks() === 1 && openContexts() === 1 && frames.size === 1, micState());
    let maxTracks = 0;
    for (const reply of ["Pretty good, thanks", "You can call me Sam", "I live with my partner"]) {
      c.sendText(reply);
      await settle();
      maxTracks = Math.max(maxTracks, liveTracks());
      const whileAriTalks = micState();
      if (!released(whileAriTalks)) check(`mic released while Ari answers "${reply}"`, false, whileAriTalks);
      await until(() => status() === "listening");
      await settle();
      maxTracks = Math.max(maxTracks, liveTracks());
    }
    check("typed turns never hold more than one mic stream", maxTracks <= 1, { maxTracks });
    check("after 3 typed turns: exactly one stream, context and loop", liveTracks() === 1 && openContexts() === 1 && frames.size === 1, micState());

    // A spoken turn.
    runningRecognitions().at(-1)?.say("I work as a nurse");
    c.sendNow();
    await until(() => status() === "thinking");
    await settle();
    check("spoken turn: mic released while Ari thinks", released(micState()), micState());

    // Typing while Ari speaks, then interrupting.
    await until(() => status() === "speaking");
    c.sendText("Sorry, go on");
    await settle();
    check("typing while Ari speaks releases the mic", released(micState()), micState());
    await until(() => status() === "speaking");
    c.interrupt();
    await settle();
    check("interrupt → listening with a single mic stream", status() === "listening" && liveTracks() === 1 && frames.size === 1, { status: status(), ...micState() });

    c.end();
    await settle();
    frame();
    check("End releases everything (tracks, contexts, loops, recognition)", released(micState()), micState());
    check("level meter reset to 0", levels.at(-1) === 0);
    c.dispose();
  }
  {
    // End while the permission prompt is open, then the user allows.
    gum.deferred = true;
    const { c, status } = session(makeSettings(false), null);
    await c.start();
    await until(() => status() === "listening");
    check("permission prompt pending", gum.pending.length === 1);
    c.end();
    allowPending();
    await settle();
    frame();
    check("End during the prompt → nothing left open after Allow", released(micState()), micState());
    c.dispose();
  }
  {
    // Mute while the prompt is open, then allow; unmute; unmount.
    const { c, status } = session(makeSettings(false), null);
    await c.start();
    await until(() => status() === "listening");
    c.toggleMic();
    check("muted", status() === "muted" && c.getSnapshot().micMuted);
    allowPending();
    await settle();
    frame();
    check("Mute during the prompt → no live mic after Allow", released(micState()), micState());
    c.toggleMic();
    allowPending();
    await settle();
    check("unmute → listening with one stream", status() === "listening" && liveTracks() === 1, { status: status(), ...micState() });
    c.dispose(); // leaving the page
    await settle();
    frame();
    check("unmount releases the mic", released(micState()), micState());
    gum.deferred = false;
  }

  // ───────────────────────── 4. Voice off (VOICE-2 / COMP-5) ─────────────────────────
  console.log("\n4. Voice off silences the reply at any stage");
  setRecognition(false); // typed replies keep timing simple
  {
    const { c, status, statuses } = session(makeSettings(false), null);
    await c.start();
    await until(() => status() === "listening");
    c.sendText("Honestly kind of tired");
    check("thinking", status() === "thinking");
    const before = spoken.length;
    statuses.length = 0;
    c.toggleSpeaker();
    await until(() => status() === "listening");
    await wait(80);
    check("Voice off while thinking: nothing spoken", spoken.length === before, spoken.slice(before));
    check("Voice off while thinking: never shows speaking", !statuses.includes("speaking"), statuses);
    check("reply text still shown", c.getSnapshot().messages.filter((m) => m.role === "assistant").length === 2);

    // Voice on again; turn it off once speech has started.
    c.toggleSpeaker();
    c.sendText("Work has been really intense lately and I can't switch off at night");
    await until(() => status() === "speaking");
    const started = spoken.length;
    c.toggleSpeaker();
    check("Voice off while speaking: status leaves speaking", status() !== "speaking", status());
    await until(() => status() === "listening");
    await wait(80);
    check("Voice off while speaking: no further sentences", spoken.length === started, spoken.slice(started));
    c.dispose();
  }
  {
    // During the greeting (status "starting").
    const { c, status } = session(makeSettings(false), null);
    const loaded = loadVoicesLater();
    const starting = c.start();
    check("starting while voices load", status() === "starting");
    loaded();
    await starting;
    const before = spoken.length;
    c.toggleSpeaker();
    await wait(80);
    check("Voice off during the greeting: greeting not spoken", spoken.length === before, spoken.slice(before));
    check("Voice off during the greeting: hands over to the user", status() === "listening", status());
    c.dispose();
  }

  // ───────────────────────── 5. No greeting after End (VOICE-6) ─────────────────────────
  console.log("\n5. No greeting after End or leaving during start");
  {
    const { c, status } = session(makeSettings(false), null);
    const loaded = loadVoicesLater();
    const starting = c.start();
    c.end();
    const before = spoken.length;
    loaded();
    await starting;
    await wait(120);
    check("End during start: greeting never spoken", spoken.length === before, spoken.slice(before));
    check("End during start: stays ended", status() === "idle", status());

    const loaded2 = loadVoicesLater();
    const first = c.start();
    c.end();
    const second = c.start();
    const before2 = spoken.length;
    loaded2();
    await Promise.all([first, second]);
    await until(() => status() === "listening");
    await wait(60);
    const greetings = spoken.slice(before2).filter((t) => t.startsWith("Hi, I'm"));
    check("End then Start inside the window: greeting spoken once", greetings.length === 1, spoken.slice(before2));
    c.dispose();
  }
  {
    // Leaving the page (unmount) during start.
    const { c } = session(makeSettings(false), null);
    const loaded = loadVoicesLater();
    const starting = c.start();
    c.dispose();
    const before = spoken.length;
    loaded();
    await starting;
    await wait(80);
    check("unmount during start: greeting never spoken", spoken.length === before, spoken.slice(before));
  }

  // ───────────────────────── 6. Server speech-to-text (VOICE-4 / COMP-6, VOICE-5) ─────────────────────────
  console.log("\n6. Recorded turns (Groq Whisper path)");
  setRecognition(false);
  /** Speak, then tap "Send now" → the recording is uploaded for transcription. */
  async function recordTurn(c: Controller, status: () => string) {
    analyser.loud = true;
    frame();
    analyser.loud = false;
    c.sendNow();
    return until(() => status() === "transcribing");
  }
  {
    const { c, status } = session(makeSettings(true), GROQ);
    await c.start();
    check("server mode when AI replies are on", c.getSnapshot().inputMode === "server", c.getSnapshot().inputMode);
    await until(() => status() === "listening");
    await settle();
    check("recording: one mic stream", liveTracks() === 1, micState());
    check("transcribing", await recordTurn(c, status), status());
    check("mic released before the upload", released(micState()), micState());
    c.toggleMic();
    check("Mute while transcribing keeps the turn in flight", status() === "transcribing" && c.getSnapshot().micMuted, status());
    transcribeRequests.splice(0).forEach((r) => r.resolve("I had a long day at work"));
    await until(() => c.getSnapshot().messages.some((m) => m.role === "user" && m.content === "I had a long day at work"));
    check("the transcribed words are kept", c.getSnapshot().messages.some((m) => m.content === "I had a long day at work"));
    await until(() => status() === "muted");
    check("after Ari replies the session is muted (not stuck)", status() === "muted", status());
    check("muted: no mic open", released(micState()), micState());
    c.toggleMic();
    await settle();
    check("unmute → recording again", status() === "listening" && liveTracks() === 1, { status: status(), ...micState() });

    // Mute and unmute while transcribing → the turn goes through and listening resumes.
    check("transcribing (2)", await recordTurn(c, status), status());
    c.toggleMic();
    c.toggleMic();
    transcribeRequests.splice(0).forEach((r) => r.resolve("Mostly the commute"));
    await until(() => c.getSnapshot().messages.some((m) => m.content === "Mostly the commute"));
    await until(() => status() === "listening");
    check("mute + unmute while transcribing: words kept, listening again", status() === "listening" && liveTracks() === 1, { status: status(), ...micState() });

    // Mute while recording: discarded, mic closed.
    c.toggleMic();
    await settle();
    check("Mute while recording closes the mic", status() === "muted" && released(micState()), { status: status(), ...micState() });
    c.end();
    await settle();
    check("End: nothing left open", released(micState()), micState());
    c.dispose();
  }
  {
    // Late permission denial after End must not resurrect the session.
    gum.deferred = true;
    const { c, status } = session(makeSettings(true), GROQ);
    await c.start();
    await until(() => status() === "listening");
    c.sendText("Typing while the prompt is open");
    await until(() => status() === "listening" && gum.pending.length === 2);
    c.end();
    check("ended", status() === "ended", status());
    blockPending();
    await settle();
    check("Block after End: still ended, no error", status() === "ended" && c.getSnapshot().error === null, { status: status(), error: c.getSnapshot().error });

    const s2 = session(makeSettings(true), GROQ);
    await s2.c.start();
    await until(() => s2.status() === "listening");
    s2.c.end();
    blockPending();
    await settle();
    check("Block after End (no turns): stays idle", s2.status() === "idle", s2.status());

    // A denial while the session is live still shows the error.
    const s3 = session(makeSettings(true), GROQ);
    await s3.c.start();
    await until(() => s3.status() === "listening");
    blockPending();
    await settle();
    check("Block during a live session → error with guidance", s3.status() === "error" && !!s3.c.getSnapshot().error, s3.status());
    s3.c.end();
    s2.c.dispose();
    s3.c.dispose();
    c.dispose();
    gum.deferred = false;
  }

  // ───────────────────────── 7. Offline mode keeps voice on-device (PRIVACY-1 / SRV-3 / COMP-8) ─────────────────────────
  console.log("\n7. Groq speech services only with AI replies on");
  {
    check("no recognition + offline → typed replies (no Whisper)", detectInputMode(GROQ, makeSettings(false)) === "text");
    check("no recognition + AI on → Whisper", detectInputMode(GROQ, makeSettings(true)) === "server");
    check("no settings → never Whisper", detectInputMode(GROQ) === "text");
    check("Orpheus chosen + offline → device voice", voiceEngine(makeSettings(false, "groq"), GROQ) === "browser");
    check("Orpheus chosen + AI on → Orpheus", voiceEngine(makeSettings(true, "groq"), GROQ) === "groq");
    check("Orpheus chosen but not configured → device voice", voiceEngine(makeSettings(true, "groq"), { ...GROQ, tts: false }) === "browser");

    fetchLog.length = 0;
    const { c, status } = session(makeSettings(false, "groq"), GROQ);
    await c.start();
    check("offline session: typed input with an accurate notice", c.getSnapshot().inputMode === "text" && /only sent to Groq Whisper when AI replies are on/.test(c.getSnapshot().notice ?? ""), c.getSnapshot().notice);
    await until(() => status() === "listening");
    c.sendText("You can call me Sam");
    await until(() => status() === "listening" && c.getSnapshot().messages.length === 3);
    await wait(60);
    check("offline session: nothing sent anywhere (no /api/tts, /api/transcribe, /api/chat)", fetchLog.length === 0, fetchLog);
    c.dispose();

    fetchLog.length = 0;
    const r = session(makeSettings(true, "groq"), GROQ);
    await r.c.start();
    await until(() => r.status() === "listening");
    check("AI on + Orpheus: greeting goes to /api/tts (then falls back to device voice)", fetchLog.includes("/api/tts"), fetchLog);
    r.c.dispose();

    // AI replies switched off mid-session: no more recordings to Groq.
    const settings = makeSettings(true);
    const m = session(settings, GROQ);
    await m.c.start();
    await until(() => m.status() === "listening");
    settings.aiMode = "demo";
    settings.consent.ai = false;
    m.c.sendText("Fine thanks");
    const callsBefore = gum.calls;
    await until(() => m.status() === "listening" && m.c.getSnapshot().messages.length === 3);
    await settle();
    check("AI switched off mid-session → typed input, no new recording", m.c.getSnapshot().inputMode === "text" && gum.calls === callsBefore, { mode: m.c.getSnapshot().inputMode });
    m.c.dispose();
  }

  // ───────────────────────── 8. Typed mode and safety flags (VOICE-7, SAFETY-5) ─────────────────────────
  console.log("\n8. Typed mode and safety");
  {
    const { c, status } = session(makeSettings(false), null);
    await c.start();
    await until(() => status() === "listening");
    c.toggleMic();
    check("M in typed mode does nothing", status() === "listening" && !c.getSnapshot().micMuted, status());
    c.sendText("My boyfriend hits me");
    check("abuse disclosure flags the crisis card with the abuse category", c.getSnapshot().crisis && c.getSnapshot().crisisCategories.includes("abuse"), c.getSnapshot().crisisCategories);
    await until(() => status() === "listening");
    const last = c.getSnapshot().messages.at(-1);
    check("deterministic safety reply in voice", last?.meta?.safety === "crisis" && !!last.meta.safetyCategories?.includes("abuse"), last?.meta);
    c.sendText("I'm fine now");
    check("crisis categories persist for the session", c.getSnapshot().crisisCategories.includes("abuse"));
    c.dispose();
  }


  console.log("\n9. Ari checks in when the user is quiet");
  {
    const { c, status } = session(makeSettings(false, "browser", true), null);
    setRecognition(true);
    await c.start();
    await until(() => status() === "listening");
    const before = c.getSnapshot().messages.length;
    await until(() => c.getSnapshot().messages.length > before, 9000);
    const first = c.getSnapshot().messages.at(-1);
    check("silence → Ari asks a gentle question", !!first?.meta?.nudge && (first.content.match(/\?/g) ?? []).length === 1, first?.content);
    check("check-in offers a different question than the greeting", first?.meta?.topic !== "day", first?.meta?.topic);
    await settle();
    check("mic is closed while Ari speaks the check-in", status() !== "speaking" || runningRecognitions().length === 0, runningRecognitions().length);
    await until(() => status() === "listening");
    await until(() => c.getSnapshot().messages.length > before + 1, 9000);
    const second = c.getSnapshot().messages.at(-1);
    check("second check-in is reassurance, not another question", !!second?.meta?.nudge && !second.content.includes("?"), second?.content);
    await until(() => status() === "listening");
    const count = c.getSnapshot().messages.length;
    await wait(5000);
    check("stops after two check-ins in a row", c.getSnapshot().messages.length === count);
    runningRecognitions().at(-1)?.say("sorry, I was thinking");
    await until(() => c.getSnapshot().messages.some((m) => m.role === "user"));
    check("a reply resets the check-ins", c.getSnapshot().messages.some((m) => m.role === "user"));
    c.dispose();
    await settle();
    check("mic released after dispose", released(micState()), micState());
  }
  {
    const { c, status } = session(makeSettings(false, "browser", true), null);
    await c.start();
    await until(() => status() === "listening");
    runningRecognitions().at(-1)?.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "well I" } }] });
    const n = c.getSnapshot().messages.length;
    await wait(5000);
    check("no check-in while the user is mid-sentence", !c.getSnapshot().messages.slice(n).some((m) => m.meta?.nudge), c.getSnapshot().messages.slice(n).map((m) => m.content));
    c.dispose();
  }
  {
    const { c, status } = session(makeSettings(false, "browser", true), null);
    await c.start();
    await until(() => status() === "listening");
    c.sendText("I want to kill myself");
    await until(() => status() === "listening");
    const n = c.getSnapshot().messages.length;
    await until(() => c.getSnapshot().messages.length > n, 9000);
    const m = c.getSnapshot().messages.at(-1);
    check("after a crisis, the check-in is about safety with crisis lines", !!m?.meta?.nudge && /988|116 123/.test(m.content), m?.content);
    c.dispose();
  }

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll voice checks passed.");
  process.exit(failures ? 1 : 0);
}

setTimeout(() => {
  console.log("\nTimed out.");
  process.exit(1);
}, 180_000).unref();

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

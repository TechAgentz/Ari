"use client";

import {
  ChevronDown,
  Hand,
  Home,
  Info,
  Keyboard,
  MessageSquareText,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  ScrollText,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { CompanionAvatar } from "@/components/chat/message-bubble";
import { CrisisCard } from "@/components/crisis-card";
import { ProviderBadge } from "@/components/provider-badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Card } from "@/components/ui/primitives";
import { VoiceConsentDialog } from "@/components/voice-consent";
import { APP } from "@/lib/config";
import { settingsStore, updateSettings, upsertConversation, useHydrated } from "@/lib/storage";
import { getCachedServerConfig, useServerConfig } from "@/lib/use-server-config";
import { cn } from "@/lib/utils";
import { VoiceController, detectInputMode, voiceEngine, type VoiceSnapshot, type VoiceStatus } from "@/lib/voice/controller";
import { canRecordAudio } from "@/lib/voice/recognition";
import { VoiceOrb } from "./voice-orb";

const ORB_ID = "voice-orb-level";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Ready when you are",
  starting: "Starting…",
  listening: "Listening…",
  transcribing: "Transcribing…",
  thinking: "Thinking…",
  speaking: `${APP.companion} is speaking`,
  muted: "Mic muted",
  ended: "Session ended",
  error: "Needs attention",
};

const STATUS_TONE: Record<VoiceStatus, string> = {
  idle: "bg-surface-2 text-fg",
  starting: "bg-surface-2 text-fg",
  listening: "bg-primary-soft text-fg",
  transcribing: "bg-warm-soft text-fg",
  thinking: "bg-warm-soft text-fg",
  speaking: "bg-accent-soft text-fg",
  muted: "bg-surface-3 text-fg",
  ended: "bg-surface-2 text-fg",
  error: "bg-danger-soft text-danger",
};

const STATUS_DOT: Record<VoiceStatus, string> = {
  idle: "bg-subtle",
  starting: "bg-subtle",
  listening: "bg-primary animate-pulse",
  transcribing: "bg-warm",
  thinking: "bg-warm",
  speaking: "bg-accent",
  muted: "bg-subtle",
  ended: "bg-subtle",
  error: "bg-danger",
};

const DESKTOP_MQ = "(min-width: 1024px)";
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** Transcript: a side panel on desktop, a bottom sheet on phones. */
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_MQ).matches,
    () => false,
  );
}

function useElapsed(startedAt: number | null, endedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || endedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, endedAt]);
  if (!startedAt) return "0:00";
  const secs = Math.max(0, Math.floor(((endedAt ?? now) - startedAt) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/** The last sentence or two of Ari's reply, so the caption stays at 2–3 lines. */
function latestSentences(text: string, max = 170) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const parts = clean.match(/[^.!?…]+[.!?…]+["”’)]*\s*|[^.!?…]+$/g) ?? [clean];
  let out = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const next = parts[i] + out;
    if (out && next.trim().length > max) break;
    out = next;
  }
  out = out.trim();
  return out.length > max + 60 ? `…${out.slice(-max)}` : out;
}

function ControlButton({
  label,
  onClick,
  children,
  tone = "neutral",
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "danger" | "primary";
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // A mouse or touch click shouldn't leave focus here, or Space would press this button instead
        // of interrupting. Keyboard activation (detail 0) keeps focus where keyboard users expect it.
        if (e.detail > 0) e.currentTarget.blur();
        onClick();
      }}
      disabled={disabled}
      aria-pressed={tone === "neutral" ? active : undefined}
      className={cn(
        "flex h-[4.5rem] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl px-2 text-[0.9375rem] font-semibold leading-none transition-[background-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 sm:h-20 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0",
        tone === "danger" && "bg-danger-soft text-danger hover:bg-danger hover:text-white dark:hover:text-bg",
        tone === "primary" && "bg-primary text-primary-fg shadow-soft hover:bg-primary-hover hover:shadow-lift",
        tone === "neutral" && (active ? "bg-fg text-bg" : "border border-border-strong bg-surface text-fg hover:bg-surface-2"),
      )}
    >
      {children}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border-strong bg-surface-2 px-1.5 py-0.5 font-sans text-sm text-fg">{children}</kbd>;
}

function TranscriptList({ snap, ref, className }: { snap: VoiceSnapshot; ref?: Ref<HTMLDivElement>; className?: string }) {
  const empty = snap.messages.length === 0 && !snap.streaming && !snap.interim;
  return (
    <div ref={ref} className={cn("scrollbar-thin space-y-4 overflow-y-auto", className)}>
      {empty && <p className="text-base text-muted">Nothing said yet.</p>}
      {snap.messages.map((m) => (
        <div key={m.id} className="flex gap-3">
          {m.role === "assistant" ? (
            <CompanionAvatar size="sm" />
          ) : (
            <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[0.6875rem] font-semibold">
              You
            </span>
          )}
          <p className={cn("min-w-0 text-base leading-relaxed", m.role === "user" ? "text-fg" : "text-muted")}>
            <span className="sr-only">{m.role === "user" ? "You: " : `${APP.companion}: `}</span>
            {m.content}
            {m.meta?.interrupted && <span className="ml-1 text-sm text-subtle">(interrupted)</span>}
          </p>
        </div>
      ))}
      {snap.interim && snap.status === "listening" && (
        <div className="flex gap-3 opacity-70">
          <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[0.6875rem] font-semibold">
            You
          </span>
          <p className="min-w-0 text-base italic leading-relaxed">{snap.interim}…</p>
        </div>
      )}
      {snap.streaming && (
        <div className="flex gap-3">
          <CompanionAvatar size="sm" pulse />
          <p className="min-w-0 text-base leading-relaxed text-muted">{snap.streaming}</p>
        </div>
      )}
    </div>
  );
}

export function VoiceScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-app" aria-busy="true" />;
  return <VoiceSession />;
}

function VoiceSession() {
  const settings = settingsStore.useValue();
  const { config } = useServerConfig();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const [controller] = useState(
    () =>
      new VoiceController({
        getSettings: () => settingsStore.read(),
        getConfig: getCachedServerConfig,
        persist: upsertConversation,
        onLevel: (level) => document.getElementById(ORB_ID)?.style.setProperty("--level", level.toFixed(3)),
      }),
  );
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const elapsed = useElapsed(snap.startedAt, snap.endedAt);

  useEffect(() => () => controller.dispose(), [controller]);

  // Auto-scroll the transcript (also when it is opened).
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [snap.messages.length, snap.streaming, snap.interim, transcriptOpen, isDesktop]);

  const inSession = snap.status !== "idle" && snap.status !== "ended";

  // Keyboard shortcuts: Space = interrupt / send now, M = mute (voice input only).
  // Text fields, buttons and links keep their own keys; control buttons drop focus after a click.
  useEffect(() => {
    if (!inSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable], [role='button'], dialog, summary")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (snap.status === "speaking" || snap.status === "thinking") controller.interrupt();
        else if (snap.status === "listening" && snap.inputMode !== "text") controller.sendNow();
      } else if (e.key.toLowerCase() === "m" && snap.inputMode !== "text") {
        controller.toggleMic();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inSession, snap.status, snap.inputMode, controller]);

  const begin = () => {
    if (!settingsStore.read().consent.voice) return setConsentOpen(true);
    void controller.start();
  };

  const inputModeNow = inSession ? snap.inputMode : detectInputMode(config, settings);
  const canInterrupt = snap.status === "speaking" || snap.status === "thinking";
  const typing = snap.inputMode === "text" || showKeyboard;
  // Groq Whisper/Orpheus are only used when Groq is configured on the server.
  const groqVoice = voiceEngine(settings, config) === "groq";
  const whisperOffline = inputModeNow === "text" && !!config?.stt && canRecordAudio();

  // ───────── Ended: friendly summary ─────────
  if (snap.status === "ended") {
    const exchanges = snap.messages.filter((m) => m.role === "user").length;
    return (
      <div className="mx-auto flex min-h-app w-full max-w-lg flex-col justify-center px-5 py-8 lg:min-h-dvh">
        <Card className="animate-fade-up flex flex-col items-center p-6 text-center sm:p-8">
          <VoiceOrb status="ended" size="sm" />
          <h1 className="mt-3 font-serif text-[1.75rem] font-semibold leading-tight sm:text-3xl">Thanks for talking with {APP.companion}</h1>
          <p className="mt-2 text-base text-muted">
            <span className="tabular-nums">{elapsed}</span> · {exchanges} {exchanges === 1 ? "exchange" : "exchanges"}
          </p>
          <p className="mt-1 text-base text-muted">Your transcript is saved in this browser.</p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <Button size="lg" fullWidth onClick={() => void controller.start()}>
              <Mic className="h-5 w-5" /> Talk again
            </Button>
            {snap.conversationId && exchanges > 0 && (
              <ButtonLink href={`/chat?id=${snap.conversationId}`} variant="secondary" size="lg" fullWidth>
                <ScrollText className="h-5 w-5" /> View transcript
              </ButtonLink>
            )}
            <ButtonLink href="/" variant="ghost" size="lg" fullWidth>
              <Home className="h-5 w-5" /> Home
            </ButtonLink>
          </div>
        </Card>
        {snap.crisis && <CrisisCard categories={snap.crisisCategories} className="mt-6 text-left" />}
      </div>
    );
  }

  // ───────── Idle: calm start screen ─────────
  if (!inSession) {
    return (
      <div className="mx-auto flex min-h-app w-full max-w-lg flex-col items-center justify-center px-5 py-6 text-center sm:py-10 lg:min-h-dvh">
        <div className="animate-fade-up">
          <VoiceOrb status="idle" size="lg" />
        </div>
        <h1 className="mt-2 font-serif text-[1.75rem] font-semibold leading-tight sm:text-4xl">Talk with {APP.companion}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[1.0625rem] leading-relaxed text-muted">
          Speak naturally. Pause when you&apos;re done and {APP.companion} will reply.
        </p>

        <Button size="xl" fullWidth onClick={begin} className="mt-8 max-w-sm shadow-lift">
          <Mic className="h-6 w-6" /> Start talking
        </Button>
        <ButtonLink href="/chat" variant="ghost" className="mt-3">
          <Keyboard className="h-5 w-5" /> Type instead
        </ButtonLink>

        {snap.error && (
          <p role="alert" className="mt-4 w-full rounded-2xl bg-danger-soft px-4 py-3 text-base text-danger">
            {snap.error}
          </p>
        )}

        <details className="group mt-8 w-full rounded-3xl border border-border bg-surface text-left shadow-soft">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-3xl px-5 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
            <Info className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">How voice works</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-3 border-t border-border px-5 pb-5 pt-4 text-base leading-relaxed text-muted">
            <p>
              <strong className="font-semibold text-fg">Microphone:</strong>{" "}
              {inputModeNow === "browser"
                ? "your browser's speech recognition, with live captions."
                : inputModeNow === "server"
                  ? "transcribed by Groq Whisper for accuracy. Your words appear after you pause. You can switch to live browser captions in Settings."
                  : whisperOffline
                    ? `you'll type your replies. This browser has no built-in recognition, and Groq Whisper isn't available right now. ${APP.companion} will still speak.`
                    : `not supported in this browser, so you'll type and ${APP.companion} will still speak. Chrome, Edge or Safari work best.`}
            </p>
            <p>
              <strong className="font-semibold text-fg">Voice:</strong>{" "}
              {groqVoice
                ? `Groq Orpheus. ${APP.companion}'s replies are sent to Groq to be spoken (your device voice is used if that fails).`
                : settings.voice.engine === "groq" && config?.tts
                  ? "your device's built-in voice (Groq Orpheus is only used when it's set up)."
                  : "your device's built-in voice. Change it in Settings."}
            </p>
            <p>
              <strong className="font-semibold text-fg">Keyboard:</strong> press <Kbd>Space</Kbd> to interrupt
              {inputModeNow === "text" ? (
                "."
              ) : (
                <>
                  , <Kbd>M</Kbd> to mute.
                </>
              )}
            </p>
            <p>
              {APP.companion} is a {APP.role} working alongside {APP.careTeam}, not for emergencies.{" "}
              <Link href="/support" className="font-semibold text-danger underline-offset-4 hover:underline">
                Get help now
              </Link>
            </p>
            <div className="pt-1">
              <ProviderBadge mode="voice" />
            </div>
          </div>
        </details>

        <VoiceConsentDialog
          open={consentOpen}
          onClose={() => setConsentOpen(false)}
          onAllow={() => {
            setConsentOpen(false);
            void controller.start();
          }}
        />
      </div>
    );
  }

  // ───────── In session ─────────
  const last = snap.messages.at(-1);
  const ariText = snap.streaming || (last?.role === "assistant" ? last.content : "");
  const caption = ariText ? latestSentences(ariText) : "";
  const listeningByVoice = snap.status === "listening" && snap.inputMode !== "text";

  let yourWords: ReactNode = null;
  if (listeningByVoice) {
    yourWords = snap.interim ? <span className="italic text-fg">&ldquo;{snap.interim}&rdquo;</span> : "Speak whenever you're ready, then pause.";
  } else if (snap.status === "listening") {
    yourWords = "Type your reply below.";
  } else if (snap.status === "muted") {
    yourWords = "Unmute when you're ready to talk.";
  } else if (snap.status === "error") {
    yourWords = <span className="text-danger">{snap.error}</span>;
  } else if (!caption && last?.role === "user") {
    yourWords = <span className="italic text-fg">&ldquo;{last.content}&rdquo;</span>;
  } else if (canInterrupt) {
    yourWords = (
      <>
        Tap Interrupt<span className="hidden lg:inline"> (or press Space)</span> to jump in.
      </>
    );
  }

  const showTypeInstead = !typing && snap.status !== "error";

  const transcriptToggle = (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setTranscriptOpen((v) => !v)}
      aria-expanded={transcriptOpen}
      className="shrink-0 whitespace-nowrap"
      aria-label={transcriptOpen ? "Hide transcript" : "Show transcript"}
    >
      <MessageSquareText className="h-5 w-5" />
      {transcriptOpen ? "Hide" : "Transcript"}
    </Button>
  );

  return (
    <div className="flex h-app flex-col lg:h-dvh lg:flex-row">
      <section aria-label="Voice session" className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top row: status pill, timer, transcript toggle */}
        <div className="flex items-center gap-2 px-5 pt-3 sm:px-6 sm:pt-5">
          <p role="status" aria-live="polite" className={cn("inline-flex h-10 items-center gap-2 min-w-0 whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-semibold", STATUS_TONE[snap.status])}>
            <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[snap.status])} />
            {STATUS_LABEL[snap.status]}
          </p>
          <span className="hidden text-sm tabular-nums text-subtle min-[400px]:inline">
            <span className="sr-only">Time: </span>
            {elapsed}
          </span>
          <div className="ml-auto">{transcriptToggle}</div>
        </div>

        {/* Stage: orb, Ari's caption, your words */}
        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 py-4 text-center">
          <div className="my-auto flex w-full max-w-xl flex-col items-center">
            <VoiceOrb status={snap.status} id={ORB_ID} size="md" />
            <p
              aria-live="polite"
              className={cn(
                "mt-3 min-h-[3.5rem] w-full text-balance font-serif text-[1.375rem] font-medium leading-snug transition-opacity duration-200 sm:text-[1.625rem]",
                listeningByVoice && snap.interim ? "text-muted" : "text-fg",
              )}
            >
              {caption && (
                <>
                  <span className="sr-only">{APP.companion}: </span>
                  {caption}
                </>
              )}
            </p>
            <p className="mt-3 min-h-7 w-full max-w-md text-base leading-relaxed text-muted">{yourWords}</p>

            {snap.notice && <p className="mt-3 w-full max-w-md rounded-2xl bg-warm-soft px-4 py-3 text-base text-fg">{snap.notice}</p>}

            {snap.status === "error" && (
              <div className="mt-4 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <Button size="lg" fullWidth onClick={() => controller.retryMic()}>
                  <RotateCcw className="h-5 w-5" /> Try microphone again
                </Button>
                <Button size="lg" variant="secondary" fullWidth onClick={() => controller.useTyping()}>
                  <Keyboard className="h-5 w-5" /> Type instead
                </Button>
              </div>
            )}

            {/* Helplines stay on screen once distress or crisis comes up (the spoken reply points here). */}
            <div aria-live="polite" className="w-full max-w-md text-left">
              {snap.crisis && <CrisisCard categories={snap.crisisCategories} className="mt-5" />}
            </div>
          </div>
        </div>

        {/* Typing */}
        {typing && (
          <form
            className="mx-auto flex w-full max-w-xl gap-2 px-5 pb-3 sm:px-6"
            onSubmit={(e) => {
              e.preventDefault();
              controller.sendText(typed);
              setTyped("");
            }}
          >
            <label htmlFor="voice-typed" className="sr-only">
              Type a reply
            </label>
            <input
              id="voice-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type a reply…"
              autoComplete="off"
              className="h-14 min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-5 text-base text-fg outline-none placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="lg" disabled={!typed.trim()} aria-label="Send reply" className="!px-5">
              <Send className="h-5 w-5" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        )}

        {/* Control bar */}
        <div className="border-t border-border bg-surface/85 px-5 pb-2 pt-3 backdrop-blur-xl sm:px-6">
          <div className={cn("mx-auto grid max-w-xl gap-3", snap.inputMode !== "text" ? "grid-cols-3" : "grid-cols-2")}>
            {snap.inputMode !== "text" && (
              <ControlButton label={snap.micMuted ? "Unmute" : "Mute"} onClick={() => controller.toggleMic()} active={snap.micMuted}>
                {snap.micMuted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
              </ControlButton>
            )}
            {canInterrupt || snap.inputMode === "text" ? (
              <ControlButton label="Interrupt" onClick={() => controller.interrupt()} tone="primary" disabled={!canInterrupt}>
                <Hand aria-hidden />
              </ControlButton>
            ) : (
              <ControlButton label="Send now" onClick={() => controller.sendNow()} tone="primary" disabled={snap.status !== "listening" || !snap.interim}>
                <Send aria-hidden />
              </ControlButton>
            )}
            <ControlButton label="End" onClick={() => controller.end()} tone="danger">
              <PhoneOff aria-hidden />
            </ControlButton>
          </div>

          {/* More: quieter options */}
          <div className="mx-auto mt-1 flex max-w-xl flex-wrap items-center justify-center gap-x-1">
            <button
              type="button"
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                controller.toggleSpeaker();
                updateSettings((s) => ({ ...s, voice: { ...s.voice, output: !snap.speakerOn } }));
              }}
              aria-pressed={!snap.speakerOn}
              className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {snap.speakerOn ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
              {snap.speakerOn ? "Voice on" : "Voice off"}
            </button>
            {showTypeInstead && (
              <button
                type="button"
                onClick={() => setShowKeyboard(true)}
                className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <Keyboard className="h-5 w-5" aria-hidden /> Type instead
              </button>
            )}
            <span className="hidden items-center gap-1.5 px-3 text-sm text-subtle lg:inline-flex">
              <Kbd>Space</Kbd> interrupt
              {snap.inputMode !== "text" && (
                <>
                  {" "}
                  · <Kbd>M</Kbd> mute
                </>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Transcript: side panel on desktop */}
      {isDesktop && transcriptOpen && (
        <aside aria-label="Transcript" className="flex w-[24rem] shrink-0 flex-col border-l border-border bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
            <div>
              <h2 className="text-lg font-semibold">Transcript</h2>
              <p className="text-sm text-subtle">Saved in this browser</p>
            </div>
            <button
              type="button"
              onClick={() => setTranscriptOpen(false)}
              aria-label="Close transcript"
              className="-mr-2 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <TranscriptList ref={transcriptRef} snap={snap} className="flex-1 px-5 pb-6 pt-2" />
          <p className="border-t border-border px-5 py-3 text-sm text-muted">
            {APP.companion} is a {APP.role}, not a therapist.{" "}
            <Link href="/support" className="font-semibold text-danger underline-offset-4 hover:underline">
              Crisis support
            </Link>
          </p>
        </aside>
      )}

      {/* Transcript: bottom sheet on phones and tablets */}
      <Dialog open={transcriptOpen && !isDesktop} onClose={() => setTranscriptOpen(false)} title="Transcript" description="Saved in this browser.">
        {snap.crisis && <CrisisCard categories={snap.crisisCategories} compact className="mb-4" />}
        <TranscriptList ref={transcriptRef} snap={snap} className="max-h-[55dvh]" />
        <p className="mt-4 border-t border-border pt-3 text-sm text-muted">
          {APP.companion} is a {APP.role}, not a therapist.{" "}
          <Link href="/support" className="font-semibold text-danger underline-offset-4 hover:underline">
            Crisis support
          </Link>
        </p>
      </Dialog>
    </div>
  );
}

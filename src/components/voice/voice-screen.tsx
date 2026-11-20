"use client";

import { Hand, Keyboard, Mic, MicOff, PhoneOff, Send, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CompanionAvatar } from "@/components/chat/message-bubble";
import { CrisisCard } from "@/components/crisis-card";
import { ProviderBadge } from "@/components/provider-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { VoiceConsentDialog } from "@/components/voice-consent";
import { APP } from "@/lib/config";
import { settingsStore, updateSettings, upsertConversation, useHydrated } from "@/lib/storage";
import { getCachedServerConfig, useServerConfig } from "@/lib/use-server-config";
import { cn } from "@/lib/utils";
import { VoiceController, detectInputMode, voiceEngine, type VoiceStatus } from "@/lib/voice/controller";
import { canRecordAudio } from "@/lib/voice/recognition";
import { VoiceOrb } from "./voice-orb";

const ORB_ID = "voice-orb-level";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Ready when you are",
  starting: "Starting…",
  listening: "Listening…",
  transcribing: "Transcribing…",
  thinking: `${APP.companion} is thinking…`,
  speaking: `${APP.companion} is speaking`,
  muted: "Microphone muted",
  ended: "Session ended",
  error: "Something needs attention",
};

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

function ControlButton({
  label,
  onClick,
  children,
  tone = "neutral",
  active = false,
  disabled = false,
  big = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "primary";
  active?: boolean;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          // A mouse or touch click shouldn't leave focus here, or Space would press this button instead
          // of interrupting. Keyboard activation (detail 0) keeps focus where keyboard users expect it.
          if (e.detail > 0) e.currentTarget.blur();
          onClick();
        }}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active || undefined}
        className={cn(
          "flex cursor-pointer items-center justify-center rounded-full shadow-soft transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35",
          big ? "h-16 w-16" : "h-14 w-14",
          tone === "danger" && "bg-danger text-white hover:opacity-90 dark:text-bg",
          tone === "primary" && "bg-primary text-primary-fg hover:bg-primary-hover",
          tone === "neutral" && (active ? "bg-fg text-bg" : "border border-border bg-surface text-fg hover:bg-surface-2"),
        )}
      >
        {children}
      </button>
      <span className="text-xs font-medium text-muted">{label}</span>
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

  // Auto-scroll transcript.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [snap.messages.length, snap.streaming, snap.interim]);

  const inSession = snap.status !== "idle" && snap.status !== "ended";

  // Keyboard shortcuts: Space = interrupt / send now, M = mute (voice input only).
  // Text fields, buttons and links keep their own keys; control buttons drop focus after a click.
  useEffect(() => {
    if (!inSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable], [role='button'], dialog")) return;
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
  // Groq Whisper/Orpheus are only used when AI replies are on (offline mode stays on this device).
  const groqVoice = voiceEngine(settings, config) === "groq";
  const whisperOffline = inputModeNow === "text" && !!config?.stt && canRecordAudio();

  // ───────── Ended: summary ─────────
  if (snap.status === "ended") {
    const exchanges = snap.messages.filter((m) => m.role === "user").length;
    return (
      <div className="mx-auto flex min-h-app max-w-xl flex-col items-center justify-center px-4 py-10 text-center lg:min-h-dvh">
        <VoiceOrb status="ended" />
        <h1 className="mt-4 font-serif text-3xl font-semibold">Thanks for talking with {APP.companion}</h1>
        <p className="mt-2 text-muted">
          {elapsed} · {exchanges} {exchanges === 1 ? "exchange" : "exchanges"} · transcript saved in this browser
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {snap.conversationId && exchanges > 0 && (
            <ButtonLink href={`/chat?id=${snap.conversationId}`} variant="secondary">
              View transcript
            </ButtonLink>
          )}
          <button type="button" onClick={() => void controller.start()} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 font-medium text-primary-fg hover:bg-primary-hover">
            <Mic className="h-4 w-4" /> New voice session
          </button>
          <ButtonLink href="/" variant="ghost">
            Back home
          </ButtonLink>
        </div>
        {snap.crisis && <CrisisCard categories={snap.crisisCategories} className="mt-8 text-left" />}
      </div>
    );
  }

  // ───────── Idle: start screen ─────────
  if (!inSession) {
    return (
      <div className="mx-auto flex min-h-app max-w-2xl flex-col items-center justify-center px-4 py-6 text-center sm:py-10 lg:min-h-dvh">
        <div className="animate-fade-up">
          <VoiceOrb status="idle" />
        </div>
        <h1 className="mt-2 font-serif text-[1.7rem] font-semibold leading-tight sm:text-4xl">Talk it through, out loud</h1>
        <p className="mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted sm:text-base">
          Speak naturally and pause when you&apos;re done — {APP.companion} replies with a calm voice, explains things in plain words, and gently asks a question if you go quiet. You can interrupt, mute or end at any time.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <ProviderBadge mode="voice" />
        </div>
        <button
          type="button"
          onClick={begin}
          className="mt-8 inline-flex h-14 cursor-pointer items-center gap-2.5 rounded-full bg-primary px-8 text-lg font-semibold text-primary-fg shadow-lift transition-all hover:bg-primary-hover active:scale-[0.98]"
        >
          <Mic className="h-5 w-5" /> Start voice session
        </button>
        <Card className="mt-8 w-full p-4 text-left text-sm">
          <ul className="space-y-2 text-muted">
            <li>
              <strong className="font-medium text-fg">Microphone:</strong>{" "}
              {inputModeNow === "browser"
                ? "your browser's speech recognition, with a live transcript."
                : inputModeNow === "server"
                  ? "transcribed by Groq Whisper for accuracy — your words appear after you pause. You can switch to live browser captions in Settings."
                  : whisperOffline
                    ? `typed replies — this browser has no built-in recognition, and recordings only go to Groq Whisper when smart replies are on. ${APP.companion} will still speak.`
                    : `not supported in this browser — you can type, and ${APP.companion} will still speak. Chrome, Edge or Safari work best.`}
            </li>
            <li>
              <strong className="font-medium text-fg">Voice:</strong>{" "}
              {groqVoice
                ? `Groq Orpheus — ${APP.companion}'s replies are sent to Groq to be spoken (falls back to your device voice).`
                : settings.voice.engine === "groq" && config?.tts
                  ? "your device's built-in voice (Groq Orpheus is only used when smart replies are on)."
                  : "your device's built-in voice. Change it in Settings."}
            </li>
            <li>
              <strong className="font-medium text-fg">Tip:</strong> press <kbd className="rounded border border-border bg-surface-2 px-1.5 text-xs">Space</kbd> to interrupt
              {inputModeNow === "text" ? (
                "."
              ) : (
                <>
                  , <kbd className="rounded border border-border bg-surface-2 px-1.5 text-xs">M</kbd> to mute.
                </>
              )}
            </li>
          </ul>
        </Card>
        {snap.error && <p className="mt-4 text-sm text-danger">{snap.error}</p>}
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
  return (
    <div className="flex min-h-app flex-col lg:h-dvh lg:min-h-0 lg:flex-row">
      <section className="flex flex-1 flex-col items-center justify-center px-4 pb-6 pt-6 lg:pb-10">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted">
          <span className="tabular-nums">{elapsed}</span>
          <span aria-hidden>·</span>
          <ProviderBadge mode="voice" />
        </div>
        <VoiceOrb status={snap.status} id={ORB_ID} />
        <p className="mt-1 font-serif text-2xl font-semibold" role="status" aria-live="polite">
          {STATUS_LABEL[snap.status]}
        </p>
        <p className="mt-2 min-h-12 max-w-md text-center text-[0.95rem] leading-relaxed text-muted">
          {snap.status === "listening" && snap.inputMode !== "text" && (snap.interim ? <span className="italic text-fg">“{snap.interim}”</span> : "Speak whenever you're ready, then pause.")}
          {snap.status === "listening" && snap.inputMode === "text" && "Type your reply below."}
          {snap.status === "muted" && "Unmute when you're ready to talk."}
          {canInterrupt && "Tap Interrupt (or press Space) to jump in."}
          {snap.status === "error" && <span className="text-danger">{snap.error}</span>}
        </p>
        {snap.notice && <p className="mt-2 max-w-md rounded-2xl bg-warm-soft px-4 py-2 text-center text-sm text-fg">{snap.notice}</p>}

        {snap.status === "error" && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => controller.retryMic()} className="h-10 cursor-pointer rounded-full bg-primary px-4 text-sm font-medium text-primary-fg">
              Try microphone again
            </button>
            <button type="button" onClick={() => controller.useTyping()} className="h-10 cursor-pointer rounded-full border border-border px-4 text-sm font-medium">
              Type instead
            </button>
          </div>
        )}

        <div className="mt-6 flex items-start justify-center gap-4 sm:gap-6">
          {snap.inputMode !== "text" && (
            <ControlButton label={snap.micMuted ? "Unmute" : "Mute"} onClick={() => controller.toggleMic()} active={snap.micMuted}>
              {snap.micMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </ControlButton>
          )}
          {canInterrupt ? (
            <ControlButton label="Interrupt" onClick={() => controller.interrupt()} tone="primary" big>
              <Hand className="h-7 w-7" />
            </ControlButton>
          ) : (
            snap.inputMode !== "text" && (
              <ControlButton label="Send now" onClick={() => controller.sendNow()} tone="primary" big disabled={snap.status !== "listening" || !snap.interim}>
                <Send className="h-6 w-6" />
              </ControlButton>
            )
          )}
          <ControlButton
            label={snap.speakerOn ? "Voice on" : "Voice off"}
            onClick={() => {
              controller.toggleSpeaker();
              updateSettings((s) => ({ ...s, voice: { ...s.voice, output: !snap.speakerOn } }));
            }}
            active={!snap.speakerOn}
          >
            {snap.speakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </ControlButton>
          <ControlButton label="End" onClick={() => controller.end()} tone="danger">
            <PhoneOff className="h-6 w-6" />
          </ControlButton>
        </div>

        {typing ? (
          <form
            className="mt-6 flex w-full max-w-md gap-2"
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
              className="h-12 flex-1 rounded-full border border-border bg-surface px-4 text-base outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button type="submit" disabled={!typed.trim()} className="h-12 cursor-pointer rounded-full bg-primary px-5 font-medium text-primary-fg disabled:opacity-40">
              Send
            </button>
          </form>
        ) : (
          snap.status !== "error" && (
          <button type="button" onClick={() => setShowKeyboard(true)} className="mt-5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-fg">
            <Keyboard className="h-4 w-4" /> Type instead
          </button>
          )
        )}

        {/* Helplines stay on screen once distress or crisis comes up (the spoken reply points here).
            Small screens: below the controls. Large screens: pinned above the transcript. */}
        <div aria-live="polite" className="w-full max-w-md text-left lg:hidden">
          {snap.crisis && <CrisisCard categories={snap.crisisCategories} className="mt-6" />}
        </div>
      </section>

      {/* Live transcript */}
      <aside className="flex max-h-[50dvh] flex-col border-t border-border bg-surface/70 backdrop-blur-xl lg:max-h-none lg:w-[24rem] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-semibold">Live transcript</h2>
          <span className="text-xs text-subtle">Saved in this browser</span>
        </div>
        <div aria-live="polite" className="scrollbar-thin hidden max-h-[45dvh] shrink-0 overflow-y-auto px-5 lg:block">
          {snap.crisis && <CrisisCard categories={snap.crisisCategories} className="mb-3" />}
        </div>
        <div ref={transcriptRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 pb-6" aria-live="polite">
          {snap.messages.map((m) => (
            <div key={m.id} className="flex gap-2.5">
              {m.role === "assistant" ? <CompanionAvatar size="sm" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold">You</span>}
              <p className={cn("text-sm leading-relaxed", m.role === "user" ? "text-fg" : "text-muted")}>
                {m.content}
                {m.meta?.interrupted && <span className="ml-1 text-xs text-subtle">(interrupted)</span>}
              </p>
            </div>
          ))}
          {snap.interim && snap.status === "listening" && (
            <div className="flex gap-2.5 opacity-70">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold">You</span>
              <p className="text-sm italic leading-relaxed">{snap.interim}…</p>
            </div>
          )}
          {snap.streaming && (
            <div className="flex gap-2.5">
              <CompanionAvatar size="sm" pulse />
              <p className="text-sm leading-relaxed text-muted">{snap.streaming}</p>
            </div>
          )}
        </div>
        <p className="border-t border-border px-5 py-2.5 text-xs text-subtle">
          {APP.companion} is a {APP.role}, not a therapist.{" "}
          <Link href="/support" className="font-medium text-danger hover:underline">
            Crisis support
          </Link>
        </p>
      </aside>
    </div>
  );
}

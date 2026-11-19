"use client";

import { ArrowUp, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VoiceConsentDialog } from "@/components/voice-consent";
import { LIMITS } from "@/lib/config";
import { settingsStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { BrowserListener, getRecognitionCtor } from "@/lib/voice/recognition";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string, via: "text" | "voice") => void;
  onStop: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listenerRef = useRef<BrowserListener | null>(null);
  const [dictating, setDictating] = useState(false);
  const [interim, setInterim] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [canDictate] = useState(() => typeof window !== "undefined" && !!getRecognitionCtor());
  const usedVoice = useRef(false);
  // Latest text, for dictation results that arrive after the user kept typing.
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  useEffect(() => () => listenerRef.current?.abort(), []);

  const submit = () => {
    const text = value.trim();
    if (!text || busy || disabled) return;
    listenerRef.current?.abort();
    setDictating(false);
    onSend(text, usedVoice.current ? "voice" : "text");
    usedVoice.current = false;
  };

  const startDictation = () => {
    setDictationError(null);
    const l = new BrowserListener({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setDictating(false);
        setInterim("");
        if (t) {
          usedVoice.current = true;
          const current = valueRef.current.trimEnd();
          onChange(current ? `${current} ${t}` : t);
        }
        ref.current?.focus();
      },
      onError: (_code, message) => {
        setDictating(false);
        setInterim("");
        setDictationError(message);
      },
    });
    listenerRef.current = l;
    setDictating(true);
    l.start();
  };

  const toggleDictation = () => {
    if (dictating) {
      listenerRef.current?.finish();
      listenerRef.current?.abort();
      setDictating(false);
      setInterim("");
      return;
    }
    if (!settingsStore.read().consent.voice) return setConsentOpen(true);
    startDictation();
  };

  const remaining = LIMITS.maxMessageChars - value.length;

  return (
    <div>
      {(dictating || dictationError) && (
        <p className={cn("mb-2 px-2 text-sm", dictationError ? "text-danger" : "text-muted")} aria-live="polite">
          {dictationError ?? (interim ? <span className="italic">“{interim}”</span> : "Listening… speak, then pause.")}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-surface p-2 shadow-soft transition-shadow focus-within:shadow-lift focus-within:ring-2 focus-within:ring-primary/25">
        {canDictate && (
          <button
            type="button"
            onClick={toggleDictation}
            disabled={busy || disabled}
            aria-label={dictating ? "Stop dictation" : "Dictate with your voice"}
            aria-pressed={dictating}
            className={cn(
              "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:opacity-40",
              dictating ? "bg-danger-soft text-danger" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Mic className={cn("h-5 w-5", dictating && "animate-pulse")} />
          </button>
        )}
        <label htmlFor="composer" className="sr-only">
          Message Ari
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={value}
          maxLength={LIMITS.maxMessageChars}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Share what's on your mind…"
          className="max-h-[180px] min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-relaxed text-fg outline-none placeholder:text-subtle focus-visible:outline-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop reply"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fg text-bg transition-transform active:scale-95"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-fg shadow-soft transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
          </button>
        )}
      </div>
      {remaining < 200 && <p className="mt-1 px-3 text-right text-xs text-subtle">{remaining} characters left</p>}
      <VoiceConsentDialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        onAllow={() => {
          setConsentOpen(false);
          startDictation();
        }}
      />
    </div>
  );
}

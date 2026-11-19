"use client";

import { Mic } from "lucide-react";
import { usesRemoteAI } from "@/lib/agent/client";
import { APP } from "@/lib/config";
import { settingsStore, updateSettings } from "@/lib/storage";
import { useServerConfig } from "@/lib/use-server-config";
import { now } from "@/lib/utils";
import { Dialog } from "./ui/dialog";

/** Explicit consent before using the microphone or sending voice transcripts anywhere. */
export function VoiceConsentDialog({ open, onClose, onAllow }: { open: boolean; onClose: () => void; onAllow: () => void }) {
  const settings = settingsStore.useValue();
  const { config } = useServerConfig();
  // Groq speech services follow the AI-replies setting: offline demo mode never uses them.
  const remote = usesRemoteAI(settings, config);
  const groqVoice = remote && !!config?.tts && settings.voice.engine === "groq";

  return (
    <Dialog open={open} onClose={onClose} title="Before you use your voice" description="Here's exactly what happens with your speech.">
      <ul className="space-y-3 text-sm leading-relaxed">
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">1</span>
          <span>
            Your browser turns speech into text. In Chrome and Edge this uses the browser maker&apos;s online speech service; Safari may process it on your device or with Apple.
            {remote && config?.stt
              ? " If your browser can't do this, the recording is sent to Groq Whisper for transcription and not stored."
              : " If your browser can't do this, you can type your replies instead."}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">2</span>
          <span>
            {remote
              ? `The transcript is treated like a typed message: contact details are removed and it's sent to Groq to generate a reply.${groqVoice ? ` In voice sessions, ${APP.companion}'s replies are also sent to Groq to be spoken aloud.` : ""}`
              : `${APP.companion} is running in offline demo mode: the transcript stays on this device, nothing is sent to Groq, and replies are spoken by your device's voice.`}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">3</span>
          <span>The transcript is saved in this browser&apos;s history so you can review or delete it. Audio itself is never saved.</span>
        </li>
      </ul>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-full border border-border px-5 font-medium hover:bg-surface-2">
          Not now
        </button>
        <button
          type="button"
          onClick={() => {
            updateSettings((s) => ({ ...s, consent: { ...s.consent, voice: true, decidedAt: now() } }));
            onAllow();
          }}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <Mic className="h-4 w-4" />
          Allow voice
        </button>
      </div>
    </Dialog>
  );
}

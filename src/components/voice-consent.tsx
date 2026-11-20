"use client";

import { History, Mic, Send } from "lucide-react";
import type { ReactNode } from "react";
import { usesRemoteAI } from "@/lib/agent/client";
import { APP } from "@/lib/config";
import { settingsStore, updateSettings } from "@/lib/storage";
import { useServerConfig } from "@/lib/use-server-config";
import { now } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-fg">{title}</p>
        <p className="mt-0.5 text-base leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}

/** Explicit consent before using the microphone or sending voice transcripts anywhere. */
export function VoiceConsentDialog({ open, onClose, onAllow }: { open: boolean; onClose: () => void; onAllow: () => void }) {
  const settings = settingsStore.useValue();
  const { config } = useServerConfig();
  // Groq speech services are only used when Groq is configured on the server.
  const remote = usesRemoteAI(settings, config);
  const groqVoice = remote && !!config?.tts && settings.voice.engine === "groq";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Before you use your voice"
      description="Here's exactly what happens with what you say."
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <Button
            size="lg"
            fullWidth
            className="sm:w-auto"
            onClick={() => {
              updateSettings((s) => ({ ...s, consent: { ...s.consent, voice: true, decidedAt: now() } }));
              onAllow();
            }}
          >
            <Mic className="h-5 w-5" />
            Allow voice
          </Button>
          <Button variant="ghost" size="lg" fullWidth className="sm:w-auto" onClick={onClose}>
            Not now
          </Button>
        </div>
      }
    >
      <ul className="space-y-5">
        <Step icon={<Mic />} title="Your speech becomes text">
          {remote && config?.stt && settings.voice.recognition !== "browser"
            ? "Each thing you say is recorded and sent to Groq Whisper to turn it into text. The recording isn't stored. (If you choose live browser captions in Settings, your browser's own speech service is used instead.)"
            : "Your browser turns speech into text. In Chrome and Edge this uses the browser maker's online speech service; Safari may process it on your device or with Apple. If your browser can't do this, you can type your replies instead."}
        </Step>
        <Step icon={<Send />} title={remote ? `How ${APP.companion} replies` : "It stays on this device"}>
          {remote
            ? `The text is treated like a typed message: contact details are removed and it's sent to Groq to generate a reply.${groqVoice ? ` In voice sessions, ${APP.companion}'s replies are also sent to Groq to be spoken aloud.` : ""}`
            : `${APP.companion} isn't connected to Groq right now: the transcript stays on this device, nothing is sent to Groq, and replies are spoken by your device's voice.`}
        </Step>
        <Step icon={<History />} title="Saved only in this browser">
          The transcript is saved in this browser&apos;s history so you can review or delete it. Audio itself is never saved.
        </Step>
      </ul>
    </Dialog>
  );
}

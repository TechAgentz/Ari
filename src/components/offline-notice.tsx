"use client";

import { CloudOff } from "lucide-react";
import { usesRemoteAI } from "@/lib/agent/client";
import { settingsStore, updateSettings } from "@/lib/storage";
import { useServerConfig } from "@/lib/use-server-config";
import { now } from "@/lib/utils";

/**
 * Shown when Groq is available but this browser chose offline mode (scripted replies, browser speech
 * recognition). Pressing the button is the consent: the text says exactly what will be sent and where.
 */
export function OfflineNotice({ className = "" }: { className?: string }) {
  const settings = settingsStore.useValue();
  const { config } = useServerConfig();
  if (!config?.groqConfigured || usesRemoteAI(settings, config)) return null;
  const turnOn = () =>
    updateSettings((s) => ({ ...s, aiMode: "auto", consent: { ...s.consent, ai: true, decidedAt: now() } }));
  return (
    <div className={`mx-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-warm/30 bg-warm-soft/60 px-4 py-3 text-left text-sm ${className}`}>
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warm" />
      <div className="min-w-0 flex-1">
        <p className="leading-relaxed">
          <strong className="font-semibold">Offline mode:</strong> scripted replies and basic speech recognition.
        </p>
        <button type="button" onClick={turnOn} className="mt-2 h-9 cursor-pointer rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
          Turn on smart replies
        </button>
        <p className="mt-1.5 text-xs text-muted">Sends your messages and voice recordings to Groq to generate replies.</p>
      </div>
    </div>
  );
}

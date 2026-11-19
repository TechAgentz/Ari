"use client";

import { Bot, CloudOff, Lock, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { APP } from "@/lib/config";
import { loadSampleData } from "@/lib/sample-data";
import { settingsStore, updateSettings, useHydrated } from "@/lib/storage";
import { useServerConfig } from "@/lib/use-server-config";
import { now } from "@/lib/utils";
import { Dialog } from "./ui/dialog";

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  // Unique per instance: the Settings page behind this dialog has its own consent controls.
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3.5 transition-colors hover:bg-surface-2 has-[:checked]:border-primary/40 has-[:checked]:bg-primary-soft/50">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--primary)]" />
      <span className="text-sm leading-relaxed">{children}</span>
    </label>
  );
}

/** First-run welcome: explains what the companion is and collects explicit consent. */
export function Onboarding() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const settings = settingsStore.useValue();
  const { config, loading } = useServerConfig();
  const [aiConsent, setAiConsent] = useState(false);
  const [contextConsent, setContextConsent] = useState(false);
  const [sample, setSample] = useState(false);

  // Crisis resources must never sit behind the welcome dialog.
  if (!hydrated || settings.onboarded || pathname === "/support") return null;
  const groq = !!config?.groqConfigured;

  const finish = () => {
    updateSettings((s) => ({
      ...s,
      onboarded: true,
      aiMode: groq && aiConsent ? "auto" : "demo",
      consent: { ...s.consent, ai: groq && aiConsent, context: groq && aiConsent && contextConsent, decidedAt: now() },
    }));
    if (sample) loadSampleData();
  };

  return (
    <Dialog open onClose={() => {}} dismissible={false} title={`Welcome to ${APP.name}`} description={`A calm space to talk things through with ${APP.companion}. You're in guest mode — no sign-up, no payment.`}>
      <ul className="space-y-3.5">
        <li className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Bot className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed">
            <strong className="font-semibold">{APP.companion} is an AI, not a licensed psychologist.</strong> It can listen and share general wellbeing information, but it can&apos;t diagnose and isn&apos;t for emergencies.{" "}
            <Link href="/support" className="font-medium text-primary underline-offset-4 hover:underline">
              Crisis support
            </Link>
          </p>
        </li>
        <li className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed">
            <strong className="font-semibold">Your conversations stay in this browser.</strong> Nothing is saved on a server, and you can clear everything in Settings.
          </p>
        </li>
        <li className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warm-soft text-warm">
            {groq ? <Send className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
          </span>
          <p className="text-sm leading-relaxed">
            {loading ? (
              "Checking AI configuration…"
            ) : groq ? (
              <>
                <strong className="font-semibold">With AI replies on,</strong> your recent messages are sent to Groq to generate responses. Emails, phone numbers and addresses are removed first.
              </>
            ) : (
              <>
                <strong className="font-semibold">This demo is running in offline mode.</strong> {APP.companion} uses a scripted conversation engine — nothing leaves your device.
              </>
            )}
          </p>
        </li>
      </ul>

      <div className="mt-5 space-y-2.5">
        {groq && (
          <>
            <Check checked={aiConsent} onChange={setAiConsent}>
              I agree to send my messages to the AI provider (Groq) to generate replies.
            </Check>
            <Check checked={contextConsent && aiConsent} onChange={(v) => setContextConsent(v)}>
              <span className={aiConsent ? "" : "opacity-50"}>
                Optional: let {APP.companion} include details I share (like my first name or hobbies) so replies feel more personal.
              </span>
            </Check>
          </>
        )}
        <Check checked={sample} onChange={setSample}>
          Load fictional sample conversations and mood entries to explore the demo.
        </Check>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={finish}
          disabled={loading}
          className="h-12 flex-1 cursor-pointer rounded-full bg-primary px-6 font-semibold text-primary-fg shadow-soft transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {groq && aiConsent ? "Start with AI replies" : groq ? "Continue in offline mode" : "Get started"}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-subtle">You can change these choices any time in Settings. Voice conversations ask for separate permission.</p>
    </Dialog>
  );
}

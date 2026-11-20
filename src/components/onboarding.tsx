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
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  // Unique per instance: the Settings page behind this dialog has its own consent controls.
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-14 cursor-pointer items-start gap-3.5 rounded-2xl border border-border-strong bg-surface p-4 transition-colors hover:bg-surface-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[var(--primary)]"
      />
      <span className="text-base leading-relaxed">{children}</span>
    </label>
  );
}

function Point({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5">
      <span
        aria-hidden
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}
      >
        {icon}
      </span>
      <p className="pt-0.5 text-base leading-relaxed">{children}</p>
    </li>
  );
}

/** First-run welcome: introduces Ari and collects explicit consent. */
export function Onboarding() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const settings = settingsStore.useValue();
  const { config, loading } = useServerConfig();
  const [contextConsent, setContextConsent] = useState(false);
  const [sample, setSample] = useState(false);

  // Crisis resources must never sit behind the welcome dialog.
  if (!hydrated || settings.onboarded || pathname === "/support") return null;
  const groq = !!config?.groqConfigured;

  // Replies always come from Groq; pressing "Agree and start" records that the user was told so.
  const finish = () => {
    updateSettings((s) => ({
      ...s,
      onboarded: true,
      aiMode: "auto",
      consent: {
        ...s.consent,
        ai: true,
        context: contextConsent,
        decidedAt: now(),
      },
    }));
    if (sample) loadSampleData();
  };

  return (
    <Dialog
      open
      onClose={() => {}}
      dismissible={false}
      title={`Welcome to ${APP.name}`}
      footer={
        <>
          <Button
            size="lg"
            fullWidth
            onClick={finish}
            disabled={loading}
          >
            Agree and start
          </Button>
          <p className="mt-3 text-center text-sm leading-snug text-muted">
            This means you agree to your messages (and voice recordings) being
            sent to Groq to generate replies. Voice asks for microphone
            permission separately.
          </p>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="bg-orb h-20 w-20 rounded-full shadow-lift"
        />
        <p className="mt-4 font-serif text-[1.75rem] font-semibold leading-tight">
          Hi, I&apos;m {APP.companion}
        </p>
        <p className="mt-2 text-base leading-relaxed text-muted">
          A calm space to talk things through. No sign-up, no payment.
        </p>
      </div>

      <ul className="mt-6 space-y-4">
        <Point
          tone="bg-accent-soft text-accent"
          icon={<Bot className="h-6 w-6" strokeWidth={2} />}
        >
          <strong className="font-semibold">
            I&apos;m a {APP.role}, working alongside {APP.careTeam}.
          </strong>{" "}
          Not a psychologist, and not for emergencies.{" "}
          <Link
            href="/support"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Crisis support
          </Link>
        </Point>
        <Point
          tone="bg-primary-soft text-primary"
          icon={<Lock className="h-6 w-6" strokeWidth={2} />}
        >
          <strong className="font-semibold">
            Your conversations stay in this browser.
          </strong>{" "}
          You can clear everything in Settings.
        </Point>
        <Point
          tone="bg-warm-soft text-warm"
          icon={
            groq ? (
              <Send className="h-6 w-6" strokeWidth={2} />
            ) : (
              <CloudOff className="h-6 w-6" strokeWidth={2} />
            )
          }
        >
          {loading ? (
            "Checking configuration…"
          ) : (
            <>
              <strong className="font-semibold">
                Replies are generated by Groq.
              </strong>{" "}
              Emails, phone numbers and addresses are removed first.
            </>
          )}
        </Point>
      </ul>

      <fieldset className="mt-6">
        <legend className="mb-3 text-[1.125rem] font-semibold">
          Optional
        </legend>
        <div className="space-y-3">
          <Check
            checked={contextConsent}
            onChange={(v) => setContextConsent(v)}
          >
            Let {APP.companion} remember details I share (like my first name
            or hobbies) so replies feel more personal.
          </Check>
          <Check checked={sample} onChange={setSample}>
            Load fictional sample conversations and mood entries to explore
            the demo.
          </Check>
        </div>
      </fieldset>
    </Dialog>
  );
}

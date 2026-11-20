"use client";

import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Database,
  Download,
  Loader2,
  Monitor,
  Moon,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { usesRemoteAI } from "@/lib/agent/client";
import { APP, DISCLAIMER, FEATURES, LIMITS } from "@/lib/config";
import { loadSampleData, removeSampleData } from "@/lib/sample-data";
import { clearAllData, conversationsStore, moodStore, settingsStore, updateSettings, useHydrated } from "@/lib/storage";
import type { Settings } from "@/lib/types";
import { fetchServerConfig, useServerConfig } from "@/lib/use-server-config";
import { cn, now } from "@/lib/utils";
import { voiceEngine } from "@/lib/voice/controller";
import { Speaker, listVoices, pickVoice, voicesReady } from "@/lib/voice/speaker";

/** iOS-style grouped section: a small heading, a rounded card of rows, and an optional footnote. */
function Group({ id, title, footer, children }: { id?: string; title: string; footer?: ReactNode; children: ReactNode }) {
  const headingId = `${id ?? title.toLowerCase().replace(/[^a-z]+/g, "-")}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <h2 id={headingId} className="mb-2 px-1 text-lg font-semibold text-fg">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface px-4 shadow-soft sm:px-5">{children}</div>
      {footer && <div className="mt-2 px-1 text-sm leading-relaxed text-muted">{footer}</div>}
    </section>
  );
}

/** A row with a label above its control (for pickers, sliders and selects). */
function Row({ label, htmlFor, value, description, children }: { label: string; htmlFor?: string; value?: ReactNode; description?: ReactNode; children?: ReactNode }) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className="py-4">
      <Label {...(htmlFor ? { htmlFor } : {})} className="flex items-center justify-between gap-3 text-base font-medium text-fg">
        {label}
        {value != null && <span className="text-[0.9375rem] font-normal tabular-nums text-muted">{value}</span>}
      </Label>
      {children && <div className="mt-3">{children}</div>}
      {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

/** Full-width tappable row, like an iOS settings action. */
function ActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "-mx-4 flex min-h-14 w-[calc(100%+2rem)] cursor-pointer items-center gap-3 px-4 text-left text-base font-medium transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45 sm:-mx-5 sm:w-[calc(100%+2.5rem)] sm:px-5",
        tone === "danger" ? "text-danger" : "text-fg",
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone === "danger" ? "bg-danger-soft" : "bg-primary-soft text-primary")}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}

/** Choice pills that wrap; each one is a 48px pressable button. */
function Choices<T extends string>({
  label,
  options,
  isSelected,
  onSelect,
}: {
  label: string;
  options: { v: T; label: string; disabled?: boolean }[];
  isSelected: (v: T) => boolean;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={label}>
      {options.map((o) => {
        const selected = isSelected(o.v);
        return (
          <button
            key={o.v}
            type="button"
            disabled={o.disabled}
            aria-pressed={selected}
            onClick={() => onSelect(o.v)}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 text-left text-[0.9375rem] font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45",
              selected ? "border-primary bg-primary-soft text-fg" : "border-border text-fg hover:bg-surface-2",
            )}
          >
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-primary" : "border-border-strong")} aria-hidden="true">
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const rangeClass = "h-12 w-full cursor-pointer accent-[var(--primary)]";

type Confirm = null | "conversations" | "moods" | "everything";

export function SettingsScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-app" aria-busy="true" />;
  return <SettingsInner />;
}

function SettingsInner() {
  const settings = settingsStore.useValue();
  const conversations = conversationsStore.useValue();
  const moods = moodStore.useValue();
  const { config, loading } = useServerConfig();
  const toast = useToast();
  const [check, setCheck] = useState<{ state: "idle" | "checking" | "ok" | "fail"; message?: string }>({ state: "idle" });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [confirm, setConfirm] = useState<Confirm>(null);

  useEffect(() => {
    let alive = true;
    voicesReady().then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);

  const set = (fn: (s: Settings) => Settings) => updateSettings(fn);
  const groq = !!config?.groqConfigured;
  const remote = usesRemoteAI(settings, config);
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const voiceOptions = englishVoices.length ? englishVoices : voices;
  const autoVoice = pickVoice(voices);
  const hasSamples = conversations.some((c) => c.sample) || moods.some((m) => m.sample);

  const testConnection = async () => {
    setCheck({ state: "checking" });
    try {
      const res = await fetch("/api/config?check=1", { cache: "no-store" });
      const json = (await res.json()) as { check?: { ok: boolean; error?: string; warning?: string } };
      setCheck(
        json.check?.ok
          ? { state: "ok", message: `Connected to Groq. The models are available.${json.check.warning ? ` ${json.check.warning}` : ""}` }
          : { state: "fail", message: json.check?.error ?? "Check failed." },
      );
      void fetchServerConfig(true);
    } catch {
      setCheck({ state: "fail", message: "Couldn't reach the local server." });
    }
  };

  const testVoice = () => {
    const sp = new Speaker({ engine: voiceEngine(settings, config), voiceName: settings.voice.voiceName, rate: settings.voice.rate, onStart: () => {}, onEnd: () => {} });
    sp.enqueue(`Hi, I'm ${APP.companion}. This is how I'll sound in voice conversations.`);
    sp.end();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: APP.name, conversations, moods, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `haven-demo-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-6 lg:pt-12">
      <PageHeader title="Settings" description="Choose how Ari sounds, what's shared, and what's kept on this device." />

      <div className="space-y-8">
        {/* Voice */}
        <Group id="voice" title="Voice">
          <Switch id="voice-output" label="Speak replies aloud" checked={settings.voice.output} onChange={(v) => set((s) => ({ ...s, voice: { ...s.voice, output: v } }))} />
          <Switch
            id="voice-check-ins"
            label="Ari checks in when you're quiet"
            description="If you don't say anything for a while, Ari gently asks an easy question, at most twice in a row, then waits."
            checked={settings.voice.checkIns}
            onChange={(v) => set((s) => ({ ...s, voice: { ...s.voice, checkIns: v } }))}
          />
          {settings.voice.checkIns && (
            <Row label="Wait before checking in" htmlFor="voice-check-in-seconds" value={`${settings.voice.checkInSeconds}s`}>
              <input
                id="voice-check-in-seconds"
                type="range"
                min={5}
                max={20}
                step={1}
                value={settings.voice.checkInSeconds}
                onChange={(e) => set((s) => ({ ...s, voice: { ...s.voice, checkInSeconds: Number(e.target.value) } }))}
                className={rangeClass}
              />
            </Row>
          )}
          <Row
            label="How Ari hears you"
            description="Accurate mode understands accents and phone microphones much better; your words appear after you pause. It needs Groq set up, otherwise your browser's live captions are used."
          >
            <Choices
              label="Speech recognition"
              options={[
                { v: "auto" as const, label: "Accurate (Groq Whisper)" },
                { v: "browser" as const, label: "Live captions (browser)" },
              ]}
              isSelected={(v) => (v === "browser" ? settings.voice.recognition === "browser" : settings.voice.recognition !== "browser")}
              onSelect={(v) => set((s) => ({ ...s, voice: { ...s.voice, recognition: v } }))}
            />
          </Row>
          {/* Server voices are only offered when the server has a TTS model configured. */}
          {config?.tts && (
            <Row label="Ari's voice">
              <Choices
                label="Voice engine"
                options={[
                  { v: "browser" as const, label: "Device voice" },
                  { v: "groq" as const, label: "Groq Orpheus (preview)" },
                ]}
                isSelected={(v) => settings.voice.engine === v}
                onSelect={(v) => set((s) => ({ ...s, voice: { ...s.voice, engine: v } }))}
              />
            </Row>
          )}
          <Row
            label="Device voice"
            htmlFor="voice-name"
            description={voices.length === 0 && listVoices().length === 0 ? "No voices reported by this browser yet." : undefined}
          >
            <div className="relative">
              <select
                id="voice-name"
                value={settings.voice.voiceName ?? ""}
                onChange={(e) => set((s) => ({ ...s, voice: { ...s.voice, voiceName: e.target.value || undefined } }))}
                className="h-12 w-full cursor-pointer appearance-none rounded-2xl border border-border-strong bg-surface pl-4 pr-11 text-base text-fg outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Automatic{autoVoice ? ` (${autoVoice.name})` : ""}</option>
                {voiceOptions.map((v) => (
                  <option key={`${v.name}-${v.lang}`} value={v.name}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
            </div>
          </Row>
          <Row label="Speaking speed" htmlFor="voice-rate" value={`${settings.voice.rate.toFixed(2)}×`}>
            <input
              id="voice-rate"
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={settings.voice.rate}
              onChange={(e) => set((s) => ({ ...s, voice: { ...s.voice, rate: Number(e.target.value) } }))}
              className={rangeClass}
            />
            <div className="flex justify-between text-sm text-muted" aria-hidden="true">
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </Row>
          <div className="py-4">
            <Button variant="secondary" onClick={testVoice} fullWidth className="sm:w-auto">
              <Play className="h-4.5 w-4.5" aria-hidden="true" /> Test voice
            </Button>
          </div>
        </Group>

        {/* Privacy */}
        <Group
          id="privacy"
          title="Privacy"
          footer={
            <>
              <p>
                Conversations are stored only in this browser. To write each reply, your last {LIMITS.contextWindow} messages (and, in voice, your recording) are sent to Groq after emails, phone numbers, addresses and similar details are removed. Nothing is stored on a server.
              </p>
              <p className="mt-2">Messages that suggest someone may be in immediate danger are never sent to Groq. {APP.companion} responds with crisis resources directly.</p>
            </>
          }
        >
          <Switch
            id="consent-context"
            label="Remember personal details"
            description={`Lets ${APP.companion} include a short summary of things you've shared (like your first name, who you live with, or hobbies) so replies stay personal in long conversations. Off by default.`}
            checked={settings.consent.context}
            disabled={!groq}
            onChange={(v) => set((s) => ({ ...s, consent: { ...s.consent, context: v, decidedAt: now() } }))}
          />
          <Switch
            id="consent-voice"
            label="Use my microphone"
            description="Your speech is turned into text by your browser, or by Groq Whisper when that's more accurate. Audio is never saved."
            checked={settings.consent.voice}
            onChange={(v) => set((s) => ({ ...s, consent: { ...s.consent, voice: v, decidedAt: now() } }))}
          />
        </Group>

        {/* Appearance */}
        <Group id="appearance" title="Appearance">
          <div className="py-4">
            <div className="flex rounded-full bg-surface-2 p-1" role="group" aria-label="Theme">
              {[
                { v: "light" as const, label: "Light", icon: Sun },
                { v: "dark" as const, label: "Dark", icon: Moon },
                { v: "system" as const, label: "Auto", icon: Monitor },
              ].map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={settings.theme === v}
                  onClick={() => set((s) => ({ ...s, theme: v }))}
                  className={cn(
                    "inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full text-[0.9375rem] font-semibold transition-colors duration-200",
                    settings.theme === v ? "bg-surface text-fg shadow-soft" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">Auto matches your device&apos;s light or dark setting.</p>
          </div>
        </Group>

        {/* Data */}
        <Group
          id="data"
          title="Your data"
          footer={`${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"} and ${moods.length} mood ${moods.length === 1 ? "check-in" : "check-ins"} are stored in this browser.`}
        >
          {hasSamples ? (
            <ActionRow
              icon={Database}
              label="Remove sample data"
              onClick={() => {
                removeSampleData();
                toast("Sample data removed");
              }}
            />
          ) : (
            <ActionRow
              icon={Database}
              label="Load fictional sample data"
              onClick={() => {
                loadSampleData();
                toast("Fictional sample data loaded");
              }}
            />
          )}
          <ActionRow icon={Download} label="Export as JSON" onClick={exportData} />
          <ActionRow icon={Trash2} label="Clear conversations" tone="danger" onClick={() => setConfirm("conversations")} disabled={!conversations.length} />
          <ActionRow icon={Trash2} label="Clear mood log" tone="danger" onClick={() => setConfirm("moods")} disabled={!moods.length} />
          <ActionRow icon={RotateCcw} label="Reset everything" tone="danger" onClick={() => setConfirm("everything")} />
        </Group>

        {/* About */}
        <Group id="about" title="About" footer={`${APP.name} ${APP.version}`}>
          <div className="py-4">
            <p className="text-base leading-relaxed text-fg">{DISCLAIMER} Sample data is fictional.</p>
            <ul className="mt-3 space-y-2 text-[0.9375rem] text-muted">
              <li className="flex items-center gap-2.5">
                <UserRound className="h-4.5 w-4.5 text-primary" aria-hidden="true" /> Guest mode, no account {FEATURES.accounts ? "" : "required"}
              </li>
              <li className="flex items-center gap-2.5">
                <CreditCard className="h-4.5 w-4.5 text-primary" aria-hidden="true" /> Payments, subscriptions & billing {FEATURES.payments ? "on" : "disabled"}
              </li>
            </ul>
          </div>

          <div className="py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-fg">Replies</p>
                <p className="text-[0.9375rem] text-muted">
                  {APP.companion}&apos;s replies are written by Groq. Now answering: {remote ? "Groq" : "Backup replies (Groq not set up)"}
                </p>
              </div>
            </div>
            {config?.misconfigured && (
              <p className="mt-3 rounded-2xl bg-warm-soft p-3 text-sm text-fg">AI_PROVIDER is set to “groq” but no GROQ_API_KEY was found, so the server is using demo mode.</p>
            )}

            <details className="group mt-3">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl text-[0.9375rem] font-semibold text-primary [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-4.5 w-4.5 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" /> Technical details
              </summary>
              <dl className="mt-2 grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-4 text-[0.9375rem]">
                <div>
                  <dt className="text-sm text-muted">Server provider</dt>
                  <dd className="mt-0.5 font-medium">{loading ? "…" : config?.provider === "groq" ? "Groq" : "Demo"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-muted">Chat model</dt>
                  <dd className="mt-0.5 truncate font-medium" title={config?.model}>
                    {loading ? "…" : (config?.model ?? "—")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">API key</dt>
                  <dd className="mt-0.5 font-medium">{loading ? "…" : groq ? "Set (server only)" : "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Now answering</dt>
                  <dd className="mt-0.5 font-medium">{remote ? "Groq" : "Backup replies"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                If Groq is busy or unreachable mid-conversation, Ari answers with a short backup reply so the conversation isn&apos;t interrupted.
              </p>
            </details>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={() => void testConnection()} disabled={check.state === "checking"}>
                {check.state === "checking" ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4.5 w-4.5" aria-hidden="true" />}
                Test connection
              </Button>
              <div aria-live="polite" className="min-w-0">
                {check.state === "ok" && (
                  <span className="inline-flex items-start gap-1.5 text-[0.9375rem] text-success">
                    <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" /> {check.message}
                  </span>
                )}
                {check.state === "fail" && (
                  <span className="inline-flex items-start gap-1.5 text-[0.9375rem] text-danger">
                    <CircleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" /> {check.message}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Group>
      </div>

      <ConfirmDialog
        open={confirm === "conversations"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          conversationsStore.clear();
          toast("Conversations cleared");
        }}
        title="Clear all conversations?"
        description="Every chat and voice transcript will be permanently removed from this browser."
        confirmLabel="Clear conversations"
      />
      <ConfirmDialog
        open={confirm === "moods"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          moodStore.clear();
          toast("Mood log cleared");
        }}
        title="Clear your mood log?"
        description="All mood check-ins will be permanently removed from this browser."
        confirmLabel="Clear mood log"
      />
      <ConfirmDialog
        open={confirm === "everything"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          clearAllData();
          toast("Everything has been reset");
        }}
        title="Reset everything?"
        description="Conversations, mood check-ins, consent choices and settings will all be removed from this browser, and you'll see the welcome screen again."
        confirmLabel="Reset everything"
      />
    </div>
  );
}

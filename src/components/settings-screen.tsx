"use client";

import { CheckCircle2, CircleAlert, CreditCard, Download, Loader2, Monitor, Moon, Play, RotateCcw, Sun, Trash2, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Card, PageHeader, Switch } from "@/components/ui/primitives";
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

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-6 sm:p-7">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

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
  const [askAiConsent, setAskAiConsent] = useState(false);

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
  const aiChosen = settings.aiMode === "auto" && settings.consent.ai;

  // Picking the AI provider is never consent by itself: without it, ask first.
  const chooseMode = (mode: Settings["aiMode"]) => {
    if (mode === "auto" && !settings.consent.ai) setAskAiConsent(true);
    else set((s) => ({ ...s, aiMode: mode }));
  };
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
          ? { state: "ok", message: `Connected to Groq — the models are available.${json.check.warning ? ` ${json.check.warning}` : ""}` }
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
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
      <PageHeader eyebrow="Settings" title="Your space, your choices" description="Control how replies are generated, what's shared, how voice works, and the data stored in this browser." />

      <div className="space-y-6">
        {/* AI provider */}
        <Section title="AI replies" description="Choose how Ari generates responses.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                value: "auto" as const,
                title: "AI provider (Groq)",
                body: groq ? `Natural conversation powered by ${config?.model}.` : "Not configured — add GROQ_API_KEY to .env.local and restart.",
                note: groq && !settings.consent.ai ? "Sends your messages to Groq. You'll be asked to agree first." : undefined,
                selected: aiChosen,
                disabled: !groq,
              },
              { value: "demo" as const, title: "Offline demo", body: "Scripted conversation engine. Nothing leaves your device.", note: undefined, selected: !aiChosen, disabled: false },
            ].map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                aria-pressed={o.selected}
                onClick={() => chooseMode(o.value)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  o.selected ? "border-primary bg-primary-soft/60 shadow-soft" : "border-border hover:bg-surface-2",
                )}
              >
                <p className="font-semibold">{o.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{o.body}</p>
                {o.note && <p className="mt-2 text-xs leading-relaxed text-muted">{o.note}</p>}
              </button>
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Server provider</dt>
              <dd className="mt-0.5 font-medium">{loading ? "…" : config?.provider === "groq" ? "Groq" : "Demo"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Chat model</dt>
              <dd className="mt-0.5 truncate font-medium" title={config?.model}>
                {loading ? "…" : (config?.model ?? "—")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">API key</dt>
              <dd className="mt-0.5 font-medium">{loading ? "…" : groq ? "Set (server only)" : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Now answering</dt>
              <dd className="mt-0.5 font-medium">{remote ? "Groq" : "On-device demo"}</dd>
            </div>
          </dl>
          {config?.misconfigured && <p className="mt-3 text-sm text-warm">AI_PROVIDER is set to “groq” but no GROQ_API_KEY was found, so the server is using demo mode.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void testConnection()} disabled={check.state === "checking"} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-50">
              {check.state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Test connection
            </button>
            {check.state === "ok" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> {check.message}
              </span>
            )}
            {check.state === "fail" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-danger">
                <CircleAlert className="h-4 w-4" /> {check.message}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-subtle">If Groq is unreachable mid-conversation, Ari automatically falls back to the offline demo engine.</p>
        </Section>

        {/* Privacy */}
        <Section title="Privacy & consent" description="Everything is stored only in this browser. These switches control what may leave your device.">
          <div className="divide-y divide-border">
            <Switch
              id="consent-ai"
              label="Send messages to the AI provider"
              description={`Your last ${LIMITS.contextWindow} messages are sent to Groq to generate a reply, after removing emails, phone numbers, addresses and similar identifiers. Turning this off switches to offline demo mode.`}
              checked={settings.consent.ai}
              disabled={!groq}
              onChange={(v) => set((s) => ({ ...s, aiMode: v ? "auto" : "demo", consent: { ...s.consent, ai: v, context: v ? s.consent.context : false, decidedAt: now() } }))}
            />
            <Switch
              id="consent-context"
              label="Share remembered personal context"
              description={`Lets ${APP.companion} include a short summary of things you've shared (like your first name, who you live with, or hobbies) so replies stay personal in long conversations. Off by default.`}
              checked={settings.consent.context}
              disabled={!settings.consent.ai || !groq}
              onChange={(v) => set((s) => ({ ...s, consent: { ...s.consent, context: v, decidedAt: now() } }))}
            />
            <Switch
              id="consent-voice"
              label="Voice input"
              description="Allows using your microphone. Speech is converted to text by your browser's speech service (or Groq Whisper as a fallback). Audio is never saved."
              checked={settings.consent.voice}
              onChange={(v) => set((s) => ({ ...s, consent: { ...s.consent, voice: v, decidedAt: now() } }))}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-subtle">
            Messages that suggest someone may be in immediate danger are never sent to the AI provider — {APP.companion} responds with crisis resources directly.
          </p>
        </Section>

        {/* Voice */}
        <Section title="Voice" description="How Ari sounds in voice conversations.">
          <div className="divide-y divide-border">
            <Switch id="voice-output" label="Speak replies aloud" checked={settings.voice.output} onChange={(v) => set((s) => ({ ...s, voice: { ...s.voice, output: v } }))} />
            <Switch
              id="voice-check-ins"
              label="Ari checks in when you're quiet"
              description="If you don't say anything for a while, Ari gently asks an easy question — at most twice in a row, then waits."
              checked={settings.voice.checkIns}
              onChange={(v) => set((s) => ({ ...s, voice: { ...s.voice, checkIns: v } }))}
            />
            {settings.voice.checkIns && (
              <div className="py-3">
                <label htmlFor="voice-check-in-seconds" className="flex items-center justify-between text-[0.95rem] font-medium">
                  Wait before checking in <span className="text-sm font-normal text-muted tabular-nums">{settings.voice.checkInSeconds}s</span>
                </label>
                <input
                  id="voice-check-in-seconds"
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={settings.voice.checkInSeconds}
                  onChange={(e) => set((s) => ({ ...s, voice: { ...s.voice, checkInSeconds: Number(e.target.value) } }))}
                  className="mt-3 w-full cursor-pointer accent-[var(--primary)]"
                />
              </div>
            )}
            <div className="py-3">
              <p className="text-[0.95rem] font-medium">Voice engine</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { v: "browser" as const, label: "Device voice", disabled: false },
                  { v: "groq" as const, label: "Groq Orpheus (preview)", disabled: !config?.tts },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    disabled={o.disabled}
                    aria-pressed={settings.voice.engine === o.v}
                    onClick={() => set((s) => ({ ...s, voice: { ...s.voice, engine: o.v } }))}
                    className={cn(
                      "h-10 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      settings.voice.engine === o.v ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {!config?.tts && <p className="mt-2 text-xs text-subtle">Server voices need GROQ_TTS_MODEL set on the server (e.g. canopylabs/orpheus-v1-english).</p>}
            </div>
            <div className="py-3">
              <label htmlFor="voice-name" className="text-[0.95rem] font-medium">
                Device voice
              </label>
              <select
                id="voice-name"
                value={settings.voice.voiceName ?? ""}
                onChange={(e) => set((s) => ({ ...s, voice: { ...s.voice, voiceName: e.target.value || undefined } }))}
                className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-border bg-surface px-3 text-base"
              >
                <option value="">Automatic{autoVoice ? ` (${autoVoice.name})` : ""}</option>
                {voiceOptions.map((v) => (
                  <option key={`${v.name}-${v.lang}`} value={v.name}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
              {voices.length === 0 && listVoices().length === 0 && <p className="mt-2 text-xs text-subtle">No voices reported by this browser yet.</p>}
            </div>
            <div className="py-3">
              <label htmlFor="voice-rate" className="flex items-center justify-between text-[0.95rem] font-medium">
                Speaking pace <span className="text-sm font-normal text-muted tabular-nums">{settings.voice.rate.toFixed(2)}×</span>
              </label>
              <input
                id="voice-rate"
                type="range"
                min={0.8}
                max={1.3}
                step={0.05}
                value={settings.voice.rate}
                onChange={(e) => set((s) => ({ ...s, voice: { ...s.voice, rate: Number(e.target.value) } }))}
                className="mt-3 w-full cursor-pointer accent-[var(--primary)]"
              />
            </div>
          </div>
          <button type="button" onClick={testVoice} className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2">
            <Play className="h-4 w-4" /> Test voice
          </button>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <div className="flex rounded-full border border-border bg-surface-2 p-1" role="group" aria-label="Theme">
            {[
              { v: "system" as const, label: "System", icon: Monitor },
              { v: "light" as const, label: "Light", icon: Sun },
              { v: "dark" as const, label: "Dark", icon: Moon },
            ].map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                aria-pressed={settings.theme === v}
                onClick={() => set((s) => ({ ...s, theme: v }))}
                className={cn("inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium transition-all", settings.theme === v ? "bg-surface shadow-soft" : "text-muted hover:text-fg")}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </Section>

        {/* Data */}
        <Section id="data" title="Your data" description={`${conversations.length} conversations and ${moods.length} mood check-ins are stored in this browser.`}>
          <div className="flex flex-wrap gap-2">
            {hasSamples ? (
              <button type="button" onClick={() => { removeSampleData(); toast("Sample data removed"); }} className="h-10 cursor-pointer rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2">
                Remove sample data
              </button>
            ) : (
              <button type="button" onClick={() => { loadSampleData(); toast("Fictional sample data loaded"); }} className="h-10 cursor-pointer rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2">
                Load fictional sample data
              </button>
            )}
            <button type="button" onClick={exportData} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2">
              <Download className="h-4 w-4" /> Export as JSON
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            <button type="button" onClick={() => setConfirm("conversations")} disabled={!conversations.length} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-danger-soft px-4 text-sm font-medium text-danger disabled:opacity-40">
              <Trash2 className="h-4 w-4" /> Clear conversations
            </button>
            <button type="button" onClick={() => setConfirm("moods")} disabled={!moods.length} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-danger-soft px-4 text-sm font-medium text-danger disabled:opacity-40">
              <Trash2 className="h-4 w-4" /> Clear mood log
            </button>
            <button type="button" onClick={() => setConfirm("everything")} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-danger px-4 text-sm font-medium text-white dark:text-bg">
              <RotateCcw className="h-4 w-4" /> Reset everything
            </button>
          </div>
        </Section>

        {/* About */}
        <Section title="About this demo">
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2.5">
              <UserRound className="h-4 w-4 text-primary" /> Guest mode — no account {FEATURES.accounts ? "" : "required"}
            </li>
            <li className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4 text-primary" /> Payments, subscriptions & billing {FEATURES.payments ? "on" : "disabled"}
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted">{DISCLAIMER} Sample data is fictional.</p>
          <p className="mt-2 text-xs text-subtle">
            {APP.name} {APP.version}
          </p>
        </Section>
      </div>

      <ConfirmDialog
        open={askAiConsent}
        onClose={() => setAskAiConsent(false)}
        onConfirm={() => set((s) => ({ ...s, aiMode: "auto", consent: { ...s.consent, ai: true, decidedAt: now() } }))}
        title="Send your messages to Groq?"
        description={`To generate each reply, your last ${LIMITS.contextWindow} messages are sent to Groq, an AI provider, after emails, phone numbers, addresses and similar identifiers are removed. Messages that suggest someone may be in danger are never sent. You can switch back to the offline demo any time.`}
        confirmLabel="Agree and use Groq"
        tone="primary"
      />
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

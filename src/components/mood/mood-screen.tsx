"use client";

import { BatteryMedium, Check, MessageCircle, Minus, Moon, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { APP } from "@/lib/config";
import { CHAT_DRAFT_MARKER, moodStore, setChatDraft, useHydrated } from "@/lib/storage";
import type { MoodEntry } from "@/lib/types";
import { cn, localDateKey, uid } from "@/lib/utils";
import { MoodChart } from "./mood-chart";
import { MOOD_TAGS, MOODS, moodMeta } from "./mood-meta";

export function MoodScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-app" aria-busy="true" />;
  return <MoodInner />;
}

function MoodInner() {
  const params = useSearchParams();
  const toast = useToast();
  const entries = moodStore.useValue();
  const today = localDateKey();
  const existing = entries.find((e) => e.date === today);
  const preset = Number(params.get("mood"));

  const [mood, setMood] = useState<MoodEntry["mood"] | null>(
    preset >= 1 && preset <= 5 ? (preset as MoodEntry["mood"]) : (existing?.mood ?? null),
  );
  const [energy, setEnergy] = useState<MoodEntry["energy"]>(existing?.energy ?? 3);
  const [sleep, setSleep] = useState<number>(existing?.sleepHours ?? 7);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saved, setSaved] = useState<MoodEntry | null>(null);

  const save = () => {
    if (!mood) return;
    const entry: MoodEntry = { id: existing?.id ?? uid("mood_"), date: today, createdAt: Date.now(), mood, energy, sleepHours: sleep, tags, note: note.trim() || undefined };
    moodStore.update((list) => [...list.filter((e) => e.date !== today), entry].sort((a, b) => a.date.localeCompare(b.date)));
    setSaved(entry);
    toast("Check-in saved on this device");
  };

  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const last14 = recent.slice(0, 14);
  const avg = (f: (e: MoodEntry) => number | undefined) => {
    const vals = last14.map(f).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const tagCounts = new Map<string, number>();
  last14.forEach((e) => e.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const reflectPrompt = saved
    ? `I just checked in feeling ${moodMeta(saved.mood).label.toLowerCase()} today (energy ${saved.energy}/5, about ${saved.sleepHours}h of sleep)${saved.tags.length ? `. On my mind: ${saved.tags.join(", ").toLowerCase()}` : ""}.`
    : "";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader eyebrow="Daily check-in" title="How are you feeling today?" description="A quick, private check-in. Noticing patterns over time can make it easier to look after yourself. Entries stay on this device." />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 sm:p-7 lg:col-span-3">
          {saved ? (
            <div className="flex animate-fade-up flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="h-7 w-7" />
              </span>
              <h2 className="mt-4 font-serif text-2xl font-semibold">Thanks for checking in</h2>
              <p className="mt-2 max-w-sm text-muted">
                {saved.mood <= 2
                  ? "It sounds like today has been hard. Be gentle with yourself — small things count."
                  : saved.mood === 3
                    ? "Steady days matter too. Is there one small thing that might lift today a little?"
                    : "Lovely. Taking a moment to notice what's going well helps it stick."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {/* Hand the check-in over in this tab only: in the URL it would stay in browser history. */}
                <ButtonLink href={`/chat?new=${CHAT_DRAFT_MARKER}`} onClick={() => setChatDraft(reflectPrompt)}>
                  <MessageCircle className="h-4 w-4" /> Reflect with {APP.companion}
                </ButtonLink>
                <ButtonLink href={`/library/${saved.mood <= 2 ? "self-compassion" : saved.mood === 3 ? "movement-and-mood" : "gratitude-savoring"}`} variant="secondary">
                  A helpful practice
                </ButtonLink>
                <button type="button" onClick={() => setSaved(null)} className="h-11 cursor-pointer rounded-full px-4 text-sm font-medium text-muted hover:bg-surface-2">
                  Edit check-in
                </button>
              </div>
              <p className="mt-4 text-xs text-subtle">Your check-in is only shared with {APP.companion} if you choose to send the message.</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <fieldset>
                <legend className="text-sm font-semibold">Mood</legend>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {MOODS.map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMood(value)}
                      aria-pressed={mood === value}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border py-3.5 text-xs font-medium transition-all duration-200 sm:text-sm",
                        mood === value ? "-translate-y-0.5 border-transparent shadow-lift" : "border-border hover:bg-surface-2",
                      )}
                      style={mood === value ? { background: `color-mix(in oklab, ${color} 22%, var(--surface))` } : undefined}
                    >
                      <Icon className="h-7 w-7" style={{ color }} />
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-7 grid gap-6 sm:grid-cols-2">
                <fieldset>
                  <legend className="flex items-center gap-1.5 text-sm font-semibold">
                    <BatteryMedium className="h-4 w-4 text-muted" /> Energy
                  </legend>
                  <div className="mt-3 flex gap-1.5">
                    {([1, 2, 3, 4, 5] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEnergy(v)}
                        aria-pressed={energy === v}
                        aria-label={`Energy ${v} of 5`}
                        className={cn("h-11 flex-1 cursor-pointer rounded-xl border text-sm font-semibold transition-colors", energy === v ? "border-primary bg-primary text-primary-fg" : "border-border hover:bg-surface-2")}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="flex items-center gap-1.5 text-sm font-semibold">
                    <Moon className="h-4 w-4 text-muted" /> Sleep last night
                  </legend>
                  <div className="mt-3 flex items-center gap-3">
                    <button type="button" aria-label="Less sleep" onClick={() => setSleep((s) => Math.max(0, s - 0.5))} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border hover:bg-surface-2">
                      <Minus className="h-4 w-4" />
                    </button>
                    <output className="flex-1 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                      {sleep}h
                    </output>
                    <button type="button" aria-label="More sleep" onClick={() => setSleep((s) => Math.min(14, s + 0.5))} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border hover:bg-surface-2">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </fieldset>
              </div>

              <fieldset className="mt-7">
                <legend className="text-sm font-semibold">What&apos;s been on your mind? <span className="font-normal text-subtle">(optional)</span></legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MOOD_TAGS.map((t) => {
                    const on = tags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                        className={cn("h-9 cursor-pointer rounded-full border px-3.5 text-sm transition-colors", on ? "border-primary bg-primary-soft font-medium text-fg" : "border-border text-muted hover:bg-surface-2")}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-7">
                <label htmlFor="mood-note" className="text-sm font-semibold">
                  A note for yourself <span className="font-normal text-subtle">(optional, stays on this device)</span>
                </label>
                <textarea
                  id="mood-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Anything you'd like to remember about today…"
                  className="mt-2 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <button type="submit" disabled={!mood} className="mt-6 h-12 w-full cursor-pointer rounded-full bg-primary font-semibold text-primary-fg shadow-soft transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40">
                {existing ? "Update today's check-in" : "Save check-in"}
              </button>
              {!mood && <p className="mt-2 text-center text-xs text-subtle">Choose a mood to save.</p>}
            </form>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-sm font-semibold">Last 14 days</h2>
            <div className="mt-4">
              <MoodChart entries={entries} days={14} />
            </div>
            {last14.length > 0 && (
              <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">Avg mood</dt>
                  <dd className="mt-1 font-semibold">{avg((e) => e.mood)?.toFixed(1)}</dd>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">Avg energy</dt>
                  <dd className="mt-1 font-semibold">{avg((e) => e.energy)?.toFixed(1)}</dd>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">Avg sleep</dt>
                  <dd className="mt-1 font-semibold">{avg((e) => e.sleepHours)?.toFixed(1) ?? "–"}h</dd>
                </div>
              </dl>
            )}
            {topTags.length > 0 && (
              <p className="mt-4 text-sm text-muted">
                Most often on your mind: <span className="font-medium text-fg">{topTags.map(([t]) => t).join(", ")}</span>
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold">Recent entries</h2>
            {recent.length === 0 ? (
              <div className="mt-4">
                <EmptyState icon={<Moon className="h-6 w-6" />} title="No entries yet" description="Your first check-in will show up here." />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {recent.slice(0, 8).map((e) => {
                  const m = moodMeta(e.mood);
                  const Icon = m.icon;
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-3">
                      <Icon className="h-6 w-6 shrink-0" style={{ color: m.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {m.label}{" "}
                          <span className="font-normal text-subtle">
                            · {new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            {e.sample && " · sample"}
                          </span>
                        </p>
                        {(e.tags.length > 0 || e.note) && <p className="truncate text-xs text-muted">{[e.tags.join(", "), e.note].filter(Boolean).join(" — ")}</p>}
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete entry for ${e.date}`}
                        onClick={() => moodStore.update((list) => list.filter((x) => x.id !== e.id))}
                        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-subtle hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <p className="px-2 text-xs leading-relaxed text-subtle">
            Mood tracking is for personal reflection only and isn&apos;t a diagnostic tool. If low mood lasts more than two weeks, consider talking to a professional —{" "}
            <Link href="/library/when-to-seek-help" className="text-primary hover:underline">
              when to seek help
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { BatteryMedium, Check, ChevronDown, MessageCircle, Minus, Moon, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { APP } from "@/lib/config";
import { CHAT_DRAFT_MARKER, moodStore, setChatDraft, useHydrated } from "@/lib/storage";
import type { MoodEntry } from "@/lib/types";
import { cn, localDateKey, uid } from "@/lib/utils";
import { MoodChart, moodSummary } from "./mood-chart";
import { MOOD_TAGS, MOODS, moodMeta, moodTint } from "./mood-meta";

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
  // Entries within the last 7 calendar days (today included).
  const weekStart = new Date(`${today}T12:00:00`);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = localDateKey(weekStart);
  const week = recent.filter((e) => e.date >= weekStartKey && e.date <= today);
  const avg = (f: (e: MoodEntry) => number | undefined) => {
    const vals = week.map(f).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const tagCounts = new Map<string, number>();
  week.forEach((e) => e.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const avgSleep = avg((e) => e.sleepHours);
  const avgEnergy = avg((e) => e.energy);

  const reflectPrompt = saved
    ? `I just checked in feeling ${moodMeta(saved.mood).label.toLowerCase()} today (energy ${saved.energy}/5, about ${saved.sleepHours}h of sleep)${saved.tags.length ? `. On my mind: ${saved.tags.join(", ").toLowerCase()}` : ""}.`
    : "";
  const selected = mood ? moodMeta(mood) : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-12">
      <PageHeader eyebrow="Daily check-in" title="How are you feeling today?" description="A quick, private check-in. It stays on this device." />

      <div className="grid gap-8 lg:grid-cols-5 lg:gap-6">
        {/* ── Check-in ── */}
        <Card className="p-5 sm:p-7 lg:col-span-3 lg:self-start">
          {saved ? (
            <div className="flex animate-fade-up flex-col items-center py-4 text-center" role="status">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="h-8 w-8" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-serif text-2xl font-semibold">Thanks for checking in</h2>
              <p className="mt-2 max-w-sm text-base leading-relaxed text-muted">
                {saved.mood <= 2
                  ? "It sounds like today has been hard. Be gentle with yourself. Small things count."
                  : saved.mood === 3
                    ? "Steady days matter too. Is there one small thing that might lift today a little?"
                    : "Lovely. Taking a moment to notice what's going well helps it stick."}
              </p>
              <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
                {/* Hand the check-in over in this tab only: in the URL it would stay in browser history. */}
                <ButtonLink href={`/chat?new=${CHAT_DRAFT_MARKER}`} onClick={() => setChatDraft(reflectPrompt)} size="lg" fullWidth>
                  <MessageCircle className="h-5 w-5" aria-hidden="true" /> Talk it through with {APP.companion}
                </ButtonLink>
                <ButtonLink
                  href={`/library/${saved.mood <= 2 ? "self-compassion" : saved.mood === 3 ? "movement-and-mood" : "gratitude-savoring"}`}
                  variant="secondary"
                  size="lg"
                  fullWidth
                >
                  <Sparkles className="h-5 w-5" aria-hidden="true" /> Try a helpful exercise
                </ButtonLink>
                <Button variant="ghost" onClick={() => setSaved(null)} fullWidth>
                  <Pencil className="h-5 w-5" aria-hidden="true" /> Edit check-in
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted">Your check-in is only shared with {APP.companion} if you choose to send the message.</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <fieldset>
                <legend className="text-lg font-semibold">Pick the face that fits</legend>
                <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
                  {MOODS.map(({ value, label, icon: Icon, color }) => {
                    const on = mood === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMood(value)}
                        aria-pressed={on}
                        className={cn(
                          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 px-1 py-3 text-[0.9375rem] font-medium transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] sm:min-h-28 sm:text-base",
                          on ? "-translate-y-0.5 font-semibold text-fg shadow-lift" : "border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-2",
                        )}
                        style={on ? { background: moodTint(color, 20), borderColor: color } : undefined}
                      >
                        <Icon className="h-9 w-9 sm:h-10 sm:w-10" style={{ color }} strokeWidth={on ? 2.25 : 2} aria-hidden="true" />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 min-h-6 text-center text-base text-muted" aria-live="polite">
                  {selected ? (
                    <>
                      You picked <span className="font-semibold text-fg">{selected.label}</span>.
                    </>
                  ) : (
                    "Tap a face to choose."
                  )}
                </p>
              </fieldset>

              <div className="mt-6">
                <label htmlFor="mood-note" className="text-base font-semibold">
                  A note for yourself <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="mood-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Anything you'd like to remember about today…"
                  className="mt-2 w-full resize-none rounded-2xl border border-border-strong bg-surface px-4 py-3 text-base leading-relaxed outline-none transition-shadow placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
              </div>

              {/* Extra details: progressive disclosure, same data as before. */}
              <details className="group mt-4 rounded-2xl border border-border bg-surface-2/60" open={!!existing && (existing.tags.length > 0 || existing.energy !== 3 || existing.sleepHours !== 7)}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-base font-medium text-fg [&::-webkit-details-marker]:hidden">
                  <span>
                    Add energy, sleep and what&apos;s on your mind <span className="font-normal text-muted">(optional)</span>
                  </span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-6 px-4 pb-5 pt-2">
                  <fieldset>
                    <legend className="flex items-center gap-2 text-base font-semibold">
                      <BatteryMedium className="h-5 w-5 text-muted" aria-hidden="true" /> Energy
                    </legend>
                    <div className="mt-3 flex gap-2">
                      {([1, 2, 3, 4, 5] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setEnergy(v)}
                          aria-pressed={energy === v}
                          aria-label={`Energy ${v} of 5`}
                          className={cn(
                            "h-12 flex-1 cursor-pointer rounded-xl border text-base font-semibold transition-colors",
                            energy === v ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface hover:bg-surface-2",
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-sm text-muted" aria-hidden="true">
                      <span>Drained</span>
                      <span>Full of energy</span>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="flex items-center gap-2 text-base font-semibold">
                      <Moon className="h-5 w-5 text-muted" aria-hidden="true" /> Sleep last night
                    </legend>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Less sleep"
                        onClick={() => setSleep((s) => Math.max(0, s - 0.5))}
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface hover:bg-surface-2"
                      >
                        <Minus className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <output className="flex-1 text-center text-xl font-semibold tabular-nums" aria-live="polite">
                        {sleep} hours
                      </output>
                      <button
                        type="button"
                        aria-label="More sleep"
                        onClick={() => setSleep((s) => Math.min(14, s + 0.5))}
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface hover:bg-surface-2"
                      >
                        <Plus className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-base font-semibold">What&apos;s been on your mind?</legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {MOOD_TAGS.map((t) => {
                        const on = tags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                            className={cn(
                              "inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] transition-colors",
                              on ? "border-primary bg-primary-soft font-medium text-fg" : "border-border-strong bg-surface text-muted hover:bg-surface-2 hover:text-fg",
                            )}
                          >
                            {on && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              </details>

              <Button type="submit" disabled={!mood} size="lg" fullWidth className="mt-6">
                <Check className="h-5 w-5" aria-hidden="true" /> {existing ? "Update today's check-in" : "Save check-in"}
              </Button>
              <p className="mt-2 text-center text-sm text-muted">{mood ? "Saved only on this device." : "Choose a face above to save."}</p>
            </form>
          )}
        </Card>

        <div className="space-y-8 lg:col-span-2 lg:space-y-6">
          {/* ── Your week ── */}
          <section aria-labelledby="mood-week-title">
            <SectionTitle id="mood-week-title" title="Your week" />
            <Card className="p-5 sm:p-6">
              <p className="text-base leading-relaxed text-fg">{moodSummary(entries, 7)}</p>
              <div className="mt-5">
                <MoodChart entries={entries} days={7} />
              </div>
              {week.length > 0 && (
                <dl className="mt-5 grid grid-cols-3 gap-2 text-center sm:gap-3">
                  <div className="rounded-2xl bg-surface-2 px-2 py-3">
                    <dt className="text-sm text-muted">Mood</dt>
                    <dd className="mt-0.5 text-lg font-semibold">{moodMeta(Math.round(avg((e) => e.mood) ?? 3)).label}</dd>
                  </div>
                  <div className="rounded-2xl bg-surface-2 px-2 py-3">
                    <dt className="text-sm text-muted">Energy</dt>
                    <dd className="mt-0.5 text-lg font-semibold">{avgEnergy != null ? `${avgEnergy.toFixed(1)}/5` : "–"}</dd>
                  </div>
                  <div className="rounded-2xl bg-surface-2 px-2 py-3">
                    <dt className="text-sm text-muted">Sleep</dt>
                    <dd className="mt-0.5 text-lg font-semibold">{avgSleep != null ? `${avgSleep.toFixed(1)}h` : "–"}</dd>
                  </div>
                </dl>
              )}
              {topTags.length > 0 && (
                <p className="mt-4 text-base text-muted">
                  Often on your mind: <span className="font-medium text-fg">{topTags.map(([t]) => t).join(", ")}</span>
                </p>
              )}
            </Card>
          </section>

          {/* ── Recent entries ── */}
          <section aria-labelledby="mood-recent-title">
            <SectionTitle id="mood-recent-title" title="Recent check-ins" />
            {recent.length === 0 ? (
              <EmptyState icon={<Moon className="h-6 w-6" aria-hidden="true" />} title="No check-ins yet" description="Your first check-in will show up here." />
            ) : (
              <Card className="px-2 py-1 sm:px-3">
                <ul className="divide-y divide-border">
                  {recent.slice(0, 8).map((e) => {
                    const m = moodMeta(e.mood);
                    const Icon = m.icon;
                    const dateLabel = new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                    const detail = [e.tags.join(", "), e.note].filter(Boolean).join(" · ");
                    return (
                      <li key={e.id} className="flex items-center gap-3 px-2 py-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: moodTint(m.color, 16) }}>
                          <Icon className="h-6 w-6" style={{ color: m.color }} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold leading-snug">
                            {m.label}
                            <span className="font-normal text-muted">
                              {" "}
                              · {e.date === today ? "Today" : dateLabel}
                              {e.sample && " · sample"}
                            </span>
                          </p>
                          {detail && <p className="truncate text-[0.9375rem] text-muted">{detail}</p>}
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete check-in for ${dateLabel}`}
                          onClick={() => moodStore.update((list) => list.filter((x) => x.id !== e.id))}
                          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>

          <p className="px-1 text-sm leading-relaxed text-muted">
            Mood check-ins are for your own reflection, not a diagnosis. If low mood lasts more than two weeks, consider talking to {APP.careTeam} or another professional.{" "}
            <Link href="/library/when-to-seek-help" className="font-medium text-primary underline-offset-4 hover:underline">
              When to seek help
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

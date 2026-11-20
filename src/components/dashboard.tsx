"use client";

import { ArrowRight, AudioLines, BookOpen, History, Info, MessageCircle, Settings, ShieldCheck, SmilePlus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { usesRemoteAI } from "@/lib/agent/client";
import { analyzeConversation } from "@/lib/agent/state";
import { APP, DISCLAIMER } from "@/lib/config";
import { KNOWLEDGE_BASE } from "@/lib/knowledge/base";
import { conversationsStore, moodStore, settingsStore, useHydrated } from "@/lib/storage";
import { useServerConfig } from "@/lib/use-server-config";
import { cn, conversationSummary, formatRelative, greetingForHour, localDateKey } from "@/lib/utils";
import { MoodChart } from "./mood/mood-chart";
import { MOODS } from "./mood/mood-meta";
import { Card } from "./ui/primitives";

const TECHNIQUES = KNOWLEDGE_BASE.filter((e) => e.technique);

export function Dashboard() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const [noticeHidden, setNoticeHidden] = useState(false);
  const conversations = conversationsStore.useValue();
  const moods = moodStore.useValue();
  const settings = settingsStore.useValue();
  const { config } = useServerConfig();

  const name = useMemo(() => {
    for (const c of conversations) {
      const n = analyzeConversation(c.messages).memory.name;
      if (n) return n;
    }
    return undefined;
  }, [conversations]);

  const todayKey = localDateKey();
  const checkedInToday = moods.some((m) => m.date === todayKey);
  const dayIndex = Math.floor(new Date(`${todayKey}T00:00:00`).getTime() / 86_400_000);
  const practice = TECHNIQUES[dayIndex % TECHNIQUES.length];
  const remote = usesRemoteAI(settings, config);
  const greeting = hydrated ? greetingForHour() : "Welcome";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-12">
      {params.get("notice") === "demo" && !noticeHidden && (
        <div role="status" className="mb-6 flex animate-fade-up items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm leading-relaxed">
            <strong className="font-semibold">Accounts, subscriptions and payments are turned off in this demo.</strong> You&apos;re using {APP.name} as a guest — everything is free and stays in this browser.
          </p>
          <button type="button" onClick={() => setNoticeHidden(true)} aria-label="Dismiss" className="-m-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="animate-fade-up">
        <p className="text-sm font-medium text-primary">{hydrated && name ? `${greeting}, ${name}` : greeting}</p>
        <h1 className="mt-2 max-w-2xl font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">How are you arriving today?</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          A calm space to talk things through with {APP.companion}, your {APP.role}. No sign-up, no judgement — just a conversation at your pace.
        </p>
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Quick mood check-in">
          {MOODS.map(({ value, label, icon: Icon, color }) => (
            <Link
              key={value}
              href={`/mood?mood=${value}`}
              className="group inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface/80 px-4 text-sm font-medium shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <Icon className="h-5 w-5 transition-transform group-hover:scale-110" style={{ color }} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* Primary actions */}
      <section className="mt-10 grid gap-4 md:grid-cols-5" aria-label="Start a conversation">
        <Link
          href="/voice"
          className="group relative overflow-hidden rounded-[2rem] bg-linear-to-br from-primary to-[color-mix(in_oklab,var(--primary)_55%,var(--accent))] p-7 text-primary-fg shadow-lift transition-transform duration-300 hover:-translate-y-1 md:col-span-3"
        >
          <span className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-90">
            <AudioLines className="h-5 w-5" /> Recommended
          </span>
          <h2 className="mt-5 font-serif text-3xl font-semibold">Start Voice Conversation</h2>
          <p className="mt-2 max-w-md opacity-90">
            Just talk. {APP.companion} listens, explains things in plain words, and gently asks a question if you go quiet — with a live transcript.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 font-semibold">
            Start talking <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
        <Link
          href={`/chat?new=start`}
          className="group relative overflow-hidden rounded-[2rem] border border-border bg-surface p-7 shadow-soft transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift md:col-span-2"
        >
          <span className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent-soft blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <MessageCircle className="h-6 w-6" />
          </span>
          <h2 className="relative mt-5 font-serif text-2xl font-semibold">Talk with {APP.companion}</h2>
          <p className="relative mt-2 max-w-sm text-muted">Prefer typing? Chat with {APP.companion} by text instead.</p>
          <span className="relative mt-6 inline-flex items-center gap-2 font-semibold text-primary">
            Open chat <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      {/* Secondary tiles */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Explore">
        {[
          { href: "/library", icon: BookOpen, title: "Knowledge Library", body: "Evidence-informed guides and techniques.", stat: `${KNOWLEDGE_BASE.length} articles`, tone: "bg-primary-soft text-primary" },
          {
            href: "/mood",
            icon: SmilePlus,
            title: "Daily Mood Check-in",
            body: "A 30-second check-in to notice patterns.",
            stat: hydrated ? (checkedInToday ? "Checked in today" : "Not yet today") : "—",
            tone: "bg-warm-soft text-warm",
          },
          {
            href: "/history",
            icon: History,
            title: "Conversation History",
            body: "Review, continue or delete past chats.",
            stat: hydrated ? `${conversations.length} saved` : "—",
            tone: "bg-accent-soft text-accent",
          },
          {
            href: "/settings",
            icon: Settings,
            title: "Settings",
            body: "Privacy, consent, voice and data.",
            stat: hydrated ? (remote ? "Smart replies on" : "Offline demo") : "—",
            tone: "bg-surface-3 text-fg",
          },
        ].map(({ href, icon: Icon, title, body, stat, tone }, i) => (
          <Link
            key={href}
            href={href}
            style={{ animationDelay: `${80 + i * 50}ms` }}
            className="group flex animate-fade-up flex-col rounded-3xl border border-border bg-surface/90 p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tone)}>
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            <span className="mt-4 text-xs font-medium text-subtle">{stat}</span>
          </Link>
        ))}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        {/* Practice of the day */}
        <Card className="p-6 lg:col-span-1">
          <p className="flex items-center gap-2 text-sm font-medium text-accent">
            <Sparkles className="h-4 w-4" /> Today&apos;s practice
          </p>
          <h3 className="mt-3 font-serif text-xl font-semibold">{practice.technique!.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{practice.summary}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-subtle">{practice.technique!.duration}</span>
            <Link href={`/library/${practice.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              Try it <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        {/* Mood trend */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-warm">Your week</p>
            <Link href="/mood" className="text-xs font-semibold text-primary hover:underline">
              Check in
            </Link>
          </div>
          {hydrated && moods.length ? (
            <div className="mt-4">
              <MoodChart entries={moods} days={7} />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">No check-ins yet. Daily check-ins help you notice patterns in mood, sleep and energy.</p>
          )}
        </Card>

        {/* Recent conversations */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-primary">Recent conversations</p>
            <Link href="/history" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {hydrated && conversations.length ? (
            <ul className="mt-3 divide-y divide-border">
              {conversations.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <Link href={`/chat?id=${c.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                    {c.mode === "voice" ? <AudioLines className="h-4 w-4 shrink-0 text-accent" /> : <MessageCircle className="h-4 w-4 shrink-0 text-primary" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversationSummary(c).title}</span>
                    <span className="shrink-0 text-xs text-subtle">{formatRelative(c.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">Your conversations will appear here. They&apos;re stored only in this browser.</p>
          )}
        </Card>
      </section>

      <footer className="mt-12 flex items-start gap-3 rounded-3xl border border-border bg-surface/70 p-5 text-sm leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p>
          {DISCLAIMER} If you&apos;re struggling or in danger, please{" "}
          <Link href="/support" className="font-semibold text-danger hover:underline">
            reach out to a crisis line
          </Link>
          . This is an MVP demo using fictional sample data — no accounts, subscriptions or payments.
        </p>
      </footer>
    </div>
  );
}

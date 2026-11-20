"use client";

import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Clock,
  History,
  Info,
  LifeBuoy,
  MessageCircle,
  Mic,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { analyzeConversation } from "@/lib/agent/state";
import { APP, DISCLAIMER } from "@/lib/config";
import { KNOWLEDGE_BASE } from "@/lib/knowledge/base";
import { conversationsStore, useHydrated } from "@/lib/storage";
import { cn, conversationSummary, formatRelative, greetingForHour, localDateKey } from "@/lib/utils";
import { MOODS } from "./mood/mood-meta";
import { ButtonLink } from "./ui/button";
import { Card, SectionTitle } from "./ui/primitives";

const TECHNIQUES = KNOWLEDGE_BASE.filter((e) => e.technique);

const EXPLORE: { href: string; icon: LucideIcon; title: string; body: string; tone: string }[] = [
  { href: "/voice", icon: AudioLines, title: "Talk", body: "Speak with Ari out loud.", tone: "bg-primary-soft text-primary" },
  { href: "/chat?new=start", icon: MessageCircle, title: "Chat", body: "Type at your own pace.", tone: "bg-accent-soft text-accent" },
  { href: "/library", icon: BookOpen, title: "Exercises", body: "Calming tools and guides.", tone: "bg-success-soft text-success" },
  { href: "/mood", icon: SmilePlus, title: "Mood check-in", body: "Notice how you're doing.", tone: "bg-warm-soft text-warm" },
  { href: "/history", icon: History, title: "Past conversations", body: "Pick up where you left off.", tone: "bg-surface-3 text-fg" },
  { href: "/support", icon: LifeBuoy, title: "Crisis support", body: "Get help right now.", tone: "bg-danger-soft text-danger" },
];

export function Dashboard() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const [noticeHidden, setNoticeHidden] = useState(false);
  const conversations = conversationsStore.useValue();

  const name = useMemo(() => {
    for (const c of conversations) {
      const n = analyzeConversation(c.messages).memory.name;
      if (n) return n;
    }
    return undefined;
  }, [conversations]);

  const todayKey = localDateKey();
  const dayIndex = Math.floor(new Date(`${todayKey}T00:00:00`).getTime() / 86_400_000);
  const practice = TECHNIQUES[dayIndex % TECHNIQUES.length];
  const greeting = hydrated ? greetingForHour() : "Welcome";
  const last = hydrated ? conversations[0] : undefined;
  const lastSummary = last ? conversationSummary(last) : undefined;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-6 lg:max-w-4xl lg:px-10 lg:pt-12">
      {params.get("notice") === "demo" && !noticeHidden && (
        <div role="status" className="mb-6 flex animate-fade-up items-start gap-3 rounded-3xl border border-border bg-surface p-4 shadow-soft">
          <Info className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="flex-1 text-base leading-relaxed">
            <strong className="font-semibold">Accounts, subscriptions and payments are turned off in this demo.</strong> You&apos;re using {APP.name} as a
            guest. Everything is free and stays in this browser.
          </p>
          <button
            type="button"
            onClick={() => setNoticeHidden(true)}
            aria-label="Dismiss notice"
            className="-m-2 flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

      {/* 1. Greeting */}
      <section className="animate-fade-up text-center" aria-labelledby="home-title">
        <p className="text-base font-medium text-primary">{hydrated && name ? `${greeting}, ${name}` : greeting}</p>
        <h1 id="home-title" className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight tracking-tight text-fg lg:text-4xl">
          How can I help today?
        </h1>
        <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-muted sm:text-[1.0625rem]">
          I&apos;m {APP.companion}, your {APP.role}. I work alongside {APP.careTeam}.
        </p>

        {/* 2. Hero action */}
        <div className="mt-8 flex flex-col items-center">
          <Link href="/voice" className="group flex flex-col items-center rounded-3xl p-2 focus-visible:outline-offset-4">
            <span className="relative flex h-[7.5rem] w-[7.5rem] items-center justify-center">
              <span aria-hidden className="absolute -inset-3 rounded-full bg-primary-soft opacity-70" />
              <span
                aria-hidden
                className="absolute inset-0 animate-breathe rounded-full bg-orb shadow-lift transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95"
              />
              <Mic className="relative h-11 w-11 text-white drop-shadow-sm" strokeWidth={2} aria-hidden />
            </span>
            <span className="mt-6 text-lg font-semibold text-fg">Tap to talk</span>
          </Link>
          <Link
            href="/chat?new=start"
            className="mt-1 inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-base font-medium text-primary underline-offset-4 hover:underline"
          >
            Prefer typing? Chat instead
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* 3. Quick check-in */}
      <section className="mt-10 animate-fade-up" aria-labelledby="home-feeling">
        <SectionTitle id="home-feeling" title="How are you feeling?" />
        <div className="grid grid-cols-5 gap-2 sm:gap-3" role="group" aria-labelledby="home-feeling">
          {MOODS.map(({ value, label, icon: Icon, color }) => (
            <Link
              key={value}
              href={`/mood?mood=${value}`}
              className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-3xl border border-border bg-surface px-1 py-3 shadow-soft transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift active:scale-[0.97]"
            >
              <Icon className="h-8 w-8" style={{ color }} aria-hidden />
              <span className="text-[0.9375rem] font-medium text-fg">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Continue */}
      {last && lastSummary && (
        <section className="mt-8 animate-fade-up" aria-labelledby="home-continue">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <span aria-hidden className="h-12 w-12 shrink-0 rounded-full bg-orb" />
            <div className="min-w-0 flex-1">
              <h2 id="home-continue" className="text-lg font-semibold text-fg">
                Continue your last conversation
              </h2>
              <p className="mt-0.5 truncate text-base text-muted">{lastSummary.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[0.9375rem] text-muted">
                {last.mode === "voice" ? <AudioLines className="h-4 w-4" aria-hidden /> : <MessageCircle className="h-4 w-4" aria-hidden />}
                {last.mode === "voice" ? "Voice" : "Chat"} · {formatRelative(last.updatedAt)}
              </p>
            </div>
            <ButtonLink href={`/chat?id=${last.id}`} size="lg" className="w-full sm:w-auto">
              Continue
              <ArrowRight className="h-5 w-5" aria-hidden />
            </ButtonLink>
          </Card>
        </section>
      )}

      {/* 5. Try this now */}
      <section className="mt-8 animate-fade-up" aria-labelledby="home-try">
        <SectionTitle id="home-try" title="Try this now" />
        <Card interactive className="relative p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-medium text-accent">Today&apos;s calming exercise</p>
              <h3 className="mt-0.5 text-lg font-semibold text-fg">
                <Link href={`/library/${practice.slug}`} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']">
                  {practice.technique!.name}
                </Link>
              </h3>
              <p className="mt-1 text-base leading-relaxed text-muted">{practice.summary}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[0.9375rem] text-muted">
                  <Clock className="h-4 w-4" aria-hidden />
                  {practice.technique!.duration}
                </span>
                <span aria-hidden className="inline-flex items-center gap-1.5 text-base font-semibold text-primary">
                  Start <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 6. Explore */}
      <section className="mt-8" aria-labelledby="home-explore">
        <SectionTitle id="home-explore" title="Explore" />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {EXPLORE.map(({ href, icon: Icon, title, body, tone }, i) => (
            <li key={href} className="animate-fade-up" style={{ animationDelay: `${60 + i * 40}ms` }}>
              <Link
                href={href}
                className="flex h-full min-h-[8.5rem] flex-col rounded-3xl border border-border bg-surface p-4 shadow-soft transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift sm:p-5"
              >
                <span aria-hidden className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", tone)}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="mt-3 text-base font-semibold leading-snug text-fg">{title}</span>
                <span className="mt-0.5 text-[0.9375rem] leading-snug text-muted">{body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-10 flex items-start gap-3 rounded-3xl border border-border bg-surface/70 p-5 text-[0.9375rem] leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p>
          {DISCLAIMER} If you&apos;re struggling or in danger,{" "}
          <Link href="/support" className="font-semibold text-danger underline-offset-4 hover:underline">
            get help now
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}

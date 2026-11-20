import { ArrowDown, ArrowLeft, Clock, ExternalLink, HeartHandshake, MessageCircle, Mic, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreathingPacer } from "@/components/library/breathing-pacer";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { APP } from "@/lib/config";
import { KNOWLEDGE_BASE, getEntry } from "@/lib/knowledge/base";
import { categoryTone } from "@/lib/knowledge/category-tone";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return KNOWLEDGE_BASE.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

export default async function LibraryEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) notFound();

  const related = KNOWLEDGE_BASE.filter((e) => e.category === entry.category && e.slug !== entry.slug).slice(0, 3);

  return (
    <article className="mx-auto max-w-2xl px-5 pb-16 pt-4 sm:px-6 lg:pt-10">
      <Link
        href="/library"
        className="-ml-3 inline-flex h-12 items-center gap-2 rounded-full px-3 text-base font-medium text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden /> All exercises & guides
      </Link>

      <header className="mt-4 animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", categoryTone(entry.category))}>{entry.category}</span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Clock className="h-4 w-4" aria-hidden /> {entry.readMinutes} min read
          </span>
        </div>
        <h1 className="mt-4 font-serif text-[1.75rem] font-semibold leading-tight tracking-tight text-fg lg:text-4xl">{entry.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">{entry.summary}</p>

        {entry.technique && (
          <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-base font-medium text-fg">
              <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden />
              Includes an exercise: {entry.technique.name} ({entry.technique.duration})
            </p>
            <ButtonLink href="#try-it" size="lg" className="shrink-0 max-sm:w-full">
              Try it now <ArrowDown className="h-5 w-5" aria-hidden />
            </ButtonLink>
          </div>
        )}
      </header>

      <div className="mt-8 space-y-5 text-[1.0625rem] leading-[1.75] text-fg">
        {entry.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {entry.technique && (
        <Card id="try-it" className="mt-10 scroll-mt-24 p-5 sm:p-8">
          <p className="flex items-center gap-2 text-base font-medium text-accent">
            <Sparkles className="h-5 w-5" aria-hidden /> Try it now · {entry.technique.duration}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-fg">{entry.technique.name}</h2>
          <ol className="mt-6 space-y-4">
            {entry.technique.steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-semibold text-fg" aria-hidden>
                  {i + 1}
                </span>
                <span className="pt-1 text-[1.0625rem] leading-relaxed text-fg">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s}
                </span>
              </li>
            ))}
          </ol>
          {entry.technique.pacer && (
            <div className="mt-8">
              <BreathingPacer {...entry.technique.pacer} />
            </div>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {/* The chat opens a new conversation that offers exactly this technique. */}
            <ButtonLink href={`/chat?practice=${entry.slug}`} size="lg" fullWidth className="sm:w-auto">
              <MessageCircle className="h-5 w-5" aria-hidden /> Practise with {APP.companion}
            </ButtonLink>
            <ButtonLink href="/voice" variant="secondary" size="lg" fullWidth className="sm:w-auto">
              <Mic className="h-5 w-5" aria-hidden /> Try it by voice
            </ButtonLink>
          </div>
        </Card>
      )}

      {entry.seekHelp && (
        <aside className="mt-8 flex gap-4 rounded-3xl border border-border bg-warm-soft p-5">
          <HeartHandshake className="mt-0.5 h-6 w-6 shrink-0 text-warm" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-fg">When to reach out</h2>
            <p className="mt-1 text-base leading-relaxed text-fg">{entry.seekHelp}</p>
          </div>
        </aside>
      )}

      <section className="mt-10 border-t border-border pt-8">
        <SectionTitle title="Sources & further reading" />
        <ul className="space-y-1">
          {entry.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 text-base text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.name} <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          General information for learning, not medical advice or a diagnosis. If you&apos;re worried about your mental health, talk to a doctor or licensed professional.{" "}
          <Link href="/support" className="font-medium text-danger underline-offset-4 hover:underline">
            Get help now
          </Link>
        </p>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <SectionTitle title="You might also like" />
          <ul className="grid gap-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/library/${r.slug}`}
                  className="block rounded-3xl border border-border bg-surface p-5 shadow-soft transition-[box-shadow,border-color] duration-200 hover:border-border-strong hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="text-[1.0625rem] font-semibold leading-snug text-fg">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-[0.9375rem] text-muted">{r.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

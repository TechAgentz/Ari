import { ArrowLeft, Clock, ExternalLink, HeartHandshake, MessageCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreathingPacer } from "@/components/library/breathing-pacer";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
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
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
      <Link href="/library" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Library
      </Link>

      <header className="mt-6 animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", categoryTone(entry.category))}>{entry.category}</span>
          <span className="inline-flex items-center gap-1 text-xs text-subtle">
            <Clock className="h-3.5 w-3.5" /> {entry.readMinutes} min read
          </span>
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{entry.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{entry.summary}</p>
      </header>

      <div className="mt-8 space-y-4 text-[1.05rem] leading-[1.75]">
        {entry.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {entry.technique && (
        <Card className="mt-10 p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-accent">
            <Sparkles className="h-4 w-4" /> Technique · {entry.technique.duration}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold">{entry.technique.name}</h2>
          <ol className="mt-5 space-y-3">
            {entry.technique.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
          {entry.technique.pacer && (
            <div className="mt-8">
              <BreathingPacer {...entry.technique.pacer} />
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-2">
            {/* The chat opens a new conversation that offers exactly this technique. */}
            <ButtonLink href={`/chat?practice=${entry.slug}`}>
              <MessageCircle className="h-4 w-4" /> Practise with {APP.companion}
            </ButtonLink>
            <ButtonLink href="/voice" variant="secondary">
              Try it by voice
            </ButtonLink>
          </div>
        </Card>
      )}

      {entry.seekHelp && (
        <aside className="mt-8 flex gap-3 rounded-3xl border border-border bg-warm-soft/60 p-5">
          <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-warm" />
          <div>
            <h2 className="font-semibold">When to reach out</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{entry.seekHelp}</p>
          </div>
        </aside>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Sources & further reading</h2>
        <ul className="mt-3 space-y-2">
          {entry.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                {s.name} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-subtle">
          General educational information, not medical advice or a diagnosis. If you&apos;re worried about your mental health, talk to a doctor or licensed professional.{" "}
          <Link href="/support" className="text-danger hover:underline">
            Crisis support
          </Link>
        </p>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-serif text-xl font-semibold">Related</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/library/${r.slug}`} className="block h-full rounded-2xl border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lift">
                  <p className="font-medium leading-snug">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{r.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
